import { json } from '@sveltejs/kit';

/** @type {import('./$types').RequestHandler} */
export async function GET({ platform }) {
	try {
		const kvNamespace = 
			platform?.env?.FIRE_TIMELINE || 
			globalThis?.FIRE_TIMELINE || 
			(typeof process !== 'undefined' ? process?.env?.FIRE_TIMELINE : null);

		if (!kvNamespace) {
			console.error("CRITICAL: FIRE_TIMELINE binding namespace not found on any global server context.");
			return json([]); 
		}

		const masterIndexRaw = await kvNamespace.get("fire:index_json", { type: "json" });
		
		return json(Array.isArray(masterIndexRaw) ? masterIndexRaw : []);
	} catch (error) {
		console.error("Global Catalog API load failure:", error);
		return json([]);
	}
}
