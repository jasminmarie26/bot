(() => {
  const notificationLink = document.querySelector("[data-guestbook-notification-root]");
  if (!notificationLink) return;

  const badge = notificationLink.querySelector("[data-guestbook-notification-badge]");
  const notificationHref = "/guestbook/notifications/open";
  const approvalNotificationType = "festplay_approval";
  const canUseRealtimeUpdates = typeof io === "function";
  let approvalPanelElements = null;

  function getApprovalPanelElements() {
    if (approvalPanelElements) {
      return approvalPanelElements;
    }

    const panel = document.createElement("div");
    panel.id = "guestbook-notification-panel";
    panel.className = "chat-whisper-panel";
    panel.hidden = true;

    const card = document.createElement("div");
    card.className = "chat-whisper-panel-card";

    const head = document.createElement("header");
    head.className = "chat-whisper-panel-head";

    const copy = document.createElement("div");
    copy.className = "chat-whisper-panel-copy";

    const heading = document.createElement("h3");
    heading.textContent = "Brief";

    const subheading = document.createElement("p");
    subheading.textContent = "Systemnachricht";

    copy.appendChild(heading);
    copy.appendChild(subheading);

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "chat-whisper-close-btn";
    closeButton.setAttribute("aria-label", "Schliessen");
    closeButton.textContent = "\u00d7";

    head.appendChild(copy);
    head.appendChild(closeButton);

    const threadWrap = document.createElement("section");
    threadWrap.className = "chat-whisper-thread-wrap";

    const threadShell = document.createElement("div");
    threadShell.className = "whisper-thread-shell guestbook-notification-approval-shell";

    const threadHead = document.createElement("div");
    threadHead.className = "chat-whisper-thread-head";

    const threadTitle = document.createElement("h4");
    threadTitle.textContent = "System Administrator";

    threadHead.appendChild(threadTitle);

    const thread = document.createElement("div");
    thread.className = "whisper-thread";

    const article = document.createElement("article");
    article.className = "whisper-thread-message is-incoming guestbook-notification-approval-message";

    const meta = document.createElement("div");
    meta.className = "whisper-thread-meta";
    meta.textContent = "Festspiel-Freischaltung";

    const body = document.createElement("div");
    body.className = "whisper-thread-body";

    article.appendChild(meta);
    article.appendChild(body);
    thread.appendChild(article);
    threadShell.appendChild(threadHead);
    threadShell.appendChild(thread);
    threadWrap.appendChild(threadShell);

    card.appendChild(head);
    card.appendChild(threadWrap);
    panel.appendChild(card);
    document.body.appendChild(panel);

    const closePanel = () => {
      panel.hidden = true;
    };

    closeButton.addEventListener("click", closePanel);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !panel.hidden) {
        closePanel();
      }
    });

    approvalPanelElements = {
      panel,
      body
    };
    return approvalPanelElements;
  }

  function openApprovalPanel(festplayName) {
    const panelElements = getApprovalPanelElements();
    const trimmedFestplayName = String(festplayName || "").trim();
    panelElements.body.textContent = trimmedFestplayName
      ? `Du wurdest f\u00fcr ${trimmedFestplayName} freigeschaltet.`
      : "Du wurdest f\u00fcr ein Festspiel freigeschaltet.";
    panelElements.panel.hidden = false;
  }

  async function dismissApprovalNotification(notificationId) {
    const parsedNotificationId = Number(notificationId);
    if (!Number.isInteger(parsedNotificationId) || parsedNotificationId < 1) {
      return;
    }

    const response = await window.fetch(`/guestbook/notifications/${parsedNotificationId}/dismiss`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest"
      },
      body: new URLSearchParams({
        type: approvalNotificationType
      }).toString()
    });

    if (!response.ok) {
      throw new Error("dismiss_failed");
    }

    const result = await response.json();
    if (result?.payload) {
      applyNotificationPayload(result.payload);
    }
  }

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

  notificationLink.addEventListener("click", async (event) => {
    const notificationCount = Number(notificationLink.dataset.notificationCount || 0);
    if (!Number.isFinite(notificationCount) || notificationCount < 1) {
      event.preventDefault();
      return;
    }

    const notificationType = String(notificationLink.dataset.notificationType || "").trim().toLowerCase();
    if (notificationType !== approvalNotificationType) {
      return;
    }

    event.preventDefault();
    openApprovalPanel(notificationLink.dataset.notificationFestplayName || "");

    try {
      await dismissApprovalNotification(notificationLink.dataset.notificationId);
    } catch (_error) {
      // Keep the visible brief even if the dismiss request fails.
    }
  });

  if (canUseRealtimeUpdates) {
    const socket = io({
      transports: ["websocket"]
    });
    socket.on("guestbook:notification:update", applyNotificationPayload);
  }
})();
