import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

import generateDocs, { renderHtml } from '../../scripts/generator';
import { buildConfigReference, type ConfigReferenceModel, type PropertyDoc } from '../../scripts/configReferenceModel';
import { buildApiReference, type ApiReferenceModel } from '../../scripts/apiReferenceModel';

vi.mock('../../scripts/configReferenceModel', async importOriginal => {
  const actual = await importOriginal<typeof import('../../scripts/configReferenceModel')>();
  return { ...actual, buildConfigReference: vi.fn(actual.buildConfigReference) };
});
vi.mock('../../scripts/apiReferenceModel', async importOriginal => {
  const actual = await importOriginal<typeof import('../../scripts/apiReferenceModel')>();
  return { ...actual, buildApiReference: vi.fn(actual.buildApiReference) };
});

const editor = { types: ['string' as const] };

function property(overrides: Partial<PropertyDoc> & { key: string }): PropertyDoc {
  return { description: overrides.key + ' description', rules: ['rule for ' + overrides.key], editor, ...overrides };
}

const fixture: ConfigReferenceModel = {
  topLevel: [
    { key: 'chart', description: 'chart section', rules: ['chart must be an object'], defaultText: '{}', sectionId: 'chart', editor },
    {
      key: 'series',
      description: 'series list',
      rules: ['series must be an array'],
      defaultText: '[]',
      sectionId: 'series',
      allKey: 'seriesAll',
      allDescription: 'applies to every series',
      allRules: ['seriesAll must be an object'],
      allDefaultText: '{}',
      editor
    },
    { key: 'version', description: 'config version', rules: ['version must be a number'], defaultText: 'none', editor }
  ],
  sections: [
    {
      id: 'chart',
      title: 'Chart',
      description: 'chart section',
      shape: 'object',
      properties: [
        property({ key: 'color', default: { kind: 'color', color: '#123456' } }),
        property({ key: 'palette', default: { kind: 'colors', colors: ['#111111', '#222222'] } }),
        property({ key: 'width', details: 'more about width', rules: ['must be a number', 'must be positive'], default: { kind: 'literal', text: '400' } }),
        property({ key: 'title', required: true }),
        property({ key: 'unset' }),
        property({
          key: 'mode',
          conditionalDefaults: [
            { value: { kind: 'literal', text: 'true' }, condition: 'chart.type is pie' },
            { value: { kind: 'none' }, condition: 'otherwise' }
          ]
        }),
        property({
          key: 'margin',
          properties: [
            property({ key: 'top', default: { kind: 'literal', text: '2' } })
          ]
        }),
        property({
          key: 'stops',
          itemShape: true,
          properties: [
            property({
              key: 'offset',
              properties: [property({ key: 'unit' })]
            })
          ]
        })
      ]
    }
  ]
};

const emptyApiModel: ApiReferenceModel = {
  pages: [],
  enumerations: { id: 'enumerations', title: 'Enumerated values', lead: '', entries: [] }
};

function rows(html: string): string[] {
  return html.split('<tr').slice(1);
}

describe('renderHtml', () => {
  const html = renderHtml(fixture);

  it('wraps the tables in a complete html document', () => {
    expect(html.startsWith('<html>\n<head>\n<title>Mochart Config Docs</title>')).toBe(true);
    expect(html.endsWith('</body>\n</html>')).toBe(true);
  });

  it('renders one top-level row per key with a Details link only for keys that have a section', () => {
    const topLevel = html.slice(html.indexOf('<h2>Mochart Config</h2>'), html.indexOf('<div id="chart">'));
    const bodyRows = rows(topLevel).slice(1);
    expect(bodyRows).toHaveLength(3);
    expect(bodyRows[0]).toContain('<td>chart</td><td>chart section</td><td>chart must be an object</td><td>{}</td><td><a href="#chart">Details</a></td>');
    expect(bodyRows[2]).toContain('<td>version</td><td>config version</td><td>version must be a number</td><td>none</td><td></td>');
  });

  it('merges the *All key into its section row', () => {
    expect(html).toContain('<td>series<br/>seriesAll</td><td>series list<br/>applies to every series</td>'
      + '<td>series must be an array<br/>seriesAll must be an object</td><td>[]<br/>{}</td><td><a href="#series">Details</a></td>');
  });

  it('gives each section a titled anchor div and one row per property including nested members', () => {
    const section = html.slice(html.indexOf('<div id="chart">'));
    expect(section).toContain('<h2>Chart</h2>');
    const ids = [...section.matchAll(/<tr id="([^"]+)">/g)].map(match => match[1]);
    expect(ids).toEqual([
      'chart.color', 'chart.palette', 'chart.width', 'chart.title', 'chart.unset', 'chart.mode',
      'chart.margin', 'chart.margin.top',
      'chart.stops', 'chart.stops.offset', 'chart.stops.offset.unit'
    ]);
  });

  it('labels nested members with dotted paths, [] for array elements, and indents them', () => {
    expect(html).toContain('<td>&nbsp;&nbsp;&nbsp;&nbsp;<a href="#chart.margin.top">margin.top</a></td>');
    expect(html).toContain('<td>&nbsp;&nbsp;&nbsp;&nbsp;<a href="#chart.stops.offset">stops[].offset</a></td>');
    expect(html).toContain('<td>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<a href="#chart.stops.offset.unit">stops[].offset.unit</a></td>');
    expect(html).toContain('<td><a href="#chart.color">color</a></td>');
  });

  it('renders every default kind', () => {
    const icon = (color: string) => '<span class="colorIcon" style="background-color: ' + color + '"></span>';
    expect(html).toContain('<td><div>' + icon('#123456') + '</div>\n</td>');
    expect(html).toContain('<td><div>' + icon('#111111') + icon('#222222') + '</div>\n</td>');
    expect(html).toContain('<td><div>400</div>\n</td>');
    expect(html).toContain('<td><div>required</div>\n</td>');
    expect(html).toContain('<td>unset description</td><td>rule for unset</td><td><div></div>\n</td>');
    expect(html).toContain('<td><div>true (chart.type is pie)</div>\n<div> (otherwise)</div>\n</td>');
  });

  it('appends details after the description and wraps multiple rules in paragraphs', () => {
    expect(html).toContain('<td>width description<br/><br/>more about width</td><td><p>must be a number</p>\n<p>must be positive</p>\n</td>');
    expect(html).toContain('<td>color description</td><td>rule for color</td>');
  });
});

describe('renderHtml on the real config reference', () => {
  const { model } = buildConfigReference();
  const html = renderHtml(model);

  it('never leaks a missing field into the markup', () => {
    // "undefined"/"null" are legitimate inside prose, rule text and literal defaults, so only match them as a whole cell or line
    expect(html).not.toMatch(/(<td>|<br\/>|<p>|<h2>|\()(undefined|null)(<\/td>|<br\/>|<\/p>|<\/h2>|\))/);
    expect(html).not.toMatch(/<div>undefined<\/div>|\[object Object\]|#undefined|\.undefined/);
  });

  it('gives every property row a unique anchor', () => {
    const ids = [...html.matchAll(/<tr id="([^"]+)">/g)].map(match => match[1]);
    expect(ids.length).toBeGreaterThan(100);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('links every top-level Details link to a rendered section', () => {
    const links = [...html.matchAll(/<a href="#([^".]+)">Details<\/a>/g)].map(match => match[1]);
    // top-level rows are sorted by key, sections follow source order
    expect(links).toEqual(model.sections.map(section => section.id).sort());
    for (const link of links) {
      expect(html).toContain('<div id="' + link + '">');
    }
  });
});

describe('generateDocs', () => {
  const dirs: string[] = [];
  function tempDir(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mochart-generator-'));
    dirs.push(dir);
    return dir;
  }
  function paths(dir: string) {
    return {
      htmlPath: path.join(dir, 'html', 'mochart-docs.html'),
      jsonPath: path.join(dir, 'generated', 'config-reference.json'),
      apiJsonPath: path.join(dir, 'generated', 'api-reference.json')
    };
  }

  afterEach(() => {
    vi.restoreAllMocks();
    for (const dir of dirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('writes the json model, the html, and the api model, creating missing directories', () => {
    const { htmlPath, jsonPath, apiJsonPath } = paths(tempDir());
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(generateDocs(htmlPath, jsonPath, apiJsonPath)).toBe(true);

    expect(error).not.toHaveBeenCalled();
    const { model } = buildConfigReference();
    expect(JSON.parse(fs.readFileSync(jsonPath, 'utf8'))).toEqual(model);
    expect(fs.readFileSync(htmlPath, 'utf8')).toBe(renderHtml(model));
    expect(JSON.parse(fs.readFileSync(apiJsonPath, 'utf8'))).toEqual(buildApiReference().model);
  });

  it('reports config integrity errors and leaves the previous artifacts untouched', () => {
    const { htmlPath, jsonPath, apiJsonPath } = paths(tempDir());
    fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
    fs.writeFileSync(jsonPath, 'previous json');
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(buildConfigReference).mockReturnValueOnce({ model: fixture, integrityErrors: ['chart: missing description'] });
    // the enumerations page validates its links against the config model, which the fixture cannot back
    vi.mocked(buildApiReference).mockReturnValueOnce({ model: emptyApiModel, integrityErrors: [] });

    expect(generateDocs(htmlPath, jsonPath, apiJsonPath)).toBe(false);

    expect(error.mock.calls.map(call => call[0])).toEqual(['config docs sources are out of sync:', '  - chart: missing description']);
    expect(fs.readFileSync(jsonPath, 'utf8')).toBe('previous json');
    expect(fs.existsSync(htmlPath)).toBe(false);
    expect(fs.existsSync(apiJsonPath)).toBe(false);
  });

  it('reports api integrity errors and writes nothing, even when the config model is clean', () => {
    const { htmlPath, jsonPath, apiJsonPath } = paths(tempDir());
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(buildApiReference).mockReturnValueOnce({ model: emptyApiModel, integrityErrors: ['createPie: undocumented'] });

    expect(generateDocs(htmlPath, jsonPath, apiJsonPath)).toBe(false);

    expect(error.mock.calls.map(call => call[0])).toEqual(['api docs sources are out of sync:', '  - createPie: undocumented']);
    expect(fs.existsSync(jsonPath)).toBe(false);
    expect(fs.existsSync(htmlPath)).toBe(false);
    expect(fs.existsSync(apiJsonPath)).toBe(false);
  });
});
