(() => {
  const KEEPALIVE_INTERVAL_MS = 1000 * 60 * 5;
  let lastTouchAt = 0;

  const touchSession = async (force = false) => {
    const now = Date.now();
    if (!force && now - lastTouchAt < KEEPALIVE_INTERVAL_MS - 1000 * 5) {
      return;
    }

    lastTouchAt = now;

    try {
      const response = await window.fetch("/session/touch", {
        method: "POST",
        credentials: "same-origin",
        keepalive: true,
        headers: {
          "x-requested-with": "XMLHttpRequest"
        }
      });

      if (response.status === 401 || response.status === 403) {
        window.location.assign("/login");
      }
    } catch (_error) {
      // Ignore transient failures; the next keepalive will retry.
    }
  };

  window.setInterval(() => {
    void touchSession();
  }, KEEPALIVE_INTERVAL_MS);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      void touchSession(true);
    }
  });

  window.addEventListener("focus", () => {
    void touchSession(true);
  });

  void touchSession(true);
})();
