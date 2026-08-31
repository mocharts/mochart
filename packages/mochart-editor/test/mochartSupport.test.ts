import { CompletionContext, type Completion, type CompletionResult } from '@codemirror/autocomplete';
import { json } from '@codemirror/lang-json';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMochartConfigSupport, mochartConfigEditorModel, mochartSupportTesting } from '../src/mochartSupport';

const views: EditorView[] = [];

afterEach(() => {
  for (const view of views.splice(0)) view.destroy();
  document.body.replaceChildren();
});

function markedState(markedSource: string) {
  const position = markedSource.indexOf('|');
  if (position < 0) throw new Error('Test source must contain a | cursor marker');
  const source = markedSource.slice(0, position) + markedSource.slice(position + 1);
  return {
    source,
    position,
    state: EditorState.create({ doc: source, extensions: [json()] })
  };
}

async function completionOptions(markedSource: string): Promise<readonly Completion[]> {
  const { state, position } = markedState(markedSource);
  const result = await Promise.resolve(
    mochartSupportTesting.completionSource(new CompletionContext(state, position, true))
  ) as CompletionResult | null;
  return result?.options ?? [];
}

function labels(options: readonly Completion[]) {
  return options.map(option => option.label);
}

function viewFor(source: string) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const view = new EditorView({
    parent: host,
    state: EditorState.create({ doc: source, extensions: [json()] })
  });
  views.push(view);
  return view;
}

/** Run the completion source at the marker and accept `label` through its apply. */
async function acceptCompletionIn(markedSource: string, label: string): Promise<EditorView> {
  const { source, position, state } = markedState(markedSource);
  const result = await Promise.resolve(
    mochartSupportTesting.completionSource(new CompletionContext(state, position, true))
  ) as CompletionResult | null;
  expect(result).not.toBeNull();
  const option = result!.options.find(candidate => candidate.label === label);
  expect(option).toBeDefined();
  const view = viewFor(source);
  view.dispatch({ selection: { anchor: position } });
  expect(typeof option!.apply).toBe('function');
  (option!.apply as (view: EditorView, completion: Completion, from: number, to: number) => void)(
    view, option!, result!.from, position);
  return view;
}

async function acceptCompletion(markedSource: string, label: string): Promise<string> {
  return (await acceptCompletionIn(markedSource, label)).state.doc.toString();
}

describe('Mochart support completions', () => {
  it('suggests missing top-level properties with strict-JSON insertions', async () => {
    const options = await completionOptions('{"|": null, "version": "1.0.0"}');
    expect(labels(options)).toContain('chart');
    expect(labels(options)).not.toContain('version');
    expect(await acceptCompletion('{"|"}', 'chart')).toBe('{"chart": {}}');
  });

  it('matches property completions against the bare key after a typed quote', async () => {
    // the match span must exclude the opening quote or "ti" never matches "title"
    const { source, position, state } = markedState('{"ti|": null, "version": "1.0.0"}');
    const result = await Promise.resolve(
      mochartSupportTesting.completionSource(new CompletionContext(state, position, true))
    ) as CompletionResult | null;
    expect(result).not.toBeNull();
    expect(labels(result!.options)).toContain('title');
    expect(source.slice(result!.from, position)).toBe('ti');
  });

  it('accepts a property completion through the auto-closed quote', async () => {
    const doc = await acceptCompletion('{"ti|"}', 'title');
    expect(doc).toBe('{"title": {}}');
    expect(() => JSON.parse(doc)).not.toThrow();
  });

  // Regression: accepting a property completion inside a key that already had its value appended a
  // second ": value", and the closing quote of a finished key opened the popup and was swallowed
  it('renames the key in place when the member already has a value', async () => {
    expect(await acceptCompletion('{"ti|": null}', 'title')).toBe('{"title": null}');
    expect(await acceptCompletion('{\n  "chart": {"type": "xy"},\n  "leg|": {}\n}', 'legend'))
      .toBe('{\n  "chart": {"type": "xy"},\n  "legend": {}\n}');
  });

  it('stays closed right after the closing quote of a finished key', () => {
    for (const marked of ['{"a"|}', '{"a"|: 1}']) {
      const { state, position } = markedState(marked);
      expect(mochartSupportTesting.completionSource(new CompletionContext(state, position, false))).toBeNull();
      expect(mochartSupportTesting.completionSource(new CompletionContext(state, position, true))).toBeNull();
    }
  });

  it('suggests nested properties instead of section properties', async () => {
    const options = await completionOptions('{"chart":{"margin":{"|": 0}}}');
    expect(labels(options)).toEqual(expect.arrayContaining(['top', 'right', 'bottom', 'left']));
    expect(labels(options)).not.toContain('type');
  });

  it('suggests enum values', async () => {
    const options = await completionOptions('{"chart":{"type":"|"}}');
    expect(labels(options)).toEqual(expect.arrayContaining(['"xy"', '"pie"']));
  });

  it('accepts a value completion inside an auto-closed quote pair without corrupting the JSON', async () => {
    const doc = await acceptCompletion('{"chart":{"type":"|"}}', '"xy"');
    expect(doc).toBe('{"chart":{"type":"xy"}}');
    expect(() => JSON.parse(doc)).not.toThrow();
  });

  it('accepts a value completion over a partially typed quoted value', async () => {
    const doc = await acceptCompletion('{"chart":{"type":"p|"}}', '"pie"');
    expect(doc).toBe('{"chart":{"type":"pie"}}');
  });

  // Regression: a property whose value was missing or still a parse error counted as a key
  // position, so typing an unquoted value offered property names and accepting one corrupted the JSON
  it('offers value completions, not property names, after the colon of an unparsed value', async () => {
    const legendOptions = await completionOptions('{"legend":{"visible": t|}}');
    expect(labels(legendOptions)).toContain('true');
    expect(labels(legendOptions)).not.toContain('truncation');
    const typeOptions = await completionOptions('{"chart":{"type": |}}');
    expect(labels(typeOptions)).toEqual(expect.arrayContaining(['"xy"', '"pie"']));
    expect(labels(typeOptions)).not.toContain('margin');
    const doc = await acceptCompletion('{"legend":{"visible": t|}}', 'true');
    expect(doc).toBe('{"legend":{"visible": true}}');
  });

  it('still offers property names before the colon of a property with no value yet', async () => {
    const options = await completionOptions('{"leg|": }');
    expect(labels(options)).toContain('legend');
  });

  // Regression: an eager popup after a trailing comma swallowed the Enter
  // meant to insert a newline, applying a suggestion instead.
  it('stays closed until a quote or word character is typed', () => {
    for (const marked of ['{"version": "1.0.0",|}', '{"version": "1.0.0", |}', '{"chart": {|}}']) {
      const { state, position } = markedState(marked);
      expect(mochartSupportTesting.completionSource(new CompletionContext(state, position, false))).toBeNull();
    }
  });

  it('opens implicitly once a key is being typed', () => {
    for (const marked of ['{"|"}', '{"ti|"}']) {
      const { state, position } = markedState(marked);
      const result = mochartSupportTesting.completionSource(
        new CompletionContext(state, position, false)) as CompletionResult | null;
      expect(result).not.toBeNull();
      expect(labels(result!.options)).toContain('title');
    }
  });

  it('suggests configured ids and filters common references', async () => {
    const options = await completionOptions(`{
      "version": "1.0.0",
      "categoryAxis": { "property": "month" },
      "valueAxes": [{ "id": "A" }, { "id": "B" }],
      "seriesStacks": [{ "id": "stack-a", "axis": "A" }, { "id": "stack-b", "axis": "B" }],
      "series": [{ "property": "revenue", "axis": "A", "stack": "|" }]
    }`);
    expect(labels(options)).toContain('"stack-a"');
    expect(labels(options)).not.toContain('"stack-b"');
  });
});

describe('property insertion layout', () => {
  it('puts a property accepted after a trailing comma on its own line', async () => {
    const doc = await acceptCompletion('{\n  "version": "1.0.0",|\n}', 'chart');
    expect(doc).toBe('{\n  "version": "1.0.0",\n  "chart": {}\n}');
  });

  it('mimics the indentation of existing members', async () => {
    const doc = await acceptCompletion('{\n    "version": "1.0.0",|\n}', 'chart');
    expect(doc).toBe('{\n    "version": "1.0.0",\n    "chart": {}\n}');
  });

  it('adds the separating comma when a member follows on a later line', async () => {
    const doc = await acceptCompletion('{\n  "version": "1.0.0",\n  |\n  "chart": {}\n}', 'title');
    expect(doc).toBe('{\n  "version": "1.0.0",\n  "title": {},\n  "chart": {}\n}');
  });

  it('moves a member that follows on the same line onto its own line', async () => {
    const doc = await acceptCompletion('{\n  |"version": "1.0.0"\n}', 'title');
    expect(doc).toBe('{\n  "title": {},\n  "version": "1.0.0"\n}');
  });

  it('keeps single-line objects on one line', async () => {
    const doc = await acceptCompletion('{"version": "1.0.0", "ti|"}', 'title');
    expect(doc).toBe('{"version": "1.0.0", "title": {}}');
  });

  it('selects the placeholder value so typing replaces it', async () => {
    const view = await acceptCompletionIn('{"chart": {"ty|"}}', 'type');
    const doc = view.state.doc.toString();
    expect(doc).toBe('{"chart": {"type": "xy"}}');
    expect(view.state.selection.main.from).toBe(doc.indexOf('"xy"'));
    expect(view.state.selection.main.to).toBe(doc.indexOf('"xy"') + 4);
  });

  it('parks the cursor inside an empty object default', async () => {
    const view = await acceptCompletionIn('{"ti|"}', 'title');
    expect(view.state.doc.toString()).toBe('{"title": {}}');
    expect(view.state.selection.main.empty).toBe(true);
    expect(view.state.selection.main.head).toBe('{"title": {'.length);
  });
});

describe('Mochart support hover documentation', () => {
  it('shows property documentation, rules, and defaults', () => {
    const source = '{"chart":{"type":"xy"}}';
    const view = viewFor(source);
    const tooltip = mochartSupportTesting.hoverSource(view, source.indexOf('"type"') + 2);
    expect(tooltip).not.toBeNull();
    const text = tooltip!.create().dom.textContent;
    expect(text).toContain('type');
    expect(text).toContain('type of chart to render');
    expect(text).toContain('Rules:');
    expect(text).toContain('Default: "xy"');
  });

  // Regression: only text defaults were shown, so color, color-list and conditional-only defaults had no Default line
  it('shows color, color list and conditional defaults', () => {
    const hover = (source: string, key: string) => {
      const tooltip = mochartSupportTesting.hoverSource(viewFor(source), source.indexOf('"' + key + '"') + 2);
      expect(tooltip, key).not.toBeNull();
      return tooltip!.create().dom.textContent ?? '';
    };
    expect(hover('{"legend":{"icon":{"filteredColor":"#000"}}}', 'filteredColor')).toMatch(/Default: "/);
    expect(hover('{"colorPalette":{"shape":{"normal":{"fillColors":[]}}}}', 'fillColors')).toMatch(/Default: \["#/);
    const conditional = hover('{"categoryAxis":{"maxTickCount":3}}', 'maxTickCount');
    expect(conditional).toContain('Default when scale is linear: 10');
    expect(conditional).toContain('Default when scale is ordinal: 0');
  });
});

describe('Mochart support diagnostics', () => {
  it('maps semantic diagnostics to the relevant JSON value', () => {
    const source = `{
      "version": "1.0.0",
      "categoryAxis": { "property": "month" },
      "series": [{ "property": "revenue", "axis": "missing" }]
    }`;
    const view = viewFor(source);
    const diagnostics = mochartSupportTesting.semanticDiagnostics(view);
    const diagnostic = diagnostics.find(item => item.message.includes('valueAxes')) as
      (typeof diagnostics)[number] & { path?: (string | number)[] };

    expect(diagnostic).toBeDefined();
    expect(diagnostic.path).toEqual(['series', 0, 'axis']);
    expect(source.slice(diagnostic.from, diagnostic.to)).toBe('"missing"');
    expect(diagnostic.severity).toBe('error');
    expect(diagnostic.source).toBe('mochart');
  });

  it('ranges invalid-property warnings on the offending key names', () => {
    const source = `{
      "version": "1.0.0",
      "notARealSection": true,
      "categoryAxis": { "property": "month", "bogusKey": 1 },
      "series": [{ "property": "revenue" }]
    }`;
    const view = viewFor(source);
    const diagnostics = mochartSupportTesting.semanticDiagnostics(view);
    const topLevel = diagnostics.find(item => item.message.includes('notARealSection'));
    const nested = diagnostics.find(item => item.message.includes('bogusKey'));

    expect(topLevel).toBeDefined();
    expect(source.slice(topLevel!.from, topLevel!.to)).toBe('"notARealSection"');
    expect(nested).toBeDefined();
    expect(source.slice(nested!.from, nested!.to)).toBe('"bogusKey"');
  });

  // Regression: these mid-edit states threw inside getDefaults; the exception
  // escaped the linter and silently froze diagnostics on the previous pass.
  it('reports errors instead of throwing on junk section shapes', () => {
    for (const source of ['{"seriesStacks": 5}', '{"seriesStacks": [null]}']) {
      const view = viewFor(source);
      let diagnostics: ReturnType<typeof mochartSupportTesting.semanticDiagnostics> = [];
      expect(() => { diagnostics = mochartSupportTesting.semanticDiagnostics(view); }).not.toThrow();
      expect(diagnostics.some(item => item.severity === 'error')).toBe(true);
    }
  });
});

// Regression: completions inside an all-config object offered id/order, which
// validation immediately rejects as unique properties.
describe('all-config completions', () => {
  it('omits unique keys inside an all config but keeps them in entries', async () => {
    const allOptions = await completionOptions('{"seriesDefaults": {"|": null}}');
    expect(labels(allOptions)).toContain('renderer');
    expect(labels(allOptions)).not.toContain('id');
    expect(labels(allOptions)).not.toContain('order');

    const entryOptions = await completionOptions('{"series": [{"|": null}]}');
    expect(labels(entryOptions)).toContain('id');
    expect(labels(entryOptions)).toContain('order');
  });

  it('omits pattern entry-only and type-specific keys from patternDefaults', async () => {
    const allOptions = await completionOptions('{"patternDefaults": {"|": null}}');
    expect(labels(allOptions)).toEqual(expect.arrayContaining([
      'spacing', 'foregroundColor', 'foregroundOpacity', 'backgroundColor', 'backgroundOpacity'
    ]));
    expect(labels(allOptions)).not.toEqual(expect.arrayContaining([
      'id', 'ignore', 'type', 'rotation', 'lineWidth', 'radius'
    ]));

    const entryOptions = await completionOptions('{"patterns": [{"|": null}]}');
    expect(labels(entryOptions)).toEqual(expect.arrayContaining(['id', 'type', 'rotation', 'lineWidth', 'radius']));
  });
});

// Regression: the property-position fallback scanned raw text, so a comma
// inside a string value made completions insert a property with no separating
// comma, producing invalid JSON.
describe('completions after a comma-containing string value', () => {
  it('does not offer property-name completions right after the value', async () => {
    const withComma = await completionOptions('{"title": {"text": "Sales, weekly" |}}');
    expect(labels(withComma)).not.toContain('align');

    const afterComma = await completionOptions('{"title": {"text": "Sales, weekly", |}}');
    expect(labels(afterComma)).toContain('align');
  });
});

// The model is a build-time snapshot of a peer-ranged core, so a consumer can pair
// an editor release with a core that has config properties the model never saw.
describe('config model / core version skew', () => {
  const silenceWarn = () => vi.spyOn(console, 'warn').mockImplementation(() => {});
  let warn: ReturnType<typeof silenceWarn>;

  beforeEach(() => {
    mochartSupportTesting.resetModelSkewWarning();
    warn = silenceWarn();
  });

  afterEach(() => {
    warn.mockRestore();
    mochartSupportTesting.resetModelSkewWarning();
  });

  it('warns once, naming both versions, when the config surface can differ', () => {
    mochartSupportTesting.warnOnModelSkew('1.0.0', '1.1.0');
    mochartSupportTesting.warnOnModelSkew('1.0.0', '2.0.0');

    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain('generated from @mochart/core 1.0.0');
    expect(String(warn.mock.calls[0]?.[0])).toContain('installed @mochart/core is 1.1.0');
  });

  it('stays silent for a patch-only difference and for an exact match', () => {
    mochartSupportTesting.warnOnModelSkew('1.0.0', '1.0.7');
    mochartSupportTesting.warnOnModelSkew('1.0.0', '1.0.0');

    expect(warn).not.toHaveBeenCalled();
  });

  it('checks the shipped model against the installed core when support is created', () => {
    // the regenerated model always matches the installed core, so skew it to prove the wiring
    const shipped = mochartConfigEditorModel.coreVersion;
    const [major = '', minor = ''] = shipped.split('.');
    const skewed = `${major}.${Number(minor) + 1}.0`;
    mochartConfigEditorModel.coreVersion = skewed;
    try {
      const support = createMochartConfigSupport();

      expect(support.name).toBe('mochart-config');
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0]?.[0])).toContain(`generated from @mochart/core ${skewed}`);
    }
    finally {
      mochartConfigEditorModel.coreVersion = shipped;
    }
  });
});
