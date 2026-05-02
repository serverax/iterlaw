/**
 * Copy traced static assets into the standalone bundle (required for Azure SWA / Node hosting).
 * @see https://learn.microsoft.com/en-us/azure/static-web-apps/deploy-nextjs-hybrid#enable-standalone-feature
 */
const fs = require('fs');
const path = require('path');

const appRoot = path.join(__dirname, '..');
const standaloneApp = path.join(appRoot, '.next', 'standalone', 'apps', 'web');
const nextStatic = path.join(appRoot, '.next', 'static');
const standaloneStatic = path.join(standaloneApp, '.next', 'static');
const pub = path.join(appRoot, 'public');
const standalonePub = path.join(standaloneApp, 'public');

function cpDir(src, dest) {
  fs.cpSync(src, dest, { recursive: true });
}

if (!fs.existsSync(standaloneApp)) {
  console.error('post-next-standalone: missing', standaloneApp);
  process.exit(1);
}

if (!fs.existsSync(nextStatic)) {
  console.error('post-next-standalone: missing', nextStatic);
  process.exit(1);
}

fs.mkdirSync(path.dirname(standaloneStatic), { recursive: true });
fs.rmSync(standaloneStatic, { recursive: true, force: true });
cpDir(nextStatic, standaloneStatic);

if (fs.existsSync(pub)) {
  fs.rmSync(standalonePub, { recursive: true, force: true });
  cpDir(pub, standalonePub);
}

// Standalone output is deployed without the monorepo `packages/` tree; file:../../packages/shared
// breaks Azure SWA's follow-up `npm install` (invalid / missing path). Shared code is already traced
// into the server bundle — drop the workspace dependency from the deploy manifest.
const pkgPath = path.join(standaloneApp, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
if (pkg.dependencies && pkg.dependencies['@rightsnow/shared']) {
  delete pkg.dependencies['@rightsnow/shared'];
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
}

console.log('post-next-standalone: static + public copied; trimmed workspace dep from standalone package.json');
