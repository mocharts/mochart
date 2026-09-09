import { applyDataEdit, buildMochartDemoConfig, collectUsedDataProperties, controlsMenuPlacement, createJsonEditorContent, demoText, formatDataView, getJsonError, isPhoneViewport, getCategoryProperty, parseFullData, watchPhoneViewport } from '@mochart/demo-common';

import { buttonWithTooltip, el, icon, setActiveClass, setChildren, tabContainer } from '../misc/dom';
import { overflowMenu } from '../misc/OverflowMenu';

import type { DemoConfig, DataObject } from '../../types';

export interface DataTabProps {
  active?: boolean;
  config: DemoConfig;
  data: DataObject[];
  onDataChange: (data: DataObject[]) => void;
  onDataError: (errorMessage: string) => void;
  onDataReset: () => void;
}

export interface DataTabHandle {
  el: HTMLElement;
  setActive(active: boolean): void;
  setConfig(config: DemoConfig): void;
  setData(data: DataObject[]): void;
  destroy(): void;
}

export function dataTab(props: DataTabProps): DataTabHandle {
  const { onDataChange, onDataError, onDataReset } = props;

  let config = props.config;
  let data = props.data;
  let errorMessage: string | null = null;
  // Data properties the chart config does not read are hidden by default; the
  // Unused button toggles them. fullData is the complete dataset backing the
  // editor, viewUsedProperties the used-set its current content was rendered
  // with (null when every property is shown).
  let showUnused = false;
  let fullData = data;
  let usedProperties = collectUsedDataProperties(buildMochartDemoConfig(config).mochartConfig);
  let viewUsedProperties: Set<string> | null = null;

  // The phone fold. Read once up front and kept current by the watcher below;
  // `sync()` re-lays the footer out from it (see placeControls).
  let isPhone = isPhoneViewport();
  const unwatchViewport = watchPhoneViewport(next => {
    isPhone = next;
    sync();
  });

  // No formatOnSet: formatDataView's one-row-per-line layout must survive.
  const dataEditor = createJsonEditorContent({
    value: '',
    ariaLabel: demoText.dataTab.editorAria,
    onChange: () => {
      errorMessage = null;
      sync();
    }
  });

  function render(): void {
    viewUsedProperties = showUnused ? null : usedProperties;
    dataEditor.setValue(formatDataView(fullData, viewUsedProperties));
  }

  function parseCurrentFullData(): ReturnType<typeof parseFullData> {
    return parseFullData(dataEditor.getValue(), fullData, viewUsedProperties, getCategoryProperty(config));
  }

  function resetData(): void {
    fullData = data;
    errorMessage = null;
    render();
    onDataReset();
    sync();
  }

  function updateShowUnused(nextShowUnused: boolean): void {
    const parsed = parseCurrentFullData();
    if ('error' in parsed) {
      errorMessage = parsed.error === 'json' ? demoText.errors.invalidJson : demoText.errors.invalidDataArray;
      sync();
      return;
    }
    fullData = parsed.full;
    showUnused = nextShowUnused;
    errorMessage = null;
    render();
    sync();
  }

  function applyData(): void {
    const result = applyDataEdit(dataEditor.getValue(), fullData, viewUsedProperties, config);
    if (result.ok) {
      errorMessage = null;
      fullData = result.data;
      onDataChange(result.data);
    }
    else {
      errorMessage = result.errorMessage;
      onDataError(result.callbackError);
    }
    sync();
  }

  const resetButton = buttonWithTooltip({
    id: 'data-reset', label: demoText.dataTab.reset.label, ariaLabel: demoText.dataTab.reset.aria,
    tooltipText: demoText.dataTab.reset.tooltip,
    onClick: resetData,
    content: [icon('arrow-rotate-left', { size: 'lg', fixedWidth: true })]
  });
  const unusedButton = buttonWithTooltip({
    id: 'data-unused', label: demoText.dataTab.unused.label, pressed: showUnused, ariaLabel: demoText.dataTab.unused.aria,
    tooltipText: demoText.dataTab.unused.tooltip,
    onClick: () => updateShowUnused(!showUnused),
    content: [icon('eye-slash', { size: 'lg', fixedWidth: true })]
  });
  const applyButton = buttonWithTooltip({
    id: 'data-apply', label: demoText.dataTab.apply.label, ariaLabel: demoText.dataTab.apply.aria,
    tooltipText: demoText.dataTab.apply.tooltip,
    onClick: applyData,
    content: [icon('check', { size: 'lg', fixedWidth: true })]
  });

  const footerError = el('span', { className: 'mochart-demo-footer-error', attrs: { role: 'alert' } });
  footerError.hidden = true;

  // Same fold as the config footer — same trigger copy (the data editor's own
  // controls, not chart controls), same upward placement, same full-width
  // footer anchor. The reasons live on ConfigTab's overflowMenu call.
  const overflowMenuHandle = overflowMenu({
    text: demoText.overflowMenu.editor,
    placement: controlsMenuPlacement,
    getAnchor: () => footer
  });

  // Menu-side home for the folded footer buttons — a cached `.demo-btn-group`;
  // OverflowMenu.ts's header says why that shape.
  const menuActionGroup = el('div', { className: 'demo-btn-group' });
  const menuActionButtons = [resetButton.el, unusedButton.el];

  // The footer's order at desktop widths; also the list the unfold restores, so
  // the desktop layout has exactly one definition.
  const toolbarItems = [resetButton.el, unusedButton.el, applyButton.el, footerError];
  // Apply stays beside the editor it applies, and the error span carries
  // `role="alert"` — a message that has to be read cannot live behind a tap.
  const foldedToolbarItems = [applyButton.el, overflowMenuHandle.el, footerError];
  const toolbar = el('div', { className: 'demo-toolbar' }, toolbarItems);
  const footer = el('div', { className: 'mochart-demo-tab-footer' }, [toolbar]);

  const container = tabContainer('demo-layout-col data', props.active, [
    el('div', { className: 'mochart-demo-tab-content' }, [dataEditor.el]),
    footer
  ], 'data');

  /**
   * Where every footer control lives right now. Reparenting, never
   * duplication — see OverflowMenu.ts's header.
   */
  function placeControls(): void {
    // Do this first: emptying the panel detaches whatever it was hosting, so the
    // restore below sees an honest child list rather than believing the controls
    // are already placed.
    overflowMenuHandle.setItems(isPhone ? [menuActionGroup] : []);
    if (isPhone) {
      setChildren(menuActionGroup, menuActionButtons);
    }
    setChildren(toolbar, isPhone ? foldedToolbarItems : toolbarItems);
  }

  function sync(): void {
    const currentJsonError = getJsonError(dataEditor.getValue());
    const currentFooterError = currentJsonError ?? errorMessage;
    applyButton.setDisabled(currentJsonError !== null);
    footerError.hidden = currentFooterError === null;
    footerError.textContent = currentFooterError ?? '';

    unusedButton.setPressed(showUnused);
    unusedButton.setContent([icon(showUnused ? 'eye' : 'eye-slash', { size: 'lg', fixedWidth: true })]);

    placeControls();
  }
  render();
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
        usedProperties = collectUsedDataProperties(buildMochartDemoConfig(nextConfig).mochartConfig);
        // Re-filter for the new config, keeping any (valid) unapplied edits.
        if (!showUnused) {
          const parsed = parseCurrentFullData();
          if (!('error' in parsed)) {
            fullData = parsed.full;
            render();
          }
        }
        sync();
      }
    },
    setData(nextData: DataObject[]) {
      if (nextData !== data) {
        data = nextData;
        fullData = nextData;
        errorMessage = null;
        render();
        sync();
      }
    },
    destroy() {
      unwatchViewport();
      overflowMenuHandle.destroy();
      dataEditor.destroy();
    }
  };
}
