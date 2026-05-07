(() => {
  const bootServerlistArea = () => {
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
        if (!section.classList.contains("serverlist-board-card")) {
          return;
        }

        const summary = section.querySelector(".serverlist-board-card-head");
        if (!summary) {
          return;
        }

        summary.addEventListener("click", (event) => {
          if (event.target.closest("[data-serverlist-overview-actions], .serverlist-board-pagination")) {
            return;
          }

          event.preventDefault();
          event.stopPropagation();

          if (section.open) {
            section.open = false;
            scheduleAccordionSync();
            return;
          }

          section.open = true;
          scheduleAccordionSync();
        });
      });

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

    const initCharacterPagination = () => {
      const root = document.querySelector("[data-serverlist-overview-root]");
      if (!root) {
        return;
      }

      const visiblePageCount = 3;

      const getStageCharacterItems = (stage) =>
        Array.from(stage.querySelectorAll("[data-serverlist-stage-character-page]"));

      const getStageCharacterPage = (item) =>
        Number(item.dataset.serverlistStageCharacterPage) || 1;

      const getStageCharacterMaxPage = (stage) => {
        const configuredPageCount = Number(stage.dataset.serverlistStageCharacterPageCount) || 0;
        const itemPageCount = Math.max(...getStageCharacterItems(stage).map(getStageCharacterPage), 1);
        return Math.max(configuredPageCount, itemPageCount, 1);
      };

      const showStageCharacterPage = (stage, nextPage) => {
        const items = getStageCharacterItems(stage);
        const maxPage = getStageCharacterMaxPage(stage);
        const currentPage = Math.min(maxPage, Math.max(1, Number(nextPage) || 1));
        const hasPagination = maxPage > 1;
        stage.dataset.serverlistStageCharacterCurrent = String(currentPage);
        stage.classList.toggle("has-stage-character-pagination", hasPagination);

        items.forEach((item) => {
          item.hidden = getStageCharacterPage(item) !== currentPage;
        });

        const pagination = stage.querySelector("[data-serverlist-stage-character-pagination]");
        if (pagination) {
          pagination.hidden = !hasPagination;
        }

        stage.querySelectorAll("[data-serverlist-stage-character-step]").forEach((button) => {
          const step = Number(button.dataset.serverlistStageCharacterStep) || 0;
          button.disabled = (step < 0 && currentPage <= 1) || (step > 0 && currentPage >= maxPage);
        });
      };

      const getItemPage = (item) =>
        Number(item.dataset.serverlistCharacterPage || item.dataset.serverlistStagePage);

      const itemMatchesFilter = (item, filterId) => {
        const itemFilter = String(item.dataset.serverlistStageServer || "").trim();
        return !filterId || !itemFilter || itemFilter === filterId;
      };

      const getCardState = (card) => {
        const pageButtons = Array.from(card.querySelectorAll("[data-serverlist-page-button]"));
        const filterId = String(card.dataset.serverlistStageFilter || "").trim();
        const allItems = Array.from(card.querySelectorAll("[data-serverlist-character-page], [data-serverlist-stage-page]"));
        const filteredItems = allItems.filter((item) => itemMatchesFilter(item, filterId));
        const pages = filteredItems
          .map(getItemPage)
          .filter((page) => Number.isInteger(page) && page > 0);
        const currentButton = pageButtons.find((button) => button.classList.contains("is-active"));
        return {
          filterId,
          pageButtons,
          stepButtons: Array.from(card.querySelectorAll("[data-serverlist-page-step]")),
          allItems,
          filteredItems,
          currentPage: Number(currentButton?.dataset.serverlistPageButton) || 1,
          maxPage: Math.max(...pages, 1)
        };
      };

      const syncPaginationUi = (card, state) => {
        const hasPagination = state.maxPage > 1;
        const pagination = card.querySelector(".serverlist-board-pagination");
        card.classList.toggle("has-serverlist-pagination", Boolean(pagination && hasPagination));
        if (pagination) {
          pagination.hidden = !hasPagination;
        }

        if (!card.matches(".serverlist-stage-card")) {
          return;
        }

        const activeCount = state.filteredItems.length;
        const countNode = card.querySelector("[data-serverlist-stage-count]");
        if (countNode) {
          countNode.textContent = `${activeCount} aktiv`;
        }

        card.querySelectorAll("[data-serverlist-stage-filter-button]").forEach((button) => {
          const isActive = button.dataset.serverlistStageFilterButton === state.filterId;
          button.classList.toggle("is-active", isActive);
          button.setAttribute("aria-pressed", isActive ? "true" : "false");
        });

        card.querySelectorAll("[data-serverlist-stage-empty]").forEach((emptyNode) => {
          emptyNode.hidden = emptyNode.dataset.serverlistStageEmpty !== state.filterId || activeCount > 0;
        });
      };

      const parseCssNumber = (value) => {
        const parsedValue = Number.parseFloat(value);
        return Number.isFinite(parsedValue) ? parsedValue : 0;
      };

      const getListContentCapacity = (list) => {
        const styles = window.getComputedStyle(list);
        const verticalPadding = parseCssNumber(styles.paddingTop) + parseCssNumber(styles.paddingBottom);
        return Math.max(1, list.clientHeight - verticalPadding);
      };

      const getListRowGap = (list) => {
        const styles = window.getComputedStyle(list);
        return parseCssNumber(styles.rowGap) || parseCssNumber(styles.gap);
      };

      const isClosedDetails = (card) => card instanceof HTMLDetailsElement && !card.open;

      const measureCharacterPages = (card, reservePagination) => {
        const list = card.querySelector("[data-serverlist-character-pages]");
        const items = Array.from(card.querySelectorAll("[data-serverlist-character-page]"));
        if (!list || !items.length || isClosedDetails(card)) {
          return null;
        }

        const pagination = card.querySelector(".serverlist-board-pagination");
        const previousItemHiddenState = items.map((item) => item.hidden);
        const previousListVisibility = list.style.visibility;
        const previousListOverflowY = list.style.overflowY;
        const previousPaginationHidden = pagination ? pagination.hidden : true;
        const hadPaginationClass = card.classList.contains("has-serverlist-pagination");

        try {
          list.style.visibility = "hidden";
          list.style.overflowY = "hidden";
          if (pagination) {
            pagination.hidden = !reservePagination;
          }
          card.classList.toggle("has-serverlist-pagination", reservePagination);
          items.forEach((item) => {
            item.hidden = false;
          });

          const capacity = getListContentCapacity(list);
          if (capacity <= 1) {
            return null;
          }

          const gap = getListRowGap(list);
          const pages = [[]];
          let usedHeight = 0;

          items.forEach((item) => {
            const itemHeight = Math.ceil(item.getBoundingClientRect().height);
            const currentPage = pages[pages.length - 1];
            const nextHeight = currentPage.length ? usedHeight + gap + itemHeight : itemHeight;

            if (currentPage.length && nextHeight > capacity + 1) {
              pages.push([item]);
              usedHeight = itemHeight;
              return;
            }

            currentPage.push(item);
            usedHeight = nextHeight;
          });

          return pages.filter((page) => page.length);
        } finally {
          items.forEach((item, index) => {
            item.hidden = previousItemHiddenState[index];
          });
          list.style.visibility = previousListVisibility;
          list.style.overflowY = previousListOverflowY;
          if (pagination) {
            pagination.hidden = previousPaginationHidden;
          }
          card.classList.toggle("has-serverlist-pagination", hadPaginationClass);
        }
      };

      const rebuildCharacterPageButtons = (card, pageCount) => {
        const pagination = card.querySelector(".serverlist-board-pagination");
        if (!pagination) {
          return;
        }

        const normalizedPageCount = Math.max(1, Number(pageCount) || 1);
        const nextButton = pagination.querySelector('[data-serverlist-page-step="1"]');
        pagination.querySelectorAll("[data-serverlist-page-button]").forEach((button) => {
          button.remove();
        });

        for (let pageNumber = 1; pageNumber <= normalizedPageCount; pageNumber += 1) {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "serverlist-board-page-btn";
          button.dataset.serverlistPageButton = String(pageNumber);
          button.setAttribute("aria-label", `Seite ${pageNumber} anzeigen`);
          button.setAttribute("aria-current", pageNumber === 1 ? "page" : "false");
          button.textContent = String(pageNumber);
          if (pageNumber > visiblePageCount) {
            button.hidden = true;
          }
          pagination.insertBefore(button, nextButton || null);
        }
      };

      const repaginateCharacterCard = (card) => {
        if (card.matches(".serverlist-board-card")) {
          return false;
        }

        const pagesWithoutNavigation = measureCharacterPages(card, false);
        if (!pagesWithoutNavigation) {
          return false;
        }

        const pages = pagesWithoutNavigation.length <= 1
          ? pagesWithoutNavigation
          : measureCharacterPages(card, true) || pagesWithoutNavigation;

        pages.forEach((page, pageIndex) => {
          page.forEach((item) => {
            item.dataset.serverlistCharacterPage = String(pageIndex + 1);
          });
        });
        rebuildCharacterPageButtons(card, pages.length);
        return true;
      };

      const showPage = (card, nextPage) => {
        const state = getCardState(card);
        if (!state.allItems.length) {
          syncPaginationUi(card, state);
          return;
        }

        const currentPage = Math.min(state.maxPage, Math.max(1, Number(nextPage) || 1));
        state.allItems.forEach((item) => {
          item.hidden = !itemMatchesFilter(item, state.filterId) || getItemPage(item) !== currentPage;
        });
        const lastVisibleStart = Math.max(1, state.maxPage - visiblePageCount + 1);
        const visibleStart = Math.min(lastVisibleStart, Math.max(1, currentPage));
        const visibleEnd = Math.min(state.maxPage, visibleStart + visiblePageCount - 1);

        state.pageButtons.forEach((button) => {
          const pageNumber = Number(button.dataset.serverlistPageButton);
          const isVisible = pageNumber >= visibleStart && pageNumber <= visibleEnd;
          button.hidden = !isVisible;
          const isActive = Number(button.dataset.serverlistPageButton) === currentPage;
          button.classList.toggle("is-active", isActive);
          button.setAttribute("aria-current", isActive ? "page" : "false");
        });
        state.stepButtons.forEach((button) => {
          const step = Number(button.dataset.serverlistPageStep) || 0;
          button.disabled = (step < 0 && currentPage <= 1) || (step > 0 && currentPage >= state.maxPage);
        });
        const pageList = card.querySelector("[data-serverlist-character-pages]");
        if (pageList) {
          const pageSize = Number(pageList.dataset.serverlistCharacterPageSize) || 0;
          const visibleCharacterCount = state.allItems.filter((item) =>
            item.matches("[data-serverlist-character-page]") &&
            itemMatchesFilter(item, state.filterId) &&
            getItemPage(item) === currentPage
          ).length;
          pageList.classList.toggle(
            "is-full-character-page",
            Boolean(pageSize && visibleCharacterCount >= pageSize)
          );
          pageList.scrollTop = 0;
        }
        syncPaginationUi(card, state);
      };

      root.addEventListener("click", (event) => {
        const filterButton = event.target.closest("[data-serverlist-stage-filter-button]");
        if (filterButton) {
          const card = filterButton.closest(".serverlist-stage-card");
          if (!card) {
            return;
          }

          event.preventDefault();
          event.stopPropagation();
          card.dataset.serverlistStageFilter = String(filterButton.dataset.serverlistStageFilterButton || "").trim();
          showPage(card, 1);
          return;
        }

        const button = event.target.closest("[data-serverlist-page-button], [data-serverlist-page-step]");
        if (!button) {
          const stageCharacterButton = event.target.closest("[data-serverlist-stage-character-step]");
          if (!stageCharacterButton) {
            return;
          }

          const stage = stageCharacterButton.closest(".serverlist-festplay-stage");
          if (!stage) {
            return;
          }

          event.preventDefault();
          event.stopPropagation();
          const currentPage = Number(stage.dataset.serverlistStageCharacterCurrent) || 1;
          showStageCharacterPage(
            stage,
            currentPage + (Number(stageCharacterButton.dataset.serverlistStageCharacterStep) || 0)
          );
          return;
        }

        const card = button.closest(".serverlist-board-card, .serverlist-stage-card");
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

      const refreshCharacterPagination = () => {
        root.querySelectorAll(".serverlist-board-card").forEach((card) => {
          const currentPage = getCardState(card).currentPage;
          if (repaginateCharacterCard(card)) {
            showPage(card, currentPage);
          }
        });
      };

      let refreshFrame = 0;
      const scheduleCharacterPaginationRefresh = () => {
        window.cancelAnimationFrame(refreshFrame);
        refreshFrame = window.requestAnimationFrame(refreshCharacterPagination);
      };

      root.querySelectorAll(".serverlist-board-card, .serverlist-stage-card").forEach((card) => {
        if (card.matches(".serverlist-board-card") && repaginateCharacterCard(card)) {
          showPage(card, getCardState(card).currentPage);
          return;
        }

        showPage(card, 1);
      });

      root.querySelectorAll(".serverlist-festplay-stage").forEach((stage) => {
        showStageCharacterPage(stage, Number(stage.dataset.serverlistStageCharacterCurrent) || 1);
      });

      root.querySelectorAll(".serverlist-board-card").forEach((card) => {
        card.addEventListener("toggle", () => {
          if (card.open) {
            scheduleCharacterPaginationRefresh();
          }
        });
      });

      window.addEventListener("resize", scheduleCharacterPaginationRefresh);
      window.addEventListener("pageshow", scheduleCharacterPaginationRefresh);
      if (document.fonts?.ready) {
        document.fonts.ready.then(scheduleCharacterPaginationRefresh).catch(() => {});
      }
    };

    const initBulkCharacterDelete = () => {
      const root = document.querySelector("[data-serverlist-overview-root]");
      if (!root) {
        return;
      }

      const getCardSelections = (card) =>
        Array.from(card.querySelectorAll("[data-serverlist-character-select]"));

      const getSelectedSelections = (card) =>
        getCardSelections(card).filter((input) => input.checked);

      const fetchDeleteImpact = async (characterIds) => {
        const params = new URLSearchParams();
        characterIds.forEach((characterId) => {
          params.append("character_ids", String(characterId));
        });
        const response = await fetch(`/characters/delete-impact?${params.toString()}`, {
          credentials: "same-origin",
          headers: {
            Accept: "application/json",
            "X-Requested-With": "XMLHttpRequest"
          }
        });
        if (!response.ok) {
          return null;
        }
        try {
          return await response.json();
        } catch (_error) {
          return null;
        }
      };

      const buildDeleteImpactWarning = (impact) => {
        const creatorFestplays = Array.isArray(impact?.creator_festplays)
          ? impact.creator_festplays
          : [];
        if (!creatorFestplays.length) {
          return "";
        }

        const festplayNames = creatorFestplays
          .map((festplay) => String(festplay?.name || "").trim())
          .filter(Boolean);
        const listText = festplayNames.length ? festplayNames.join(", ") : "diese Festspiele";
        return `Ausgew\u00e4hlte Charaktere haben folgende Festspiele er\u00f6ffnet: ${listText}.\n\nWenn du sie l\u00f6schst, werden diese Festspiele inklusive R\u00e4umen ebenfalls gel\u00f6scht. Trotzdem l\u00f6schen?`;
      };

      const updateSelectionState = (card) => {
        const isSelecting = card.classList.contains("is-selecting-characters");
        const selectedInputs = getSelectedSelections(card);
        const toggle = card.querySelector("[data-serverlist-bulk-delete-toggle]");

        getCardSelections(card).forEach((input) => {
          const row = input.closest(".serverlist-board-character");
          row?.classList.toggle("is-bulk-selected", input.checked);
        });

        if (toggle) {
          toggle.classList.toggle("is-active", isSelecting);
          toggle.setAttribute("aria-pressed", isSelecting ? "true" : "false");
          toggle.setAttribute(
            "aria-label",
            selectedInputs.length
              ? `${selectedInputs.length} ausgew\u00e4hlte Charaktere l\u00f6schen`
              : "Charaktere zum L\u00f6schen ausw\u00e4hlen"
          );
          toggle.title = selectedInputs.length
            ? `${selectedInputs.length} ausgew\u00e4hlte Charaktere l\u00f6schen`
            : "Charaktere zum L\u00f6schen ausw\u00e4hlen";
        }
      };

      const setSelectionMode = (card, enabled) => {
        card.classList.toggle("is-selecting-characters", enabled);
        if (!enabled) {
          getCardSelections(card).forEach((input) => {
            input.checked = false;
          });
        }
        updateSelectionState(card);
      };

      const submitSelectedCharacters = async (card, selectedInputs) => {
        const form = card.querySelector("[data-serverlist-bulk-delete-form]");
        if (!form || !selectedInputs.length) {
          return;
        }

        const selectedNames = selectedInputs
          .map((input) => input.closest(".serverlist-board-character")?.dataset.serverlistCharacterName || "")
          .filter(Boolean);
        const confirmText = selectedNames.length === 1
          ? `${selectedNames[0]} wirklich l\u00f6schen?`
          : `${selectedNames.length} Charaktere wirklich l\u00f6schen?`;
        if (!window.confirm(confirmText)) {
          return;
        }

        let impact = null;
        try {
          impact = await fetchDeleteImpact(selectedInputs.map((input) => input.value));
        } catch (_error) {
          impact = null;
        }
        const warning = buildDeleteImpactWarning(impact);
        if (warning && !window.confirm(warning)) {
          return;
        }

        form.querySelectorAll('input[name="character_ids"]').forEach((input) => input.remove());
        selectedInputs.forEach((input) => {
          const hiddenInput = document.createElement("input");
          hiddenInput.type = "hidden";
          hiddenInput.name = "character_ids";
          hiddenInput.value = input.value;
          form.appendChild(hiddenInput);
        });
        form.submit();
      };

      root.addEventListener("click", (event) => {
        const toggle = event.target.closest("[data-serverlist-bulk-delete-toggle]");
        if (toggle) {
          const card = toggle.closest(".serverlist-board-card");
          if (!card) {
            return;
          }

          event.preventDefault();
          event.stopPropagation();

          if (!card.classList.contains("is-selecting-characters")) {
            setSelectionMode(card, true);
            return;
          }

          const selectedInputs = getSelectedSelections(card);
          if (!selectedInputs.length) {
            setSelectionMode(card, false);
            return;
          }

          submitSelectedCharacters(card, selectedInputs).catch(() => {});
          return;
        }

        const card = event.target.closest(".serverlist-board-card.is-selecting-characters");
        if (!card) {
          return;
        }

        if (
          event.target.closest(
            ".serverlist-board-character-actions, .serverlist-direct-move-form, .serverlist-board-card-head, .serverlist-board-pagination"
          )
        ) {
          return;
        }

        const row = event.target.closest(".serverlist-board-character");
        if (!row) {
          return;
        }

        const selectionInput = row.querySelector("[data-serverlist-character-select]");
        if (!selectionInput) {
          return;
        }

        if (event.target.closest(".serverlist-character-select")) {
          window.setTimeout(() => updateSelectionState(card), 0);
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        selectionInput.checked = !selectionInput.checked;
        updateSelectionState(card);
      });

      root.addEventListener("change", (event) => {
        const selectionInput = event.target.closest("[data-serverlist-character-select]");
        if (!selectionInput) {
          return;
        }

        const card = selectionInput.closest(".serverlist-board-card");
        if (card) {
          updateSelectionState(card);
        }
      });
    };

    initOverviewAccordionState();
    initCharacterPagination();
    initBulkCharacterDelete();

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
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootServerlistArea, { once: true });
  } else {
    bootServerlistArea();
  }
})();
