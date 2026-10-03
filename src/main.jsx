import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { TeamsProvider } from './context/TeamsContext.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <TeamsProvider>
        <App />
      </TeamsProvider>
    </BrowserRouter>
  </React.StrictMode>
);
