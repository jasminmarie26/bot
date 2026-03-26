(() => {
  const notificationLink = document.querySelector("[data-guestbook-notification-root]");
  if (!notificationLink || typeof io !== "function") return;

  const badge = notificationLink.querySelector("[data-guestbook-notification-badge]");
  const notificationHref = "/guestbook/notifications/open";

  function buildNotificationTitle(notificationType, characterName, festplayName, applicantCharacterName) {
    const normalizedType = String(notificationType || "").trim().toLowerCase();
    const trimmedCharacterName = String(characterName || "").trim();
    const trimmedFestplayName = String(festplayName || "").trim();
    const trimmedApplicantCharacterName = String(applicantCharacterName || "").trim();

    if (normalizedType === "festplay_application") {
      if (trimmedFestplayName && trimmedApplicantCharacterName) {
        return `Neue Bewerbung von ${trimmedApplicantCharacterName} für ${trimmedFestplayName}`;
      }
      if (trimmedFestplayName) {
        return `Neue Bewerbung für ${trimmedFestplayName}`;
      }
      return "Neue Festspiel-Bewerbung";
    }

    return trimmedCharacterName
      ? `Neuer Gästebucheintrag für ${trimmedCharacterName}`
      : "Neuer Gästebucheintrag";
  }

  function formatBadgeCount(count) {
    return count > 99 ? "99+" : String(count);
  }

  function applyNotificationPayload(payload) {
    const count = Number(payload?.count || 0);
    const latestType = String(payload?.latest?.type || "").trim();
    const latestCharacterName = String(payload?.latest?.character_name || "").trim();
    const latestFestplayName = String(payload?.latest?.festplay_name || "").trim();
    const latestApplicantCharacterName = String(payload?.latest?.applicant_character_name || "").trim();
    const hasNotification = count > 0;
    const title = buildNotificationTitle(
      latestType,
      latestCharacterName,
      latestFestplayName,
      latestApplicantCharacterName
    );

    notificationLink.href = notificationHref;
    notificationLink.title = title;
    notificationLink.setAttribute("aria-label", title);
    notificationLink.setAttribute("aria-disabled", hasNotification ? "false" : "true");
    notificationLink.dataset.notificationCount = String(count);
    notificationLink.dataset.notificationType = latestType;
    notificationLink.dataset.notificationCharacterName = latestCharacterName;
    notificationLink.dataset.notificationFestplayName = latestFestplayName;
    notificationLink.dataset.notificationApplicantCharacterName = latestApplicantCharacterName;

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
      type: notificationLink.dataset.notificationType || "",
      character_name: notificationLink.dataset.notificationCharacterName || "",
      festplay_name: notificationLink.dataset.notificationFestplayName || "",
      applicant_character_name: notificationLink.dataset.notificationApplicantCharacterName || ""
    }
  };
  applyNotificationPayload(initialPayload);

  notificationLink.addEventListener("click", (event) => {
    const notificationCount = Number(notificationLink.dataset.notificationCount || 0);
    if (!Number.isFinite(notificationCount) || notificationCount < 1) {
      event.preventDefault();
    }
  });

  const socket = io({
    transports: ["websocket"]
  });
  socket.on("guestbook:notification:update", applyNotificationPayload);
})();
