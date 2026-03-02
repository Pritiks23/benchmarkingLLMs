import Plotly from 'plotly.js-dist-min';
import { benchmarkData } from './data';
import type { BenchmarkRecord } from './types';
import './styles.css';

type FilterState = {
  model: string;
  vendor: string;
  runtime: string;
  precision: string;
};

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) {
  throw new Error('App container not found');
}

app.innerHTML = `
  <div class="header">
    <div class="title">
      <h1>Open Model Profiling Dashboard</h1>
      <p>Benchmarking throughput, latency, and efficiency across hardware + software builds</p>
    </div>
    <div id="recordCount"></div>
  </div>

  <section class="filters">
    <div class="filter-card">
      <label for="modelFilter">Model</label>
      <select id="modelFilter"></select>
    </div>
    <div class="filter-card">
      <label for="vendorFilter">Hardware Vendor</label>
      <select id="vendorFilter"></select>
    </div>
    <div class="filter-card">
      <label for="runtimeFilter">Runtime</label>
      <select id="runtimeFilter"></select>
    </div>
    <div class="filter-card">
      <label for="precisionFilter">Precision</label>
      <select id="precisionFilter"></select>
    </div>
  </section>

  <section class="kpis">
    <div class="kpi"><h2>Peak Throughput</h2><p id="kpiPeak">-</p></div>
    <div class="kpi"><h2>Median Latency</h2><p id="kpiLatency">-</p></div>
    <div class="kpi"><h2>Best Efficiency</h2><p id="kpiEfficiency">-</p></div>
    <div class="kpi"><h2>Avg VRAM</h2><p id="kpiVram">-</p></div>
  </section>

  <section class="grid">
    <div class="panel">
      <h3>Throughput vs Latency by Build</h3>
      <div id="scatterChart"></div>
    </div>
    <div class="panel">
      <h3>Average Throughput by Model</h3>
      <div id="barChart"></div>
    </div>
    <div class="panel">
      <h3>Latency Distribution by Runtime</h3>
      <div id="boxChart"></div>
    </div>
    <div class="panel">
      <h3>Precision x Vendor Throughput Heatmap</h3>
      <div id="heatmapChart"></div>
    </div>
    <div class="panel" style="grid-column: 1 / -1;">
      <h3>Top Build Profiles</h3>
      <table id="buildTable"></table>
      <div class="insights" id="insights"></div>
    </div>
  </section>
`;

const filters: FilterState = {
  model: 'All',
  vendor: 'All',
  runtime: 'All',
  precision: 'All'
};

const modelFilter = document.querySelector<HTMLSelectElement>('#modelFilter');
const vendorFilter = document.querySelector<HTMLSelectElement>('#vendorFilter');
const runtimeFilter = document.querySelector<HTMLSelectElement>('#runtimeFilter');
const precisionFilter = document.querySelector<HTMLSelectElement>('#precisionFilter');

const recordCount = document.querySelector<HTMLDivElement>('#recordCount');
const kpiPeak = document.querySelector<HTMLParagraphElement>('#kpiPeak');
const kpiLatency = document.querySelector<HTMLParagraphElement>('#kpiLatency');
const kpiEfficiency = document.querySelector<HTMLParagraphElement>('#kpiEfficiency');
const kpiVram = document.querySelector<HTMLParagraphElement>('#kpiVram');
const buildTable = document.querySelector<HTMLTableElement>('#buildTable');
const insights = document.querySelector<HTMLDivElement>('#insights');

if (
  !modelFilter ||
  !vendorFilter ||
  !runtimeFilter ||
  !precisionFilter ||
  !recordCount ||
  !kpiPeak ||
  !kpiLatency ||
  !kpiEfficiency ||
  !kpiVram ||
  !buildTable ||
  !insights
) {
  throw new Error('Missing required dashboard element');
}

const unique = (items: string[]) => ['All', ...new Set(items)].sort((a, b) => a.localeCompare(b));

const populateSelect = (select: HTMLSelectElement, options: string[]) => {
  select.innerHTML = options
    .map((opt) => `<option value="${opt}">${opt}</option>`)
    .join('');
};

populateSelect(modelFilter, unique(benchmarkData.map((item) => item.model)));
populateSelect(vendorFilter, unique(benchmarkData.map((item) => item.hardwareVendor)));
populateSelect(runtimeFilter, unique(benchmarkData.map((item) => item.runtime)));
populateSelect(precisionFilter, unique(benchmarkData.map((item) => item.precision)));

const median = (arr: number[]): number => {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
};

const avg = (arr: number[]): number => {
  if (!arr.length) return 0;
  return arr.reduce((sum, value) => sum + value, 0) / arr.length;
};

const applyFilters = (records: BenchmarkRecord[]): BenchmarkRecord[] =>
  records.filter((row) => {
    if (filters.model !== 'All' && row.model !== filters.model) return false;
    if (filters.vendor !== 'All' && row.hardwareVendor !== filters.vendor) return false;
    if (filters.runtime !== 'All' && row.runtime !== filters.runtime) return false;
    if (filters.precision !== 'All' && row.precision !== filters.precision) return false;
    return true;
  });

const colorByVendor: Record<string, string> = {
  NVIDIA: '#16a34a',
  AMD: '#f97316',
  Apple: '#0284c7'
};

const render = () => {
  const filtered = applyFilters(benchmarkData);
  const throughput = filtered.map((r) => r.tokensPerSecond);
  const latencies = filtered.map((r) => r.latencyMs);
  const efficiencies = filtered.map((r) => r.tokensPerSecond / r.powerW);
  const vrams = filtered.map((r) => r.vramGb);

  recordCount.textContent = `${filtered.length} profile runs`;

  kpiPeak.textContent = filtered.length ? `${Math.max(...throughput).toFixed(0)} tok/s` : '-';
  kpiLatency.textContent = filtered.length ? `${median(latencies).toFixed(1)} ms` : '-';
  kpiEfficiency.textContent = filtered.length ? `${Math.max(...efficiencies).toFixed(2)} tok/s/W` : '-';
  kpiVram.textContent = filtered.length ? `${avg(vrams).toFixed(1)} GB` : '-';

  const scatterTrace = {
    x: filtered.map((r) => r.latencyMs),
    y: filtered.map((r) => r.tokensPerSecond),
    mode: 'markers',
    type: 'scatter',
    text: filtered.map(
      (r) =>
        `${r.model}<br>${r.hardwareSku} (${r.acceleratorCount}x)<br>${r.runtime} ${r.runtimeVersion}<br>${r.buildTag}`
    ),
    marker: {
      size: filtered.map((r) => Math.min(24, 7 + r.paramsB / 4)),
      color: filtered.map((r) => colorByVendor[r.hardwareVendor] ?? '#64748b'),
      opacity: 0.82,
      line: { color: '#0f172a', width: 0.4 }
    },
    hovertemplate: '%{text}<br>Latency %{x} ms<br>Throughput %{y} tok/s<extra></extra>'
  };

  Plotly.newPlot('scatterChart', [scatterTrace], {
    margin: { t: 10, r: 10, b: 50, l: 55 },
    xaxis: { title: 'Latency (ms)', gridcolor: '#e2e8f0' },
    yaxis: { title: 'Throughput (tokens/sec)', gridcolor: '#e2e8f0' },
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent'
  }, { responsive: true, displayModeBar: false });

  const byModel = new Map<string, number[]>();
  filtered.forEach((row) => {
    const current = byModel.get(row.model) ?? [];
    current.push(row.tokensPerSecond);
    byModel.set(row.model, current);
  });

  const modelBars = [...byModel.entries()]
    .map(([model, values]) => ({ model, value: avg(values) }))
    .sort((a, b) => b.value - a.value);

  Plotly.newPlot(
    'barChart',
    [
      {
        x: modelBars.map((item) => item.model),
        y: modelBars.map((item) => item.value),
        type: 'bar',
        marker: {
          color: '#2563eb'
        }
      }
    ],
    {
      margin: { t: 8, r: 8, b: 80, l: 55 },
      xaxis: { tickangle: -25 },
      yaxis: { title: 'Avg tokens/sec', gridcolor: '#e2e8f0' },
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent'
    },
    { responsive: true, displayModeBar: false }
  );

  const runtimeGroups = [...new Set(filtered.map((r) => r.runtime))];
  const boxTraces = runtimeGroups.map((runtime) => ({
    y: filtered.filter((r) => r.runtime === runtime).map((r) => r.latencyMs),
    type: 'box',
    name: runtime,
    boxpoints: 'all',
    jitter: 0.25,
    marker: { opacity: 0.5 }
  }));

  Plotly.newPlot(
    'boxChart',
    boxTraces,
    {
      margin: { t: 8, r: 8, b: 55, l: 55 },
      yaxis: { title: 'Latency (ms)', gridcolor: '#e2e8f0' },
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent'
    },
    { responsive: true, displayModeBar: false }
  );

  const precisions = [...new Set(filtered.map((r) => r.precision))];
  const vendors = [...new Set(filtered.map((r) => r.hardwareVendor))];
  const z = precisions.map((precision) =>
    vendors.map((vendor) => {
      const values = filtered
        .filter((r) => r.precision === precision && r.hardwareVendor === vendor)
        .map((r) => r.tokensPerSecond);
      return values.length ? Number(avg(values).toFixed(1)) : null;
    })
  );

  Plotly.newPlot(
    'heatmapChart',
    [
      {
        x: vendors,
        y: precisions,
        z,
        type: 'heatmap',
        colorscale: 'YlGnBu',
        hovertemplate: 'Vendor %{x}<br>Precision %{y}<br>Avg %{z} tok/s<extra></extra>'
      }
    ],
    {
      margin: { t: 8, r: 8, b: 40, l: 60 },
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent'
    },
    { responsive: true, displayModeBar: false }
  );

  const topRows = [...filtered]
    .sort((a, b) => b.tokensPerSecond - a.tokensPerSecond)
    .slice(0, 8);

  buildTable.innerHTML = `
    <thead>
      <tr>
        <th>Model</th>
        <th>Hardware</th>
        <th>Runtime</th>
        <th>Build</th>
        <th>Precision</th>
        <th>Throughput</th>
        <th>Latency</th>
      </tr>
    </thead>
    <tbody>
      ${topRows
        .map(
          (r) => `
        <tr>
          <td>${r.model}</td>
          <td>${r.hardwareSku} (${r.acceleratorCount}x)</td>
          <td>${r.runtime} ${r.runtimeVersion}</td>
          <td>${r.buildTag}</td>
          <td>${r.precision}</td>
          <td>${r.tokensPerSecond.toFixed(0)} tok/s</td>
          <td>${r.latencyMs.toFixed(0)} ms</td>
        </tr>
      `
        )
        .join('')}
    </tbody>
  `;

  if (!topRows.length) {
    insights.textContent = 'No runs match the active filters. Expand the filter scope to compare more builds.';
    return;
  }

  const best = topRows[0];
  const efficient = [...filtered].sort(
    (a, b) => b.tokensPerSecond / b.powerW - a.tokensPerSecond / a.powerW
  )[0];

  insights.textContent = `Best raw throughput comes from ${best.model} on ${best.hardwareSku} using ${best.runtime} (${best.tokensPerSecond.toFixed(
    0
  )} tok/s). Most power-efficient run is ${efficient.model} on ${efficient.hardwareSku} at ${(efficient.tokensPerSecond /
    efficient.powerW).toFixed(2)} tok/s/W.`;
};

const bindFilter = (
  key: keyof FilterState,
  select: HTMLSelectElement
) => {
  select.addEventListener('change', () => {
    filters[key] = select.value;
    render();
  });
};

bindFilter('model', modelFilter);
bindFilter('vendor', vendorFilter);
bindFilter('runtime', runtimeFilter);
bindFilter('precision', precisionFilter);

render();
