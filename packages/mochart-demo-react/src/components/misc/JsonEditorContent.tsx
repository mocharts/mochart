import { useEffect, useImperativeHandle, useRef } from 'react';

import { createJsonEditorContent } from '@mochart/demo-common';

import type { JsonEditorContentHandle, JsonEditorContentOptions } from '@mochart/demo-common';

import type { Ref } from 'react';

export interface JsonEditorContentRef {
  /** Pretty-print the current JSON; returns false (and leaves the text alone) when it doesn't parse. */
  format(): boolean;
}

interface Props {
  value: string;
  ariaLabel: string;
  readOnly?: boolean;
  formatOnSet?: boolean;
  /** Attach the Mochart config completions/validation/hover support. */
  mochartSupport?: boolean;
  onChange?: (value: string) => void;
  ref?: Ref<JsonEditorContentRef>;
}

// CodeMirror-backed replacement for the old TextAreaContent: same controlled
// value/onChange contract. Programmatic values flow through setValue; user
// edits report up and their echo is skipped, so typing is never re-set.
export default function JsonEditorContent({ value, ariaLabel, readOnly, formatOnSet, mochartSupport, onChange, ref }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<JsonEditorContentHandle | null>(null);
  const lastUserValueRef = useRef<string | null>(null);
  const propsRef = useRef<Props>({ value, ariaLabel, onChange });
  propsRef.current = { value, ariaLabel, onChange };

  useImperativeHandle(ref, () => ({
    format: () => handleRef.current?.format() ?? false
  }), []);

  useEffect(() => {
    const options: JsonEditorContentOptions = {
      value: propsRef.current.value,
      ariaLabel: propsRef.current.ariaLabel,
      readOnly,
      formatOnSet,
      onChange: text => {
        lastUserValueRef.current = text;
        propsRef.current.onChange?.(text);
      }
    };
    if (mochartSupport) {
      options.support = editor => editor.createMochartConfigSupport();
    }
    const handle = createJsonEditorContent(options);
    hostRef.current!.appendChild(handle.el);
    handleRef.current = handle;
    return () => {
      handleRef.current = null;
      handle.destroy();
      handle.el.remove();
    };
    // mount-once: the option props are static per call site
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Skip the echo of the user's own edit; everything else is programmatic.
    if (value !== lastUserValueRef.current) {
      lastUserValueRef.current = null;
      handleRef.current?.setValue(value);
    }
  }, [value]);

  return <div className="mochart-demo-text-area-container" ref={hostRef} />;
}
