import { readFile, writeFile } from 'node:fs/promises';

const file = 'src/components/FootballCentre.astro';
let source = await readFile(file, 'utf8');

if (!source.includes("../data/footballCentre.js")) {
  const block = /const clubs=\{[\s\S]*?\};\nconst matches=\[[\s\S]*?\];/;
  const replacement = `import { FOOTBALL_CENTRE_CONTENT } from '../data/footballCentre.js';
const clubs = FOOTBALL_CENTRE_CONTENT.clubs;
const matches = FOOTBALL_CENTRE_CONTENT.matches.map(m => ({ ...m, home: clubs[m.home], away: clubs[m.away] }));`;
  if (!block.test(source)) throw new Error('Could not locate the Football Centre content block. Build stopped.');
  source = source.replace(block, replacement);
}

const staticReplacements = [
  ['<div class="fcx" data-fcx data-page={page} data-total-showdowns={totalShowdowns}>', '<div class="fcx" data-fcx data-page={page} data-total-showdowns={totalShowdowns} data-cycle-id={FOOTBALL_CENTRE_CONTENT.settings.cycleId} data-starting-balance={FOOTBALL_CENTRE_CONTENT.settings.startingBalance} data-score-played={FOOTBALL_CENTRE_CONTENT.settings.scoring.played} data-score-world={FOOTBALL_CENTRE_CONTENT.settings.scoring.worldClass} data-score-correct={FOOTBALL_CENTRE_CONTENT.settings.scoring.correctPrediction}>'],
  ['SEPTEMBER 2026 · ACTIVE CYCLE', '{FOOTBALL_CENTRE_CONTENT.cycle.label}'],
  ['Football Centre progress', '{FOOTBALL_CENTRE_CONTENT.cycle.title}'],
  ['Eight Showdowns across four weeks. Earn 80 points for each played match, +20 for World Class and +400 for a correct team prediction.', '{FOOTBALL_CENTRE_CONTENT.cycle.description}'],
  ['Think before you pick', '{FOOTBALL_CENTRE_CONTENT.analysis.title}'],
  ['⚠ Pick at your own risk. Analysis is informational only and is not a guarantee. Football is unpredictable. No prediction here is certain.', '{FOOTBALL_CENTRE_CONTENT.analysis.warning}'],
  ['TOTW UPDATE', '{FOOTBALL_CENTRE_CONTENT.analysis.label}'],
  ['Release timing video', '{FOOTBALL_CENTRE_CONTENT.analysis.videoTitle}'],
  ['This video contains information about the expected timing of the TOTW release. The content shown may not be in the game yet.', '{FOOTBALL_CENTRE_CONTENT.analysis.videoBody}'],
  ['Do not treat timing as a confirmed in-game release until the content is actually available.', '{FOOTBALL_CENTRE_CONTENT.analysis.videoWarning}'],
  ['TEAM OF THE WEEK', '{FOOTBALL_CENTRE_CONTENT.totw.label}'],
  ['TOTW release tracker', '{FOOTBALL_CENTRE_CONTENT.totw.title}'],
  ['Use the analysis video for timing context. This page does not claim a TOTW is live until the content is actually available.', '{FOOTBALL_CENTRE_CONTENT.totw.description}'],
  ['LIVE CHECK', '{FOOTBALL_CENTRE_CONTENT.totw.chip}'],
  ['RELEASE STATUS', '{FOOTBALL_CENTRE_CONTENT.totw.statusLabel}'],
  ['Check before claiming', '{FOOTBALL_CENTRE_CONTENT.totw.statusTitle}'],
  ['There is no fake player list here. When the official TOTW content is confirmed, this section can be populated without changing the Football Centre scoring system.', '{FOOTBALL_CENTRE_CONTENT.totw.statusBody}'],
  ['SAFETY NOTE', '{FOOTBALL_CENTRE_CONTENT.totw.safetyLabel}'],
  ['No guaranteed predictions', '{FOOTBALL_CENTRE_CONTENT.totw.safetyTitle}'],
  ['Analysis and timing information are informational only. Football Centre rewards are based on your recorded match outcomes.', '{FOOTBALL_CENTRE_CONTENT.totw.safetyBody}'],
  ['Played +80', '{`Played +${FOOTBALL_CENTRE_CONTENT.settings.scoring.played}`}'],
  ['World Class +20', '{`World Class +${FOOTBALL_CENTRE_CONTENT.settings.scoring.worldClass}`}'],
  ['Correct +400', '{`Correct +${FOOTBALL_CENTRE_CONTENT.settings.scoring.correctPrediction}`}'],
  ['+80 for every played match', '{`+${FOOTBALL_CENTRE_CONTENT.settings.scoring.played} for every played match`}'],
  ['+20 only for World Class', '{`+${FOOTBALL_CENTRE_CONTENT.settings.scoring.worldClass} only for World Class`}'],
  ['+400 correct prediction', '{`+${FOOTBALL_CENTRE_CONTENT.settings.scoring.correctPrediction} correct prediction`}'],
  ['Locked event rules', 'Current event rules'],
  ['src="https://www.youtube.com/embed/KvgulT3RtFE"', 'src={FOOTBALL_CENTRE_CONTENT.analysis.videoEmbedUrl}'],
  ['href="https://www.youtube.com/watch?v=KvgulT3RtFE"', 'href={FOOTBALL_CENTRE_CONTENT.analysis.videoWatchUrl}']
];
for (const [from, to] of staticReplacements) source = source.replaceAll(from, to);

const runtimeStart = "(()=>{const root=document.querySelector('[data-fcx]');if(!root)return;const KEY='tanzimfc_football_centre_v13',OLD_KEYS=['tanzimfc_football_centre_v12','tanzimfc_football_centre_v11'];const total=Number(root.dataset.totalShowdowns)||8;const base=()=>({version:13,cycleId:'2026-09',startingBalance:0,matches:{},ledger:[],claims:{}});";
const runtimeReplacement = "(()=>{const root=document.querySelector('[data-fcx]');if(!root)return;const cycleId=root.dataset.cycleId||'2026-09';const scorePlayed=Number(root.dataset.scorePlayed)||80;const scoreWorld=Number(root.dataset.scoreWorld)||20;const scoreCorrect=Number(root.dataset.scoreCorrect)||400;const KEY='tanzimfc_football_centre_v13:'+cycleId,OLD_KEYS=['tanzimfc_football_centre_v12','tanzimfc_football_centre_v11'];const total=Number(root.dataset.totalShowdowns)||8;const base=()=>({version:13,cycleId,startingBalance:Number(root.dataset.startingBalance)||0,matches:{},ledger:[],claims:{}});";
if (!source.includes(runtimeStart)) throw new Error('Could not locate the Football Centre runtime configuration. Build stopped.');
source = source.replace(runtimeStart, runtimeReplacement);
source = source.replaceAll('const points=80+(m.worldClass?20:0)+(m.prediction===m.result?400:0);', 'const points=scorePlayed+(m.worldClass?scoreWorld:0)+(m.prediction===m.result?scoreCorrect:0);');
source = source.replaceAll('Correct prediction. +80 base +400 correct', 'Correct prediction. +${scorePlayed} base +${scoreCorrect} correct');
source = source.replaceAll('Wrong prediction. +80 base', 'Wrong prediction. +${scorePlayed} base');
source = source.replaceAll(' +20 World Class.', ' +${scoreWorld} World Class.');

await writeFile(file, source, 'utf8');
