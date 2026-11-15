/**
 * GitHub OAuth Authentication & User Profile Store.
 *
 * Implements the standard 4-step GitHub OAuth Web Application Flow:
 *   1. Registered GitHub OAuth App provides `GITHUB_CLIENT_ID` & `GITHUB_CLIENT_SECRET`.
 *   2. Frontend redirects user to `https://github.com/login/oauth/authorize?client_id=...&redirect_uri=...&scope=read:user`.
 *   3. GitHub authenticates the user (username + password / 2FA) and redirects back with `?code=<AUTH_CODE>`.
 *   4. Backend (`/api/github-auth`) exchanges `code` for an `access_token` at `https://github.com/login/oauth/access_token`
 *      and fetches the authenticated user from `https://api.github.com/user`.
 */

import { STORAGE_KEYS } from './storage.js';

/** GitHub logins with Admin Mode access (unlimited playthroughs & replay). */
export const ADMIN_LOGINS = new Set(['s3ldan1ps', 'danthebanan', 'bipa']);

export function isAdminUser(user) {
  const login = String(user?.login ?? '').trim().toLowerCase();
  return Boolean(login && ADMIN_LOGINS.has(login));
}

/**
 * Build the real GitHub OAuth authorization URL (Step 2).
 *
 * @param {{ clientId: string, redirectUri: string, state?: string }} options
 */
export function buildGitHubAuthorizeUrl({ clientId, redirectUri, state = '' }) {
  if (!clientId) {
    throw new Error('GitHub OAuth Client ID is not configured.');
  }
  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', clientId);
  if (redirectUri) {
    url.searchParams.set('redirect_uri', redirectUri);
  }
  url.searchParams.set('scope', 'read:user');
  if (state) {
    url.searchParams.set('state', state);
  }
  return url.toString();
}

/**
 * Exchange a GitHub OAuth `?code=...` via our backend `/api/github-auth` endpoint (Steps 3 & 4).
 *
 * @param {string} code
 * @param {typeof fetch} [fetchImpl]
 */
export async function exchangeGitHubCode(code, fetchImpl = globalThis.fetch) {
  const cleanCode = String(code ?? '').trim();
  if (!cleanCode) {
    throw new Error('Missing GitHub OAuth authorization code.');
  }

  const response = await fetchImpl(`/api/github-auth?code=${encodeURIComponent(cleanCode)}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.user) {
    throw new Error(payload.error || 'GitHub OAuth authentication failed.');
  }

  return payload.user;
}

/**
 * Fetch a GitHub user profile from the public GitHub API (used by unit tests or profile lookup).
 *
 * @param {string} username
 * @param {typeof fetch} [fetchImpl]
 */
export async function fetchGitHubUser(username, fetchImpl = globalThis.fetch) {
  const clean = String(username ?? '').trim().replace(/^@/, '');
  if (!/^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i.test(clean)) {
    throw new Error('Enter a valid GitHub username (letters, numbers, and single hyphens).');
  }

  const response = await fetchImpl(`https://api.github.com/users/${encodeURIComponent(clean)}`, {
    headers: { Accept: 'application/vnd.github+json' },
  });

  if (response.status === 404) {
    throw new Error(`GitHub user "@${clean}" was not found.`);
  }

  if (!response.ok) {
    throw new Error('Failed to verify GitHub user.');
  }

  const data = await response.json();
  return {
    login: data.login,
    id: data.id,
    name: data.name || data.login,
    avatarUrl: data.avatar_url || `https://github.com/${data.login}.png?size=160`,
    htmlUrl: data.html_url || `https://github.com/${data.login}`,
    bio: data.bio || 'GitHub Player',
    publicRepos: data.public_repos ?? 0,
    followers: data.followers ?? 0,
    verifiedAt: Date.now(),
  };
}

/**
 * Create the auth store managing the active GitHub user.
 * @param {{storage: object}} options
 */
export function createAuthStore({ storage }) {
  let currentUser = storage.read(STORAGE_KEYS.auth, null);

  function persist() {
    if (currentUser) {
      storage.write(STORAGE_KEYS.auth, currentUser);
    } else {
      storage.remove(STORAGE_KEYS.auth);
    }
  }

  return {
    getUser: () => currentUser,
    isAuthenticated: () => Boolean(currentUser?.login),
    isAdmin: () => isAdminUser(currentUser),

    async completeOAuthCallback(code, fetchImpl) {
      const profile = await exchangeGitHubCode(code, fetchImpl);
      currentUser = profile;
      persist();
      return profile;
    },

    async loginWithGitHub(username, fetchImpl) {
      const profile = await fetchGitHubUser(username, fetchImpl);
      currentUser = profile;
      persist();
      return profile;
    },

    setUser(profile) {
      currentUser = profile;
      persist();
      return currentUser;
    },

    logout() {
      currentUser = null;
      persist();
    },
  };
}
