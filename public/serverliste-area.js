(() => {
  document.addEventListener("DOMContentLoaded", () => {
    const modal = document.getElementById("serverlist-area-move-modal");
    const note = modal ? modal.querySelector(".serverlist-confirm-note") : null;
    const freeButton = document.getElementById("serverlist-area-move-free");
    const erpButton = document.getElementById("serverlist-area-move-erp");
    const closeElements = modal ? modal.querySelectorAll("[data-serverlist-area-close]") : [];
    const moveForms = document.querySelectorAll("[data-serverlist-area-move-confirm]");
    const erpMoveAllowed = modal?.dataset.erpMoveAllowed === "true";

    const initOverviewAccordionState = () => {
      const root = document.querySelector("[data-serverlist-overview-root]");
      if (!root) {
        return;
      }

      const overviewSections = Array.from(root.querySelectorAll("[data-serverlist-overview-section]"))
        .filter((section) => section instanceof HTMLDetailsElement);
      if (!overviewSections.length) {
        return;
      }

      const getSectionId = (section) => String(section.dataset.serverlistOverviewSectionId || "").trim();
      const storageKey =
        String(root.dataset.serverlistOverviewStorageKey || "").trim() ||
        `serverlist-overview:${window.location.pathname}`;
      const defaultOpenIds = String(root.dataset.serverlistOverviewDefaultOpen || "")
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);

      const readStoredOpenIds = () => {
        try {
          const storedValue = window.sessionStorage.getItem(storageKey);
          if (!storedValue) {
            return null;
          }

          const parsedValue = JSON.parse(storedValue);
          if (!Array.isArray(parsedValue)) {
            return null;
          }

          return parsedValue
            .map((entry) => String(entry || "").trim())
            .filter(Boolean);
        } catch (_error) {
          return null;
        }
      };

      const writeOpenIds = () => {
        try {
          const openIds = overviewSections
            .filter((section) => section.open)
            .map(getSectionId)
            .filter(Boolean);
          window.sessionStorage.setItem(storageKey, JSON.stringify(openIds));
        } catch (_error) {
          // Saving the accordion state is best-effort only.
        }
      };

      const applyOpenIds = (openIds) => {
        const openIdSet = new Set(openIds);
        overviewSections.forEach((section) => {
          section.open = openIdSet.has(getSectionId(section));
        });
      };

      const storedOpenIds = readStoredOpenIds();
      applyOpenIds(storedOpenIds === null ? defaultOpenIds : storedOpenIds);

      let syncTimer = 0;
      const scheduleAccordionSync = () => {
        window.clearTimeout(syncTimer);
        syncTimer = window.setTimeout(() => {
          writeOpenIds();
        }, 0);
      };

      overviewSections.forEach((section) => {
        section.addEventListener("toggle", () => {
          scheduleAccordionSync();
        });
      });

      root.querySelectorAll("[data-serverlist-overview-actions]").forEach((actions) => {
        actions.addEventListener("click", (event) => {
          event.stopPropagation();
        });
      });
    };

    initOverviewAccordionState();

    if (!modal || !note || !freeButton || !erpButton || !moveForms.length) {
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

    const openModalForForm = (form) => {
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

    moveForms.forEach((form) => {
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        openModalForForm(form);
      });
    });

    closeElements.forEach((element) => {
      element.addEventListener("click", closeModal);
    });

    const submitMoveTo = (targetServerId, targetDashboardMode) => {
      if (!pendingForm) {
        return;
      }

      const formToSubmit = pendingForm;
      const targetInput = formToSubmit.querySelector('input[name="target_server_id"]');
      const targetModeInput = formToSubmit.querySelector('input[name="target_dashboard_mode"]');

      if (!targetInput || !targetModeInput) {
        return;
      }

      targetInput.value = targetServerId;
      targetModeInput.value = targetDashboardMode || "main";
      closeModal();
      formToSubmit.submit();
    };

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
  });
})();
