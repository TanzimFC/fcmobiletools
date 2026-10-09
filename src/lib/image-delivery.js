// Shared image delivery helpers for Cloudinary-backed editorial artwork.
const isCloudinaryUpload = (source) => {
  const value = String(source ?? '').replace(/&amp;/gi, '&');
  try {
    const url = new URL(value);
    return url.protocol === 'https:' &&
      url.hostname === 'res.cloudinary.com' &&
      url.pathname.includes('/image/upload/');
  } catch {
    return false;
  }
};

const isTransformedCloudinaryUrl = (url) => {
  const afterUpload = url.pathname.split('/image/upload/')[1] ?? '';
  const firstSegment = afterUpload.split('/')[0] ?? '';
  return Boolean(firstSegment) &&
    !/^v\d+$/i.test(firstSegment) &&
    (firstSegment.includes(',') || /^(?:f_auto|q_auto|w_\d+|h_\d+|c_(?:fill|limit|scale|crop|thumb)|dpr_auto)(?:$|,)/i.test(firstSegment));
};

export const cloudinaryImageUrl = (source, width, extra = '') => {
  const raw = String(source ?? '').replace(/&amp;/gi, '&');
  let url;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (!isCloudinaryUpload(raw) || isTransformedCloudinaryUrl(url)) return null;
  const safeWidth = Math.max(1, Math.round(Number(width) || 1200));
  const additional = String(extra ?? '').trim().replace(/^,+|,+$/g, '');
  url.pathname = url.pathname.replace(
    '/image/upload/',
    '/image/upload/f_auto,q_auto,c_limit,w_' + safeWidth + (additional ? ',' + additional : '') + '/'
  );
  return url.toString();
};

export const cloudinarySrcset = (source, widths = [480, 800, 1200, 1600]) => {
  if (!isCloudinaryUpload(source)) return undefined;
  const variants = widths.map((width) => {
    const url = cloudinaryImageUrl(source, width);
    return url ? url + ' ' + width + 'w' : null;
  });
  return variants.length && variants.every(Boolean) ? variants.join(', ') : undefined;
};

const escapeHtmlAttribute = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/"/g, '&quot;');

const imageAttributePatterns = {
  src: /\s+src\s*=\s*(?:"[^"]*"|'[^']*')/i,
  srcset: /\s+srcset\s*=\s*(?:"[^"]*"|'[^']*')/i,
  sizes: /\s+sizes\s*=\s*(?:"[^"]*"|'[^']*')/i
};

const setImageAttribute = (attrs, name, value) => {
  const pattern = imageAttributePatterns[name];
  const escaped = escapeHtmlAttribute(value);
  if (pattern?.test(attrs)) return attrs.replace(pattern, () => ' ' + name + '="' + escaped + '"');
  return attrs + ' ' + name + '="' + escaped + '"';
};

// For raw HTML images embedded in Markdown or stored in the editorial CMS.
export const optimizeHtmlImages = (html) => String(html ?? '').replace(/<img\b([^>]*)>/gi, (full, rawAttrs) => {
  let attrs = rawAttrs;
  const selfClosing = /\/\s*$/.test(attrs);
  if (selfClosing) attrs = attrs.replace(/\s*\/\s*$/, '');
  const srcMatch = attrs.match(/\s+src\s*=\s*(["'])(.*?)\1/i);
  if (!srcMatch) return full;

  const source = srcMatch[2];
  const srcForTag = cloudinaryImageUrl(source, 1200);
  if (srcForTag) {
    attrs = setImageAttribute(attrs, 'src', srcForTag);
    const srcset = cloudinarySrcset(source);
    if (srcset) {
      attrs = setImageAttribute(attrs, 'srcset', srcset);
      attrs = setImageAttribute(attrs, 'sizes', '(max-width: 760px) 100vw, 760px');
    }
  }

  if (!/\s+loading\s*=/i.test(attrs)) attrs += ' loading="lazy"';
  if (!/\s+decoding\s*=/i.test(attrs)) attrs += ' decoding="async"';
  return '<img' + attrs + (selfClosing ? ' /' : '') + '>';
});

// Rehype plugin for Markdown-generated <img> elements. Raw HTML nodes are handled above.
export const optimizeMarkdownImages = () => (tree) => {
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'element' && node.tagName === 'img' && node.properties) {
      const source = String(node.properties.src ?? '');
      const optimized = cloudinaryImageUrl(source, 1200);
      if (optimized) {
        node.properties.src = optimized;
        const srcset = cloudinarySrcset(source);
        if (srcset) {
          node.properties.srcSet = srcset;
          node.properties.sizes = '(max-width: 760px) 100vw, 760px';
        }
      }
      if (!node.properties.loading) node.properties.loading = 'lazy';
      if (!node.properties.decoding) node.properties.decoding = 'async';
    } else if (node.type === 'raw' && typeof node.value === 'string') {
      node.value = optimizeHtmlImages(node.value);
    }
    if (Array.isArray(node.children)) node.children.forEach(visit);
  };
  visit(tree);
};
