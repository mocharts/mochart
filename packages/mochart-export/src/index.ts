import { mochartCssClasses } from '@mochart/core';

const SVG_NS = 'http://www.w3.org/2000/svg';

// Single-class selectors derived from the shared mochart class map (some map
// entries hold "base per-item" class pairs, so always take the first token).
const chartClass = mochartCssClasses['chart'].split(' ')[0];
// the interaction chrome a focus draws: stripped from a clone when showFocusElements is false
const focusElementClasses = (['crosshair', 'axisFocusRange', 'axisFocusTickMarks'] as const)
  .map(key => mochartCssClasses[key].split(' ')[0]);
const titleTextRawClass = mochartCssClasses['titleTextRaw'].split(' ')[0];

const SVG_CONTAINER_TAGS = ['svg', 'g'];

const SVG_STYLE_ATTRIBUTES = [
  'fill', 'fill-opacity',
  'stroke', 'stroke-opacity', 'stroke-width', 'stroke-dasharray'
];

const SVG_TEXT_TAGS = ['text', 'tspan'];

const SVG_TEXT_STYLE_ATTRIBUTES = SVG_STYLE_ATTRIBUTES.concat([
  'font-family', 'font-size', 'font-weight', 'font-style'
]);

const SVG_CONTAINER_TAG_SET = new Set(SVG_CONTAINER_TAGS);
const SVG_STYLE_ATTRIBUTE_SET = new Set(SVG_STYLE_ATTRIBUTES);
const SVG_TEXT_TAG_SET = new Set(SVG_TEXT_TAGS);
const SVG_TEXT_STYLE_ATTRIBUTE_SET = new Set(SVG_TEXT_STYLE_ATTRIBUTES);

export interface ExportSvgOptions {
  /** Exact filename to use (without extension); overrides the chart-title-derived name. */
  filename?: string;
  /** Prefix prepended to the chart-title-derived filename. */
  filenamePrefix?: string;
  /** Keep the background transparent instead of painting it with backgroundColor. */
  transparent?: boolean;
  /** Background color painted behind the chart when not transparent. Defaults to the effective page background behind the chart (white when untraceable). */
  backgroundColor?: string;
  /** CSS injected verbatim into a `<style>` element in the exported svg, once per file. For `@font-face` rules whose `src` is base64 data — the only way a web font survives the export (see the web fonts section of the README). */
  fontFaceCss?: string;
  /** Keep the focus chrome — crosshair, axis focus range and focus tick marks — as shown on screen. Defaults to true; false strips them (series drawn focused or defocused keep their on-screen styling either way). */
  showFocusElements?: boolean;
}

export interface ExportPngOptions extends ExportSvgOptions {
  /** Rasterization scale relative to the chart's on-screen pixel size. */
  scale?: number;
}

export interface StitchOptions extends ExportSvgOptions {
  /** Number of columns in the tiled grid; rows are derived from the count. */
  cols: number;
  /** Gap in pixels between tiles (both axes). Defaults to 0. */
  gap?: number;
}

export interface StitchPngOptions extends StitchOptions {
  /** Rasterization scale relative to the tiled grid's pixel size. */
  scale?: number;
}

/**
 * Find the chart svg for an element that is the chart root
 * (div.mochart-chart), any ancestor of it, or the svg itself.
 */
export function findChartSvg(element: Element): SVGSVGElement | null {
  if (element instanceof SVGSVGElement) {
    return element;
  }
  if (element.classList.contains(chartClass)) {
    return element.querySelector<SVGSVGElement>(':scope > svg');
  }
  return element.querySelector<SVGSVGElement>('.' + chartClass + ' > svg');
}

/**
 * Copy the computed svg presentation styles (fill, stroke, fonts on text)
 * onto the cloned nodes as inline styles, so the serialized svg renders the
 * same outside the page's stylesheets. Fonts are inlined by family name only, never as font data,
 * so a web font the page loaded is absent from the export unless the caller passes fontFaceCss.
 */
function inlineComputedStyles(targetNode: Element, sourceNode: Element): void {
  const targetChildren = targetNode.children;
  const sourceChildren = sourceNode.children;
  for (let i = 0; i < targetChildren.length; i++) {
    const targetChild = targetChildren[i];
    const sourceChild = sourceChildren[i];
    if (!sourceChild) {
      continue;
    }
    const tagName = targetChild.tagName.toLowerCase();
    if (!SVG_CONTAINER_TAG_SET.has(tagName)) {
      const style = window.getComputedStyle(sourceChild);
      const styleAttributeSet = SVG_TEXT_TAG_SET.has(tagName) ? SVG_TEXT_STYLE_ATTRIBUTE_SET : SVG_STYLE_ATTRIBUTE_SET;
      for (let st = 0; st < style.length; st++) {
        const styleProperty = style[st];
        if (styleAttributeSet.has(styleProperty)) {
          (targetChild as SVGElement | HTMLElement).style.setProperty(styleProperty, style.getPropertyValue(styleProperty));
        }
      }
    }
    inlineComputedStyles(targetChild, sourceChild);
  }
}

function replaceWhitespace(text: string): string {
  return text.replace(/\s+/g, '_');
}

function getFilename(svgElement: SVGSVGElement, options: ExportSvgOptions): string {
  if (options.filename) {
    return options.filename;
  }
  const titleElement = svgElement.querySelector('.' + titleTextRawClass);
  const title = titleElement && titleElement.textContent ? titleElement.textContent.trim() : '';
  const baseName = title ? replaceWhitespace(title) : 'export';
  return options.filenamePrefix ? options.filenamePrefix + baseName : baseName;
}

function getSvgSize(svgElement: SVGSVGElement): { width: number; height: number } {
  const widthAttribute = parseFloat(svgElement.getAttribute('width') || '');
  const heightAttribute = parseFloat(svgElement.getAttribute('height') || '');
  if (widthAttribute > 0 && heightAttribute > 0) {
    return { width: widthAttribute, height: heightAttribute };
  }
  const rect = svgElement.getBoundingClientRect();
  return { width: rect.width, height: rect.height };
}

/**
 * Serialize the chart svg to standalone markup: computed styles inlined, the
 * focus chrome stripped unless showFocusElements, any fontFaceCss added as a
 * style element, and (unless transparent) a solid background rect inserted
 * beneath the chart.
 */
export function getChartSvgText(element: Element, options: ExportSvgOptions = {}): string | null {
  const svgElement = findChartSvg(element);
  return svgElement ? getSvgText(svgElement, options) : null;
}

interface ColorLayer {
  r: number;
  g: number;
  b: number;
  a: number;
}

const WHITE_LAYER: ColorLayer = { r: 255, g: 255, b: 255, a: 1 };

/** The rgb/rgba forms getComputedStyle returns a color in; null for anything else. */
function parseColorLayer(color: string): ColorLayer | null {
  const match = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(color);
  return match === null ? null : {
    r: Number(match[1]), g: Number(match[2]), b: Number(match[3]), a: match[4] === undefined ? 1 : Number(match[4])
  };
}

function isTransparentColor(color: string): boolean {
  if (!color || color === 'transparent') {
    return true;
  }
  const layer = parseColorLayer(color);
  return layer !== null && layer.a === 0;
}

/** Translucent layers, nearest the chart first, painted source-over onto an opaque backdrop. */
function flattenColorLayers(layers: ColorLayer[], backdrop: ColorLayer): string {
  let result = backdrop;
  for (let index = layers.length - 1; index >= 0; index--) {
    const layer = layers[index];
    const blend = (from: number, to: number) => layer.a * from + (1 - layer.a) * to;
    result = { r: blend(layer.r, result.r), g: blend(layer.g, result.g), b: blend(layer.b, result.b), a: 1 };
  }
  return `rgb(${Math.round(result.r)}, ${Math.round(result.g)}, ${Math.round(result.b)})`;
}

/**
 * The effective page background behind the chart: the nearest opaque ancestor
 * background with any translucent ones in front of it composited onto it, since
 * an exported file has nothing behind it to blend with. The export inlines the
 * page's computed (theme-resolved) chart colors, so this default keeps exports
 * WYSIWYG — a chart on a dark page exports onto its dark background, not white.
 */
function getEffectiveBackgroundColor(element: Element): string {
  const layers: ColorLayer[] = [];
  let current: Element | null = element;
  while (current) {
    const color = getComputedStyle(current).backgroundColor;
    if (!isTransparentColor(color)) {
      const layer = parseColorLayer(color);
      // an opaque backdrop ends the walk, and so does one we cannot composite; white backs it when it is covered
      if (layer === null || layer.a >= 1) {
        return layers.length === 0 ? color : flattenColorLayers(layers, layer ?? WHITE_LAYER);
      }
      layers.push(layer);
    }
    current = current.parentElement;
  }
  return layers.length === 0 ? '#ffffff' : flattenColorLayers(layers, WHITE_LAYER);
}

/**
 * A style element carrying host-supplied @font-face CSS, null when there is none. One per exported
 * file, never per chart clone: a base64 font would otherwise repeat in every tile of a grid.
 */
function makeFontFaceStyle(fontFaceCss: string | undefined): SVGStyleElement | null {
  if (!fontFaceCss || !fontFaceCss.trim()) {
    return null;
  }
  const styleElement = document.createElementNS(SVG_NS, 'style') as SVGStyleElement;
  styleElement.textContent = fontFaceCss;
  return styleElement;
}

function makeBackgroundRect(width: number, height: number, backgroundColor: string): SVGRectElement {
  const backgroundRect = document.createElementNS(SVG_NS, 'rect') as SVGRectElement;
  backgroundRect.setAttribute('width', String(width));
  backgroundRect.setAttribute('height', String(height));
  backgroundRect.style.setProperty('fill', backgroundColor);
  backgroundRect.style.setProperty('fill-opacity', '1');
  return backgroundRect;
}

/**
 * Clone a live chart svg with its computed presentation styles inlined (and
 * the focus chrome removed unless showFocusElements), so it serializes/renders
 * the same off-page. No background is painted here — callers add one to the
 * (possibly composed) outer svg.
 */
function cloneChartSvg(svgElement: SVGSVGElement, showFocusElements: boolean): SVGSVGElement {
  const svgCloneElement = svgElement.cloneNode(true) as SVGSVGElement;
  // the clone is already in the svg namespace, so the serializer declares it; the live chart's
  // literal xmlns attribute would be written a second time and make the markup invalid xml
  svgCloneElement.removeAttribute('xmlns');
  inlineComputedStyles(svgCloneElement, svgElement);
  if (!showFocusElements) {
    for (const focusElement of svgCloneElement.querySelectorAll(focusElementClasses.map(cssClass => '.' + cssClass).join(','))) {
      focusElement.parentNode?.removeChild(focusElement);
    }
  }
  // The export is a static image: the tab stops and button semantics need the
  // live keyboard handlers, so strip them and expose the svg as a plain
  // labeled image instead of an interactive group.
  for (const interactiveElement of svgCloneElement.querySelectorAll('[tabindex]')) {
    for (const attribute of ['tabindex', 'role', 'aria-label', 'aria-expanded', 'aria-pressed']) {
      interactiveElement.removeAttribute(attribute);
    }
  }
  // role="img" only with a name to announce: an unnamed image is a harder failure than an unroled
  // svg, and the chart writes aria-label only while accessibility is enabled and not hidden
  if (svgCloneElement.hasAttribute('aria-label') || svgCloneElement.hasAttribute('aria-labelledby')) {
    svgCloneElement.setAttribute('role', 'img');
  }
  else {
    svgCloneElement.setAttribute('aria-hidden', 'true');
  }
  return svgCloneElement;
}

function getSvgText(svgElement: SVGSVGElement, options: ExportSvgOptions): string {
  const { transparent = false, fontFaceCss, backgroundColor = getEffectiveBackgroundColor(svgElement), showFocusElements = true } = options;
  const svgCloneElement = cloneChartSvg(svgElement, showFocusElements);

  if (!transparent) {
    const { width, height } = getSvgSize(svgElement);
    svgCloneElement.insertBefore(makeBackgroundRect(width, height, backgroundColor), svgCloneElement.firstChild);
  }

  const fontFaceStyle = makeFontFaceStyle(fontFaceCss);
  if (fontFaceStyle) {
    svgCloneElement.insertBefore(fontFaceStyle, svgCloneElement.firstChild);
  }

  return new XMLSerializer().serializeToString(svgCloneElement);
}

/**
 * Compose several live chart svgs into one standalone svg, tiling them left to
 * right, top to bottom into `cols` columns. Every tile is sized to the largest
 * chart so the grid stays aligned. Returns null when no chart svg is found.
 */
function getStitchedSvgText(elements: Element[], options: StitchOptions): string | null {
  const { transparent = false, cols, gap = 0, fontFaceCss, showFocusElements = true } = options;
  const charts: { svg: SVGSVGElement; width: number; height: number }[] = [];
  for (const element of elements) {
    const svg = findChartSvg(element);
    if (svg) {
      const { width, height } = getSvgSize(svg);
      charts.push({ svg, width, height });
    }
  }
  if (charts.length === 0) {
    return null;
  }
  const backgroundColor = options.backgroundColor ?? getEffectiveBackgroundColor(charts[0].svg);
  // cols is an upper bound; columns no chart can reach would only pad the image
  const columns = Math.min(Math.max(1, Math.floor(cols)), charts.length);
  const rows = Math.ceil(charts.length / columns);
  const cellWidth = charts.reduce((max, chart) => Math.max(max, chart.width), 0);
  const cellHeight = charts.reduce((max, chart) => Math.max(max, chart.height), 0);
  const totalWidth = columns * cellWidth + (columns - 1) * gap;
  const totalHeight = rows * cellHeight + (rows - 1) * gap;

  // createElementNS already puts the element in the svg namespace; setting xmlns
  // here too would serialize the declaration twice and make the markup invalid xml
  const outer = document.createElementNS(SVG_NS, 'svg') as SVGSVGElement;
  outer.setAttribute('width', String(totalWidth));
  outer.setAttribute('height', String(totalHeight));
  outer.setAttribute('viewBox', '0 0 ' + totalWidth + ' ' + totalHeight);

  // one style element for the whole grid; css applies to the nested tiles too
  const fontFaceStyle = makeFontFaceStyle(fontFaceCss);
  if (fontFaceStyle) {
    outer.appendChild(fontFaceStyle);
  }

  if (!transparent) {
    outer.appendChild(makeBackgroundRect(totalWidth, totalHeight, backgroundColor));
  }

  charts.forEach((chart, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    // Center each chart within its (max-sized) cell so uneven sizes stay tidy.
    const x = col * (cellWidth + gap) + (cellWidth - chart.width) / 2;
    const y = row * (cellHeight + gap) + (cellHeight - chart.height) / 2;
    const clone = cloneChartSvg(chart.svg, showFocusElements);
    clone.setAttribute('x', String(x));
    clone.setAttribute('y', String(y));
    clone.setAttribute('width', String(chart.width));
    clone.setAttribute('height', String(chart.height));
    outer.appendChild(clone);
  });

  return new XMLSerializer().serializeToString(outer);
}

function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Download the chart found in (or at) `element` as an svg file.
 * Returns true when a chart svg was found and the download was started.
 */
export function exportSVG(element: Element, options: ExportSvgOptions = {}): boolean {
  const svgElement = findChartSvg(element);
  if (!svgElement) {
    return false;
  }
  const filename = getFilename(svgElement, options);
  const svgText = getSvgText(svgElement, options);
  const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
  saveBlob(blob, filename + '.svg');
  return true;
}

/** Rasterize standalone svg markup to a png blob via an offscreen canvas. */
function rasterizeSvgText(svgText: string, width: number, height: number, scale: number): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // a throw escapes the handler, not the executor, so the promise would never settle
      try {
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('mochart-export: could not create a 2d canvas context'));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('mochart-export: could not encode the chart canvas as png'));
            return;
          }
          resolve(blob);
        });
      }
      catch (error) {
        // as-is: a DOMException's SecurityError name is the diagnosis
        reject(error);
      }
    };
    img.onerror = () => {
      reject(new Error('mochart-export: failed to rasterize the chart svg'));
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText);
  });
}

/**
 * Download the chart found in (or at) `element` as a png file, rasterized
 * through an offscreen canvas. Resolves to true when a chart svg was found
 * and the download was started.
 */
export function exportPNG(element: Element, options: ExportPngOptions = {}): Promise<boolean> {
  const svgElement = findChartSvg(element);
  if (!svgElement) {
    return Promise.resolve(false);
  }
  const { scale = 2 } = options;
  const filename = getFilename(svgElement, options);
  const svgText = getSvgText(svgElement, options);
  const { width, height } = getSvgSize(svgElement);
  return rasterizeSvgText(svgText, width, height, scale).then((blob) => {
    saveBlob(blob, filename + '.png');
    return true;
  });
}

function getStitchedFilename(elements: Element[], options: StitchOptions): string {
  if (options.filename) {
    return options.filename;
  }
  for (const element of elements) {
    const svg = findChartSvg(element);
    if (svg) {
      return getFilename(svg, options);
    }
  }
  return options.filenamePrefix ? options.filenamePrefix + 'export' : 'export';
}

function getStitchedSize(svgText: string): { width: number; height: number } {
  const widthMatch = /\bwidth="([\d.]+)"/.exec(svgText);
  const heightMatch = /\bheight="([\d.]+)"/.exec(svgText);
  return {
    width: widthMatch ? parseFloat(widthMatch[1]) : 0,
    height: heightMatch ? parseFloat(heightMatch[1]) : 0
  };
}

/**
 * Download several charts tiled into one svg file (see getStitchedSvgText for
 * the layout). Returns true when at least one chart svg was found.
 */
export function exportChartsSVG(elements: Element[], options: StitchOptions): boolean {
  const svgText = getStitchedSvgText(elements, options);
  if (svgText === null) {
    return false;
  }
  const filename = getStitchedFilename(elements, options);
  const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
  saveBlob(blob, filename + '.svg');
  return true;
}

/**
 * Download several charts tiled into one png file, rasterized through an
 * offscreen canvas. Resolves to true when at least one chart svg was found.
 */
export function exportChartsPNG(elements: Element[], options: StitchPngOptions): Promise<boolean> {
  const svgText = getStitchedSvgText(elements, options);
  if (svgText === null) {
    return Promise.resolve(false);
  }
  const { scale = 2 } = options;
  const filename = getStitchedFilename(elements, options);
  const { width, height } = getStitchedSize(svgText);
  return rasterizeSvgText(svgText, width, height, scale).then((blob) => {
    saveBlob(blob, filename + '.png');
    return true;
  });
}

/** Serialize several charts tiled into one standalone svg string (no download). */
export function getStitchedChartsSvgText(elements: Element[], options: StitchOptions): string | null {
  return getStitchedSvgText(elements, options);
}
