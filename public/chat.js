(() => {
  const chatBox = document.getElementById("chat-box");
  const form = document.getElementById("chat-form");
  const input = document.getElementById("chat-input");
  const onlineCharList = document.getElementById("online-char-list");
  const onlineActionsMenu = document.getElementById("online-actions-menu");
  const onlineActionGuestbook = document.getElementById("online-action-guestbook");
  const onlineActionWhisper = document.getElementById("online-action-whisper");
  const whisperModal = document.getElementById("whisper-modal");
  const whisperModalTitle = document.getElementById("whisper-modal-title");
  const whisperForm = document.getElementById("whisper-form");
  const whisperInput = document.getElementById("whisper-input");
  const whisperTargetUserIdInput = document.getElementById("whisper-target-user-id");
  const whisperCloseBtn = document.getElementById("whisper-close-btn");
  const whisperCancelBtn = document.getElementById("whisper-cancel-btn");
  const roomIdRaw = chatBox?.dataset?.roomId || "";
  const serverId = (chatBox?.dataset?.serverId || "free-rp").trim().toLowerCase();
  const roomId = Number(roomIdRaw);
  const hasRoom = Number.isInteger(roomId) && roomId > 0;
  let selectedOnlineEntry = null;

  if (!chatBox || !form || !input) return;

  const socket = io();

  socket.on("connect", () => {
    socket.emit("chat:join", {
      roomId: hasRoom ? roomId : null,
      serverId
    });
  });

  function appendMessage(msg) {
    const article = document.createElement("article");
    article.className = "chat-message";

    const header = document.createElement("header");
    const strong = document.createElement("strong");
    strong.textContent = msg.username;
    const small = document.createElement("small");
    small.textContent = msg.created_at;
    header.appendChild(strong);
    header.appendChild(small);

    const body = document.createElement("p");
    body.textContent = msg.content;

    article.appendChild(header);
    article.appendChild(body);
    chatBox.appendChild(article);

    while (chatBox.children.length > 150) {
      chatBox.removeChild(chatBox.firstChild);
    }

    chatBox.scrollTop = chatBox.scrollHeight;
  }

  function appendWhisper(msg) {
    const article = document.createElement("article");
    article.className = `chat-message chat-whisper ${msg?.outgoing ? "is-outgoing" : "is-incoming"}`;

    const header = document.createElement("header");
    const strong = document.createElement("strong");
    strong.textContent = msg?.outgoing
      ? `Fluestern an ${msg?.to_name || "Unbekannt"}`
      : `Fluestern von ${msg?.from_name || "Unbekannt"}`;
    const small = document.createElement("small");
    small.textContent = msg?.created_at || "";
    header.appendChild(strong);
    header.appendChild(small);

    const body = document.createElement("p");
    body.textContent = String(msg?.content || "");

    article.appendChild(header);
    article.appendChild(body);
    chatBox.appendChild(article);

    while (chatBox.children.length > 150) {
      chatBox.removeChild(chatBox.firstChild);
    }

    chatBox.scrollTop = chatBox.scrollHeight;
  }

  function closeOnlineMenu() {
    if (!onlineActionsMenu) return;
    onlineActionsMenu.hidden = true;
    selectedOnlineEntry = null;
  }

  function closeWhisperModal() {
    if (!whisperModal) return;
    whisperModal.hidden = true;
    whisperModal.classList.remove("is-open");
    if (whisperInput) whisperInput.value = "";
    if (whisperTargetUserIdInput) whisperTargetUserIdInput.value = "";
  }

  function openWhisperModal(entry) {
    if (!whisperModal || !whisperModalTitle || !whisperTargetUserIdInput || !whisperInput) return;
    if (!entry?.userId) return;

    whisperTargetUserIdInput.value = String(entry.userId);
    whisperModalTitle.textContent = `Fluestern an ${entry.name}`;
    whisperModal.hidden = false;
    whisperModal.classList.add("is-open");
    whisperInput.focus();
  }

  function applyOnlineMenuState() {
    if (!onlineActionGuestbook || !onlineActionWhisper || !selectedOnlineEntry) return;

    const hasCharacter = Number.isInteger(selectedOnlineEntry.characterId) && selectedOnlineEntry.characterId > 0;
    const hasUser = Number.isInteger(selectedOnlineEntry.userId) && selectedOnlineEntry.userId > 0;

    if (hasCharacter) {
      onlineActionGuestbook.href = `/characters/${selectedOnlineEntry.characterId}/guestbook`;
      onlineActionGuestbook.classList.remove("is-disabled");
      onlineActionGuestbook.setAttribute("aria-disabled", "false");
      onlineActionGuestbook.tabIndex = 0;
    } else {
      onlineActionGuestbook.href = "#";
      onlineActionGuestbook.classList.add("is-disabled");
      onlineActionGuestbook.setAttribute("aria-disabled", "true");
      onlineActionGuestbook.tabIndex = -1;
    }

    onlineActionWhisper.disabled = !hasUser;
  }

  function positionOnlineMenu(triggerEl) {
    if (!onlineActionsMenu || !triggerEl) return;
    const rect = triggerEl.getBoundingClientRect();
    const menuWidth = 220;
    const menuHeight = 120;
    const gap = 8;

    const left = Math.min(
      Math.max(gap, rect.left),
      Math.max(gap, window.innerWidth - menuWidth - gap)
    );
    const top = Math.min(
      Math.max(gap, rect.bottom + gap),
      Math.max(gap, window.innerHeight - menuHeight - gap)
    );

    onlineActionsMenu.style.left = `${left}px`;
    onlineActionsMenu.style.top = `${top}px`;
  }

  function openOnlineMenu(triggerEl) {
    if (!onlineActionsMenu) return;

    const userId = Number(triggerEl.dataset.userId);
    const characterId = Number(triggerEl.dataset.characterId);
    const name = String(triggerEl.dataset.name || triggerEl.textContent || "").trim() || "Unbekannt";

    selectedOnlineEntry = {
      userId: Number.isInteger(userId) && userId > 0 ? userId : null,
      characterId: Number.isInteger(characterId) && characterId > 0 ? characterId : null,
      name
    };

    applyOnlineMenuState();
    positionOnlineMenu(triggerEl);
    onlineActionsMenu.hidden = false;
  }

  function renderOnlineCharacters(entries) {
    if (!onlineCharList) return;

    const list = Array.isArray(entries) ? entries.slice() : [];
    list.sort((a, b) =>
      String(a?.name || "").localeCompare(String(b?.name || ""), "de", {
        sensitivity: "base"
      })
    );

    onlineCharList.innerHTML = "";

    if (!list.length) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "Niemand online.";
      onlineCharList.appendChild(empty);
      return;
    }

    list.forEach((entry) => {
      const userId = Number(entry?.user_id);
      const characterId = Number(entry?.character_id);
      const label = String(entry?.name || "").trim();
      const text = label || "Unbekannt";
      const node = document.createElement("button");

      node.type = "button";
      node.classList.add("chat-online-item", "chat-online-trigger");
      node.dataset.userId = Number.isInteger(userId) && userId > 0 ? String(userId) : "";
      node.dataset.characterId = Number.isInteger(characterId) && characterId > 0 ? String(characterId) : "";
      node.dataset.name = text;
      node.textContent = text;
      onlineCharList.appendChild(node);
    });

    closeOnlineMenu();
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const content = input.value.trim();
    if (!content) return;

    socket.emit("chat:message", content);
    input.value = "";
    input.focus();
  });

  if (onlineCharList) {
    onlineCharList.addEventListener("click", (event) => {
      const trigger = event.target.closest(".chat-online-trigger");
      if (!trigger) return;

      event.preventDefault();
      event.stopPropagation();

      if (
        !onlineActionsMenu?.hidden &&
        selectedOnlineEntry &&
        String(selectedOnlineEntry.userId || "") === String(trigger.dataset.userId || "")
      ) {
        closeOnlineMenu();
        return;
      }

      openOnlineMenu(trigger);
    });
  }

  if (onlineActionGuestbook) {
    onlineActionGuestbook.addEventListener("click", (event) => {
      if (onlineActionGuestbook.classList.contains("is-disabled")) {
        event.preventDefault();
      }
      closeOnlineMenu();
    });
  }

  if (onlineActionWhisper) {
    onlineActionWhisper.addEventListener("click", () => {
      if (!selectedOnlineEntry) return;
      openWhisperModal(selectedOnlineEntry);
      closeOnlineMenu();
    });
  }

  if (whisperCloseBtn) {
    whisperCloseBtn.addEventListener("click", closeWhisperModal);
  }

  if (whisperCancelBtn) {
    whisperCancelBtn.addEventListener("click", closeWhisperModal);
  }

  if (whisperModal) {
    whisperModal.addEventListener("click", (event) => {
      if (event.target === whisperModal) {
        closeWhisperModal();
      }
    });
  }

  if (whisperForm) {
    whisperForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const targetUserId = Number(whisperTargetUserIdInput?.value);
      const content = String(whisperInput?.value || "").trim();
      if (!Number.isInteger(targetUserId) || targetUserId < 1 || !content) {
        return;
      }

      socket.emit("chat:whisper", {
        targetUserId,
        content
      });

      closeWhisperModal();
      input.focus();
    });
  }

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const clickedInsideMenu = onlineActionsMenu && onlineActionsMenu.contains(target);
    const clickedOnTrigger = Boolean(target.closest(".chat-online-trigger"));
    if (!clickedInsideMenu && !clickedOnTrigger) {
      closeOnlineMenu();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeOnlineMenu();
      closeWhisperModal();
    }
  });

  window.addEventListener("resize", closeOnlineMenu);
  window.addEventListener("scroll", closeOnlineMenu, true);

  socket.on("chat:message", appendMessage);
  socket.on("chat:whisper", appendWhisper);
  socket.on("chat:online-characters", renderOnlineCharacters);

  chatBox.scrollTop = chatBox.scrollHeight;
})();
