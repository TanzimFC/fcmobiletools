import { adminHtml as unifiedAdminHtml } from './admin-unified.mjs';

// Single canonical CMS UI. Kept under the existing import path so routing stays stable.
export const adminHtml=()=>unifiedAdminHtml('posts');
