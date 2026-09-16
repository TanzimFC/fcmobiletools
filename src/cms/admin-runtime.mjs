import { adminHtml as enhancedAdminHtml } from './admin-enhancements.mjs';

export const adminHtml = (section = 'posts') => {
  let html = enhancedAdminHtml(section);
  const bridge = `<script>try{window.S=S;document.addEventListener('click',function(e){const b=e.target.closest&&e.target.closest('#codesNav');if(b){e.preventDefault();e.stopImmediatePropagation();location.href='/admin/redeem-codes'}} ,true)}catch(e){}</script>`;
  const marker = '</style><script>(function(){';
  if (html.includes(marker)) html = html.replace(marker, `</style>${bridge}<script>(function(){`);
  else html = html.replace('</body>', bridge + '</body>');
  return html;
};
