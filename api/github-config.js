/**
 * Public GitHub OAuth configuration endpoint (`GET /api/github-config`).
 *
 * Exposes only the public `GITHUB_CLIENT_ID` (never the secret) so the static
 * frontend knows which Client ID to use when redirecting to
 * `https://github.com/login/oauth/authorize`.
 */

export default function handler(req, res) {
  res.status(200).json({
    clientId: process.env.GITHUB_CLIENT_ID || null,
  });
}
