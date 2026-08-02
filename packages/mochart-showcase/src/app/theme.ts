import { initTheme } from '@mochart/demo-common';

// demo-common exports initTheme but not its controller interface; derive it.
export type ThemeController = ReturnType<typeof initTheme>;
