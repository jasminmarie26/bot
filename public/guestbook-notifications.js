(() => {
  const notificationLink = document.querySelector("[data-guestbook-notification-root]");
  if (!notificationLink || typeof io !== "function") return;

  const badge = notificationLink.querySelector("[data-guestbook-notification-badge]");
  const notificationHref = "/guestbook/notifications/open";

  function buildNotificationTitle(
    notificationType,
    characterName,
    festplayName,
    applicantCharacterName,
    actorName
  ) {
    const normalizedType = String(notificationType || "").trim().toLowerCase();
    const trimmedCharacterName = String(characterName || "").trim();
    const trimmedFestplayName = String(festplayName || "").trim();
    const trimmedApplicantCharacterName = String(applicantCharacterName || "").trim();
    const trimmedActorName = String(actorName || "").trim();

    if (normalizedType === "festplay_application") {
      if (trimmedFestplayName && trimmedApplicantCharacterName) {
        return `Neue Bewerbung von ${trimmedApplicantCharacterName} fuer ${trimmedFestplayName}`;
      }
      if (trimmedFestplayName) {
        return `Neue Bewerbung fuer ${trimmedFestplayName}`;
      }
      return "Neue Festspiel-Bewerbung";
    }

    if (normalizedType === "festplay_approval") {
      if (trimmedFestplayName && trimmedActorName) {
        return `${trimmedActorName} hat dich fuer ${trimmedFestplayName} freigeschaltet`;
      }
      if (trimmedFestplayName) {
        return `Du wurdest fuer ${trimmedFestplayName} freigeschaltet`;
      }
      return "Neue Festspiel-Freischaltung";
    }

    return trimmedCharacterName
      ? `Neuer Gaestebucheintrag fuer ${trimmedCharacterName}`
      : "Neuer Gaestebucheintrag";
  }

  function formatBadgeCount(count) {
    return count > 99 ? "99+" : String(count);
  }

  function applyNotificationPayload(payload) {
    const count = Number(payload?.count || 0);
    const latestId = Number(payload?.latest?.id || 0);
    const latestType = String(payload?.latest?.type || "").trim();
    const latestCharacterName = String(payload?.latest?.character_name || "").trim();
    const latestFestplayName = String(payload?.latest?.festplay_name || "").trim();
    const latestApplicantCharacterName = String(payload?.latest?.applicant_character_name || "").trim();
    const latestActorName = String(payload?.latest?.actor_name || "").trim();
    const hasNotification = count > 0;
    const title = buildNotificationTitle(
      latestType,
      latestCharacterName,
      latestFestplayName,
      latestApplicantCharacterName,
      latestActorName
    );

    notificationLink.href = notificationHref;
    notificationLink.title = title;
    notificationLink.setAttribute("aria-label", title);
    notificationLink.setAttribute("aria-disabled", hasNotification ? "false" : "true");
    notificationLink.dataset.notificationCount = String(count);
    notificationLink.dataset.notificationId = String(latestId);
    notificationLink.dataset.notificationType = latestType;
    notificationLink.dataset.notificationCharacterName = latestCharacterName;
    notificationLink.dataset.notificationFestplayName = latestFestplayName;
    notificationLink.dataset.notificationApplicantCharacterName = latestApplicantCharacterName;
    notificationLink.dataset.notificationActorName = latestActorName;

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
      id: Number(notificationLink.dataset.notificationId || 0),
      type: notificationLink.dataset.notificationType || "",
      character_name: notificationLink.dataset.notificationCharacterName || "",
      festplay_name: notificationLink.dataset.notificationFestplayName || "",
      applicant_character_name: notificationLink.dataset.notificationApplicantCharacterName || "",
      actor_name: notificationLink.dataset.notificationActorName || ""
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
