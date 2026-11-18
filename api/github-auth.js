/**
 * Vercel Serverless Function (`GET /api/github-auth?code=...`)
 *
 * Implements Steps 3 & 4 of the GitHub OAuth flow:
 *   1. Exchanges the temporary `?code=<AUTH_CODE>` from GitHub's redirect for
 *      an OAuth `access_token` via `https://github.com/login/oauth/access_token`.
 *   2. Uses the `access_token` to fetch the authenticated user's real profile
 *      from `https://api.github.com/user`.
 *   3. Returns the verified user object (`login`, `id`, `name`, `avatarUrl`, etc.)
 *      to the frontend.
 */

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const code = req.query?.code || req.body?.code;
  if (!code || typeof code !== 'string') {
    res.status(400).json({ error: 'Missing GitHub authorization code.' });
    return;
  }

  const clientId = process.env.GITHUB_CLIENT_ID || process.env.GITHUB_CLIENT_KEY;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    res.status(500).json({
      error:
        'Server is missing GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET environment variables.',
    });
    return;
  }

  try {
    // Step 4a: Exchange authorization code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || tokenData.error || !tokenData.access_token) {
      res.status(401).json({
        error: tokenData.error_description || tokenData.error || 'Failed to exchange GitHub OAuth code.',
      });
      return;
    }

    const accessToken = tokenData.access_token;

    // Step 4b: Fetch authenticated user profile from GitHub API
    const userProfileResponse = await fetch('https://api.github.com/user', {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${accessToken}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'LearningHub-OAuth',
      },
    });

    if (!userProfileResponse.ok) {
      res.status(401).json({ error: 'Failed to fetch authenticated user from GitHub.' });
      return;
    }

    const userData = await userProfileResponse.json();
    res.status(200).json({
      user: {
        login: userData.login,
        id: userData.id,
        avatarUrl: userData.avatar_url || `https://github.com/${userData.login}.png?size=160`,
        htmlUrl: userData.html_url || `https://github.com/${userData.login}`,
        verifiedAt: Date.now(),
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'GitHub authentication failed.' });
  }
}
