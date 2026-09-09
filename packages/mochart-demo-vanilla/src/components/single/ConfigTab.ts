import { buildMochartDemoConfig, controlsMenuPlacement, copyDemoConfig, createJsonEditorContent, demoConfigFromText, demoText, formatMochartDemoConfig, getJsonError, getJsonErrorMessage, getReferenceSectionIds, getReferenceSectionUrl, isPhoneViewport, isConfigSectionActive, parseConfigFromText, parseJson, slowAnimationConfig, toggleConfigFromText, toggleConfigProperty, toggleConfigSection, watchPhoneViewport } from '@mochart/demo-common';

import type { DemoConfigView } from '@mochart/demo-common';

import { buttonWithTooltip, el, icon, setActiveClass, setChildren, tabContainer } from '../misc/dom';
import { menuDivider, overflowMenu } from '../misc/OverflowMenu';

import type { MenuItem } from '../misc/OverflowMenu';

import type { DemoConfig } from '../../types';

export interface ConfigTabProps {
  active?: boolean;
  config: DemoConfig;
  onConfigChange: (config: DemoConfig) => void;
  onConfigReset: () => void;
}

export interface ConfigTabHandle {
  el: HTMLElement;
  setActive(active: boolean): void;
  setConfig(config: DemoConfig): void;
  destroy(): void;
}

export function configTab(props: ConfigTabProps): ConfigTabHandle {
  const { onConfigChange, onConfigReset } = props;

  let config = props.config;
  let showDefaults = false;
  let errorMessage: string | null = null;
  let mochartDemoConfig = buildMochartDemoConfig(config);
  let demoConfig = copyDemoConfig(mochartDemoConfig);

  // The phone fold. Read once up front and kept current by the watcher below;
  // `sync()` re-lays the footer out from it (see placeControls).
  let isPhone = isPhoneViewport();
  const unwatchViewport = watchPhoneViewport(next => {
    isPhone = next;
    sync();
  });

  const configEditor = createJsonEditorContent({
    value: formatMochartDemoConfig(demoConfig, false),
    ariaLabel: demoText.configTab.editorAria,
    formatOnSet: true,
    support: editor => editor.createMochartConfigSupport(),
    onChange: onTextChange
  });

  function getConfigText(): string {
    return configEditor.getValue();
  }

  function onTextChange(): void {
    errorMessage = null;
    demoConfig = demoConfigFromText(getConfigText(), demoConfig);
    sync();
  }

  function updateShowDefaults(nextShowDefaults: boolean): void {
    try {
      const newConfig = parseJson(getConfigText()) as DemoConfig;
      const newMochartDemoConfig = buildMochartDemoConfig(newConfig);
      const { configValidation } = newMochartDemoConfig;
      const { valid } = configValidation;
      if (valid) {
        showDefaults = nextShowDefaults;
        configEditor.setValue(formatMochartDemoConfig(newMochartDemoConfig, nextShowDefaults));
        errorMessage = null;
      }
      else {
        const { errors, warnings } = configValidation;
        if (errors.length > 0) {
          console.warn('errors: ', errors);
        }
        if (warnings.length > 0) {
          console.warn('warnings: ', warnings);
        }
        errorMessage = demoText.errors.invalidChartConfig;
      }
    }
    catch (error) {
      console.warn('Invalid Chart Config JSON: ' + getConfigText());
      errorMessage = getJsonErrorMessage(error);
    }
    sync();
  }

  // Toggle against the current text (the Defaults toggle's pattern), so
  // unapplied textarea edits survive the toggle instead of being overwritten.
  function applyConfigToggle(transform: (current: DemoConfigView) => DemoConfigView): void {
    const result = toggleConfigFromText(getConfigText(), showDefaults, transform);
    if (result.error !== null) {
      errorMessage = result.error;
    }
    else {
      demoConfig = result.demoConfig;
      configEditor.setValue(result.text);
      errorMessage = null;
    }
    sync();
  }

  function toggleConfigInverted(): void {
    applyConfigToggle(current => toggleConfigProperty(current, 'plot', 'inverted', true));
  }

  function toggleConfigAnimationSlow(): void {
    applyConfigToggle(current => toggleConfigSection(mochartDemoConfig, current, 'animation', slowAnimationConfig));
  }

  function applyConfig(): void {
    const { config, error } = parseConfigFromText(getConfigText());
    errorMessage = error;
    if (config !== null) {
      onConfigChange(config);
    }
    sync();
  }

  const resetButton = buttonWithTooltip({
    id: 'config-reset', label: demoText.configTab.reset.label, ariaLabel: demoText.configTab.reset.aria,
    tooltipText: demoText.configTab.reset.tooltip,
    onClick: () => onConfigReset(),
    content: [icon('arrow-rotate-left', { size: 'lg', fixedWidth: true })]
  });
  const defaultsButton = buttonWithTooltip({
    id: 'config-defaults', label: demoText.configTab.defaults.label, pressed: showDefaults, ariaLabel: demoText.configTab.defaults.aria,
    tooltipText: demoText.configTab.defaults.tooltip,
    onClick: () => updateShowDefaults(!showDefaults),
    content: [icon('eye-slash', { size: 'lg', fixedWidth: true })]
  });
  const invertedButton = buttonWithTooltip({
    id: 'config-inverted', label: demoText.configTab.invert.label, pressed: false, ariaLabel: demoText.configTab.invert.aria,
    tooltipText: demoText.configTab.invert.tooltip,
    onClick: toggleConfigInverted,
    content: [icon('chart-column', { size: 'lg', fixedWidth: true })]
  });
  const slowButton = buttonWithTooltip({
    id: 'config-animate-slow', label: demoText.configTab.slow.label, pressed: false, ariaLabel: demoText.configTab.slow.aria,
    tooltipText: demoText.configTab.slow.tooltip,
    onClick: toggleConfigAnimationSlow,
    content: [icon('hourglass-end', { size: 'lg', fixedWidth: true })]
  });
  const formatButton = buttonWithTooltip({
    id: 'config-format', label: demoText.configTab.format.label, ariaLabel: demoText.configTab.format.aria,
    tooltipText: demoText.configTab.format.tooltip,
    onClick: () => configEditor.format(),
    content: [icon('indent', { size: 'lg', fixedWidth: true })]
  });
  const applyButton = buttonWithTooltip({
    id: 'config-apply', label: demoText.configTab.apply.label, ariaLabel: demoText.configTab.apply.aria,
    tooltipText: demoText.configTab.apply.tooltip,
    onClick: applyConfig,
    content: [icon('check', { size: 'lg', fixedWidth: true })]
  });

  const footerError = el('span', { className: 'mochart-demo-footer-error', attrs: { role: 'alert' } });
  footerError.hidden = true;

  // Links into the generated config reference for the sections the edited
  // config actually uses.
  const docsLinks = el('div', { className: 'mochart-demo-docs-links' });

  // The section list the row was last built from, and whether it produced any
  // links at all.
  //
  // `syncDocsLinks` runs on every keystroke but its input — the config's own
  // section ids — only changes when the config does, and rebuilding the row
  // regardless is not free once the row is hosted by the overflow panel: it
  // would detach and re-insert a link the user may be about to follow. It also
  // keeps the row itself one stable element, which is what lets `setItems`'
  // identity bail-out work (the panel holds `docsLinks`, not its children).
  let docsLinkKey: string | null = null;
  let hasDocsLinks = false;

  function syncDocsLinks(): void {
    const sectionIds = getReferenceSectionIds(demoConfig.configWithoutDefaults);
    const nextKey = sectionIds.join(',');
    if (nextKey === docsLinkKey) {
      return;
    }
    docsLinkKey = nextKey;
    hasDocsLinks = sectionIds.length > 0;
    docsLinks.replaceChildren();
    if (sectionIds.length === 0) {
      return;
    }
    docsLinks.append(el('span', { text: demoText.docsLinks.label + ' ' }));
    sectionIds.forEach((sectionId, index) => {
      if (index > 0) {
        docsLinks.append(' · ');
      }
      docsLinks.append(el('a', {
        attrs: { href: getReferenceSectionUrl(sectionId), title: demoText.docsLinks.tooltipPrefix + sectionId },
        text: sectionId
      }));
    });
  }

  // `.editor`, not `.chart`: the folded rows are the config editor's own
  // controls and a list of reference links, and naming them "chart controls" to
  // a screen reader would be a promise this panel does not keep.
  const overflowMenuHandle = overflowMenu({
    text: demoText.overflowMenu.editor,
    // Right-aligned against the footer rather than the trigger. The trigger sits
    // mid-row, left of an error span that comes and goes; anchoring to it would
    // both move the panel as the error appears and, on a phone, push a 320px
    // panel off the left edge. The footer is full width, so its right edge is
    // the row's end.
    placement: controlsMenuPlacement,
    getAnchor: () => footer
  });

  // Menu-side home for the folded footer buttons — a cached `.demo-btn-group`;
  // OverflowMenu.ts's header says why that shape.
  const menuActionGroup = el('div', { className: 'demo-btn-group' });
  const menuActionButtons = [resetButton.el, defaultsButton.el, invertedButton.el, slowButton.el, formatButton.el];

  // The footer's order at desktop widths; also the list the unfold restores, so
  // the desktop layout has exactly one definition.
  const toolbarItems = [
    resetButton.el, defaultsButton.el, invertedButton.el, slowButton.el, formatButton.el, applyButton.el, footerError
  ];
  // Apply stays beside the editor it applies, and the error span carries
  // `role="alert"` — a message that has to be read cannot live behind a tap.
  const foldedToolbarItems = [applyButton.el, overflowMenuHandle.el, footerError];
  const toolbar = el('div', { className: 'demo-toolbar' }, toolbarItems);
  const footerItems = [toolbar, docsLinks];
  const footer = el('div', { className: 'mochart-demo-tab-footer' }, footerItems);

  const container = tabContainer('demo-layout-col config', props.active, [
    el('div', { className: 'mochart-demo-tab-content' }, [configEditor.el]),
    footer
  ], 'config');

  /**
   * Where every footer control lives right now. Reparenting, never
   * duplication — see OverflowMenu.ts's header.
   */
  function placeControls(): void {
    // Do this first: emptying the panel detaches whatever it was hosting, so the
    // restores below see honest child lists rather than believing the controls
    // are already placed.
    //
    // The links tail is omitted rather than left as a trailing divider when the
    // config uses no documented sections: `setItems` drops nulls but keeps
    // dividers, so the unconditional form would rule off the bottom of the panel
    // with nothing under it.
    const linksTail: MenuItem[] = hasDocsLinks ? [menuDivider, docsLinks] : [];
    overflowMenuHandle.setItems(isPhone ? [menuActionGroup, ...linksTail] : []);
    if (isPhone) {
      setChildren(menuActionGroup, menuActionButtons);
    }
    setChildren(toolbar, isPhone ? foldedToolbarItems : toolbarItems);
    setChildren(footer, isPhone ? [toolbar] : footerItems);
  }

  // Patch every derived bit of the footer from the current state (the vanilla
  // stand-in for the framework demos' derived values).
  function sync(): void {
    const currentJsonError = getJsonError(getConfigText());
    const currentFooterError = currentJsonError ?? errorMessage;
    applyButton.setDisabled(currentJsonError !== null);
    formatButton.setDisabled(currentJsonError !== null);
    footerError.hidden = currentFooterError === null;
    footerError.textContent = currentFooterError ?? '';

    defaultsButton.setPressed(showDefaults);
    defaultsButton.setContent([icon(showDefaults ? 'eye' : 'eye-slash', { size: 'lg', fixedWidth: true })]);

    const inverted = !!demoConfig.configWithDefaults.plot?.inverted;
    invertedButton.setPressed(inverted);
    invertedButton.setContent([icon(inverted ? 'chart-bar' : 'chart-column', { size: 'lg', fixedWidth: true })]);

    const slow = isConfigSectionActive(demoConfig, 'animation', slowAnimationConfig);
    slowButton.setPressed(slow);
    slowButton.setContent([icon(slow ? 'hourglass' : 'hourglass-end', { size: 'lg', fixedWidth: true })]);

    // Before placeControls: whether the links row goes into the panel at all
    // depends on whether this run left it with any links in it.
    syncDocsLinks();
    placeControls();
  }
  sync();

  return {
    el: container,
    setActive(active: boolean) {
      // An open panel is `position: fixed`, so marking the pane inert would
      // leave it painting over the pane that replaced this one.
      if (!active) {
        overflowMenuHandle.close();
      }
      setActiveClass(container, active);
    },
    setConfig(nextConfig: DemoConfig) {
      if (nextConfig !== config) {
        config = nextConfig;
        mochartDemoConfig = buildMochartDemoConfig(nextConfig);
        demoConfig = copyDemoConfig(mochartDemoConfig);
        configEditor.setValue(formatMochartDemoConfig(demoConfig, showDefaults));
        errorMessage = null;
        sync();
      }
    },
    destroy() {
      unwatchViewport();
      overflowMenuHandle.destroy();
      configEditor.destroy();
    }
  };
}
