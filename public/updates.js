(() => {
  const list = document.getElementById("site-updates-list");
  const modal = document.getElementById("update-modal");
  const form = document.getElementById("update-form");
  const title = document.getElementById("update-modal-title");
  const submitButton = document.getElementById("update-submit-btn");
  const closeButton = document.getElementById("update-close-btn");
  const field = form?.querySelector("textarea[name='content']");
  const canEditUpdates = Boolean(form);

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
    emptyState.textContent = "Noch keine Neuigkeiten veroeffentlicht.";
    list.appendChild(emptyState);
  }

  function createDeleteForm(updateId) {
    const formElement = document.createElement("form");
    formElement.method = "POST";
    formElement.action = `/updates/${updateId}/delete`;
    formElement.className = "inline-form";
    formElement.addEventListener("submit", (event) => {
      if (!window.confirm("Update wirklich loeschen?")) {
        event.preventDefault();
      }
    });

    const button = document.createElement("button");
    button.className = "ghost-btn icon-btn update-delete-btn";
    button.type = "submit";
    button.setAttribute("aria-label", "Update loeschen");
    button.title = "Update loeschen";
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
    editButton.setAttribute("aria-label", "Update bearbeiten");
    editButton.title = "Update bearbeiten";
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

  function setFormMode(mode, item = null) {
    if (!form || !field || !title || !submitButton) return;

    if (mode === "edit" && item) {
      form.action = `/updates/${item.id}/edit`;
      form.dataset.mode = "edit";
      title.textContent = "Live-Update bearbeiten";
      submitButton.textContent = "Speichern";
      field.value = item.content || "";
    } else {
      form.action = "/updates";
      form.dataset.mode = "create";
      title.textContent = "Neues Live-Update";
      submitButton.textContent = "Veroeffentlichen";
      field.value = "";
    }
  }

  function openModal(item = null) {
    if (!modal) return;
    setFormMode(item ? "edit" : "create", item);
    modal.hidden = false;
    modal.classList.add("is-open");
    document.body.classList.add("modal-open");
    if (field) {
      field.focus();
      field.selectionStart = field.value.length;
      field.selectionEnd = field.value.length;
    }
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.hidden = true;
    document.body.classList.remove("modal-open");
    setFormMode("create");
  }

  function insertBbcode(openTag, closeTag, placeholder = "Text") {
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

  function insertLinkBbcode() {
    if (!field) return;

    const rawUrl = window.prompt("Link eingeben:", "https://");
    if (rawUrl === null) return;

    const cleanedUrl = rawUrl.trim();
    if (!cleanedUrl) {
      field.focus();
      return;
    }

    insertBbcode(`[url=${cleanedUrl}]`, "[/url]", "Linktext");
  }

  if (modal) {
    document.querySelectorAll("[data-update-open]").forEach((button) => {
      button.addEventListener("click", () => openModal());
    });

    if (closeButton) {
      closeButton.addEventListener("click", closeModal);
    }

    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        closeModal();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !modal.hidden) {
        closeModal();
      }
    });

    modal.querySelectorAll("[data-bbcode-tag]").forEach((button) => {
      button.addEventListener("click", () => {
        const tag = button.dataset.bbcodeTag;
        if (!tag) return;
        insertBbcode(`[${tag}]`, `[/${tag}]`);
      });
    });

    modal.querySelectorAll("[data-bbcode-link]").forEach((button) => {
      button.addEventListener("click", insertLinkBbcode);
    });
  }

  if (list) {
    list.addEventListener("click", (event) => {
      const editButton = event.target.closest("[data-update-edit]");
      if (!editButton) return;

      const article = editButton.closest(".update-item");
      const item = getUpdateItemData(article);
      if (item && Number.isInteger(item.id) && item.id > 0) {
        openModal(item);
      }
    });
  }

  if (!list || typeof io !== "function") return;

  const socket = io();

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
})();
