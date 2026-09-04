/* ==================================================================
   Project title preview — hovering (or focusing) a project title in
   the home page's nav shows a faint, full-page preview of that
   project behind everything else, and hides every other element on
   the page (bars/hairlines/grain, the hero video, the bio caption,
   the other titles, the copyright mark) except the hovered title
   itself, via body.preview-active (see style.css).

   Most projects preview as a still image (data-preview points at the
   project's main photo, applied to the shared #previewImageLayer).
   Tree of Light and To Live and Die in LA instead point at one of the
   two dedicated layers already mounted in the DOM (a looping video, a
   live iframe of the project's own site) via data-preview-layer — both
   layers stay loaded/playing at all times so switching to them is an
   instant opacity toggle, never a load-in delay.
   ================================================================== */

(() => {
  // Touch/mobile devices have no real hover, so a tap would otherwise
  // fire "mouseenter" (showing the preview) and need a second tap to
  // actually follow the link. Skip the whole feature there entirely —
  // every title stays a single, direct tap straight to its page.
  const canHover = window.matchMedia &&
    window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (!canHover) return;

  const preview = document.getElementById('projectPreview');
  const imageLayer = document.getElementById('previewImageLayer');
  const tracks = document.querySelectorAll('.track[data-preview], .track[data-preview-layer]');
  if (!preview || !imageLayer || tracks.length === 0) return;

  const layers = Array.from(preview.querySelectorAll('.preview-layer'));

  function show(track) {
    const layerId = track.dataset.previewLayer;
    let target = imageLayer;

    if (layerId) {
      target = document.getElementById(layerId) || imageLayer;
    } else {
      imageLayer.style.backgroundImage = `url("${track.dataset.preview}")`;
    }

    layers.forEach(layer => layer.classList.toggle('visible', layer === target));
    track.classList.add('preview-current');
    document.body.classList.add('preview-active');
  }

  function hide(track) {
    layers.forEach(layer => layer.classList.remove('visible'));
    track.classList.remove('preview-current');
    document.body.classList.remove('preview-active');
  }

  tracks.forEach(track => {
    track.addEventListener('mouseenter', () => show(track));
    track.addEventListener('mouseleave', () => hide(track));
    track.addEventListener('focus', () => show(track));
    track.addEventListener('blur', () => hide(track));
  });
})();
