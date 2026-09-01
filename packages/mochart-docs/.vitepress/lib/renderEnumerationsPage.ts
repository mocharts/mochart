// Renders the enumerated-values page of the api-reference model to markdown:
// one entry per exported union type, with its values and the config members
// typed with it. Used by reference/[section].paths.ts at build time.

import type { EnumerationDoc, EnumerationsPageDoc } from './apiModel.ts';

function renderEntry(entry: EnumerationDoc): string {
  const lines: string[] = [];
  lines.push('## ' + entry.name + ' {#' + entry.name + '}');
  lines.push('');
  lines.push(entry.description);
  lines.push('');
  lines.push('- **Values:** ' + entry.values.map(value => '`\'' + value + '\'`').join(', '));
  lines.push('- **Used by:** ' + entry.usedBy.map(use => '[`' + use.label + '`](' + use.link + ')').join(', '));
  lines.push('');
  return lines.join('\n');
}

export function renderEnumerationsPage(page: EnumerationsPageDoc): string {
  const lines: string[] = [];
  lines.push('# ' + page.title);
  lines.push('');
  lines.push(page.lead);
  lines.push('');
  lines.push(
    'This page is generated from the library source — the values from the constants' +
    ' each type is built from, the uses from the config type declarations — so it lists' +
    ' exactly what the shipped `.d.ts` accepts. Anchors are stable: link to any type as `#TypeName`.'
  );
  lines.push('');
  for (const entry of page.entries) {
    lines.push(renderEntry(entry));
  }
  return lines.join('\n');
}
