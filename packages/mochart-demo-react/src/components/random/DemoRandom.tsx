import { useState, useRef } from 'react';

import { getDataErrors } from '@mochart/core';

import { buildMochartDemoConfig, consumeShareState, createErrorDataProvider, demoText, generateDemoDataProvider, getRandomDataObjects, neutralizeRandomReuse, restoreSharedRandomConfig } from '@mochart/demo-common';
import type { ShareState } from '@mochart/demo-common';

import RandomMochartChartTab from './RandomChartTab';
import RandomMochartConfigTab from './RandomConfigTab';
import RandomMochartDataTab from './RandomDataTab';
import DemoTabs from '../misc/DemoTabs';
import ErrorTab from '../misc/ErrorTab';
import TopBar from '../misc/TopBar';

import type {
  DemoData, DemoTabProps, MochartDemoConfig, RandomConfigWithValid, DemoDataProvider
} from '../../types';

const eventKeyChart = 1;
const eventKeyConfig = 2;
const eventKeyData = 3;

interface RandomDemoProps extends DemoTabProps {
  randomId: number;
  incrementRandomId: () => void;
  decrementRandomId: () => void;
}

interface RandomState {
  demoId: string;
  activeKey: number;
  mochartDemoConfig: MochartDemoConfig;
  randomConfig: RandomConfigWithValid;
  /** The demo's chart-type generator id, if it has one (demos.json). */
  generator?: string;
}

function buildState(demoData: DemoData, initialDemoId: string): RandomState {
  const demo = demoData.demoObjectMap[initialDemoId];
  return {
    demoId: initialDemoId,
    activeKey: eventKeyChart,
    mochartDemoConfig: buildMochartDemoConfig(demo.config),
    randomConfig: Object.assign({}, demo.random, { valid: true }),
    generator: demo.generator
  };
}

export default function MochartDemoRandom(props: RandomDemoProps) {
  const { demoData, initialDemoId, siteRootUrl, onModeChanged, onBackToDemos, randomId, incrementRandomId, decrementRandomId } = props;

  const [state, setState] = useState<RandomState>(() => buildState(demoData, initialDemoId));

  // Reload the demo's config and reset the active tab when the routed demo
  // changes; a randomId-only change is handled inside the content component.
  const prevInitialDemoId = useRef(initialDemoId);
  if (prevInitialDemoId.current !== initialDemoId) {
    prevInitialDemoId.current = initialDemoId;
    setState(buildState(demoData, initialDemoId));
  }

  const handleSelect = (activeKey: number) => setState(prev => ({ ...prev, activeKey }));

  const { activeKey, mochartDemoConfig, randomConfig, generator } = state;

  return (
    <div className="mochart-demo-container multi">
      <TopBar siteRootUrl={siteRootUrl} onBackToDemos={onBackToDemos}
        notes={demoData.demoObjectMap[initialDemoId]}
        modes={{ demoMode: 'random', onModeChanged }}
        tabs={
          <DemoTabs activeKey={activeKey} onSelect={handleSelect}
            tabs={[
              { name: 'chart', key: eventKeyChart, label: demoText.tabs.chart },
              { name: 'config', key: eventKeyConfig, label: demoText.tabs.randomConfig },
              { name: 'data', key: eventKeyData, label: demoText.tabs.data }
            ]} />
        } />
      <div className="mochart-demo-content-pane">
        <RandomMochartDemoContent mochartDemoConfig={mochartDemoConfig} initialRandomConfig={randomConfig}
          generator={generator} initialDemoId={initialDemoId} activeKey={activeKey}
          randomId={randomId} incrementRandomId={incrementRandomId} decrementRandomId={decrementRandomId} />
      </div>
    </div>
  );
}

interface ContentProps {
  mochartDemoConfig: MochartDemoConfig;
  initialRandomConfig: RandomConfigWithValid;
  /** The demo's chart-type generator id, if it has one (demos.json). */
  generator?: string;
  initialDemoId: string;
  activeKey: number;
  randomId: number;
  incrementRandomId: () => void;
  decrementRandomId: () => void;
}

interface ContentState {
  randomConfig: RandomConfigWithValid;
  dataProvider: DemoDataProvider;
  data: unknown;
  applyReuse: boolean;
}

function computeProviderState(mochartDemoConfig: MochartDemoConfig, randomId: number, randomConfig: RandomConfigWithValid, applyReuse: boolean, generator: string | undefined): Pick<ContentState, 'dataProvider' | 'data' | 'randomConfig'> {
  const { mochartConfig } = mochartDemoConfig;
  if (randomConfig.valid) {
    // with reuse off the generator gets a config whose reuse settings are
    // neutralized, so every dataset is generated independently
    const generatorConfig = applyReuse ? randomConfig : neutralizeRandomReuse(randomConfig);
    const dataProvider = generateDemoDataProvider(generator, mochartConfig, generatorConfig, randomId);
    const { categoryValues = [], seriesValues = {} } = dataProvider;
    const data = getRandomDataObjects(mochartConfig, categoryValues, seriesValues);
    const dataErrors = getDataErrors(mochartConfig, dataProvider);
    if (dataErrors.length > 0) {
      console.error('data errors: ', dataErrors);
      console.warn('category values: ', categoryValues);
      console.warn('series values: ', seriesValues);
      return {
        dataProvider: createErrorDataProvider(demoText.errors.creatingDataProvider),
        data: { error: demoText.errors.creatingDataProvider },
        randomConfig
      };
    }
    else {
      return { dataProvider, data, randomConfig };
    }
  }
  else {
    return {
      dataProvider: createErrorDataProvider(demoText.errors.invalidRandomConfig),
      data: { error: demoText.errors.invalidRandomConfig },
      randomConfig
    };
  }
}

function RandomMochartDemoContent(props: ContentProps) {
  const { initialDemoId, mochartDemoConfig, initialRandomConfig, generator, activeKey, randomId, incrementRandomId, decrementRandomId } = props;

  // A share link restores the generator config, reuse toggle and interval (the
  // step comes from the randomId in the URL path). Consume it once at mount.
  const initialSharedRef = useRef<ShareState | null | undefined>(undefined);
  if (initialSharedRef.current === undefined) {
    initialSharedRef.current = consumeShareState('random');
  }
  const initialShared = initialSharedRef.current && initialSharedRef.current.mode === 'random' ? initialSharedRef.current : null;

  const [state, setState] = useState<ContentState>(() => {
    // Reuse defaults on to match the generator's historical behavior.
    const applyReuse = initialShared ? initialShared.applyReuse : true;
    const randomConfig: RandomConfigWithValid = initialShared ? restoreSharedRandomConfig(initialShared.randomConfig, generator) : initialRandomConfig;
    return { applyReuse, ...computeProviderState(mochartDemoConfig, randomId, randomConfig, applyReuse, generator) };
  });

  // Regenerate the data provider when the demo/config/randomId changes. A demo
  // change rebuilds from the demo's own random config; a randomId-only change
  // keeps any edited config from the Random Config tab.
  const prev = useRef({ initialDemoId, initialRandomConfig, mochartDemoConfig, randomId });
  {
    const p = prev.current;
    if (p.initialDemoId !== initialDemoId || p.initialRandomConfig !== initialRandomConfig || p.mochartDemoConfig !== mochartDemoConfig || p.randomId !== randomId) {
      prev.current = { initialDemoId, initialRandomConfig, mochartDemoConfig, randomId };
      if (initialDemoId !== p.initialDemoId || initialRandomConfig !== p.initialRandomConfig || mochartDemoConfig !== p.mochartDemoConfig) {
        setState(s => ({ ...s, ...computeProviderState(mochartDemoConfig, randomId, initialRandomConfig, s.applyReuse, generator) }));
      }
      else if (randomId !== p.randomId) {
        setState(s => ({ ...s, ...computeProviderState(mochartDemoConfig, randomId, s.randomConfig, s.applyReuse, generator) }));
      }
    }
  }

  // Toggling reuse regenerates immediately so the effect is visible.
  const toggleApplyReuse = () => setState(prevState => {
    const applyReuse = !prevState.applyReuse;
    return { ...prevState, applyReuse, ...computeProviderState(mochartDemoConfig, randomId, prevState.randomConfig, applyReuse, generator) };
  });

  const onRandomizeBack = () => decrementRandomId();
  const onRandomizeNext = () => incrementRandomId();

  // Regenerate immediately so Apply/Reset on the Random Config tab visibly
  // take effect instead of waiting for the next randomize.
  const onUpdateConfig = (randomConfig: RandomConfigWithValid) => setState(prevState =>
    ({ ...prevState, ...computeProviderState(mochartDemoConfig, randomId, randomConfig, prevState.applyReuse, generator) }));

  const onResetConfig = () => setState(prevState =>
    ({ ...prevState, ...computeProviderState(mochartDemoConfig, randomId, initialRandomConfig, prevState.applyReuse, generator) }));

  const { randomConfig, dataProvider, data, applyReuse } = state;
  const { mochartConfig } = mochartDemoConfig;

  return (
    <div className="mochart-demo-content">
      <ErrorTab active={activeKey === eventKeyChart}>
        <RandomMochartChartTab mochartConfig={mochartConfig} dataProvider={dataProvider}
          randomConfig={randomConfig} initialRate={initialShared ? initialShared.interval : undefined}
          onRandomizeBack={onRandomizeBack} onRandomizeNext={onRandomizeNext}
          applyReuse={applyReuse} toggleApplyReuse={toggleApplyReuse} />
      </ErrorTab>
      <ErrorTab active={activeKey === eventKeyConfig}>
        <RandomMochartConfigTab randomConfig={randomConfig} generator={generator} onUpdate={onUpdateConfig} onReset={onResetConfig} />
      </ErrorTab>
      <ErrorTab active={activeKey === eventKeyData}>
        <RandomMochartDataTab data={data} />
      </ErrorTab>
    </div>
  );
}
