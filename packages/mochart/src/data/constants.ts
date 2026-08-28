export const keyPlain = 'plain';
export const keyRange = 'range';
export const keyErrorLow = 'errorLow';
export const keyErrorHigh = 'errorHigh';
export const keyStack = 'stack';
export const keyPrior = 'prior';
export const keyMarker = 'marker';
export const keyLabel = 'label';
export const keyColor = 'color';
export const keyTooltip = 'tooltip';
export const keyDomain = 'domain';

const copyKeyMarker = 'markerCopyKey';
const copyKeyLabel = 'labelCopyKey';
const copyKeyColor = 'colorCopyKey';
const copyKeyTooltip = 'tooltipCopyKey';

// PositionKey includes errorLow/errorHigh so error bounds get filtered copies, domain
// contribution and value tweening for free; not every position key is a shape position.
export type PositionKey = typeof keyPlain | typeof keyRange | typeof keyErrorLow | typeof keyErrorHigh;
export type PositionOrComputedKey = PositionKey | typeof keyStack | typeof keyPrior;
export type ExtraKey = typeof keyMarker | typeof keyLabel | typeof keyColor | typeof keyTooltip;
export type ValueKey = PositionOrComputedKey | ExtraKey;
export type DomainKey = typeof keyDomain | typeof keyPlain | typeof keyRange | typeof keyErrorLow | typeof keyErrorHigh | typeof keyStack | typeof keyMarker | typeof keyLabel | typeof keyColor | typeof keyTooltip;
export type ExtraCopyKey = typeof copyKeyMarker | typeof copyKeyLabel | typeof copyKeyColor | typeof copyKeyTooltip;

export const valueKeys: ValueKey[] = [keyPlain, keyRange, keyErrorLow, keyErrorHigh, keyStack, keyPrior, keyMarker, keyLabel, keyColor, keyTooltip];

export const positionKeys: PositionKey[] = [keyPlain, keyRange, keyErrorLow, keyErrorHigh];

export const positionOrComputedKeys: PositionOrComputedKey[] = [keyPlain, keyRange, keyErrorLow, keyErrorHigh, keyStack, keyPrior];

export const extraKeys: ExtraKey[] = [keyMarker, keyColor, keyLabel, keyTooltip];

export const extraCopyKeys: ExtraCopyKey[] = [copyKeyMarker, copyKeyLabel, copyKeyColor, copyKeyTooltip];

export const extraAndCopyKeys: { extraKey: ExtraKey; copyKey: ExtraCopyKey }[] =
  [{extraKey: keyMarker, copyKey: copyKeyMarker}, {extraKey: keyColor, copyKey: copyKeyColor}, {extraKey: keyLabel, copyKey: copyKeyLabel}, {extraKey: keyTooltip, copyKey: copyKeyTooltip}];

export const domainKeys: DomainKey[] = [keyDomain, keyPlain, keyRange, keyErrorLow, keyErrorHigh, keyStack, keyMarker, keyLabel, keyColor, keyTooltip];
