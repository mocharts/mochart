import { useState, useRef, useMemo } from 'react';
import Icon from '../misc/Icon';

import { applyTransitionConfigEdit, demoText, formatTransitionConfig, getDemoTabPanelAttrs, getJsonError } from '@mochart/demo-common';

import JsonEditorContent from '../misc/JsonEditorContent';
import ButtonWithTooltip from '../misc/ButtonWithTooltip';

import type { TransitionConfig } from '../../types';

interface Props {
  active: boolean;
  transitionConfig: TransitionConfig;
  onUpdate: (config: TransitionConfig) => void;
  onReset: () => void;
}

export default function TransitionConfigTab({ active, transitionConfig, onUpdate, onReset }: Props) {
  const [configText, setConfigText] = useState(() => formatTransitionConfig(transitionConfig));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const prevTransitionConfig = useRef(transitionConfig);
  if (prevTransitionConfig.current !== transitionConfig) {
    prevTransitionConfig.current = transitionConfig;
    setConfigText(formatTransitionConfig(transitionConfig));
  }

  const onUpdateClick = () => {
    const result = applyTransitionConfigEdit(configText);
    if (result.ok) {
      setErrorMessage(null);
      onUpdate(result.config);
    }
    else {
      setErrorMessage(result.errorMessage);
    }
  };

  const jsonError = useMemo(() => getJsonError(configText), [configText]);
  const footerError = jsonError ?? errorMessage;

  return (
    <div {...getDemoTabPanelAttrs('config')} className={"mochart-demo-tab-container demo-layout-col config" + (active ? " active" : "")} inert={!active}>
      <div className="mochart-demo-tab-content">
        <JsonEditorContent value={configText} ariaLabel={demoText.transitionConfigTab.editorAria}
          onChange={(text: string) => { setConfigText(text); setErrorMessage(null); }} />
      </div>
      <div className="mochart-demo-tab-footer">
        <div className="demo-toolbar">
          <ButtonWithTooltip id="config-reset" label={demoText.transitionConfigTab.reset.label} tooltipText={demoText.transitionConfigTab.reset.tooltip} tooltipPlacement="top-start"
            onClick={onReset} aria-label={demoText.transitionConfigTab.reset.aria}>
            <Icon size="lg" fixedWidth={true} name="arrow-rotate-left" />
          </ButtonWithTooltip>
          <ButtonWithTooltip id="config-apply" label={demoText.transitionConfigTab.apply.label} disabled={jsonError !== null}
            tooltipText={demoText.transitionConfigTab.apply.tooltip} tooltipPlacement="top-start"
            onClick={onUpdateClick} aria-label={demoText.transitionConfigTab.apply.aria}>
            <Icon size="lg" fixedWidth={true} name="check" />
          </ButtonWithTooltip>
          {footerError ? <span className="mochart-demo-footer-error" role="alert">{footerError}</span> : null}
        </div>
      </div>
    </div>
  );
}
