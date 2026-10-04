import { chromium } from "playwright";
import { mkdir, writeFile, appendFile } from "node:fs/promises";

const BASE = process.env.PLAYER_SOURCE_BASE_URL || "https://zenithfcm.com";
const START = process.env.PLAYER_SOURCE_START_URL || BASE + "/players";
const OUT = process.env.PLAYER_COLLECTION_OUTPUT || "scripts/player-collector/data";
const CONCURRENCY = Number(process.env.PLAYER_COLLECT_CONCURRENCY || 6);

await mkdir(OUT,{recursive:true});

function playerIdFromUrl(url){
  const m = url.match(/-(\d+)\/?(?:\?.*)?$/);
  return m ? m[1] : null;
}

async function discoverFromSitemap(){
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage();
  try{
    const r=await page.request.get(BASE+"/sitemap.xml");
    if(!r.ok()) return [];
    const xml=await r.text();
    return [...xml.matchAll(/<loc>\s*(https?:\/\/[^<]+\/player\/[^<]+)\s*<\/loc>/gi)]
      .map(m=>m[1]).filter((u,i,a)=>a.indexOf(u)===i);
  } finally { await browser.close(); }
}

async function discoverFromPlayersPage(page){
  const found=new Set();
  for(let n=1;n<=500;n++){
    const url=n===1?START:(START.includes("?")?START+"&page="+n:START+"?page="+n);
    await page.goto(url,{waitUntil:"domcontentloaded",timeout:45000});
    await page.waitForTimeout(500);
    const links=await page.locator('a[href*="/player/"]').evaluateAll(as=>as.map(a=>a.href));
    for(const href of links) found.add(href);
    if(!links.length) break;
  }
  return [...found];
}

function parseStats(body){
  const categories=["Pace","Shooting","Passing","Dribbling","Defending","Physical","Goalkeeping","Goalkeeper"];
  const stats={};
  for(let i=0;i<categories.length;i++){
    const cat=categories[i];
    const start=body.search(new RegExp("^"+cat+"\\s*$","mi"));
    if(start<0) continue;
    let end=body.length;
    for(const next of categories.slice(i+1)){
      const p=body.search(new RegExp("^"+next+"\\s*$","mi"));
      if(p>=0 && p>start){end=Math.min(end,p);break;}
    }
    const block=body.slice(start,end);
    const top=block.match(new RegExp("^"+cat+"\\s*\\n?(\\d+)$","mi"));
    if(top) stats[cat]=Number(top[1]);
    for(const m of block.matchAll(/^([A-Za-z][A-Za-z &'().-]{1,40})\s*\|\s*(\d+)$/gmi))
      stats[m[1].trim()]=Number(m[2]);
  }
  return stats;
}

async function scrape(page,url){
  for(let attempt=1;attempt<=3;attempt++){
    try{
      await page.goto(url,{waitUntil:"domcontentloaded",timeout:45000});
      await page.waitForTimeout(250);
      const data=await page.evaluate(()=>{
        const body=document.body?.innerText||"";
        const images=[...document.images].map(img=>({
          alt:img.alt||"",url:img.currentSrc||img.src||"",
          width:img.naturalWidth||0,height:img.naturalHeight||0
        })).filter(x=>x.url);
        const h1=document.querySelector("h1")?.textContent?.trim()||"";
        return {body,images,h1};
      });
      const body=data.body, name=data.h1, id=playerIdFromUrl(url);
      if(!id||!name) throw new Error("missing id/name");
      const pick=re=>{const m=body.match(re);return m?m[1].trim():null};
      const ovr=Number(pick(/OVR\s+(\d+)/i)||0)||null;
      const position=pick(/OVR\s+\d+\s+•\s+([A-Z0-9]+)/i);
      const nation=pick(/OVR\s+\d+\s+•\s+[A-Z0-9]+\s+•\s+([^•\n]+)/i);
      const club=pick(/Club\s+([^\n]+)/i);
      const league=pick(/League\s+([^\n]+)/i);
      const event=pick(/Event Name\s*\n\s*([^\n]+)/i);
      const work=body.match(/Work Rates\s+([A-Za-z]+)\s*\/\s*([A-Za-z]+)/i);
      const size=body.match(/Body\s+(\d+)cm\s*\/\s*(\d+)kg/i);
      const alt=pick(/Alternate Position\s*\n\s*([^\n]+)/i);
      const strong=pick(/Strong Foot\s+([A-Za-z]+)/i);
      const skill=body.match(/Skill Moves\s*\n\s*(★+)/i);
      const weak=body.match(/Weak Foot\s*\n\s*(★+)/i);
      const stats=parseStats(body);
      const imagesOut=[];
      const add=(type,x,primary=false)=>{
        if(!x||!x.url||imagesOut.some(a=>a.type===type)) return;
        imagesOut.push({type,url:x.url,sourceUrl:url,metadata:{alt:x.alt,width:x.width,height:x.height},isPrimary:primary});
      };
      add("card_background",data.images.find(x=>/background/i.test(x.alt)||/background\.(png|webp|jpg)/i.test(x.url)),true);
      add("player_render",data.images.find(x=>x.alt.toLowerCase()===name.toLowerCase()||/-player\.(png|webp|jpg)/i.test(x.url)),true);
      add("nation_flag",data.images.find(x=>/^nation\b/i.test(x.alt)));
      add("club_logo",data.images.find(x=>/^club\b/i.test(x.alt)));
      add("league_logo",data.images.find(x=>/^league\b/i.test(x.alt)));

      return {
        assetId:id,playerId:id,cardName:name,name,rating:ovr,position,
        positions:alt?alt.split(/\s*,\s*/):[],club,league,nation,program:event,
        skillMoves:skill?skill[1].length:null,weakFoot:weak?weak[1].length:null,
        preferredFoot:strong,attackWorkRate:work?.[1]??null,defenseWorkRate:work?.[2]??null,
        height:size?Number(size[1]):null,weight:size?Number(size[2]):null,
        untradeable:/\bUntradable\b/i.test(body),active:true,sourceUrl:url,images:imagesOut,stats
      };
    }catch(e){
      if(attempt===3) throw e;
      await page.waitForTimeout(attempt*1000);
    }
  }
}

const browser=await chromium.launch({headless:true});
const seed=await browser.newPage();
let urls=await discoverFromSitemap();
if(!urls.length) urls=await discoverFromPlayersPage(seed);
await seed.close();

await writeFile(OUT+"/player-urls.json",JSON.stringify(urls,null,2));
console.log("urls",urls.length);

let cursor=0,done=0;
async function worker(){
  const page=await browser.newPage();
  while(cursor<urls.length){
    const url=urls[cursor++];
    try{
      const p=await scrape(page,url);
      await appendFile(OUT+"/players.jsonl",JSON.stringify(p)+"\n");
    }catch(e){
      await appendFile(OUT+"/failed.jsonl",JSON.stringify({url,error:String(e)})+"\n");
    }
    done++;
    if(done%25===0) console.log("progress",done,"/",urls.length);
  }
  await page.close();
}
await Promise.all(Array.from({length:Math.min(CONCURRENCY,urls.length)},worker));
await browser.close();
console.log("collection complete",done);
