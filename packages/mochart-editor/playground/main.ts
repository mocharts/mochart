import { createDefaultChart, getDefaults, validateConfigDetailed, type MochartInputConfig } from '@mochart/core';
import { createJsonEditor, createMochartConfigSupport, type JsonEditorDiagnostic } from '../src';
import '@mochart/core/mochart.css';
import '@mochart/editor/editor.css';
import '../../mochart-demo-common/css/chart-dark.css';
import './style.css';

type ThemePreference = 'system' | 'light' | 'dark';
type ResolvedTheme = Exclude<ThemePreference, 'system'>;

const systemTheme = matchMedia('(prefers-color-scheme: dark)');
const themeSelect = document.querySelector<HTMLSelectElement>('#theme')!;
let themePreference: ThemePreference = 'system';

function resolveTheme(): ResolvedTheme {
  return themePreference === 'system'
    ? systemTheme.matches ? 'dark' : 'light'
    : themePreference;
}

function applyDocumentTheme(theme: ResolvedTheme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

const initialTheme = resolveTheme();
applyDocumentTheme(initialTheme);

const config: MochartInputConfig = {
  version: '1.0.0',
  title: { text: 'Monthly Revenue' },
  categoryAxis: { property: 'month', type: 'string', scale: 'ordinal' },
  seriesDefaults: { renderer: 'bar' },
  series: [{ property: 'revenue', title: 'Revenue' }]
};

const data = [
  { month: 'Jan', revenue: 12 },
  { month: 'Feb', revenue: 18 },
  { month: 'Mar', revenue: 15 },
  { month: 'Apr', revenue: 24 },
  { month: 'May', revenue: 21 },
  { month: 'Jun', revenue: 28 }
];

const editorHost = document.querySelector<HTMLElement>('#editor')!;
const chartHost = document.querySelector<HTMLElement>('#chart')!;
const status = document.querySelector<HTMLElement>('#status')!;
const problems = document.querySelector<HTMLElement>('#problems')!;
const problemList = document.querySelector<HTMLOListElement>('#problem-list')!;
let diagnostics: readonly JsonEditorDiagnostic[] = [];

function diagnosticLocation(diagnostic: JsonEditorDiagnostic): string {
  if (!diagnostic.path || diagnostic.path.length === 0) return 'document root';
  return diagnostic.path.map((segment, index) =>
    typeof segment === 'number' ? `[${segment}]` : index === 0 ? segment : `.${segment}`
  ).join('');
}

function showDiagnostics(nextDiagnostics: readonly JsonEditorDiagnostic[]) {
  diagnostics = nextDiagnostics;
  const errors = diagnostics.filter(diagnostic => diagnostic.severity === 'error');
  const warnings = diagnostics.filter(diagnostic => diagnostic.severity === 'warning');
  status.textContent = errors.length > 0
    ? `${errors.length} error${errors.length === 1 ? '' : 's'}`
    : warnings.length > 0
      ? `${warnings.length} warning${warnings.length === 1 ? '' : 's'}`
      : 'No problems';
  status.dataset.state = errors.length > 0 ? 'invalid' : warnings.length > 0 ? 'warning' : 'valid';

  const visibleDiagnostics = diagnostics.slice(0, 5);
  problems.hidden = visibleDiagnostics.length === 0;
  problemList.replaceChildren(...visibleDiagnostics.map(diagnostic => {
    const item = document.createElement('li');
    const button = document.createElement('button');
    const severity = document.createElement('span');
    const message = document.createElement('span');
    const location = diagnosticLocation(diagnostic);
    button.type = 'button';
    button.className = `problem ${diagnostic.severity}`;
    button.setAttribute('aria-label', `${diagnostic.severity} at ${location}: ${diagnostic.message}`);
    button.addEventListener('click', () => editor.showFocusRange(diagnostic.from, diagnostic.to));
    severity.className = 'problem-severity';
    severity.textContent = diagnostic.severity;
    message.className = 'problem-message';
    message.textContent = `${location}: ${diagnostic.message}`;
    button.append(severity, message);
    item.append(button);
    return item;
  }));
  if (diagnostics.length > visibleDiagnostics.length) {
    const item = document.createElement('li');
    item.className = 'problem-overflow';
    item.textContent = `${diagnostics.length - visibleDiagnostics.length} more problems`;
    problemList.append(item);
  }
}

const editor = createJsonEditor(editorHost, {
  value: JSON.stringify(config, null, 2),
  ariaLabel: 'Mochart configuration JSON',
  ariaDescribedBy: 'editor-help',
  theme: initialTheme,
  support: createMochartConfigSupport(),
  onChange: () => {
    status.textContent = 'Edited — apply when ready';
    status.dataset.state = 'edited';
  },
  onDiagnostics: showDiagnostics
});

function applyTheme() {
  const theme = resolveTheme();
  applyDocumentTheme(theme);
  editor.setTheme(theme);
}

themeSelect.addEventListener('change', () => {
  themePreference = themeSelect.value as ThemePreference;
  applyTheme();
});
systemTheme.addEventListener('change', () => {
  if (themePreference === 'system') applyTheme();
});

let chartWidth = Math.max(1, Math.round(chartHost.clientWidth));
let chartHeight = Math.max(1, Math.round(chartHost.clientHeight));
const chart = createDefaultChart(chartHost, {
  config,
  data,
  width: chartWidth,
  height: chartHeight
});

document.querySelector<HTMLButtonElement>('#format')!.addEventListener('click', () => {
  if (editor.format()) {
    status.textContent = 'Formatted — apply when ready';
    status.dataset.state = 'edited';
  }
  else {
    status.textContent = 'Cannot format invalid JSON';
    status.dataset.state = 'invalid';
  }
});
document.querySelector<HTMLButtonElement>('#apply')!.addEventListener('click', () => {
  try {
    const nextConfig: unknown = JSON.parse(editor.getValue());
    const validation = validateConfigDetailed(nextConfig, getDefaults(nextConfig));
    if (!validation.valid) {
      status.textContent = 'Fix the highlighted problems first';
      status.dataset.state = 'invalid';
      const firstError = diagnostics.find(diagnostic => diagnostic.severity === 'error');
      if (firstError) editor.showFocusRange(firstError.from, firstError.to);
      return;
    }
    chart.update({ config: nextConfig as MochartInputConfig });
    status.textContent = 'Applied';
    status.dataset.state = 'valid';
  }
  catch {
    status.textContent = 'Fix the JSON syntax first';
    status.dataset.state = 'invalid';
  }
});

const resizeObserver = new ResizeObserver(entries => {
  const { width, height } = entries[0]!.contentRect;
  const nextWidth = Math.max(1, Math.round(width));
  const nextHeight = Math.max(1, Math.round(height));
  if (nextWidth === chartWidth && nextHeight === chartHeight) return;
  chartWidth = nextWidth;
  chartHeight = nextHeight;
  chart.update({ width: chartWidth, height: chartHeight });
});
resizeObserver.observe(chartHost);
