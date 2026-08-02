// Inline SVG icons (feather-style, stroke = currentColor) so the showcase has
// no icon-font dependency. Each entry is the innerHTML of a 24x24 viewBox.

const strokeIcons: Record<string, string> = {
  'arrow-left': '<path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>',
  'sun': '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  'moon': '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
  'share': '<path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><path d="M16 6l-4-4-4 4"/><path d="M12 2v13"/>',
  'download': '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>',
  'chevron-left': '<path d="M15 18l-6-6 6-6"/>',
  'chevron-right': '<path d="M9 18l6-6-6-6"/>',
  'undo': '<path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>',
  'grid': '<path d="M3 3h7v7H3z"/><path d="M14 3h7v7h-7z"/><path d="M3 14h7v7H3z"/><path d="M14 14h7v7h-7z"/>',
  'link': '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  'x': '<path d="M18 6L6 18"/><path d="M6 6l12 12"/>',
  'check': '<path d="M20 6L9 17l-5-5"/>',
  'sliders': '<path d="M4 21v-7"/><path d="M4 10V3"/><path d="M12 21v-9"/><path d="M12 8V3"/><path d="M20 21v-5"/><path d="M20 12V3"/><path d="M1 14h6"/><path d="M9 8h6"/><path d="M17 16h6"/>',
  'braces': '<path d="M8 3H7a2 2 0 0 0-2 2v4a2 2 0 0 1-2 2 2 2 0 0 1 2 2v4a2 2 0 0 0 2 2h1"/><path d="M16 3h1a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2 2 2 0 0 0-2 2v4a2 2 0 0 1-2 2h-1"/>'
};

const fillIcons: Record<string, string> = {
  'play': '<path d="M8 5v14l11-7z"/>',
  'pause': '<path d="M7 5h4v14H7z"/><path d="M13 5h4v14h-4z"/>',
  'dice': '<rect x="3" y="3" width="18" height="18" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="8.5" cy="8.5" r="1.6"/><circle cx="15.5" cy="8.5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="8.5" cy="15.5" r="1.6"/><circle cx="15.5" cy="15.5" r="1.6"/>'
};

export type IconName = keyof typeof strokeIcons | keyof typeof fillIcons;

export function svgIcon(name: string): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('sc-icon');
  const stroke = strokeIcons[name];
  if (stroke !== undefined) {
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.innerHTML = stroke;
    return svg;
  }
  const fill = fillIcons[name];
  if (fill !== undefined) {
    svg.setAttribute('fill', 'currentColor');
    svg.innerHTML = fill;
    return svg;
  }
  throw new Error('unknown icon: ' + name);
}
