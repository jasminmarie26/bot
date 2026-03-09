(() => {
  const list = document.getElementById("site-updates-list");
  const emptyState = document.getElementById("site-updates-empty");
  const openButton = document.getElementById("update-open-btn");
  const fabButton = document.getElementById("update-fab");
  const closeButton = document.getElementById("update-close-btn");
  const modal = document.getElementById("update-modal");

  function openModal() {
    if (!modal) return;
    modal.hidden = false;
    modal.classList.add("is-open");
    const field = modal.querySelector("textarea[name='content']");
    if (field) field.focus();
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.hidden = true;
  }

  if (openButton) openButton.addEventListener("click", openModal);
  if (fabButton) fabButton.addEventListener("click", openModal);
  if (closeButton) closeButton.addEventListener("click", closeModal);
  if (modal) {
    modal.addEventListener("click", (event) => {
      if (event.target === modal) closeModal();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeModal();
    });
  }

  if (!list || typeof io !== "function") return;

  const socket = io();
  socket.on("site:update", (item) => {
    if (!item || typeof item !== "object") return;

    const article = document.createElement("article");
    article.className = "update-item";
    if (item.id != null) {
      article.dataset.updateId = String(item.id);
    }

    const header = document.createElement("header");
    header.className = "update-meta";

    const author = document.createElement("strong");
    author.textContent = item.author_name || "System";

    const time = document.createElement("small");
    time.textContent = item.created_at || "";

    header.appendChild(author);
    header.appendChild(time);

    const text = document.createElement("p");
    text.className = "pre-line";
    text.textContent = item.content || "";

    article.appendChild(header);
    article.appendChild(text);

    if (emptyState && emptyState.parentNode) {
      emptyState.parentNode.removeChild(emptyState);
    }

    list.insertBefore(article, list.firstChild);

    while (list.children.length > 30) {
      list.removeChild(list.lastChild);
    }
  });
})();
