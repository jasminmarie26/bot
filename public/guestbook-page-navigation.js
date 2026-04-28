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

  const applyFetchedGuestbookPage = (nextDocument, targetPage, targetUrl) => {
    const currentPageShell = document.querySelector(".guestbook-page-shell");
    const nextPageShell = nextDocument.querySelector(".guestbook-page-shell");
    const currentPanel = document.querySelector("[data-guestbook-panel]");
    const nextPanel = nextDocument.querySelector("[data-guestbook-panel]");
    const currentShell = getGuestbookShell();
    const nextShell = nextDocument.querySelector("[data-guestbook-current-page-number]");

    if (!currentPageShell || !nextPageShell || !currentPanel || !nextPanel || !currentShell || !nextShell) {
      throw new Error("Guestbook page markup is incomplete.");
    }

    const wasPanelOpen = !currentPanel.hidden;
    currentPageShell.replaceWith(nextPageShell);

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
    replaceVisibleGuestbookUrl(targetPage.number, targetUrl.href);
    window.__initializeGuestbookMedia?.(document);
  };

  let pendingNavigationController = null;

  const loadGuestbookPage = async (targetUrl, targetPage) => {
    pendingNavigationController?.abort();
    pendingNavigationController = typeof AbortController === "function" ? new AbortController() : null;

    const response = await fetch(targetUrl.href, {
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
    applyFetchedGuestbookPage(nextDocument, targetPage, targetUrl);
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

    const targetUrl = new URL(link.href, window.location.href);
    if (
      targetUrl.origin !== window.location.origin ||
      normalizeGuestbookPath(targetUrl.pathname) !== normalizeGuestbookPath(window.location.pathname)
    ) {
      return;
    }

    const targetPage = findPageByUrl(targetUrl);
    if (!targetPage) {
      return;
    }

    event.preventDefault();

    if (targetPage.number === getCurrentPageNumber()) {
      replaceVisibleGuestbookUrl(targetPage.number, targetUrl.href);
      return;
    }

    loadGuestbookPage(targetUrl, targetPage).catch((error) => {
      if (error?.name === "AbortError") {
        return;
      }

      window.location.replace(targetUrl.href);
    });
  });
})();
