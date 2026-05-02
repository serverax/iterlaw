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

console.log('post-next-standalone: static + public copied into standalone bundle');
