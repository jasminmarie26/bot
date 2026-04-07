(() => {
  document.addEventListener("DOMContentLoaded", () => {
    const modal = document.getElementById("serverlist-larp-move-modal");
    const note = document.getElementById("serverlist-larp-move-note");
    const freeButton = document.getElementById("serverlist-larp-move-free");
    const erpButton = document.getElementById("serverlist-larp-move-erp");
    const closeElements = modal ? modal.querySelectorAll("[data-serverlist-larp-close]") : [];
    const moveForms = document.querySelectorAll("[data-serverlist-larp-move]");
    const erpMoveAllowed = modal?.dataset.erpMoveAllowed === "true";

    if (!modal || !note || !freeButton || !erpButton || !moveForms.length) {
      return;
    }

    let pendingForm = null;

    const closeModal = () => {
      modal.hidden = true;
      document.body.classList.remove("modal-open");
      pendingForm = null;
    };

    const openModalForForm = (form) => {
      pendingForm = form;
      const targetInput = form.querySelector('input[name="target_server_id"]');

      if (targetInput) {
        targetInput.value = "";
      }

      note.textContent = "Du kannst das Profil nach Free RP oder ERP verschieben.";

      freeButton.disabled = false;
      erpButton.disabled = !erpMoveAllowed;

      if (!erpMoveAllowed) {
        note.textContent = "Du kannst das Profil nach Free RP verschieben. ERP ist für Accounts unter 18 nicht verfügbar.";
      }

      modal.hidden = false;
      document.body.classList.add("modal-open");
    };

    moveForms.forEach((form) => {
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        openModalForForm(form);
      });
    });

    closeElements.forEach((element) => {
      element.addEventListener("click", closeModal);
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
      closeModal();
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

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !modal.hidden) {
        closeModal();
      }
    });
  });
})();
