(() => {
  document.querySelectorAll('img[data-guestbook-image-fallback="1"]').forEach((image) => {
    image.addEventListener("error", () => {
      if (image.dataset.fallbackApplied === "1") return;

      const fallbackSrc = String(image.dataset.fallbackSrc || "").trim();
      if (!fallbackSrc || image.currentSrc === fallbackSrc) return;

      image.dataset.fallbackApplied = "1";
      image.src = fallbackSrc;
    });
  });
})();
