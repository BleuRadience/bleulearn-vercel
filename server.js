// ============================================================================
// server.js -- the actual server, for ANY Node.js host
// AvaBleu House HQ | BleuLearn Sovereign Curriculum | 2026
//
// This replaces Vercel's filesystem-based serverless routing with a plain
// Express server that does the same thing: every .js file under /api
// becomes a route at the matching path (api/courses.js -> /api/courses,
// api/auth/login.js -> /api/auth/login). It auto-discovers files, so
// adding a new endpoint later means adding a file, not editing this one.
//
// WHY THIS MATTERS: every one of the 34 existing handler files (auth,
// courses, gradebook, the AI review workflow, everything built across
// this project) needed ZERO changes to run here. They were already
// written as `export default async function handler(req, res) {...}`
// using req.method, req.query, req.body, res.status().json() -- which is
// the same shape Express uses natively. Only the database layer
// (lib/db.js) and this routing file needed to be platform-specific code;
// everything else was always portable, it just hadn't been given a
// portable place to run.
//
// RUNS ON: Render, Railway, Coolify, a bare VPS, or your own laptop for
// local development. Listens on process.env.PORT, which every one of
// these platforms sets automatically (falls back to 3000 locally).
// ============================================================================

import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json({ limit: '2mb' }));

// ── Auto-discover and mount every API handler ──────────────────────────
function mountApiRoutes(dir, baseRoute) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      mountApiRoutes(fullPath, `${baseRoute}/${entry.name}`);
    } else if (entry.name.endsWith('.js')) {
      const routeName = entry.name.replace(/\.js$/, '');
      const routePath = `${baseRoute}/${routeName}`;
      // Dynamic import + Express handler adapter. Each handler file
      // already exports a function shaped exactly like an Express route
      // handler, so this is a direct pass-through, not a translation layer.
      app.all(routePath, async (req, res) => {
        try {
          const mod = await import(`./${path.relative(__dirname, fullPath)}`);
          await mod.default(req, res);
        } catch (err) {
          console.error(`Error in ${routePath}:`, err);
          if (!res.headersSent) {
            res.status(500).json({ error: 'Internal server error.', detail: err.message });
          }
        }
      });
      console.log(`Mounted ${routePath}`);
    }
  }
}

const apiDir = path.join(__dirname, 'api');
if (fs.existsSync(apiDir)) {
  mountApiRoutes(apiDir, '/api');
}

// ── Static file serving for the entire content platform ────────────────
// Every strand page, worksheet, lesson plan, the admin panel, login page,
// etc. -- all 180+ static HTML/CSS/JS files -- served exactly as they
// were on Vercel, with no changes needed.
app.use(express.static(__dirname, { extensions: ['html'] }));

// 404 fallback matching the existing custom 404 page if present.
app.use((req, res) => {
  const custom404 = path.join(__dirname, '404.html');
  if (fs.existsSync(custom404)) {
    res.status(404).sendFile(custom404);
  } else {
    res.status(404).send('Not found.');
  }
});

const PORT = process.env.PORT || 3000;
// Explicit '0.0.0.0' rather than relying on Node's unstated default.
// Coolify's reverse proxy (Traefik) connects to the container over its
// internal Docker network, not localhost -- a server that only accepts
// 127.0.0.1 connections is unreachable from the proxy even though the
// container itself reports as running. This is a documented, specific
// failure mode for exactly this kind of deployment, so it is made
// explicit here instead of trusting an implicit default to be right.
app.listen(PORT, '0.0.0.0', () => {
  console.log(`BleuLearn platform running on 0.0.0.0:${PORT}`);
  console.log(`Database configured: ${Boolean(process.env.DATABASE_URL)}`);
  console.log(`AI generator configured: ${Boolean(process.env.ANTHROPIC_API_KEY)}`);
});
