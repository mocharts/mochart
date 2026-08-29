import { line, area, curveMonotoneX, curveMonotoneY, curveBasis, curveCardinal,
  curveCatmullRom, curveNatural, curveStep, curveStepBefore, curveStepAfter } from 'd3-shape';
import { path } from 'd3-path';

import { NONE, CAP_TYPE_POINT, CAP_TYPE_CURVE, CAP_TYPE_ROUND } from '../config/core/constants';
import type { CurveFactory, ShapeGenerator } from 'd3-shape';
import type { Path } from 'd3-path';
import type { CapType, CurveType } from '../config/core/constants';
import type { SeriesCurve } from '../types/config';
import type { EnhancedSeriesConfig } from '../types/enhanced';
import type { SeriesPositionData, StackData } from '../types/data';

type Connector = (pathGenerator: Path, first: number, second: number, third: number, extent: number, offsetSign: number, offset: number, expand: boolean, size: number) => void;
type OffsetInvertedCalculator = (first: number, second: number, third: number, extent: number, offsetSign: number, offset: number, expand: boolean, size: number) => { x: number; y: number; yOffset: number };
type OffsetCalculator = (first: number, second: number, third: number, extent: number, offsetSign: number, offset: number, expand: boolean, size: number) => { x: number; y: number; xOffset: number };

// 'linear', 'monotoneX', 'monotoneY', 'basis', 'cardinal', 'catmullRom', 'natural', 'step', 'stepBefore', 'stepAfter'
const curveTypeToCurveMap: Record<CurveType, CurveFactory | null> = {
  linear: null, // this is the default, so no need to assign it!
  monotoneX: curveMonotoneX,
  monotoneY: curveMonotoneY,
  basis: curveBasis,
  cardinal: curveCardinal,
  catmullRom: curveCatmullRom,
  natural: curveNatural,
  step: curveStep,
  stepBefore: curveStepBefore,
  stepAfter: curveStepAfter
};

const curveTypeToParamFunctionMap: Record<CurveType, 'tension' | 'alpha' | null> = {
  linear: null,
  monotoneX: null,
  monotoneY: null,
  basis: null,
  cardinal: 'tension',
  catmullRom: 'alpha',
  natural: null,
  step: null,
  stepBefore: null,
  stepAfter: null
};

function applyCurve(generator: ShapeGenerator, curveOption: SeriesCurve): ShapeGenerator {
  let curve = curveTypeToCurveMap[curveOption.type];
  if (curve !== null) {
    const curveParamFunction = curveTypeToParamFunctionMap[curveOption.type];
    if (curveParamFunction !== null && curveOption.param !== undefined) {
      curve = curve[curveParamFunction]!(curveOption.param);
    }
    generator = generator.curve(curve);
  }
  return generator;
}

export function getLineGenerator(seriesConfig: EnhancedSeriesConfig, seriesPositionData: SeriesPositionData, inverted: boolean): () => string | null {
  const lineGenerator = applyCurve(line().defined(seriesPositionData.getDefined), seriesConfig.curve);
  if (inverted) {
    lineGenerator.x(seriesPositionData.getSeriesPosition).y(seriesPositionData.getCategoryPosition);
  }
  else {
    lineGenerator.x(seriesPositionData.getCategoryPosition).y(seriesPositionData.getSeriesPosition);
  }
  return () => lineGenerator(seriesPositionData);
}

/** The rangeProperty bound of a ranged line series, drawn as a second line. */
export function getRangeLineGenerator(seriesConfig: EnhancedSeriesConfig, seriesPositionData: SeriesPositionData, inverted: boolean): () => string | null {
  const lineGenerator = applyCurve(line().defined(seriesPositionData.getDefined), seriesConfig.curve);
  if (inverted) {
    lineGenerator.x(seriesPositionData.getPriorSeriesPosition).y(seriesPositionData.getCategoryPosition);
  }
  else {
    lineGenerator.x(seriesPositionData.getCategoryPosition).y(seriesPositionData.getPriorSeriesPosition);
  }
  return () => lineGenerator(seriesPositionData);
}

export function getAreaGenerator(seriesConfig: EnhancedSeriesConfig, seriesPositionData: SeriesPositionData, inverted: boolean): () => string | null {
  const areaGenerator = applyCurve(area().defined(seriesPositionData.getDefined), seriesConfig.curve);
  if (inverted) {
    areaGenerator.y(seriesPositionData.getCategoryPosition).x1(seriesPositionData.getCurrentSeriesPosition).x0(seriesPositionData.getPriorSeriesPosition);
  }
  else {
    areaGenerator.x(seriesPositionData.getCategoryPosition).y1(seriesPositionData.getCurrentSeriesPosition).y0(seriesPositionData.getPriorSeriesPosition);
  }
  return () => areaGenerator(seriesPositionData);
}

const minColumnSize = 1;
const minFlatForRounded = 4;

// in: x1 outer x (cap end), y1 top y, x2 inner x (base), yExtent height
// out: x/y the cap's base x and top y, yOffset the cap-base height
const getXYOffsetInverted: OffsetInvertedCalculator =(x1, y1, x2, yExtent, offsetSign, offset, expand, size) => {
  let x = x2;
  let y = y1;
  let yOffset = yExtent;
  if (size >= offset) {
    x = x1 - offsetSign * offset;
  }
  else if (!expand) {
    yOffset = yExtent * (size / offset);
    y = y1 + (yExtent - yOffset) / 2;
  }
  return { x, y, yOffset };
};

// in: y1 outer y (cap end), y2 inner y (base), x1 left x, xExtent width
// out: x/y the cap's left x and base y, xOffset the cap-base width
const getXYOffset: OffsetCalculator =(x1, y1, y2, xExtent, offsetSign, offset, expand, size) => {
  let x = x1;
  let y = y2;
  let xOffset = xExtent;
  if (size >= offset) {
    y = y1 + offsetSign * offset;
  }
  else if (!expand) {
    xOffset = xExtent * (size / offset);
    x = x1 + (xExtent - xOffset) / 2;
  }
  return { x, y, xOffset };
};

const connectPointInverted: Connector = (pathGenerator, y1, x1, x2, yExtent, offsetSign, offset, expand, size) => {
  const { x, y, yOffset } = getXYOffsetInverted(x1, y1, x2, yExtent, offsetSign, offset, expand, size);
  pathGenerator.moveTo(x, y);

  pathGenerator.lineTo(x1, y + yOffset / 2);
  pathGenerator.lineTo(x, y + yOffset);

  if (size >= offset) {
    pathGenerator.lineTo(x2, y + yExtent);
    pathGenerator.lineTo(x2, y);
  }
  pathGenerator.closePath();
};

const connectPoint: Connector = (pathGenerator, x1, y1, y2, xExtent, offsetSign, offset, expand, size) => {
  const { x, y, xOffset } = getXYOffset(x1, y1, y2, xExtent, offsetSign, offset, expand, size);
  pathGenerator.moveTo(x, y);

  pathGenerator.lineTo(x + xOffset / 2, y1);
  pathGenerator.lineTo(x + xOffset, y);

  if (size >= offset) {
    pathGenerator.lineTo(x1 + xExtent, y2);
    pathGenerator.lineTo(x1, y2);
  }
  pathGenerator.closePath();
};

const connectCurveInverted: Connector = (pathGenerator, y1, x1, x2, yExtent, offsetSign, offset, expand, size) => {
  const { x, y, yOffset } = getXYOffsetInverted(x1, y1, x2, yExtent, offsetSign, offset, expand, size);
  pathGenerator.moveTo(x, y);

  pathGenerator.quadraticCurveTo(x1 + offsetSign * Math.min(offset, size), y + yOffset / 2, x, y + yOffset);

  if (size >= offset) {
    pathGenerator.lineTo(x2, y1 + yExtent);
    pathGenerator.lineTo(x2, y1);
  }
  pathGenerator.closePath();
};

const connectCurve: Connector = (pathGenerator, x1, y1, y2, xExtent, offsetSign, offset, expand, size) => {
  const { x, y, xOffset } = getXYOffset(x1, y1, y2, xExtent, offsetSign, offset, expand, size);
  pathGenerator.moveTo(x, y);

  pathGenerator.quadraticCurveTo(x + xOffset / 2, y1 - offsetSign * Math.min(offset, size), x + xOffset, y);

  if (size >= offset) {
    pathGenerator.lineTo(x1 + xExtent, y2);
    pathGenerator.lineTo(x1, y2);
  }
  pathGenerator.closePath();
};

const connectRoundInverted: Connector = (pathGenerator, y1, x1, x2, yExtent, offsetSign, offset, expand, size) => {
  if (yExtent <= minFlatForRounded) {
    connectNoneInverted(pathGenerator, y1, x1, x2, yExtent, offsetSign, offset, expand, size);
    return;
  }
  const x = x2;
  let y = y1;
  let yOffset = yExtent;

  if (size < offset && !expand) {
    const diff = Math.min(offset - size, (yExtent - minFlatForRounded) / 2);
    y = y1 + diff / 2;
    yOffset = yExtent - diff;
  }
  // bounded by the narrowed height, or the two arcs would overlap on a short bar
  const radius = Math.min(offset, (yExtent - minFlatForRounded) / 2, yOffset / 2, Math.abs(x1 - x2));
  const y2 = y + yOffset;
  pathGenerator.moveTo(x, y);
  pathGenerator.arcTo(x1, y, x1, y + radius, radius);
  pathGenerator.lineTo(x1, y2 - radius);
  pathGenerator.arcTo(x1, y2, x, y2, radius);

  if (size >= offset) {
    pathGenerator.lineTo(x2, y1 + yExtent);
    pathGenerator.lineTo(x2, y1);
  }
  pathGenerator.closePath();
};

const connectRound: Connector = (pathGenerator, x1, y1, y2, xExtent, offsetSign, offset, expand, size) => {
  if (xExtent <= minFlatForRounded) {
    connectNone(pathGenerator, x1, y1, y2, xExtent, offsetSign, offset, expand, size);
    return;
  }
  let x = x1;
  const y = y2;
  let xOffset = xExtent;

  if (size < offset && !expand) {
    const diff = Math.min(offset - size, (xExtent - minFlatForRounded) / 2);
    x = x1 + diff / 2;
    xOffset = xExtent - diff;
  }
  // bounded by the narrowed width, or the two arcs would overlap on a short bar
  const radius = Math.min(offset, (xExtent - minFlatForRounded) / 2, xOffset / 2, Math.abs(y1 - y2));
  const x2 = x + xOffset;
  pathGenerator.moveTo(x, y);
  pathGenerator.arcTo(x, y1, x + radius, y1, radius);
  pathGenerator.lineTo(x2 - radius, y1);
  pathGenerator.arcTo(x2, y1, x2, y, radius);

  if (size >= offset) {
    pathGenerator.lineTo(x1 + xExtent, y2);
    pathGenerator.lineTo(x1, y2);
  }
  pathGenerator.closePath();
};

const connectNoneInverted: Connector = (pathGenerator, y1, x1, x2, yExtent) => {
  pathGenerator.rect(Math.min(x1, x2), y1, Math.abs(x1 - x2), yExtent);
};

const connectNone: Connector = (pathGenerator, x1, y1, y2, xExtent) => {
  pathGenerator.rect(x1, Math.min(y1, y2), xExtent, Math.abs(y1 - y2));
};

function getConnector(capType: CapType | null | undefined, inverted: boolean): Connector {
  switch (capType) {
    case CAP_TYPE_POINT:
      return inverted ? connectPointInverted : connectPoint;
    case CAP_TYPE_CURVE:
      return inverted ? connectCurveInverted : connectCurve;
    case CAP_TYPE_ROUND:
      return inverted ? connectRoundInverted : connectRound;
    default:
      return inverted ? connectNoneInverted : connectNone;
  }
}

export function getColumnGenerator(seriesConfig: EnhancedSeriesConfig, seriesPositionData: SeriesPositionData, inverted: boolean, stackData: StackData): (index: number) => string {
  let pathGenerator: Path;
  const categoryValueExtent = Math.max(minColumnSize, seriesPositionData.categoryValueExtent);

  const { id, stack, seriesStackConfig } = seriesConfig;
  const { type: capType, size: capSize, expand: capExpand, onlyStackOuter: capOnlyStackOuter } = seriesConfig.cap;
  const { minExtent: barMinExtent } = seriesConfig.bar;
  const { type: outerCapType, size: outerCapSize, expand: outerCapExpand } = seriesStackConfig ? seriesStackConfig.outerCap : { type: undefined, size: undefined, expand: undefined };
  const stackPositiveIds = stack ? stackData.filteredOuterPositiveSeriesIds[stack] : null;
  const stackNegativeIds = stack ? stackData.filteredOuterNegativeSeriesIds[stack] : null;

  const columnCapType = capType !== NONE ? capType : outerCapType ? outerCapType : NONE;
  const columnCapSize = capType !== NONE ? capSize : outerCapType ? (outerCapSize ?? 0) : 0;
  const columnCapExpand = capType !== NONE ? capExpand : outerCapType ? (outerCapExpand ?? false) : false;
  const applyStackOuter = stack && (capType !== NONE && capOnlyStackOuter) || (capType === NONE && outerCapType && outerCapType !== NONE);

  const connector = getConnector(columnCapType, inverted);
  const { skipped, skipCategoryIndexMap } = seriesPositionData;

  let categoryPosition;
  let seriesValueExtent;
  let seriesPosition;
  let seriesPriorPosition;
  let seriesCurrentPosition;
  let tempPosition, barCapSizeSign, barCapConnector, skipI;
  const columnGenerator: (index: number) => string = (i: number) => {
    pathGenerator = path();
    categoryPosition = seriesPositionData.getOffsetCategoryPosition(null, i)!;
    seriesValueExtent = seriesPositionData.getSeriesExtent(null, i);
    seriesPosition = seriesPositionData.getSeriesPosition(null, i)!;
    seriesPriorPosition = seriesPositionData.getPriorSeriesPosition(null, i)!;
    seriesCurrentPosition = seriesPositionData.getCurrentSeriesPosition(null, i)!;

    barCapSizeSign = 1;
    barCapConnector = connector;
    if (applyStackOuter) {
      // positions may be compacted, but the stack outer ids stay indexed by the raw category index
      skipI = skipped ? skipCategoryIndexMap[i] : i;
      barCapConnector = (stackPositiveIds![skipI] === id || stackNegativeIds![skipI] === id) ? connector : inverted ? connectNoneInverted : connectNone;
    }
    // a below-base bar has its raw pixel at the prior end: swap so current is the cap end
    if (seriesPriorPosition === seriesPosition && seriesPriorPosition !== seriesCurrentPosition) {
      tempPosition = seriesPriorPosition;
      seriesPriorPosition = seriesCurrentPosition;
      seriesCurrentPosition = tempPosition;
      barCapSizeSign = -1;
    }
    else if (!inverted && seriesPriorPosition < seriesCurrentPosition) {
      barCapSizeSign = -1;
    }
    else if (inverted && seriesPriorPosition > seriesCurrentPosition) {
      barCapSizeSign = -1;
    }
    if (barMinExtent > 0 && Math.abs(seriesCurrentPosition - seriesPriorPosition) < barMinExtent) {
      // expand to the minimum extent, centered between the ends, so zero-extent
      // range bars (equal property/rangeProperty values) stay visible as tick marks
      tempPosition = (seriesCurrentPosition + seriesPriorPosition) / 2;
      // widen in the cap's direction so a zero-extent bar keeps its cap pointing outward
      const halfExtentSign = inverted ? barCapSizeSign : -barCapSizeSign;
      seriesCurrentPosition = tempPosition + halfExtentSign * barMinExtent / 2;
      seriesPriorPosition = tempPosition - halfExtentSign * barMinExtent / 2;
      seriesValueExtent = Math.max(seriesValueExtent, barMinExtent);
    }
    barCapConnector(pathGenerator, categoryPosition, seriesCurrentPosition, seriesPriorPosition, categoryValueExtent, barCapSizeSign, columnCapSize, columnCapExpand, seriesValueExtent);
    return "" + pathGenerator;
  }
  return columnGenerator;
}
