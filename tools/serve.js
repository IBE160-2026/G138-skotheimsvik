/**
 * A minimal static file server for local development.
 *
 * Node standard library only — no dependencies, in line with NFR-9. ES modules
 * and the Geography content fetch are both blocked by the browser over
 * `file://`, so the app is served over HTTP instead.
 *
 *   npm run serve
 */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import githubAuthHandler from '../api/github-auth.js';
import githubConfigHandler from '../api/github-config.js';
import leaderboardHandler from '../api/leaderboard.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(process.env.PORT ?? 8080);

// Load local .env if present (Node standard library only)
const envPath = join(ROOT, '.env');
if (existsSync(envPath)) {
  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

function wrapRes(response) {
  let statusCode = 200;
  return {
    status(code) {
      statusCode = code;
      return this;
    },
    json(payload) {
      response.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      response.end(JSON.stringify(payload));
    },
  };
}

function readJsonBody(request) {
  return new Promise((resolve) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve({});
      }
    });
    request.on('error', () => resolve({}));
  });
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://localhost:${PORT}`);

  if (url.pathname === '/api/github-config') {
    const reqObj = { method: request.method, query: Object.fromEntries(url.searchParams) };
    await githubConfigHandler(reqObj, wrapRes(response));
    return;
  }

  if (url.pathname === '/api/github-auth') {
    const reqObj = { method: request.method, query: Object.fromEntries(url.searchParams) };
    await githubAuthHandler(reqObj, wrapRes(response));
    return;
  }

  if (url.pathname === '/api/leaderboard') {
    const body = request.method === 'POST' ? await readJsonBody(request) : {};
    const reqObj = {
      method: request.method,
      query: Object.fromEntries(url.searchParams),
      body,
    };
    await leaderboardHandler(reqObj, wrapRes(response));
    return;
  }

  const requested = url.pathname === '/' ? '/index.html' : url.pathname;

  // Resolve inside ROOT only, so a crafted path cannot escape the project.
  const target = normalize(join(ROOT, decodeURIComponent(requested)));
  if (!target.startsWith(ROOT.endsWith(sep) ? ROOT : ROOT + sep)) {
    response.writeHead(403).end('Forbidden');
    return;
  }

  try {
    const body = await readFile(target);
    response.writeHead(200, {
      'Content-Type': MIME[extname(target).toLowerCase()] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    response.end(body);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`LearningHub running at http://localhost:${PORT}`);
});
