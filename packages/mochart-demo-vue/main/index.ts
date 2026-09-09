import { createApp } from 'vue';

import '@fortawesome/fontawesome-free/css/fontawesome.min.css';
import '@fortawesome/fontawesome-free/css/solid.min.css';
import '@mochart/demo-common/demo.css';
import '@mochart/editor/editor.css';

import App from './App.vue';

const target = document.getElementById('root');
if (target === null) {
  throw new Error('demo root element (#root) not found');
}

createApp(App).mount(target);
