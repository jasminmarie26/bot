(() => {
  const modal = document.querySelector("[data-guestbook-modal]");
  if (!modal) return;

  const openButtons = document.querySelectorAll("[data-guestbook-modal-open]");
  const closeButtons = modal.querySelectorAll("[data-guestbook-modal-close]");
  const modalBody = modal.querySelector(".guestbook-modal-body");

  const openModal = () => {
    modal.hidden = false;
    document.body.classList.add("has-guestbook-modal");

    window.requestAnimationFrame(() => {
      const targetId = window.location.hash;
      if (targetId && targetId.startsWith("#guestbook-entry-")) {
        const targetEntry = modal.querySelector(targetId);
        targetEntry?.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    });
  };

  const closeModal = () => {
    modal.hidden = true;
    document.body.classList.remove("has-guestbook-modal");
  };

  openButtons.forEach((button) => {
    button.addEventListener("click", openModal);
  });

  closeButtons.forEach((button) => {
    button.addEventListener("click", closeModal);
  });

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

  if (modalBody) {
    modalBody.addEventListener("click", (event) => {
      const authorLink = event.target.closest(".guestbook-author-link");
      if (authorLink) {
        closeModal();
      }
    });
  }

  if (modal.dataset.autoOpen === "true" || window.location.hash.startsWith("#guestbook-entry-")) {
    openModal();
  }
})();
