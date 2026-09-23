import { useEffect, useState } from 'react';

import { isPhoneViewport, watchPhoneViewport } from '@mochart/demo-common';

/**
 * Tracks the phone breakpoint so the parts of the shell a stylesheet cannot
 * reach (which modes the switcher offers, which routes stay reachable) agree
 * with demo.css. Re-renders on rotation, not just on load.
 */
export function usePhoneViewport(): boolean {
  const [isPhone, setIsPhone] = useState(isPhoneViewport());
  useEffect(() => watchPhoneViewport(setIsPhone), []);
  return isPhone;
}
