import { articleEditorHtml } from './article-editor.mjs';
import { adminHtml as legacyAdminHtml } from './admin-hub.mjs';

// The new article editor is the primary article CMS surface. Keep /admin and
// the /admin/articles alias on the same editor; legacy CMS sections remain
// available for settings, redeem codes, and audit.
export const adminHtml=(section='posts')=>section==='posts'||section==='articles'?articleEditorHtml():legacyAdminHtml(section);
