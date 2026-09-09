import { scaleLinear, scaleSqrt } from 'd3-scale';

import { Renderer, svgEl } from '../render';

import { mochartCssClasses } from '../utils/ChartDom';
import { NONE, MARKER_SIZE_SCALE_SQRT, RENDERER_BAR } from '../config/core/constants';
import { translate, isMissingValue } from '../utils/utils';
import { getSymbolGenerator } from '../utils/shapeUtils';
import { getSeriesMarkerFillColor, getSeriesMarkerStrokeColor } from '../utils/SeriesColors';
import { getSeriesFocusPercentage } from '../utils/SeriesFocus';
import { getFocusStyle, getCategoryFocusPercentage } from '../utils/FocusValue';
import type { ElListAdapter } from '../render';
import type { ColorPaletteConfig } from '../types/config';
import type { EnhancedSeriesConfig } from '../types/enhanced';
import type { FocusData } from '../types/animation';
import type { SeriesDomainObject, SeriesPositionData, SeriesValueObject } from '../types/data';
import { CategoryShapeCache } from '../utils/CategoryShapes';
import type { CategoryShape } from '../utils/CategoryShapes';

const markerAdapter: ElListAdapter<CategoryShape, { root: ReturnType<typeof svgEl> }> = {
  key: (marker) => marker.key,
  create: () => ({ root: svgEl('path') }),
  update: (handle, marker) => {
    handle.root.set(marker.attrs);
  }
};

interface SeriesMarkersProps {
  colorPaletteConfig: ColorPaletteConfig;
  seriesConfig: EnhancedSeriesConfig;
  seriesIndex: number;
  seriesPositionData: SeriesPositionData;
  filteredValues: SeriesValueObject;
  rawDomains: SeriesDomainObject;
  inverted: boolean;
  focusData: FocusData;
  onCategoryEnter: (categoryIndex: number) => void;
  onCategoryLeave: (categoryIndex: number) => void;
  onCategoryClick: (categoryIndex: number, event: Event) => void;
}

export default class SeriesMarkers extends Renderer<SeriesMarkersProps> {
  root = svgEl('g');
  markers = this.elList<CategoryShape>(this.root);
  markerShapes = new CategoryShapeCache('seriesMarker', () => this.props);

  create() {
    return this.root.node;
  }

  sync() {
    const { colorPaletteConfig, seriesConfig, seriesIndex, seriesPositionData, filteredValues, rawDomains, inverted, focusData } = this.props;

    if (seriesConfig.marker.shape !== NONE) {
      const { categoryFocusPercentages, valueAxisFocusPercentages, seriesFocusPercentages } = focusData;
      const seriesFocusPercentage = getSeriesFocusPercentage(seriesConfig, valueAxisFocusPercentages, seriesFocusPercentages);
      let markerFillColor, markerStrokeColor;
      const { shape: markerShape, showForMissingValues: missingValueMarkers, size: markerSize, minSize: markerMinSize, sizeScale: markerSizeScale } = seriesConfig.marker;
      const markers: CategoryShape[] = [];
      let markerSizes: Array<number | undefined> | null = null;
      if (seriesConfig.markerProperty !== NONE) {
        markerSizes = [];
        const markerValues = filteredValues.marker!;
        const markerDomain = rawDomains.marker;
        const sizeScale = (markerSizeScale === MARKER_SIZE_SCALE_SQRT ? scaleSqrt() : scaleLinear())
          .domain([markerDomain[0]!, markerDomain[1]!])
          .range([markerMinSize, markerSize])
          .clamp(true);
        // Raw-indexed: marker values can be missing in a different pattern than
        // the main values, so this must not follow the position compaction.
        const count = markerValues.length;
        for (let m = 0; m < count; m++) {
          const markerValue = markerValues[m];
          markerSizes.push(!isMissingValue(markerValue) ? sizeScale(markerValue!) : undefined);
        }
      }

      const symbolGenerator = getSymbolGenerator(markerSize, markerShape);
      const globalSymbol = symbolGenerator();

      const max = filteredValues.max!;

      let focusPercentage;

      const { length, getDefined, getSeriesPosition, getCategoryPosition, getOffsetCategoryPosition, categoryValueExtent, skipped, skipCategoryIndexMap } = seriesPositionData;
      // a bar marker centers on the bar's own slot (group sub-slot, barWidthFraction), not the category slot
      const isBar = seriesConfig.renderer === RENDERER_BAR;

      for (let i = 0; i < length; i++) {
        const skipI = skipped ? skipCategoryIndexMap[i] : i;
        if (getDefined(null, i) && (missingValueMarkers || !isMissingValue(max[skipI]))) {
          focusPercentage = getCategoryFocusPercentage(categoryFocusPercentages[skipI], seriesFocusPercentage);
          markerFillColor = getSeriesMarkerFillColor(colorPaletteConfig, seriesConfig, seriesIndex, focusPercentage, null, skipI);
          markerStrokeColor = getSeriesMarkerStrokeColor(colorPaletteConfig, seriesConfig, seriesIndex, focusPercentage, null, skipI);
          const { strokeWidth: markerStrokeWidth, strokeDashArray: markerStrokeDashArray, strokeOpacity: markerStrokeOpacity, fillOpacity: markerFillOpacity } = getFocusStyle(focusPercentage, seriesConfig.marker.style);
          const categoryPosition = isBar ? getOffsetCategoryPosition(null, i)! + categoryValueExtent / 2 : getCategoryPosition(null, i)!;
          let cx, cy;
          if (inverted) {
            cx = getSeriesPosition(null, i)!;
            cy = categoryPosition;
          }
          else {
            cx = categoryPosition;
            cy = getSeriesPosition(null, i)!;
          }
          let theSymbol = globalSymbol;
          let currentMarkerSize: number | undefined = markerSize;
          if (markerSizes !== null) {
            currentMarkerSize = markerSizes[skipI];
            if (currentMarkerSize !== undefined) {
              theSymbol = symbolGenerator.size(currentMarkerSize * currentMarkerSize)();
            }
          }
          if (currentMarkerSize !== undefined) {
            const marker = this.markerShapes.get(skipI);
            marker.attrs = { className: marker.className, d: theSymbol, transform: translate(cx, cy),
              stroke: markerStrokeColor, fill: markerFillColor, strokeWidth: markerStrokeWidth, strokeDasharray: markerStrokeDashArray, strokeOpacity: markerStrokeOpacity, fillOpacity: markerFillOpacity,
              onPointerEnter: marker.onPointerEnter, onPointerLeave: marker.onPointerLeave, onClick: marker.onClick };
            markers.push(marker);
          }
        }
      }
      this.setPresent(true);
      this.root.set({ className: mochartCssClasses['seriesMarkers'] });
      this.markers.sync(markers, markerAdapter);
    }
    else {
      this.setPresent(false);
    }
  }
}
