(() => {
  const backToTopButton = document.querySelector("[data-site-back-to-top]");
  if (!(backToTopButton instanceof HTMLButtonElement)) {
    return;
  }

  const pageHasDedicatedScrollControl = Boolean(
    document.querySelector("[data-larp-back-to-top], [data-gb-editor-scroll-nav]")
  );

  if (pageHasDedicatedScrollControl) {
    backToTopButton.remove();
    return;
  }

  const showAfterPixels = 320;
  const prefersReducedMotion = () =>
    window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;

  const toggleButton = () => {
    backToTopButton.classList.toggle("is-visible", window.scrollY > showAfterPixels);
  };

  backToTopButton.addEventListener("click", () => {
    window.scrollTo({
      top: 0,
      behavior: prefersReducedMotion() ? "auto" : "smooth"
    });
  });

  window.addEventListener("scroll", toggleButton, { passive: true });
  window.addEventListener("resize", toggleButton, { passive: true });
  toggleButton();
})();
