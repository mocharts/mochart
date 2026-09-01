// Renders the framework-props page from the binding-reference model: a
// cross-binding name mapping, then each binding's own props. Used by
// reference/[section].paths.ts at build time.

import type { BindingDoc, BindingGroupDoc, BindingReferenceModel } from './bindingModel.ts';

/** Table cells are pipe-separated, so a union type has to escape its pipes. */
function cell(text: string): string {
  return text.replace(/\|/g, '\\|');
}

function code(text: string): string {
  return '`' + cell(text) + '`';
}

function oneLine(text: string): string {
  return cell(text.split(/\n+/).join(' ').trim());
}

function renderMapping(model: BindingReferenceModel): string {
  const lines: string[] = [];
  lines.push('## Name mapping {#mapping}');
  lines.push('');
  lines.push(
    'Every core prop and the name each binding gives it. Names match the core' +
    ' reference unless the framework\'s conventions call for something else —' +
    ' Angular exposes callbacks as outputs (no `on` prefix), and the state' +
    ' factories become placeholder components (templates in Lit).'
  );
  lines.push('');
  const styleLink = model.mapping.find(row => row.coreKey === 'style')?.coreLink ?? '/reference/props';
  lines.push(
    'A `—` means no binding prop maps to that core prop. Only [`style`](' + styleLink + ')' +
    ' sits there, and the reason is worth knowing: it sets inline styles on the' +
    ' chart\'s own root element (`div.mochart-chart`), which the bindings do not' +
    ' forward. The `style` and `class`/`className` props listed per binding below' +
    ' are a **different** prop — they target the container element the binding' +
    ' creates and mounts the chart into, which is the element that also carries' +
    ' the size:'
  );
  lines.push('');
  lines.push('```html');
  lines.push('<div style="…">                        <!-- the binding\'s container: its style/class prop -->');
  lines.push('  <div class="mochart-chart" style="…">  <!-- the chart root: core\'s style prop -->');
  lines.push('    <svg>…</svg>');
  lines.push('  </div>');
  lines.push('</div>');
  lines.push('```');
  lines.push('');
  lines.push(
    'Vue and Angular list no container props because their frameworks already' +
    ' cover it — Vue passes stray attributes (`class`, `style`) through to the' +
    ' container, and Angular styles the component\'s own host element.'
  );
  lines.push('');
  lines.push('| Core prop | ' + model.bindings.map(binding => binding.title).join(' | ') + ' |');
  lines.push('| --- | ' + model.bindings.map(() => '---').join(' | ') + ' |');
  for (const row of model.mapping) {
    const cells = model.bindings.map(binding => {
      const name = row.names[binding.id];
      return name === null || name === undefined ? '—' : code(name);
    });
    lines.push('| [' + code(row.coreKey) + '](' + row.coreLink + ') | ' + cells.join(' | ') + ' |');
  }
  lines.push('');
  return lines.join('\n');
}

function renderGroup(group: BindingGroupDoc): string {
  const lines: string[] = [];
  lines.push('### ' + group.title + ' {#' + group.id + '}');
  lines.push('');
  lines.push(group.description);
  lines.push('');
  lines.push('| Prop | Type | Core prop | Description |');
  lines.push('| --- | --- | --- | --- |');
  for (const property of group.properties) {
    const core = property.coreKey === undefined || property.coreLink === undefined
      ? '—'
      : '[' + code(property.coreKey) + '](' + property.coreLink + ')';
    lines.push(
      '| ' + code(property.key) +
      ' | ' + code(property.type) +
      ' | ' + core +
      ' | ' + oneLine(property.description) + ' |'
    );
  }
  lines.push('');
  return lines.join('\n');
}

function renderBinding(binding: BindingDoc): string {
  const lines: string[] = [];
  lines.push('## ' + binding.title + ' {#' + binding.id + '}');
  lines.push('');
  lines.push(
    '`' + binding.packageName + '` — ' + binding.surface +
    '. See the [' + binding.title + ' guide](' + binding.guideLink + ') for setup and examples.'
  );
  lines.push('');
  for (const note of binding.notes) {
    lines.push('- No [`' + note.coreKey + '`](' + note.coreLink + ') prop: ' + note.reason + '.');
  }
  if (binding.notes.length > 0) {
    lines.push('');
  }
  for (const group of binding.groups) {
    lines.push(renderGroup(group));
  }
  return lines.join('\n');
}

export function renderBindingPage(model: BindingReferenceModel): string {
  const lines: string[] = [];
  lines.push('# Framework props');
  lines.push('');
  lines.push(
    'The framework bindings wrap the same two chart entry points, so they take' +
    ' the same props — spelled the way each framework expects. Every prop below' +
    ' links to its counterpart in [Chart props](/reference/props) and' +
    ' [Callbacks and payloads](/reference/callbacks), which describe the' +
    ' behaviour and the payloads in full.'
  );
  lines.push('');
  lines.push(
    'This page is generated from the binding packages\' own prop declarations,' +
    ' so a prop added to one binding but not another cannot go unnoticed.'
  );
  lines.push('');
  lines.push(renderMapping(model));
  for (const binding of model.bindings) {
    lines.push(renderBinding(binding));
  }
  return lines.join('\n');
}
