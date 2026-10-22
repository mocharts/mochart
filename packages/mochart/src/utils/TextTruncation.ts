import { svgEl, textEl } from '../render/index.js';
import { appendProbe } from './TextWidthCache.js';
import type { El } from '../render/index.js';
import type { TextWidthCache } from './TextWidthCache.js';

/**
 * One label's truncation. Three states: no lastText (fresh, to be fitted), lastText equal to text with a shorter
 * truncatedText (fitted and drawn, awaiting its verification), lastText equal to truncatedText (settled).
 */
export interface TruncationData {
  text: string;
  truncatedText?: string;
  lastText?: string;
}

export type TruncationDataValue = TruncationData | TruncationData[] | null;

// A fit always starts from the full text, exactly as a first render does: the full width decides whether to fit at all,
// and the prefix widths are read off the element drawing it.
function refreshTruncationData(truncationData: TruncationData, newText: string | undefined): TruncationData {
  const text = newText !== undefined ? newText : truncationData.text;
  return { text, truncatedText: text };
}

export function prepareTruncation(truncationEnabled: boolean, truncationChanged: boolean, oldTruncationData: TruncationDataValue, dataIntact = true, newText?: string | string[]) {
  let truncationData: TruncationDataValue = null;
  const checkTruncation = truncationEnabled && (truncationChanged || oldTruncationData === null);
  if (truncationEnabled) {
    if (truncationChanged) {
      if (oldTruncationData !== null && dataIntact) {
        truncationData = Array.isArray(oldTruncationData)
          ? oldTruncationData.map((td, i) => refreshTruncationData(td, (newText as string[] | undefined)?.[i]))
          : refreshTruncationData(oldTruncationData, newText as string | undefined);
      }
    }
    else {
      truncationData = oldTruncationData;
    }
  }
  return {
    truncationData,
    checkTruncation
  };
}

// a list of labels may truncate each with its own text and room (the axis tick labels, minor and not)
function at<T>(value: T | T[], index: number): T {
  return Array.isArray(value) ? value[index]! : value;
}

// a prefix cut after a space joins the suffix without it: "Tea...", never "Tea ..."
export function getTruncatedText(truncationEnabled: boolean, truncationText: string, text: string, truncationData: TruncationDataValue): string;
export function getTruncatedText(truncationEnabled: boolean, truncationText: string | string[], text: string[], truncationData: TruncationDataValue): string[];
export function getTruncatedText(truncationEnabled: boolean, truncationText: string | string[], text: string | string[], truncationData: TruncationDataValue): string | string[] {
  if (truncationEnabled && truncationData !== null) {
    if (Array.isArray(text)) {
      let aTruncationData;
      text = text.map((aText, i) => {
        aTruncationData = (truncationData as TruncationData[])[i];
        if (aTruncationData.truncatedText !== undefined && aTruncationData.text !== aTruncationData.truncatedText) {
          aText = aTruncationData.truncatedText.trimEnd() + at(truncationText, i);
        }
        return aText;
      });
    }
    else {
      const singleTruncationData = truncationData as TruncationData;
      if (singleTruncationData.truncatedText !== undefined && singleTruncationData.text !== singleTruncationData.truncatedText) {
        text = singleTruncationData.truncatedText.trimEnd() + at(truncationText, 0);
      }
    }
  }
  return text;
}

/** The chart's width cache and the font key each label of a host measures in. */
export interface TruncationMeasure {
  cache: TextWidthCache;
  fontKey(textElement: SVGTextContentElement, index: number): string;
}

const TEXT_NODE = 3;

function getDirectText(element: Element): string {
  let text = '';
  for (let child = element.firstChild; child !== null; child = child.nextSibling) {
    if (child.nodeType === TEXT_NODE) {
      text += child.nodeValue;
    }
  }
  return text;
}

function joinUnits(units: string[], unitCount: number): string {
  return units.slice(0, unitCount).join('');
}

// truncatedText is always a unit-boundary prefix of text, so its unit count comes from text's units without re-segmenting
function prefixUnitCount(units: string[], prefix: string): number {
  let unitCount = 0;
  for (let charCount = 0; charCount < prefix.length; unitCount++) {
    charCount += units[unitCount].length;
  }
  return unitCount;
}

function drawnText(truncationData: TruncationData): string {
  return truncationData.truncatedText ?? truncationData.text;
}

interface FitJob {
  index: number;
  text: string;
  suffix: string;
  maxLength: number;
  fontKey: string;
  /** the <text> drawing the full text, whose prefix advances the fit reads */
  source: SVGTextContentElement;
}

/**
 * One measure pass over a host's labels. A fresh label is fitted in one shot: its full width decides whether it
 * truncates at all, then a binary search over the candidate widths picks the longest prefix that fits with the suffix.
 * A candidate's width comes from the prefix advances of the full text, corrected for the kerning the cut removes and the
 * kerning the suffix adds, from unit and join widths read off probes; the probes for every label are appended and read in
 * one batch per font, and removed at the end of the pass. A fitted label is verified by the pass after its render: one
 * read of the drawn result, which settles as drawn or one unit shorter.
 */
class TruncationPass {
  private readonly jobs: FitJob[] = [];
  private readonly wanted = new Map<string, { host: SVGTextContentElement; texts: Set<string> }>();
  private readonly removers: (() => void)[] = [];

  constructor(private readonly measure: TruncationMeasure) {}

  /** The entry's next state, or null for a fresh label that overflows, which finish() fits. */
  step(textElement: SVGTextContentElement, maxLength: number, suffix: string, truncationData: TruncationData, index: number): TruncationData | null {
    const { text, truncatedText = text, lastText } = truncationData;
    if (text.length === 0) {
      return { text, truncatedText: text, lastText: text };
    }
    if (lastText !== undefined && truncatedText === lastText) {
      return truncationData;
    }
    const { cache } = this.measure;
    const fontKey = this.measure.fontKey(textElement, index);
    if (lastText === undefined) {
      // the element draws the full text after a reset; anything else is fitted from a probe holding it
      let source = textElement;
      if (getDirectText(textElement) !== text) {
        const probe = appendProbe(textElement, text);
        this.removers.push(() => probe.remove());
        source = probe;
      }
      const fullWidth = cache.width(fontKey, source);
      if (fullWidth <= maxLength) {
        return { text, truncatedText: text, lastText: text };
      }
      const { units } = cache.fitTables(fontKey, text, fullWidth);
      let batch = this.wanted.get(fontKey);
      if (batch === undefined) {
        batch = { host: textElement, texts: new Set() };
        this.wanted.set(fontKey, batch);
      }
      batch.texts.add(suffix);
      for (const unit of units) {
        batch.texts.add(unit);
        batch.texts.add(unit + suffix);
      }
      this.jobs.push({ index, text, suffix, maxLength, fontKey, source });
      return null;
    }
    // a fit awaiting verification: one read of the drawn prefix plus suffix, then settled as drawn or one unit shorter. Not deferred to a
    // settled pass: a host whose props stand still through a tween's last frame measures no more, and a hair of overflow would stay
    if (cache.width(fontKey, textElement) <= maxLength) {
      return { text, truncatedText, lastText: truncatedText };
    }
    const { units } = cache.fitTables(fontKey, text);
    const unitCount = prefixUnitCount(units, truncatedText);
    const shorter = unitCount > 0 ? joinUnits(units, unitCount - 1) : '';
    return { text, truncatedText: shorter, lastText: shorter };
  }

  /** Fills the probe batches, fits the queued labels into `entries`, and removes the probes. */
  finish(entries: TruncationData[]): void {
    const { cache } = this.measure;
    for (const [fontKey, { host, texts }] of this.wanted) {
      this.removers.push(cache.fillWidths(fontKey, host, texts));
    }
    for (const job of this.jobs) {
      entries[job.index] = this.fit(job);
    }
    for (const remove of this.removers) {
      remove();
    }
  }

  private fit({ text, suffix, maxLength, fontKey, source }: FitJob): TruncationData {
    const { cache } = this.measure;
    const { units } = cache.fitTables(fontKey, text);
    const suffixWidth = suffix === '' ? 0 : cache.widthOf(fontKey, suffix);
    const prefix = (unitCount: number): number => unitCount === 0 ? 0 : cache.prefixWidth(fontKey, text, unitCount, source);
    const unitWidth = (unit: string): number => cache.widthOf(fontKey, unit);
    const joinWidth = (unit: string): number => suffix === '' ? unitWidth(unit) : cache.widthOf(fontKey, unit + suffix);
    // prefix(k) less the kerning between units k-1 and k that the cut removes, plus the suffix with its kerning after unit k-1
    const candidateWidth = (unitCount: number): number => {
      if (unitCount === 0) {
        return suffixWidth;
      }
      const inTextKern = prefix(unitCount + 1) - prefix(unitCount) - unitWidth(units[unitCount]);
      const joinKern = joinWidth(units[unitCount - 1]) - unitWidth(units[unitCount - 1]) - suffixWidth;
      return prefix(unitCount) - inTextKern + joinKern + suffixWidth;
    };
    let low = 0;
    let high = units.length - 1;
    while (low < high) {
      const mid = (low + high + 1) >> 1;
      if (candidateWidth(mid) <= maxLength) {
        low = mid;
      }
      else {
        high = mid - 1;
      }
    }
    return { text, truncatedText: joinUnits(units, low), lastText: text };
  }
}

export function updateTruncation(truncationText: string | string[], oldTruncationData: TruncationDataValue, text: string | string[], maxLength: number | number[], domElement: SVGTextContentElement | ArrayLike<SVGTextContentElement> | null, measure: TruncationMeasure) {
  let truncationData: TruncationDataValue = oldTruncationData;
  // checkTruncation: a fit is drawn but not yet verified; changed: a drawn text differs, so the host re-renders
  let checkTruncation = false;
  let changed = false;
  if (truncationData === null) {
    truncationData = Array.isArray(text) ? text.map(aText => ({ text: aText })) : { text };
  }
  const elements: ArrayLike<SVGTextContentElement> = domElement === null ? [] : Array.isArray(text) ? domElement as ArrayLike<SVGTextContentElement> : [domElement as SVGTextContentElement];
  if (elements.length > 0) {
    const entries = Array.isArray(truncationData) ? truncationData : [truncationData];
    const pass = new TruncationPass(measure);
    const newEntries: TruncationData[] = [];
    for (let i = 0; i < elements.length; i++) {
      newEntries.push(pass.step(elements[i], at(maxLength, i), at(truncationText, i), entries[i], i) ?? entries[i]);
    }
    pass.finish(newEntries);
    let moved = false;
    for (let i = 0; i < newEntries.length; i++) {
      if (newEntries[i] !== entries[i]) {
        moved = true;
      }
      if (newEntries[i].truncatedText !== newEntries[i].lastText) {
        checkTruncation = true;
      }
      if (drawnText(newEntries[i]) !== drawnText(entries[i])) {
        changed = true;
      }
    }
    // the same entries keep their identity, so a pass that only waited leaves the state untouched
    if (moved) {
      truncationData = Array.isArray(truncationData) ? newEntries : newEntries[0];
    }
  }
  return {
    checkTruncation,
    changed,
    truncationData
  };
}

export interface TruncationState { truncationData: TruncationDataValue }

interface TruncationHost {
  setState(update: Partial<TruncationState>): void;
}

/** The truncation state machine every text-truncating renderer runs: field copies of the data
 * and the check flag, kept ahead of renderer state so nested measure passes see the latest values. */
export class TruncationTracker {
  data: TruncationDataValue = null;
  check = false;

  /** derive() on mount: nothing to prepare yet, just whether measure should check at all */
  mount(enabled: boolean): null {
    this.check = enabled;
    return null;
  }

  /** derive() on update; `reset` drops the accumulated data first (text changed, or the layout settled), `dataIntact` false discards it as no longer matching */
  prepare(enabled: boolean, changed: boolean, reset: boolean, dataIntact = true, newText?: string | string[]): TruncationState {
    if (reset) {
      this.data = null;
    }
    const { checkTruncation, truncationData } = prepareTruncation(enabled, changed, this.data, dataIntact, newText);
    this.data = truncationData;
    // latched, never cleared here: a props update landing before the verification must not cancel it
    if (checkTruncation) {
      this.check = true;
    }
    return { truncationData };
  }

  /** measure(): one fit per fresh label and one verification per fitted one, re-rendering through setState when a drawn text changes */
  update(host: TruncationHost, truncationText: string | string[], text: string | string[], maxLength: number | number[], domElement: SVGTextContentElement | ArrayLike<SVGTextContentElement> | null, measure: TruncationMeasure): void {
    const { checkTruncation, changed, truncationData } = updateTruncation(truncationText, this.data, text, maxLength, domElement, measure);
    // fields must be written before setState: its commit flush runs the next measure pass synchronously
    this.data = truncationData;
    this.check = checkTruncation;
    if (changed) {
      host.setState({ truncationData });
    }
  }
}

/** The svg <title> a truncated text element carries while truncation.tooltipEnabled is on: browsers show
 * it as their native tooltip when a pointer rests on the text. Absent whenever the drawn text is the full text. */
export class TruncationTooltip {
  private readonly title = svgEl('title');
  private readonly value = textEl();

  constructor() {
    this.title.append(this.value);
  }

  sync(text: El, enabled: boolean, fullText: string, shownText: string): void {
    if (enabled && shownText !== fullText) {
      // appended once: sync runs every tween frame, and appendChild would move an attached node each time
      if (this.title.node.parentNode !== text.node) {
        text.append(this.title);
      }
      this.value.set(fullText);
    }
    else {
      this.title.node.remove();
    }
  }
}
