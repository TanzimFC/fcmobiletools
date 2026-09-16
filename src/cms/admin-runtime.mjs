import { articleEditorHtml } from './article-editor.mjs';
import { adminHtml as legacyAdminHtml } from './admin-hub.mjs';

export const adminHtml=(section='posts')=>section==='posts'?articleEditorHtml():legacyAdminHtml(section);
