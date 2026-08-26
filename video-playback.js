(() => {
  const videos = Array.from(document.querySelectorAll('video'));

  function startVideo(video) {
    video.muted = true;
    const playback = video.play();
    if (playback && typeof playback.catch === 'function') {
      playback.catch(() => {});
    }
  }

  videos.forEach(video => {
    video.addEventListener('loadeddata', () => startVideo(video));
    video.addEventListener('canplay', () => startVideo(video));
    startVideo(video);
  });

  const resumeVideos = () => {
    videos.forEach(startVideo);
  };

  document.addEventListener('pointerdown', resumeVideos, { once: true, passive: true });
  document.addEventListener('keydown', resumeVideos, { once: true });
})();
