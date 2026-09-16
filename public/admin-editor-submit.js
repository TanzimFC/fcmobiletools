(()=>{
'use strict';
if(window.__tfcAtomicSubmitFix)return;window.__tfcAtomicSubmitFix=true;
const q=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const slugify=s=>String(s||'').toLowerCase().trim().replace(/[^a-z0-9\s-]/g,'').replace(/\s+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'');
function showError(message){let x=q('#aefGlobalError');if(!x){x=document.createElement('div');x.id='aefGlobalError';x.className='aef-error on';x.style.cssText='position:fixed;top:14px;left:14px;right:14px;z-index:50000';document.body.appendChild(x)}x.innerHTML='<b>CMS editor error</b><span>'+esc(message)+'</span>'}
async function submit(button){
 const title=q('#afTitle')?.value?.trim()||'',content=q('#afContent')?.value||'',slug=slugify(q('#afSlug')?.value||title);
 if(!title)return showError('Add an article title first.');
 if(!content.trim())return showError('Write some article content first.');
 if(!slug)return showError('A valid article slug is required.');
 const payload={
  slug,title,excerpt:q('#afExcerpt')?.value||'',description:q('#afExcerpt')?.value||'',content,
  category:q('#afCategory')?.value||'Guides',author:q('#afAuthor')?.value||'',
  tags:(q('#afTags')?.value||'').split(',').map(x=>x.trim()).filter(Boolean),
  image:q('#afImage')?.value||'',imageAlt:q('#afAlt')?.value||'',imageCaption:q('#afCaption')?.value||'',
  seoTitle:q('#afSeoTitle')?.value||'',seoDescription:q('#afSeoDesc')?.value||'',featured:!!q('#afFeatured')?.checked,
  subtitle:q('#afSubtitle')?.value||'',difficulty:q('#afDifficulty')?.value||'',canonicalUrl:q('#afCanonical')?.value||'',
  lastReviewed:q('#afLastReviewed')?.value||'',reviewer:q('#afReviewer')?.value||'',readingTime:Number(q('#afReadingTime')?.value||0)||0,
  relatedArticles:(q('#afRelatedArticles')?.value||'').split(',').map(x=>x.trim()).filter(Boolean),
  relatedTools:(q('#afRelatedTools')?.value||'').split(',').map(x=>x.trim()).filter(Boolean),
  relatedCodes:(q('#afRelatedCodes')?.value||'').split(',').map(x=>x.trim()).filter(Boolean),
  sources:(q('#afSources')?.value||'').split(',').map(x=>x.trim()).filter(Boolean),
  noindex:!!q('#afNoindex')?.checked
 };
 button.disabled=true;
 try{
  const r=await fetch('/api/posts/'+encodeURIComponent(slug)+'/submit',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
  const x=await r.json().catch(()=>({}));
  if(!r.ok)throw Error(x.error||'Could not submit article for review');
  try{localStorage.removeItem('cms-local-draft:'+(q('#afSlug')?.value?.trim()||'new'))}catch{}
  const state=q('#afSaveState');if(state)state.textContent='Submitted for review';
  if(typeof window.__tfcArticleEditorReload==='function')window.__tfcArticleEditorReload();else location.reload();
 }catch(e){showError(e.message);button.disabled=false}
}
document.addEventListener('click',e=>{const b=e.target.closest?.('#afSubmit');if(!b)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();submit(b)},true);
})();
