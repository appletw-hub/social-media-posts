import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

console.log('[Debug] index.tsx execution started.');

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error("[Debug] Could not find root element to mount to");
  throw new Error("Could not find root element to mount to");
}

console.log('[Debug] Root element found. Mounting App...');
const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
console.log('[Debug] root.render called.');
