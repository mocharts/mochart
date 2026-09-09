import { demoText, formatData, getDemoTabPanelAttrs } from '@mochart/demo-common';

import { useState, useRef } from 'react';

import JsonEditorContent from '../misc/JsonEditorContent';

interface Props {
  active?: boolean;
  data: unknown;
}

export default function RandomMochartDataTab({ active, data }: Props) {
  const [dataText, setDataText] = useState(() => formatData(data));

  const prevData = useRef(data);
  if (prevData.current !== data) {
    prevData.current = data;
    setDataText(formatData(data));
  }

  return (
    <div {...getDemoTabPanelAttrs('data')} className={"mochart-demo-tab-container demo-layout-col data" + (active ? " active" : "")} inert={!active}>
      <div className="mochart-demo-tab-content">
        <JsonEditorContent value={dataText} ariaLabel={demoText.randomDataTab.editorAria} readOnly />
      </div>
    </div>
  );
}
