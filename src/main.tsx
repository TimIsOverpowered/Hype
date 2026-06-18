import React from 'react';
import ReactDOM from 'react-dom/client';
import { setupNetworkInterceptor } from './interceptor';
import './index.css';
import App from './App';

setupNetworkInterceptor();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
