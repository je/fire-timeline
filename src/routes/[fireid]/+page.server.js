import { error } from '@sveltejs/kit';

function getDateRange(search) {
    const value = search.startsWith('?') ? search.slice(1) : search;
    const match = /^(\d{4})(\d{2})(\d{2})-(\d{4})(\d{2})(\d{2})$/.exec(value);
    if (!match) return null;

    const start = `${match[1]}-${match[2]}-${match[3]}`;
    const end = `${match[4]}-${match[5]}-${match[6]}`;
    const startDate = new Date(`${start}T00:00:00Z`);
    const endDate = new Date(`${end}T00:00:00Z`);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || start > end) {
        return null;
    }

    return { start, end };
}

function filterTimeline(timeline, dateRange) {
    if (!dateRange || !Array.isArray(timeline)) return timeline;

    return timeline.filter(row => {
        const date = typeof row?.[0] === 'string' ? row[0].slice(0, 10) : '';
        return date >= dateRange.start && date <= dateRange.end;
    });
}

export async function load({ params, platform, url }) {
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

    const fireData = JSON.parse(rawData);
    const dateRange = getDateRange(url.search);

    return {
        fireData: dateRange ? {
            ...fireData,
            incident_history_timeline: filterTimeline(fireData.incident_history_timeline, dateRange),
            resource_history_timeline: filterTimeline(fireData.resource_history_timeline, dateRange)
        } : fireData
    };
}
