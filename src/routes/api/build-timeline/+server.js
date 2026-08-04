import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private'; 

export async function POST({ request, platform }) {
    let debugLogs = [];
    const pushLog = (stage, msg) => debugLogs.push(`[${stage}] ${msg}`);

    try {
        const { fireid } = await request.json();
        if (!fireid) return json({ error: "Missing fireid parameter" }, { status: 400 });
        
        const ufireid = fireid.toUpperCase();
        pushLog("INIT", `Processing unique tracking identity value: "${ufireid}"`);

        const FIRE_STORE = platform.env.FIRE_TIMELINE; 
        if (!FIRE_STORE) {
            throw new Error("Cloudflare KV binding 'FIRE_TIMELINE' is missing in dashboard settings.");
        }

        const username = env.ARCGIS_USER;
        const password = env.ARCGIS_PASS;
        if (!username || !password) {
            throw new Error("ArcGIS credentials are empty. Ensure ARCGIS_USER and ARCGIS_PASS are bound in the Cloudflare dashboard settings.");
        }

        pushLog("AUTH", "Generating ArcGIS authentication session token...");
        const tokenUrl = "https://www.arcgis.com/sharing/generatetoken";
        const tokenBody = new URLSearchParams({
            f: "json", username, password,
            referer: "https://firelibrary.org", expiration: "180", client: "referer"
        });

        const tokenResp = await fetch(tokenUrl, { 
            method: "POST", body: tokenBody.toString(), 
            headers: { "Content-Type": "application/x-www-form-urlencoded" }
        });
        const tokenText = await tokenResp.text();

        if (!tokenText.trim().startsWith('{')) {
            throw new Error(`Token endpoint rejected format. Response: ${tokenText.slice(0, 200)}`);
        }
        const tokenData = JSON.parse(tokenText);
        const token = tokenData.token;
        if (!token) throw new Error(`Authorization rejected by ArcGIS server: ${JSON.stringify(tokenData)}`);
        pushLog("AUTH", "Token generated successfully.");

        pushLog("IH_QUERY", "Querying IRWIN Incident History feature maps...");
        const ihUrl = "https://services1.arcgis.com/Hp6G80Pky0om7QvQ/arcgis/rest/services/IRWIN_Incident_History/FeatureServer/0/query";
        const ihParams = new URLSearchParams({ f: "json", token, outFields: "*", where: `UniqueFireIdentifier='${ufireid}'` });

        const ihResp = await fetch(`${ihUrl}?${ihParams.toString()}`);
        const ihText = await ihResp.text();

        if (!ihText.trim().startsWith('{')) {
            throw new Error(`Incident history server returned invalid HTML: ${ihText.slice(0, 200)}`);
        }
        const ihData = JSON.parse(ihText);
        if (ihData.error) throw new Error(`IH Query Error: ${ihData.error.message}`);
        if (!ihData.features || ihData.features.length === 0) {
            return json({ success: false, error: `No history records found matching "${ufireid}"`, rawArcgisResponse: debugLogs.join("\n") }, { status: 404 });
        }
        pushLog("IH_QUERY", `Found ${ihData.features.length} trace records.`);

        const firstFeatureAttr = ihData.features[0].attributes;
        const irwinid = firstFeatureAttr.IrwinID;
        const incidentName = firstFeatureAttr.IncidentName?.trim() || ufireid;
        pushLog("DATA_CLEAN", `Target localized name: "${incidentName}". IrwinID string: ${irwinid}`);

        let ihMap = new Map();
        ihData.features.forEach(f => {
            const attr = f.attributes;
            if (!attr || !attr.GDB_FROM_DATE) return;
            const dateStr = new Date(attr.GDB_FROM_DATE).toISOString().split('T')[0];
            ihMap.set(dateStr, [
                dateStr,
                parseInt(attr.CalculatedAcres) || 0,
                parseInt(attr.EstimatedCostToDate) || 0,
                parseInt(attr.PercentContained) || 0,
                parseInt(attr.TotalIncidentPersonnel) || 0
            ]);
        });

        const sortedIhDates = Array.from(ihMap.keys()).sort();
        const ihTimelineList = sortedIhDates.map(d => ihMap.get(d));
        const adate = sortedIhDates[0] || null;
        const bdate = sortedIhDates[sortedIhDates.length - 1] || null;
        pushLog("DATA_CLEAN", `Incident timelines grouped into matrix array. Range: ${adate} to ${bdate}`);

        let rhTimelineList = [];
        if (irwinid) {
            pushLog("RH_QUERY", "Querying matching tactical response personnel details...");
            const rhUrl = "https://services1.arcgis.com/Hp6G80Pky0om7QvQ/arcgis/rest/services/IRWIN_Incidents/FeatureServer/2/query";
            const rhParams = new URLSearchParams({ f: "json", token, outFields: "*", where: `IrwinID='${irwinid}'` });

            const rhResp = await fetch(`${rhUrl}?${rhParams.toString()}`);
            const rhText = await rhResp.text();

            if (rhText.trim().startsWith('{')) {
                const rhData = JSON.parse(rhText);
                if (rhData.features && rhData.features.length > 0) {
                    pushLog("RH_QUERY", `Found ${rhData.features.length} tactical deployment items.`);
                    
                    const statesList = new Set(['AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY']);
                    let dailyAgencies = {};

                    rhData.features.forEach(f => {
                        const attr = f.attributes;
                        if (!attr || !attr.ResourceQuantityCurrentAsOf) return;
                        const dateStr = new Date(attr.ResourceQuantityCurrentAsOf).toISOString().split('T')[0];
                        let agency = attr.ResourceAgency || "Unknown";
                        if (statesList.has(agency) || agency === "State") agency = "ST";
                        
                        if (!dailyAgencies[dateStr]) dailyAgencies[dateStr] = {};
                        dailyAgencies[dateStr][agency] = (dailyAgencies[dateStr][agency] || 0) + (parseInt(attr.ResourcePersonnelQuantity) || 0);
                    });

                    rhTimelineList = Object.keys(dailyAgencies).sort().map(date => {
                        const agencies = dailyAgencies[date];
                        const total = Object.values(agencies).reduce((sum, v) => sum + v, 0);
                        return [date, total, agencies];
                    });
                    pushLog("RH_QUERY", "Resource allocation matrix built.");
                } else {
                    pushLog("RH_QUERY", "No matching resource assignments returned from feature layer.");
                }
            }
        }

        pushLog("KV_STORAGE", "Packaging metadata timelines payload objects...");
        const contextSummary = { ufireid, name: incidentName, ihdate: new Date().toISOString().split('T')[0], adate, bdate };
        const dataPayload = { meta: contextSummary, incident_history_timeline: ihTimelineList, resource_history_timeline: rhTimelineList };
        
        await FIRE_STORE.put(`fire:data:${ufireid}`, JSON.stringify(dataPayload));
        pushLog("KV_STORAGE", `Saved 'fire:data:${ufireid}' timeline matrix package safely.`);

        let oldDataRaw = await FIRE_STORE.get("fire:index_json");
        let oldData = oldDataRaw ? JSON.parse(oldDataRaw) : [];
        oldData.push(contextSummary);
        await FIRE_STORE.put("fire:index_json", JSON.stringify(oldData));
        pushLog("KV_STORAGE", "Global registration lookup indices synced cleanly.");

        pushLog("COMPLETE", `Timeline extraction process finalized for "${incidentName}".`);

        return json({ 
            success: true, 
            fireid: ufireid,
            targetUrl: ihUrl,
            dataPayload: dataPayload, 
            rawArcgisResponse: debugLogs.join("\n") 
        });

    } catch (error) {
        pushLog("CRASH", `Fatal exception triggered: ${error.message}`);
        return json({ error: error.message, rawArcgisResponse: debugLogs.join("\n") }, { status: 500 });
    }
}
