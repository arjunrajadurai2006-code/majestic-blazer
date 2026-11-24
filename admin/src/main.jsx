import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';
import './styles/global.css';

const basename = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')
  ? '/admin'
  : '';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter
      basename={basename}
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <AuthProvider>
        <SettingsProvider>
          <App />
        </SettingsProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
