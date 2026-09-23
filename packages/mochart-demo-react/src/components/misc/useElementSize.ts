import { useEffect, useRef, useState } from 'react';

/**
 * Measures an element's client size with a ResizeObserver, the React
 * equivalent of the vue demo's useElementSize composable and Svelte's
 * bind:clientWidth/bind:clientHeight.
 */
export function useElementSize<T extends HTMLElement = HTMLDivElement>(): {
  elementRef: React.RefObject<T | null>;
  width: number;
  height: number;
} {
  const elementRef = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = elementRef.current;
    if (element === null) {
      return;
    }
    const measure = () => {
      const width = element.clientWidth;
      const height = element.clientHeight;
      setSize(prev => (width !== prev.width || height !== prev.height ? { width, height } : prev));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { elementRef, width: size.width, height: size.height };
}
