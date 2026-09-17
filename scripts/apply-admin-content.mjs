import { readFile, writeFile } from 'node:fs/promises';
const file='src/components/FootballCentre.astro';
let source=await readFile(file,'utf8');
if(!source.includes("../data/footballCentre.js")){
  const block=/const clubs=\{[\s\S]*?\};\nconst matches=\[[\s\S]*?\];/;
  const replacement=`import { FOOTBALL_CENTRE_CONTENT } from '../data/footballCentre.js';\nconst clubs = FOOTBALL_CENTRE_CONTENT.clubs;\nconst matches = FOOTBALL_CENTRE_CONTENT.matches.map(m => ({ ...m, home: clubs[m.home], away: clubs[m.away] }));`;
  if(!block.test(source)) throw new Error('Could not locate the Football Centre content block. Build stopped.');
  source=source.replace(block,replacement);
}
source=source.replaceAll('src="https://www.youtube.com/embed/KvgulT3RtFE"','src={FOOTBALL_CENTRE_CONTENT.videoEmbedUrl}');
source=source.replaceAll('href="https://www.youtube.com/watch?v=KvgulT3RtFE"','href={FOOTBALL_CENTRE_CONTENT.videoWatchUrl}');
await writeFile(file,source,'utf8');
