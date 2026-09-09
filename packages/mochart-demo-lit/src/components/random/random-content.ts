import { html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { PropertyValues } from 'lit';

import { getDataErrors } from '@mochart/core';

import { LightElement } from '../misc/LightElement';
import './random-chart-tab';
import './random-config-tab';
import './random-data-tab';
import '../misc/error-tab';

import { consumeShareState, createErrorDataProvider, demoText, generateDemoDataProvider, getRandomDataObjects, neutralizeRandomReuse, restoreSharedRandomConfig } from '@mochart/demo-common';

import type { MochartDemoConfig, RandomConfigWithValid, DemoDataProvider } from '../../types';

interface EventKeys {
  eventKeyChart: number;
  eventKeyConfig: number;
  eventKeyData: number;
}

@customElement('random-content')
export class RandomContent extends LightElement {
  @property({ attribute: false }) mochartDemoConfig!: MochartDemoConfig;
  @property({ attribute: false }) initialRandomConfig!: RandomConfigWithValid;
  @property({ attribute: false }) generator: string | undefined = undefined;
  @property({ attribute: false }) activeKey = 0;
  @property({ attribute: false }) eventKeys!: EventKeys;
  @property({ attribute: false }) randomId = 0;
  @property({ attribute: false }) incrementRandomId!: () => void;
  @property({ attribute: false }) decrementRandomId!: () => void;

  @state() private randomConfig!: RandomConfigWithValid;
  @state() private dataProvider: DemoDataProvider | null = null;
  @state() private data: unknown = null;
  // Reuse defaults on to match the generator's historical behavior (the
  // config's reuse settings were always applied before the toggle worked).
  @state() private applyReuse = true;
  // Restored from a share link (the interval seeds the chart tab's rate);
  // undefined for a normal mount, where the default rate applies.
  private initialRate: number | undefined = undefined;

  private toggleApplyReuse = (): void => {
    this.applyReuse = !this.applyReuse;
    this.updateDataProvider();
  };

  private updateDataProvider(forcedRandomConfig?: RandomConfigWithValid): void {
    const { mochartConfig } = this.mochartDemoConfig;
    const nextRandomConfig = forcedRandomConfig !== undefined ? forcedRandomConfig : this.randomConfig;

    if (nextRandomConfig.valid) {
      // with reuse off the generator gets a config whose reuse settings are
      // neutralized, so every dataset is generated independently
      const generatorConfig = this.applyReuse ? nextRandomConfig : neutralizeRandomReuse(nextRandomConfig);
      const nextDataProvider = generateDemoDataProvider(this.generator, mochartConfig, generatorConfig, this.randomId);
      const { categoryValues = [], seriesValues = {} } = nextDataProvider;
      const nextData = getRandomDataObjects(mochartConfig, categoryValues, seriesValues);
      const dataErrors = getDataErrors(mochartConfig, nextDataProvider);
      if (dataErrors.length > 0) {
        console.error('data errors: ', dataErrors);
        console.warn('category values: ', categoryValues);
        console.warn('series values: ', seriesValues);
        this.dataProvider = createErrorDataProvider(demoText.errors.creatingDataProvider);
        this.data = { error: demoText.errors.creatingDataProvider };
        this.randomConfig = nextRandomConfig;
      }
      else {
        this.dataProvider = nextDataProvider;
        this.data = nextData;
        this.randomConfig = nextRandomConfig;
      }
    }
    else {
      this.dataProvider = createErrorDataProvider(demoText.errors.invalidRandomConfig);
      this.data = {
        error: demoText.errors.invalidRandomConfig
      };
      this.randomConfig = nextRandomConfig;
    }
  }

  override willUpdate(changed: PropertyValues<this>): void {
    if (!this.hasUpdated) {
      // A share link restores the generator config, reuse toggle and interval
      // (the step comes from the randomId in the URL path). Consume it once.
      const shared = consumeShareState('random');
      const sharedRandom = shared && shared.mode === 'random' ? shared : null;
      if (sharedRandom) {
        this.applyReuse = sharedRandom.applyReuse;
        this.initialRate = sharedRandom.interval;
        const restored: RandomConfigWithValid = restoreSharedRandomConfig(sharedRandom.randomConfig, this.generator);
        this.randomConfig = restored;
        this.updateDataProvider(restored);
      }
      else {
        this.randomConfig = this.initialRandomConfig;
        this.updateDataProvider(this.initialRandomConfig);
      }
      return;
    }
    // A demo change arrives as new config objects (and resets the random
    // config); a randomId-only change regenerates from the edited config.
    if (changed.has('initialRandomConfig') || changed.has('mochartDemoConfig')) {
      this.updateDataProvider(this.initialRandomConfig);
    }
    else if (changed.has('randomId')) {
      this.updateDataProvider();
    }
  }

  private onRandomizeBack = (): void => {
    this.decrementRandomId();
  };

  private onRandomizeNext = (): void => {
    this.incrementRandomId();
  };

  // Regenerate immediately so Apply/Reset on the Random Config tab visibly
  // take effect instead of waiting for the next randomize.
  private onUpdateConfig = (nextRandomConfig: RandomConfigWithValid): void => {
    this.updateDataProvider(nextRandomConfig);
  };

  private onResetConfig = (): void => {
    this.updateDataProvider(this.initialRandomConfig);
  };

  override render(): unknown {
    const { eventKeyChart, eventKeyConfig, eventKeyData } = this.eventKeys;
    return html`<div class="mochart-demo-content">
      <error-tab .active=${this.activeKey === eventKeyChart} .content=${() =>
        html`<random-chart-tab .active=${this.activeKey === eventKeyChart} .mochartConfig=${this.mochartDemoConfig.mochartConfig} .dataProvider=${this.dataProvider}
            .randomConfig=${this.randomConfig} .initialRate=${this.initialRate}
            .onRandomizeBack=${this.onRandomizeBack} .onRandomizeNext=${this.onRandomizeNext}
            .applyReuse=${this.applyReuse} .toggleApplyReuse=${this.toggleApplyReuse}></random-chart-tab>`}></error-tab>
      <error-tab .active=${this.activeKey === eventKeyConfig} .content=${() =>
        html`<random-config-tab .active=${this.activeKey === eventKeyConfig} .randomConfig=${this.randomConfig} .generator=${this.generator} .onUpdate=${this.onUpdateConfig} .onReset=${this.onResetConfig}></random-config-tab>`}></error-tab>
      <error-tab .active=${this.activeKey === eventKeyData} .content=${() =>
        html`<random-data-tab .active=${this.activeKey === eventKeyData} .data=${this.data}></random-data-tab>`}></error-tab>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'random-content': RandomContent;
  }
}
