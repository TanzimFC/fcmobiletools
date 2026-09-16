import { adminHtml as enhancedAdminHtml } from './admin-enhancements.mjs';

export const adminHtml=(section='posts')=>enhancedAdminHtml(section).replace('</body>','<script>try{window.S=S}catch(e){}</script></body>');
