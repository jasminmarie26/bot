(() => {
  const searchInput = document.getElementById("members-search");
  const status = document.getElementById("members-search-status");
  const cards = Array.from(document.querySelectorAll("[data-member-card]"));

  if (!searchInput || !status || !cards.length) {
    return;
  }

  const staffSections = Array.from(document.querySelectorAll("[data-members-static-section]")).map((element) => ({
    element,
    cards: Array.from(element.querySelectorAll("[data-member-card]")),
    countNode: element.querySelector("[data-members-static-count]")
  }));

  const browsers = Array.from(document.querySelectorAll("[data-members-browser]")).map((element) => {
    const buttons = Array.from(element.querySelectorAll("[data-members-group-button]"));
    const panels = Array.from(element.querySelectorAll("[data-members-group-panel]"));
    const activeButton = buttons.find((button) => button.classList.contains("is-active"));

    return {
      element,
      buttons,
      panels,
      emptyNode: element.querySelector("[data-members-empty]"),
      activeTarget:
        activeButton?.dataset.membersGroupTarget ||
        buttons[0]?.dataset.membersGroupTarget ||
        ""
    };
  });

  function formatMemberCount(count) {
    const safeCount = Math.max(0, Number(count) || 0);
    return `${safeCount} Charakter${safeCount === 1 ? "" : "e"}`;
  }

  function updateStatus(visibleCount, query) {
    const trimmedQuery = String(query || "").trim();
    status.textContent = trimmedQuery
      ? `${visibleCount} Treffer für "${trimmedQuery}".`
      : `${visibleCount} Charaktere gefunden.`;
  }

  function cardMatchesQuery(card, query, extraTerms = []) {
    if (!query) {
      return true;
    }

    const haystack = [
      card.dataset.memberName || "",
      card.dataset.memberOwner || "",
      card.dataset.memberServer || "",
      card.dataset.memberRole || "",
      ...extraTerms
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  }

  function setActiveTarget(browser, target) {
    const normalizedTarget = String(target || "").trim();
    browser.activeTarget = normalizedTarget;

    browser.buttons.forEach((button) => {
      const isActive =
        normalizedTarget &&
        !button.hidden &&
        button.dataset.membersGroupTarget === normalizedTarget;
      button.classList.toggle("is-active", Boolean(isActive));
      button.setAttribute("aria-pressed", isActive ? "true" : "false");
    });

    browser.panels.forEach((panel) => {
      panel.hidden = !normalizedTarget || panel.dataset.membersGroupPanel !== normalizedTarget;
    });
  }

  function applyFilter() {
    const query = String(searchInput.value || "").trim().toLowerCase();
    const visibleIds = new Set();

    staffSections.forEach((section) => {
      let visibleCount = 0;

      section.cards.forEach((card) => {
        const isVisible = cardMatchesQuery(card, query);
        card.hidden = !isVisible;
        if (!isVisible) {
          return;
        }

        visibleCount += 1;
        const memberId = card.dataset.memberId || card.dataset.memberName || "";
        if (memberId) {
          visibleIds.add(memberId);
        }
      });

      if (section.countNode) {
        section.countNode.textContent = formatMemberCount(visibleCount);
      }

      section.element.hidden = visibleCount === 0 && query.length > 0;
    });

    browsers.forEach((browser) => {
      if (!browser.buttons.length || !browser.panels.length) {
        browser.element.hidden = query.length > 0;
        return;
      }

      let firstVisibleTarget = "";

      browser.panels.forEach((panel) => {
        const target = panel.dataset.membersGroupPanel || "";
        const groupLabel = String(panel.dataset.membersGroupLabel || "").toLowerCase();
        const panelCards = Array.from(panel.querySelectorAll("[data-member-card]"));
        let visibleCount = 0;

        panelCards.forEach((card) => {
          const isVisible = cardMatchesQuery(card, query, [groupLabel]);
          card.hidden = !isVisible;
          if (isVisible) {
            visibleCount += 1;
          }
        });

        const button = browser.buttons.find((entry) => entry.dataset.membersGroupTarget === target);
        if (button) {
          button.hidden = visibleCount === 0;
          const buttonCountNode = button.querySelector("[data-members-group-button-count]");
          if (buttonCountNode) {
            buttonCountNode.textContent = formatMemberCount(visibleCount);
          }
        }

        const panelCountNode = panel.querySelector("[data-members-panel-count]");
        if (panelCountNode) {
          panelCountNode.textContent = formatMemberCount(visibleCount);
        }

        if (visibleCount > 0 && !firstVisibleTarget) {
          firstVisibleTarget = target;
        }
      });

      const hasRequestedVisible = browser.buttons.some(
        (button) =>
          button.dataset.membersGroupTarget === browser.activeTarget &&
          !button.hidden
      );
      const nextTarget = hasRequestedVisible ? browser.activeTarget : firstVisibleTarget;
      const hasVisibleGroups = Boolean(nextTarget);

      setActiveTarget(browser, nextTarget);

      if (browser.emptyNode) {
        browser.emptyNode.hidden = hasVisibleGroups;
      }

      browser.element.hidden = !hasVisibleGroups && query.length > 0;
      if (!hasVisibleGroups) {
        return;
      }

      const activePanel = browser.panels.find(
        (panel) => panel.dataset.membersGroupPanel === nextTarget
      );
      if (!activePanel) {
        return;
      }

      Array.from(activePanel.querySelectorAll("[data-member-card]"))
        .filter((card) => !card.hidden)
        .forEach((card) => {
          const memberId = card.dataset.memberId || card.dataset.memberName || "";
          if (memberId) {
            visibleIds.add(memberId);
          }
        });
    });

    updateStatus(visibleIds.size, searchInput.value);
  }

  browsers.forEach((browser) => {
    browser.buttons.forEach((button) => {
      button.addEventListener("click", () => {
        browser.activeTarget = button.dataset.membersGroupTarget || "";
        applyFilter();
      });
    });
  });

  searchInput.addEventListener("input", applyFilter);
  applyFilter();
})();
