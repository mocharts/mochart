import { Component, Input, signal } from '@angular/core';
import type { OnChanges, OnInit, SimpleChanges } from '@angular/core';

import { getDataErrors } from '@mochart/core';

import { RandomChartTab } from './random-chart-tab';
import { RandomConfigTab } from './random-config-tab';
import { RandomDataTab } from './random-data-tab';
import { ErrorTab } from '../misc/error-tab';

import { consumeShareState, createErrorDataProvider, demoText, generateDemoDataProvider, getRandomDataObjects, neutralizeRandomReuse, restoreSharedRandomConfig } from '@mochart/demo-common';

import type { MochartDemoConfig, RandomConfigWithValid, DemoDataProvider } from '../../types';

interface EventKeys {
  eventKeyChart: number;
  eventKeyConfig: number;
  eventKeyData: number;
}

@Component({
  selector: 'app-random-content',
  imports: [RandomChartTab, RandomConfigTab, RandomDataTab, ErrorTab],
  styles: [':host { display: contents; }'],
  template: `
    <div class="mochart-demo-content">
      <app-error-tab [active]="activeKey === eventKeys.eventKeyChart">
        <ng-template>
          <app-random-chart-tab [active]="activeKey === eventKeys.eventKeyChart" [mochartConfig]="mochartDemoConfig.mochartConfig" [dataProvider]="dataProvider()"
                                [randomConfig]="randomConfig()!" [initialRate]="initialRate()"
                                [onRandomizeBack]="onRandomizeBack" [onRandomizeNext]="onRandomizeNext"
                                [applyReuse]="applyReuse()" [toggleApplyReuse]="toggleApplyReuse" />
        </ng-template>
      </app-error-tab>
      <app-error-tab [active]="activeKey === eventKeys.eventKeyConfig">
        <ng-template>
          <app-random-config-tab [active]="activeKey === eventKeys.eventKeyConfig" [randomConfig]="randomConfig()!" [generator]="generator" [onUpdate]="onUpdateConfig" [onReset]="onResetConfig" />
        </ng-template>
      </app-error-tab>
      <app-error-tab [active]="activeKey === eventKeys.eventKeyData">
        <ng-template>
          <app-random-data-tab [active]="activeKey === eventKeys.eventKeyData" [data]="data()" />
        </ng-template>
      </app-error-tab>
    </div>
  `
})
export class RandomContent implements OnInit, OnChanges {
  @Input({ required: true }) mochartDemoConfig!: MochartDemoConfig;
  @Input({ required: true }) initialRandomConfig!: RandomConfigWithValid;
  /** The demo's chart-type generator id, if it has one (demos.json). */
  @Input() generator?: string;
  @Input({ required: true }) activeKey!: number;
  @Input({ required: true }) eventKeys!: EventKeys;
  @Input({ required: true }) randomId!: number;
  @Input({ required: true }) incrementRandomId!: () => void;
  @Input({ required: true }) decrementRandomId!: () => void;

  randomConfig = signal<RandomConfigWithValid | null>(null);
  dataProvider = signal<DemoDataProvider | null>(null);
  data = signal<unknown>(null);
  // Reuse defaults on to match the generator's historical behavior (the
  // config's reuse settings were always applied before the toggle worked).
  applyReuse = signal(true);
  // A share link restores the interval (the step comes from the randomId in
  // the URL path); undefined leaves the chart tab on its default rate.
  initialRate = signal<number | undefined>(undefined);

  ngOnInit(): void {
    // A share link restores the generator config, reuse toggle and interval;
    // consume it once at mount, else fall back to the demo's own config.
    const shared = consumeShareState('random');
    const initialShared = shared !== null && shared.mode === 'random' ? shared : null;
    if (initialShared) {
      this.applyReuse.set(initialShared.applyReuse);
      this.initialRate.set(initialShared.interval);
      const restored: RandomConfigWithValid = restoreSharedRandomConfig(initialShared.randomConfig, this.generator);
      this.randomConfig.set(restored);
      this.updateDataProvider(restored);
    }
    else {
      this.randomConfig.set(this.initialRandomConfig);
      this.updateDataProvider(this.initialRandomConfig);
    }
  }

  toggleApplyReuse = (): void => {
    this.applyReuse.update(applyReuse => !applyReuse);
    this.updateDataProvider();
  };

  private updateDataProvider(forcedRandomConfig?: RandomConfigWithValid): void {
    const { mochartConfig } = this.mochartDemoConfig;
    const nextRandomConfig = forcedRandomConfig !== undefined ? forcedRandomConfig : this.randomConfig()!;

    if (nextRandomConfig.valid) {
      // with reuse off the generator gets a config whose reuse settings are
      // neutralized, so every dataset is generated independently
      const generatorConfig = this.applyReuse() ? nextRandomConfig : neutralizeRandomReuse(nextRandomConfig);
      const nextDataProvider = generateDemoDataProvider(this.generator, mochartConfig, generatorConfig, this.randomId);
      const { categoryValues = [], seriesValues = {} } = nextDataProvider;
      const nextData = getRandomDataObjects(mochartConfig, categoryValues, seriesValues);
      const dataErrors = getDataErrors(mochartConfig, nextDataProvider);
      if (dataErrors.length > 0) {
        console.error('data errors: ', dataErrors);
        console.warn('category values: ', categoryValues);
        console.warn('series values: ', seriesValues);
        this.dataProvider.set(createErrorDataProvider(demoText.errors.creatingDataProvider));
        this.data.set({ error: demoText.errors.creatingDataProvider });
        this.randomConfig.set(nextRandomConfig);
      }
      else {
        this.dataProvider.set(nextDataProvider);
        this.data.set(nextData);
        this.randomConfig.set(nextRandomConfig);
      }
    }
    else {
      this.dataProvider.set(createErrorDataProvider(demoText.errors.invalidRandomConfig));
      this.data.set({
        error: demoText.errors.invalidRandomConfig
      });
      this.randomConfig.set(nextRandomConfig);
    }
  }

  // A change to the generator inputs is a demo change (regenerate from the
  // demo's initial config); a randomId change alone is a randomize step.
  ngOnChanges(changes: SimpleChanges): void {
    if (Object.values(changes).some(change => change.firstChange)) {
      return;
    }
    if (changes['initialRandomConfig'] || changes['mochartDemoConfig']) {
      this.updateDataProvider(this.initialRandomConfig);
    }
    else if (changes['randomId']) {
      this.updateDataProvider();
    }
  }

  onRandomizeBack = (): void => {
    this.decrementRandomId();
  };

  onRandomizeNext = (): void => {
    this.incrementRandomId();
  };

  // Regenerate immediately so Apply/Reset on the Random Config tab visibly
  // take effect instead of waiting for the next randomize.
  onUpdateConfig = (nextRandomConfig: RandomConfigWithValid): void => {
    this.updateDataProvider(nextRandomConfig);
  };

  onResetConfig = (): void => {
    this.updateDataProvider(this.initialRandomConfig);
  };
}
