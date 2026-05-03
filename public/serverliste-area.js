(() => {
  document.addEventListener("DOMContentLoaded", () => {
    const modal = document.getElementById("serverlist-area-move-modal");
    const note = modal ? modal.querySelector(".serverlist-confirm-note") : null;
    const freeButton = document.getElementById("serverlist-area-move-free");
    const erpButton = document.getElementById("serverlist-area-move-erp");
    const closeElements = modal ? modal.querySelectorAll("[data-serverlist-area-close]") : [];
    const moveForms = document.querySelectorAll("[data-serverlist-area-move-confirm]");
    const erpAccessElement = document.querySelector("[data-erp-move-allowed]");
    const erpMoveAllowed =
      modal?.dataset.erpMoveAllowed === "true" ||
      erpAccessElement?.dataset.erpMoveAllowed === "true";

    if (!moveForms.length) {
      return;
    }

    let pendingForm = null;

    const closeModal = () => {
      modal.hidden = true;
      document.body.classList.remove("modal-open");
      pendingForm = null;
    };

    const getServerButtonLabel = (serverId) => (serverId === "erp" ? "ERP" : "Free RP");
    const getOtherServerId = (serverId) => (serverId === "erp" ? "free-rp" : "erp");

    const configureActionButton = (button, option) => {
      if (!button) {
        return;
      }

      if (!option) {
        button.hidden = true;
        button.disabled = true;
        button.textContent = "";
        button.dataset.targetServer = "";
        button.dataset.targetMode = "";
        return;
      }

      button.hidden = false;
      button.textContent = option.label;
      button.dataset.targetServer = option.serverId;
      button.dataset.targetMode = option.mode;
      button.disabled = Boolean(option.disabled);
    };

    const getMoveOptions = (form) => {
      const currentServer = String(form.dataset.serverlistCurrentServer || "").trim();
      const homeServer = String(form.dataset.serverlistHomeServer || "").trim();
      const position = String(form.dataset.serverlistPosition || "main").trim();
      const hasFestplayHome = homeServer === "free-rp" || homeServer === "erp";

      if (!hasFestplayHome) {
        const otherServerId = getOtherServerId(currentServer || "free-rp");
        return [
          {
            label: getServerButtonLabel(otherServerId),
            serverId: otherServerId,
            mode: "main"
          }
        ];
      }

      const otherServerId = getOtherServerId(homeServer);
      if (currentServer === homeServer && position === "festplay") {
        return [
          {
            label: getServerButtonLabel(homeServer),
            serverId: homeServer,
            mode: "main"
          },
          {
            label: getServerButtonLabel(otherServerId),
            serverId: otherServerId,
            mode: "main"
          }
        ];
      }

      if (position === "main") {
        return [
          {
            label: currentServer === homeServer
              ? getServerButtonLabel(otherServerId)
              : getServerButtonLabel(homeServer),
            serverId: currentServer === homeServer ? otherServerId : homeServer,
            mode: "main"
          },
          {
            label: "Zurück zum Festspiel",
            serverId: homeServer,
            mode: "festplay"
          }
        ];
      }

      return [
        {
          label: getServerButtonLabel(otherServerId),
          serverId: otherServerId,
          mode: "main"
        }
      ];
    };

    const submitFormMoveTo = (form, targetServerId, targetDashboardMode) => {
      if (!form || !targetServerId) {
        return;
      }

      const targetInput = form.querySelector('input[name="target_server_id"]');
      const targetModeInput = form.querySelector('input[name="target_dashboard_mode"]');

      if (!targetInput || !targetModeInput) {
        return;
      }

      targetInput.value = targetServerId;
      targetModeInput.value = targetDashboardMode || "main";
      form.submit();
    };

    const openModalForForm = (form) => {
      if (!modal || !note || !freeButton || !erpButton) {
        return;
      }

      pendingForm = form;
      const characterName = String(form.dataset.serverlistCharacterName || "").trim() || "Dieser Charakter";
      const currentServer = String(form.dataset.serverlistCurrentServer || "").trim();
      const homeServer = String(form.dataset.serverlistHomeServer || "").trim();
      const position = String(form.dataset.serverlistPosition || "main").trim();
      const targetInput = form.querySelector('input[name="target_server_id"]');
      const targetModeInput = form.querySelector('input[name="target_dashboard_mode"]');

      if (targetInput) {
        targetInput.value = "";
      }
      if (targetModeInput) {
        targetModeInput.value = "";
      }

      note.textContent = "Freischaltungen an Festspielen bleiben dabei erhalten.";

      const options = getMoveOptions(form).map((option) => ({
        ...option,
        disabled: option.serverId === "erp" && !erpMoveAllowed
      }));

      configureActionButton(freeButton, options[0] || null);
      configureActionButton(erpButton, options[1] || null);

      if (homeServer === currentServer && position === "festplay") {
        note.textContent = `Du kannst ${characterName} oben in ${getServerButtonLabel(homeServer)} ablegen oder auf ${getServerButtonLabel(getOtherServerId(homeServer))} verschieben.`;
      } else if (homeServer && position === "main") {
        note.textContent = `Du kannst ${characterName} auf den anderen RP-Server legen oder zurück ins Festspiel schieben.`;
      }

      if (!erpMoveAllowed && options.some((option) => option.serverId === "erp")) {
        note.textContent = `${note.textContent} ERP ist für Accounts unter 18 nicht verfügbar.`;
      }

      modal.hidden = false;
      document.body.classList.add("modal-open");
    };

    if (modal && note && freeButton && erpButton) {
      moveForms.forEach((form) => {
        form.addEventListener("submit", (event) => {
          event.preventDefault();
          openModalForForm(form);
        });
      });

      const moveTriggers = document.querySelectorAll("[data-serverlist-overview-move-trigger]");
      moveTriggers.forEach((trigger) => {
        trigger.addEventListener("click", () => {
          const card = trigger.closest("[data-serverlist-draggable-character]");
          const form = card?.querySelector("[data-serverlist-area-move-confirm]");
          if (!form) {
            return;
          }

          if (typeof form.requestSubmit === "function") {
            form.requestSubmit();
            return;
          }

          form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
        });
      });

      closeElements.forEach((element) => {
        element.addEventListener("click", closeModal);
      });
    }

    const submitMoveTo = (targetServerId, targetDashboardMode) => {
      if (!pendingForm) {
        return;
      }

      const formToSubmit = pendingForm;
      closeModal();
      submitFormMoveTo(formToSubmit, targetServerId, targetDashboardMode);
    };

    if (modal && freeButton && erpButton) {
      [freeButton, erpButton].forEach((button) => {
        button.addEventListener("click", () => {
          if (button.disabled || button.hidden) {
            return;
          }

          submitMoveTo(button.dataset.targetServer, button.dataset.targetMode);
        });
      });

      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !modal.hidden) {
          closeModal();
        }
      });
    }

    const draggableCards = document.querySelectorAll("[data-serverlist-draggable-character]");
    const dropZones = document.querySelectorAll("[data-serverlist-drop-zone]");

    if (!draggableCards.length || !dropZones.length) {
      return;
    }

    let draggedCard = null;
    let draggedForm = null;

    const clearDropStates = () => {
      dropZones.forEach((zone) => {
        zone.classList.remove("is-drop-target", "is-drop-blocked");
      });
    };

    const getDropZoneServerId = (zone) =>
      String(zone?.dataset.serverlistServerId || "").trim();

    const canDropOnZone = (zone) => {
      const targetServerId = getDropZoneServerId(zone);
      if (!draggedForm || !targetServerId) {
        return false;
      }

      if (targetServerId === "erp" && !erpMoveAllowed) {
        return false;
      }

      const currentServer = String(draggedForm.dataset.serverlistCurrentServer || "").trim();
      const currentPosition = String(draggedForm.dataset.serverlistPosition || "main").trim();
      return targetServerId !== currentServer || currentPosition === "festplay";
    };

    draggableCards.forEach((card) => {
      card.addEventListener("dragstart", (event) => {
        if (event.target instanceof Element && event.target.closest(".character-mini-actions")) {
          event.preventDefault();
          return;
        }

        const form = card.querySelector("[data-serverlist-area-move-confirm]");
        if (!form) {
          event.preventDefault();
          return;
        }

        draggedCard = card;
        draggedForm = form;
        card.classList.add("is-dragging");

        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData(
            "text/plain",
            String(card.dataset.serverlistCharacterId || "")
          );
        }
      });

      card.addEventListener("dragend", () => {
        card.classList.remove("is-dragging");
        draggedCard = null;
        draggedForm = null;
        clearDropStates();
      });
    });

    dropZones.forEach((zone) => {
      zone.addEventListener("dragover", (event) => {
        if (!draggedForm || !draggedCard) {
          return;
        }

        event.preventDefault();
        const allowed = canDropOnZone(zone);
        zone.classList.toggle("is-drop-target", allowed);
        zone.classList.toggle("is-drop-blocked", !allowed);

        if (event.dataTransfer) {
          event.dataTransfer.dropEffect = allowed ? "move" : "none";
        }
      });

      zone.addEventListener("dragleave", (event) => {
        if (event.relatedTarget instanceof Node && zone.contains(event.relatedTarget)) {
          return;
        }

        zone.classList.remove("is-drop-target", "is-drop-blocked");
      });

      zone.addEventListener("drop", (event) => {
        if (!draggedForm) {
          return;
        }

        event.preventDefault();
        const targetServerId = getDropZoneServerId(zone);
        const allowed = canDropOnZone(zone);
        clearDropStates();

        if (!allowed) {
          if (targetServerId === "erp" && !erpMoveAllowed) {
            window.alert("ERP ist erst ab 18 Jahren verfuegbar.");
          }
          return;
        }

        submitFormMoveTo(draggedForm, targetServerId, "main");
      });
    });
  });
})();
