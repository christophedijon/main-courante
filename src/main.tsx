import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// When Supabase sends an invite/recovery link, the redirect_to URL may not
// be in the allowlist, so Supabase falls back to the Site URL (root).
// We detect the token type in the hash and redirect to /setup-password
// before React boots, so the page always lands on the correct route.
{
  const hash = window.location.hash;
  const isInviteOrRecovery = hash.includes('type=invite') || hash.includes('type=recovery');
  const alreadyOnSetup = window.location.pathname.startsWith('/setup-password');
  if (isInviteOrRecovery && !alreadyOnSetup) {
    window.history.replaceState(null, '', '/setup-password' + hash);
  }
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .catch(err => console.error('SW registration failed:', err));
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
