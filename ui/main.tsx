import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/inter';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './styles.css';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';

const root = document.getElementById('root');
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <ErrorBoundary area="app-shell">
        <App />
      </ErrorBoundary>
    </React.StrictMode>,
  );
} else {
  document.body.innerHTML = '<p style="padding:2rem;font-family:sans-serif">AVLON DRISHTI failed to start: missing #root element. Rebuild with <code>npm run build</code>.</p>';
}
