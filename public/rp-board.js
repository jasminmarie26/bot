(() => {
  const toggle = document.querySelector("[data-rp-board-root]");
  const panel = document.querySelector("[data-rp-board-panel]");
  if (!toggle || !panel) return;

  const badge = toggle.querySelector("[data-rp-board-badge]");
  const closeButton = panel.querySelector("[data-rp-board-close]");
  const form = panel.querySelector("[data-rp-board-form]");
  const input = panel.querySelector("[data-rp-board-input]");
  const list = panel.querySelector("[data-rp-board-list]");
  const emptyState = panel.querySelector("[data-rp-board-empty]");
  const serverId = String(toggle.dataset.rpBoardServerId || "").trim().toLowerCase();
  const festplayId = Number(toggle.dataset.rpBoardFestplayId || 0);
  const characterId = Number(toggle.dataset.rpBoardCharacterId || 0);
  const canUseRealtimeUpdates = typeof io === "function";
  const requestBaseParams = new URLSearchParams({
    server_id: serverId,
    festplay_id: String(Number.isInteger(festplayId) && festplayId > 0 ? festplayId : 0),
    character_id: String(Number.isInteger(characterId) && characterId > 0 ? characterId : 0)
  });
  let requestSequence = 0;

  if (!serverId || !Number.isInteger(characterId) || characterId < 1) {
    return;
  }

  function isPanelOpen() {
    return panel.hidden === false;
  }

  function setPanelOpen(nextOpen) {
    const shouldOpen = Boolean(nextOpen);
    panel.hidden = !shouldOpen;
    toggle.classList.toggle("is-open", shouldOpen);
    toggle.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
  }

  function formatBadgeCount(count) {
    return count > 99 ? "99+" : String(count);
  }

  function updateBadge(count) {
    const unreadCount = Number(count || 0);
    if (!badge) return;
    if (!Number.isFinite(unreadCount) || unreadCount < 1) {
      badge.hidden = true;
      badge.textContent = "0";
      return;
    }

    badge.hidden = false;
    badge.textContent = formatBadgeCount(unreadCount);
  }

  function renderEntries(entries) {
    if (!list || !emptyState) return;

    list.replaceChildren();
    const safeEntries = Array.isArray(entries) ? entries : [];
    if (!safeEntries.length) {
      list.hidden = true;
      emptyState.hidden = false;
      return;
    }

    list.hidden = false;
    emptyState.hidden = true;

    safeEntries.forEach((entry) => {
      const article = document.createElement("article");
      article.className = "rp-board-entry";

      const head = document.createElement("div");
      head.className = "rp-board-entry-head";

      const authorWrap = document.createElement("div");
      authorWrap.className = "rp-board-entry-author-wrap";

      let authorNode;
      if (Number(entry?.character_id) > 0) {
        authorNode = document.createElement("a");
        authorNode.href = `/characters/${Number(entry.character_id)}/guestbook`;
        authorNode.target = "_blank";
        authorNode.rel = "noopener noreferrer";
      } else {
        authorNode = document.createElement("span");
      }
      authorNode.className = "rp-board-entry-author";
      authorNode.textContent = String(entry?.author_name || "").trim() || "Unbekannt";
      if (entry?.author_chat_text_color) {
        authorNode.style.color = String(entry.author_chat_text_color);
      }
      authorWrap.appendChild(authorNode);

      const meta = document.createElement("div");
      meta.className = "rp-board-entry-meta";

      const time = document.createElement("time");
      time.className = "rp-board-entry-time";
      time.textContent = String(entry?.created_at || "").trim();
      meta.appendChild(time);

      if (entry?.can_delete) {
        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "rp-board-entry-delete";
        deleteButton.dataset.entryId = String(Number(entry?.id || 0));
        deleteButton.setAttribute("aria-label", "Eintrag loeschen");
        deleteButton.title = "Eintrag loeschen";
        deleteButton.textContent = "\u00d7";
        meta.appendChild(deleteButton);
      }

      head.appendChild(authorWrap);
      head.appendChild(meta);

      const body = document.createElement("p");
      body.className = "rp-board-entry-body";
      body.textContent = String(entry?.content || "");

      article.appendChild(head);
      article.appendChild(body);
      list.appendChild(article);
    });
  }

  function applyState(payload) {
    updateBadge(payload?.unreadCount || 0);
    renderEntries(payload?.entries || []);
  }

  async function fetchBoardState() {
    const response = await window.fetch(`/rp-board/state?${requestBaseParams.toString()}`, {
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        "X-Requested-With": "XMLHttpRequest"
      }
    });
    if (!response.ok) {
      throw new Error("rp_board_state_failed");
    }
    return response.json();
  }

  async function postBoardForm(url, extraParams) {
    const body = new URLSearchParams(requestBaseParams);
    Object.entries(extraParams || {}).forEach(([key, value]) => {
      body.set(key, String(value ?? ""));
    });

    const response = await window.fetch(url, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest"
      },
      body: body.toString()
    });
    if (!response.ok) {
      throw new Error("rp_board_post_failed");
    }
    return response.json();
  }

  async function loadState() {
    const requestId = ++requestSequence;
    const payload = await fetchBoardState();
    if (requestId !== requestSequence) {
      return null;
    }
    applyState(payload);
    return payload;
  }

  async function markBoardRead() {
    const payload = await postBoardForm("/rp-board/read", {});
    applyState(payload);
    return payload;
  }

  async function openBoardPanel() {
    setPanelOpen(true);
    try {
      await markBoardRead();
    } catch (error) {
      console.error("rp board read failed", error);
      try {
        await loadState();
      } catch (innerError) {
        console.error("rp board load failed", innerError);
      }
    }
    if (input) {
      input.focus();
    }
  }

  async function refreshAfterContextChange() {
    try {
      if (isPanelOpen()) {
        await markBoardRead();
      } else {
        await loadState();
      }
    } catch (error) {
      console.error("rp board refresh failed", error);
    }
  }

  toggle.addEventListener("click", async () => {
    if (isPanelOpen()) {
      setPanelOpen(false);
      return;
    }

    await openBoardPanel();
  });

  if (closeButton) {
    closeButton.addEventListener("click", () => {
      setPanelOpen(false);
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isPanelOpen()) {
      setPanelOpen(false);
    }
  });

  if (form) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const content = String(input?.value || "").trim();
      if (!content) {
        return;
      }

      try {
        const payload = await postBoardForm("/rp-board/entries", {
          content
        });
        applyState(payload);
        input.value = "";
        input.focus();
      } catch (error) {
        console.error("rp board entry failed", error);
      }
    });
  }

  if (list) {
    list.addEventListener("click", async (event) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const deleteButton = target.closest(".rp-board-entry-delete");
      if (!deleteButton) return;

      const entryId = Number(deleteButton.dataset.entryId || 0);
      if (!Number.isInteger(entryId) || entryId < 1) {
        return;
      }

      try {
        const payload = await postBoardForm(`/rp-board/entries/${entryId}/delete`, {});
        applyState(payload);
      } catch (error) {
        console.error("rp board delete failed", error);
      }
    });
  }

  loadState().catch((error) => {
    console.error("rp board initial load failed", error);
  });

  if (canUseRealtimeUpdates) {
    const socket = io({
      transports: ["websocket"]
    });

    socket.on("connect", () => {
      socket.emit("rp-board:watch", {
        serverId,
        festplayId,
        characterId
      });
    });

    socket.on("rp-board:changed", (payload) => {
      const payloadServerId = String(payload?.serverId || "").trim().toLowerCase();
      const payloadFestplayId = Number(payload?.festplayId || 0);
      if (payloadServerId !== serverId) {
        return;
      }
      if (payloadFestplayId !== (Number.isInteger(festplayId) && festplayId > 0 ? festplayId : 0)) {
        return;
      }

      refreshAfterContextChange();
    });
  }
})();
