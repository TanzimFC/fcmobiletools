import { articleEditorHtml } from './article-editor.mjs';
import { adminHtml as legacyAdminHtml } from './admin-hub.mjs';

// The new article editor is the primary /admin CMS surface. Legacy CMS
// sections remain available for settings, redeem codes, and audit.
export const adminHtml=(section='posts')=>section==='posts'?articleEditorHtml():legacyAdminHtml(section);
