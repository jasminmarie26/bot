(() => {
  const KEEPALIVE_INTERVAL_MS = 1000 * 60 * 5;
  const ACTIVITY_TOUCH_INTERVAL_MS = 1000 * 60;
  const tabId =
    typeof window.crypto?.randomUUID === "function"
      ? window.crypto.randomUUID().replace(/-/g, "")
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
  let lastTouchAt = 0;
  let activityTouchQueued = false;
  let tabCloseSent = false;

  const getCurrentPagePath = () =>
    `${window.location.pathname || "/"}${window.location.search || ""}${window.location.hash || ""}`;

  const getCurrentPageTitle = () => String(document.title || "").trim();

  const buildTouchPayload = () => {
    const payload = new URLSearchParams();
    if (tabId) {
      payload.set("tab_id", tabId);
    }
    const currentPagePath = getCurrentPagePath();
    const currentPageTitle = getCurrentPageTitle();
    if (currentPagePath) {
      payload.set("page_path", currentPagePath);
    }
    if (currentPageTitle) {
      payload.set("page_title", currentPageTitle);
    }
    return payload.toString();
  };

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
        body: buildTouchPayload(),
        headers: {
          "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
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

  const sendTabClose = () => {
    if (tabCloseSent || !tabId) {
      return;
    }

    tabCloseSent = true;
    const payload = buildTouchPayload();

    if (typeof window.navigator.sendBeacon === "function") {
      try {
        const blob = new Blob([payload], {
          type: "application/x-www-form-urlencoded;charset=UTF-8"
        });
        window.navigator.sendBeacon("/session/tab-close", blob);
        return;
      } catch (_error) {
        // Fall through to fetch keepalive below.
      }
    }

    void window.fetch("/session/tab-close", {
      method: "POST",
      credentials: "same-origin",
      keepalive: true,
      body: payload,
      headers: {
        "content-type": "application/x-www-form-urlencoded;charset=UTF-8"
      }
    }).catch(() => {});
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

  window.addEventListener("pagehide", sendTabClose);
  window.addEventListener("beforeunload", sendTabClose);

  void touchSession({ force: true });
})();
