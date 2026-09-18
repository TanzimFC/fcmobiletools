(() => {
  const $ = (s) => document.querySelector(s);
  const app = $('#app');
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let data = null;
  let tab = 'rules';

  async function api(path, options = {}) {
    const r = await fetch('/api/admin' + path, {credentials:'same-origin', ...options});
    const b = await r.json().catch(() => ({}));
    if (r.status === 401) { location.replace('/admin/'); throw new Error('Session expired'); }
    if (!r.ok) throw new Error(b.error || 'Request failed');
    return b;
  }

  function render() {
    const rules = data.releaseValueRules || [];
    const players = data.players || [];
    app.innerHTML =
      '<div class="hero"><div><div class="eyebrow"><i></i> STAR SIGNINGS CONTROL</div><h2>Exchange Planner</h2><p>Maintain the release-value rules and current signing targets used by the public tool.</p></div><a class="btn" href="/star-signings" target="_blank">Open public tool ↗</a></div>' +
      '<div class="tabs"><button id="rulesTab" class="' + (tab === 'rules' ? 'active' : '') + '">Release Values</button><button id="playersTab" class="' + (tab === 'players' ? 'active' : '') + '">Signing Targets</button></div>' +
      (tab === 'rules'
        ? '<div class="card section"><div class="head"><div><h3>Release value rules</h3><p>The player\\'s original release era controls the return value.</p></div><button class="btn primary" id="addRule">Add range</button></div>' +
          '<div class="grid3"><label class="field"><span>CUTOFF</span><input class="input" id="cutoff" type="date" value="' + esc(data.releaseCutoff) + '"></label><label class="field"><span>PAGE TITLE</span><input class="input" id="title" value="' + esc(data.title) + '"></label><label class="field"><span>EYEBROW</span><input class="input" id="eyebrow" value="' + esc(data.eyebrow) + '"></label></div>' +
          '<label class="field" style="display:block;margin-top:13px"><span>DESCRIPTION</span><textarea class="input" id="description">' + esc(data.description) + '</textarea></label>' +
          '<div class="matchgrid" style="margin-top:15px">' +
          rules.map((rule, i) =>
            '<div class="match" data-rule="' + i + '">' +
            '<label class="field"><span>MIN OVR</span><input class="input" data-key="minOvr" type="number" value="' + rule.minOvr + '"></label>' +
            '<label class="field"><span>MAX OVR</span><input class="input" data-key="maxOvr" type="number" value="' + rule.maxOvr + '"></label>' +
            '<label class="field"><span>BEFORE CUTOFF</span><input class="input" data-key="beforeCutoff" type="number" min="0" value="' + (rule.beforeCutoff ?? '') + '"></label>' +
            '<label class="field"><span>ON / AFTER</span><input class="input" data-key="afterCutoff" type="number" min="0" value="' + (rule.afterCutoff ?? '') + '"></label>' +
            '<button class="btn" data-remove-rule="' + i + '" type="button">Remove</button>' +
            '</div>'
          ).join('') +
          '</div><div class="save"><span class="muted">Public exchange math reads these values directly.</span><button class="btn primary" id="saveStar">Save changes</button></div></div>'
        : '<div class="card section"><div class="head"><div><h3>Signing targets</h3><p>These are comparison targets, not a promise that the live pool stays unchanged.</p></div><button class="btn primary" id="addPlayer">Add signing</button></div>' +
          '<div class="matchgrid">' +
          (players.map((player, i) =>
            '<div class="match" data-player="' + i + '">' +
            '<label class="field"><span>NAME</span><input class="input" data-key="name" value="' + esc(player.name) + '"></label>' +
            '<label class="field"><span>OVR</span><input class="input" data-key="ovr" type="number" value="' + player.ovr + '"></label>' +
            '<label class="field"><span>POSITION</span><input class="input" data-key="position" value="' + esc(player.position || '') + '"></label>' +
            '<label class="field"><span>COST</span><input class="input" data-key="cost" type="number" min="1" value="' + player.cost + '"></label>' +
            '<button class="btn" data-remove-player="' + i + '" type="button">Remove</button>' +
            '</div>'
          ).join('') || '<div class="empty">No signing targets.</div>') +
          '</div><div class="save"><span class="muted">Update player costs when the in-game pool changes.</span><button class="btn primary" id="saveStar">Save changes</button></div></div>';

    $('#rulesTab').onclick = () => { tab = 'rules'; render(); };
    $('#playersTab').onclick = () => { tab = 'players'; render(); };

    if (tab === 'rules') {
      $('#addRule').onclick = () => { data.releaseValueRules.push({minOvr:110,maxOvr:110,beforeCutoff:0,afterCutoff:0}); render(); };
      document.querySelectorAll('[data-remove-rule]').forEach(b => b.onclick = () => { data.releaseValueRules.splice(Number(b.dataset.removeRule),1); render(); });
    } else {
      $('#addPlayer').onclick = () => { data.players.push({id:'new-' + Date.now(),name:'New signing',ovr:120,position:'',program:'',cost:500,enabled:true}); render(); };
      document.querySelectorAll('[data-remove-player]').forEach(b => b.onclick = () => { data.players.splice(Number(b.dataset.removePlayer),1); render(); });
    }

    $('#saveStar').onclick = async () => {
      const button = $('#saveStar');
      button.disabled = true;
      button.textContent = 'Saving...';
      try {
        if (tab === 'rules') {
          data.releaseCutoff = $('#cutoff').value;
          data.title = $('#title').value.trim();
          data.eyebrow = $('#eyebrow').value.trim();
          data.description = $('#description').value.trim();
          document.querySelectorAll('[data-rule]').forEach(row => {
            const i = Number(row.dataset.rule);
            const next = {...data.releaseValueRules[i]};
            row.querySelectorAll('[data-key]').forEach(input => {
              const key = input.dataset.key;
              next[key] = input.value === '' ? null : Number(input.value);
            });
            data.releaseValueRules[i] = next;
          });
        } else {
          document.querySelectorAll('[data-player]').forEach(row => {
            const i = Number(row.dataset.player);
            const next = {...data.players[i]};
            row.querySelectorAll('[data-key]').forEach(input => {
              const key = input.dataset.key;
              next[key] = (key === 'ovr' || key === 'cost') ? Number(input.value) : input.value.trim();
            });
            data.players[i] = next;
          });
        }
        const result = await api('/star-signings', {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)});
        button.textContent = 'Saved';
        $('#status').textContent = 'Star Signings saved · commit ' + String(result.commitSha || '').slice(0,7);
        setTimeout(() => button.textContent = 'Save changes', 1200);
      } catch (e) {
        button.textContent = 'Save changes';
        $('#status').textContent = e.message;
      } finally {
        button.disabled = false;
      }
    };
  }

  window.loadShardsSection = async () => {
    try {
      data = await api('/star-signings');
      render();
      $('#status').textContent = 'Star Signings data loaded';
    } catch (e) {
      app.innerHTML = '<div class="error">' + esc(e.message) + '</div>';
      $('#status').textContent = 'Star Signings load failed';
    }
  };
})();