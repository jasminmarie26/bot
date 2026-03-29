(() => {
  const notificationLink = document.querySelector("[data-guestbook-notification-root]");
  if (!notificationLink) return;

  const badge = notificationLink.querySelector("[data-guestbook-notification-badge]");
  const notificationHref = "/guestbook/notifications/open";
  const approvalNotificationType = "festplay_approval";
  const birthdayNotificationType = "birthday_greeting";
  const defaultBirthdayTitle = "Geburtstagsgrüße vom Heldenhafte Reisen Team";
  const defaultBirthdayDecoration = "🎉 🎂 ✨";
  const canUseRealtimeUpdates = typeof io === "function";
  let systemPanelElements = null;

  function normalizeNotificationType(notificationType) {
    return String(notificationType || "").trim().toLowerCase();
  }

  function isSystemNotificationType(notificationType) {
    const normalizedType = normalizeNotificationType(notificationType);
    return normalizedType === approvalNotificationType || normalizedType === birthdayNotificationType;
  }

  function getSystemPanelElements() {
    if (systemPanelElements) {
      return systemPanelElements;
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
    copy.appendChild(heading);

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "chat-whisper-close-btn";
    closeButton.setAttribute("aria-label", "Schließen");
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
    threadHead.appendChild(threadTitle);

    const thread = document.createElement("div");
    thread.className = "whisper-thread";

    const article = document.createElement("article");
    article.className = "whisper-thread-message is-incoming guestbook-notification-approval-message";

    const meta = document.createElement("div");
    meta.className = "whisper-thread-meta";

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

    systemPanelElements = {
      panel,
      threadTitle,
      meta,
      body
    };
    return systemPanelElements;
  }

  function buildSystemNotificationCopy(
    notificationType,
    festplayName,
    notificationTitle,
    notificationMessage,
    notificationIntro,
    notificationWish,
    notificationSignoff,
    notificationDecoration
  ) {
    const normalizedType = normalizeNotificationType(notificationType);
    const trimmedFestplayName = String(festplayName || "").trim();
    const trimmedNotificationTitle = String(notificationTitle || "").trim();
    const trimmedNotificationMessage = String(notificationMessage || "").trim();
    const trimmedNotificationIntro = String(notificationIntro || "").trim();
    const trimmedNotificationWish = String(notificationWish || "").trim();
    const trimmedNotificationSignoff = String(notificationSignoff || "").trim();
    const trimmedNotificationDecoration = String(notificationDecoration || "").trim();

    if (normalizedType === approvalNotificationType) {
      return {
        threadTitle: "System Administrator",
        meta: "Festspiel-Freischaltung",
        mode: "plain",
        message: trimmedFestplayName
          ? `Du wurdest für ${trimmedFestplayName} freigeschaltet.`
          : "Du wurdest für ein Festspiel freigeschaltet."
      };
    }

    if (normalizedType === birthdayNotificationType) {
      return {
        threadTitle: "Heldenhafte Reisen Team",
        meta: trimmedNotificationTitle || defaultBirthdayTitle,
        mode: "birthday",
        decoration: trimmedNotificationDecoration || defaultBirthdayDecoration,
        intro: trimmedNotificationIntro || trimmedNotificationMessage || "Herzlichen Glückwunsch zum Geburtstag!",
        wish: trimmedNotificationWish,
        signoff: trimmedNotificationSignoff
      };
    }

    return {
      threadTitle: "System Administrator",
      meta: "Benachrichtigung",
      mode: "plain",
      message: trimmedNotificationMessage || ""
    };
  }

  function renderSystemNotificationBody(bodyRoot, panelCopy) {
    bodyRoot.replaceChildren();

    if (panelCopy.mode === "birthday") {
      const wrapper = document.createElement("div");
      wrapper.className = "guestbook-notification-system-body guestbook-notification-birthday-body";

      if (panelCopy.decoration) {
        const decoration = document.createElement("div");
        decoration.className = "guestbook-notification-birthday-decoration";
        decoration.textContent = panelCopy.decoration;
        wrapper.appendChild(decoration);
      }

      if (panelCopy.intro) {
        const intro = document.createElement("p");
        intro.className = "guestbook-notification-birthday-line guestbook-notification-birthday-intro";
        intro.textContent = panelCopy.intro;
        wrapper.appendChild(intro);
      }

      if (panelCopy.wish) {
        const wish = document.createElement("p");
        wish.className = "guestbook-notification-birthday-line";
        wish.textContent = panelCopy.wish;
        wrapper.appendChild(wish);
      }

      if (panelCopy.signoff) {
        const signoff = document.createElement("p");
        signoff.className = "guestbook-notification-birthday-line guestbook-notification-birthday-signoff";
        signoff.textContent = panelCopy.signoff;
        wrapper.appendChild(signoff);
      }

      bodyRoot.appendChild(wrapper);
      return;
    }

    const message = document.createElement("p");
    message.className = "guestbook-notification-system-paragraph";
    message.textContent = panelCopy.message || "";
    bodyRoot.appendChild(message);
  }

  function openSystemNotificationPanel(
    notificationType,
    festplayName,
    notificationTitle,
    notificationMessage,
    notificationIntro,
    notificationWish,
    notificationSignoff,
    notificationDecoration
  ) {
    const panelElements = getSystemPanelElements();
    const panelCopy = buildSystemNotificationCopy(
      notificationType,
      festplayName,
      notificationTitle,
      notificationMessage,
      notificationIntro,
      notificationWish,
      notificationSignoff,
      notificationDecoration
    );

    panelElements.threadTitle.textContent = panelCopy.threadTitle;
    panelElements.meta.textContent = panelCopy.meta;
    renderSystemNotificationBody(panelElements.body, panelCopy);
    panelElements.panel.hidden = false;
  }

  async function dismissSystemNotification(notificationId, notificationType) {
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
        type: normalizeNotificationType(notificationType)
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
    actorName,
    notificationTitle
  ) {
    const normalizedType = normalizeNotificationType(notificationType);
    const trimmedCharacterName = String(characterName || "").trim();
    const trimmedFestplayName = String(festplayName || "").trim();
    const trimmedApplicantCharacterName = String(applicantCharacterName || "").trim();
    const trimmedActorName = String(actorName || "").trim();
    const trimmedNotificationTitle = String(notificationTitle || "").trim();

    if (normalizedType === "festplay_application") {
      if (trimmedFestplayName && trimmedApplicantCharacterName) {
        return `Neue Bewerbung von ${trimmedApplicantCharacterName} für ${trimmedFestplayName}`;
      }
      if (trimmedFestplayName) {
        return `Neue Bewerbung für ${trimmedFestplayName}`;
      }
      return "Neue Festspiel-Bewerbung";
    }

    if (normalizedType === approvalNotificationType) {
      if (trimmedFestplayName && trimmedActorName) {
        return `${trimmedActorName} hat dich für ${trimmedFestplayName} freigeschaltet`;
      }
      if (trimmedFestplayName) {
        return `Du wurdest für ${trimmedFestplayName} freigeschaltet`;
      }
      return "Neue Festspiel-Freischaltung";
    }

    if (normalizedType === birthdayNotificationType) {
      return trimmedNotificationTitle || defaultBirthdayTitle;
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
    const latestId = Number(payload?.latest?.id || 0);
    const latestType = normalizeNotificationType(payload?.latest?.type || "");
    const latestCharacterName = String(payload?.latest?.character_name || "").trim();
    const latestFestplayName = String(payload?.latest?.festplay_name || "").trim();
    const latestApplicantCharacterName = String(payload?.latest?.applicant_character_name || "").trim();
    const latestActorName = String(payload?.latest?.actor_name || "").trim();
    const latestTitle = String(payload?.latest?.title || "").trim();
    const latestMessage = String(payload?.latest?.message || "").trim();
    const latestIntro = String(payload?.latest?.intro || "").trim();
    const latestWish = String(payload?.latest?.wish || "").trim();
    const latestSignoff = String(payload?.latest?.signoff || "").trim();
    const latestDecoration = String(payload?.latest?.decoration || "").trim();
    const hasNotification = count > 0 && latestId > 0 && latestType.length > 0;
    const title = buildNotificationTitle(
      latestType,
      latestCharacterName,
      latestFestplayName,
      latestApplicantCharacterName,
      latestActorName,
      latestTitle
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
    notificationLink.dataset.notificationTitle = latestTitle;
    notificationLink.dataset.notificationMessage = latestMessage;
    notificationLink.dataset.notificationIntro = latestIntro;
    notificationLink.dataset.notificationWish = latestWish;
    notificationLink.dataset.notificationSignoff = latestSignoff;
    notificationLink.dataset.notificationDecoration = latestDecoration;
    notificationLink.classList.toggle(
      "guestbook-notification-link-system",
      hasNotification && isSystemNotificationType(latestType)
    );

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
      actor_name: notificationLink.dataset.notificationActorName || "",
      title: notificationLink.dataset.notificationTitle || "",
      message: notificationLink.dataset.notificationMessage || "",
      intro: notificationLink.dataset.notificationIntro || "",
      wish: notificationLink.dataset.notificationWish || "",
      signoff: notificationLink.dataset.notificationSignoff || "",
      decoration: notificationLink.dataset.notificationDecoration || ""
    }
  };
  applyNotificationPayload(initialPayload);

  notificationLink.addEventListener("click", async (event) => {
    const notificationCount = Number(notificationLink.dataset.notificationCount || 0);
    if (!Number.isFinite(notificationCount) || notificationCount < 1) {
      event.preventDefault();
      return;
    }

    const notificationType = normalizeNotificationType(notificationLink.dataset.notificationType || "");
    if (!isSystemNotificationType(notificationType)) {
      return;
    }

    event.preventDefault();
    openSystemNotificationPanel(
      notificationType,
      notificationLink.dataset.notificationFestplayName || "",
      notificationLink.dataset.notificationTitle || "",
      notificationLink.dataset.notificationMessage || "",
      notificationLink.dataset.notificationIntro || "",
      notificationLink.dataset.notificationWish || "",
      notificationLink.dataset.notificationSignoff || "",
      notificationLink.dataset.notificationDecoration || ""
    );

    try {
      await dismissSystemNotification(notificationLink.dataset.notificationId, notificationType);
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
