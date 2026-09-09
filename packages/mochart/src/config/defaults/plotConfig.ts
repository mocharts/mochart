import { NONE, COLOR_CURRENT } from '../core/constants';

export default function getDefaults() {
  return {
    inverted: false,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
    clipOverflow: { top: 0, right: 0, bottom: 0, left: 0 },
    backgroundStyle: { strokeColor: COLOR_CURRENT, strokeOpacity: 0, strokeWidth: NONE, strokeDashArray: NONE, fillColor: NONE, fillOpacity: 0 }
  };
}