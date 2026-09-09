import validators from './validators';

export default function getValidators() {
  return {
    enabled: validators.boolean(),
    hidden: validators.boolean(),
    respectReducedMotion: validators.boolean(),
    minTargetSize: validators.numberMin(0),
    chartLabel: validators.string(),
    chartRoleDescription: validators.string(),
    plotLabel: validators.string(),
    seriesLabel: validators.string(),
    categoryAxisLabel: validators.string(),
    valueAxisLabel: validators.string(),
    legendLabel: validators.string(),
    tooltipLabel: validators.string(),
    tooltipPreviousLabel: validators.string(),
    tooltipNextLabel: validators.string()
  };
}
