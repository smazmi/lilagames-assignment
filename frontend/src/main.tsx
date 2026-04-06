import React from 'react';
import ReactDOM from 'react-dom/client';
import { NakamaProvider } from './context/NakamaContext';
import { App } from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <NakamaProvider>
      <App />
    </NakamaProvider>
  </React.StrictMode>,
);
