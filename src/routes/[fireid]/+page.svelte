<script>
	import * as Plot from '@observablehq/plot';
	import { base } from '$app/paths';

	let { data } = $props();
	
	const rawMeta = $derived(data.fireData.meta);
	const rawIh = $derived(data.fireData.incident_history_timeline || []);
	const rawRh = $derived(data.fireData.resource_history_timeline || []);

	let visibleSeries = $state({ 
		acres: true, cost: true, containment: true,
		BIA: true, BLM: true, 'C & L': true, DOI: true, FWS: true, 
		INTL: true, NPS: true, NWS: true, PRI: true, ST: true, 
		TNC: true, USFS: true, WAD: true, OTHR: true
	});
	let masterDiv, stackedPersonnelDiv;

	// Process Resource Data first into an array to enable cross-referencing calculations
	const resourceTableRows = $derived(
		(Array.isArray(rawRh) ? rawRh : Object.values(rawRh || {}))
			.map(row => {
				if (!row || !Array.isArray(row) || row.length < 3) return null;
				const [dateStr, totalCount, agencyObj] = row;
				const targetData = agencyObj || {};
				return {
					date: new Date(dateStr),
					dateKeyYMD: dateStr.slice(0, 10), // Safe baseline string token
					bia: parseInt(targetData.BIA) || 0,
					blm: parseInt(targetData.BLM) || 0,
					cl: parseInt(targetData['C & L'] || targetData.cl || targetData.CandL) || 0,
					doi: parseInt(targetData.DOI) || 0,
					fws: parseInt(targetData.FWS) || 0,
					intl: parseInt(targetData.INTL) || 0,
					nps: parseInt(targetData.NPS) || 0,
					nws: parseInt(targetData.NWS) || 0,
					othr: parseInt(targetData.OTHR) || 0,
					pri: parseInt(targetData.PRI) || 0,
					st: parseInt(targetData.ST || targetData.State || targetData.st) || 0,
					tnc: parseInt(targetData.TNC) || 0,
					usfs: parseInt(targetData.FS || targetData.USFS || targetData['Forest Service'] || targetData.usfs) || 0,
					wad: parseInt(targetData.WAD) || 0
				};
			})
			.filter(d => d && !isNaN(d.date.getTime()))
			.reverse()
	);

	// FIXED CALCULATION: Table 1 looks up processed rows securely to resolve 0 counts
	const incidentTableRows = $derived(
		(Array.isArray(rawIh) ? rawIh : Object.values(rawIh || {}))
			.map(row => {
				if (!row || !Array.isArray(row) || row.length < 4) return null;
				const [dateStr, acresVal, costVal, containmentVal] = row;
				
				const cleanDateKey = dateStr.slice(0, 10);
				const matchedRhRow = resourceTableRows.find(r => r.dateKeyYMD === cleanDateKey);
				
				let totalPersonnelOnDay = 0;
				if (matchedRhRow) {
					totalPersonnelOnDay = matchedRhRow.bia + matchedRhRow.blm + matchedRhRow.cl + 
						matchedRhRow.doi + matchedRhRow.fws + matchedRhRow.intl + matchedRhRow.nps + 
						matchedRhRow.nws + matchedRhRow.othr + matchedRhRow.pri + matchedRhRow.st + 
						matchedRhRow.tnc + matchedRhRow.usfs + matchedRhRow.wad;
				}

				return {
					date: new Date(dateStr),
					acres: parseInt(acresVal) || 0,
					cost: parseInt(costVal) || 0,
					containment: parseInt(containmentVal) || 0,
					personnelTotal: totalPersonnelOnDay
				};
			})
			.filter(d => d && !isNaN(d.date.getTime()))
			.reverse()
	);

	function toggleLine(key) { 
		visibleSeries[key] = !visibleSeries[key]; 
	}
	
	function formatToYMD(dateObj) { 
		const d = new Date(dateObj); 
		if (isNaN(d.getTime())) return "";
		return d.toISOString().slice(0, 10);
	}

	function getAgencyColor(label) {
		const colors = {
			'BIA': 'firebrick', 'BLM': 'saddlebrown', 'C & L': 'gainsboro', 'DOI': '#ffb703',
			'FWS': 'RebeccaPurple', 'INTL': 'pink', 'NPS': 'dodgerblue', 'NWS': 'orange',
			'OTHR': 'limegreen', 'PRI': 'red', 'ST': 'blue', 'TNC': '#d8f3dc',
			'USFS': 'forestgreen', 'WAD': '#ffc6ff'
		};
		return colors[label] || '#6c757d';
	}

	function getFlatUnicodeSquare(label) {
		const flatSquares = {
			'BIA': '🟥', 'BLM': '🟫', 'C & L': '⬜', 'DOI': '🟨', 'FWS': '🟪', 
			'INTL': '🟪', 'NPS': '🟦', 'NWS': '🟧', 'OTHR': '🟩', 'PRI': '🟥', 
			'ST': '🟦', 'TNC': '🟩', 'USFS': '🟩', 'WAD': '🟪'  
		};
		return flatSquares[label] || '▪️';
	}

	$effect(() => {
		if (!masterDiv) return;
		masterDiv.innerHTML = "";
		const marks = [];

		const ihArray = Array.isArray(rawIh) ? rawIh : Object.values(rawIh || {});
		const rhArray = Array.isArray(rawRh) ? rawRh : Object.values(rawRh || {});

		const incidentData = ihArray.map(row => {
			if (!row || !Array.isArray(row) || row.length < 4) return null;
			const [dateStr, acresVal, costVal, containmentVal] = row;
			return {
				date: new Date(dateStr),
				acres: parseInt(acresVal) || 0,
				cost: parseInt(costVal) || 0,
				containment: parseInt(containmentVal) || 0
			};
		}).filter(d => d && !isNaN(d.date.getTime()));

		const resourceData = rhArray.map(row => {
			if (!row || !Array.isArray(row) || row.length < 3) return null;
			const [dateStr, totalCount, agencyObj] = row;
			const targetData = agencyObj || {};
			return {
				date: new Date(dateStr),
				bia: parseInt(targetData.BIA) || 0,
				blm: parseInt(targetData.BLM) || 0,
				cl: parseInt(targetData['C & L'] || targetData.cl || targetData.CandL) || 0,
				doi: parseInt(targetData.DOI) || 0,
				fws: parseInt(targetData.FWS) || 0,
				intl: parseInt(targetData.INTL) || 0,
				nps: parseInt(targetData.NPS) || 0,
				nws: parseInt(targetData.NWS) || 0,
				othr: parseInt(targetData.OTHR) || 0,
				pri: parseInt(targetData.PRI) || 0,
				st: parseInt(targetData.ST || targetData.State || targetData.st) || 0,
				tnc: parseInt(targetData.TNC) || 0,
				usfs: parseInt(targetData.FS || targetData.USFS || targetData['Forest Service'] || targetData.usfs) || 0,
				wad: parseInt(targetData.WAD) || 0
			};
		}).filter(d => d && !isNaN(d.date.getTime()));

		if (incidentData.length === 0 && resourceData.length === 0) return;

		const allDates = [...incidentData.map(d => d.date.getTime()), ...resourceData.map(d => d.date.getTime())];
		const fixedXDomain = new Array(new Date(Math.min(...allDates)), new Date(Math.max(...allDates)));

		const calcMaxAcres = Math.max(...incidentData.map(d => d.acres), 0) || 1;
		const calcMaxCost = Math.max(...incidentData.map(d => d.cost), 0) || 1;

		const agencyConfig = [
			{ key: 'bia', label: 'BIA', color: getAgencyColor('BIA') },
			{ key: 'blm', label: 'BLM', color: getAgencyColor('BLM') },
			{ key: 'cl', label: 'C & L', color: getAgencyColor('C & L') },
			{ key: 'doi', label: 'DOI', color: getAgencyColor('DOI') },
			{ key: 'fws', label: 'FWS', color: getAgencyColor('FWS') },
			{ key: 'intl', label: 'INTL', color: getAgencyColor('INTL') },
			{ key: 'nps', label: 'NPS', color: getAgencyColor('NPS') },
			{ key: 'nws', label: 'NWS', color: getAgencyColor('NWS') },
			{ key: 'othr', label: 'OTHR', color: getAgencyColor('OTHR') },
			{ key: 'pri', label: 'PRI', color: getAgencyColor('PRI') },
			{ key: 'st', label: 'ST', color: getAgencyColor('ST') },
			{ key: 'tnc', label: 'TNC', color: getAgencyColor('TNC') },
			{ key: 'usfs', label: 'USFS', color: getAgencyColor('USFS') },
			{ key: 'wad', label: 'WAD', color: getAgencyColor('WAD') }
		];

		const activeAgenciesInData = agencyConfig.filter(cfg => 
			resourceData.some(d => d[cfg.key] > 0)
		);

		const activeResourceBars = [];
		agencyConfig.forEach(cfg => {
			if (visibleSeries[cfg.label]) {
				resourceData.forEach(d => {
					if (d[cfg.key] > 0) {
						const rowObj = { 
							date: d.date, qty: d[cfg.key], agency: cfg.label, 'Daily Personnel': ' '
						};
						agencyConfig.forEach(innerCfg => {
							if (d[innerCfg.key] > 0 && visibleSeries[innerCfg.label]) {
								const squareChar = getFlatUnicodeSquare(innerCfg.label);
								rowObj[`  ${squareChar}  ${innerCfg.label}`] = d[innerCfg.key];
							}
						});
						activeResourceBars.push(rowObj);
					}
				});
			}
		});

		const tipChannels = { Date: "date", "Daily Personnel": "Daily Personnel" };
		const tipFormats = { 
			x: false, y: false, x1: false, x2: false, fill: false, agency: false, y1: false, y2: false, date: false, "% of max": false,
			Date: true, "Daily Personnel": true 
		};
		
		activeAgenciesInData.forEach(cfg => {
			resourceData.forEach(d => {
				if (d[cfg.key] > 0 && visibleSeries[cfg.label]) {
					const squareChar = getFlatUnicodeSquare(cfg.label);
					const structuredLabel = `  ${squareChar}  ${cfg.label}`;
					tipChannels[structuredLabel] = structuredLabel;
					tipFormats[structuredLabel] = true;
				}
			});
		});

		if (activeResourceBars.length) {
			const totalCombinedMaxEver = Math.max(...resourceData.map(r => 
				r.bia + r.blm + r.cl + r.doi + r.fws + r.intl + r.nps + r.nws + r.othr + r.pri + r.st + r.tnc + r.usfs + r.wad
			), 0) || 1;

			marks.push(Plot.rectY(activeResourceBars, Plot.stackY({
				x: "date",
				interval: "day",
				y: d => (d.qty / totalCombinedMaxEver) * 100,
				fill: "agency", 
				fillOpacity: 0.6,
				channels: tipChannels,
				tip: { format: tipFormats }
			})));
		}

		// FIXED DOT FORMATTING: Replaced true with specific mask to suppress extra lines on dots
		if (visibleSeries.acres) {
			marks.push(Plot.lineY(incidentData, { x: 'date', y: d => (d.acres / calcMaxAcres) * 100, stroke: 'red', strokeWidth: 3 }));
			marks.push(Plot.dot(incidentData, { x: 'date', y: d => (d.acres / calcMaxAcres) * 100, fill: 'red', r: 1.5, channels: { Date: "date", "Calculated Acres": 'acres' }, tip: { format: { x: false, y: false, Date: true, "Calculated Acres": true, fill: false } } }));
		}
		if (visibleSeries.cost) {
			marks.push(Plot.lineY(incidentData, { x: 'date', y: d => (d.cost / calcMaxCost) * 100, stroke: 'green', strokeWidth: 2 }));
			marks.push(Plot.dot(incidentData, { x: 'date', y: d => (d.cost / calcMaxCost) * 100, fill: 'green', r: 1.5, channels: { Date: "date", "Financial Cost": d => `$${d.cost.toLocaleString()}` }, tip: { format: { x: false, y: false, Date: true, "Financial Cost": true, fill: false } } }));
		}

		if (visibleSeries.containment) {
			marks.push(Plot.lineY(incidentData, { x: 'date', y: 'containment', stroke: 'black', strokeWidth: 2 }));
			// FIXED: Added precise formatting mask to remove system tracking duplicates from the containment dot tooltip
			marks.push(Plot.dot(incidentData, { x: 'date', y: 'containment', fill: 'black', r: 1.5, channels: { Date: "date", "Percent Contained": d => `${d.containment}%` }, tip: { format: { x: false, y: false, Date: true, "Percent Contained": true, fill: false } } }));
		}

		masterDiv.appendChild(Plot.plot({
			grid: true, 
			marginLeft: 90, 
			marginRight: 30, 
			marginBottom: 55, 
			style: { fontSize: '11px', width: '100%', background: 'white' },
			color: { domain: activeAgenciesInData.map(c => c.label), range: activeAgenciesInData.map(c => c.color) },
			x: { type: 'utc', label: null, tickFormat: d => formatToYMD(d), tickRotate: -30, textAnchor: "end", style: { fontSize: "8px" },domain: fixedXDomain, line: true }, 
			y: { label: '% of max', domain: new Array(0, 100), line: true }, marks
		}));

		if (stackedPersonnelDiv) {
			stackedPersonnelDiv.innerHTML = "";
			if (activeResourceBars.length) {
				stackedPersonnelDiv.appendChild(Plot.plot({
					grid: true, 
					marginLeft: 90, 
					marginRight: 30, 
					marginBottom: 55, 
					style: { fontSize: '11px', width: '100%', background: 'white', paddingBottom: '30px' },
					color: { domain: activeAgenciesInData.map(c => c.label), range: activeAgenciesInData.map(c => c.color), legend: true },
					x: { type: 'utc', label: null, tickFormat: d => formatToYMD(d), tickRotate: -30,textAnchor: "end", style: { fontSize: "8px" }, domain: fixedXDomain, line: true }, 
					y: { label: "Responding Personnel Count", line: true },
					marks: [
						Plot.rectY(activeResourceBars, Plot.stackY({
							x: "date", interval: "day", y: "qty", fill: "agency", fillOpacity: 0.7, channels: tipChannels, tip: { format: tipFormats }
						}))
					]
				}));
			}
		}
	});
</script>


<div class="container py-4" style="max-width: 750px;">
	<!-- Meta Header Panel -->
	<div class="border-bottom pb-2 mb-3">
		<h3 class="h4 fw-bold text-dark m-0">{rawMeta?.name || 'Wildfire'}</h3>
		<p class="text-muted small m-0 mt-1">ID: <span class="fw-bold text-dark">{rawMeta?.ufireid}</span> &bull; Timeline: <span class="fw-bold text-dark">{rawMeta?.adate}</span> to <span class="fw-bold text-dark">{rawMeta?.bdate}</span></p>
	</div>

	<!-- Export Button Panel -->
	<div class="d-flex justify-content-between align-items-center mb-2">
		<h5 class="h6 fw-bold text-secondary text-uppercase tracking-wider m-0">Unified Data Comparison</h5>
		<button onclick={() => { 
	const svgEl = masterDiv.querySelector('svg'); 
	if (!svgEl) return; 
	const svgString = new XMLSerializer().serializeToString(svgEl); 
	const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' }); 
	const URL = window.URL || window.webkitURL || window; 
	const blobURL = URL.createObjectURL(svgBlob); 
	const image = new Image(); 
	image.onload = () => { 
		const canvas = document.createElement('canvas'); 
		const svgWidth = svgEl.getBoundingClientRect().width;
		const svgHeight = svgEl.getBoundingClientRect().height;
		const titleGap = 40; // Spacing allocation for titles
		canvas.width = svgWidth * 2; 
		canvas.height = (svgHeight + titleGap) * 2; 
		const context = canvas.getContext('2d'); 
		context.fillStyle = 'white'; 
		context.fillRect(0, 0, canvas.width, canvas.height); 
		context.scale(2, 2); 
		// Draw Text Headers Natively onto Canvas Vector Map
		context.fillStyle = '#212529';
		context.font = 'bold 11px sans-serif';
		const titleText = `${(rawMeta?.name || 'WILDFIRE').toUpperCase()}  •  ID: ${rawMeta?.ufireid || 'N/A'}  •  Timeline: ${rawMeta?.adate || ''} to ${rawMeta?.bdate || ''}`;
		context.fillText(titleText, 10, 20);
		// Draw Separator Line
		context.strokeStyle = '#dee2e6';
		context.lineWidth = 1;
		context.beginPath(); context.moveTo(10, 28); context.lineTo(svgWidth - 10, 28); context.stroke();
		// Offset chart drawing position beneath header labels
		context.drawImage(image, 0, titleGap); 
		const pngURL = canvas.toDataURL('image/png'); 
		const downloadLink = document.createElement('a'); 
		downloadLink.href = pngURL; 
		downloadLink.download = `${rawMeta?.name || 'wildfire'}-timeline.png`; 
		document.body.appendChild(downloadLink); 
		downloadLink.click(); 
		document.body.removeChild(downloadLink); 
	}; 
	image.src = blobURL; 
}} class="btn btn-sm btn-outline-secondary fw-bold" style="font-size: 0.75rem;"><i class="bi bi-camera me-1"></i> Export Chart Image (PNG)</button>

	</div>
	
	<!-- Filter Buttons Card -->
	<div class="card bg-light mb-3 border border-secondary-subtle rounded-3">
		<div class="card-body p-2">
			<div class="d-flex flex-wrap gap-1 mb-2 border-bottom pb-2">
				<button onclick={() => toggleLine('acres')} class="btn btn-sm fw-bold" style="font-size: 0.75rem; background-color: {visibleSeries.acres ? '#fff' : '#f8f9fa'}; border: 1px solid {visibleSeries.acres ? 'red' : '#dee2e6'}; color: {visibleSeries.acres ? 'red' : '#6c757d'} !important; opacity: {visibleSeries.acres ? '1' : '0.5'}; text-decoration: {visibleSeries.acres ? 'none' : 'line-through'};">Calculated Acres</button>
				<button onclick={() => toggleLine('cost')} class="btn btn-sm fw-bold" style="font-size: 0.75rem; background-color: {visibleSeries.cost ? '#fff' : '#f8f9fa'}; border: 1px solid {visibleSeries.cost ? 'green' : '#dee2e6'}; color: {visibleSeries.cost ? 'green' : '#6c757d'} !important; opacity: {visibleSeries.cost ? '1' : '0.5'}; text-decoration: {visibleSeries.cost ? 'none' : 'line-through'};">Financial Cost</button>
				<button onclick={() => toggleLine('containment')} class="btn btn-sm fw-bold" style="font-size: 0.75rem; background-color: {visibleSeries.containment ? '#fff' : '#f8f9fa'}; border: 1px solid {visibleSeries.containment ? 'black' : '#dee2e6'}; color: {visibleSeries.containment ? 'black' : '#6c757d'} !important; opacity: {visibleSeries.containment ? '1' : '0.5'}; text-decoration: {visibleSeries.containment ? 'none' : 'line-through'};">Percent Contained</button>
			</div>
			<div class="d-flex flex-wrap gap-1">
				{#each ['BIA', 'BLM', 'C & L', 'DOI', 'FWS', 'INTL', 'NPS', 'NWS', 'OTHR', 'PRI', 'ST', 'TNC', 'USFS', 'WAD'] as agency}
					<button onclick={() => toggleLine(agency)} class="btn btn-xs fw-bold text-dark border-secondary-subtle" style="font-size: 0.65rem; padding: 2px 7px; background-color: {visibleSeries[agency] ? getAgencyColor(agency) : '#e9ecef'}; opacity: {visibleSeries[agency] ? '1' : '0.4'}; text-decoration: {visibleSeries[agency] ? 'none' : 'line-through'}; text-shadow: {visibleSeries[agency] ? '0px 0px 1px rgba(255,255,255,0.7)' : 'none'};">
						{agency}
					</button>
				{/each}
			</div>
		</div>
	</div>

	<div style="background: white; padding: 1.5rem; border: 2px solid #333; border-radius: 8px; margin-bottom: 2.5rem; box-shadow: 4px 4px 0px #333;">
		<div class="mb-2 pb-1" style="font-size: 11px; font-family: sans-serif; border-bottom: 1px solid #dee2e6;">
			<span class="text-dark fw-bold text-uppercase tracking-wider">{rawMeta?.name || 'Wildfire'}</span> &bull; 
			<span class="text-muted">ID:</span> <span class="text-dark">{rawMeta?.ufireid || 'N/A'}</span> &bull; 
			<span class="text-muted">Timeline:</span> <span class="text-dark">{rawMeta?.adate || ''}</span> to <span class="text-dark">{rawMeta?.bdate || ''}</span>
		</div>
		<div bind:this={masterDiv}></div>
	</div>

	<div style="background: white; padding: 1.5rem; border: 2px solid #333; border-radius: 8px; margin-bottom: 2.5rem; box-shadow: 4px 4px 0px #333;">
		<div class="mb-2 pb-1" style="font-size: 11px; font-family: sans-serif; border-bottom: 1px solid #dee2e6;">
			<span class="text-dark fw-bold text-uppercase tracking-wider">{rawMeta?.name || 'Wildfire'}</span> &bull; 
			<span class="text-muted">ID:</span> <span class="text-dark">{rawMeta?.ufireid || 'N/A'}</span> &bull; 
			<span class="text-muted">Timeline:</span> <span class="text-dark">{rawMeta?.adate || ''}</span> to <span class="text-dark">{rawMeta?.bdate || ''}</span>
		</div>
		<div bind:this={stackedPersonnelDiv}></div>
	</div>

	<!-- TABLE 1: INCIDENT HISTORY -->
	<div class="mb-4">
		<h5 class="h6 fw-bold text-dark text-uppercase tracking-wider mb-2" style="font-size: 0.75rem;">incident history</h5>
		<div class="mb-2 border-bottom border-dark pb-1">
			<h4 class="text-dark text-uppercase tracking-wider m-0" style="font-size: 0.9rem; font-weight: 900;">
				{rawMeta?.name || 'Wildfire'}
			</h4>
			<p class="text-muted small m-0 mt-0.5" style="font-size: 0.65rem; font-family: monospace;">
				ID: <span class="text-dark fw-bold">{rawMeta?.ufireid || 'N/A'}</span> &bull; 
				Timeline: <span class="text-dark fw-bold">{rawMeta?.adate || ''}</span> to <span class="text-dark fw-bold">{rawMeta?.bdate || ''}</span>
			</p>
		</div>
		<div class="table-responsive" style="border: 1px solid #212529; overflow-x: auto; max-width: 100%;">
		<table class="table table-xs table-striped table-hover table-bordered border-dark align-middle m-0" style="font-size: 0.65rem; font-family: monospace; line-height: 1.1; pointer-events: none;">
			<thead class="table-dark border-dark text-uppercase" style="font-size: 0.6rem;">
				<tr>
					<th class="px-2 py-0">Date</th>
					<th class="py-0 text-end">Acres</th>
					<th class="py-0 text-end">Cost</th>
					<th class="py-0 text-end">Containment</th>
					<th class="px-2 py-0 text-end text-warning">Personnel</th>
				</tr>
			</thead>
			<tbody>
				{#each incidentTableRows as row}
					<tr class="py-0">
						<td class="px-2 py-0 text-dark">{formatToYMD(row.date)}</td>
						<td class="py-0 text-end text-danger">{row.acres.toLocaleString()}</td>
						<td class="py-0 text-end text-success">${row.cost.toLocaleString()}</td>
						<td class="py-0 text-end text-dark">{row.containment}%</td>
						<td class="px-2 py-0 text-end text-dark" style="background-color: rgba(255,193,7,0.03);">{row.personnelTotal.toLocaleString()}</td>
					</tr>
				{:else}
					<tr><td colspan="5" class="text-center text-muted py-2">No incident logs.</td></tr>
				{/each}
			</tbody>
		</table>
		</div>
	</div>

	<!-- TABLE 2: RESOURCE PERSONNEL -->
	<div class="mb-5">
		<h5 class="h6 fw-bold text-dark text-uppercase tracking-wider mb-2" style="font-size: 0.75rem;">resource personnel</h5>
		<div class="mb-2 border-bottom border-dark pb-1">
			<h4 class="text-dark text-uppercase tracking-wider m-0" style="font-size: 0.9rem; font-weight: 900;">
				{rawMeta?.name || 'Wildfire'}
			</h4>
			<p class="text-muted small m-0 mt-0.5" style="font-size: 0.65rem; font-family: monospace;">
				ID: <span class="text-dark fw-bold">{rawMeta?.ufireid || 'N/A'}</span> &bull; 
				Timeline: <span class="text-dark fw-bold">{rawMeta?.adate || ''}</span> to <span class="text-dark fw-bold">{rawMeta?.bdate || ''}</span>
			</p>
		</div>
		<div class="table-responsive" style="border: 1px solid #212529; overflow-x: auto; max-width: 100%;">
			<table class="table table-xs table-striped table-hover table-bordered border-dark align-middle text-center m-0" style="font-size: 0.62rem; font-family: monospace; line-height: 1.1; min-width: 550px; pointer-events: none;">
				<thead class="table-dark border-dark text-uppercase" style="font-size: 0.55rem;">
					<tr>
						<th class="text-start px-2 py-0">Date</th>
						<th class="py-0">BIA</th>
						<th class="py-0">BLM</th>
						<th class="py-0">C&L</th>
						<th class="py-0">DOI</th>
						<th class="py-0">FWS</th>
						<th class="py-0">INTL</th>
						<th class="py-0">NPS</th>
						<th class="py-0">NWS</th>
						<th class="py-0">OTHR</th>
						<th class="py-0">PRI</th>
						<th class="py-0">ST</th>
						<th class="py-0">TNC</th>
						<th class="py-0">USFS</th>
						<th class="px-2 py-0 text-end">WAD</th>
					</tr>
				</thead>
				<tbody>
					{#each resourceTableRows as row}
						<tr class="py-0">
							<td class="text-start px-2 py-0 text-dark bg-light">{formatToYMD(row.date)}</td>
							<td class="py-0" style="opacity: {row.bia > 0 ? 1 : 0.25}">{row.bia}</td>
							<td class="py-0" style="opacity: {row.blm > 0 ? 1 : 0.25}">{row.blm}</td>
							<td class="py-0" style="opacity: {row.cl > 0 ? 1 : 0.25}">{row.cl}</td>
							<td class="py-0" style="opacity: {row.doi > 0 ? 1 : 0.25}">{row.doi}</td>
							<td class="py-0" style="opacity: {row.fws > 0 ? 1 : 0.25}">{row.fws}</td>
							<td class="py-0" style="opacity: {row.intl > 0 ? 1 : 0.25}">{row.intl}</td>
							<td class="py-0" style="opacity: {row.nps > 0 ? 1 : 0.25}">{row.nps}</td>
							<td class="py-0" style="opacity: {row.nws > 0 ? 1 : 0.25}">{row.nws}</td>
							<td class="py-0" style="opacity: {row.othr > 0 ? 1 : 0.25}">{row.othr}</td>
							<td class="py-0" style="opacity: {row.pri > 0 ? 1 : 0.25}">{row.pri}</td>
							<td class="py-0" style="opacity: {row.st > 0 ? 1 : 0.25}">{row.st}</td>
							<td class="py-0" style="opacity: {row.tnc > 0 ? 1 : 0.25}">{row.tnc}</td>
							<td class="py-0" style="opacity: {row.usfs > 0 ? 1 : 0.25}">{row.usfs}</td>
							<td class="px-2 py-0 text-end" style="opacity: {row.wad > 0 ? 1 : 0.25}">{row.wad}</td>
						</tr>
					{:else}
						<tr><td colspan="15" class="text-center text-muted py-2">No resource logs.</td></tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
</div>

