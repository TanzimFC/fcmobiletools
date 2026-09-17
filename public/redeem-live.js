(() => {
  const esc = (s) => String(s ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
  const date = (v) => v ? new Date(`${v}T00:00:00`).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : 'Unknown';
  const status = (v) => ({active:['active','Active'],reported:['reported','Reported'],expired:['expired','Expired']}[v] || ['unknown','Unknown']);
  const pageSize = 30;
  async function load(){
    const r=await fetch('/api/public/redeem-codes',{cache:'no-store'});
    if(!r.ok)return;
    const data=await r.json();
    const codes=Array.isArray(data.codes)?data.codes:[];
    const params=new URLSearchParams(location.search),q=(params.get('q')||'').trim().toLowerCase(),filter=['all','active','expired'].includes(params.get('status'))?params.get('status'):'all';
    const matches=codes.filter(x=>{const text=`${x.code||''} ${x.reward||''} ${x.region||''}`.toLowerCase();return(!q||text.includes(q))&&(filter==='all'||x.status===filter)});
    const active=codes.filter(x=>x.status==='active'),expired=codes.filter(x=>x.status==='expired');
    const updated=codes.reduce((a,x)=>x.lastVerified>a?x.lastVerified:a,'');
    const activeBox=document.querySelector('.active-box'), rows=document.querySelector('.rows'), stats=document.querySelector('.stats'), updatedNode=document.querySelector('.updated small');
    if(!activeBox||!rows)return;
    const card=x=>{const [cl,label]=status(x.status);return `<article class="active-card"><div><div class="code-row"><code>${esc(x.code)}</code><span class="status ${cl}"><i></i>${label}</span></div><h3>${esc(x.reward||'FC Mobile reward')}</h3><p>Released ${date(x.releaseDate)} · Region ${esc(x.region||'Global')} · Last updated ${date(x.lastVerified)}</p></div><div class="buttons"><button type="button" data-copy="${esc(x.code)}">COPY CODE</button><a href="https://redeem.fcm.ea.com/?redeemCode=${encodeURIComponent(x.code||'')}" target="_blank" rel="noopener noreferrer">REDEEM ↗</a></div></article>`};
    activeBox.querySelector('.section-top b').textContent=`${active.length} ACTIVE`;
    activeBox.querySelectorAll('.active-card,.empty').forEach(x=>x.remove());
    activeBox.insertAdjacentHTML('beforeend',active.length?active.map(card).join(''):'<p class="empty">No active codes are verified right now.</p>');
    const pageCount=Math.max(1,Math.ceil(matches.length/pageSize));
    const requested=Number(params.get('page')||1);
    const current=Math.min(Math.max(Number.isFinite(requested)?requested:1,1),pageCount);
    const pageItems=matches.slice((current-1)*pageSize,current*pageSize);
    rows.innerHTML=pageItems.length?pageItems.map(x=>{const [cl,label]=status(x.status);return `<article class="row"><div class="row-code"><code>${esc(x.code)}</code><span class="status ${cl}"><i></i>${label}</span></div><div class="reward">${esc(x.reward||'')}</div><div class="date"><small>Released</small><b>${date(x.releaseDate)}</b></div><div class="date"><small>Updated</small><b>${date(x.lastVerified)}</b></div><div class="row-actions"><button type="button" data-copy="${esc(x.code)}">Copy</button><a href="https://redeem.fcm.ea.com/?redeemCode=${encodeURIComponent(x.code||'')}" target="_blank" rel="noopener noreferrer">Redeem ↗</a></div></article>`}).join(''):'<div class="empty">No codes match your search.</div>';
    const pagination=document.querySelector('.pagination');
    if(pagination){
      const url=(p)=>{const x=new URLSearchParams();if(q)x.set('q',params.get('q'));if(filter!=='all')x.set('status',filter);if(p>1)x.set('page',String(p));return `/redeem-codes${x.toString()?`?${x}`:''}`};
      pagination.innerHTML=`<a class="${current===1?'disabled':''}" href="${current>1?url(current-1):'#'}">← Previous</a><span>Page ${current} of ${pageCount}</span><a class="${current===pageCount?'disabled':''}" href="${current<pageCount?url(current+1):'#'}">Next →</a>`;
    }
    const s=stats?.querySelectorAll('div');if(s&&s.length>=3){s[0].querySelector('b').textContent=codes.length;s[1].querySelector('b').textContent=active.length;s[2].querySelector('b').textContent=expired.length}
    if(updatedNode)updatedNode.textContent=date(updated);
    document.querySelectorAll('[data-copy]').forEach(b=>{if(b.dataset.liveBound)return;b.dataset.liveBound='1';b.onclick=async()=>{try{await navigator.clipboard.writeText(b.dataset.copy)}catch{const a=document.createElement('textarea');a.value=b.dataset.copy;document.body.appendChild(a);a.select();document.execCommand('copy');a.remove()}const old=b.textContent;b.textContent='✓ Copied';setTimeout(()=>b.textContent=old,1400)}});
  }
  load().catch(()=>{});
  setInterval(()=>load().catch(()=>{}),30000);
})();
