import { Router } from 'express';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  const webAppUrl = process.env.WEB_APP_URL;
  if (webAppUrl) {
    res.redirect(302, webAppUrl);
    return;
  }
  res.type('html').send(`<!DOCTYPE html>
<html lang="en-GB">
<head><meta charset="utf-8"><title>IterLaw API</title></head>
<body style="font-family:system-ui,sans-serif;max-width:40rem;margin:2rem auto;padding:0 1rem">
  <h1>IterLaw API</h1>
  <p>This port serves the <strong>backend API</strong>, not the web app.</p>
  <p>Health: <a href="/health">/health</a></p>
  <p>Web UI (Next.js): run <code>npm run dev</code> from the repo root — default <a href="http://localhost:3001">http://localhost:3001</a></p>
</body>
</html>`);
});

healthRouter.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'iterlaw-api' });
});
