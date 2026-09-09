// Writes the run's findings as JSON (for tooling) and Markdown (for reading).
import fs from 'node:fs';
import path from 'node:path';
import type { FindingGroup, Oracle } from './runner';

export interface RunSummary {
  startedAt: string;
  elapsedSeconds: number;
  bases: string[];
  properties: { total: number; untested: string[]; unswept: string[] };
  units: { total: number; done: number };
  stats: Record<string, number>;
}

const ORACLE_TITLES: Record<Oracle, string> = {
  'error': 'Errors — a throw, a console error, or a chart that never settles',
  'geometry': 'Impossible geometry — NaN, Infinity, missing values or negative extents in the DOM',
  'path-independence': 'Path dependence — updating to a value does not match building it directly',
  'input-mutation': 'Input mutation — the library wrote to an object the caller owns'
};

const ORACLE_ORDER: Oracle[] = ['error', 'geometry', 'path-independence', 'input-mutation'];

function formatDuration(seconds: number): string {
  const whole = Math.round(seconds);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  return (hours > 0 ? hours + 'h ' : '') + (hours > 0 || minutes > 0 ? minutes + 'm ' : '') + (whole % 60) + 's';
}

function formatCount(value: number): string {
  return value.toLocaleString('en-US');
}

function renderGroup(group: FindingGroup): string {
  const lines = [
    '#### `' + group.property + '` — ' + group.signature,
    '',
    formatCount(group.count) + ' case' + (group.count === 1 ? '' : 's') + ' · bases: ' + group.bases.join(', '),
    ''
  ];
  for (const sample of group.samples) {
    lines.push('- base `' + sample.base + '`' + (sample.entry === undefined ? '' : ', entry ' + sample.entry)
      + ', value `' + sample.value + '`, stage `' + sample.stage + '`');
    lines.push('');
    lines.push('  ```');
    lines.push(...sample.detail.split('\n').map(line => '  ' + line));
    lines.push('  ```');
    lines.push('');
  }
  return lines.join('\n');
}

function renderMarkdown(summary: RunSummary, findings: FindingGroup[]): string {
  const lines = [
    '# Config fuzz — tier 1',
    '',
    'Single-property sweep over the generated config model, checked for errors, impossible geometry,',
    'path dependence and input mutation. Written by `npm run fuzz -w @mochart/core`.',
    '',
    '- started: ' + summary.startedAt,
    '- elapsed: ' + formatDuration(summary.elapsedSeconds),
    '- properties swept: ' + formatCount(summary.properties.total - summary.properties.untested.length - summary.properties.unswept.length)
      + ' of ' + formatCount(summary.properties.total),
    '- units (property × base): ' + formatCount(summary.units.done) + ' of ' + formatCount(summary.units.total),
    '- bases: ' + summary.bases.join(', '),
    ''
  ];
  lines.push('| counter | value |', '| --- | --- |');
  for (const [key, value] of Object.entries(summary.stats)) {
    lines.push('| ' + key + ' | ' + formatCount(value) + ' |');
  }
  lines.push('');
  if (summary.properties.untested.length > 0) {
    lines.push('## Untested properties — ' + formatCount(summary.properties.untested.length), '',
      'No candidate values were generated for these, so no case ever moved them.', '',
      ...summary.properties.untested.map(id => '- `' + id + '`'), '');
  }
  if (summary.properties.unswept.length > 0) {
    lines.push('## Properties with no valid case — ' + formatCount(summary.properties.unswept.length), '',
      'Every generated value was rejected by validation or the data before a case could run, so no case ever moved them.', '',
      ...summary.properties.unswept.map(id => '- `' + id + '`'), '');
  }
  if (findings.length === 0) {
    lines.push('## No findings', '', 'Every case passed all four oracles.', '');
    return lines.join('\n');
  }
  lines.push('## Findings — ' + formatCount(findings.length) + ' groups', '');
  for (const oracle of ORACLE_ORDER) {
    const groups = findings.filter(group => group.oracle === oracle);
    if (groups.length === 0) {
      continue;
    }
    lines.push('### ' + oracle + ' (' + groups.length + ')', '', ORACLE_TITLES[oracle], '');
    const properties = [...new Set(groups.map(group => group.property))].sort();
    lines.push('Properties affected: ' + properties.map(property => '`' + property + '`').join(', '), '');
    for (const group of groups) {
      lines.push(renderGroup(group));
    }
  }
  return lines.join('\n');
}

export function writeReport(outDir: string, summary: RunSummary, findings: FindingGroup[]): void {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify({ summary, findings }, null, 2));
  fs.writeFileSync(path.join(outDir, 'report.md'), renderMarkdown(summary, findings));
}
