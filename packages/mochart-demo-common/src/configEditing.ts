import buildMochartDemoConfig from './mochartDemoConfig';
import { demoText } from './demoText';
import { getJsonErrorMessage, parseJson } from './json';

import type { DemoConfig, MochartDemoConfig } from './types';

// The with/without-defaults config views the editor toggles between. Config
// sections are intentionally loose (`any`) — they are arbitrary user JSON.
export interface DemoConfigView {
  configWithDefaults: Record<string, any>;
  configWithoutDefaults: Record<string, any>;
}

// No default-equal values (enabled: true) — Apply strips them, breaking isConfigSectionActive.
export const slowAnimationConfig = {
  "initialDuration": 5000,
  "expansionDuration": 3000,
  "valueChangeDuration": 5000,
  "contractionDuration": 3000,
  "focusDuration": 2500
};

export function formatConfig(config: unknown): string {
  return JSON.stringify(config, null, '\t');
}

export function formatMochartDemoConfig(demoConfig: DemoConfigView, showDefaults: boolean): string {
  const { configWithDefaults, configWithoutDefaults } = demoConfig;
  return formatConfig(showDefaults ? configWithDefaults : configWithoutDefaults);
}

export function copyDemoConfig(demoConfig: DemoConfigView | MochartDemoConfig): DemoConfigView {
  const { configWithDefaults, configWithoutDefaults } = demoConfig;
  return JSON.parse(JSON.stringify({ configWithDefaults, configWithoutDefaults }));
}

export type ConfigTextToggle =
  { demoConfig: DemoConfigView; text: string; error: null } |
  { demoConfig: null; text: null; error: string };

export type ConfigTextParse =
  { config: DemoConfig; build: MochartDemoConfig; error: null } |
  { config: null; build: null; error: string };

/** Parse editor text and check it builds: JSON syntax alone leaves a config the chart cannot render. */
export function parseConfigFromText(configText: string): ConfigTextParse {
  let parsed: DemoConfig;
  try {
    parsed = parseJson(configText) as DemoConfig;
  }
  catch (error) {
    console.warn('Invalid Chart Config JSON: ' + configText);
    return { config: null, build: null, error: getJsonErrorMessage(error) };
  }
  const build = buildMochartDemoConfig(parsed);
  if (!build.configValidation.valid) {
    const { errors, warnings } = build.configValidation;
    if (errors.length > 0) {
      console.warn('errors: ', errors);
    }
    if (warnings.length > 0) {
      console.warn('warnings: ', warnings);
    }
    return { config: null, build: null, error: demoText.errors.invalidChartConfig };
  }
  return { config: parsed, build, error: null };
}

/**
 * Run an editor toggle against the CURRENT config text (the Defaults toggle's
 * pattern): parse and rebuild first, so unapplied textarea edits survive the
 * toggle instead of being overwritten from the last built snapshot.
 */
export function toggleConfigFromText(configText: string, showDefaults: boolean, transform: (current: DemoConfigView) => DemoConfigView): ConfigTextToggle {
  const { build, error } = parseConfigFromText(configText);
  if (build === null) {
    return { demoConfig: null, text: null, error };
  }
  const demoConfig = transform(copyDemoConfig(build));
  return { demoConfig, text: formatMochartDemoConfig(demoConfig, showDefaults), error: null };
}

/**
 * The config view the derived controls read (Invert/Slow pressed states, the reference links),
 * rebuilt from the CURRENT text so an unapplied edit still moves them. Text that does not parse or
 * does not build keeps the previous view: this runs on every keystroke, so it stays silent.
 */
export function demoConfigFromText(configText: string, previousDemoConfig: DemoConfigView): DemoConfigView {
  let parsed: DemoConfig;
  try {
    parsed = parseJson(configText) as DemoConfig;
  }
  catch {
    return previousDemoConfig;
  }
  const build = buildMochartDemoConfig(parsed);
  return build.configValidation.valid ? copyDemoConfig(build) : previousDemoConfig;
}

export function toggleConfigProperty(currentDemoConfig: DemoConfigView, section: string, key: string, defaultValue: unknown): DemoConfigView {
  let { configWithDefaults, configWithoutDefaults } = currentDemoConfig;
  configWithDefaults = { ...configWithDefaults };
  configWithoutDefaults = { ...configWithoutDefaults };
  const sectionConfig = configWithoutDefaults[section];
  const sectionWithDefaults = configWithDefaults[section];
  // toggle from the effective (defaulted) value, so a property whose core default
  // is true switches off on the first press instead of writing true again
  const rawValue = sectionConfig !== undefined ? sectionConfig[key] : undefined;
  const effectiveValue = rawValue !== undefined ? rawValue : sectionWithDefaults !== undefined ? sectionWithDefaults[key] : undefined;
  const newValue = effectiveValue === undefined ? defaultValue : !effectiveValue;
  configWithoutDefaults[section] = { ...sectionConfig, [key]: newValue };
  configWithDefaults[section] = { ...sectionWithDefaults, [key]: newValue };
  return { configWithDefaults, configWithoutDefaults };
}

/**
 * Whether the section currently holds the given preset. Structural comparison:
 * Apply round-trips configs through JSON, so object identity never survives.
 */
export function isConfigSectionActive(currentDemoConfig: DemoConfigView, section: string, defaultSection: unknown): boolean {
  const sectionConfig = currentDemoConfig.configWithoutDefaults[section];
  return sectionConfig === defaultSection || JSON.stringify(sectionConfig) === JSON.stringify(defaultSection);
}

export function toggleConfigSection(currentMochartDemoConfig: MochartDemoConfig, currentDemoConfig: DemoConfigView, section: string, defaultSection: unknown): DemoConfigView {
  let { configWithDefaults, configWithoutDefaults } = currentDemoConfig;
  configWithDefaults = { ...configWithDefaults };
  configWithoutDefaults = { ...configWithoutDefaults };
  const sectionConfig = configWithoutDefaults[section];
  if (!sectionConfig) {
    configWithoutDefaults[section] = defaultSection;
    configWithDefaults[section] = defaultSection;
  }
  else {
    // one decision applied to both views: the with-defaults view carries extra
    // defaulted keys after Apply, so only the without-defaults view can tell
    const active = isConfigSectionActive(currentDemoConfig, section, defaultSection);
    configWithoutDefaults[section] = active ? currentMochartDemoConfig.configWithoutDefaults[section] : defaultSection;
    configWithDefaults[section] = active ? currentMochartDemoConfig.configWithDefaults[section] : defaultSection;
  }
  return { configWithDefaults, configWithoutDefaults };
}
