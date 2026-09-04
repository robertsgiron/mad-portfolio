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
})();
