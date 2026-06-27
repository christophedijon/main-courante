import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Supabase sends invite/recovery links in two formats depending on config:
//   • Legacy implicit flow: #access_token=...&type=invite
//   • PKCE flow (default in v2): ?token_hash=...&type=invite
// In both cases Supabase may land on the Site URL (root) first.
// We detect the token type OR error in hash/search and rewrite the URL so
// the correct page is rendered, BEFORE React boots.
{
  const hash   = window.location.hash;
  const search = window.location.search;

  const alreadyOnSetup    = window.location.pathname.startsWith('/setup-password');
  const alreadyOnReset    = window.location.pathname.startsWith('/reset-password');
  const alreadyOnActivate = window.location.pathname.startsWith('/activate');

  if (!alreadyOnSetup && !alreadyOnReset && !alreadyOnActivate) {
    const isInvite   = hash.includes('type=invite')   || search.includes('type=invite');
    const isRecovery = hash.includes('type=recovery') || search.includes('type=recovery');
    // Errors from Supabase (e.g. otp_expired) should go to /setup-password for a clear UX
    const isError    = hash.includes('error=access_denied') || hash.includes('error_code=');

    if (isRecovery) {
      window.history.replaceState(null, '', '/reset-password' + search + hash);
    } else if (isInvite || isError) {
      window.history.replaceState(null, '', '/setup-password' + search + hash);
    }
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
