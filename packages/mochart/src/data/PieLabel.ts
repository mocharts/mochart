import { format } from 'd3-format';

import {
  AUTO,
  PIE_LABEL_TYPE_VALUE, PIE_LABEL_TYPE_PERCENT, PIE_LABEL_TYPE_TITLE,
  PIE_LABEL_TYPE_VALUE_PERCENT, PIE_LABEL_TYPE_PERCENT_VALUE,
  PIE_LABEL_TYPE_TITLE_VALUE, PIE_LABEL_TYPE_TITLE_PERCENT
} from '../config/core/constants';

import type { PieLabelType } from '../config/core/constants';
import type { PieConfig } from '../types/config';

// Auto formats: whole percents and SI-abbreviated values for slice labels (little room there),
// one decimal for tooltip percents, which have the room and are read for comparison.
const AUTO_LABEL_VALUE_FORMAT = '~s';
const AUTO_LABEL_PERCENT_FORMAT = '.0%';
const AUTO_TOOLTIP_PERCENT_FORMAT = '.1%';

type NumberFormat = (value: number) => string;

/** The pieces a pie label type can compose, each already formatted. */
export interface PieLabelParts {
  title: string;
  value: string;
  percent: string;
}

/**
 * The single place the label/tooltip separators live: each label type is a
 * template over the `<title>`, `<value>` and `<percent>` tokens. Slice labels
 * and pie tooltip values both render through it, so a type can never mean two
 * different things in the two places.
 */
const PIE_LABEL_TEMPLATES: Record<PieLabelType, string> = {
  [PIE_LABEL_TYPE_VALUE]: '<value>',
  [PIE_LABEL_TYPE_PERCENT]: '<percent>',
  [PIE_LABEL_TYPE_TITLE]: '<title>',
  [PIE_LABEL_TYPE_VALUE_PERCENT]: '<value> (<percent>)',
  [PIE_LABEL_TYPE_PERCENT_VALUE]: '<percent> (<value>)',
  [PIE_LABEL_TYPE_TITLE_VALUE]: '<title>: <value>',
  [PIE_LABEL_TYPE_TITLE_PERCENT]: '<title>: <percent>'
};

const PIE_LABEL_TOKENS = /<(title|value|percent)>/g;

/** The template for a label type, e.g. '<value> (<percent>)'. */
export function getPieLabelTemplate(labelType: PieLabelType): string {
  return PIE_LABEL_TEMPLATES[labelType] ?? PIE_LABEL_TEMPLATES[PIE_LABEL_TYPE_VALUE];
}

/** Whether a label type shows the slice's percentage (so a fraction is needed). */
export function pieLabelTypeUsesPercent(labelType: PieLabelType): boolean {
  return getPieLabelTemplate(labelType).indexOf('<percent>') !== -1;
}

/** Substitutes the formatted parts into a label type's template. */
export function formatPieLabelType(labelType: PieLabelType, parts: PieLabelParts): string {
  return getPieLabelTemplate(labelType).replace(PIE_LABEL_TOKENS, (_token, name: keyof PieLabelParts) => parts[name]);
}

export interface PieLabelFormats {
  valueFormat: NumberFormat;
  percentFormat: NumberFormat;
  tooltipPercentFormat: NumberFormat;
}

// compiled once per pie config: every slice reads these on every animation frame, and so does the open tooltip
const pieLabelFormatsByConfig = new WeakMap<PieConfig, PieLabelFormats>();

/** The slice label formatters plus the tooltip's, resolving auto per token. */
export function getPieLabelFormats(pieConfig: PieConfig): PieLabelFormats {
  let formats = pieLabelFormatsByConfig.get(pieConfig);
  if (formats === undefined) {
    formats = {
      valueFormat: format(pieConfig.label.valueFormat === AUTO ? AUTO_LABEL_VALUE_FORMAT : pieConfig.label.valueFormat),
      percentFormat: format(pieConfig.label.percentFormat === AUTO ? AUTO_LABEL_PERCENT_FORMAT : pieConfig.label.percentFormat),
      tooltipPercentFormat: format(pieConfig.tooltip.percentFormat === AUTO ? AUTO_TOOLTIP_PERCENT_FORMAT : pieConfig.tooltip.percentFormat)
    };
    pieLabelFormatsByConfig.set(pieConfig, formats);
  }
  return formats;
}

/**
 * The tooltip percent formatter, resolving auto. The tooltip's value part is
 * formatted by the series (valueFormat, valuePrefix, valueSuffix) instead, so
 * there is no tooltipValueFormat to resolve here.
 */
export function getPieTooltipPercentFormat(pieConfig: PieConfig): NumberFormat {
  return getPieLabelFormats(pieConfig).tooltipPercentFormat;
}
