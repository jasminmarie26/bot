(() => {
  const KEEPALIVE_INTERVAL_MS = 1000 * 60 * 5;
  const ACTIVITY_TOUCH_INTERVAL_MS = 1000 * 60;
  let lastTouchAt = 0;
  let activityTouchQueued = false;

  const touchSession = async ({ force = false, minimumIntervalMs = KEEPALIVE_INTERVAL_MS - 1000 * 5 } = {}) => {
    const now = Date.now();
    if (!force && now - lastTouchAt < minimumIntervalMs) {
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

  const queueActivityTouch = () => {
    if (activityTouchQueued) {
      return;
    }

    activityTouchQueued = true;
    window.requestAnimationFrame(() => {
      activityTouchQueued = false;
      void touchSession({ minimumIntervalMs: ACTIVITY_TOUCH_INTERVAL_MS });
    });
  };

  window.setInterval(() => {
    void touchSession();
  }, KEEPALIVE_INTERVAL_MS);

  ["pointerdown", "keydown", "input", "change", "submit"].forEach((eventName) => {
    document.addEventListener(eventName, queueActivityTouch, eventName === "pointerdown" ? { passive: true } : undefined);
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      void touchSession({ force: true });
    }
  });

  window.addEventListener("focus", () => {
    void touchSession({ force: true });
  });

  void touchSession({ force: true });
})();
