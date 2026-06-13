import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

function init() {
  const root = document.getElementById('root');
  if (!root) return;

  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
