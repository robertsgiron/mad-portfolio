/* ==================================================================
   Shared lightbox — click any [data-lightbox] element (or, for the
   Goodbye Horses YouTube embed, its small corner expand button) to
   open an enlarged image/video/YouTube player in a modal. Close via
   the × button, clicking the dark backdrop, or the Escape key.

   Videos use native <video controls>, and the YouTube embed uses
   YouTube's own player chrome — so time-scrubbing, volume, and
   play/pause all come from native/YouTube controls, not custom UI.

   Deliberately NOT included on: about.html, the menu page's hero
   video (it's a nav link to About, not showcased media), or To Live
   and Die in LA (its live-site preview frame is already a
   click-through to the real deployed site).
   ================================================================== */

(() => {
  let overlay = null;
  let closeBtn = null;
  let contentEl = null;
  let lastTrigger = null;

  function buildOverlay() {
    overlay = document.createElement('div');
    overlay.className = 'lightbox-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Media viewer');

    contentEl = document.createElement('div');
    contentEl.className = 'lightbox-content';
    overlay.appendChild(contentEl);

    closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'lightbox-close';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', closeLightbox);
    // Nested inside the overlay (not appended to body) so it's hidden
    // and non-interactive automatically whenever the overlay is closed
    // — fixes a leftover "invisible ×" sitting in the corner of the
    // page after closing.
    overlay.appendChild(closeBtn);

    document.body.appendChild(overlay);

    // clicking the backdrop itself (not the media) closes the lightbox
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeLightbox();
    });
  }

  function clearContent() {
    if (!contentEl) return;
    const video = contentEl.querySelector('video');
    if (video) {
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
    const iframe = contentEl.querySelector('iframe');
    if (iframe) {
      iframe.src = ''; // stops YouTube playback immediately, not just hides it
    }
    contentEl.innerHTML = '';
  }

  function openLightbox(trigger) {
    if (!overlay) buildOverlay();

    const type = trigger.dataset.lightbox;
    const src = trigger.dataset.src;

    clearContent();

    let media;
    if (type === 'image') {
      media = document.createElement('img');
      media.src = src;
      media.alt = trigger.dataset.alt || '';
    } else if (type === 'video') {
      media = document.createElement('video');
      media.src = src;
      media.controls = true;   // native seek bar + volume + play/pause
      media.autoplay = true;   // opened via a click, so this is a direct user gesture
      media.playsInline = true;
    } else if (type === 'youtube') {
      media = document.createElement('iframe');
      const joiner = src.includes('?') ? '&' : '?';
      media.src = src + joiner + 'autoplay=1';
      media.title = trigger.getAttribute('aria-label') || 'Video player';
      media.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
      media.allowFullscreen = true;
      media.referrerPolicy = 'strict-origin-when-cross-origin';
    } else {
      return;
    }

    contentEl.appendChild(media);

    lastTrigger = trigger;
    overlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    closeBtn.focus();
  }

  function closeLightbox() {
    if (!overlay || !overlay.classList.contains('is-open')) return;
    overlay.classList.remove('is-open');
    document.body.style.overflow = '';
    clearContent();
    if (lastTrigger) {
      lastTrigger.focus({ preventScroll: true });
      lastTrigger = null;
    }
  }

  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-lightbox]');
    if (!trigger) return;
    e.preventDefault();
    openLightbox(trigger);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLightbox();
  });
})();