import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log('Usage: node check-sources.mjs [recommended|full|movies|tv|variety|anime] [--keyword=关键词] [--output=report.json]');
  process.exit(0);
}
const profile = args.find((arg) => !arg.startsWith('--')) || 'recommended';
if (!['recommended', 'full', 'movies', 'tv', 'variety', 'anime'].includes(profile)) throw new Error('Unknown profile');
const keyword = args.find((arg) => arg.startsWith('--keyword='))?.slice('--keyword='.length) || ({ movies: '流浪地球', tv: '庆余年', variety: '你好星期六' }[profile] || '葬送的芙莉莲');
const packDir = path.dirname(fileURLToPath(import.meta.url));
const sources = JSON.parse(fs.readFileSync(path.join(packDir, `sources-${profile}.json`), 'utf8')).sources;
const results = [];
let cursor = 0;
await Promise.all(Array.from({ length: Math.min(4, sources.length) }, async () => {
  while (cursor < sources.length) {
    const source = sources[cursor++];
    const tick = Date.now();
    let result;
    try {
      const url = new URL(source.url);
      url.searchParams.set('ac', 'videolist');
      url.searchParams.set('wd', keyword);
      const response = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();
      if (json.list !== null && !Array.isArray(json.list)) throw new Error('Not an Apple CMS list response');
      result = { name: source.name, url: source.url, searchAccessible: true, count: json.list?.length || 0, ms: Date.now() - tick };
    } catch (error) {
      result = { name: source.name, url: source.url, searchAccessible: false, ms: Date.now() - tick, error: error.message };
    }
    results.push(result);
    console.log(`${result.searchAccessible ? 'OK' : 'FAIL'} ${source.name}: ${result.searchAccessible ? result.count + ' results' : result.error}`);
  }
}));
const output = path.resolve(args.find((arg) => arg.startsWith('--output='))?.slice('--output='.length) || `source-recheck-${Date.now()}.json`);
fs.writeFileSync(output, JSON.stringify({ checkedAt: new Date().toISOString(), keyword, scope: 'Search API only; playback is not tested', results }, null, 2));
console.log('Saved: ' + output);
