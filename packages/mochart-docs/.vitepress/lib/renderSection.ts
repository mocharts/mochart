// Renders one config section of the reference model to a markdown page.
// Used by reference/[section].paths.ts at build time.

import type { DefaultValue, PropertyDoc, SectionDoc } from './model';
import type { UsageIndex } from './usageIndex';

// h2 for a top-level property through h6 for the deepest member
const MAX_PROPERTY_DEPTH = 4;

function renderDefaultValue(value: DefaultValue): string {
  switch (value.kind) {
    case 'color':
      return colorChip(value.color) + ' `' + value.color + '`';
    case 'colors':
      return value.colors.map(colorChip).join('');
    case 'literal':
      return '`' + value.text + '`';
    case 'none':
      return 'none';
  }
}

function colorChip(color: string): string {
  return '<span class="color-chip" style="background-color: ' + color + '" title="' + color + '"></span>';
}

function renderRules(rules: string[]): string {
  return rules.map(rule => '`' + rule + '`').join('; ');
}

function renderUsage(key: string, usage: UsageIndex): string | null {
  const links = usage.perProperty[key];
  if (links === undefined || links.length === 0) {
    return null;
  }
  const rendered = links.map(link => '[' + link.text + '](' + link.link + ')').join(' · ');
  const extra = usage.overflow[key];
  return '- **Used in:** ' + rendered + (extra !== undefined ? ' · +' + extra + ' more' : '');
}

/** Heading level for a property: `##` at the top, one deeper per nesting level. */
function headingPrefix(depth: number): string {
  if (depth > MAX_PROPERTY_DEPTH) {
    // clamping instead would head a property at the same level as its own parent
    throw new Error('config reference nests ' + (depth + 1) + ' levels deep, past the ' +
      (MAX_PROPERTY_DEPTH + 1) + ' markdown headings has room for');
  }
  return '#'.repeat(2 + depth);
}

/** Render one property, then each member of the object — or of each array element — it holds; a member's anchor extends its parent's. */
function renderProperty(sectionId: string, property: PropertyDoc, usage: UsageIndex, parentPath: string[] = [], parentLabels: string[] = []): string {
  const path = [...parentPath, property.key];
  const labels = [...parentLabels, property.key];
  // members of an array element are headed `stops[].offset`, while the anchor keeps the plain dotted path
  const childLabels = [...parentLabels, property.key + (property.itemShape === true ? '[]' : '')];
  const anchor = sectionId + '.' + path.join('.');
  const lines: string[] = [];
  lines.push(headingPrefix(parentPath.length) + ' ' + labels.join('.') + ' {#' + anchor + '}');
  lines.push('');
  lines.push(upperFirst(property.description) + '.');
  lines.push('');
  if (property.details) {
    lines.push(property.details);
    lines.push('');
  }
  if (property.required) {
    lines.push('- **Required:** a value must be given (there is no default)');
  }
  else if (property.conditionalDefaults) {
    const [soleConditional] = property.conditionalDefaults;
    if (property.conditionalDefaults.length === 1 && soleConditional !== undefined) {
      lines.push('- **Default:** ' + renderDefaultValue(soleConditional.value) + ' — ' + soleConditional.condition);
    }
    else {
      lines.push('- **Default:**');
      for (const conditional of property.conditionalDefaults) {
        lines.push('  - ' + renderDefaultValue(conditional.value) + ' — ' + conditional.condition);
      }
    }
  }
  else {
    lines.push('- **Default:** ' + renderDefaultValue(property.default ?? { kind: 'none' }));
  }
  lines.push('- **Validation:** ' + renderRules(property.rules));
  const usageLine = renderUsage(anchor, usage);
  if (usageLine !== null) {
    lines.push(usageLine);
  }
  lines.push('');
  for (const nested of property.properties ?? []) {
    lines.push(renderProperty(sectionId, nested, usage, path, childLabels));
  }
  return lines.join('\n');
}

/** `a`, `a` and `b`, `a`, `b` and `c`. */
function joinKeys(keys: string[]): string {
  const quoted = keys.map(key => '`' + key + '`');
  if (quoted.length < 2) {
    return quoted.join('');
  }
  return quoted.slice(0, -1).join(', ') + ' and ' + quoted[quoted.length - 1];
}

function upperFirst(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function renderSectionPage(section: SectionDoc, usage: UsageIndex): string {
  const lines: string[] = [];
  // properties take h2, so the outline lists them rather than their members
  lines.push('---');
  lines.push('outline: 2');
  lines.push('---');
  lines.push('');
  lines.push('# ' + section.title);
  lines.push('');
  lines.push(upperFirst(section.description) + '.');
  lines.push('');
  if (section.shape === 'array') {
    lines.push(
      '`' + section.id + '` is a list section: it takes an array of config objects' +
      ' (a single object is also accepted and treated as a one-entry array).'
    );
    if (section.allKey) {
      lines.push(
        ' Values shared by every entry can be set once in `' + section.allKey + '`;' +
        ' a value set on an individual entry wins over the shared one.'
      );
    }
    lines.push('');
  }
  const requiredKeys = section.requiredKeys ?? [];
  lines.push(
    (requiredKeys.length === 0
      ? 'Every property is optional and falls back to its default.'
      : 'Every property is optional and falls back to its default, except ' +
        joinKeys(requiredKeys) + ', which must be given.') +
    ' Property anchors are stable: link to any entry as' +
    ' `#' + section.id + '.propertyName`, and to a member of a nested property as' +
    ' `#' + section.id + '.propertyName.memberName`.'
  );
  lines.push('');
  const itemProperty = section.properties.find(property => property.itemShape === true);
  const itemMember = itemProperty?.properties?.[0];
  if (itemProperty && itemMember) {
    lines.push(
      'A property holding a list of objects documents the members of one entry, headed' +
      ' `' + itemProperty.key + '[].' + itemMember.key + '`. Their anchors leave the brackets out:' +
      ' `#' + section.id + '.' + itemProperty.key + '.' + itemMember.key + '`.'
    );
    lines.push('');
  }
  for (const property of section.properties) {
    lines.push(renderProperty(section.id, property, usage));
  }
  return lines.join('\n');
}
