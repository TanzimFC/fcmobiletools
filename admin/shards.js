(() => {
  const $ = (selector) => document.querySelector(selector);
  const app = $('#app');
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  let data = null;

  async function api(path, options = {}) {
    const response = await fetch('/api/admin' + path, {credentials:'same-origin', ...options});
    const body = await response.json().catch(() => ({}));
    if (response.status === 401) { location.replace('/admin/'); throw new Error('Session expired'); }
    if (!response.ok) throw new Error(body.error || 'Request failed (' + response.status + ')');
    return body;
  }

  function makeId(label) {
    const base = String(label || 'target').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 42) || 'target';
    let id = base, n = 2;
    while ((data.targets || []).some((item) => item.id === id)) id = base + '-' + n++;
    return id;
  }

  function rowMarkup(target, index) {
    return '<div class="card" data-target-row="' + index + '" style="padding:16px;margin-top:10px">' +
      '<div class="grid3">' +
      '<label class="field"><span>ID</span><input class="input" data-key="id" value="' + esc(target.id) + '"></label>' +
      '<label class="field"><span>Label</span><input class="input" data-key="label" value="' + esc(target.label) + '"></label>' +
      '<label class="field"><span>Cost</span><input class="input" data-key="cost" type="number" min="1" step="1" value="' + Number(target.cost || 0) + '"></label>' +
      '</div>' +
      '<div class="grid" style="margin-top:10px">' +
      '<label class="field"><span>Note</span><input class="input" data-key="note" value="' + esc(target.note || '') + '"></label>' +
      '<label class="field"><span>Visibility</span><select class="input" data-key="enabled"><option value="true" ' + (target.enabled !== false ? 'selected' : '') + '>Visible to players</option><option value="false" ' + (target.enabled === false ? 'selected' : '') + '>Hidden</option></select></label>' +
      '</div>' +
      '<div class="toolbar" style="margin-top:10px"><button class="btn" type="button" data-remove="' + index + '">Remove preset</button></div>' +
      '</div>';
  }

  function render() {
    const targets = Array.isArray(data.targets) ? data.targets : [];
    app.innerHTML =
      '<div class="hero"><div><div class="eyebrow"><i></i> SHARDS TOOL CONTROL</div><h2>Shards Counter</h2><p>Manage public copy and preset shard targets from the live admin workspace.</p></div><a class="btn" href="/shards-counter" target="_blank" rel="noopener">Open public tool ↗</a></div>' +
      '<div class="card section"><div class="head"><div><h3>Tool settings</h3><p>These fields power the public Shards Counter.</p></div><div class="inline-note">PLAYER-SIDE COUNTER</div></div>' +
      '<div class="grid">' +
      '<label class="field"><span>Page title</span><input class="input" id="shardTitle" value="' + esc(data.title) + '"></label>' +
      '<label class="field"><span>Eyebrow</span><input class="input" id="shardEyebrow" value="' + esc(data.eyebrow) + '"></label>' +
      '<label class="field"><span>Currency label</span><input class="input" id="shardCurrency" value="' + esc(data.currencyLabel) + '"></label>' +
      '<label class="field"><span>Default preset</span><select class="input" id="shardDefault"><option value="">Custom target</option>' +
      targets.map((target) => '<option value="' + esc(target.id) + '" ' + (data.defaultTargetId === target.id ? 'selected' : '') + '>' + esc(target.label) + ' · ' + Number(target.cost || 0).toLocaleString() + '</option>').join('') +
      '</select></label></div>' +
      '<label class="field" style="display:block;margin-top:13px"><span>Description</span><textarea class="input" id="shardDescription">' + esc(data.description) + '</textarea></label></div>' +
      '<div class="card section"><div class="head"><div><h3>Preset targets</h3><p>' + targets.length + ' configured target' + (targets.length === 1 ? '' : 's') + '</p></div><button class="btn primary" type="button" id="addShardTarget">Add preset</button></div>' +
      (targets.map(rowMarkup).join('') || '<div class="empty">No presets yet. Add a target to create a quick-select option for players.</div>') +
      '</div>' +
      '<div class="save"><span class="muted">Writes to <b>src/data/fcMobileShards.js</b> and follows the existing deployment flow.</span><button class="btn primary" type="button" id="saveShards">Save changes</button></div>';

    document.querySelectorAll('[data-remove]').forEach((button) => {
      button.onclick = () => {
        const index = Number(button.dataset.remove);
        const removed = data.targets[index];
        data.targets.splice(index, 1);
        if (removed && data.defaultTargetId === removed.id) data.defaultTargetId = '';
        render();
      };
    });

    $('#addShardTarget').onclick = () => {
      const label = 'New shard target';
      data.targets.push({id: makeId(label), label, cost: 1, note: '', enabled: true});
      render();
      const last = data.targets.length - 1;
      document.querySelector('[data-target-row="' + last + '"] [data-key="label"]')?.focus();
    };

    $('#saveShards').onclick = async () => {
      const button = $('#saveShards');
      button.disabled = true;
      button.textContent = 'Saving...';
      try {
        data.title = $('#shardTitle').value.trim();
        data.eyebrow = $('#shardEyebrow').value.trim();
        data.currencyLabel = $('#shardCurrency').value.trim();
        data.defaultTargetId = $('#shardDefault').value;
        data.description = $('#shardDescription').value.trim();

        document.querySelectorAll('[data-target-row]').forEach((row) => {
          const index = Number(row.dataset.targetRow);
          const next = {...data.targets[index]};
          row.querySelectorAll('[data-key]').forEach((input) => {
            const key = input.dataset.key;
            next[key] = key === 'cost' ? Number(input.value) : key === 'enabled' ? input.value === 'true' : input.value.trim();
          });
          data.targets[index] = next;
        });

        const result = await api('/shards', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(data)});
        button.textContent = 'Saved';
        const status = $('#status');
        if (status) status.textContent = 'Shards Counter saved · commit ' + String(result.commitSha || '').slice(0, 7);
        setTimeout(() => { button.textContent = 'Save changes'; }, 1200);
      } catch (error) {
        button.textContent = 'Save changes';
        const status = $('#status');
        if (status) status.textContent = error.message;
      } finally {
        button.disabled = false;
      }
    };
  }

  window.loadShardsSection = async () => {
    try {
      data = await api('/shards');
      render();
      const status = $('#status');
      if (status) status.textContent = 'Shards data loaded';
    } catch (error) {
      app.innerHTML = '<div class="error">' + esc(error.message) + '</div>';
      const status = $('#status');
      if (status) status.textContent = 'Shards load failed';
    }
  };
})();