/**
 * Gamemode Favorites & Likes/Dislikes Store.
 *
 * - Favorites: Each user can favorite gamemodes (`categoryId`) so they appear
 *   at the top of the home screen in the exact order they were favorited.
 *   Favorited gamemodes can also be reordered (moved earlier/later).
 * - Likes & Dislikes: Each user gets at most 1 vote (`'like'` or `'dislike'`)
 *   per gamemode (`categoryId`). Toggling the same vote removes it; switching
 *   from like to dislike (or vice versa) updates the user's vote.
 */

import { STORAGE_KEYS } from './storage.js';

function normaliseLogin(user) {
  const raw = typeof user === 'string' ? user : user?.login;
  const clean = String(raw ?? '').trim().toLowerCase();
  return clean || '__guest__';
}

/**
 * @param {{ storage: { read: Function, write: Function } }} options
 */
export function createPreferencesStore({ storage }) {
  function readState() {
    const raw = storage.read(STORAGE_KEYS.preferences, null);
    return {
      favoritesByUser: raw?.favoritesByUser && typeof raw.favoritesByUser === 'object' ? { ...raw.favoritesByUser } : {},
      votesByCategory: raw?.votesByCategory && typeof raw.votesByCategory === 'object' ? { ...raw.votesByCategory } : {},
    };
  }

  function writeState(state) {
    storage.write(STORAGE_KEYS.preferences, state);
  }

  /**
   * Return the ordered list of favorited categoryIds for a user.
   */
  function getFavorites(user) {
    const login = normaliseLogin(user);
    const state = readState();
    const list = state.favoritesByUser[login];
    return Array.isArray(list) ? [...list] : [];
  }

  function isFavorite(user, categoryId) {
    if (!categoryId) return false;
    return getFavorites(user).includes(categoryId);
  }

  /**
   * Toggle a gamemode in the user's favorites list.
   * Newly favorited gamemodes are appended to the end of the user's favorites
   * so favorites appear at the top in the order they were favorited.
   */
  function toggleFavorite(user, categoryId) {
    if (!categoryId) return [];
    const login = normaliseLogin(user);
    const state = readState();
    const current = Array.isArray(state.favoritesByUser[login])
      ? [...state.favoritesByUser[login]]
      : [];
    const idx = current.indexOf(categoryId);
    if (idx >= 0) {
      current.splice(idx, 1);
    } else {
      current.push(categoryId);
    }
    state.favoritesByUser[login] = current;
    writeState(state);
    return [...current];
  }

  /**
   * Move a favorited gamemode up (-1) or down (+1) in the user's favorite order.
   */
  function moveFavorite(user, categoryId, delta) {
    const login = normaliseLogin(user);
    const state = readState();
    const current = Array.isArray(state.favoritesByUser[login])
      ? [...state.favoritesByUser[login]]
      : [];
    const idx = current.indexOf(categoryId);
    if (idx < 0) return current;
    const targetIdx = idx + delta;
    if (targetIdx < 0 || targetIdx >= current.length) return current;
    const [item] = current.splice(idx, 1);
    current.splice(targetIdx, 0, item);
    state.favoritesByUser[login] = current;
    writeState(state);
    return [...current];
  }

  /**
   * Sort categories so favorited categories appear first (in favorite order),
   * followed by non-favorited categories in their original order.
   */
  function sortCategories(categories, user) {
    const favs = getFavorites(user);
    if (favs.length === 0) return [...categories];
    const favIndex = new Map(favs.map((id, index) => [id, index]));
    return [...categories].sort((a, b) => {
      const aFav = favIndex.has(a.id);
      const bFav = favIndex.has(b.id);
      if (aFav && bFav) return favIndex.get(a.id) - favIndex.get(b.id);
      if (aFav) return -1;
      if (bFav) return 1;
      return 0;
    });
  }

  /**
   * Get aggregate likes, dislikes, and the current user's vote for a gamemode.
   * @returns {{ likes: number, dislikes: number, userVote: 'like' | 'dislike' | null }}
   */
  function getReaction(categoryId, user) {
    const login = normaliseLogin(user);
    const state = readState();
    const votes = state.votesByCategory[categoryId];
    if (!votes || typeof votes !== 'object') {
      return { likes: 0, dislikes: 0, userVote: null };
    }
    let likes = 0;
    let dislikes = 0;
    for (const v of Object.values(votes)) {
      if (v === 'like') likes += 1;
      else if (v === 'dislike') dislikes += 1;
    }
    const userVote = votes[login] === 'like' || votes[login] === 'dislike' ? votes[login] : null;
    return { likes, dislikes, userVote };
  }

  /**
   * Cast or toggle a `'like'` or `'dislike'` vote for `categoryId`.
   * Strictly 1 vote per user per gamemode. Clicking the active vote removes it.
   */
  function vote(user, categoryId, voteType) {
    if (!categoryId || (voteType !== 'like' && voteType !== 'dislike')) {
      return getReaction(categoryId, user);
    }
    const login = normaliseLogin(user);
    const state = readState();
    const currentVotes =
      state.votesByCategory[categoryId] && typeof state.votesByCategory[categoryId] === 'object'
        ? { ...state.votesByCategory[categoryId] }
        : {};

    if (currentVotes[login] === voteType) {
      delete currentVotes[login];
    } else {
      currentVotes[login] = voteType;
    }

    state.votesByCategory[categoryId] = currentVotes;
    writeState(state);
    return getReaction(categoryId, user);
  }

  return {
    getFavorites,
    isFavorite,
    toggleFavorite,
    moveFavorite,
    sortCategories,
    getReaction,
    vote,
  };
}
