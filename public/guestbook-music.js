(() => {
  const root = document.querySelector("[data-guestbook-music-root]");
  const playerHost = document.getElementById("guestbook-background-music-player");
  const startButton = document.querySelector("[data-guestbook-music-start]");
  const volumeInput = document.querySelector("[data-guestbook-music-volume]");
  const volumeValue = document.querySelector("[data-guestbook-music-volume-value]");
  const videoId = String(root?.dataset.videoId || "").trim();

  if (!root || !playerHost || !startButton || !volumeInput || !volumeValue || !videoId) {
    return;
  }

  const AUTOPLAY_CHECK_DELAY_MS = 1100;
  const DEFAULT_VOLUME = 28;
  const STORAGE_KEY = "guestbook-music-volume";
  let player = null;
  let autoplayAttemptFinished = false;
  let isMutedFallbackActive = false;
  let playerReadyPromise = null;
  let initialInteractionBound = false;

  const clampVolume = (value) => Math.min(100, Math.max(0, Math.round(Number(value) || 0)));

  const readStoredVolume = () => {
    try {
      const storedValue = window.localStorage.getItem(STORAGE_KEY);
      if (storedValue === null) {
        return DEFAULT_VOLUME;
      }
      return clampVolume(storedValue);
    } catch (_error) {
      return DEFAULT_VOLUME;
    }
  };

  let currentVolume = readStoredVolume();

  const persistVolume = (value) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(value));
    } catch (_error) {}
  };

  const renderVolume = (value) => {
    const normalizedVolume = clampVolume(value);
    volumeInput.value = String(normalizedVolume);
    volumeValue.textContent = `${normalizedVolume}%`;
  };

  const applyVolumeToPlayer = () => {
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
  };

  const showStartButton = (label = "Musik starten") => {
    startButton.textContent = label;
    startButton.hidden = false;
  };

  const hideStartButton = () => {
    startButton.hidden = true;
  };

  const safeGetPlayerState = () => {
    try {
      return typeof player?.getPlayerState === "function" ? player.getPlayerState() : -1;
    } catch (_error) {
      return -1;
    }
  };

  const isCurrentlyPlaying = () => {
    const youtubeApi = window.YT;
    const playingState = youtubeApi?.PlayerState?.PLAYING;
    return typeof playingState === "number" && safeGetPlayerState() === playingState;
  };

  const bindInitialInteraction = () => {
    if (initialInteractionBound) {
      return;
    }

    initialInteractionBound = true;
    const handleFirstInteraction = () => {
      void activateMusic();
    };

    document.addEventListener("pointerdown", handleFirstInteraction, { once: true, passive: true });
    document.addEventListener(
      "keydown",
      (event) => {
        if (event.metaKey || event.ctrlKey || event.altKey) {
          return;
        }
        handleFirstInteraction();
      },
      { once: true }
    );
  };

  const loadYouTubeApi = () => {
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
        showStartButton();
        reject(new Error("YouTube API konnte nicht geladen werden."));
      };
      document.head.appendChild(script);
    });

    return window.__guestbookMusicYoutubeApiPromise;
  };

  const scheduleAutoplayCheck = () => {
    window.setTimeout(() => {
      if (isCurrentlyPlaying()) {
        hideStartButton();
        autoplayAttemptFinished = true;
        return;
      }

      try {
        player?.mute();
        player?.playVideo();
        isMutedFallbackActive = true;
      } catch (_error) {}

      window.setTimeout(() => {
        autoplayAttemptFinished = true;
        if (isCurrentlyPlaying()) {
          showStartButton("Musik einschalten");
        } else {
          showStartButton("Musik starten");
        }
      }, 900);
    }, AUTOPLAY_CHECK_DELAY_MS);
  };

  const ensurePlayer = async () => {
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
              autoplay: 1,
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
                  player.playVideo();
                } catch (_error) {}

                bindInitialInteraction();
                scheduleAutoplayCheck();
                resolve(player);
              },
              onStateChange: () => {
                if (!autoplayAttemptFinished && isCurrentlyPlaying() && !isMutedFallbackActive) {
                  hideStartButton();
                  return;
                }

                if (isCurrentlyPlaying() && !isMutedFallbackActive) {
                  hideStartButton();
                }
              },
              onError: () => {
                showStartButton();
                reject(new Error("YouTube Player konnte nicht gestartet werden."));
              }
            }
          });
        })
    );

    return playerReadyPromise;
  };

  const activateMusic = async () => {
    try {
      await ensurePlayer();
      applyVolumeToPlayer();
      player.playVideo();
      isMutedFallbackActive = false;

      window.setTimeout(() => {
        if (isCurrentlyPlaying()) {
          hideStartButton();
        } else {
          showStartButton("Musik starten");
        }
      }, 500);
    } catch (_error) {
      showStartButton("Musik starten");
    }
  };

  startButton.addEventListener("click", () => {
    void activateMusic();
  });

  volumeInput.addEventListener("input", () => {
    currentVolume = clampVolume(volumeInput.value);
    persistVolume(currentVolume);
    renderVolume(currentVolume);
    applyVolumeToPlayer();
  });

  const activateMusicFromVolumeInteraction = () => {
    void activateMusic();
  };

  volumeInput.addEventListener("change", activateMusicFromVolumeInteraction);
  volumeInput.addEventListener("pointerup", activateMusicFromVolumeInteraction);
  volumeInput.addEventListener("keyup", (event) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight" || event.key === "Home" || event.key === "End") {
      activateMusicFromVolumeInteraction();
    }
  });

  renderVolume(currentVolume);

  void ensurePlayer().catch(() => {
    showStartButton("Musik starten");
  });
})();
