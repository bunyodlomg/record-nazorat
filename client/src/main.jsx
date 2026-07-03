import React from 'react';
import ReactDOM from 'react-dom/client';
import { AuthProvider } from './context/AuthContext.jsx';
import { initTelegram } from './hooks/useTelegram.js';
import { initFastTap } from './utils/fastTap.js';
import App from './App.jsx';
import './styles/global.css';

initTelegram();
initFastTap();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <App/>
    </AuthProvider>
  </React.StrictMode>
);
