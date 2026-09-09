import { createJsonEditorContent, demoText, formatData } from '@mochart/demo-common';

import { el, setActiveClass, tabContainer } from '../misc/dom';

export interface RandomDataTabProps {
  active?: boolean;
  data: unknown;
}

export interface RandomDataTabHandle {
  el: HTMLElement;
  setActive(active: boolean): void;
  setData(data: unknown): void;
  destroy(): void;
}

export function randomDataTab(props: RandomDataTabProps): RandomDataTabHandle {
  let data = props.data;

  // No formatOnSet: formatData's one-row-per-line layout must survive.
  const dataEditor = createJsonEditorContent({
    value: formatData(data),
    ariaLabel: demoText.randomDataTab.editorAria,
    readOnly: true
  });

  const container = tabContainer('demo-layout-col data', props.active, [
    el('div', { className: 'mochart-demo-tab-content' }, [dataEditor.el])
  ], 'data');

  return {
    el: container,
    setActive(active: boolean) {
      setActiveClass(container, active);
    },
    setData(nextData: unknown) {
      if (nextData !== data) {
        data = nextData;
        dataEditor.setValue(formatData(nextData));
      }
    },
    destroy() {
      dataEditor.destroy();
    }
  };
}
