(() => {
  const notificationLink = document.querySelector("[data-guestbook-notification-root]");
  if (!notificationLink) return;

  const badge = notificationLink.querySelector("[data-guestbook-notification-badge]");
  const notificationHref = "/guestbook/notifications/open";
  const systemNotificationFetchUrl = "/guestbook/notifications/system";
  const approvalNotificationType = "festplay_approval";
  const birthdayNotificationType = "birthday_greeting";
  const defaultBirthdayTitle = "Geburtstagsgr\u00fc\u00dfe vom Heldenhafte Reisen Team";
  const defaultBirthdayDecoration = "\uD83C\uDF89 \uD83C\uDF82 \u2728";
  const canUseRealtimeUpdates = typeof io === "function";
  let systemPanelElements = null;

  function normalizeNotificationType(notificationType) {
    return String(notificationType || "").trim().toLowerCase();
  }

  function isSystemNotificationType(notificationType) {
    const normalizedType = normalizeNotificationType(notificationType);
    return normalizedType === approvalNotificationType || normalizedType === birthdayNotificationType;
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
        return `Neue Bewerbung von ${trimmedApplicantCharacterName} f\u00fcr ${trimmedFestplayName}`;
      }
      if (trimmedFestplayName) {
        return `Neue Bewerbung f\u00fcr ${trimmedFestplayName}`;
      }
      return "Neue Festspiel-Bewerbung";
    }

    if (normalizedType === approvalNotificationType) {
      if (trimmedFestplayName && trimmedActorName) {
        return `${trimmedActorName} hat dich f\u00fcr ${trimmedFestplayName} freigeschaltet`;
      }
      if (trimmedFestplayName) {
        return `Du wurdest f\u00fcr ${trimmedFestplayName} freigeschaltet`;
      }
      return "Neue Festspiel-Freischaltung";
    }

    if (normalizedType === birthdayNotificationType) {
      return trimmedNotificationTitle || defaultBirthdayTitle;
    }

    return trimmedCharacterName
      ? `Neuer G\u00e4stebucheintrag f\u00fcr ${trimmedCharacterName}`
      : "Neuer G\u00e4stebucheintrag";
  }

  function formatBadgeCount(count) {
    return count > 99 ? "99+" : String(count);
  }

  function getCurrentNotificationSnapshot() {
    return {
      id: Number(notificationLink.dataset.notificationId || 0),
      type: normalizeNotificationType(notificationLink.dataset.notificationType || ""),
      character_name: notificationLink.dataset.notificationCharacterName || "",
      festplay_name: notificationLink.dataset.notificationFestplayName || "",
      applicant_character_name: notificationLink.dataset.notificationApplicantCharacterName || "",
      actor_name: notificationLink.dataset.notificationActorName || "",
      title: notificationLink.dataset.notificationTitle || "",
      message: notificationLink.dataset.notificationMessage || "",
      intro: notificationLink.dataset.notificationIntro || "",
      wish: notificationLink.dataset.notificationWish || "",
      signoff: notificationLink.dataset.notificationSignoff || "",
      decoration: notificationLink.dataset.notificationDecoration || "",
      is_read: Number(notificationLink.dataset.notificationCount || 0) < 1
    };
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
    const hasVisibleNotification = latestId > 0 && latestType.length > 0;
    const title = buildNotificationTitle(
      latestType,
      latestCharacterName,
      latestFestplayName,
      latestApplicantCharacterName,
      latestActorName,
      latestTitle
    );

    notificationLink.href = notificationHref;
    notificationLink.title = hasVisibleNotification ? title : "Brief";
    notificationLink.setAttribute("aria-label", hasVisibleNotification ? title : "Brief");
    notificationLink.setAttribute("aria-disabled", hasVisibleNotification ? "false" : "true");
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
      hasVisibleNotification && isSystemNotificationType(latestType)
    );

    notificationLink.hidden = !hasVisibleNotification;

    if (badge) {
      badge.hidden = count < 1;
      badge.textContent = count > 0 ? formatBadgeCount(count) : "";
    }
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
    heading.textContent = "Briefe";
    copy.appendChild(heading);

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "chat-whisper-close-btn";
    closeButton.setAttribute("aria-label", "Schlie\u00dfen");
    closeButton.textContent = "\u00d7";

    head.appendChild(copy);
    head.appendChild(closeButton);

    const threadWrap = document.createElement("section");
    threadWrap.className = "chat-whisper-thread-wrap";

    const threadShell = document.createElement("div");
    threadShell.className = "whisper-thread-shell guestbook-notification-approval-shell";

    const thread = document.createElement("div");
    thread.className = "whisper-thread guestbook-notification-letter-list";

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
      thread
    };
    return systemPanelElements;
  }

  function buildSystemNotificationCopy(notification) {
    const normalizedType = normalizeNotificationType(notification?.type || notification?.notification_type || "");
    const trimmedFestplayName = String(notification?.festplay_name || "").trim();
    const trimmedNotificationTitle = String(notification?.title || "").trim();
    const trimmedNotificationMessage = String(notification?.message || "").trim();
    const trimmedNotificationIntro = String(notification?.intro || "").trim();
    const trimmedNotificationWish = String(notification?.wish || "").trim();
    const trimmedNotificationSignoff = String(notification?.signoff || "").trim();
    const trimmedNotificationDecoration = String(notification?.decoration || "").trim();

    if (normalizedType === approvalNotificationType) {
      return {
        meta: "Festspiel-Freischaltung",
        mode: "plain",
        message: trimmedFestplayName
          ? `Du wurdest f\u00fcr ${trimmedFestplayName} freigeschaltet.`
          : "Du wurdest f\u00fcr ein Festspiel freigeschaltet."
      };
    }

    if (normalizedType === birthdayNotificationType) {
      return {
        meta: trimmedNotificationTitle || defaultBirthdayTitle,
        mode: "birthday",
        decoration: trimmedNotificationDecoration || defaultBirthdayDecoration,
        intro: trimmedNotificationIntro || trimmedNotificationMessage || "Herzlichen Gl\u00fcckwunsch zum Geburtstag!",
        wish: trimmedNotificationWish,
        signoff: trimmedNotificationSignoff
      };
    }

    return {
      meta: "Benachrichtigung",
      mode: "plain",
      message: trimmedNotificationMessage || ""
    };
  }

  function renderNotificationBody(entry, copy) {
    const body = document.createElement("div");
    body.className = "whisper-thread-body";

    if (copy.mode === "birthday") {
      const wrapper = document.createElement("div");
      wrapper.className = "guestbook-notification-system-body guestbook-notification-birthday-body";

      if (copy.decoration) {
        const decoration = document.createElement("div");
        decoration.className = "guestbook-notification-birthday-decoration";
        decoration.textContent = copy.decoration;
        wrapper.appendChild(decoration);
      }

      if (copy.intro) {
        const intro = document.createElement("p");
        intro.className = "guestbook-notification-birthday-line guestbook-notification-birthday-intro";
        intro.textContent = copy.intro;
        wrapper.appendChild(intro);
      }

      if (copy.wish) {
        const wish = document.createElement("p");
        wish.className = "guestbook-notification-birthday-line";
        wish.textContent = copy.wish;
        wrapper.appendChild(wish);
      }

      if (copy.signoff) {
        const signoff = document.createElement("p");
        signoff.className = "guestbook-notification-birthday-line guestbook-notification-birthday-signoff";
        signoff.textContent = copy.signoff;
        wrapper.appendChild(signoff);
      }

      body.appendChild(wrapper);
      return body;
    }

    const paragraph = document.createElement("p");
    paragraph.className = "guestbook-notification-system-paragraph";
    paragraph.textContent = copy.message || "";
    body.appendChild(paragraph);
    return body;
  }

  function buildSystemNotificationItem(entry) {
    const notification = entry || {};
    const copy = buildSystemNotificationCopy(notification);
    const article = document.createElement("article");
    article.className = "whisper-thread-message is-incoming guestbook-notification-approval-message";
    if (notification.is_read) {
      article.classList.add("guestbook-notification-letter-read");
    }

    const head = document.createElement("div");
    head.className = "guestbook-notification-letter-head";

    const meta = document.createElement("div");
    meta.className = "whisper-thread-meta";
    meta.textContent = copy.meta;

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "guestbook-notification-delete-btn";
    deleteButton.setAttribute("aria-label", "Brief l\u00f6schen");
    deleteButton.dataset.systemDelete = "true";
    deleteButton.dataset.notificationId = String(Number(notification.id || 0));
    deleteButton.dataset.notificationType = normalizeNotificationType(notification.type || "");
    deleteButton.textContent = "\u00d7";

    head.appendChild(meta);
    head.appendChild(deleteButton);
    article.appendChild(head);
    article.appendChild(renderNotificationBody(notification, copy));
    return article;
  }

  function renderSystemNotificationList(notifications, options = {}) {
    const panelElements = getSystemPanelElements();
    const entries = Array.isArray(notifications) ? notifications.filter(Boolean) : [];
    panelElements.thread.replaceChildren();

    if (!entries.length) {
      const emptyState = document.createElement("p");
      emptyState.className = "guestbook-notification-empty-state";
      emptyState.textContent = options.loading
        ? "Briefe werden geladen..."
        : "Keine Briefe vorhanden.";
      panelElements.thread.appendChild(emptyState);
      return;
    }

    entries.forEach((entry) => {
      panelElements.thread.appendChild(buildSystemNotificationItem(entry));
    });
  }

  async function fetchSystemNotifications(markRead) {
    const query = markRead ? "?mark_read=1" : "";
    const response = await window.fetch(`${systemNotificationFetchUrl}${query}`, {
      headers: {
        "X-Requested-With": "XMLHttpRequest"
      }
    });

    if (!response.ok) {
      throw new Error("fetch_failed");
    }

    return response.json();
  }

  async function deleteSystemNotification(notificationId, notificationType) {
    const parsedNotificationId = Number(notificationId);
    if (!Number.isInteger(parsedNotificationId) || parsedNotificationId < 1) {
      return null;
    }

    const response = await window.fetch(`/guestbook/notifications/${parsedNotificationId}/delete`, {
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
      throw new Error("delete_failed");
    }

    return response.json();
  }

  async function openSystemNotificationPanel(markRead = true) {
    const panelElements = getSystemPanelElements();
    panelElements.panel.hidden = false;
    renderSystemNotificationList([], { loading: true });

    try {
      const result = await fetchSystemNotifications(markRead);
      applyNotificationPayload(result?.payload || {});
      renderSystemNotificationList(result?.notifications || []);
    } catch (_error) {
      const fallbackNotification = getCurrentNotificationSnapshot();
      if (fallbackNotification.id > 0 && isSystemNotificationType(fallbackNotification.type)) {
        renderSystemNotificationList([fallbackNotification]);
        return;
      }

      renderSystemNotificationList([]);
    }
  }

  const initialPayload = {
    count: Number(notificationLink.dataset.notificationCount || 0),
    latest: getCurrentNotificationSnapshot()
  };
  applyNotificationPayload(initialPayload);

  notificationLink.addEventListener("click", async (event) => {
    const currentNotification = getCurrentNotificationSnapshot();
    const hasVisibleNotification =
      Number(currentNotification.id || 0) > 0 &&
      normalizeNotificationType(currentNotification.type).length > 0;

    if (!hasVisibleNotification) {
      event.preventDefault();
      return;
    }

    if (!isSystemNotificationType(currentNotification.type)) {
      return;
    }

    event.preventDefault();
    await openSystemNotificationPanel(true);
  });

  getSystemPanelElements().thread.addEventListener("click", async (event) => {
    const deleteButton = event.target.closest("[data-system-delete]");
    if (!deleteButton) {
      return;
    }

    const notificationId = Number(deleteButton.dataset.notificationId || 0);
    const notificationType = normalizeNotificationType(deleteButton.dataset.notificationType || "");
    if (!Number.isInteger(notificationId) || notificationId < 1 || !isSystemNotificationType(notificationType)) {
      return;
    }

    deleteButton.disabled = true;
    try {
      const result = await deleteSystemNotification(notificationId, notificationType);
      applyNotificationPayload(result?.payload || {});
      renderSystemNotificationList(result?.notifications || []);
    } catch (_error) {
      deleteButton.disabled = false;
    }
  });

  if (canUseRealtimeUpdates) {
    const socket = io({
      transports: ["websocket"]
    });
    socket.on("guestbook:notification:update", (payload) => {
      applyNotificationPayload(payload);
      const panelElements = getSystemPanelElements();
      if (!panelElements.panel.hidden) {
        openSystemNotificationPanel(false).catch(() => {});
      }
    });
  }
})();
