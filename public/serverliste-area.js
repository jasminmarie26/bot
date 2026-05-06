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

      const normalizeOpenServerCards = () => {
        let hasOpenServerCard = false;
        overviewSections.forEach((section) => {
          if (!section.classList.contains("serverlist-board-card") || !section.open) {
            return;
          }

          if (hasOpenServerCard) {
            section.open = false;
            return;
          }

          hasOpenServerCard = true;
        });
      };

      normalizeOpenServerCards();

      let syncTimer = 0;
      const scheduleAccordionSync = () => {
        window.clearTimeout(syncTimer);
        syncTimer = window.setTimeout(() => {
          writeOpenIds();
        }, 0);
      };

      const closeOtherServerCards = (activeSection) => {
        overviewSections.forEach((otherSection) => {
          if (
            otherSection !== activeSection &&
            otherSection.open &&
            otherSection.classList.contains("serverlist-board-card")
          ) {
            otherSection.open = false;
          }
        });
      };

      overviewSections.forEach((section) => {
        if (!section.classList.contains("serverlist-board-card")) {
          return;
        }

        const summary = section.querySelector(".serverlist-board-card-head");
        if (!summary) {
          return;
        }

        summary.addEventListener("click", (event) => {
          if (event.target.closest("[data-serverlist-overview-actions]")) {
            return;
          }

          event.preventDefault();
          event.stopPropagation();

          if (section.open) {
            section.open = false;
            scheduleAccordionSync();
            return;
          }

          closeOtherServerCards(section);
          section.open = true;
          scheduleAccordionSync();
        });
      });

      overviewSections.forEach((section) => {
        section.addEventListener("toggle", () => {
          const isServerCardOpening = section.open && section.classList.contains("serverlist-board-card");
          if (isServerCardOpening) {
            closeOtherServerCards(section);
          }
          scheduleAccordionSync();
        });
      });

      root.querySelectorAll("[data-serverlist-overview-actions]").forEach((actions) => {
        actions.addEventListener("click", (event) => {
          event.stopPropagation();
        });
      });
    };

    const initCharacterPagination = () => {
      const root = document.querySelector("[data-serverlist-overview-root]");
      if (!root) {
        return;
      }

      const getCardState = (card) => {
        const pageButtons = Array.from(card.querySelectorAll("[data-serverlist-page-button]"));
        const pages = pageButtons
          .map((button) => Number(button.dataset.serverlistPageButton))
          .filter((page) => Number.isInteger(page) && page > 0);
        const currentButton = pageButtons.find((button) => button.classList.contains("is-active"));
        return {
          pageButtons,
          stepButtons: Array.from(card.querySelectorAll("[data-serverlist-page-step]")),
          characters: Array.from(card.querySelectorAll("[data-serverlist-character-page]")),
          currentPage: Number(currentButton?.dataset.serverlistPageButton) || 1,
          maxPage: Math.max(...pages, 1)
        };
      };

      const showPage = (card, nextPage) => {
        const state = getCardState(card);
        if (!state.characters.length || !state.pageButtons.length) {
          return;
        }

        const currentPage = Math.min(state.maxPage, Math.max(1, Number(nextPage) || 1));
        state.characters.forEach((character) => {
          character.hidden = Number(character.dataset.serverlistCharacterPage) !== currentPage;
        });
        state.pageButtons.forEach((button) => {
          const isActive = Number(button.dataset.serverlistPageButton) === currentPage;
          button.classList.toggle("is-active", isActive);
          button.setAttribute("aria-current", isActive ? "page" : "false");
        });
        state.stepButtons.forEach((button) => {
          const step = Number(button.dataset.serverlistPageStep) || 0;
          button.disabled = (step < 0 && currentPage <= 1) || (step > 0 && currentPage >= state.maxPage);
        });
      };

      root.addEventListener("click", (event) => {
        const button = event.target.closest("[data-serverlist-page-button], [data-serverlist-page-step]");
        if (!button) {
          return;
        }

        const card = button.closest(".serverlist-board-card");
        if (!card) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        if (button.dataset.serverlistPageButton) {
          showPage(card, Number(button.dataset.serverlistPageButton));
          return;
        }

        const state = getCardState(card);
        showPage(card, state.currentPage + (Number(button.dataset.serverlistPageStep) || 0));
      });

      root.querySelectorAll(".serverlist-board-card").forEach((card) => {
        showPage(card, 1);
      });
    };

    initOverviewAccordionState();
    initCharacterPagination();

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
