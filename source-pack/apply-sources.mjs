import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
if (!args.length || args.includes('--help')) {
  console.log('Usage: node apply-sources.mjs <LibreTV-directory> [default|recommended|full|movies|tv|variety|anime|live] [--env-file=.env.local|.env] [--dry-run]');
  process.exit(args.includes('--help') ? 0 : 1);
}
const projectDir = path.resolve(args[0]);
const profile = args.find((value, i) => i > 0 && !value.startsWith('--')) || 'recommended';
const envName = args.find((value) => value.startsWith('--env-file='))?.split('=')[1] || '.env.local';
if (!['default', 'recommended', 'full', 'movies', 'tv', 'variety', 'anime', 'live'].includes(profile)) throw new Error('Unknown source profile: ' + profile);
if (!['.env', '.env.local'].includes(envName)) throw new Error('Only .env and .env.local are supported');
const pkgPath = path.join(projectDir, 'package.json');
if (!fs.existsSync(pkgPath) || JSON.parse(fs.readFileSync(pkgPath, 'utf8')).name !== 'libretv') {
  throw new Error('Target must be a LibreTV source directory containing package.json');
}
const packDir = path.dirname(fileURLToPath(import.meta.url));
const payload = JSON.parse(fs.readFileSync(path.join(packDir, `sources-${profile}.json`), 'utf8'));
if (!Array.isArray(payload.sources) || !Array.isArray(payload.liveSources)) throw new Error('Invalid source list');
const envPath = path.join(projectDir, envName);
const oldText = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
const newline = oldText.includes('\r\n') ? '\r\n' : '\n';
const values = { DEFAULT_SOURCES: payload.sources, DEFAULT_LIVE_SOURCES: payload.liveSources };
let updated = oldText;
for (const [key, value] of Object.entries(values)) {
  const line = key + "='" + JSON.stringify(value) + "'";
  const matcher = new RegExp('^[ \\t]*' + key + '[ \\t]*=.*$', 'gm');
  let replaced = false;
  updated = updated.replace(matcher, () => { if (replaced) return ''; replaced = true; return line; });
  if (!replaced) updated += (updated && !updated.endsWith('\n') ? newline : '') + line + newline;
}
console.log(`Profile ${profile}: ${payload.sources.length} VOD sources, ${payload.liveSources.length} live playlists`);
console.log(`Target: ${envPath}`);
if (args.includes('--dry-run')) { console.log('Dry run: no files changed.'); process.exit(0); }
if (oldText) {
  const stamp = new Date().toISOString().replaceAll(/[-:.TZ]/g, '');
  const backup = path.join(projectDir, `.env.sources-backup.${stamp}.local`);
  fs.copyFileSync(envPath, backup, fs.constants.COPYFILE_EXCL);
  console.log('Backup: ' + backup);
}
fs.writeFileSync(envPath, updated);
console.log('Source settings saved. Existing password and other settings were preserved. Restart LibreTV to load them.');
if (!/^[ \t]*PASSWORD[ \t]*=.+$/m.test(updated)) console.log('Set PASSWORD in your environment file before starting LibreTV.');
