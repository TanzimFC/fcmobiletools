import { adminHtml as enhancedAdminHtml } from './admin-enhancements.mjs';

export const adminHtml = (section = 'posts') => {
  let html = enhancedAdminHtml(section);
  const bridge = "<script>try{window.S=S}catch(e){}</script>";
  const marker = '</style><script>(function(){';
  if (html.includes(marker)) {
    html = html.replace(marker, `</style>${bridge}<script>(function(){`);
  } else {
    const fallback = '<script>try{window.S=S}catch(e){}</script>';
    html = html.replace('</body>', fallback + '</body>');
  }
  return html;
};
