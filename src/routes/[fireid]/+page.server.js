import { error } from '@sveltejs/kit';

export async function load({ params, platform }) {
    const { fireid } = params;
    const ufireid = fireid.toUpperCase();
    
    // Access your custom Cloudflare KV binding
    const FIRE_STORE = platform?.env?.FIRE_TIMELINE;
    if (!FIRE_STORE) {
        throw error(500, "Cloudflare KV store binding is unconfigured.");
    }

    // Pull the raw JSON string out of database storage
    const rawData = await FIRE_STORE.get(`fire:data:${ufireid}`);
    if (!rawData) {
        throw error(404, `Fire record layout data not found for: "${ufireid}"`);
    }

    // Return the clean data matrices directly to the Svelte template page
    return {
        fireData: JSON.parse(rawData)
    };
}
