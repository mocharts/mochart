import '@mochart/core/mochart.css';
import '@mochart/demo-common/chart-dark.css';
import '@mochart/editor/editor.css';
import '../src/styles/showcase.css';

import { mountApp } from '../src/app/App';

const target = document.getElementById('root');
if (target === null) {
  throw new Error('showcase root element (#root) not found');
}

mountApp(target);
