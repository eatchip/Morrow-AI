import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';
import './screens.css';
import './agent-transcript.css';
import './sidebar.css';
import './channel-workspace.css';
import './workspace-overlays.css';
import './project-picker.css';
import './model-picker.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('#root element not found in index.html');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
