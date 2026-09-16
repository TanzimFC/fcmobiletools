import { adminHtml as enhancedAdminHtml } from './admin-enhancements.mjs';
import { finalArticleEditorHtml } from './article-editor-final.mjs';

const layoutCss = `
:root{--cms-bg:#071018;--cms-surface:#0c171f;--cms-surface2:#111f29;--cms-line:#1f3c49;--cms-text:#eef8fb;--cms-muted:#8aa1ab;--cms-blue:#70d9ff;--cms-green:#51dc93}
html,body{background:var(--cms-bg)!important;color:var(--cms-text)!important}
.app{min-height:100vh;background:radial-gradient(circle at 15% -10%,#123849 0,#071018 35%),var(--cms-bg)!important}
.top{display:flex!important;align-items:center!important;gap:18px!important;padding:18px 24px!important;background:linear-gradient(180deg,#0b1a23f2,#071018ee)!important;border-bottom:1px solid var(--cms-line)!important;position:sticky!important;top:0!important;z-index:120!important;backdrop-filter:blur(14px)!important}
.top h1{margin:2px 0 4px!important;font-size:22px!important;letter-spacing:-.03em!important}.top p{margin:0!important;color:var(--cms-muted)!important;font-size:10px!important}.topActions{margin-left:auto!important;display:flex!important;gap:7px!important;flex-wrap:wrap!important}
.nav{display:flex!important;align-items:center!important;gap:7px!important;padding:10px 20px!important;background:#091820f5!important;border-bottom:1px solid #18333f!important;position:sticky!important;top:78px!important;z-index:110!important;backdrop-filter:blur(12px)!important}
.navBrand{display:flex!important;align-items:center!important;gap:9px!important;margin-right:10px!important}.navBrand b{font-size:12px!important}.navBrand small{display:block!important;color:var(--cms-muted)!important;font-size:8px!important}.mark{display:grid!important;place-items:center!important;width:30px!important;height:30px!important;border-radius:9px!important;background:linear-gradient(135deg,#70d9ff,#159bd0)!important;color:#06202b!important;font-weight:950!important;box-shadow:0 7px 24px #0005!important}
.navItem{border:1px solid transparent!important;background:transparent!important;color:var(--cms-muted)!important;border-radius:9px!important;padding:8px 11px!important;font-size:10px!important;font-weight:850!important;text-decoration:none!important}.navItem:hover{background:#10232d!important;color:var(--cms-text)!important;border-color:#254c5b!important}.navItem.on{background:#133544!important;color:#b8eeff!important;border-color:#2b6277!important}.navSpacer{flex:1!important}.avatar{width:31px!important;height:31px!important;border:1px solid #2d5e72!important;border-radius:50%!important;background:#102a35!important;color:#b8eeff!important;font-weight:900!important}
.panel,.sidebar,.metaCard,.writingCard{background:var(--cms-surface)!important;border-color:var(--cms-line)!important}
.editorArea{min-width:0!important}.editorView{min-width:0!important}.editorGrid{max-width:1540px!important}
@media(max-width:780px){.top{position:static!important;padding:14px 12px!important}.nav{top:0!important;position:sticky!important;padding:8px 10px!important;overflow:auto!important}.navBrand{margin-right:3px!important}.topActions{width:100%!important;margin-left:0!important}.app{min-width:0!important}}
`;

export const adminHtml = (section = 'posts') => {
  let html = enhancedAdminHtml(section);
  const bridge = '<script>try{window.S=S}catch(e){}</script>';
  const marker = '</style><script>(function(){';
  if (html.includes(marker)) {
    html = html.replace(marker, `</style><style>${layoutCss}</style>${bridge}${finalArticleEditorHtml}<script>(function(){`);
  } else {
    html = html.replace('</body>', `<style>${layoutCss}</style>${bridge}${finalArticleEditorHtml}</body>`);
  }
  return html;
};
