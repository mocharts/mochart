import validators from '@mochart/movalid';

import { ArrayOfObjectsDataProvider } from '@mochart/core';
import type { MochartConfig } from '@mochart/core';

import buildMochartDemoConfig from './mochartDemoConfig';
import { demoText } from './demoText';
import { getJsonErrorMessage, parseJson } from './json';
import { stringifyWithSpacedCommas } from './dataEditing';

import type { TransitionConfig, ChartDataProviderLike } from './types';

const objectValidator = validators.object();
const arrayValidator = validators.array();

export const defaultTransitionConfig: TransitionConfig = {
  "config": {
    "version": "1.0.0",
    "animation": {
      "initialDuration": 1000,
      "expansionDuration": 3000,
      "valueChangeDuration": 3000,
      "contractionDuration": 3000
    },
    "categoryAxis": {
      "property": "timestamp",
      "type": "string",
      "scale": "ordinal",
      "valueLabel": "Date",
      "dateUTC": false
    },
    "legend": {
      "visible": true
    },
    "valueAxes": [
      {
        "id": "VA0",
        "min": 0
      }
    ],
    "seriesStacks": [{
      "id": "SS0",
      "axis": "VA0"
    }],
    "series": [
      {
        "axis": "VA0",
        "stack": "SS0",
        "property": "count",
        "title": "Count",
        "renderer": "bar",
        "marker": { "shape": null },
        "valueFormat": ",d"
      }
    ]
  },
  "data": [
    [
      { "timestamp": "aaa", "count": 50 },
      { "timestamp": "bbb", "count": 48 },
      { "timestamp": "ccc", "count": 28 },
      { "timestamp": "ddd", "count": 27 },
      { "timestamp": "eee", "count": 25 },
      { "timestamp": "fff", "count": 22 }
    ],
    [
      { "timestamp": "ccc", "count": 45 },
      { "timestamp": "bbb", "count": 42 },
      { "timestamp": "ddd", "count": 27 },
      { "timestamp": "eee", "count": 25 },
      { "timestamp": "fff", "count": 22 },
      { "timestamp": "ggg", "count": 20 }
    ],
    [
      { "timestamp": "bbb", "count": 42 },
      { "timestamp": "ccc", "count": 45 },
      { "timestamp": "ddd", "count": 27 },
      { "timestamp": "eee", "count": 25 },
      { "timestamp": "fff", "count": 22 },
      { "timestamp": "ggg", "count": 20 }
    ]
  ]
};

export function getTransitionMochartConfig(transitionConfig: TransitionConfig): MochartConfig {
  return buildMochartDemoConfig(transitionConfig.config).mochartConfig;
}

export function getTransitionDataProviders(transitionConfig: TransitionConfig): ChartDataProviderLike[] {
  // the providers wrap the rows wholesale: every configured property is a column read
  return transitionConfig.data.map(data => new ArrayOfObjectsDataProvider(data));
}

export function formatTransitionConfig(transitionConfig: TransitionConfig): string {
  if (transitionConfig && objectValidator(transitionConfig)) {
    let configText = '{}';
    let dataText = '[]';
    if (transitionConfig.config && objectValidator(transitionConfig.config)) {
      // Raw newlines in stringify output are always structural, so re-indenting by newline is safe.
      configText = JSON.stringify(transitionConfig.config, null, 2).replace(/\n/g, '\n  ');
    }
    if (transitionConfig.data && arrayValidator(transitionConfig.data)) {
      const dataArray = transitionConfig.data;
      const dataTexts: string[] = [];
      let aDataText: string;
      for (const data of dataArray) {
        if (data && arrayValidator(data)) {
          // structural spacing keeps commas inside string values untouched
          const rowTexts = (data as unknown[]).map(row => stringifyWithSpacedCommas(row));
          aDataText = rowTexts.length === 0 ? '[]' : '[\n      ' + rowTexts.join(', \n      ') + '\n    ]';
          dataTexts.push(aDataText);
        }
      }
      dataText = '[\n    ' + dataTexts.join(',\n    ') + '\n  ]';
    }
    return '{\n' + '  "config": ' + configText + ',\n  "data": ' + dataText + '\n}';
  }
  else {
    return String(transitionConfig);
  }
}

export type TransitionConfigEditResult = { ok: true; config: TransitionConfig } | { ok: false; errorMessage: string };

/** Parse + validate a transition-config edit for Apply. */
export function applyTransitionConfigEdit(configText: string): TransitionConfigEditResult {
  try {
    const newConfig = parseJson(configText) as TransitionConfig;
    if (objectValidator(newConfig)) {
      if (objectValidator(newConfig.config)) {
        const mochartDemoConfig = buildMochartDemoConfig(newConfig.config);
        const { configValidation } = mochartDemoConfig;
        const { valid, errors, warnings } = configValidation;
        if (valid) {
          if (arrayValidator(newConfig.data) && !newConfig.data.some((aData: unknown) => !arrayValidator(aData))) {
            return { ok: true, config: newConfig };
          }
          else {
            console.warn('Invalid Transition Config, data should be an array of arrays: ', newConfig.data);
            return { ok: false, errorMessage: demoText.errors.transitionDataArrays };
          }
        }
        else {
          if (errors.length > 0) {
            console.warn('errors: ', errors);
          }
          if (warnings.length > 0) {
            console.warn('warnings: ', warnings);
          }
          return { ok: false, errorMessage: demoText.errors.invalidChartConfig };
        }
      }
      else {
        console.warn('Invalid Transition Config, config should be an object: ', newConfig.config);
        return { ok: false, errorMessage: demoText.errors.transitionConfigObject };
      }
    }
    else {
      console.warn('Invalid Transition Config, should be an object: ', configText);
      return { ok: false, errorMessage: demoText.errors.transitionObject };
    }
  }
  catch (error) {
    console.warn('Invalid Transition Config JSON: ', configText);
    return { ok: false, errorMessage: getJsonErrorMessage(error) };
  }
}
