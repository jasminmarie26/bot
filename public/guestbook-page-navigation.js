(() => {
  const isLiveGuestbookPage = /^\/characters\/\d+\/guestbook\/?$/.test(window.location.pathname);
  const pageHashMatch = String(window.location.hash || "").match(/^#seite-(\d+)$/i);
  const isEntryHash = String(window.location.hash || "").startsWith("#guestbook-entry-");
  const currentPageNumber = Number(
    document.querySelector("[data-guestbook-current-page-number]")?.dataset?.guestbookCurrentPageNumber
  ) || 1;

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

  if (isLiveGuestbookPage && pageHashMatch) {
    const requestedPageNumber = Number(pageHashMatch[1]);
    const currentUrl = new URL(window.location.href);
    if (
      Number.isInteger(requestedPageNumber) &&
      requestedPageNumber > 0 &&
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
  }

  if (isLiveGuestbookPage && !isEntryHash) {
    const currentUrl = new URL(window.location.href);
    if (currentUrl.searchParams.has("page_id") || pageHashMatch) {
      currentUrl.searchParams.delete("page_id");
      currentUrl.hash = currentPageNumber > 1 ? `#seite-${currentPageNumber}` : "";
      window.history.replaceState(window.history.state, "", `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`);
    }
  }

  const links = Array.from(document.querySelectorAll("[data-guestbook-page-navigation-link]"));
  if (!links.length || typeof window.location?.replace !== "function") {
    return;
  }

  links.forEach((link) => {
    if (!(link instanceof HTMLAnchorElement)) {
      return;
    }

    link.addEventListener("click", (event) => {
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
      if (targetUrl.origin !== window.location.origin) {
        return;
      }

      event.preventDefault();
      window.location.replace(targetUrl.href);
    });
  });
})();
