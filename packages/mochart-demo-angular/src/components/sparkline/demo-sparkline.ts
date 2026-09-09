import { Component, Input, computed, signal } from '@angular/core';

import { DefaultChart } from '@mochart/angular';

import { demoText, inlineSparklineMetrics, tableSparklineMetrics } from '@mochart/demo-common';
import type { DataObject, SparklineMetric } from '@mochart/demo-common';

import { ButtonWithTooltip } from '../misc/button-with-tooltip';
import { Icon } from '../misc/icon';
import { TopBar } from '../misc/top-bar';

interface TableRow {
  metric: SparklineMetric;
  data: DataObject[];
  latest: string;
}

/**
 * The sparkline showcase page: the intro paragraph with word-sized charts
 * woven between the demoText.sparklinePage.intro segments, then the
 * small-multiples metrics table. Every chart mounts at the metric's explicit
 * width/height (no element sizing); Randomize bumps the step signal and the
 * computed datasets (and each row's latest text) follow.
 */
@Component({
  selector: 'app-demo-sparkline',
  imports: [DefaultChart, ButtonWithTooltip, Icon, TopBar],
  styles: [':host { display: contents; }'],
  template: `
    <div class="mochart-demo-container">
      <app-top-bar [siteRootUrl]="siteRootUrl" [onBackToDemos]="onBackToDemos" />
      <div class="sparkline-page">
        <p class="sparkline-intro">@for (segment of text.intro; track $index) {{{ segment }}@if (inlineMetrics[$index]; as metric) {<span class="sparkline-inline"><mochart-default-chart [config]="metric.config" [data]="inlineData()[$index]" [width]="metric.width" [height]="metric.height" /></span>}}</p>
        <div class="sparkline-controls">
          <app-button-with-tooltip id="sparkline-randomize" color="primary" [label]="text.randomize.label"
                                   [tooltipText]="text.randomize.tooltip" tooltipPlacement="top-start"
                                   [onClick]="onRandomize" [aria-label]="text.randomize.aria">
            <app-icon [fixedWidth]="true" name="dice" />
          </app-button-with-tooltip>
        </div>
        <table class="sparkline-table">
          <thead>
            <tr>
              <th>{{ text.table.metric }}</th>
              <th>{{ text.table.latest }}</th>
              <th>{{ text.table.trend }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of tableRows(); track row.metric.id) {
              <tr>
                <td>{{ row.metric.label }}</td>
                <td class="sparkline-value">{{ row.latest }}</td>
                <td class="sparkline-cell">
                  <mochart-default-chart [config]="row.metric.config" [data]="row.data"
                                         [width]="row.metric.width" [height]="row.metric.height" />
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `
})
export class DemoSparkline {
  @Input() siteRootUrl?: string;
  @Input({ required: true }) onBackToDemos!: () => void;

  readonly text = demoText.sparklinePage;
  readonly inlineMetrics = inlineSparklineMetrics;

  readonly step = signal(0);

  readonly inlineData = computed<DataObject[][]>(() => {
    const step = this.step();
    return this.inlineMetrics.map(metric => metric.generate(step));
  });

  readonly tableRows = computed<TableRow[]>(() => {
    const step = this.step();
    return tableSparklineMetrics.map(metric => {
      const data = metric.generate(step);
      return { metric, data, latest: metric.latestText(data) };
    });
  });

  onRandomize = (): void => {
    this.step.update(step => step + 1);
  };
}
