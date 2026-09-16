export const ROLES = {
  writer: {
    label: 'Writer',
    permissions: ['create_draft', 'edit_own_draft', 'submit_own_draft', 'upload_media', 'manage_profile'],
  },
  editor: {
    label: 'Editor',
    permissions: ['create_draft', 'edit_draft', 'review_posts', 'upload_media', 'manage_profile'],
  },
  owner: {
    label: 'Owner',
    permissions: ['create_draft', 'edit_draft', 'review_posts', 'publish_posts', 'upload_media', 'manage_redeem_codes', 'manage_accounts', 'view_audit_log', 'manage_profile'],
  },
};

export const hasPermission = (role, permission) => Boolean(ROLES[role]?.permissions.includes(permission));
export const roleLabel = role => ROLES[role]?.label || 'Writer';
