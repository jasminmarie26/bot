(() => {
  const root = document.querySelector("[data-guestbook-music-root]");
  const playerHost = document.getElementById("guestbook-background-music-player");
  const panel = document.querySelector("[data-guestbook-music-panel]");
  const showButton = document.querySelector("[data-guestbook-music-show]");
  const playButton = document.querySelector("[data-guestbook-music-play]");
  const hideButton = document.querySelector("[data-guestbook-music-hide]");
  const volumeInput = document.querySelector("[data-guestbook-music-volume]");
  const volumeValue = document.querySelector("[data-guestbook-music-volume-value]");
  const titleNode = document.querySelector("[data-guestbook-music-title]");
  const linkNode = document.querySelector("[data-guestbook-music-link]");
  const videoId = String(root?.dataset.videoId || "").trim();

  if (
    !root ||
    !playerHost ||
    !panel ||
    !showButton ||
    !playButton ||
    !hideButton ||
    !volumeInput ||
    !volumeValue ||
    !titleNode ||
    !linkNode ||
    !videoId
  ) {
    return;
  }

  const DEFAULT_VOLUME = 28;
  const DEFAULT_TITLE = "YouTube-Track";
  const VOLUME_STORAGE_KEY = "guestbook-music-volume";
  const HIDDEN_STORAGE_KEY = "guestbook-music-hidden";
  let player = null;
  let playerReadyPromise = null;
  let currentVolume = readStoredVolume();
  let isHidden = readHiddenState();
  let metaRefreshTimeout = null;

  function clampVolume(value) {
    return Math.min(100, Math.max(0, Math.round(Number(value) || 0)));
  }

  function readStoredVolume() {
    try {
      const storedValue = window.localStorage.getItem(VOLUME_STORAGE_KEY);
      return storedValue === null ? DEFAULT_VOLUME : clampVolume(storedValue);
    } catch (_error) {
      return DEFAULT_VOLUME;
    }
  }

  function persistVolume(value) {
    try {
      window.localStorage.setItem(VOLUME_STORAGE_KEY, String(value));
    } catch (_error) {}
  }

  function readHiddenState() {
    try {
      const storedValue = window.localStorage.getItem(HIDDEN_STORAGE_KEY);
      return storedValue === null ? true : storedValue === "1";
    } catch (_error) {
      return true;
    }
  }

  function persistHiddenState(value) {
    try {
      window.localStorage.setItem(HIDDEN_STORAGE_KEY, value ? "1" : "0");
    } catch (_error) {}
  }

  function renderVolume(value) {
    const normalizedVolume = clampVolume(value);
    volumeInput.value = String(normalizedVolume);
    volumeValue.textContent = `${normalizedVolume}%`;
  }

  function renderVisibility() {
    root.classList.toggle("is-hidden", isHidden);
    panel.hidden = isHidden;
    showButton.setAttribute("aria-expanded", isHidden ? "false" : "true");
    showButton.setAttribute("aria-label", isHidden ? "Musikplayer einblenden" : "Musikplayer ausblenden");
    showButton.classList.toggle("is-active", !isHidden);
  }

  function getPlayerState() {
    try {
      return typeof player?.getPlayerState === "function" ? player.getPlayerState() : -1;
    } catch (_error) {
      return -1;
    }
  }

  function isCurrentlyPlaying() {
    const playingState = window.YT?.PlayerState?.PLAYING;
    return typeof playingState === "number" && getPlayerState() === playingState;
  }

  function renderPlayState() {
    const isPlaying = isCurrentlyPlaying();
    playButton.textContent = isPlaying ? "Pause" : "Play";
    playButton.setAttribute("aria-pressed", isPlaying ? "true" : "false");
    playButton.setAttribute("aria-label", isPlaying ? "Musik pausieren" : "Musik abspielen");
    playButton.classList.toggle("is-playing", isPlaying);
  }

  function applyVolumeToPlayer() {
    if (!player) {
      return;
    }

    try {
      player.setVolume(currentVolume);
      if (currentVolume <= 0) {
        player.mute();
      } else {
        player.unMute();
      }
    } catch (_error) {}
  }

  function updateTrackMeta() {
    const fallbackUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
    let nextTitle = DEFAULT_TITLE;
    let nextUrl = fallbackUrl;

    try {
      const videoData = typeof player?.getVideoData === "function" ? player.getVideoData() : null;
      const resolvedTitle = String(videoData?.title || "").trim();
      if (resolvedTitle) {
        nextTitle = resolvedTitle;
      }

      const resolvedUrl = String(typeof player?.getVideoUrl === "function" ? player.getVideoUrl() || "" : "").trim();
      if (resolvedUrl) {
        nextUrl = resolvedUrl;
      }
    } catch (_error) {}

    titleNode.textContent = nextTitle;
    linkNode.href = nextUrl;
  }

  function scheduleMetaRefresh(attempt = 0) {
    if (metaRefreshTimeout) {
      window.clearTimeout(metaRefreshTimeout);
      metaRefreshTimeout = null;
    }

    if (attempt > 6) {
      return;
    }

    metaRefreshTimeout = window.setTimeout(() => {
      updateTrackMeta();
      if (String(titleNode.textContent || "").trim() === DEFAULT_TITLE) {
        scheduleMetaRefresh(attempt + 1);
      }
    }, attempt === 0 ? 120 : 450);
  }

  function loadYouTubeApi() {
    if (window.YT && typeof window.YT.Player === "function") {
      return Promise.resolve(window.YT);
    }

    if (window.__guestbookMusicYoutubeApiPromise) {
      return window.__guestbookMusicYoutubeApiPromise;
    }

    window.__guestbookMusicYoutubeApiPromise = new Promise((resolve, reject) => {
      const existingScript = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
      const previousCallback = window.onYouTubeIframeAPIReady;

      window.onYouTubeIframeAPIReady = () => {
        if (typeof previousCallback === "function") {
          previousCallback();
        }
        resolve(window.YT);
      };

      if (existingScript) {
        return;
      }

      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.onerror = () => {
        titleNode.textContent = DEFAULT_TITLE;
        reject(new Error("YouTube API konnte nicht geladen werden."));
      };
      document.head.appendChild(script);
    });

    return window.__guestbookMusicYoutubeApiPromise;
  }

  function ensurePlayer() {
    if (playerReadyPromise) {
      return playerReadyPromise;
    }

    playerReadyPromise = loadYouTubeApi().then(
      (youtubeApi) =>
        new Promise((resolve, reject) => {
          player = new youtubeApi.Player("guestbook-background-music-player", {
            width: "1",
            height: "1",
            videoId,
            playerVars: {
              autoplay: 0,
              controls: 0,
              disablekb: 1,
              fs: 0,
              iv_load_policy: 3,
              loop: 1,
              modestbranding: 1,
              playsinline: 1,
              playlist: videoId,
              rel: 0
            },
            events: {
              onReady: () => {
                try {
                  applyVolumeToPlayer();
                  player.cueVideoById(videoId);
                } catch (_error) {}

                updateTrackMeta();
                scheduleMetaRefresh();
                renderPlayState();
                resolve(player);
              },
              onStateChange: () => {
                updateTrackMeta();
                renderPlayState();
              },
              onError: () => {
                titleNode.textContent = DEFAULT_TITLE;
                renderPlayState();
                reject(new Error("YouTube Player konnte nicht gestartet werden."));
              }
            }
          });
        })
    );

    return playerReadyPromise;
  }

  async function togglePlayback() {
    try {
      await ensurePlayer();
      applyVolumeToPlayer();
      if (isCurrentlyPlaying()) {
        player.pauseVideo();
      } else {
        player.playVideo();
      }
      renderPlayState();
    } catch (_error) {
      renderPlayState();
    }
  }

  showButton.addEventListener("click", () => {
    isHidden = !isHidden;
    persistHiddenState(isHidden);
    renderVisibility();
  });

  hideButton.addEventListener("click", () => {
    isHidden = true;
    persistHiddenState(true);
    renderVisibility();
    showButton.focus();
  });

  playButton.addEventListener("click", () => {
    void togglePlayback();
  });

  volumeInput.addEventListener("input", () => {
    currentVolume = clampVolume(volumeInput.value);
    persistVolume(currentVolume);
    renderVolume(currentVolume);
    applyVolumeToPlayer();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || isHidden) {
      return;
    }

    isHidden = true;
    persistHiddenState(true);
    renderVisibility();
    showButton.focus();
  });

  renderVolume(currentVolume);
  renderVisibility();
  updateTrackMeta();
  renderPlayState();
  void ensurePlayer().catch(() => {
    titleNode.textContent = DEFAULT_TITLE;
  });
})();
