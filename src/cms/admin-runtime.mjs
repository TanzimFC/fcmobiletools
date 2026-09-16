import { adminHtml as enhancedAdminHtml } from './admin-enhancements.mjs';
import { finalArticleEditorHtml } from './article-editor-final.mjs';

const layoutCss = `
.editorArea{min-width:0}.editorView{min-width:0}.editorView #postForm{max-width:1540px;margin:0 auto;padding-bottom:32px}
@media(max-width:780px){.topActions{flex-wrap:wrap}.app{min-width:0}}
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
