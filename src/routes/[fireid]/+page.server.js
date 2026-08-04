import { error } from '@sveltejs/kit';

export async function load({ params, platform }) {
    const { fireid } = params;
    const ufireid = fireid.toUpperCase();
    
    const FIRE_STORE = platform?.env?.FIRE_TIMELINE;
    if (!FIRE_STORE) {
        throw error(500, "Cloudflare KV store binding is unconfigured.");
    }

    const rawData = await FIRE_STORE.get(`fire:data:${ufireid}`);
    if (!rawData) {
        throw error(404, `Fire record layout data not found for: "${ufireid}"`);
    }

    return {
        fireData: JSON.parse(rawData)
    };
}
