import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Self-hosted fonts. Never load fonts from a third-party CDN.
import '@fontsource-variable/fraunces/wght.css';
import '@fontsource-variable/figtree/wght.css';
import './styles/tokens.css';
import './styles/derived-tokens.css';
import './styles/base.css';
import { App } from './App';

const root = document.getElementById('root');
if (!root) throw new Error('Root element missing');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
