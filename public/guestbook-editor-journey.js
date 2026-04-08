(() => {
  const journey = document.querySelector("[data-character-editor-journey]");
  const characterPanel = document.querySelector('[data-character-editor-panel="character"]');
  const guestbookPanel = document.querySelector('[data-character-editor-panel="guestbook"]');

  if (!journey || !characterPanel || !guestbookPanel) {
    return;
  }

  const stepOrder = ["character", "guestbook-design", "guestbook-content"];
  const stepTriggers = Array.from(journey.querySelectorAll("[data-character-editor-step-trigger]"));
  const prevButton = journey.querySelector('[data-character-editor-nav="prev"]');
  const nextButton = journey.querySelector('[data-character-editor-nav="next"]');
  const guestbookPageLinks = Array.from(document.querySelectorAll("[data-character-guestbook-page-link]"));
  const storageKey = String(journey.dataset.characterEditorStorageKey || "").trim();
  let activeStep = stepOrder[0];
  let syncingGuestbookPage = false;

  const getHashStep = () => {
    const currentHash = String(window.location.hash || "").trim().toLowerCase();
    if (currentHash === "#character-editor-panel-character" || currentHash === "#character") {
      return "character";
    }
    if (currentHash === "#guestbook-content") {
      return "guestbook-content";
    }
    if (currentHash === "#guestbook-design") {
      return "guestbook-design";
    }
    return "";
  };

  const updateGuestbookPageLinkHashes = (stepName) => {
    const nextHash = stepName === "guestbook-content" ? "#guestbook-content" : "#guestbook-design";

    guestbookPageLinks.forEach((link) => {
      if (!(link instanceof HTMLAnchorElement)) {
        return;
      }

      try {
        const nextUrl = new URL(link.getAttribute("href") || "", window.location.origin);
        nextUrl.hash = nextHash;
        link.setAttribute("href", `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
      } catch (_error) {}
    });
  };

  const persistStep = (stepName) => {
    if (!storageKey) {
      return;
    }

    try {
      window.localStorage.setItem(storageKey, stepName);
    } catch (_error) {}
  };

  const getStoredStep = () => {
    if (!storageKey) {
      return "";
    }

    try {
      return window.localStorage.getItem(storageKey) || "";
    } catch (_error) {
      return "";
    }
  };

  const setActiveStep = (stepName, persist = true) => {
    const nextStep = stepOrder.includes(stepName) ? stepName : stepOrder[0];
    const nextIndex = stepOrder.indexOf(nextStep);
    const isGuestbookStep = nextStep !== "character";

    activeStep = nextStep;
    characterPanel.hidden = isGuestbookStep;
    guestbookPanel.hidden = !isGuestbookStep;

    stepTriggers.forEach((trigger) => {
      const triggerStep = String(trigger.dataset.characterEditorStepTrigger || "").trim().toLowerCase();
      const isActive = triggerStep === nextStep;
      trigger.classList.toggle("is-active", isActive);
      trigger.setAttribute("aria-selected", isActive ? "true" : "false");
      trigger.setAttribute("tabindex", isActive ? "0" : "-1");
    });

    if (prevButton instanceof HTMLButtonElement) {
      prevButton.disabled = nextIndex <= 0;
    }

    if (nextButton instanceof HTMLButtonElement) {
      nextButton.disabled = nextIndex >= stepOrder.length - 1;
    }

    if (isGuestbookStep && typeof window.setGuestbookEditorPage === "function") {
      syncingGuestbookPage = true;
      window.setGuestbookEditorPage(nextStep === "guestbook-content" ? "content" : "design", { persist });
      syncingGuestbookPage = false;
    }

    updateGuestbookPageLinkHashes(nextStep);

    if (persist) {
      persistStep(nextStep);
    }
  };

  stepTriggers.forEach((trigger) => {
    trigger.addEventListener("click", () => {
      setActiveStep(String(trigger.dataset.characterEditorStepTrigger || "").trim().toLowerCase() || "character");
    });
  });

  if (prevButton instanceof HTMLButtonElement) {
    prevButton.addEventListener("click", () => {
      const currentIndex = stepOrder.indexOf(activeStep);
      setActiveStep(stepOrder[Math.max(0, currentIndex - 1)] || stepOrder[0]);
    });
  }

  if (nextButton instanceof HTMLButtonElement) {
    nextButton.addEventListener("click", () => {
      const currentIndex = stepOrder.indexOf(activeStep);
      setActiveStep(stepOrder[Math.min(stepOrder.length - 1, currentIndex + 1)] || stepOrder[stepOrder.length - 1]);
    });
  }

  window.addEventListener("guestbook-editor-pagechange", (event) => {
    if (syncingGuestbookPage || activeStep === "character") {
      return;
    }

    const nextPage = String(event.detail?.page || "").trim().toLowerCase();
    const nextStep = nextPage === "content" ? "guestbook-content" : "guestbook-design";

    if (nextStep !== activeStep) {
      setActiveStep(nextStep);
    }
  });

  const hashStep = getHashStep();
  const storedStep = String(getStoredStep() || "").trim().toLowerCase();
  const initialStep =
    hashStep === "guestbook-content"
      ? hashStep
      : stepOrder.includes(storedStep)
        ? storedStep
        : hashStep || stepOrder[0];

  setActiveStep(initialStep, false);
})();
