(() => {
  const videos = Array.from(document.querySelectorAll('video'));

  function startVideo(video) {
    if (!video.paused) return;
    video.muted = true;
    const playback = video.play();
    if (playback && typeof playback.catch === 'function') {
      playback.catch(() => {});
    }
  }

  function resumeVideos() {
    if (document.hidden) return;
    videos.forEach(startVideo);
  }

  videos.forEach(video => {
    video.addEventListener('loadeddata', () => startVideo(video));
    video.addEventListener('canplay', () => startVideo(video));
    // Some browsers (Opera GX, mobile Chrome/Safari) silently pause an
    // autoplaying video during throttling/backgrounding and then leave
    // their native play-button overlay showing over it indefinitely.
    // Resuming the instant it pauses keeps that overlay from ever
    // sticking around.
    video.addEventListener('pause', () => startVideo(video));
    startVideo(video);
  });

  document.addEventListener('visibilitychange', resumeVideos);
  document.addEventListener('pointerdown', resumeVideos, { passive: true });
  document.addEventListener('keydown', resumeVideos);

  // Mobile browsers (Safari in particular) often restore a page from the
  // back/forward cache instead of reloading it when you navigate back —
  // the DOM comes back exactly as it was, mid-video, but the browser may
  // have paused the video while it was cached. `pageshow` fires on both
  // a normal load and a bfcache restore (`event.persisted` tells them
  // apart); resuming unconditionally here means there's never a gap or
  // a stray play button waiting on the home page when you return to it.
  window.addEventListener('pageshow', resumeVideos);
})();
