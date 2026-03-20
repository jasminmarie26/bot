(() => {
  const IDLE_TIMEOUT_MS = 1000 * 60 * 60;
  const ACTIVITY_THROTTLE_MS = 15000;
  const activityEvents = [
    "click",
    "keydown",
    "input",
    "change",
    "paste",
    "pointerdown",
    "touchstart"
  ];

  let logoutTimer = null;
  let lastActivityAt = Date.now();

  const scheduleLogout = () => {
    window.clearTimeout(logoutTimer);
    logoutTimer = window.setTimeout(() => {
      window.location.assign("/logout-idle");
    }, IDLE_TIMEOUT_MS);
  };

  const registerActivity = (force = false) => {
    const now = Date.now();
    if (!force && now - lastActivityAt < ACTIVITY_THROTTLE_MS) {
      return;
    }
    lastActivityAt = now;
    scheduleLogout();
  };

  activityEvents.forEach((eventName) => {
    window.addEventListener(eventName, () => registerActivity(false), { passive: true });
  });

  scheduleLogout();
})();
