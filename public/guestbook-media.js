(() => {
  const tooltipTriggers = new Set();
  const autoTrimmedFloatImages = new Set();
  let floatTrimScheduled = false;

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

  const isWhitespaceNode = (node) =>
    node.nodeType === Node.TEXT_NODE && !String(node.textContent || "").trim();

  const getNextLayoutElement = (node) => {
    let current = node?.nextSibling || null;
    while (current) {
      if (isWhitespaceNode(current)) {
        current = current.nextSibling;
        continue;
      }

      if (current instanceof HTMLBRElement) {
        current = current.nextSibling;
        continue;
      }

      return current instanceof HTMLElement ? current : null;
    }

    return null;
  };

  const isGuestbookFloatImage = (element, side) =>
    element instanceof HTMLImageElement &&
    element.classList.contains("bb-image") &&
    element.classList.contains(`bb-image-${side}`);

  const isFloatTrimContentBlock = (element) =>
    element instanceof HTMLElement &&
    element.matches(".bb-block, .bb-story-box, .bb-dark-box, .bb-light-box");

  const resetAutoTrimmedFloatImage = (image) => {
    image.style.width = "";
    image.style.height = "";
    image.style.maxHeight = "";
    image.style.objectFit = "";
    image.style.objectPosition = "";
    image.dataset.guestbookFloatAutoTrimmed = "";
    autoTrimmedFloatImages.delete(image);
  };

  const trimFloatImageToHeight = (image, targetHeight) => {
    const imageRect = image.getBoundingClientRect();
    const targetWidth = Math.max(1, Math.round(imageRect.width));

    image.style.width = `${targetWidth}px`;
    image.style.height = `${targetHeight}px`;
    image.style.maxHeight = `${targetHeight}px`;
    image.style.objectFit = "cover";
    image.style.objectPosition = "top";
    image.dataset.guestbookFloatAutoTrimmed = "1";
    autoTrimmedFloatImages.add(image);
  };

  const trimGuestbookFloatFrames = () => {
    autoTrimmedFloatImages.forEach((image) => {
      if (document.documentElement.contains(image)) {
        resetAutoTrimmedFloatImage(image);
      } else {
        autoTrimmedFloatImages.delete(image);
      }
    });

    document.querySelectorAll(".guestbook-entry-body").forEach((body) => {
      body.querySelectorAll(".bb-image-left, .bb-image-right").forEach((firstImage) => {
        const firstSide = firstImage.classList.contains("bb-image-left") ? "left" : "right";
        const secondSide = firstSide === "left" ? "right" : "left";
        const secondImage = getNextLayoutElement(firstImage);
        if (!isGuestbookFloatImage(secondImage, secondSide)) {
          return;
        }

        const contentBlock = getNextLayoutElement(secondImage);
        if (!isFloatTrimContentBlock(contentBlock)) {
          return;
        }

        const firstRect = firstImage.getBoundingClientRect();
        const secondRect = secondImage.getBoundingClientRect();
        const contentRect = contentBlock.getBoundingClientRect();
        if (
          !firstImage.complete ||
          !secondImage.complete ||
          firstRect.width <= 0 ||
          secondRect.width <= 0 ||
          contentRect.height <= 0
        ) {
          return;
        }

        const floatTop = Math.min(firstRect.top, secondRect.top);
        const targetHeight = Math.ceil(contentRect.bottom - floatTop);
        const currentHeight = Math.max(firstRect.height, secondRect.height);

        if (targetHeight < 24 || currentHeight - targetHeight < 16) {
          return;
        }

        trimFloatImageToHeight(firstImage, targetHeight);
        trimFloatImageToHeight(secondImage, targetHeight);
      });
    });
  };

  const scheduleGuestbookFloatTrim = () => {
    if (floatTrimScheduled) {
      return;
    }

    floatTrimScheduled = true;
    window.requestAnimationFrame(() => {
      floatTrimScheduled = false;
      trimGuestbookFloatFrames();
    });
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

    root.querySelectorAll(".guestbook-entry-body .bb-image-left, .guestbook-entry-body .bb-image-right").forEach((image) => {
      if (image.dataset.floatTrimBound === "1") return;
      image.dataset.floatTrimBound = "1";
      image.addEventListener("load", scheduleGuestbookFloatTrim, { passive: true });
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

    scheduleGuestbookFloatTrim();
  }

  window.__initializeGuestbookMedia = initializeGuestbookMedia;
  initializeGuestbookMedia();
  scheduleGuestbookFloatTrim();
  window.addEventListener("load", scheduleGuestbookFloatTrim, { once: true });
  if (document.fonts?.ready) {
    document.fonts.ready.then(scheduleGuestbookFloatTrim).catch(() => {});
  }

  window.addEventListener("resize", () => {
    scheduleGuestbookFloatTrim();
    tooltipTriggers.forEach((trigger) => {
      if (!document.documentElement.contains(trigger)) {
        tooltipTriggers.delete(trigger);
        return;
      }

      positionTooltip(trigger);
    });
  });
})();
