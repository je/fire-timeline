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

		// FIXED: Reads your existing pre-built master lookup index directly in one operation
		const masterIndexRaw = await kvNamespace.get("fire:index_json", { type: "json" });
		
		// Return the flat array directly to your frontend homepage sorting loop
		return json(Array.isArray(masterIndexRaw) ? masterIndexRaw : []);
	} catch (error) {
		console.error("Global Catalog API load failure:", error);
		return json([]);
	}
}
