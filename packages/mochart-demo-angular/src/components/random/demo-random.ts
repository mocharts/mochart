import { Component, Input, signal } from '@angular/core';
import type { OnChanges, OnInit, SimpleChanges } from '@angular/core';

import { buildMochartDemoConfig, demoText } from '@mochart/demo-common';
import type { DemoTab } from '@mochart/demo-common';

import { RandomContent } from './random-content';
import { DemoTabs } from '../misc/demo-tabs';
import { TopBar } from '../misc/top-bar';

import type { DemoData, MochartDemoConfig, RandomConfigWithValid, SwitchableDemoMode } from '../../types';

const eventKeyChart = 1;
const eventKeyConfig = 2;
const eventKeyData = 3;

@Component({
  selector: 'app-demo-random',
  imports: [DemoTabs, RandomContent, TopBar],
  styles: [':host { display: contents; }'],
  template: `
    <div class="mochart-demo-container multi">
      <app-top-bar [siteRootUrl]="siteRootUrl" [onBackToDemos]="onBackToDemos" [hasTabs]="true"
                   [notes]="demoData.demoObjectMap[initialDemoId]"
                   [modes]="{ demoMode: 'random', onModeChanged }">
        <app-demo-tabs [tabs]="tabItems" [activeKey]="activeKey()" [onSelect]="handleSelect" />
      </app-top-bar>
      <div class="mochart-demo-content-pane">
        <app-random-content [mochartDemoConfig]="mochartDemoConfig()!" [initialRandomConfig]="randomConfig()!"
                            [generator]="generator()" [activeKey]="activeKey()" [eventKeys]="eventKeys"
                            [randomId]="randomId" [incrementRandomId]="incrementRandomId" [decrementRandomId]="decrementRandomId" />
      </div>
    </div>
  `
})
export class DemoRandom implements OnInit, OnChanges {
  @Input({ required: true }) demoData!: DemoData;
  @Input({ required: true }) initialDemoId!: string;
  @Input() siteRootUrl?: string;
  @Input({ required: true }) onModeChanged!: (nextDemoMode: SwitchableDemoMode) => void;
  @Input({ required: true }) onBackToDemos!: () => void;
  @Input({ required: true }) randomId!: number;
  @Input({ required: true }) incrementRandomId!: () => void;
  @Input({ required: true }) decrementRandomId!: () => void;

  readonly text = demoText.tabs;

  readonly eventKeys = { eventKeyChart, eventKeyConfig, eventKeyData };

  activeKey = signal(eventKeyChart);
  mochartDemoConfig = signal<MochartDemoConfig | null>(null);
  randomConfig = signal<RandomConfigWithValid | null>(null);
  generator = signal<string | undefined>(undefined);

  private buildStateForDemo(demoId: string): { mochartDemoConfig: MochartDemoConfig; randomConfig: RandomConfigWithValid; generator?: string } {
    const demo = this.demoData.demoObjectMap[demoId];
    return {
      mochartDemoConfig: buildMochartDemoConfig(demo.config),
      randomConfig: Object.assign({}, demo.random, { valid: true }),
      generator: demo.generator
    };
  }

  ngOnInit(): void {
    const initialState = this.buildStateForDemo(this.initialDemoId);
    this.mochartDemoConfig.set(initialState.mochartDemoConfig);
    this.randomConfig.set(initialState.randomConfig);
    this.generator.set(initialState.generator);
  }

  // When the routed demo changes, rebuild the generator state (RandomContent
  // distinguishes a demo change from a randomId step via its own inputs).
  ngOnChanges(changes: SimpleChanges): void {
    const initialDemoIdChange = changes['initialDemoId'];
    if (!initialDemoIdChange || initialDemoIdChange.firstChange) {
      return;
    }
    const nextState = this.buildStateForDemo(this.initialDemoId);
    this.activeKey.set(eventKeyChart);
    this.mochartDemoConfig.set(nextState.mochartDemoConfig);
    this.randomConfig.set(nextState.randomConfig);
    this.generator.set(nextState.generator);
  }

  get tabItems(): DemoTab[] {
    return [
      { name: 'chart', key: this.eventKeys.eventKeyChart, label: this.text.chart },
      { name: 'config', key: this.eventKeys.eventKeyConfig, label: this.text.randomConfig },
      { name: 'data', key: this.eventKeys.eventKeyData, label: this.text.data }
    ];
  }

  handleSelect = (nextActiveKey: number): void => {
    this.activeKey.set(nextActiveKey);
  };
}
