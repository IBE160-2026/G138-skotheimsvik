/**
 * GitHub Authentication & User Profile Store.
 *
 * Connects to the public GitHub REST API (`https://api.github.com/users/<username>`)
 * to verify and fetch real GitHub developer profiles (avatar, display name, handle,
 * bio, public repos, followers) without requiring private OAuth client secrets.
 *
 * A logged-in GitHub user is required before playing rounds, allowing scores and
 * Word Rush results to be tracked per user on the Daily and All-Time Leaderboards.
 */

import { STORAGE_KEYS } from './storage.js';

/**
 * Fetch a GitHub user profile from the public GitHub API.
 * Falls back gracefully if offline or rate-limited when a valid handle is given.
 *
 * @param {string} username
 * @param {typeof fetch} [fetchImpl]
 */
export async function fetchGitHubUser(username, fetchImpl = globalThis.fetch) {
  const clean = String(username ?? '').trim().replace(/^@/, '');
  if (!/^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i.test(clean)) {
    throw new Error('Enter a valid GitHub username (letters, numbers, and single hyphens).');
  }

  try {
    const response = await fetchImpl(`https://api.github.com/users/${encodeURIComponent(clean)}`, {
      headers: { Accept: 'application/vnd.github+json' },
    });

    if (response.status === 404) {
      throw new Error(`GitHub user "@${clean}" was not found.`);
    }

    if (response.ok) {
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
  } catch (error) {
    if (error.message?.includes('not found') || error.message?.includes('valid GitHub')) {
      throw error;
    }
  }

  // Fallback if API rate limit is reached
  return {
    login: clean,
    id: clean.toLowerCase(),
    name: clean,
    avatarUrl: `https://github.com/${encodeURIComponent(clean)}.png?size=160`,
    htmlUrl: `https://github.com/${encodeURIComponent(clean)}`,
    bio: 'GitHub Player',
    publicRepos: 0,
    followers: 0,
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
