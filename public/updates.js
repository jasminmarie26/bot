(() => {
  const list = document.getElementById("site-updates-list");

  const updateModal = document.getElementById("update-modal");
  const updateForm = document.getElementById("update-form");
  const updateTitle = document.getElementById("update-modal-title");
  const updateSubmitButton = document.getElementById("update-submit-btn");
  const updateCloseButton = document.getElementById("update-close-btn");
  const updateField = updateForm?.querySelector("textarea[name='content']");

  const siteContentModal = document.getElementById("site-content-modal");
  const siteContentForm = document.getElementById("site-content-form");
  const siteContentModalTitle = document.getElementById("site-content-modal-title");
  const siteContentCloseButton = document.getElementById("site-content-close-btn");
  const siteContentTitleInput = document.getElementById("site-content-title-input");
  const siteContentBodyWrap = document.getElementById("site-content-body-wrap");
  const siteContentBodyInput = document.getElementById("site-content-body-input");

  const heroSection = document.getElementById("home-hero");
  const heroTitleElement = document.getElementById("home-hero-title");
  const heroBodyElement = document.getElementById("home-hero-body");
  const heroTitleSource = document.getElementById("home-hero-title-source");
  const heroBodySource = document.getElementById("home-hero-body-source");
  const updatesTitleElement = document.getElementById("updates-section-title");
  const updatesTitleSource = document.getElementById("updates-section-title-source");
  const accountCountElement = document.getElementById("home-account-count");
  const loggedInCountElement = document.getElementById("home-logged-in-count");
  const staffCountElement = document.getElementById("home-staff-online-count");
  const rpCharacterCountElement = document.getElementById("home-rp-character-count");
  const freeRpOnlineCountElement = document.getElementById("home-free-rp-online-count");
  const erpOnlineCountElement = document.getElementById("home-erp-online-count");
  const larpCharacterCountElement = document.getElementById("home-larp-character-count");
  const larpOnlineCountElement = document.getElementById("home-larp-online-count");
  const staffCardElement = staffCountElement?.closest(".home-stat") || null;

  const canEditUpdates = Boolean(updateForm);

  function syncBodyModalState() {
    const isAnyModalOpen =
      (updateModal && !updateModal.hidden) || (siteContentModal && !siteContentModal.hidden);

    document.body.classList.toggle("modal-open", Boolean(isAnyModalOpen));
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function buildPlainHtml(content) {
    return escapeHtml(content).replace(/\r\n?/g, "\n").replace(/\n/g, "<br>");
  }

  function getUpdateItemData(article) {
    if (!article) return null;

    return {
      id: Number.parseInt(article.dataset.updateId || "", 10),
      author_name: article.dataset.updateAuthorName || "System",
      content: article.dataset.updateContent || "",
      created_at: article.dataset.updateCreatedAt || ""
    };
  }

  function getHomeContentData() {
    return {
      hero_title: heroTitleSource?.value || heroTitleElement?.textContent || "",
      hero_body: heroBodySource?.value || "",
      updates_title: updatesTitleSource?.value || updatesTitleElement?.textContent || ""
    };
  }

  function setTextContent(element, value) {
    if (!element) return;
    element.textContent = String(value ?? 0);
  }

  function getOrCreateStaffNamesElement() {
    let element = document.getElementById("home-staff-online-names");
    if (!element && staffCardElement) {
      element = document.createElement("small");
      element.id = "home-staff-online-names";
      element.className = "home-stat-names";
      staffCardElement.appendChild(element);
    }
    return element;
  }

  function getOrCreateStaffEmptyElement() {
    let element = document.getElementById("home-staff-online-empty");
    if (!element && staffCardElement) {
      element = document.createElement("small");
      element.id = "home-staff-online-empty";
      element.className = "home-stat-empty";
      element.textContent = "Niemand gerade online.";
      staffCardElement.appendChild(element);
    }
    return element;
  }

  function renderStaffNames(stats) {
    const adminNames = Array.isArray(stats?.adminOnlineNames) ? stats.adminOnlineNames : [];
    const moderatorNames = Array.isArray(stats?.moderatorOnlineNames)
      ? stats.moderatorOnlineNames
      : [];
    const entries = [
      ...adminNames.map((name) => ({ role: "admin", label: `${name} (A)` })),
      ...moderatorNames.map((name) => ({ role: "moderator", label: `${name} (M)` }))
    ];
    const namesElement = getOrCreateStaffNamesElement();
    const emptyElement = getOrCreateStaffEmptyElement();

    if (!namesElement || !emptyElement) return;

    namesElement.replaceChildren();
    if (!entries.length) {
      namesElement.hidden = true;
      emptyElement.hidden = false;
      return;
    }

    entries.forEach((entry, index) => {
      const nameElement = document.createElement("span");
      nameElement.className =
        entry.role === "admin" ? "staff-name-admin" : "staff-name-moderator";
      nameElement.textContent = entry.label;
      namesElement.appendChild(nameElement);
      if (index < entries.length - 1) {
        namesElement.appendChild(document.createTextNode(", "));
      }
    });

    namesElement.hidden = false;
    emptyElement.hidden = true;
  }

  function applyHomeStats(stats) {
    if (!stats || typeof stats !== "object") return;

    setTextContent(accountCountElement, stats.accountCount);
    setTextContent(loggedInCountElement, stats.loggedInUserCount);
    setTextContent(
      staffCountElement,
      Number(stats.adminOnlineCount || 0) + Number(stats.moderatorOnlineCount || 0)
    );
    setTextContent(rpCharacterCountElement, stats.rpServerCount);
    setTextContent(freeRpOnlineCountElement, stats.freeRpOnlineCount);
    setTextContent(erpOnlineCountElement, stats.erpOnlineCount);
    setTextContent(larpCharacterCountElement, stats.larpServerCount);
    setTextContent(larpOnlineCountElement, stats.larpOnlineCount);
    renderStaffNames(stats);
  }

  function applyHomeContent(homeContent) {
    if (!homeContent || typeof homeContent !== "object") return;

    if (homeContent.hero_title) {
      document.title = homeContent.hero_title;
    }

    if (heroTitleSource) {
      heroTitleSource.value = homeContent.hero_title || "";
    }

    if (heroBodySource) {
      heroBodySource.value = homeContent.hero_body || "";
    }

    if (heroTitleElement) {
      heroTitleElement.textContent = homeContent.hero_title || "";
    }

    if (heroBodyElement) {
      heroBodyElement.innerHTML =
        homeContent.hero_body_html || buildPlainHtml(homeContent.hero_body || "");
    }

    if (updatesTitleElement) {
      updatesTitleElement.textContent = homeContent.updates_title || "";
    }

    if (updatesTitleSource) {
      updatesTitleSource.value = homeContent.updates_title || "";
    }
  }

  function removeEmptyState() {
    const emptyState = document.getElementById("site-updates-empty");
    if (emptyState && emptyState.parentNode) {
      emptyState.parentNode.removeChild(emptyState);
    }
  }

  function ensureEmptyState() {
    if (!list) return;
    if (list.querySelector(".update-item")) return;
    if (document.getElementById("site-updates-empty")) return;

    const emptyState = document.createElement("p");
    emptyState.id = "site-updates-empty";
    emptyState.className = "muted";
    emptyState.textContent = "Noch keine Neuigkeiten veröffentlicht.";
    list.appendChild(emptyState);
  }

  function createDeleteForm(updateId) {
    const formElement = document.createElement("form");
    formElement.method = "POST";
    formElement.action = `/updates/${updateId}/delete`;
    formElement.className = "inline-form";
    formElement.addEventListener("submit", (event) => {
      if (!window.confirm("Update wirklich löschen?")) {
        event.preventDefault();
      }
    });

    const button = document.createElement("button");
    button.className = "ghost-btn icon-btn update-delete-btn";
    button.type = "submit";
    button.setAttribute("aria-label", "Update löschen");
    button.title = "Update löschen";
    button.textContent = "X";
    formElement.appendChild(button);

    return formElement;
  }

  function createActionButtons(updateId) {
    const actions = document.createElement("div");
    actions.className = "update-item-actions";

    const editButton = document.createElement("button");
    editButton.className = "ghost-btn icon-btn update-edit-btn";
    editButton.type = "button";
    editButton.dataset.updateEdit = "";
    editButton.setAttribute("aria-label", "Update-Inhalt bearbeiten");
    editButton.title = "Update-Inhalt bearbeiten";
    editButton.innerHTML = "&#9998;";
    actions.appendChild(editButton);

    actions.appendChild(createDeleteForm(updateId));
    return actions;
  }

  function createUpdateElement(item) {
    const article = document.createElement("article");
    article.className = "update-item";

    const updateId = Number.parseInt(item?.id, 10);
    if (Number.isInteger(updateId) && updateId > 0) {
      article.dataset.updateId = String(updateId);
    }
    article.dataset.updateAuthorName = item?.author_name || "System";
    article.dataset.updateContent = item?.content || "";
    article.dataset.updateCreatedAt = item?.created_at || "";

    const header = document.createElement("header");
    header.className = "update-meta";

    const author = document.createElement("strong");
    author.textContent = item?.author_name || "System";
    header.appendChild(author);

    const metaRight = document.createElement("div");
    metaRight.className = "update-meta-right";

    const time = document.createElement("small");
    time.textContent = item?.created_at || "";
    metaRight.appendChild(time);

    if (canEditUpdates && Number.isInteger(updateId) && updateId > 0) {
      metaRight.appendChild(createActionButtons(updateId));
    }

    header.appendChild(metaRight);
    article.appendChild(header);

    const body = document.createElement("div");
    body.className = "update-body guestbook-entry-body";
    body.innerHTML = item?.content_html || buildPlainHtml(item?.content || "");
    article.appendChild(body);

    return article;
  }

  function renderOrReplaceUpdate(item, { prepend = false } = {}) {
    if (!list || !item) return;

    const updateId = Number.parseInt(item.id, 10);
    if (!Number.isInteger(updateId) || updateId <= 0) return;

    const article = createUpdateElement(item);
    const existing = list.querySelector(`[data-update-id="${updateId}"]`);
    if (existing) {
      existing.replaceWith(article);
    } else if (prepend) {
      removeEmptyState();
      list.insertBefore(article, list.firstChild);
    } else {
      removeEmptyState();
      list.appendChild(article);
    }

    while (list.querySelectorAll(".update-item").length > 30) {
      const updates = list.querySelectorAll(".update-item");
      updates[updates.length - 1].remove();
    }
  }

  function deleteUpdate(updateId) {
    if (!list) return;
    const existing = list.querySelector(`[data-update-id="${updateId}"]`);
    if (existing) {
      existing.remove();
    }
    ensureEmptyState();
  }

  function setUpdateFormMode(mode, item = null) {
    if (!updateForm || !updateField || !updateTitle || !updateSubmitButton) return;

    if (mode === "edit" && item) {
      updateForm.action = `/updates/${item.id}/edit`;
      updateForm.dataset.mode = "edit";
      updateTitle.textContent = "Live-Update-Inhalt bearbeiten";
      updateSubmitButton.textContent = "Speichern";
      updateField.value = item.content || "";
    } else {
      updateForm.action = "/updates";
      updateForm.dataset.mode = "create";
      updateTitle.textContent = "Neues Live-Update";
      updateSubmitButton.textContent = "Veröffentlichen";
      updateField.value = "";
    }
  }

  function openUpdateModal(item = null) {
    if (!updateModal) return;
    setUpdateFormMode(item ? "edit" : "create", item);
    updateModal.hidden = false;
    updateModal.classList.add("is-open");
    syncBodyModalState();
    if (updateField) {
      updateField.focus();
      updateField.selectionStart = updateField.value.length;
      updateField.selectionEnd = updateField.value.length;
    }
  }

  function closeUpdateModal() {
    if (!updateModal) return;
    updateModal.classList.remove("is-open");
    updateModal.hidden = true;
    setUpdateFormMode("create");
    syncBodyModalState();
  }

  function openSiteContentModal(target) {
    if (!siteContentModal || !siteContentForm || !siteContentTitleInput || !siteContentModalTitle) {
      return;
    }

    const homeContent = getHomeContentData();

    if (target === "updates-title") {
      siteContentForm.action = "/site-content/updates-title";
      siteContentForm.dataset.mode = "updates-title";
      siteContentModalTitle.textContent = "Live-Updates-Überschrift bearbeiten";
      siteContentTitleInput.value = homeContent.updates_title || "";
      if (siteContentBodyWrap) {
        siteContentBodyWrap.hidden = true;
      }
      if (siteContentBodyInput) {
        siteContentBodyInput.value = "";
        siteContentBodyInput.required = false;
      }
    } else {
      siteContentForm.action = "/site-content/hero";
      siteContentForm.dataset.mode = "hero";
      siteContentModalTitle.textContent = "Startseitenbereich bearbeiten";
      siteContentTitleInput.value = homeContent.hero_title || "";
      if (siteContentBodyWrap) {
        siteContentBodyWrap.hidden = false;
      }
      if (siteContentBodyInput) {
        siteContentBodyInput.value = homeContent.hero_body || "";
        siteContentBodyInput.required = true;
      }
    }

    siteContentModal.hidden = false;
    siteContentModal.classList.add("is-open");
    syncBodyModalState();
    siteContentTitleInput.focus();
  }

  function closeSiteContentModal() {
    if (!siteContentModal) return;
    siteContentModal.classList.remove("is-open");
    siteContentModal.hidden = true;
    syncBodyModalState();
  }

  function insertBbcodeInto(field, openTag, closeTag, placeholder = "Text") {
    if (!field) return;

    const start = field.selectionStart ?? 0;
    const end = field.selectionEnd ?? 0;
    const selectedText = field.value.slice(start, end);
    const innerText = selectedText || placeholder;
    const replacement = `${openTag}${innerText}${closeTag}`;

    field.setRangeText(replacement, start, end, "select");

    const innerStart = start + openTag.length;
    const innerEnd = innerStart + innerText.length;
    field.focus();
    field.selectionStart = innerStart;
    field.selectionEnd = innerEnd;
  }

  function resolveBbcodeField(button) {
    if (!button) return null;
    const target = button.dataset.bbcodeTarget || "";
    if (target === "site-content-body") {
      return siteContentBodyInput;
    }
    return updateField;
  }

  function insertLinkBbcode(field) {
    if (!field) return;

    const rawUrl = window.prompt("Link eingeben:", "https://");
    if (rawUrl === null) return;

    const cleanedUrl = rawUrl.trim();
    if (!cleanedUrl) {
      field.focus();
      return;
    }

    insertBbcodeInto(field, `[url=${cleanedUrl}]`, "[/url]", "Linktext");
  }

  if (updateModal) {
    document.querySelectorAll("[data-update-open]").forEach((button) => {
      button.addEventListener("click", () => openUpdateModal());
    });

    if (updateCloseButton) {
      updateCloseButton.addEventListener("click", closeUpdateModal);
    }

    updateModal.addEventListener("click", (event) => {
      if (event.target === updateModal) {
        closeUpdateModal();
      }
    });
  }

  if (siteContentModal) {
    document.querySelectorAll("[data-site-content-open]").forEach((button) => {
      button.addEventListener("click", () => {
        openSiteContentModal(button.dataset.siteContentOpen || "hero");
      });
    });

    if (siteContentCloseButton) {
      siteContentCloseButton.addEventListener("click", closeSiteContentModal);
    }

    siteContentModal.addEventListener("click", (event) => {
      if (event.target === siteContentModal) {
        closeSiteContentModal();
      }
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (updateModal && !updateModal.hidden) {
      closeUpdateModal();
    }
    if (siteContentModal && !siteContentModal.hidden) {
      closeSiteContentModal();
    }
  });

  document.querySelectorAll("[data-bbcode-tag]").forEach((button) => {
    button.addEventListener("click", () => {
      const tag = button.dataset.bbcodeTag;
      if (!tag) return;
      insertBbcodeInto(resolveBbcodeField(button), `[${tag}]`, `[/${tag}]`);
    });
  });

  document.querySelectorAll("[data-bbcode-link]").forEach((button) => {
    button.addEventListener("click", () => {
      insertLinkBbcode(resolveBbcodeField(button));
    });
  });

  if (list) {
    list.addEventListener("click", (event) => {
      const editButton = event.target.closest("[data-update-edit]");
      if (!editButton) return;

      const article = editButton.closest(".update-item");
      const item = getUpdateItemData(article);
      if (item && Number.isInteger(item.id) && item.id > 0) {
        openUpdateModal(item);
      }
    });
  }

  if (typeof io !== "function") return;

  const socket = io({
    transports: ["websocket"]
  });

  if (list) {
    socket.on("site:update:create", (item) => {
      renderOrReplaceUpdate(item, { prepend: true });
    });

    socket.on("site:update:update", (item) => {
      renderOrReplaceUpdate(item);
    });

    socket.on("site:update:delete", (payload) => {
      const updateId = Number.parseInt(payload?.id, 10);
      if (Number.isInteger(updateId) && updateId > 0) {
        deleteUpdate(updateId);
      }
    });
  }

  socket.on("site:home-content:update", (homeContent) => {
    applyHomeContent(homeContent);
  });

  socket.on("site:stats:update", (stats) => {
    applyHomeStats(stats);
  });
})();
