import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const profiles = ['default', 'recommended', 'full', 'movies', 'tv', 'variety', 'anime', 'live'];

/** Create device-specific credentials once. Existing environment files stay intact. */
export function setupLocalEnv(projectDir, profile = 'default') {
  if (!profiles.includes(profile)) throw new Error('Unknown source profile: ' + profile);
  const pkg = JSON.parse(fs.readFileSync(path.join(projectDir, 'package.json'), 'utf8'));
  if (pkg.name !== 'libretv') throw new Error('Target must be a LibreTV source directory');
  const envPath = path.join(projectDir, '.env.local');
  if (fs.existsSync(envPath)) return { created: false, envPath };
  const sources = JSON.parse(fs.readFileSync(path.join(projectDir, 'source-pack', `sources-${profile}.json`), 'utf8'));
  if (!Array.isArray(sources.sources) || !Array.isArray(sources.liveSources)) throw new Error('Invalid source profile');
  const contents = [
    '# Local credentials: never commit this file.',
    `PASSWORD=${randomBytes(24).toString('base64url')}`,
    `PROXY_SECRET=${randomBytes(32).toString('hex')}`,
    'NEXT_TELEMETRY_DISABLED=1',
    'DEFAULT_RECOMMEND_SOURCE=douban',
    `DEFAULT_SOURCES='${JSON.stringify(sources.sources)}'`,
    `DEFAULT_LIVE_SOURCES='${JSON.stringify(sources.liveSources)}'`,
    '',
  ].join('\n');
  fs.writeFileSync(envPath, contents, { flag: 'wx', mode: 0o600 });
  return { created: true, envPath, profile, vod: sources.sources.length, live: sources.liveSources.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = setupLocalEnv(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), process.argv[2] || 'default');
    console.log(result.created ? `Created ${result.envPath} (${result.vod} VOD, ${result.live} live).` : `Existing ${result.envPath} was preserved.`);
    console.log('Read PASSWORD in that file to log in. Build with npm run build, then start the application.');
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
