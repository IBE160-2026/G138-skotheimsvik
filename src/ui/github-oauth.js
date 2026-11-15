/**
 * GitHub OAuth sign-in page handler (`github-oauth.html`).
 *
 * Authenticates the user against the GitHub REST API, stores the verified
 * GitHub profile in localStorage, and redirects back to LearningHub (`index.html`).
 */

import { createStorage } from '../core/storage.js';
import { createAuthStore } from '../core/auth.js';

const storage = createStorage();
const auth = createAuthStore({ storage });

const params = new URLSearchParams(globalThis.location.search);
const returnRoute = params.get('next') || '';

const form = document.querySelector('#gh-form');
const input = document.querySelector('#gh-username');
const submitBtn = document.querySelector('#gh-submit');
const errorBox = document.querySelector('#gh-error');
const cancelLink = document.querySelector('#gh-cancel');

function buildReturnUrl() {
  const target = new URL('./index.html', globalThis.location.href);
  if (returnRoute) {
    target.searchParams.set('next', returnRoute);
  }
  return target.href;
}

if (cancelLink) {
  cancelLink.href = './index.html';
}

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!input || !submitBtn) return;

  const username = input.value.trim();
  if (!username) return;

  if (errorBox) {
    errorBox.hidden = true;
    errorBox.textContent = '';
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Signing in...';

  try {
    await auth.loginWithGitHub(username);
    globalThis.location.replace(buildReturnUrl());
  } catch (err) {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Authorize & Sign in';
    if (errorBox) {
      errorBox.textContent = err.message || 'Incorrect GitHub username.';
      errorBox.hidden = false;
    }
  }
});
