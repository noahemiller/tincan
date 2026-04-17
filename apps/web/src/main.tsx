import React from 'react';
import ReactDOM from 'react-dom/client';

import { App } from './App';
import { ThemeProvider } from './components/ThemeProvider';
import { Toaster } from './components/ui/sonner';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
      <Toaster richColors position="bottom-right" />
    </ThemeProvider>
  </React.StrictMode>
);
