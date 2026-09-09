import '@fortawesome/fontawesome-free/css/fontawesome.min.css';
import '@fortawesome/fontawesome-free/css/solid.min.css';
import '@mochart/demo-common/demo.css';
import '@mochart/editor/editor.css';

import { ErrorHandler, provideZonelessChangeDetection } from '@angular/core';
import { APP_BASE_HREF } from '@angular/common';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import { DemoErrorHandler } from '../src/components/misc/demo-error-handler';

import { App } from './app';
import { routes } from './routes';

bootstrapApplication(App, {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(routes, withComponentInputBinding()),
    // Vite injects the deploy base at build time; the router derives its base
    // from it so the demo works when hosted on a sub-path (see build-pages).
    { provide: APP_BASE_HREF, useValue: import.meta.env.BASE_URL },
    // fans component errors out to the error tabs (see error-tab.ts)
    { provide: ErrorHandler, useClass: DemoErrorHandler }
  ]
}).catch((error) => {
  console.error(error);
});
