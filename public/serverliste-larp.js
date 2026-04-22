(() => {
  document.addEventListener("DOMContentLoaded", () => {
    const moveModal = document.getElementById("serverlist-larp-move-modal");
    const moveNote = document.getElementById("serverlist-larp-move-note");
    const freeButton = document.getElementById("serverlist-larp-move-free");
    const erpButton = document.getElementById("serverlist-larp-move-erp");
    const moveCloseElements = moveModal ? moveModal.querySelectorAll("[data-serverlist-larp-close]") : [];
    const moveForms = document.querySelectorAll("[data-serverlist-larp-move]");
    const erpMoveAllowed = moveModal?.dataset.erpMoveAllowed === "true";
    const forumNoticeModal = document.getElementById("serverlist-larp-forum-notice-modal");
    const forumNoticeCopy = document.getElementById("serverlist-larp-forum-notice-copy");
    const forumNoticeOpenLink = document.getElementById("serverlist-larp-forum-notice-open");
    const forumNoticeCloseElements = forumNoticeModal
      ? forumNoticeModal.querySelectorAll("[data-serverlist-larp-forum-close]")
      : [];
    const forumEntryLinks = document.querySelectorAll('[data-serverlist-larp-forum-entry="true"]');

    const syncBodyModalState = () => {
      const hasOpenModal =
        Boolean(moveModal && !moveModal.hidden) ||
        Boolean(forumNoticeModal && !forumNoticeModal.hidden);
      document.body.classList.toggle("modal-open", hasOpenModal);
    };

    let pendingForm = null;

    const closeMoveModal = () => {
      if (!moveModal) {
        return;
      }

      moveModal.hidden = true;
      pendingForm = null;
      syncBodyModalState();
    };

    const openMoveModalForForm = (form) => {
      if (!moveModal || !moveNote || !freeButton || !erpButton) {
        return;
      }

      pendingForm = form;
      const targetInput = form.querySelector('input[name="target_server_id"]');

      if (targetInput) {
        targetInput.value = "";
      }

      moveNote.textContent = "Du kannst das Profil nach Free RP oder ERP verschieben.";
      freeButton.disabled = false;
      erpButton.disabled = !erpMoveAllowed;

      if (!erpMoveAllowed) {
        moveNote.textContent = "Du kannst das Profil nach Free RP verschieben. ERP ist f\u00fcr Accounts unter 18 nicht verf\u00fcgbar.";
      }

      moveModal.hidden = false;
      syncBodyModalState();
    };

    if (moveModal && moveNote && freeButton && erpButton && moveForms.length) {
      moveForms.forEach((form) => {
        form.addEventListener("submit", (event) => {
          event.preventDefault();
          openMoveModalForForm(form);
        });
      });

      moveCloseElements.forEach((element) => {
        element.addEventListener("click", closeMoveModal);
      });

      const submitMoveTo = (targetServerId) => {
        if (!pendingForm) {
          return;
        }

        const formToSubmit = pendingForm;
        const targetInput = formToSubmit.querySelector('input[name="target_server_id"]');

        if (!targetInput) {
          return;
        }

        targetInput.value = targetServerId;
        closeMoveModal();
        formToSubmit.submit();
      };

      freeButton.addEventListener("click", () => {
        if (!freeButton.disabled) {
          submitMoveTo("free-rp");
        }
      });

      erpButton.addEventListener("click", () => {
        if (!erpButton.disabled) {
          submitMoveTo("erp");
        }
      });
    }

    let pendingForumHref = "";

    const closeForumNoticeModal = () => {
      if (!forumNoticeModal) {
        return;
      }

      forumNoticeModal.hidden = true;
      pendingForumHref = "";

      if (forumNoticeOpenLink) {
        forumNoticeOpenLink.setAttribute("href", "#");
      }

      syncBodyModalState();
    };

    const openForumNoticeModalForLink = (link) => {
      if (!forumNoticeModal || !forumNoticeCopy || !forumNoticeOpenLink) {
        return;
      }

      const nextHref = String(link.getAttribute("href") || "").trim();
      if (!nextHref) {
        return;
      }

      const characterName = String(link.dataset.serverlistCharacterName || "").trim() || "Dieses Profil";
      pendingForumHref = nextHref;
      forumNoticeCopy.textContent = `${characterName} \u00f6ffnet jetzt das LARP-Forum.`;
      forumNoticeOpenLink.setAttribute("href", nextHref);
      forumNoticeModal.hidden = false;
      syncBodyModalState();
    };

    if (forumNoticeModal && forumNoticeCopy && forumNoticeOpenLink && forumEntryLinks.length) {
      forumEntryLinks.forEach((link) => {
        link.addEventListener("click", (event) => {
          event.preventDefault();
          openForumNoticeModalForLink(link);
        });
      });

      forumNoticeCloseElements.forEach((element) => {
        element.addEventListener("click", closeForumNoticeModal);
      });

      forumNoticeOpenLink.addEventListener("click", (event) => {
        if (!pendingForumHref) {
          event.preventDefault();
          closeForumNoticeModal();
          return;
        }

        const nextHref = pendingForumHref;
        event.preventDefault();
        closeForumNoticeModal();
        window.location.href = nextHref;
      });
    }

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") {
        return;
      }

      if (forumNoticeModal && !forumNoticeModal.hidden) {
        closeForumNoticeModal();
        return;
      }

      if (moveModal && !moveModal.hidden) {
        closeMoveModal();
      }
    });
  });
})();
