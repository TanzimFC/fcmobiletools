import { articleEditorHtml } from './article-editor.mjs';
import { adminHtml as legacyAdminHtml } from './admin-hub.mjs';

// Final article editor surface; redeem/settings/audit remain on their existing CMS surfaces.
export const adminHtml=(section='posts')=>section==='posts'?articleEditorHtml():legacyAdminHtml(section);
