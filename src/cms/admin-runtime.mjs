import { articleEditorHtml } from './admin-rebuild.mjs';
import { adminHtml as legacyAdminHtml } from './admin-hub.mjs';

// The rebuilt Worker-backed admin is the primary CMS surface. /admin and
// /admin/articles open the same application; /admin/redeem-codes opens the
// same application on its owner-only redeem-code workspace. Settings and
// audit remain on their dedicated pages until their UI is folded into the
// common shell.
export const adminHtml=(section='posts')=>{
  if(section==='posts'||section==='articles') return articleEditorHtml('articles');
  if(section==='redeem') return articleEditorHtml('redeem');
  return legacyAdminHtml(section);
};
