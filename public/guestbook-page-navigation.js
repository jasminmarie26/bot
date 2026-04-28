(() => {
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
