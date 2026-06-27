import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Supabase sends invite/recovery links in two formats depending on config:
//   • Legacy implicit flow: #access_token=...&type=invite
//   • PKCE flow (default in v2): ?token_hash=...&type=invite
// In both cases Supabase may land on the Site URL (root) first.
// We detect the token type in hash OR search and rewrite the URL to
// /setup-password BEFORE React boots, so the correct page is rendered.
{
  const hash   = window.location.hash;
  const search = window.location.search;

  const isInviteOrRecovery =
    hash.includes('type=invite')     || hash.includes('type=recovery') ||
    search.includes('type=invite')   || search.includes('type=recovery') ||
    hash.includes('type=magiclink')  || search.includes('type=magiclink') ||
    // token_hash is the PKCE invite/recovery indicator
    (search.includes('token_hash=') && (
      search.includes('type=invite') || search.includes('type=recovery') || search.includes('type=magiclink')
    ));

  const alreadyOnSetup    = window.location.pathname.startsWith('/setup-password');
  const alreadyOnReset    = window.location.pathname.startsWith('/reset-password');

  if (isInviteOrRecovery && !alreadyOnSetup && !alreadyOnReset) {
    // Invite always goes to /setup-password
    const isRecovery = hash.includes('type=recovery') || search.includes('type=recovery');
    const target = isRecovery ? '/reset-password' : '/setup-password';
    // Preserve both search and hash so Supabase can process the token
    window.history.replaceState(null, '', target + search + hash);
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
