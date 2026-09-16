import { adminHtml as baseAdminHtml } from './admin-hub.mjs';

export const adminHtml=(section='posts')=>{
  const html=baseAdminHtml(section);
  const extra=`<style>
    .cms-image-tools{margin:14px 0;padding:14px;border:1px solid #203b4a;border-radius:14px;background:#08131b}
    .cms-image-tools .image-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px}
    .cms-image-tools .upload-row{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center}
    .cms-image-tools input[type=file]{width:100%;padding:9px;border:1px dashed #315564;border-radius:10px;background:#07131b;color:#eaf7fb}
    .cms-image-tools .image-preview{margin-top:12px;min-height:90px;border:1px solid #203b4a;border-radius:10px;background:#061017;display:flex;align-items:center;justify-content:center;padding:10px}
    .cms-image-tools .image-preview img{max-width:100%;max-height:260px;border-radius:8px;object-fit:contain}
    .cms-image-tools .status{font-size:12px;color:#8ca7b4}
    .adminPulse{margin:0 28px 18px;padding:16px 18px;border:1px solid #244858;border-radius:18px;background:linear-gradient(135deg,#0b1c27,#0a151d);display:flex;align-items:center;gap:18px;box-shadow:0 12px 30px rgba(0,0,0,.16)}
    .pulseIntro{display:grid;gap:4px;min-width:230px}.pulseIntro b{font-size:14px;color:#eaf7fb}.pulseStats{display:flex;gap:8px;flex:1}.pulseStats button{border:1px solid #244858;background:#0b202b;color:#cce5ec;border-radius:12px;padding:9px 13px;text-align:left;cursor:pointer}.pulseStats button:hover{border-color:#49b9d1}.pulseStats strong{display:block;font-size:18px;color:#fff}.pulseStats span{font-size:11px;color:#7899a6}.pulseInbox{white-space:nowrap}
    .modalShade{position:fixed;inset:0;z-index:9999;background:rgba(1,8,12,.76);backdrop-filter:blur(8px);display:grid;place-items:center;padding:24px}.approvalModal{width:min(900px,100%);max-height:86vh;overflow:auto;background:#09151d;border:1px solid #2a5363;border-radius:22px;box-shadow:0 30px 80px rgba(0,0,0,.45);padding:22px}.modalHead{display:flex;justify-content:space-between;gap:20px;border-bottom:1px solid #1d3742;padding-bottom:16px;margin-bottom:14px}.modalHead h2{margin:3px 0 4px}.modalHead p{margin:0;color:#8daab4;font-size:13px}.approvalRows{display:grid;gap:10px}.approvalRow{display:flex;justify-content:space-between;gap:18px;padding:16px;border:1px solid #1d3945;border-radius:15px;background:#0b1b24}.approvalRow h3{margin:8px 0 5px}.approvalRow p{margin:0 0 8px;color:#90aab3;font-size:13px;max-width:600px}.approvalActions{display:flex;align-items:center;gap:7px;flex-wrap:wrap;justify-content:flex-end}.emptyInbox{padding:50px 20px;text-align:center;color:#8faab3}.emptyInbox b{display:block;color:#e8f5f8;font-size:18px;margin-bottom:6px}
    .ghostDanger{margin-left:auto!important;border-color:#6d3030!important;color:#ff9b9b!important}.ghostDanger:hover{background:#30171b!important}.reviewFlag{display:inline-flex;margin-left:7px;padding:3px 7px;border-radius:999px;background:#332817;color:#ffd58a;font-size:10px;text-transform:uppercase}
    @media(max-width:900px){.adminPulse{margin:0 14px 14px;flex-wrap:wrap}.pulseStats{width:100%;order:3}.pulseInbox{margin-left:auto}.approvalRow{display:grid}.approvalActions{justify-content:flex-start}}
    @media(max-width:700px){.cms-image-tools .upload-row{grid-template-columns:1fr}.pulseStats{display:grid;grid-template-columns:repeat(3,1fr)}.pulseStats button{padding:8px}.pulseStats span{font-size:10px}}
  </style><script>(function(){
    function toast(m,b){var x=document.createElement('div');x.className='toast '+(b?'bad':'');x.textContent=m;document.body.appendChild(x);setTimeout(function(){x.remove()},2800)}
    function esc(s){return String(s||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;')}
    function setupImage(){
      var img=document.getElementById('image');
      if(!img||img.dataset.cloudinaryReady==='1') return;
      var label=img.closest('label');if(!label)return;img.dataset.cloudinaryReady='1';
      var box=document.createElement('div');box.className='cms-image-tools';
      box.innerHTML='<div class="image-head"><div><b>Cloudinary image upload</b><div class="status" id="cloudStatus">Upload an image directly to your Cloudinary media folder.</div></div></div><div class="upload-row"><input id="cloudFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif"><button type="button" class="btn primary" id="cloudUpload">Upload image</button></div><div class="image-preview" id="cloudPreview">'+(img.value?'<img src="'+esc(img.value)+'" alt="">':'<span class="muted">No image selected</span>')+'</div>';
      label.insertAdjacentElement('afterend',box);
      var file=document.getElementById('cloudFile'),btn=document.getElementById('cloudUpload'),status=document.getElementById('cloudStatus'),preview=document.getElementById('cloudPreview');
      function previewUrl(){preview.innerHTML=img.value?'<img src="'+esc(img.value)+'" alt="">':'<span class="muted">No image selected</span>'}
      img.addEventListener('input',previewUrl);
      btn.onclick=function(){if(!file.files||!file.files[0]){toast('Choose an image first',true);return}var fd=new FormData();fd.set('file',file.files[0]);btn.disabled=true;status.textContent='Uploading to Cloudinary…';fetch('/api/media/upload',{method:'POST',credentials:'same-origin',body:fd}).then(function(r){return r.json().then(function(x){if(!r.ok)throw Error(x.error||'Upload failed');return x})}).then(function(x){img.value=x.image&&x.image.secureUrl||'';img.dispatchEvent(new Event('input',{bubbles:true}));status.textContent='Uploaded successfully';previewUrl();toast('Image uploaded to Cloudinary.')}).catch(function(e){status.textContent='Upload failed';toast(e.message,true)}).finally(function(){btn.disabled=false})};
    }
    function api(p,o){return fetch(p,Object.assign({credentials:'same-origin'},o||{})).then(function(r){return r.json().then(function(x){if(!r.ok)throw Error(x.error||'Request failed');return x})})}
    function pulse(){
      if(document.querySelector('.adminPulse')||!document.querySelector('.top'))return;
      api('/api/auth/me').then(function(me){return api('/api/posts').then(function(x){return{me:me.user,posts:x.posts||[]}})}).then(function(x){
        var owner=x.me.role==='owner',posts=x.posts,review=posts.filter(function(p){return p.status==='review'}),drafts=posts.filter(function(p){return p.status==='draft'}),pub=posts.filter(function(p){return p.status==='published'});
        var d=document.createElement('section');d.className='adminPulse';d.innerHTML='<div class="pulseIntro"><span class="eyebrow">WORKSPACE PULSE</span><b>Publishing pipeline at a glance.</b></div><div class="pulseStats"><button data-pulse="review"><strong>'+review.length+'</strong><span>Awaiting review</span></button><button data-pulse="draft"><strong>'+drafts.length+'</strong><span>Drafts</span></button><button data-pulse="published"><strong>'+pub.length+'</strong><span>Published</span></button></div>'+(owner?'<button class="btn primary pulseInbox" id="pulseInbox">Approval inbox'+(review.length?' · '+review.length:'')+'</button>':'');document.querySelector('.top').insertAdjacentElement('afterend',d);
        d.querySelectorAll('[data-pulse]').forEach(function(b){b.onclick=function(){var s=document.getElementById('statusFilter');if(s){s.value=b.dataset.pulse;s.dispatchEvent(new Event('change'))}}});
        var ib=document.getElementById('pulseInbox');if(ib)ib.onclick=function(){approvalInbox(review)};
      }).catch(function(){});
    }
    function approvalInbox(rows){
      var old=document.getElementById('adminApprovalModal');if(old)old.remove();var m=document.createElement('div');m.id='adminApprovalModal';m.className='modalShade';
      m.innerHTML='<div class="approvalModal"><div class="modalHead"><div><span class="eyebrow">OWNER ONLY</span><h2>Approval inbox</h2><p>Review submissions before they become public. Publishing remains Owner-only.</p></div><button class="iconBtn" id="closeApproval">×</button></div>'+(rows.length?'<div class="approvalRows">'+rows.map(function(p){return'<article class="approvalRow"><div><div><span class="status review"><i></i>review</span> <span class="muted">'+esc(p.category||'Guides')+'</span></div><h3>'+esc(p.title||p.slug)+'</h3><p>'+esc(p.excerpt||'No summary provided.')+'</p><small>By '+esc(p.author||p.createdBy||'Unknown')+'</small></div><div class="approvalActions"><button class="btn" data-open-review="'+esc(p.slug)+'">Open</button><button class="btn" data-return-review="'+esc(p.slug)+'">Return</button><button class="btn primary" data-publish-review="'+esc(p.slug)+'">Approve & publish</button></div></article>'}).join('')+'</div>':'<div class="emptyInbox"><b>Inbox clear</b><span>No articles are waiting for Owner approval.</span></div>')+'</div>';
      document.body.appendChild(m);document.getElementById('closeApproval').onclick=function(){m.remove()};m.onclick=function(e){if(e.target===m)m.remove()};
      m.querySelectorAll('[data-open-review]').forEach(function(b){b.onclick=function(){var q=document.getElementById('postSearch');if(q){q.value=b.dataset.openReview;q.dispatchEvent(new Event('input'));setTimeout(function(){var item=document.querySelector('.postItem');if(item)item.click()},60)}m.remove()}});
      m.querySelectorAll('[data-publish-review]').forEach(function(b){b.onclick=function(){if(!confirm('Approve and publish this article?'))return;api('/api/posts/'+encodeURIComponent(b.dataset.publishReview)+'/approve',{method:'POST'}).then(function(){toast('Article published');m.remove();location.reload()}).catch(function(e){toast(e.message,true)})}});
      m.querySelectorAll('[data-return-review]').forEach(function(b){b.onclick=function(){var n=prompt('Return for revision — what should change?');if(n===null)return;api('/api/posts/'+encodeURIComponent(b.dataset.returnReview)+'/reject',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({notes:n})}).then(function(){toast('Returned for revision');m.remove();location.reload()}).catch(function(e){toast(e.message,true)})}});
    }
    function draftDelete(){
      if(document.getElementById('cmsDangerDelete'))return;var slug=document.getElementById('slug'),title=document.getElementById('title');if(!slug||!title)return;var status=document.querySelector('.editorStatus .status');if(!status)return;var st=status.textContent.trim().toLowerCase();if(st==='published')return;
      api('/api/auth/me').then(function(me){var role=me.user.role;if(role==='writer'&&!slug.value)return;var b=document.createElement('button');b.type='button';b.id='cmsDangerDelete';b.className='btn danger ghostDanger';b.textContent=st==='review'?'Delete submission':'Delete draft';var area=document.querySelector('.bottomActions');if(!area)return;area.appendChild(b);b.onclick=function(){if(!confirm('Delete this '+(st==='review'?'review submission':'draft')+'? This removes the GitHub article file and cannot be undone from the CMS.'))return;api('/api/posts/'+encodeURIComponent(slug.value),{method:'DELETE'}).then(function(){toast('Article deleted');location.reload()}).catch(function(e){toast(e.message,true)})}}).catch(function(){})
    }
    function setup(){setupImage();pulse();draftDelete()}
    var observer=new MutationObserver(setup);observer.observe(document.documentElement,{childList:true,subtree:true});setTimeout(setup,100);
  })();</script>`;
  return html.replace('</head>',extra+'</head>');
};
