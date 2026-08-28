export interface TruncationData {
  text: string;
  truncatedText?: string;
  lastText?: string;
}

export type TruncationDataValue = TruncationData | TruncationData[] | null;

// Refinement always restarts from the full text, exactly as a first render does: growing back from a
// stale prefix stops early whenever the truncation text is wider than the characters it replaces.
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

export function getTruncatedText(truncationEnabled: boolean, truncationText: string, text: string, truncationData: TruncationDataValue): string;
export function getTruncatedText(truncationEnabled: boolean, truncationText: string, text: string[], truncationData: TruncationDataValue): string[];
export function getTruncatedText(truncationEnabled: boolean, truncationText: string, text: string | string[], truncationData: TruncationDataValue): string | string[] {
  if (truncationEnabled && truncationData !== null) {
    if (Array.isArray(text)) {
      let aTruncationData;
      text = text.map((aText, i) => {
        aTruncationData = (truncationData as TruncationData[])[i];
        if (aTruncationData.text !== aTruncationData.truncatedText) {
          aText = aTruncationData.truncatedText + truncationText;
        }
        return aText;
      });
    }
    else {
      const singleTruncationData = truncationData as TruncationData;
      if (singleTruncationData.text !== singleTruncationData.truncatedText) {
        text = singleTruncationData.truncatedText + truncationText;
      }
    }
  }
  return text;
}

export function updateTruncation(truncationText: string, oldTruncationData: TruncationDataValue, text: string | string[], maxLength: number, domElement: SVGTextContentElement | ArrayLike<SVGTextContentElement> | null) {
  let truncationData: TruncationDataValue = oldTruncationData;
  let needsTruncation = false;
  let checkTruncation = true;
  if (Array.isArray(text)) {
    const newTruncationData: TruncationData[] = [];
    if (truncationData === null) {
      truncationData = text.map(aText => ({ text: aText }));
    }
    const domElements = domElement as ArrayLike<SVGTextContentElement>;
    if (domElements !== null && domElements.length > 0) {
      let aTruncateData;
      for (let i = 0; i < domElements.length; i++) {
        aTruncateData = truncateSVGText(domElements[i], maxLength, truncationText, (truncationData as TruncationData[])[i]);
        if (aTruncateData.truncatedText !== aTruncateData.lastText) {
          needsTruncation = true;
        }
        newTruncationData.push(aTruncateData);
      }
      truncationData = newTruncationData;
    }
  }
  else {
    if (truncationData === null) {
      truncationData = { text: text };
    }
    if (domElement !== null) {
      truncationData = truncateSVGText(domElement as SVGTextContentElement, maxLength, truncationText, truncationData as TruncationData);
      if (truncationData.truncatedText !== truncationData.lastText) {
        needsTruncation = true;
      }
    }
  }
  if (!needsTruncation) {
    checkTruncation = false;
  }
  return {
    checkTruncation,
    truncationData
  };
}

export interface TruncationState { truncationData: TruncationDataValue }

interface TruncationHost {
  state: TruncationState;
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
    // latched, never cleared here: a props update landing mid-refinement must not cancel the pending check
    if (checkTruncation) {
      this.check = true;
    }
    return { truncationData };
  }

  /** measure(): one refinement step, re-rendering through setState while more are needed */
  update(host: TruncationHost, truncationText: string, text: string | string[], maxLength: number, domElement: SVGTextContentElement | ArrayLike<SVGTextContentElement> | null): void {
    const { checkTruncation, truncationData } = updateTruncation(truncationText, host.state.truncationData, text, maxLength, domElement);
    // fields must be written before setState: its commit flush runs the next measure pass synchronously
    this.data = truncationData;
    this.check = checkTruncation;
    if (checkTruncation) {
      host.setState({ truncationData });
    }
  }
}

// typed locally rather than from lib.esnext.intl, so the package's TS lib target is unaffected
interface GraphemeSegmenter {
  segment(text: string): Iterable<{ segment: string }>;
}

const segmenterIntl = Intl as unknown as {
  Segmenter?: new (locales: undefined, options: { granularity: 'grapheme' }) => GraphemeSegmenter;
};

const graphemeSegmenter: GraphemeSegmenter | null = typeof segmenterIntl.Segmenter === 'function'
  ? new segmenterIntl.Segmenter(undefined, { granularity: 'grapheme' })
  : null;

// user-perceived characters, never UTF-16 code units: the Array.from fallback still never splits a surrogate pair, and Intl.Segmenter also keeps modifiers and combining marks attached
function textUnits(text: string): string[] {
  return graphemeSegmenter === null
    ? Array.from(text)
    : Array.from(graphemeSegmenter.segment(text), segment => segment.segment);
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

// the suffix is the same string for every label of a component, so its unit count is segmented once
let cachedSuffixText: string | undefined;
let cachedSuffixUnitCount = 0;

function suffixUnitLength(truncationText: string): number {
  if (truncationText !== cachedSuffixText) {
    cachedSuffixText = truncationText;
    cachedSuffixUnitCount = textUnits(truncationText).length;
  }
  return cachedSuffixUnitCount;
}

export function truncateSVGText(textElement: SVGTextContentElement, maxTextLength: number, truncationText: string, truncationData: TruncationData): TruncationData {
  const { text, truncatedText = text, lastText } = truncationData;
  if (text.length === 0) {
    return {
      text,
      truncatedText: text,
      lastText: text
    }
  }
  else if (lastText !== undefined && truncatedText === lastText) {
    return truncationData;
  }
  const textLength = textElement.getComputedTextLength();
  if (textLength > maxTextLength) {
    const textUnitList = textUnits(text);
    if (lastText === undefined) {
      const suffixUnitCount = suffixUnitLength(truncationText);
      // ratio against what is actually rendered (truncatedText + suffix after a reset, not the full text)
      const renderedLength = truncatedText === text ? textUnitList.length : prefixUnitCount(textUnitList, truncatedText) + suffixUnitCount;
      const initialTruncatedLength = Math.min(textUnitList.length - 1,
        Math.max(0, Math.floor((maxTextLength / textLength) * renderedLength) - suffixUnitCount));
      // lastText marks the guess as a growing step, so a guess that fits grows on to the longest fitting
      // prefix; a zero-length guess has nothing shorter to point at, and must not read as already settled
      return {
        text,
        truncatedText: joinUnits(textUnitList, initialTruncatedLength),
        lastText: initialTruncatedLength > 0 ? joinUnits(textUnitList, initialTruncatedLength - 1) : text
      };
    }
    else {
      // nothing left to shrink once even the bare suffix overflows: settle empty instead of cycling back to the full text
      const unitCount = prefixUnitCount(textUnitList, truncatedText);
      return {
        text,
        truncatedText: unitCount > 0 ? joinUnits(textUnitList, unitCount - 1) : '',
        lastText: unitCount > 0 ? truncatedText : ''
      };
    }
  }
  else if (textLength <= maxTextLength) {
    // both are unit-boundary prefixes of text, so the shorter string is also the one with fewer units
    if (lastText === undefined || lastText.length < truncatedText.length) {
      const textUnitList = textUnits(text);
      return {
        text,
        truncatedText: joinUnits(textUnitList, prefixUnitCount(textUnitList, truncatedText) + 1),
        lastText: truncatedText
      };
    }
    else {
      return {
        text,
        truncatedText,
        lastText: truncatedText
      };
    }
  }
  return truncationData;
}
