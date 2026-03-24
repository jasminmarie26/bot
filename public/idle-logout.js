(() => {
  const IDLE_TIMEOUT_MS = 1000 * 60;
  const WARNING_COUNTDOWN_MS = 1000 * 15;
  const WARNING_DELAY_MS = Math.max(0, IDLE_TIMEOUT_MS - WARNING_COUNTDOWN_MS);
  const ACTIVITY_THROTTLE_MS = 1500;
  const SESSION_TOUCH_THROTTLE_MS = 1000 * 20;
  const ACTIVITY_SYNC_KEY = "site-idle:last-activity-at";
  const FORCE_LOGOUT_SYNC_KEY = "site-idle:force-logout-at";
  const activityEvents = [
    "click",
    "keydown",
    "input",
    "change",
    "paste",
    "pointerdown",
    "touchstart"
  ];
  const modal = document.getElementById("idle-logout-modal");
  const countdownElement = document.getElementById("idle-logout-countdown");
  const cancelButton = document.getElementById("idle-logout-cancel");
  const continueButton = document.getElementById("idle-logout-continue");
  const countdownLabel = document.getElementById("idle-logout-countdown-label");

  if (!modal || !countdownElement || !cancelButton || !continueButton || !countdownLabel) {
    return;
  }

  let warningTimer = null;
  let countdownTimer = null;
  let lastActivityAt = Date.now();
  let lastSessionTouchAt = 0;
  let warningVisible = false;
  let logoutAt = 0;
  let logoutStarted = false;

  const setSharedTimestamp = (key, value) => {
    try {
      window.localStorage.setItem(key, String(value));
    } catch (_error) {
      // Ignore storage sync failures; idle logout still works per tab.
    }
  };

  const syncModalVisibility = () => {
    modal.hidden = !warningVisible;
    modal.classList.toggle("is-open", warningVisible);
  };

  const performLogout = ({ broadcast = true } = {}) => {
    if (logoutStarted) return;
    logoutStarted = true;
    window.clearTimeout(warningTimer);
    window.clearInterval(countdownTimer);
    warningVisible = false;
    syncModalVisibility();
    if (broadcast) {
      setSharedTimestamp(FORCE_LOGOUT_SYNC_KEY, Date.now());
    }
    window.location.assign("/logout-idle");
  };

  const updateCountdown = () => {
    if (!warningVisible) return;

    const remainingMs = Math.max(0, logoutAt - Date.now());
    const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
    countdownElement.textContent = String(remainingSeconds);
    countdownLabel.textContent =
      remainingSeconds === 1 ? "Sekunde" : "Sekunden";

    if (remainingMs <= 0) {
      performLogout();
    }
  };

  const scheduleWarning = () => {
    window.clearTimeout(warningTimer);
    if (warningVisible || logoutStarted) {
      return;
    }

    const elapsedMs = Math.max(0, Date.now() - lastActivityAt);
    const remainingMs = Math.max(0, WARNING_DELAY_MS - elapsedMs);
    warningTimer = window.setTimeout(() => {
      warningVisible = true;
      logoutAt = Date.now() + WARNING_COUNTDOWN_MS;
      syncModalVisibility();
      updateCountdown();
      window.clearInterval(countdownTimer);
      countdownTimer = window.setInterval(updateCountdown, 250);
      cancelButton.focus();
    }, remainingMs);
  };

  const closeWarning = ({ resetActivity = true, syncTabs = true } = {}) => {
    warningVisible = false;
    window.clearTimeout(warningTimer);
    window.clearInterval(countdownTimer);
    syncModalVisibility();

    if (resetActivity) {
      const now = Date.now();
      lastActivityAt = now;
      if (syncTabs) {
        setSharedTimestamp(ACTIVITY_SYNC_KEY, now);
      }
      scheduleWarning();
    }
  };

  const touchSession = async (force = false) => {
    const now = Date.now();
    if (!force && now - lastSessionTouchAt < SESSION_TOUCH_THROTTLE_MS) {
      return;
    }

    lastSessionTouchAt = now;
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
        performLogout({ broadcast: false });
      }
    } catch (_error) {
      // Ignore transient network failures; the next request can refresh the session.
    }
  };

  const registerActivity = ({ force = false, syncTabs = true } = {}) => {
    if (warningVisible || logoutStarted) {
      return;
    }

    const now = Date.now();
    if (!force && now - lastActivityAt < ACTIVITY_THROTTLE_MS) {
      return;
    }

    lastActivityAt = now;
    if (syncTabs) {
      setSharedTimestamp(ACTIVITY_SYNC_KEY, now);
    }
    scheduleWarning();
    void touchSession(force);
  };

  activityEvents.forEach((eventName) => {
    window.addEventListener(eventName, () => registerActivity({ force: false }), { passive: true });
  });

  window.addEventListener("focus", () => registerActivity({ force: true }));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      registerActivity({ force: true });
    }
  });

  cancelButton.addEventListener("click", () => {
    closeWarning({ resetActivity: true, syncTabs: true });
    void touchSession(true);
  });

  continueButton.addEventListener("click", () => {
    performLogout();
  });

  document.addEventListener("keydown", (event) => {
    if (!warningVisible) return;

    if (event.key === "Escape") {
      event.preventDefault();
      closeWarning({ resetActivity: true, syncTabs: true });
      void touchSession(true);
    }
  });

  window.addEventListener("storage", (event) => {
    if (event.key === ACTIVITY_SYNC_KEY) {
      const sharedActivityAt = Number(event.newValue);
      if (!Number.isFinite(sharedActivityAt) || sharedActivityAt <= lastActivityAt) {
        return;
      }

      lastActivityAt = sharedActivityAt;
      if (warningVisible) {
        closeWarning({ resetActivity: false, syncTabs: false });
      }
      scheduleWarning();
      return;
    }

    if (event.key === FORCE_LOGOUT_SYNC_KEY && event.newValue) {
      performLogout({ broadcast: false });
    }
  });

  lastActivityAt = Date.now();
  setSharedTimestamp(ACTIVITY_SYNC_KEY, lastActivityAt);
  syncModalVisibility();
  scheduleWarning();
  void touchSession(true);
})();
