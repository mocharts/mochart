// Tier-1 config fuzzer entry point: sweeps every leaf config property across every candidate value
// on a set of base configs, and writes the findings report. See README.md in this directory.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installEnvironment } from './environment';
import { candidateValues, entryCount, loadPropertySpecs, SKIPPED_FORMATS, type PropertySpec } from './configModel';
import { structuralCases, type StructuralCase } from './structure';
import { Fuzzer, type BaseCase, type FindingGroup, type Library } from './runner';
import { writeReport, type RunSummary } from './report';

const here = path.dirname(fileURLToPath(import.meta.url));
const demosDir = path.resolve(here, '../../../mochart-demo-data/src');

// the clock is faked once the environment is installed, so real time is captured here first
const startedAt = new Date().toISOString();
const startedNs = process.hrtime.bigint();

/** A spread of chart types, axis shapes, text loads and style features. */
const DEFAULT_BASES = [
  'grouped', 'stacked', 'axis-multiple', 'curved', 'gradients',
  'patterns', 'truncated-text', 'undefined-values', 'pie', 'heatmap'
];

interface Options {
  bases: string[] | 'all';
  sections: string[] | null;
  property: string | null;
  values: number;
  width: number;
  height: number;
  frames: number;
  shard: { index: number; count: number } | null;
  /** How many entries of each list section to sweep; null sweeps every entry a base declares. */
  listEntries: number | null;
  /** Whether to add the shape-change cases (list entries added/removed/reordered, rows added/removed). */
  structural: boolean;
  limit: number | null;
  animation: boolean;
  out: string;
  resume: boolean;
  failOnFindings: boolean;
}

function parseOptions(argv: string[]): Options {
  const options: Options = {
    bases: DEFAULT_BASES,
    sections: null,
    property: null,
    values: 6,
    width: 800,
    height: 600,
    frames: 600,
    shard: null,
    listEntries: 1,
    structural: true,
    limit: null,
    animation: true,
    out: path.resolve(here, '../../.fuzz'),
    resume: false,
    failOnFindings: false
  };
  for (const argument of argv) {
    const [flag, raw] = argument.split('=');
    const value = raw ?? '';
    switch (flag) {
      case '--bases': options.bases = value === 'all' ? 'all' : value.split(','); break;
      case '--sections': options.sections = value.split(','); break;
      case '--property': options.property = value; break;
      case '--values': options.values = Number(value); break;
      case '--width': options.width = Number(value); break;
      case '--height': options.height = Number(value); break;
      case '--frames': options.frames = Number(value); break;
      case '--limit': options.limit = Number(value); break;
      case '--list-entries': options.listEntries = value === 'all' ? null : Number(value); break;
      case '--no-structural': options.structural = false; break;
      case '--out': options.out = path.resolve(process.cwd(), value); break;
      case '--no-animation': options.animation = false; break;
      case '--resume': options.resume = true; break;
      case '--fail-on-findings': options.failOnFindings = true; break;
      case '--shard': {
        const [index, count] = value.split('/').map(Number);
        options.shard = { index: index!, count: count! };
        break;
      }
      default: throw new Error('Unknown option: ' + argument);
    }
  }
  return options;
}

function indexJsonFilesByBasename(dir: string, map: Record<string, string> = {}): Record<string, string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      indexJsonFilesByBasename(full, map);
    }
    else if (entry.name.endsWith('.json')) {
      map[entry.name] = full;
    }
  }
  return map;
}

function loadJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

interface DemoEntry { id: string; config: string; data: string }

function loadBases(library: Library, options: Options): BaseCase[] {
  const demos = loadJson(path.join(demosDir, 'demos.json')) as { demos: DemoEntry[]; testDemos: DemoEntry[] };
  const all = [...demos.demos, ...demos.testDemos];
  const wanted = options.bases === 'all' ? all.map(demo => demo.id) : options.bases;
  const configPaths = indexJsonFilesByBasename(path.join(demosDir, 'config'));
  const dataPaths = indexJsonFilesByBasename(path.join(demosDir, 'data'));
  const bases: BaseCase[] = [];
  for (const id of wanted) {
    const demo = all.find(entry => entry.id === id);
    if (!demo) {
      throw new Error('Unknown base config: ' + id);
    }
    const raw = library.migrateConfig(loadJson(configPaths[demo.config]!) as Record<string, unknown>) as Record<string, unknown>;
    raw.animation = { ...(raw.animation as object), enabled: options.animation };
    const validation = library.validateConfig(raw);
    if (!validation.valid) {
      console.warn('skipping base ' + id + ': its own config does not validate — ' + validation.errors.join('; '));
      continue;
    }
    bases.push({ id, config: raw, data: loadJson(dataPaths[demo.data]!) });
  }
  return bases;
}

function selectSpecs(options: Options): PropertySpec[] {
  return loadPropertySpecs().filter(spec => {
    if (options.sections && !options.sections.includes(spec.sectionId)) {
      return false;
    }
    return !options.property || spec.id.includes(options.property);
  });
}

function elapsedSeconds(): number {
  return Number(process.hrtime.bigint() - startedNs) / 1e9;
}

function formatEta(done: number, total: number): string {
  if (done === 0) {
    return '—';
  }
  const remaining = Math.round((elapsedSeconds() / done) * (total - done));
  return Math.floor(remaining / 60) + 'm' + String(remaining % 60).padStart(2, '0') + 's';
}

interface State { signature: string; done: number; swept: string[] }

interface Unit { spec: PropertySpec | null; base: BaseCase; entry: number; structural?: StructuralCase[] }

/** specs whose every selected unit has run without one valid case, so the report names them instead of counting them as swept */
function unsweptSpecs(selected: Unit[], done: number, swept: Set<string>, untested: Set<string>): string[] {
  const pending = new Set(selected.slice(done).map(unit => unit.spec?.id));
  const finished = new Set(selected.slice(0, done).map(unit => unit.spec?.id));
  return [...finished].filter((id): id is string => id !== undefined && !pending.has(id) && !swept.has(id) && !untested.has(id));
}

function readState(options: Options, signature: string): { done: number; swept: string[]; findings: FindingGroup[]; stats: Record<string, number> } {
  const empty = { done: 0, swept: [], findings: [], stats: {} };
  if (!options.resume) {
    return empty;
  }
  const statePath = path.join(options.out, 'state.json');
  const reportPath = path.join(options.out, 'report.json');
  if (!fs.existsSync(statePath) || !fs.existsSync(reportPath)) {
    return empty;
  }
  const state = loadJson(statePath) as State;
  if (state.signature !== signature) {
    console.warn('ignoring --resume: the previous run used different options');
    return empty;
  }
  const report = loadJson(reportPath) as { summary: RunSummary; findings: FindingGroup[] };
  return { done: state.done, swept: state.swept, findings: report.findings, stats: report.summary.stats };
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  installEnvironment();
  const library = (await import('../../src')) as Library;

  const bases = loadBases(library, options);
  const specs = selectSpecs(options);
  const units: Unit[] = [];
  for (const spec of specs) {
    for (const base of bases) {
      const declared = entryCount(base.config, spec);
      const entries = Math.max(1, options.listEntries === null ? declared : Math.min(declared, options.listEntries));
      for (let entry = 0; entry < entries; entry++) {
        units.push({ spec, base, entry });
      }
    }
  }
  if (options.structural) {
    for (const base of bases) {
      units.push({ spec: null, base, entry: 0, structural: structuralCases(base) });
    }
  }
  // a property the generator has no values for runs no cases, so it is named rather than counted as swept
  const untested = specs.filter(spec => candidateValues(spec, options.values).length === 0
    && !(spec.value.format !== undefined && SKIPPED_FORMATS.has(spec.value.format)));
  const untestedIds = new Set(untested.map(spec => spec.id));
  const shard = options.shard;
  const shardUnits = shard ? units.filter((_, index) => index % shard.count === shard.index - 1) : units;
  const selected = options.limit === null ? shardUnits : shardUnits.slice(0, options.limit);

  const signature = JSON.stringify({ ...options, out: undefined, resume: undefined });
  const previous = readState(options, signature);
  // spec ids with at least one case that ran
  const swept = new Set(previous.swept);

  const fuzzer = new Fuzzer(library, { width: options.width, height: options.height, maxFrames: options.frames });
  fuzzer.restore(previous.findings, previous.stats);

  const write = (done: number) => {
    const summary: RunSummary = {
      startedAt,
      elapsedSeconds: elapsedSeconds(),
      bases: bases.map(base => base.id),
      properties: { total: specs.length, untested: [...untestedIds], unswept: unsweptSpecs(selected, done, swept, untestedIds) },
      units: { total: selected.length, done },
      stats: { ...fuzzer.stats }
    };
    writeReport(options.out, summary, fuzzer.getFindings());
    fs.writeFileSync(path.join(options.out, 'state.json'), JSON.stringify({ signature, done, swept: [...swept] } satisfies State));
  };

  let done = previous.done;
  let interrupted = false;
  process.on('SIGINT', () => {
    interrupted = true;
  });

  console.log('fuzzing ' + specs.length + ' properties over ' + bases.length + ' bases = '
    + selected.length + ' units' + (previous.done > 0 ? ' (resuming at ' + previous.done + ')' : ''));

  let lastReport = elapsedSeconds();
  for (; done < selected.length && !interrupted; done++) {
    const { spec, base, entry, structural } = selected[done]!;
    if (spec === null) {
      for (const structuralCase of structural!) {
        fuzzer.runStructuralCase(base, structuralCase.property, structuralCase.label, structuralCase.config, structuralCase.data);
      }
    }
    else {
      for (const candidate of candidateValues(spec, options.values)) {
        if (fuzzer.runCase(base, spec, candidate, entry) === 'ran') {
          swept.add(spec.id);
        }
      }
    }
    // the sweep is synchronous, so the event loop only turns here, which is what lets the SIGINT handler run
    await new Promise(resolve => setImmediate(resolve));
    if (elapsedSeconds() - lastReport > 5) {
      lastReport = elapsedSeconds();
      // `done` is still the index of the unit just finished, so the count is one higher
      const completed = done + 1;
      const percent = ((completed / selected.length) * 100).toFixed(1);
      console.log('[' + percent + '%] ' + completed + '/' + selected.length + ' units · '
        + fuzzer.stats.cases + ' cases · ' + fuzzer.getFindings().length + ' findings · eta ' + formatEta(completed, selected.length));
      write(completed);
    }
  }

  write(done);
  const findings = fuzzer.getFindings();
  console.log((interrupted ? 'interrupted' : 'done') + ' — ' + fuzzer.stats.cases + ' cases in '
    + elapsedSeconds().toFixed(0) + 's · ' + findings.length + ' finding groups · ' + path.join(options.out, 'report.md'));
  if (options.failOnFindings && findings.length > 0) {
    process.exitCode = 1;
  }
}

await main();
