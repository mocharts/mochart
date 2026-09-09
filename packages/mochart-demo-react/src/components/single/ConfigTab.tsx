import { useState, useRef, useMemo } from 'react';
import Icon from '../misc/Icon';

import { buildMochartDemoConfig, controlsMenuPlacement, copyDemoConfig, demoConfigFromText, demoText, formatMochartDemoConfig, getDemoTabPanelAttrs, getJsonError, getJsonErrorMessage, getReferenceSectionIds, isConfigSectionActive, parseConfigFromText, parseJson, slowAnimationConfig, toggleConfigFromText, toggleConfigProperty, toggleConfigSection } from '@mochart/demo-common';

import type { DemoConfigView } from '@mochart/demo-common';

import JsonEditorContent from '../misc/JsonEditorContent';
import ButtonWithTooltip from '../misc/ButtonWithTooltip';

import type { JsonEditorContentRef } from '../misc/JsonEditorContent';
import DocsLinks from '../misc/DocsLinks';
import OverflowMenu, { MenuDivider } from '../misc/OverflowMenu';
import { usePhoneViewport } from '../misc/usePhoneViewport';

import type { DemoConfig, MochartDemoConfig } from '../../types';

interface Props {
  active?: boolean;
  config?: DemoConfig | null;
  onConfigChange: (config: DemoConfig) => void;
  onConfigReset: () => void;
}

interface ConfigTabState {
  mochartDemoConfig: MochartDemoConfig;
  demoConfig: DemoConfigView;
  showDefaults: boolean;
  configText: string;
}

export default function MochartConfigTab({ active, config = null, onConfigChange, onConfigReset }: Props) {
  const build = (nextConfig: DemoConfig | null): ConfigTabState => {
    const mochartDemoConfig = buildMochartDemoConfig(nextConfig ?? {});
    const demoConfig = copyDemoConfig(mochartDemoConfig);
    return { mochartDemoConfig, demoConfig, showDefaults: false, configText: formatMochartDemoConfig(demoConfig, false) };
  };

  const [state, setState] = useState<ConfigTabState>(() => build(config));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<JsonEditorContentRef>(null);

  // Rebuild when the incoming config changes.
  const prevConfig = useRef(config);
  if (prevConfig.current !== config) {
    prevConfig.current = config;
    const mochartDemoConfig = buildMochartDemoConfig(config ?? {});
    const demoConfig = copyDemoConfig(mochartDemoConfig);
    setState(prev => ({ ...prev, mochartDemoConfig, demoConfig, configText: formatMochartDemoConfig(demoConfig, prev.showDefaults) }));
  }

  // demoConfig tracks the text, so the Invert/Slow states and reference links follow unapplied edits.
  const onTextChange = (text: string) => {
    setState(prev => ({ ...prev, configText: text, demoConfig: demoConfigFromText(text, prev.demoConfig) }));
    setErrorMessage(null);
  };

  const resetConfig = () => onConfigReset();

  const updateShowDefaults = (showDefaults: boolean) => {
    const { configText } = state;
    try {
      const newConfig = parseJson(configText) as DemoConfig;
      const mochartDemoConfig = buildMochartDemoConfig(newConfig);
      const { configValidation } = mochartDemoConfig;
      const { valid } = configValidation;
      if (valid) {
        setState(prev => ({ ...prev, showDefaults, configText: formatMochartDemoConfig(mochartDemoConfig, showDefaults) }));
        setErrorMessage(null);
      }
      else {
        const { errors, warnings } = configValidation;
        if (errors.length > 0) {
          console.warn('errors: ', errors);
        }
        if (warnings.length > 0) {
          console.warn('warnings: ', warnings);
        }
        setErrorMessage(demoText.errors.invalidChartConfig);
      }
    }
    catch (error) {
      console.warn('Invalid Chart Config JSON: ' + state.configText);
      setErrorMessage(getJsonErrorMessage(error));
    }
  };

  const toggleConfigDefaults = () => updateShowDefaults(!state.showDefaults);

  // Toggle against the current text (the Defaults toggle's pattern), so
  // unapplied textarea edits survive the toggle instead of being overwritten.
  const applyConfigToggle = (transform: (current: DemoConfigView) => DemoConfigView) => {
    const result = toggleConfigFromText(state.configText, state.showDefaults, transform);
    if (result.error !== null) {
      setErrorMessage(result.error);
    }
    else {
      const { demoConfig, text } = result;
      setErrorMessage(null);
      setState(prev => ({ ...prev, demoConfig, configText: text }));
    }
  };

  const toggleConfigInverted = () => {
    applyConfigToggle(current => toggleConfigProperty(current, 'plot', 'inverted', true));
  };

  const toggleConfigAnimationSlow = () => {
    applyConfigToggle(current => toggleConfigSection(state.mochartDemoConfig, current, 'animation', slowAnimationConfig));
  };

  const applyConfig = () => {
    const { config, error } = parseConfigFromText(state.configText);
    setErrorMessage(error);
    if (config !== null) {
      onConfigChange(config);
    }
  };

  const { demoConfig, configText, showDefaults } = state;
  const { configWithDefaults } = demoConfig;
  const { inverted } = configWithDefaults.plot;

  const invertedIcon = inverted ? 'chart-bar' : 'chart-column';
  const slow = isConfigSectionActive(demoConfig, 'animation', slowAnimationConfig);
  const slowIcon = slow ? 'hourglass' : 'hourglass-end';

  // Live JSON validity — disables Apply and shows an inline hint while the
  // editor holds unparseable text.
  const jsonError = useMemo(() => getJsonError(configText), [configText]);
  const footerError = jsonError ?? errorMessage;

  // The phone fold. Apply stays beside the editor it applies, and the
  // `role="alert"` error span stays inline — a message that has to be read
  // cannot live behind a tap. Everything else, including the reference links,
  // goes to the `⋯` menu. Each control renders in exactly one of the two
  // places (see OverflowMenu.tsx).
  const isPhone = usePhoneViewport();
  const hasDocsLinks = getReferenceSectionIds(state.demoConfig.configWithoutDefaults).length > 0;

  const resetButton = (
    <ButtonWithTooltip id="config-reset" label={demoText.configTab.reset.label} tooltipText={demoText.configTab.reset.tooltip} tooltipPlacement="top-start"
      onClick={resetConfig} aria-label={demoText.configTab.reset.aria}>
      <Icon size="lg" fixedWidth={true} name="arrow-rotate-left" />
    </ButtonWithTooltip>
  );
  const defaultsButton = (
    <ButtonWithTooltip id="config-defaults" label={demoText.configTab.defaults.label} pressed={showDefaults}
      tooltipText={demoText.configTab.defaults.tooltip} tooltipPlacement="top-start"
      onClick={toggleConfigDefaults} aria-label={demoText.configTab.defaults.aria}>
      <Icon size="lg" fixedWidth={true} name={showDefaults ? 'eye' : 'eye-slash'} />
    </ButtonWithTooltip>
  );
  const invertedButton = (
    <ButtonWithTooltip id="config-inverted" label={demoText.configTab.invert.label} pressed={!!inverted}
      tooltipText={demoText.configTab.invert.tooltip} tooltipPlacement="top-start"
      onClick={toggleConfigInverted} aria-label={demoText.configTab.invert.aria}>
      <Icon size="lg" fixedWidth={true} name={invertedIcon} />
    </ButtonWithTooltip>
  );
  const slowButton = (
    <ButtonWithTooltip id="config-animate-slow" label={demoText.configTab.slow.label} pressed={slow}
      tooltipText={demoText.configTab.slow.tooltip} tooltipPlacement="top-start"
      onClick={toggleConfigAnimationSlow} aria-label={demoText.configTab.slow.aria}>
      <Icon size="lg" fixedWidth={true} name={slowIcon} />
    </ButtonWithTooltip>
  );
  const formatButton = (
    <ButtonWithTooltip id="config-format" label={demoText.configTab.format.label} disabled={jsonError !== null}
      tooltipText={demoText.configTab.format.tooltip} tooltipPlacement="top-start"
      onClick={() => editorRef.current?.format()} aria-label={demoText.configTab.format.aria}>
      <Icon size="lg" fixedWidth={true} name="indent" />
    </ButtonWithTooltip>
  );
  const applyButton = (
    <ButtonWithTooltip id="config-apply" label={demoText.configTab.apply.label} disabled={jsonError !== null}
      tooltipText={demoText.configTab.apply.tooltip} tooltipPlacement="top-start"
      onClick={applyConfig} aria-label={demoText.configTab.apply.aria}>
      <Icon size="lg" fixedWidth={true} name="check" />
    </ButtonWithTooltip>
  );
  const docsLinks = <DocsLinks config={state.demoConfig.configWithoutDefaults} />;
  const errorSpan = footerError ? <span className="mochart-demo-footer-error" role="alert">{footerError}</span> : null;

  return (
    <div {...getDemoTabPanelAttrs('config')} className={"mochart-demo-tab-container demo-layout-col config" + (active ? " active" : "")} inert={!active}>
      <div className="mochart-demo-tab-content">
        <JsonEditorContent value={configText} ariaLabel={demoText.configTab.editorAria} formatOnSet mochartSupport ref={editorRef}
          onChange={onTextChange} />
      </div>
      <div className="mochart-demo-tab-footer" ref={footerRef}>
        <div className="demo-toolbar">
          {isPhone ? (
            <>
              {applyButton}
              {/* `.editor`, not `.chart`: what folds here edits the JSON, and
                  "more chart controls" would tell a screen-reader user the
                  wrong thing. Anchored to the full-width footer — the trigger
                  sits mid-row, left of an error span that comes and goes. */}
              <OverflowMenu text={demoText.overflowMenu.editor} placement={controlsMenuPlacement}
                anchorRef={footerRef} active={active !== false}>
                <div className="demo-btn-group">{resetButton}{defaultsButton}{invertedButton}{slowButton}{formatButton}</div>
                {hasDocsLinks ? <><MenuDivider />{docsLinks}</> : null}
              </OverflowMenu>
              {errorSpan}
            </>
          ) : (
            <>
              {resetButton}
              {defaultsButton}
              {invertedButton}
              {slowButton}
              {formatButton}
              {applyButton}
              {errorSpan}
            </>
          )}
        </div>
        {isPhone ? null : docsLinks}
      </div>
    </div>
  );
}
