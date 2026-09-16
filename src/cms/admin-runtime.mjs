import { articleEditorHtml } from './article-editor-v2.mjs';
import { adminHtml as legacyAdminHtml } from './admin-hub.mjs';

// The stable v2 article editor is the primary /admin surface. /admin/articles
// is an alias to the same editor; legacy CMS sections remain available for
// settings, redeem codes, and audit.
export const adminHtml=(section='posts')=>section==='posts'||section==='articles'?articleEditorHtml():legacyAdminHtml(section);
