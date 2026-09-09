import { AUTO, COLOR_CURRENT } from '../core/constants';

// The SeriesIconConfig members, the `icon` group of the legend and tooltip regular defaults.
export function getRegularDefaults() {
  return {
    showColors: true,
    showShapes: true,
    showPlaceholders: true,
    size: AUTO,
    spacing: 4,
    // The two filter colors stay literal: they carry their own alpha, which 'currentColor' cannot.
    borderStyle: { strokeColor: COLOR_CURRENT, strokeOpacity: 0.65, strokeWidth: 1 },
    filteredColor: 'rgba(255,255,255,0)',
    unfilteredColor: 'rgba(0,0,0,0.5)'
  };
}
