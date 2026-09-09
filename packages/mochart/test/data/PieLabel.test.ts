import { describe, it, expect } from 'vitest';
import {
  formatPieLabelType, getPieLabelTemplate, pieLabelTypeUsesPercent,
  getPieLabelFormats, getPieTooltipPercentFormat
} from '../../src/data/PieLabel';
import { PIE_LABEL_TYPES, PIE_TOOLTIP_VALUE_TYPES } from '../../src/config/core/constants';
import type { PieConfig } from '../../src/types/config';

const parts = { title: 'Chrome', value: '62', percent: '62%' };

describe('formatPieLabelType', () => {
  it('renders every label type', () => {
    expect(formatPieLabelType('value', parts)).toBe('62');
    expect(formatPieLabelType('percent', parts)).toBe('62%');
    expect(formatPieLabelType('title', parts)).toBe('Chrome');
    expect(formatPieLabelType('valuePercent', parts)).toBe('62 (62%)');
    expect(formatPieLabelType('percentValue', parts)).toBe('62% (62)');
    expect(formatPieLabelType('titleValue', parts)).toBe('Chrome: 62');
    expect(formatPieLabelType('titlePercent', parts)).toBe('Chrome: 62%');
  });

  it('has a template for every configurable label type', () => {
    for (const labelType of PIE_LABEL_TYPES) {
      expect(getPieLabelTemplate(labelType)).toMatch(/^<(title|value|percent)>/);
    }
  });

  it('keeps the tooltip types a subset of the label types', () => {
    for (const tooltipType of PIE_TOOLTIP_VALUE_TYPES) {
      expect(PIE_LABEL_TYPES).toContain(tooltipType);
    }
    // the title-bearing types stay out of the tooltip: a row already shows the
    // series title as its label
    expect(PIE_TOOLTIP_VALUE_TYPES).not.toContain('title');
    expect(PIE_TOOLTIP_VALUE_TYPES).not.toContain('titleValue');
    expect(PIE_TOOLTIP_VALUE_TYPES).not.toContain('titlePercent');
  });

  it('reports which types need a fraction', () => {
    expect(pieLabelTypeUsesPercent('percent')).toBe(true);
    expect(pieLabelTypeUsesPercent('valuePercent')).toBe(true);
    expect(pieLabelTypeUsesPercent('titlePercent')).toBe(true);
    expect(pieLabelTypeUsesPercent('value')).toBe(false);
    expect(pieLabelTypeUsesPercent('title')).toBe(false);
    expect(pieLabelTypeUsesPercent('titleValue')).toBe(false);
  });
});

describe('pie label formats', () => {
  const pieConfig = (over: { tooltip?: PieConfig['tooltip']; label?: Partial<PieConfig['label']> } = {}): PieConfig => ({
    tooltip: { percentFormat: 'auto' }, ...over,
    label: { valueFormat: 'auto', percentFormat: 'auto', ...over.label }
  } as PieConfig);

  it('resolves auto to abbreviated values and whole percents for labels', () => {
    const { valueFormat, percentFormat } = getPieLabelFormats(pieConfig());
    expect(valueFormat(12400)).toBe('12.4k');
    expect(percentFormat(0.625)).toBe('63%');
  });

  it('resolves auto to one decimal for tooltip percents', () => {
    expect(getPieTooltipPercentFormat(pieConfig())(0.625)).toBe('62.5%');
  });

  it('honors explicit specifiers per part', () => {
    const { valueFormat, percentFormat } = getPieLabelFormats(pieConfig({ label: { valueFormat: ',.0f', percentFormat: '.2%' } }));
    expect(valueFormat(12400)).toBe('12,400');
    expect(percentFormat(0.625)).toBe('62.50%');
    expect(getPieTooltipPercentFormat(pieConfig({ tooltip: { valueType: 'value', percentFormat: '.0%' } }))(0.625)).toBe('63%');
  });
});
