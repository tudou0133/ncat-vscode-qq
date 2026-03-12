function renderMessageRenderMediaSegmentsScript() {
  return String.raw`
    function getFileIconMeta(fileName) {
      const name = String(fileName || '').trim();
      const m = name.match(/\.([a-z0-9]{1,10})$/i);
      const ext = m ? String(m[1] || '').toLowerCase() : '';
      if (!ext) {
        return { kind: 'folder', label: '' };
      }

      if (ext === 'png') {
        return { kind: 'image-png', label: 'PNG' };
      }
      if (ext === 'jpg' || ext === 'jpeg') {
        return { kind: 'image-jpg', label: ext === 'jpg' ? 'JPG' : 'JPEG' };
      }
      if (ext === 'gif') {
        return { kind: 'image-gif', label: 'GIF' };
      }
      if (['webp', 'bmp', 'svg', 'ico', 'heic', 'avif'].includes(ext)) {
        return { kind: 'image-other', label: ext.toUpperCase() };
      }
      if (ext === 'mp4') {
        return { kind: 'video-mp4', label: 'MP4' };
      }
      if (['mkv', 'avi', 'mov', 'wmv', 'webm', 'flv', 'm4v'].includes(ext)) {
        return { kind: 'video-other', label: ext.toUpperCase() };
      }
      if (ext === 'mp3') {
        return { kind: 'audio-mp3', label: 'MP3' };
      }
      if (['wav', 'flac', 'aac', 'ogg', 'm4a', 'wma'].includes(ext)) {
        return { kind: 'audio-other', label: ext.toUpperCase() };
      }
      if (ext === 'zip') {
        return { kind: 'archive-zip', label: 'ZIP' };
      }
      if (['7z', 'rar', 'tar', 'gz', 'bz2', 'xz'].includes(ext)) {
        return { kind: 'archive-other', label: ext.toUpperCase() };
      }
      if (ext === 'pdf') {
        return { kind: 'pdf', label: ext.toUpperCase() };
      }
      if (ext === 'doc' || ext === 'docx') {
        return { kind: 'doc-word', label: ext.toUpperCase() };
      }
      if (ext === 'xls' || ext === 'xlsx' || ext === 'csv') {
        return { kind: 'doc-sheet', label: ext.toUpperCase() };
      }
      if (ext === 'ppt' || ext === 'pptx') {
        return { kind: 'doc-slide', label: ext.toUpperCase() };
      }
      if (ext === 'txt' || ext === 'md') {
        return { kind: 'text', label: ext.toUpperCase() };
      }
      if (['txt', 'md', 'json', 'xml', 'yaml', 'yml', 'ini', 'log', 'cfg', 'conf', 'c', 'cpp', 'h', 'hpp', 'py', 'js', 'ts', 'tsx', 'jsx', 'java', 'go', 'rs', 'sh', 'bat'].includes(ext)) {
        return { kind: 'code', label: ext.toUpperCase() };
      }

      return { kind: 'folder', label: '' };
    }

    function buildMediaSegment(seg, imageMeta, messageMeta) {
      if (seg.type === 'image') {
        const chip = document.createElement('span');
        chip.className = 'seg-image';
        const enableImagePreview = !!uiPrefs.previewImages;
        const total = Number(imageMeta?.total || 1);
        const index = Number(imageMeta?.index || 1);
        const rawUrl = String(seg.url || '').trim();
        const preferredUrl = mediaResolveCache.get(rawUrl) || rawUrl;
        let popImg = null;

        if (preferredUrl) {
          const thumb = document.createElement('img');
          thumb.className = 'seg-image-thumb';
          thumb.loading = 'lazy';
          thumb.referrerPolicy = 'no-referrer';
          thumb.src = preferredUrl;
          thumb.alt = seg.label || 'image';
          chip.appendChild(thumb);

          if (enableImagePreview) {
            const pop = document.createElement('span');
            pop.className = 'img-pop';
            const img = document.createElement('img');
            img.loading = 'lazy';
            img.referrerPolicy = 'no-referrer';
            img.src = preferredUrl;
            img.alt = seg.label || 'image';
            pop.appendChild(img);
            chip.appendChild(pop);
            setupHoverPopupPosition(chip, pop, 'image');
            popImg = img;
          }
          chip.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            openMediaViewer({
              kind: 'image',
              url: String(thumb.src || preferredUrl),
              title: seg.label || '图片',
            });
          });
          attachImageAutoRecovery({
            thumbNode: thumb,
            popupImageNode: popImg,
            rawUrl,
            messageMeta,
            reasonTag: 'image',
          });
        } else {
          const fallback = document.createElement('span');
          fallback.className = 'seg-image-fallback';
          fallback.textContent = '图片';
          chip.appendChild(fallback);
        }

        if (total > 1) {
          const count = document.createElement('span');
          count.className = 'seg-image-count';
          count.textContent = index + '/' + total;
          chip.appendChild(count);
        }

        return chip;
      }

      if (seg.type === 'video') {
        const chip = document.createElement('span');
        chip.className = 'seg-video';
        const enableVideoPreview = !!uiPrefs.previewVideos;
        const videoUrl = String(seg.url || '').trim();
        const hasUrl = videoUrl.length > 0;
        const coverUrl = String(seg.coverUrl || '').trim();
        const preferredCoverUrl = mediaResolveCache.get(coverUrl) || coverUrl;

        if (preferredCoverUrl) {
          const thumb = document.createElement('img');
          thumb.className = 'seg-video-thumb';
          thumb.loading = 'lazy';
          thumb.referrerPolicy = 'no-referrer';
          thumb.src = preferredCoverUrl;
          thumb.alt = seg.label || 'video';
          thumb.addEventListener('error', () => {
            logWeb('warn', 'video cover load_error: url=' + preferredCoverUrl);
          });
          attachImageAutoRecovery({
            thumbNode: thumb,
            popupImageNode: null,
            rawUrl: coverUrl,
            messageMeta,
            reasonTag: 'video-cover',
          });
          chip.appendChild(thumb);
        } else if (hasUrl) {
          const thumbVideo = document.createElement('video');
          thumbVideo.className = 'seg-video-thumb';
          thumbVideo.src = videoUrl;
          thumbVideo.preload = 'metadata';
          thumbVideo.defaultMuted = true;
          thumbVideo.muted = true;
          thumbVideo.volume = 0;
          thumbVideo.playsInline = true;
          thumbVideo.controls = false;
          thumbVideo.setAttribute('muted', '');
          thumbVideo.addEventListener('loadedmetadata', () => {
            const jump = Math.min(1.2, Math.max(0.08, Number(thumbVideo.duration || 0) * 0.12));
            try {
              thumbVideo.currentTime = jump;
            } catch {
              // Ignore seek failures.
            }
          });
          thumbVideo.addEventListener('seeked', () => {
            thumbVideo.pause();
          });
          thumbVideo.addEventListener('error', () => {
            const errCode = thumbVideo?.error?.code || 'unknown';
            logWeb('warn', 'video thumb load_error: code=' + String(errCode) + ', url=' + videoUrl);
          });
          chip.appendChild(thumbVideo);
        } else {
          const fallback = document.createElement('span');
          fallback.className = 'seg-video-fallback';
          fallback.textContent = '视频';
          chip.appendChild(fallback);
        }

        if (hasUrl) {
          const mark = document.createElement('span');
          mark.className = 'seg-video-playmark';
          mark.textContent = '▶';
          chip.appendChild(mark);
        }

        if (hasUrl && enableVideoPreview) {
          const pop = document.createElement('span');
          pop.className = 'video-pop';
          const video = document.createElement('video');
          video.src = videoUrl;
          video.preload = 'metadata';
          video.defaultMuted = true;
          video.muted = true;
          video.volume = 0;
          video.playsInline = true;
          video.loop = true;
          video.controls = false;
          video.setAttribute('muted', '');
          video.addEventListener('error', () => {
            const errCode = video?.error?.code || 'unknown';
            logWeb('warn', 'video preview load_error: code=' + String(errCode) + ', url=' + videoUrl);
          });
          video.addEventListener('volumechange', () => {
            if (!video.muted || video.volume !== 0) {
              video.muted = true;
              video.volume = 0;
            }
          });
          pop.appendChild(video);
          chip.appendChild(pop);
          setupHoverPopupPosition(chip, pop, 'video');

          chip.addEventListener('mouseenter', () => {
            video.muted = true;
            video.defaultMuted = true;
            video.volume = 0;
            video.play().catch((error) => {
              logWeb('warn', 'video preview play failed: ' + String(error?.message || error));
            });
          });
          chip.addEventListener('mouseleave', () => {
            video.pause();
            try {
              video.currentTime = 0;
            } catch {
              // Ignore seek failure.
            }
          });
        }

        if (hasUrl) {
          chip.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            openMediaViewer({
              kind: 'video',
              url: videoUrl,
              poster: preferredCoverUrl,
              title: seg.label || '视频',
            });
          });
        }

        return chip;
      }

      if (seg.type === 'file') {
        const file = document.createElement('span');
        file.className = 'seg-file';
        file.title = String(seg.text || seg.name || '[文件]');
        const iconMeta = getFileIconMeta(seg.name || '');

        const icon = document.createElement('span');
        icon.className = 'seg-file-icon';
        if (iconMeta.kind === 'folder') {
          const folder = document.createElement('span');
          folder.className = 'seg-file-folder';
          folder.setAttribute('aria-hidden', 'true');
          icon.appendChild(folder);
        } else {
          const badge = document.createElement('span');
          badge.className = 'seg-file-badge seg-file-badge-' + iconMeta.kind;
          badge.dataset.kind = iconMeta.kind;
          const emblem = document.createElement('span');
          emblem.className = 'seg-file-badge-emblem';
          emblem.setAttribute('aria-hidden', 'true');
          const label = document.createElement('span');
          label.className = 'seg-file-badge-label';
          label.textContent = iconMeta.label || 'FILE';
          badge.appendChild(emblem);
          badge.appendChild(label);
          badge.setAttribute('aria-hidden', 'true');
          icon.appendChild(badge);
        }
        file.appendChild(icon);

        const meta = document.createElement('span');
        meta.className = 'seg-file-meta';

        const name = document.createElement('span');
        name.className = 'seg-file-name';
        name.textContent = truncateFileNameKeepExt(seg.name || '文件', 64);
        meta.appendChild(name);

        if (seg.sizeText) {
          const size = document.createElement('span');
          size.className = 'seg-file-size';
          size.textContent = String(seg.sizeText);
          meta.appendChild(size);
        }

        file.appendChild(meta);
        return file;
      }

      return null;
    }
`;
}

module.exports = {
  renderMessageRenderMediaSegmentsScript,
};
