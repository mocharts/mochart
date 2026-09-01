// Renders one page of the api-reference model (props, callbacks) to markdown.
// Used by reference/[section].paths.ts at build time, alongside the config
// section pages rendered by renderSection.ts.

import type { ApiGroupDoc, ApiGroupLink, ApiPageDoc, ApiPropertyDoc } from './apiModel.ts';

function renderLinks(links: ApiGroupLink[]): string {
  const rendered = links.map(link => '[`' + link.title + '`](' + link.link + ')');
  if (rendered.length < 2) {
    return rendered.join('');
  }
  return rendered.slice(0, -1).join(', ') + ' and ' + rendered[rendered.length - 1];
}

function renderProperty(groupId: string, property: ApiPropertyDoc): string {
  const lines: string[] = [];
  lines.push('### ' + property.key + ' {#' + groupId + '.' + property.key + '}');
  lines.push('');
  lines.push(property.description);
  lines.push('');
  lines.push('- **Type:** `' + property.type + '`');
  lines.push('- **Required:** ' + (property.optional ? 'no' : 'yes'));
  if (property.payloads.length > 0) {
    lines.push('- **See:** ' + renderLinks(property.payloads));
  }
  lines.push('');
  return lines.join('\n');
}

function renderGroup(group: ApiGroupDoc): string {
  const lines: string[] = [];
  lines.push('## ' + group.title + ' {#' + group.id + '}');
  lines.push('');
  lines.push(group.description);
  lines.push('');
  lines.push(
    'From the `' + group.interfaceName + '` interface' +
    (group.extendsGroups.length > 0 ? ', which also includes ' + renderLinks(group.extendsGroups) : '') +
    '. Property anchors are stable: link to any entry as `#' + group.id + '.propertyName`.'
  );
  lines.push('');
  for (const property of group.properties) {
    lines.push(renderProperty(group.id, property));
  }
  return lines.join('\n');
}

export function renderApiPage(page: ApiPageDoc): string {
  const lines: string[] = [];
  lines.push('# ' + page.title);
  lines.push('');
  lines.push(page.lead);
  lines.push('');
  lines.push(
    'This page is generated from the type declarations in the library source,' +
    ' so it documents exactly what the shipped `.d.ts` and your editor hovers do.'
  );
  lines.push('');
  for (const group of page.groups) {
    lines.push(renderGroup(group));
  }
  return lines.join('\n');
}
