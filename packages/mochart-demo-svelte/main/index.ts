import { mount } from 'svelte';

import '@fortawesome/fontawesome-free/css/fontawesome.min.css';
import '@fortawesome/fontawesome-free/css/solid.min.css';
import '@mochart/demo-common/demo.css';
import '@mochart/editor/editor.css';

import App from './App.svelte';

const target = document.getElementById('root');
if (target === null) {
  throw new Error('demo root element (#root) not found');
}

mount(App, { target });
