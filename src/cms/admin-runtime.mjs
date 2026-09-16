import { adminHtml as enhancedAdminHtml } from './admin-enhancements.mjs';
import { editorUpgradeHtml } from './editor-upgrade.mjs';

const layoutCss = `
.editorArea{min-width:0}.editorView{min-width:0}.editorView #postForm{max-width:1540px;margin:0 auto;padding-bottom:32px}
.heroFields{max-width:1180px;margin:0 auto 18px;padding:12px 6px 0}.heroFields .titleInput{width:100%;box-sizing:border-box;font-size:clamp(32px,4.5vw,56px);line-height:1.04;font-weight:850;letter-spacing:-.04em;background:transparent;border:0;border-bottom:1px solid #173442;border-radius:0;padding:10px 2px 15px;color:#eaf7fa;outline:none}.heroFields .titleInput:focus{border-bottom-color:#70d9ff}
.slugLine{display:flex;align-items:center;gap:6px;margin:9px 2px 15px;color:#5e7e8b;font-size:10px}.slugLine input{min-width:0;flex:1;background:transparent;border:0;color:#78dfff;padding:5px 0;outline:none}.excerptField{display:block}.excerptField>span{display:block;color:#7898a5;font-size:10px;font-weight:850;margin-bottom:7px}.excerptField input{width:100%;box-sizing:border-box}
.editorGrid{align-items:start;grid-template-columns:minmax(0,1fr) minmax(300px,360px);gap:20px;max-width:1540px;margin:0 auto}.writingCard,.metaCard{min-width:0;overflow:hidden}.writingCard{position:relative}.writingHead{min-height:56px}.writingHead b{font-size:12px}.contentArea{display:block;width:100%;min-height:660px;box-sizing:border-box;resize:vertical;padding:23px 24px;background:#061017;color:#eaf7fa;border:0;border-bottom:1px solid #173442;border-radius:0;font:500 14px/1.9 ui-monospace,SFMono-Regular,Consolas,monospace;outline:none}.contentArea:focus{box-shadow:inset 0 0 0 1px #2d6178}.metaColumn{position:sticky;top:14px;display:grid;gap:12px}.metaCard{padding:15px}.metaCard label{display:block}.metaCard input,.metaCard select,.metaCard textarea{width:100%;box-sizing:border-box}.metaCard .check input{width:auto}.previewView{max-width:1120px;margin:0 auto;padding:10px 0 34px}.articlePreview{overflow:hidden}.previewBody{padding:0 26px 32px}.previewBody img{max-width:100%;height:auto;border-radius:11px}.bottomActions{position:sticky;bottom:12px;z-index:30;max-width:1540px;margin:14px auto 0;padding:9px;border:1px solid #244858;border-radius:13px;background:#07131acc;backdrop-filter:blur(12px);display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;box-shadow:0 16px 50px #0007}
.tfx-featured-fallback{margin-top:10px;padding:12px;border:1px solid #244858;border-radius:12px;background:#07131a}.tfx-featured-fallback .head{display:flex;justify-content:space-between;gap:8px;align-items:center}.tfx-featured-fallback small{color:#7898a5;font-size:9px}.tfx-featured-fallback .preview{margin-top:9px;min-height:150px;border:1px solid #173442;border-radius:10px;background:#061017;display:grid;place-items:center;overflow:hidden}.tfx-featured-fallback .preview img{display:block;width:100%;max-height:260px;object-fit:cover}.tfx-featured-fallback .actions{display:flex;gap:7px;margin-top:9px;flex-wrap:wrap}.tfx-featured-fallback .actions .btn{flex:1}
@media(max-width:1050px){.editorGrid{grid-template-columns:minmax(0,1fr) 300px;gap:12px}.contentArea{min-height:540px}.metaColumn{position:static}}@media(max-width:780px){.heroFields .titleInput{font-size:31px}.editorGrid{display:block}.writingCard{margin-bottom:12px}.metaColumn{position:static}.contentArea{min-height:450px;padding:16px}.writingHead{align-items:flex-start}.tools{width:100%}.bottomActions{justify-content:stretch;bottom:6px}.bottomActions .btn{flex:1}.previewBody{padding:0 16px 22px}}
`;

export const adminHtml = (section = 'posts') => {
  let html = enhancedAdminHtml(section);
  const bridge = '<script>try{window.S=S}catch(e){}</script>';
  const marker = '</style><script>(function(){';
  if (html.includes(marker)) {
    html = html.replace(marker, `</style><style>${layoutCss}</style>${bridge}${editorUpgradeHtml}<script>(function(){`);
  } else {
    html = html.replace('</body>', `<style>${layoutCss}</style>${bridge}${editorUpgradeHtml}</body>`);
  }
  return html;
};
