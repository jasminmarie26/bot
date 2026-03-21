(() => {
  const notificationLink = document.querySelector("[data-guestbook-notification-root]");
  if (!notificationLink || typeof io !== "function") return;

  const badge = notificationLink.querySelector("[data-guestbook-notification-badge]");
  const notificationHref = "/guestbook/notifications/open";
  const hasEmail = notificationLink.dataset.hasEmail === "true";

  function buildNotificationTitle(characterName) {
    const trimmedCharacterName = String(characterName || "").trim();
    return trimmedCharacterName
      ? `Neuer Gästebucheintrag für ${trimmedCharacterName}`
      : "Neuer Gästebucheintrag";
  }

  function formatBadgeCount(count) {
    return count > 99 ? "99+" : String(count);
  }

  function applyNotificationPayload(payload) {
    const count = Number(payload?.count || 0);
    const latestCharacterName = String(payload?.latest?.character_name || "").trim();
    const hasNotification = count > 0;
    const title = buildNotificationTitle(latestCharacterName);

    notificationLink.href = notificationHref;
    notificationLink.title = title;
    notificationLink.setAttribute("aria-label", title);
    notificationLink.dataset.notificationCount = String(count);
    notificationLink.dataset.notificationCharacterName = latestCharacterName;

    if (!hasNotification) {
      notificationLink.hidden = true;
      if (badge) {
        badge.textContent = "0";
      }
      return;
    }

    notificationLink.hidden = false;
    if (badge) {
      badge.textContent = formatBadgeCount(count);
    }
  }

  const initialPayload = {
    count: Number(notificationLink.dataset.notificationCount || 0),
    latest: {
      character_name: notificationLink.dataset.notificationCharacterName || ""
    }
  };
  applyNotificationPayload(initialPayload);

  if (!hasEmail) {
    notificationLink.addEventListener("click", (event) => {
      event.preventDefault();
    });
  }

  const socket = io({
    transports: ["websocket"]
  });
  socket.on("guestbook:notification:update", applyNotificationPayload);
})();
