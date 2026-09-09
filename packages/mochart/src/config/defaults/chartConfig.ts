import { CHART_TYPE_XY, NONE, COLOR_CURRENT } from '../core/constants';

// Background rects switch their stroke off with strokeOpacity 0, not by leaving the color unset, so a
// config that turns the border back on with opacity alone gets the host page's color in every section.

export default function getDefaults() {
  return {
    type: CHART_TYPE_XY,
    margin: { top: 2, right: 2, bottom: 2, left: 2 },
    padding: { top: 3, right: 3, bottom: 3, left: 3 },
    backgroundStyle: { strokeColor: COLOR_CURRENT, strokeOpacity: 0, strokeWidth: NONE, strokeDashArray: NONE, fillColor: NONE, fillOpacity: 0 }
  };
}
