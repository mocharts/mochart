import { html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import { defaultChart } from '@mochart/lit';

import { demoText, inlineSparklineMetrics, tableSparklineMetrics } from '@mochart/demo-common';
import type { SparklineMetric } from '@mochart/demo-common';

import { LightElement } from '../misc/LightElement';
import { buttonWithTooltip, icon } from '../misc/templates';
import '../misc/top-bar';

const text = demoText.sparklinePage;

@customElement('demo-sparkline')
export class DemoSparkline extends LightElement {
  @property({ attribute: false }) siteRootUrl: string | undefined = undefined;
  @property({ attribute: false }) onBackToDemos!: () => void;

  // Each Randomize click bumps the step; every chart's data (and each table
  // row's latest text) derives from it, so a re-render regenerates them all
  // and the binding's directive updates each mounted chart in place.
  @state() private step = 0;

  private onRandomize = (): void => {
    this.step++;
  };

  // Charts mount at the metric's explicit word/cell size, never auto-sized.
  private renderMetricChart(metric: SparklineMetric, data: ReturnType<SparklineMetric['generate']>): unknown {
    return defaultChart({ config: metric.config, data, width: metric.width, height: metric.height });
  }

  private renderIntro(): unknown {
    return html`<p class="sparkline-intro">${text.intro.map((segment, i) => {
      const metric = inlineSparklineMetrics[i];
      return html`${segment}${metric !== undefined
        ? html`<span class="sparkline-inline">${this.renderMetricChart(metric, metric.generate(this.step))}</span>`
        : nothing}`;
    })}</p>`;
  }

  private renderTableRow(metric: SparklineMetric): unknown {
    const data = metric.generate(this.step);
    return html`<tr>
      <td>${metric.label}</td>
      <td class="sparkline-value">${metric.latestText(data)}</td>
      <td class="sparkline-cell">${this.renderMetricChart(metric, data)}</td>
    </tr>`;
  }

  override render(): unknown {
    return html`<div class="mochart-demo-container">
      <top-bar .siteRootUrl=${this.siteRootUrl} .onBackToDemos=${this.onBackToDemos}></top-bar>
      <div class="sparkline-page">
        ${this.renderIntro()}
        <div class="sparkline-controls">
          ${buttonWithTooltip(
            { id: 'sparkline-randomize', label: text.randomize.label, tooltipText: text.randomize.tooltip, ariaLabel: text.randomize.aria, color: 'primary', onClick: this.onRandomize },
            icon({ fixedWidth: true, name: 'dice' })
          )}
        </div>
        <table class="sparkline-table">
          <thead>
            <tr>
              <th>${text.table.metric}</th>
              <th>${text.table.latest}</th>
              <th>${text.table.trend}</th>
            </tr>
          </thead>
          <tbody>
            ${tableSparklineMetrics.map(metric => this.renderTableRow(metric))}
          </tbody>
        </table>
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'demo-sparkline': DemoSparkline;
  }
}
