import { redirect } from '@sveltejs/kit';
import type { LayoutLoad } from './$types.js';
import { api, ApiError } from '$lib/api.js';
import { getUser, isAuthInitialized, setUser } from '$lib/auth.svelte.js';
import { setLocale } from '$lib/i18n/index.js';

// SPA-Modus: kein SSR, siehe adapter-static-Konfiguration in vite.config.ts.
export const ssr = false;

const PUBLIC_ROUTES = new Set(['/login', '/register']);

/**
 * Zentraler Route-Guard fürs gesamte SPA. Lädt den Session-Nutzer genau einmal
 * (weitere Navigationen nutzen den bereits gefüllten Auth-Store), und leitet
 * anhand von Login-Status + Rolle um:
 * - nicht eingeloggt + geschützte Route → /login
 * - eingeloggt + /login oder /register  → /
 * - eingeloggt, aber nicht Admin + /admin → /
 */
export const load: LayoutLoad = async ({ url }) => {
  if (!isAuthInitialized()) {
    try {
      const { user } = await api.getMe();
      setUser(user);
      if (user.locale) {
        setLocale(user.locale, false);
      }
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 401)) {
        console.error('failed to load current user', err);
      }
      setUser(null);
    }
  }

  const user = getUser();
  const isPublicRoute = PUBLIC_ROUTES.has(url.pathname);

  if (!user && !isPublicRoute) {
    redirect(302, '/login');
  }
  if (user) {
    if (isPublicRoute) {
      redirect(302, '/');
    }
    if (url.pathname === '/admin' && user.role !== 'admin') {
      redirect(302, '/');
    }
  }

  return {};
};
