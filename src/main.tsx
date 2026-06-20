import { invoke } from '@tauri-apps/api/core';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { setupNetworkInterceptor } from './interceptor';
import './index.css';
import App from './App';

invoke<number>('get_proxy_port').then((port) => {
  setupNetworkInterceptor(port);
});

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
