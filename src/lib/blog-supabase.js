// Runtime blog data layer. Published editorial content is read from Supabase at request time.
// No GitHub commit or Astro rebuild is required when an article changes.
import { decorate, slugify } from './blog.js';

export const SUPABASE_URL = 'https://moczgrwxtfexdbjthxpd.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_twe_ZNKiHXUB4b_J_RjGEA_rPKZrqbr';

const cleanText = (html) => String(html || '')
  .replace(/<script[\\s\\S]*?<\\/script>/gi,' ')
  .replace(/<style[\\s\\S]*?<\\/style>/gi,' ')
  .replace(/<[^>]+>/g,' ')
  .replace(/&(?:nbsp|amp|lt|gt|quot|#39);/gi,' ')
  .replace(/\\s+/g,' ')
  .trim();

const safeHtml = (html) => {
  let value=String(html || '');
  value=value.replace(/<!--[\\s\\S]*?-->/g,'');
  value=value.replace(/<\\/?(?:script|style|template|object|embed|form|input|textarea|button)[^>]*>/gi,'');
  value=value.replace(/\\s+on[a-z]+\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s>]+)/gi,'');
  value=value.replace(/\\s+(?:href|src)\\s*=\\s*(['"])\\s*javascript:[\\s\\S]*?\\1/gi,'');
  value=value.replace(/<iframe([^>]+)>/gi,(full,attrs)=>{
    const match=attrs.match(/\\s+src\\s*=\\s*(['"])([^'"]+)\\1/i);
    if(!match) return '';
    try{
      const u=new URL(match[2]);
      if(!['www.youtube.com','youtube.com','www.youtube-nocookie.com','youtube-nocookie.com'].includes(u.hostname.toLowerCase())) return '';
    }catch{return '';}
    return '<iframe'+attrs+'>';
  });
  return value;
};

function tocFromHtml(html){
  const used=new Map();
  const toc=[];
  const body=String(html||'');
  const output=body.replace(/<h([23])([^>]*)>([\\s\\S]*?)<\\/h\\1>/gi,(full,depth,attrs,inner)=>{
    const text=cleanText(inner);
    if(!text) return full;
    const base=slugify(text)||'section';
    const n=(used.get(base)||0)+1; used.set(base,n);
    const id=n===1?base:base+'-'+n;
    const stripped=String(attrs||'').replace(/\\s+id\\s*=\\s*(?:"[^"]*"|'[^']*')/gi,'');
    toc.push({text,id,depth:Number(depth)});
    return '<h'+depth+(stripped||'')+' id="'+id+'">'+inner+'</h'+depth+'>';
  });
  return {html:output,toc};
}

async function getJson(path){
  const response=await fetch(SUPABASE_URL+'/rest/v1/'+path,{
    headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+SUPABASE_PUBLISHABLE_KEY,Accept:'application/json'},
    cf:{cacheTtl:15,cacheEverything:true}
  });
  if(!response.ok) throw new Error('Unable to load published editorial content.');
  return response.json();
}

function remoteEntry(row){
  const raw=safeHtml(row.content_html||'');
  const prepared=tocFromHtml(raw);
  const published=row.published_at ? new Date(row.published_at) : null;
  const updated=row.updated_at ? new Date(row.updated_at) : published;
  const data={
    title:row.title,subtitle:row.subtitle||'',description:row.description||row.excerpt||'',
    excerpt:row.excerpt||row.description||'',type:row.type||'guide',category:row.category||'Guides',
    author:row.author_name||'TanzimFC',image:row.cover_image||'',heroImage:'',thumbnail:row.cover_image||'',
    imageAlt:row.image_alt||'',imageCaption:row.image_caption||'',featured:Boolean(row.featured),
    readingTime:Number(row.reading_time||0)||undefined,tags:Array.isArray(row.tags)?row.tags:[],
    relatedArticles:Array.isArray(row.related_articles)?row.related_articles:[],
    relatedTools:Array.isArray(row.related_tools)?row.related_tools:[],
    sources:Array.isArray(row.sources)?row.sources:[],factStatus:row.fact_status||'verified',
    lastReviewed:row.last_reviewed?new Date(row.last_reviewed):null,series:row.series||'',
    seriesOrder:row.series_order??null,createdAt:row.created_at?new Date(row.created_at):null,
    updatedAt:updated,publishedAt:published
  };
  const entry={slug:row.slug,data,body:prepared.html};
  const post=decorate(entry);
  post.data=data;
  post.body=prepared.html;
  post.bodyHtml=prepared.html;
  post.toc=prepared.toc;
  post.entry=entry;
  post.words=cleanText(prepared.html).split(/\\s+/).filter(Boolean).length;
  post.minutes=data.readingTime||Math.max(1,Math.ceil(post.words/220));
  return post;
}

export async function getPublishedPosts(){
  const rows=await getJson('articles?select=*&status=eq.published&order=published_at.desc,updated_at.desc&limit=100');
  return (rows||[]).map(remoteEntry).sort((a,b)=>(b.date?.valueOf()||0)-(a.date?.valueOf()||0));
}

export async function getPublishedPost(slug){
  const rows=await getJson('articles?select=*&status=eq.published&slug=eq.'+encodeURIComponent(String(slug||''))+'&limit=1');
  return rows?.[0] ? remoteEntry(rows[0]) : null;
}

export function isPublishedRemotePost(post){ return !!post?.entry?.data?.publishedAt; }
