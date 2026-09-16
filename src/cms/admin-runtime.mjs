import { articleEditorHtml } from './article-editor.mjs';
import { adminHtml as legacyAdminHtml } from './admin-hub.mjs';

// Keep the stable CMS hub on /admin while the standalone article editor lives
// at /admin/articles. This prevents a client-side editor failure from blanking
// the entire administration entry point.
export const adminHtml=(section='posts')=>section==='articles'?articleEditorHtml():legacyAdminHtml(section);
