import { adminHtml as enhancedAdminHtml } from './admin-enhancements.mjs';

const layoutCss = `
/* Phase 3.1 — editor structure/layout only. Keep behavior and field IDs unchanged. */
.editorArea{min-width:0}.editorView{min-width:0}
.editorView #postForm{max-width:1500px;margin:0 auto;padding-bottom:24px}
.heroFields{max-width:1100px;margin:0 auto 18px;padding:8px 4px 0}
.heroFields .titleInput{width:100%;box-sizing:border-box;font-size:clamp(30px,4vw,46px);line-height:1.08;font-weight:850;letter-spacing:-.035em;background:transparent;border:0;border-bottom:1px solid #173442;border-radius:0;padding:10px 2px 13px;color:#eaf7fa;outline:none}
.heroFields .titleInput:focus{border-bottom-color:#70d9ff}
.slugLine{max-width:100%;display:flex;align-items:center;gap:5px;margin:9px 2px 15px;color:#5e7e8b;font-size:10px}.slugLine input{min-width:0;flex:1;background:transparent;border:0;color:#78dfff;padding:4px 0;outline:none}
.excerptField{display:block}.excerptField>span{display:block;color:#7898a5;font-size:10px;font-weight:800;margin-bottom:6px}.excerptField input{width:100%;box-sizing:border-box}
.editorGrid{align-items:start;grid-template-columns:minmax(0,1fr) minmax(280px,350px);gap:18px;max-width:1500px;margin:0 auto}.writingCard,.metaCard{min-width:0;overflow:hidden}.writingCard{position:relative}
.writingHead{min-height:48px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:11px 14px;border-bottom:1px solid #173442;background:#0a1b24}.writingHead>div:first-child{display:flex;align-items:baseline;gap:8px}.writingHead b{font-size:12px}.writingHead span{font-size:9px;color:#7898a5}
.tools{display:flex;align-items:center;gap:4px;flex-wrap:wrap}.tools button{min-width:30px;height:29px;padding:0 8px;border:1px solid #244858;border-radius:7px;background:#0d2029;color:#cfe7ed;font-weight:800;cursor:pointer}.tools button:hover{background:#12303b;border-color:#37697d;color:#fff}
.contentArea{display:block;width:100%;min-height:620px;box-sizing:border-box;resize:vertical;padding:20px 21px;background:#07131a;color:#eaf7fa;border:0;border-bottom:1px solid #173442;border-radius:0;font:500 14px/1.8 ui-monospace,SFMono-Regular,Consolas,monospace;outline:none}.contentArea:focus{box-shadow:inset 0 0 0 1px #244858}
.writingFoot{min-height:34px;box-sizing:border-box;padding:8px 14px;display:flex;justify-content:space-between;gap:10px;color:#668693;font-size:9px;background:#0a1b24}
.metaColumn{position:sticky;top:14px;display:grid;gap:12px}.metaCard{padding:14px;background:#0a1b24;border:1px solid #1d3948;border-radius:13px}.metaTitle{font-size:11px;font-weight:850;letter-spacing:.01em;margin-bottom:11px}.metaCard label{display:block;font-size:9px;color:#7898a5;font-weight:800;margin:10px 0}.metaCard input,.metaCard select,.metaCard textarea{width:100%;box-sizing:border-box}.metaCard .check{display:flex;align-items:center;gap:7px;color:#a7c2ca}.metaCard .check input{width:auto}
.cms-image-tools{margin-top:9px;padding:11px;border:1px solid #244858;border-radius:11px;background:#07131a}.cms-image-tools>div:first-child b{display:block;font-size:10px}.cms-image-tools .status{margin-top:3px}.cms-image-tools .upload-row{align-items:center}.cms-image-tools input[type=file]{padding:7px;border:1px dashed #31586a;border-radius:8px;background:#0a1b24;color:#9bb8c1}.cms-image-tools button{min-height:34px}.cms-image-tools .image-preview{min-height:74px;margin-top:10px;padding:8px;border:1px solid #173442;border-radius:9px;background:#061017;justify-content:center;overflow:hidden}.cms-image-tools img{display:block;width:auto;max-width:100%;max-height:180px;object-fit:contain;border-radius:7px}.cms-image-tools .muted{font-size:9px;color:#5f7f8c}
.previewView{max-width:1100px;margin:0 auto;padding:8px 0 30px}.articlePreview{overflow:hidden;border:1px solid #1d3948;border-radius:16px;background:#08161e}.articlePreview>img{display:block;width:100%;max-height:420px;object-fit:cover}.previewBody{padding:0 24px 28px}.previewBody img{max-width:100%;height:auto;border-radius:10px}
.bottomActions{max-width:1500px;margin:14px auto 0;display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap}
@media(max-width:1050px){.editorGrid{grid-template-columns:minmax(0,1fr) 300px;gap:12px}.contentArea{min-height:540px}.metaColumn{position:static}}
@media(max-width:780px){.heroFields{padding-top:2px}.heroFields .titleInput{font-size:30px}.editorGrid{display:block}.writingCard{margin-bottom:12px}.metaColumn{display:grid;grid-template-columns:1fr;gap:10px}.contentArea{min-height:440px;padding:16px}.writingHead{align-items:flex-start}.tools{width:100%}.tools button{flex:0 0 auto}.bottomActions{justify-content:stretch}.bottomActions .btn{flex:1}.previewBody{padding:0 16px 22px}}
@media(min-width:781px) and (max-width:1250px){.editorView #postForm{padding-left:14px;padding-right:14px}.editorGrid,.bottomActions{max-width:none}}
`;

const inlineImageJs = `(function(){
if(window.__tfcInlineImageInstalled)return;window.__tfcInlineImageInstalled=true;
var toast=function(m,b){var x=document.createElement('div');x.className='toast '+(b?'bad':'');x.textContent=m;document.body.appendChild(x);setTimeout(function(){x.remove()},2800)};
var install=function(){var a=document.getElementById('content'),tools=document.querySelector('.tools');if(!a||!tools||a.dataset.inlineImageReady==='1')return;if(a.disabled)return;a.dataset.inlineImageReady='1';var b=document.createElement('button');b.type='button';b.textContent='Img';b.title='Insert image into article';b.setAttribute('data-inline-image','1');tools.appendChild(b);var f=document.createElement('input');f.type='file';f.accept='image/png,image/jpeg,image/webp,image/gif';f.hidden=true;f.id='inlineImageFile';document.body.appendChild(f);var insert=function(md){var s=a.selectionStart,e=a.selectionEnd;a.setRangeText((s===e&&s>0?'\\n\\n':'')+md+(s===e?'\\n\\n':''),s,e,'end');a.dispatchEvent(new Event('input',{bubbles:true}));a.focus();toast('Image inserted into article')};var upload=function(file){var fd=new FormData();fd.set('file',file);b.disabled=true;var old=b.textContent;b.textContent='…';fetch('/api/media/upload',{method:'POST',credentials:'same-origin',body:fd}).then(function(r){return r.json().then(function(x){if(!r.ok)throw Error(x.error||'Upload failed');return x})}).then(function(x){var url=x.image&&x.image.secureUrl;if(!url)throw Error('Upload returned no image URL');var alt=prompt('Image alt text','Article image')||'Article image';var cap=prompt('Image caption (optional)','');var md='!['+alt+']('+url+')';if(cap)md+='\\n*'+cap+'*';insert(md)}).catch(function(e){toast(e.message,true)}).finally(function(){b.disabled=false;b.textContent=old})};b.onclick=function(){if(a.disabled)return;var choice=confirm('OK = upload an image from your device. Cancel = enter an image URL.');if(choice){f.value='';f.onchange=function(){if(f.files[0])upload(f.files[0])};f.click();return}var url=prompt('Image URL');if(!url)return;var alt=prompt('Image alt text','Article image')||'Article image';var cap=prompt('Image caption (optional)','');var md='!['+alt+']('+url+')';if(cap)md+='\\n*'+cap+'*';insert(md)};};
var observer=new MutationObserver(function(){clearTimeout(window.__tfcInlineImageTimer);window.__tfcInlineImageTimer=setTimeout(install,30)});observer.observe(document.body,{childList:true,subtree:true});setTimeout(install,0);setTimeout(install,400);setTimeout(install,1200);
})();`;

export const adminHtml = (section = 'posts') => {
  let html = enhancedAdminHtml(section);
  const bridge = '<script>try{window.S=S}catch(e){}</script>';
  const marker = '</style><script>(function(){';
  if (html.includes(marker)) {
    html = html.replace(marker, `</style><style>${layoutCss}</style>${bridge}<script>${inlineImageJs}</script><script>(function(){`);
  } else {
    html = html.replace('</body>', `<style>${layoutCss}</style>${bridge}<script>${inlineImageJs}</script></body>`);
  }
  return html;
};
