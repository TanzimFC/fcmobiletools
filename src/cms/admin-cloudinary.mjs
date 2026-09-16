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
    @media(max-width:700px){.cms-image-tools .upload-row{grid-template-columns:1fr}}
  </style><script>(function(){
    function toast(m,b){var x=document.createElement('div');x.className='toast '+(b?'bad':'');x.textContent=m;document.body.appendChild(x);setTimeout(function(){x.remove()},2800)}
    function esc(s){return String(s||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;')}
    function setup(){
      var img=document.getElementById('image');
      if(!img||img.dataset.cloudinaryReady==='1') return;
      var label=img.closest('label');
      if(!label) return;
      img.dataset.cloudinaryReady='1';
      var box=document.createElement('div');
      box.className='cms-image-tools';
      box.innerHTML='<div class="image-head"><div><b>Cloudinary image upload</b><div class="status" id="cloudStatus">Upload an image directly to your Cloudinary media folder.</div></div></div><div class="upload-row"><input id="cloudFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif"><button type="button" class="btn primary" id="cloudUpload">Upload image</button></div><div class="image-preview" id="cloudPreview">'+(img.value?'<img src="'+esc(img.value)+'" alt="">':'<span class="muted">No image selected</span>')+'</div>';
      label.insertAdjacentElement('afterend',box);
      var file=document.getElementById('cloudFile'),btn=document.getElementById('cloudUpload'),status=document.getElementById('cloudStatus'),preview=document.getElementById('cloudPreview');
      function previewUrl(){preview.innerHTML=img.value?'<img src="'+esc(img.value)+'" alt="">':'<span class="muted">No image selected</span>'}
      img.addEventListener('input',previewUrl);
      btn.onclick=function(){if(!file.files||!file.files[0]){toast('Choose an image first',true);return}var fd=new FormData();fd.set('file',file.files[0]);btn.disabled=true;status.textContent='Uploading to Cloudinary…';fetch('/api/media/upload',{method:'POST',credentials:'same-origin',body:fd}).then(function(r){return r.json().then(function(x){if(!r.ok)throw Error(x.error||'Upload failed');return x})}).then(function(x){img.value=x.image&&x.image.secureUrl||'';img.dispatchEvent(new Event('input',{bubbles:true}));status.textContent='Uploaded successfully';previewUrl();toast('Image uploaded to Cloudinary.')}).catch(function(e){status.textContent='Upload failed';toast(e.message,true)}).finally(function(){btn.disabled=false})};
    }
    var observer=new MutationObserver(setup);observer.observe(document.documentElement,{childList:true,subtree:true});setTimeout(setup,0);
  })();</script>`;
  return html.replace('</head>',extra+'</head>');
};
