import { accountApi } from './account-client.js';

const DEFAULT_MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return Math.max(1, Math.round(bytes / 1024)) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, '') + ' MB';
}

function messageForStatus(status, message) {
  if (status === 401) return 'Sign in to your account before uploading.';
  if (status === 403) return message || 'Verify your email before uploading.';
  if (status === 413) return 'Choose an image smaller than 8 MB.';
  if (status === 415) return message || 'Use a JPG, PNG, WebP, or GIF image.';
  if (status === 429) return 'You have reached the upload limit. Try again later.';
  return message || 'The image could not be uploaded. Please try again.';
}

export function bindImageUploads(container = document) {
  const roots = [];
  if (container?.matches?.('[data-fcm-image-upload]')) roots.push(container);
  if (container?.querySelectorAll) roots.push(...container.querySelectorAll('[data-fcm-image-upload]'));

  for (const root of roots) {
    if (root.dataset.uploadInitialized === 'true') continue;
    root.dataset.uploadInitialized = 'true';

    const fileInput = root.querySelector('[data-upload-file]');
    const drop = root.querySelector('[data-upload-drop]');
    const chooseButton = root.querySelector('[data-upload-trigger]');
    const uploadButton = root.querySelector('[data-upload-submit]');
    const clearButton = root.querySelector('[data-upload-clear]');
    const copyButton = root.querySelector('[data-upload-copy]');
    const preview = root.querySelector('[data-upload-preview]');
    const previewImage = root.querySelector('[data-upload-preview-image]');
    const filenameLabel = root.querySelector('[data-upload-filename]');
    const metaLabel = root.querySelector('[data-upload-meta]');
    const status = root.querySelector('[data-upload-status]');
    const urlInput = root.querySelector('[data-upload-url]');
    if (!fileInput || !drop || !chooseButton || !uploadButton || !preview || !previewImage || !status || !urlInput) continue;

    const maxBytes = Math.max(1, Math.min(DEFAULT_MAX_BYTES, Number(root.dataset.maxBytes) || DEFAULT_MAX_BYTES));
    const expirationDays = Math.max(1, Math.min(180, Math.floor(Number(root.dataset.expirationDays) || 30)));
    let selectedFile = null;
    let objectUrl = '';
    let uploadedUrl = '';

    const setStatus = (message, kind = '') => {
      status.textContent = message;
      status.classList.toggle('is-error', kind === 'error');
      status.classList.toggle('is-success', kind === 'success');
    };

    const revokePreview = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = '';
    };

    const pickFile = (file) => {
      if (!file) return;
      const extensionMime = /\.jpe?g$/i.test(file.name) ? 'image/jpeg'
        : /\.png$/i.test(file.name) ? 'image/png'
        : /\.webp$/i.test(file.name) ? 'image/webp'
        : /\.gif$/i.test(file.name) ? 'image/gif'
        : '';
      const selectedMime = ALLOWED_MIME.has(file.type) ? file.type : (!file.type || file.type === 'application/octet-stream' ? extensionMime : '');
      if (!ALLOWED_MIME.has(selectedMime)) {
        setStatus('Use a JPG, PNG, WebP, or GIF image.', 'error');
        return;
      }
      if (file.size <= 0 || file.size > maxBytes) {
        setStatus('Choose an image smaller than ' + formatBytes(maxBytes) + '.', 'error');
        return;
      }
      revokePreview();
      selectedFile = file;
      uploadedUrl = '';
      urlInput.value = '';
      if (copyButton) copyButton.hidden = true;
      objectUrl = URL.createObjectURL(file);
      previewImage.src = objectUrl;
      preview.hidden = false;
      if (filenameLabel) filenameLabel.textContent = file.name || 'Selected image';
      if (metaLabel) metaLabel.textContent = formatBytes(file.size) + ' · Ready to upload';
      uploadButton.disabled = false;
      uploadButton.textContent = 'Upload image';
      setStatus('Ready to upload. Images are removed automatically after ' + expirationDays + ' days.');
    };

    chooseButton.addEventListener('click', () => fileInput.click());
    uploadButton.addEventListener('click', async () => {
      if (!selectedFile) {
        fileInput.click();
        return;
      }
      if (selectedFile.size > maxBytes) {
        setStatus('Choose an image smaller than ' + formatBytes(maxBytes) + '.', 'error');
        return;
      }

      const file = selectedFile;
      const data = new FormData();
      data.append('file', file, file.name || 'image');
      data.append('expirationDays', String(expirationDays));
      uploadButton.disabled = true;
      chooseButton.disabled = true;
      uploadButton.textContent = 'Uploading…';
      setStatus('Uploading image…');

      try {
        const response = await accountApi('/api/account/image-upload', { method: 'POST', body: data });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result?.ok || !result?.image?.url) {
          throw Object.assign(new Error(messageForStatus(response.status, result?.error)), { status: response.status });
        }

        uploadedUrl = String(result.image.url);
        selectedFile = null;
        fileInput.value = '';
        urlInput.value = uploadedUrl;
        revokePreview();
        previewImage.src = uploadedUrl;
        if (metaLabel) metaLabel.textContent = (result.image.width && result.image.height
          ? result.image.width + ' × ' + result.image.height + ' · '
          : '') + formatBytes(Number(result.image.size) || file.size) + ' · Expires automatically';
        if (filenameLabel) filenameLabel.textContent = file.name || 'Uploaded image';
        if (copyButton) copyButton.hidden = false;
        uploadButton.textContent = 'Upload another';
        uploadButton.disabled = false;
        chooseButton.disabled = false;
        setStatus('Image uploaded and attached. It will be removed automatically after about ' +
          Number(result.image.expirationDays || expirationDays) + ' days.', 'success');
        root.dispatchEvent(new CustomEvent('fcm:image-uploaded', {
          bubbles: true,
          detail: {
            url: uploadedUrl,
            width: Number(result.image.width) || 0,
            height: Number(result.image.height) || 0,
            size: Number(result.image.size) || file.size,
            expiresAt: result.image.expiresAt || null
          }
        }));
      } catch (error) {
        uploadButton.disabled = false;
        chooseButton.disabled = false;
        uploadButton.textContent = 'Try upload again';
        setStatus(messageForStatus(Number(error?.status) || 0, error?.message), 'error');
      }
    });

    fileInput.addEventListener('change', () => pickFile(fileInput.files?.[0]));

    drop.addEventListener('dragover', (event) => {
      event.preventDefault();
      drop.classList.add('is-dragging');
    });
    drop.addEventListener('dragleave', () => drop.classList.remove('is-dragging'));
    drop.addEventListener('drop', (event) => {
      event.preventDefault();
      drop.classList.remove('is-dragging');
      const file = event.dataTransfer?.files?.[0];
      if (!file) return;
      try {
        fileInput.files = event.dataTransfer.files;
      } catch {}
      pickFile(file);
    });

    clearButton?.addEventListener('click', () => {
      const hadUrl = Boolean(urlInput.value);
      selectedFile = null;
      uploadedUrl = '';
      fileInput.value = '';
      urlInput.value = '';
      revokePreview();
      previewImage.removeAttribute('src');
      preview.hidden = true;
      if (copyButton) copyButton.hidden = true;
      uploadButton.disabled = true;
      uploadButton.textContent = 'Upload image';
      setStatus(hadUrl
        ? 'Cleared from this form. Any uploaded copy will expire automatically.'
        : 'JPG, PNG, WebP or GIF · Up to ' + formatBytes(maxBytes) + ' · Auto-removes after ' + expirationDays + ' days.');
    });

    copyButton?.addEventListener('click', async () => {
      if (!uploadedUrl) return;
      try {
        await navigator.clipboard.writeText(uploadedUrl);
        setStatus('Image link copied.', 'success');
      } catch {
        setStatus('Copy this image link: ' + uploadedUrl);
      }
    });
  }
}

if (typeof document !== 'undefined') bindImageUploads(document);
