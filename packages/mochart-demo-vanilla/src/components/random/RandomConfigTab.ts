
import { buttonWithTooltip, el, icon, setActiveClass, tabContainer } from '../misc/dom';

import { createJsonEditorContent, demoText, formatRandomConfig, getJsonError, getJsonErrorMessage, parseJson, validateRandomConfig } from '@mochart/demo-common';

import type { RandomConfigWithValid } from '../../types';

export interface RandomConfigTabProps {
  active?: boolean;
  randomConfig: RandomConfigWithValid;
  /** The current demo's generator id, for schema dispatch (demos switch in place). */
  getGenerator: () => string | undefined;
  onUpdate: (config: RandomConfigWithValid) => void;
  onReset: () => void;
}

export interface RandomConfigTabHandle {
  el: HTMLElement;
  setActive(active: boolean): void;
  setRandomConfig(randomConfig: RandomConfigWithValid): void;
  destroy(): void;
}

export function randomConfigTab(props: RandomConfigTabProps): RandomConfigTabHandle {
  const { getGenerator, onUpdate, onReset } = props;

  let randomConfig = props.randomConfig;
  let errorMessage: string | null = null;

  const configEditor = createJsonEditorContent({
    value: formatRandomConfig(randomConfig),
    ariaLabel: demoText.randomConfigTab.editorAria,
    formatOnSet: true,
    onChange: () => {
      errorMessage = null;
      sync();
    }
  });

  function onUpdateClick(): void {
    try {
      const newConfig = parseJson(configEditor.getValue()) as RandomConfigWithValid;
      newConfig.valid = validateRandomConfig(newConfig, getGenerator());
      errorMessage = newConfig.valid ? null : demoText.errors.invalidRandomConfigValues;
      onUpdate(newConfig);
    }
    catch (error) {
      console.warn('Invalid Random Config JSON: ' + configEditor.getValue());
      errorMessage = getJsonErrorMessage(error);
    }
    sync();
  }

  const resetButton = buttonWithTooltip({
    id: 'config-reset', label: demoText.randomConfigTab.reset.label, ariaLabel: demoText.randomConfigTab.reset.aria,
    tooltipText: demoText.randomConfigTab.reset.tooltip,
    onClick: onReset,
    content: [icon('arrow-rotate-left', { size: 'lg', fixedWidth: true })]
  });
  const applyButton = buttonWithTooltip({
    id: 'config-apply', label: demoText.randomConfigTab.apply.label, ariaLabel: demoText.randomConfigTab.apply.aria,
    tooltipText: demoText.randomConfigTab.apply.tooltip,
    onClick: onUpdateClick,
    content: [icon('check', { size: 'lg', fixedWidth: true })]
  });

  const footerError = el('span', { className: 'mochart-demo-footer-error', attrs: { role: 'alert' } });
  footerError.hidden = true;

  const container = tabContainer('demo-layout-col config', props.active, [
    el('div', { className: 'mochart-demo-tab-content' }, [configEditor.el]),
    el('div', { className: 'mochart-demo-tab-footer' }, [
      el('div', { className: 'demo-toolbar' }, [
        resetButton.el, applyButton.el, footerError
      ])
    ])
  ], 'config');

  function sync(): void {
    const currentJsonError = getJsonError(configEditor.getValue());
    const currentFooterError = currentJsonError ?? errorMessage;
    applyButton.setDisabled(currentJsonError !== null);
    footerError.hidden = currentFooterError === null;
    footerError.textContent = currentFooterError ?? '';
  }
  sync();

  return {
    el: container,
    setActive(active: boolean) {
      setActiveClass(container, active);
    },
    setRandomConfig(nextRandomConfig: RandomConfigWithValid) {
      if (nextRandomConfig !== randomConfig) {
        randomConfig = nextRandomConfig;
        configEditor.setValue(formatRandomConfig(nextRandomConfig));
        sync();
      }
    },
    destroy() {
      configEditor.destroy();
    }
  };
}
