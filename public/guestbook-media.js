(() => {
  const tooltipTriggers = new Set();

  const getTooltipBoundary = (trigger) =>
    trigger.closest('.guestbook-page-preview[class*="gb-theme-"]') ||
    trigger.closest(".guestbook-page-preview") ||
    trigger.closest(".guestbook-item") ||
    document.documentElement;

  const positionTooltip = (trigger) => {
    if (!(trigger instanceof HTMLElement)) {
      return;
    }

    const popup = trigger.querySelector(".bb-fn-popup");
    if (!(popup instanceof HTMLElement)) {
      return;
    }

    trigger.removeAttribute("data-popup-align");
    trigger.removeAttribute("data-popup-side");

    const boundary = getTooltipBoundary(trigger);
    const boundaryRect =
      boundary instanceof HTMLElement
        ? boundary.getBoundingClientRect()
        : {
            top: 0,
            left: 0,
            right: window.innerWidth,
            bottom: window.innerHeight
          };
    const gutter = 12;

    let popupRect = popup.getBoundingClientRect();
    if (popupRect.left < boundaryRect.left + gutter) {
      trigger.dataset.popupAlign = "start";
      popupRect = popup.getBoundingClientRect();
    } else if (popupRect.right > boundaryRect.right - gutter) {
      trigger.dataset.popupAlign = "end";
      popupRect = popup.getBoundingClientRect();
    }

    if (popupRect.top < boundaryRect.top + gutter) {
      trigger.dataset.popupSide = "bottom";
      popupRect = popup.getBoundingClientRect();
    }

    if (
      trigger.dataset.popupSide === "bottom" &&
      popupRect.bottom > boundaryRect.bottom - gutter
    ) {
      trigger.removeAttribute("data-popup-side");
      popupRect = popup.getBoundingClientRect();
      if (popupRect.top < boundaryRect.top + gutter) {
        trigger.dataset.popupSide = "bottom";
      }
    }

    if (popupRect.left < boundaryRect.left + gutter) {
      trigger.dataset.popupAlign = "start";
    }
    if (popupRect.right > boundaryRect.right - gutter) {
      trigger.dataset.popupAlign = "end";
    }
  };

  function initializeGuestbookMedia(root = document) {
    root.querySelectorAll('img[data-guestbook-image-fallback="1"]').forEach((image) => {
      if (image.dataset.fallbackBound === "1") return;
      image.dataset.fallbackBound = "1";
      image.addEventListener("error", () => {
        if (image.dataset.fallbackApplied === "1") return;

        const fallbackSrc = String(image.dataset.fallbackSrc || "").trim();
        if (!fallbackSrc || image.currentSrc === fallbackSrc) return;

        image.dataset.fallbackApplied = "1";
        image.src = fallbackSrc;
      });
    });

    root.querySelectorAll(".bb-fn").forEach((trigger) => {
      if (trigger.dataset.tooltipBound === "1") {
        return;
      }

      trigger.dataset.tooltipBound = "1";
      tooltipTriggers.add(trigger);
      ["mouseenter", "focus", "touchstart"].forEach((eventName) => {
        trigger.addEventListener(
          eventName,
          () => {
            positionTooltip(trigger);
          },
          { passive: true }
        );
      });
    });
  }

  window.__initializeGuestbookMedia = initializeGuestbookMedia;
  initializeGuestbookMedia();

  window.addEventListener("resize", () => {
    tooltipTriggers.forEach((trigger) => {
      if (!document.documentElement.contains(trigger)) {
        tooltipTriggers.delete(trigger);
        return;
      }

      positionTooltip(trigger);
    });
  });
})();
