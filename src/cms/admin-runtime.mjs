import { articleEditorHtml } from './admin-rebuild.mjs';
import { adminHtml as legacyAdminHtml } from './admin-hub.mjs';

// The rebuilt article workspace is the primary /admin surface.
// Redeem codes continue using the already-tested owner-only CMS section.
export const adminHtml=(section='posts')=>{
  if(section==='posts'||section==='articles') return articleEditorHtml();
  if(section==='redeem') return legacyAdminHtml('redeem');
  return legacyAdminHtml(section);
};
