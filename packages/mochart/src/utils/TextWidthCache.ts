const TEXT_NODE = 3;

/** The host groups whose font key TextMeasurement and the truncating hosts share. */
export const textGroups = {
  title: 'title',
  titlePrefix: 'titlePrefix',
  titleSuffix: 'titleSuffix',
  legendItem: 'legendItem',
  categoryAxis: 'categoryAxis'
} as const;

export function valueAxisTextGroup(axisId: string): string {
  return 'valueAxis:' + axisId;
}

export function axisTicksTextGroup(axisGroup: string, minor: boolean): string {
  return axisGroup + (minor ? ':minorTicks' : ':ticks');
}

export function axisTitleTextGroup(axisGroup: string): string {
  return axisGroup + ':title';
}

export function axisThresholdTitleTextGroup(axisGroup: string, index: number): string {
  return axisGroup + ':threshold:' + index;
}

interface WidthEntry { width: number; generation: number }
interface FontEntry { widths: Map<string, WidthEntry>; height: number; generation: number }
interface GroupEntry { key: string; fontSize: number; pass: number; inlineStyle: string | null }

/** The text the browser lays out: the direct text nodes; null when an element child other than the tooltip <title> would also draw. */
function getDirectText(element: Element): string | null {
  let text = '';
  for (let child = element.firstChild; child !== null; child = child.nextSibling) {
    if (child.nodeType === TEXT_NODE) {
      text += child.nodeValue;
    }
    else if (child.nodeName !== 'title') {
      return null;
    }
  }
  return text;
}

function readWidth(element: SVGGraphicsElement): number {
  const textElement = element as SVGTextContentElement;
  return typeof textElement.getComputedTextLength === 'function' ? textElement.getComputedTextLength() : element.getBBox().width;
}

/**
 * The chart's text widths and heights by resolved font and text, so a measure pass reads the DOM only for text it has
 * not seen in that font. One per Chart, shared by TextMeasurement and the truncating hosts. A font key names the resolved
 * font of a host group (the title, an axis title, an axis's tick labels, the legend items) and is read from one of its
 * elements per settled pass, since the texts of a group share one font; a stylesheet styling single labels of a group
 * differently is not covered.
 */
export class TextWidthCache {
  private readonly fonts = new Map<string, FontEntry>();
  private readonly groups = new Map<string, GroupEntry>();
  private generation = 0;
  private pass = 0;
  private settled = true;
  private sweepPending = false;
  private fontsVersion = 0;

  /** The pass one controller update starts (its sync, the hosts' measures and the setState flushes they cause); a settled one that measures is a generation. */
  beginPass(settled: boolean, fontsVersion: number): void {
    if (fontsVersion !== this.fontsVersion) {
      this.fontsVersion = fontsVersion;
      this.clear();
    }
    this.pass++;
    this.settled = settled;
    if (settled) {
      this.sweepPending = true;
    }
  }

  /** The resolved font of `element`, standing for its whole group: one style read per group per settled pass, the frames of a tween reuse it. */
  fontKey(group: string, element: Element): string {
    const inlineStyle = element.getAttribute('style');
    let entry = this.groups.get(group);
    // the inline style is where a config font lands: a changed one re-reads at once, a stylesheet change waits for a settled pass
    if (entry !== undefined && entry.inlineStyle === inlineStyle && (entry.pass === this.pass || !this.settled)) {
      entry.pass = this.pass;
      return entry.key;
    }
    let key: string;
    let fontSize = 0;
    if (typeof getComputedStyle === 'function') {
      const style = getComputedStyle(element);
      key = style.fontStyle + '|' + style.fontWeight + '|' + style.fontSize + '|' + style.fontFamily + '|' + style.letterSpacing + '|' + this.fontsVersion;
      fontSize = parseFloat(style.fontSize);
    }
    else {
      key = (inlineStyle ?? '') + '|' + this.fontsVersion;
    }
    if (entry === undefined) {
      entry = { key, fontSize, pass: this.pass, inlineStyle };
      this.groups.set(group, entry);
    }
    else {
      entry.key = key;
      entry.fontSize = fontSize;
      entry.pass = this.pass;
      entry.inlineStyle = inlineStyle;
    }
    return key;
  }

  /** The font size of a group's last key read, in pixels; NaN until its key has been read. */
  fontSize(group: string): number {
    return this.groups.get(group)?.fontSize ?? NaN;
  }

  /** The advance of the element's drawn text in the font `fontKey` names, read on first sight; a zero is a hidden container, not a width, and is never kept. */
  width(fontKey: string, element: SVGGraphicsElement): number {
    const text = getDirectText(element);
    if (text === null) {
      return readWidth(element);
    }
    const font = this.font(fontKey);
    const entry = font.widths.get(text);
    if (entry !== undefined) {
      entry.generation = this.generation;
      return entry.width;
    }
    const width = readWidth(element);
    if (width > 0) {
      font.widths.set(text, { width, generation: this.generation });
    }
    return width;
  }

  /** The box height of a line in the font `fontKey` names: one read per font, since a line's height does not depend on its text. */
  height(fontKey: string, element: SVGGraphicsElement): number {
    if (getDirectText(element) === null) {
      return element.getBBox().height;
    }
    const font = this.font(fontKey);
    if (font.height === 0) {
      font.height = element.getBBox().height;
    }
    return font.height;
  }

  clear(): void {
    this.fonts.clear();
    this.groups.clear();
  }

  private font(fontKey: string): FontEntry {
    if (this.sweepPending) {
      this.sweepPending = false;
      this.generation++;
      this.sweep();
    }
    let font = this.fonts.get(fontKey);
    if (font === undefined) {
      font = { widths: new Map(), height: 0, generation: this.generation };
      this.fonts.set(fontKey, font);
    }
    else {
      font.generation = this.generation;
    }
    return font;
  }

  // entries untouched for two generations go, or a tween's passing tick texts would accumulate
  private sweep(): void {
    const oldest = this.generation - 2;
    for (const [fontKey, font] of this.fonts) {
      if (font.generation < oldest) {
        this.fonts.delete(fontKey);
      }
      else {
        for (const [text, entry] of font.widths) {
          if (entry.generation < oldest) {
            font.widths.delete(text);
          }
        }
      }
    }
  }
}
