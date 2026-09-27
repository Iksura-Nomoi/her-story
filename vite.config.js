import { resolve, dirname, join } from 'path';
import { readdirSync, statSync, mkdirSync, copyFileSync } from 'fs';
import { defineConfig, loadEnv } from 'vite';

// The app shell fetches per-app HTML templates at runtime (TemplateLoader ->
// fetch('src/apps/.../XApp.html')) instead of importing them as modules, so
// Vite's bundler never sees them and they don't end up in dist/ on their
// own. This plugin copies every *.html template Vite doesn't already handle
// (i.e. everything except the real HTML entry points) into the same
// relative path inside dist/, so those runtime fetches keep working in a
// production build exactly like they do under `vite dev`.
function copyRuntimeTemplatesPlugin() {
  const root = import.meta.dirname;
  let outDir = 'dist';
  const skipDirs = new Set(['node_modules', 'dist', '.git']);

  function walk(dir, cb) {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        if (!skipDirs.has(entry)) walk(full, cb);
      } else if (entry.endsWith('.html')) {
        cb(full);
      }
    }
  }

  return {
    name: 'copy-runtime-templates',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      walk(join(root, 'src'), (file) => {
        const rel = file.slice(root.length + 1);
        const dest = join(root, outDir, rel);
        mkdirSync(dirname(dest), { recursive: true });
        copyFileSync(file, dest);
      });
    }
  };
}

// `vercel dev` runs files under /api/ as real serverless functions, but a
// plain `vite dev` never touches that folder — so DevToolsAuth's fetch to
// /api/check-devtools-password used to just fail on localhost, which is why
// the client used to special-case localhost and skip the real check
// entirely. Instead, this plugin mounts the *actual* handler (same file
// Vercel deploys) as Vite dev-server middleware, so `npm run dev` exercises
// the identical sha256-hash-against-Firestore check that production uses.
// It needs the same server-side Firebase Admin credentials Vercel is
// configured with (FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL /
// FIREBASE_PRIVATE_KEY) — put them in .env locally to test against the
// real password; without them the endpoint reports "Not configured yet."
// just like it would on Vercel if those env vars were missing there.
function devToolsAuthApiPlugin(env) {
  return {
    name: 'devtools-auth-api-dev-middleware',
    apply: 'serve',
    configureServer(server) {
      for (const [key, value] of Object.entries(env)) {
        if (value !== undefined && process.env[key] === undefined) process.env[key] = value;
      }

      server.middlewares.use('/api/check-devtools-password', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        try {
          const chunks = [];
          for await (const chunk of req) chunks.push(chunk);
          let body = {};
          try { body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch {}
          req.body = body;

          const mod = await server.ssrLoadModule('/api/check-devtools-password.js');
          const status = { code: 200 };
          const fakeRes = {
            setHeader: (name, value) => res.setHeader(name, value),
            status(code) { status.code = code; return this; },
            json(payload) {
              res.statusCode = status.code;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(payload));
            }
          };
          await mod.default(req, fakeRes);
        } catch (err) {
          console.error('[devtools-auth-api-dev-middleware] error:', err);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: false, error: 'Internal error.' }));
        }
      });
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, '');
  return {
  plugins: [copyRuntimeTemplatesPlugin(), devToolsAuthApiPlugin(env)],
  // CheerpX (Terminal's real Linux VM) needs SharedArrayBuffer, which needs
  // cross-origin isolation even on localhost. Same headers as vercel.json.
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        '404': resolve(import.meta.dirname, '404.html'),
        'developer-notes': resolve(import.meta.dirname, 'developer-notes.html'),
        'privacy': resolve(import.meta.dirname, 'privacy.html')
      },
      output: {
        entryFileNames: `assets/[hash].js`,
        chunkFileNames: `assets/[hash].js`,
        assetFileNames: `assets/[hash].[ext]`
      }
    }
  }
  };
});
