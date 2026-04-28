(() => {
  const isLiveGuestbookPage = /^\/characters\/\d+\/guestbook\/?$/.test(window.location.pathname);
  const isEntryHash = () => String(window.location.hash || "").startsWith("#guestbook-entry-");
  const getGuestbookShell = () => document.querySelector("[data-guestbook-current-page-number]");
  const getCurrentPageNumber = () =>
    Number(getGuestbookShell()?.dataset?.guestbookCurrentPageNumber) || 1;
  const normalizeGuestbookPath = (pathname) => String(pathname || "").replace(/\/$/, "");

  const parsePageHash = (hash = window.location.hash) => {
    const match = String(hash || "").match(/^#(?:seite-)?(\d+)$/i);
    const number = Number(match?.[1]);
    return Number.isInteger(number) && number > 0 ? number : null;
  };

  const readGuestbookPageMap = () => {
    const dataElement = document.getElementById("guestbook-page-map");
    if (!dataElement) {
      return [];
    }

    try {
      return (JSON.parse(dataElement.textContent || "[]") || [])
        .map((page) => ({
          id: Number(page?.id),
          number: Number(page?.number)
        }))
        .filter((page) => Number.isInteger(page.id) && page.id > 0 && Number.isInteger(page.number) && page.number > 0);
    } catch (_error) {
      return [];
    }
  };

  const findPageByUrl = (url) => {
    const pageId = Number(url.searchParams.get("page_id"));
    const pages = readGuestbookPageMap();
    if (Number.isInteger(pageId) && pageId > 0) {
      const page = pages.find((entry) => entry.id === pageId);
      if (page) {
        return page;
      }
    }

    const pageNumber = parsePageHash(url.hash);
    return pageNumber ? pages.find((entry) => entry.number === pageNumber) || null : null;
  };

  const buildVisibleGuestbookUrl = (pageNumber, sourceUrl = window.location.href) => {
    const visibleUrl = new URL(sourceUrl, window.location.href);
    visibleUrl.searchParams.delete("page_id");
    visibleUrl.searchParams.delete("entries_page");
    visibleUrl.hash = `#${pageNumber}`;
    return `${visibleUrl.pathname}${visibleUrl.search}${visibleUrl.hash}`;
  };

  const replaceVisibleGuestbookUrl = (pageNumber, sourceUrl = window.location.href) => {
    window.history.replaceState(
      window.history.state,
      "",
      buildVisibleGuestbookUrl(pageNumber, sourceUrl)
    );
  };

  const initializeTopbarPageMenu = () => {
    const menuRoot = document.querySelector("[data-topbar-guestbook-page-menu]");
    if (!(menuRoot instanceof HTMLElement) || menuRoot.dataset.guestbookPageMenuBound === "true") {
      return;
    }

    const toggle = menuRoot.querySelector("[data-topbar-guestbook-page-toggle]");
    const list = menuRoot.querySelector("[data-topbar-guestbook-page-list]");
    if (!(toggle instanceof HTMLButtonElement) || !(list instanceof HTMLElement)) {
      return;
    }

    menuRoot.dataset.guestbookPageMenuBound = "true";

    let isPinnedOpen = false;
    let isHoverOpen = false;
    let suppressHoverUntilLeave = false;

    const renderMenuState = () => {
      const isOpen = isPinnedOpen || isHoverOpen;
      menuRoot.classList.toggle("is-open", isOpen);
      toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
      list.setAttribute("aria-hidden", isOpen ? "false" : "true");
    };

    const closeMenu = ({ focusToggle = false } = {}) => {
      isPinnedOpen = false;
      isHoverOpen = false;
      suppressHoverUntilLeave = false;
      renderMenuState();
      if (focusToggle) {
        toggle.focus();
      }
    };

    toggle.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (isPinnedOpen || isHoverOpen) {
        isPinnedOpen = false;
        isHoverOpen = false;
        suppressHoverUntilLeave = true;
      } else {
        isPinnedOpen = true;
        isHoverOpen = false;
        suppressHoverUntilLeave = false;
      }

      renderMenuState();
    });

    menuRoot.addEventListener("pointerenter", () => {
      if (suppressHoverUntilLeave) {
        return;
      }

      isHoverOpen = true;
      renderMenuState();
    });

    menuRoot.addEventListener("pointerleave", () => {
      isHoverOpen = false;
      suppressHoverUntilLeave = false;
      renderMenuState();
    });

    menuRoot.addEventListener("focusout", (event) => {
      if (menuRoot.contains(event.relatedTarget)) {
        return;
      }

      if (!isPinnedOpen) {
        isHoverOpen = false;
        suppressHoverUntilLeave = false;
        renderMenuState();
      }
    });

    list.addEventListener("click", (event) => {
      if (event.target?.closest?.("a")) {
        closeMenu();
      }
    });

    document.addEventListener("click", (event) => {
      if (!menuRoot.contains(event.target)) {
        closeMenu();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && (isPinnedOpen || isHoverOpen)) {
        closeMenu({ focusToggle: true });
      }
    });

    renderMenuState();
  };

  const runGuestbookPageTransition = (pageShell, outgoingContent, direction) => {
    if (!(pageShell instanceof HTMLElement)) {
      return;
    }

    const preview = pageShell.querySelector(".guestbook-page-preview");
    const incomingContent = pageShell.querySelector(".guestbook-page-content-shell");
    if (!(preview instanceof HTMLElement) || !(incomingContent instanceof HTMLElement)) {
      return;
    }

    const existingGhost = preview.querySelector(".guestbook-page-content-ghost");
    if (existingGhost instanceof HTMLElement) {
      existingGhost.remove();
    }

    let ghost = null;
    if (outgoingContent instanceof HTMLElement) {
      ghost = outgoingContent.cloneNode(true);
      ghost.classList.add("guestbook-page-content-ghost");
      preview.appendChild(ghost);
    }

    pageShell.classList.remove("is-transitioning");
    pageShell.setAttribute("data-guestbook-transition-direction", direction);
    void pageShell.offsetWidth;
    pageShell.classList.add("is-transitioning");

    let finished = false;
    const cleanup = () => {
      if (finished) {
        return;
      }

      finished = true;
      pageShell.classList.remove("is-transitioning");
      pageShell.removeAttribute("data-guestbook-transition-direction");
      ghost?.remove();
      incomingContent.removeEventListener("animationend", cleanup);
      window.clearTimeout(fallbackTimer);
    };

    incomingContent.addEventListener("animationend", cleanup, { once: true });
    const fallbackTimer = window.setTimeout(cleanup, 420);
  };

  const copyAttributes = (source, target) => {
    Array.from(target.attributes).forEach((attribute) => {
      if (!source.hasAttribute(attribute.name)) {
        target.removeAttribute(attribute.name);
      }
    });
    Array.from(source.attributes).forEach((attribute) => {
      target.setAttribute(attribute.name, attribute.value);
    });
  };

  const syncPanelState = (isOpen) => {
    const panel = document.querySelector("[data-guestbook-panel]");
    const toggle = document.querySelector("[data-guestbook-panel-toggle]");
    if (!panel || !toggle) {
      return;
    }

    panel.hidden = !isOpen;
    document.documentElement.classList.toggle("guestbook-panel-open", isOpen);
    document.body?.classList.toggle("guestbook-panel-open", isOpen);
    toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");

    const actionLabel = isOpen
      ? "Gaestebuch-Eintraege schliessen"
      : "Gaestebuch-Eintraege oeffnen";
    toggle.setAttribute("aria-label", actionLabel);
    toggle.setAttribute("title", actionLabel);
  };

  const replaceOptionalElement = (selector, nextDocument) => {
    const currentElement = document.querySelector(selector);
    const nextElement = nextDocument.querySelector(selector);
    if (currentElement && nextElement) {
      currentElement.replaceWith(nextElement);
    }
  };

  const updateTopbarPageLinks = (nextDocument) => {
    const currentList = document.querySelector(".topbar-guestbook-page-list");
    const nextList = nextDocument.querySelector(".topbar-guestbook-page-list");
    if (currentList && nextList) {
      currentList.innerHTML = nextList.innerHTML;
    }
  };

  const applyFetchedGuestbookPage = (nextDocument, targetPage, visibleUrl) => {
    const currentPageShell = document.querySelector(".guestbook-page-shell");
    const nextPageShell = nextDocument.querySelector(".guestbook-page-shell");
    const currentPanel = document.querySelector("[data-guestbook-panel]");
    const nextPanel = nextDocument.querySelector("[data-guestbook-panel]");
    const currentShell = getGuestbookShell();
    const nextShell = nextDocument.querySelector("[data-guestbook-current-page-number]");

    if (!currentPageShell || !nextPageShell || !currentPanel || !nextPanel || !currentShell || !nextShell) {
      throw new Error("Guestbook page markup is incomplete.");
    }

    const currentPageNumberBeforeUpdate = Number(currentShell.dataset.guestbookCurrentPageNumber) || getCurrentPageNumber();
    const outgoingContent = currentPageShell.querySelector(".guestbook-page-content-shell");
    const wasPanelOpen = !currentPanel.hidden;
    copyAttributes(nextPageShell, currentPageShell);
    currentPageShell.innerHTML = nextPageShell.innerHTML;

    copyAttributes(nextPanel, currentPanel);
    currentPanel.innerHTML = nextPanel.innerHTML;

    currentShell.dataset.guestbookCurrentPageNumber = String(targetPage.number);
    currentShell.setAttribute("style", nextShell.getAttribute("style") || "");

    replaceOptionalElement("#guestbook-page-theme-vars", nextDocument);
    replaceOptionalElement("#guestbook-page-map", nextDocument);
    updateTopbarPageLinks(nextDocument);

    if (nextDocument.title) {
      document.title = nextDocument.title;
    }

    syncPanelState(wasPanelOpen);
    replaceVisibleGuestbookUrl(targetPage.number, visibleUrl.href);
    window.__initializeGuestbookMedia?.(document);
    runGuestbookPageTransition(
      currentPageShell,
      outgoingContent,
      targetPage.number >= currentPageNumberBeforeUpdate ? "forward" : "backward"
    );
  };

  let pendingNavigationController = null;

  const loadGuestbookPage = async (fetchUrl, targetPage, visibleUrl) => {
    pendingNavigationController?.abort();
    pendingNavigationController = typeof AbortController === "function" ? new AbortController() : null;

    const response = await fetch(fetchUrl.href, {
      credentials: "same-origin",
      headers: {
        "X-Requested-With": "fetch"
      },
      signal: pendingNavigationController?.signal
    });

    if (!response.ok) {
      throw new Error(`Guestbook page request failed: ${response.status}`);
    }

    const html = await response.text();
    const nextDocument = new DOMParser().parseFromString(html, "text/html");
    applyFetchedGuestbookPage(nextDocument, targetPage, visibleUrl);
  };

  if (!isLiveGuestbookPage) {
    return;
  }

  const requestedPageNumber = parsePageHash();
  const currentPageNumber = getCurrentPageNumber();
  const currentUrl = new URL(window.location.href);

  if (
    requestedPageNumber &&
    !currentUrl.searchParams.has("page_id") &&
    requestedPageNumber !== currentPageNumber
  ) {
    const targetPage = readGuestbookPageMap().find((page) => page.number === requestedPageNumber);
    if (targetPage) {
      currentUrl.searchParams.set("page_id", String(targetPage.id));
      window.location.replace(currentUrl.href);
      return;
    }
  }

  if (!isEntryHash() && (currentUrl.searchParams.has("page_id") || /^#seite-\d+$/i.test(window.location.hash))) {
    replaceVisibleGuestbookUrl(currentPageNumber, currentUrl.href);
  }

  initializeTopbarPageMenu();

  document.addEventListener("click", (event) => {
    const link = event.target?.closest?.("[data-guestbook-page-navigation-link]");
    if (!(link instanceof HTMLAnchorElement)) {
      return;
    }

    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      link.target
    ) {
      return;
    }

    const visibleUrl = new URL(link.href, window.location.href);
    const fetchUrl = new URL(link.dataset.guestbookPageFetchUrl || link.href, window.location.href);
    if (
      visibleUrl.origin !== window.location.origin ||
      fetchUrl.origin !== window.location.origin ||
      normalizeGuestbookPath(visibleUrl.pathname) !== normalizeGuestbookPath(window.location.pathname) ||
      normalizeGuestbookPath(fetchUrl.pathname) !== normalizeGuestbookPath(window.location.pathname)
    ) {
      return;
    }

    const targetPage = findPageByUrl(fetchUrl) || findPageByUrl(visibleUrl);
    if (!targetPage) {
      return;
    }

    event.preventDefault();

    if (targetPage.number === getCurrentPageNumber()) {
      replaceVisibleGuestbookUrl(targetPage.number, visibleUrl.href);
      return;
    }

    loadGuestbookPage(fetchUrl, targetPage, visibleUrl).catch((error) => {
      if (error?.name === "AbortError") {
        return;
      }

      window.location.replace(fetchUrl.href);
    });
  });
})();
