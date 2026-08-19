<script>
	import { base } from '$app/paths';

	let fireIdInput = $state('');
	let statusMessage = $state('');
	let isProcessing = $state(false);
	let debugData = $state(null);
	let successId = $state('');
	let isDebugExpanded = $state(false);

    let rawCatalogList = $state([]);

    const sortedCatalogList = $derived(() => {
        const uniqueMap = new Map();

        for (const item of rawCatalogList) {
            const uniqueKey = item.ufireid || item.fireid;
            if (!uniqueKey) continue;

            const currentCalDate = item.ihdate || item.bdate || item.adate || '';

            if (!uniqueMap.has(uniqueKey)) {
                uniqueMap.set(uniqueKey, item);
            } else {
                const existingItem = uniqueMap.get(uniqueKey);
                const existingCalDate = existingItem.ihdate || existingItem.bdate || existingItem.adate || '';
                
                if (currentCalDate.localeCompare(existingCalDate) > 0) {
                    uniqueMap.set(uniqueKey, item);
                }
            }
        }

        return Array.from(uniqueMap.values()).sort((a, b) => {
            const strA = a.ihdate || a.bdate || a.adate || '';
            const strB = b.ihdate || b.bdate || b.adate || '';
            return strB.localeCompare(strA);
        });
    });

async function handleSubmit(event) {
		if (event) event.preventDefault();
		if (!fireIdInput) return;
		
		isProcessing = true;
		statusMessage = "Processing payload on Cloudflare workers...";
		debugData = null;
		successId = '';
		isDebugExpanded = false;
		
		try {
			const response = await fetch(`/api/build-timeline`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ fireid: fireIdInput })
			});

			const result = await response.json();
			
			if (response.ok && result.success) {
				statusMessage = "Success! Data compiled and saved to KV Store.";
				successId = result.fireid;
				debugData = result;
				
				await fetchCatalogDirectory();
			} else {
				statusMessage = `Error: ${result.error || 'Unknown failure'}`;
				debugData = result;
			}
		} catch (err) {
			statusMessage = `Network Error: ${err.message}`;
		} finally {
			isProcessing = false;
		}
	}

	async function fetchCatalogDirectory() {
		try {
			const response = await fetch(`/api/get-catalog-index`);
			if (response.ok) {
				const directoryData = await response.json();
				rawCatalogList = Array.isArray(directoryData) ? directoryData : [];
			}
		} catch (error) {
			console.error("Live KV catalog capture loop failure:", error);
		}
	}

	$effect(() => {
		fetchCatalogDirectory();
	});
</script>



<div class="container py-4">
    <div class="page-content">
        <div class='row mb-3'>
            <div class='col-12'>
                <h3 class="h4 fw-bold text-dark border-bottom pb-2">Timeline Generator</h3>
            </div>
        </div>

        <div class='row g-4'>
            <div class='col-lg-6 col-md-6 col-12'>
                <div class='mb-2'>
                    <h5 class="h6 fw-bold text-secondary text-uppercase tracking-wider">Background</h5>
                </div>
                <div class="small">
                    <p>Morgan Pence (WFM RDA) and Rick Stratton (WO FAM) developed the Incident Timeline to assist with the 2016 USFS National Headquarters Fire Inquiries. These graphs were an excellent way to display a lot of fire information, sequenced over time. The product has become a staple of the Risk Management Assistance (RMA) analytics (2017-present), and was automated by Reggie Goolsby (WFM RDA) in 2018 to allow faster creation. In 2020, Jim Edmonds reconstructed the timeline, adding an interactive graph and multiple exports. It is now available as a tab on the RMA Dashboard.</p>
                    <p>There are <strong>three types of timelines</strong>: <em>INCIDENT</em>, <em>RESOURCE</em>, and <em>PERSONNEL</em>. And there are <strong>two ways to create them</strong>. The timeline generator on this page produces an interactive timeline that is a combination incident and resource timeline. It can be modified and exported as an image or PDF. However, if you want a more customized timeline -- 3 examples are shown below -- you request this from an RMA analyst who will pull the data from IRWIN and develop a graphic in Excel.</p>
                    
                    <div class="mt-4">
                        <strong class="text-dark d-block mb-1 small">Incident Timeline</strong>
                        <p class="text-muted" style="font-size: 0.85rem;">The Incident Timeline is a visual depiction of the basic history of a wildfire. Data are acquired from the Integrated Reporting of Wildland-Fire Information (IRWIN) application, ensuring the Authoritative Data Source (ADS) is used for each data element.</p>
                        <p class="mb-3"><a href="/Timeline - Eagle Creek - Manual.pdf" target="_blank"><img src="/eagle-creek.ih.s.png" class="img-fluid border rounded shadow-sm" alt="Eagle Creek Baseline View"></a></p>
                        
                        <strong class="text-dark d-block mb-1 small">Resource Timeline</strong>
                        <p class="text-muted" style="font-size: 0.85rem;">The Resource Timeline visually depicts resource type by date. These data are also acquired from <abbr title="Integrated Reporting of Wildland-Fire Information">IRWIN</abbr>, ensuring the <abbr title="Authoritative Data Source">ADS</abbr> is used for each resource data element.</p>
                        <p class="mb-3"><a href="/resource manual - 01b - 209 Resource Type Amount - Pole Creek.pdf" target="_blank"><img src="/pole-creek.rh.s.png" class="img-fluid border rounded shadow-sm" alt="Pole Creek Data Baseline"></a></p>
                        
                        <strong class="text-dark d-block mb-1 small">Personnel Timeline</strong>
                        <p class="text-muted" style="font-size: 0.85rem;">The Personnel Timeline shows the breakdown of personnel by agency; below is an example from the Delta Fire, Shasta-Trinity National Forest, 2018.</p>
                        <p class="mb-3"><a href="/Personnel by Agency - Woodbury.png" target="_blank"><img src="/woodbury.pxa.s.png" class="img-fluid border rounded shadow-sm" alt="Woodbury Matrix Reference Visual"></a></p>
                    </div>
                </div>
            </div>

            <div class='col-lg-6 col-md-6 col-12'>
                <div class='mb-2'>
                    <h5 class="h6 fw-bold text-secondary text-uppercase tracking-wider">Products</h5>
                </div>
                
                <div class='p-3 bg-light border border-secondary-subtle rounded-3 shadow-sm mb-4 small'>
                    <p class="fw-bold mb-1 text-dark">Create a Timeline</p>
                    <p class="text-muted mb-3" style="font-size: 0.85rem;">Enter an Incident ID below in the format '<strong>YYYY-ABCD-000000</strong>' where <mark class="px-1 rounded bg-warning-subtle">YYYY</mark> is a year, <mark class="px-1 rounded bg-warning-subtle">ABCD</mark> is an agency code, and <mark class="px-1 rounded bg-warning-subtle">000000</mark> is a number. Press <kbd class="bg-dark text-white rounded px-1 small" style="font-size: 0.75rem;">enter</kbd> or click the button to generate your timelines.</p>
                    
                    <form onsubmit={handleSubmit} class="mb-3">
                        <div class="input-group input-group-sm">
                            <input 
                                bind:value={fireIdInput}
                                type="text" 
                                class="form-control" 
                                placeholder="YYYY-ABCD-000000"
                                disabled={isProcessing}
                            />
                            <button 
                                class="btn btn-primary fw-bold px-3" 
                                type="submit"
                                disabled={isProcessing || !fireIdInput}
                            >
                                {#if isProcessing}
                                    <span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                                    Loading...
                                {:else}
                                    Enter
                                {/if}
                            </button>
                        </div>
                    </form>

                    {#if statusMessage}
                        <div class="alert {successId ? 'alert-success border-success' : 'alert-secondary'} py-2 px-3 m-0 rounded small" style="font-size: 0.8rem;" role="alert">
                            <div class="fw-bold mb-1">Status: {statusMessage}</div>
                            {#if successId}
                                <div class="mt-2 pt-2 border-top border-success-subtle">
                                    <a href={`/${successId}`} class="btn btn-success btn-sm fw-bold shadow-sm">
                                        Open Timeline & Graph Dashboard for {successId} ➔
                                    </a>
                                </div>
                            {/if}
                        </div>
                    {/if}

                    <p class="text-muted mt-3 mb-0" style="font-size: 0.8rem; line-height: 1.35;">
                        <span class="text-danger fw-bold">Note:</span> While information is available for many wildfires, data for older incidents can be missing or gappy, especially for resource and personnel counts. On the other end of the spectrum, current incidents will have empty graphs until a few days of data are available. For technical issues, please email <mark class="strong">james.edmonds1@usda.gov</mark>.
                    </p>
                </div>

                {#if debugData}
                    <div class="card border-secondary shadow-sm mb-4 small">
                        <button 
                            class="card-header bg-dark text-white fw-bold py-2 border-0 w-100 text-start d-flex justify-content-between align-items-center"
                            onclick={() => isDebugExpanded = !isDebugExpanded}
                            style="font-size: 0.8rem; cursor: pointer;"
                            type="button"
                        >
                            <span>Debug Inspection Blocks</span>
                            <span class="badge bg-secondary font-monospace">{isDebugExpanded ? 'Hide ▲' : 'Show ▼'}</span>
                        </button>
                        
                        {#if isDebugExpanded}
                            <div class="card-body p-3 bg-white border-top border-secondary">
                                <div class="mb-2" style="font-size: 0.8rem;">
                                    <span class="text-muted fw-bold d-block mb-1">Target API Location:</span>
                                    <code class="bg-light p-2 border rounded d-block text-break">{debugData.targetUrl}</code>
                                </div>
                                <div class="mb-3" style="font-size: 0.8rem;">
                                    <span class="text-muted fw-bold d-block mb-1">Processed Fire ID:</span>
                                    <code class="bg-light p-2 border rounded d-inline-block px-3">{debugData.fireid}</code>
                                </div>
                                <h6 class="fw-bold text-dark mb-1 text-uppercase" style="font-size: 0.8rem;">Raw Response String From ArcGIS:</h6>
                                <pre class="bg-dark p-3 rounded font-monospace border border-secondary" style="white-space: pre-wrap; color: #00ff00 !important; overflow: visible; font-size: 0.75rem;">
{debugData.rawArcgisResponse || JSON.stringify(debugData, null, 2)}
                                </pre>
                            </div>
                        {/if}
                    </div>
                {/if}

	<div class="mt-4 mb-4">
		<div class="border-bottom border-dark pb-1 mb-2">
			<p class="text-secondary text-uppercase m-0" style="font-size: 0.75rem; font-weight: 900;">Recently Produced</p>
		</div>

		<div style="font-size: 0.75rem; font-family: monospace; line-height: 1.4;">
			{#each sortedCatalogList() as fire}
				<div class="py-0.5 border-bottom border-light">
					<a href="{base}/{fire.ufireid || fire.fireid}" class="text-decoration-none text-primary hover-underline" style="font-weight: normal !important;">
						{fire.name || 'Unnamed Incident'}
					</a>
					<span class="text-muted ms-1">({fire.ufireid || fire.fireid || 'N/A'})</span>
				</div>
			{:else}
				<div class="text-muted py-2 text-center" style="font-family: sans-serif;">
					No archived incident records found in dataset directory indices.
				</div>
			{/each}
		</div>
	</div>

	<style>
		:global(.hover-underline:hover) {
			text-decoration: underline !important;
		}
	</style>


            </div>
        </div>
    </div>
</div>
