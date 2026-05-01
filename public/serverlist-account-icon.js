(() => {
  const modal = document.querySelector("[data-serverlist-account-icon-modal]");
  const form = modal?.querySelector("[data-serverlist-account-icon-form]");
  if (!modal || !form) {
    return;
  }

  function clampPercent(value, fallback = 50) {
    const numericValue = Number.parseFloat(value);
    if (!Number.isFinite(numericValue)) {
      return fallback;
    }

    return Math.min(100, Math.max(0, numericValue));
  }

  const openButtons = Array.from(document.querySelectorAll("[data-serverlist-account-icon-open]"));
  const closeButtons = Array.from(modal.querySelectorAll("[data-serverlist-account-icon-close]"));
  const preview = modal.querySelector("[data-serverlist-account-icon-preview]");
  const statusNode = modal.querySelector("[data-serverlist-account-icon-status]");
  const titleNode = modal.querySelector("#serverlist-account-icon-title");
  const copyNode = modal.querySelector("[data-serverlist-account-icon-copy]");
  const urlInput = form.elements.imageUrl;
  const fileInput = form.elements.iconFile;
  const focusXInput = form.elements.focusX;
  const focusYInput = form.elements.focusY;
  const userMenu = document.querySelector(".topbar-user-menu");
  const menuIconAnchors = Array.from(document.querySelectorAll("[data-serverlist-account-icon-anchor]"));
  const maxUploadBytes = 4 * 1024 * 1024;
  const menuCharacterId = Number.parseInt(form.dataset.menuCharacterId || form.dataset.characterId || "", 10);
  let currentCharacterId = Number.parseInt(form.dataset.characterId || "", 10);
  let currentCharacterName = String(form.dataset.characterName || "").trim();
  let activeFilePayload = null;
  let lastFocusedElement = null;
  let savedImageUrl = String(form.dataset.currentImageUrl || "").trim();
  let savedFocusX = clampPercent(form.dataset.currentFocusX);
  let savedFocusY = clampPercent(form.dataset.currentFocusY);

  function ensurePreviewImage() {
    let image = preview.querySelector("[data-serverlist-account-icon-preview-image]");
    if (image) {
      return image;
    }

    image = document.createElement("img");
    image.alt = "";
    image.setAttribute("data-serverlist-account-icon-preview-image", "");
    preview.appendChild(image);
    return image;
  }

  function attachFallbackOnError(imageNode) {
    if (!(imageNode instanceof HTMLImageElement)) {
      return;
    }

    imageNode.addEventListener(
      "error",
      () => {
        imageNode.remove();
        imageNode.parentElement?.classList?.remove("has-custom-icon");
      },
      { once: true }
    );
  }

  function setStatus(message = "", kind = "") {
    const normalizedMessage = String(message || "").trim();
    statusNode.hidden = !normalizedMessage;
    statusNode.textContent = normalizedMessage;
    statusNode.classList.toggle("is-error", kind === "error");
    statusNode.classList.toggle("is-success", kind === "success");
  }

  function syncFocusStyles(focusXValue, focusYValue) {
    const nextFocusX = clampPercent(focusXValue, savedFocusX);
    const nextFocusY = clampPercent(focusYValue, savedFocusY);
    preview.style.setProperty("--serverlist-account-icon-focus-x", `${nextFocusX}%`);
    preview.style.setProperty("--serverlist-account-icon-focus-y", `${nextFocusY}%`);

    if (!Number.isInteger(menuCharacterId) || menuCharacterId < 1 || currentCharacterId !== menuCharacterId) {
      return;
    }

    menuIconAnchors.forEach((anchor) => {
      anchor.style.setProperty("--serverlist-account-icon-focus-x", `${nextFocusX}%`);
      anchor.style.setProperty("--serverlist-account-icon-focus-y", `${nextFocusY}%`);
    });
  }

  function setPreviewSource(sourceUrl) {
    const resolvedSource = String(sourceUrl || "").trim();
    const existingImage = preview.querySelector("[data-serverlist-account-icon-preview-image]");
    if (!resolvedSource) {
      existingImage?.remove();
      return;
    }

    const previewImage = ensurePreviewImage();
    previewImage.src = resolvedSource;
    attachFallbackOnError(previewImage);
  }

  function syncMenuIcons(imageUrl, focusXValue, focusYValue) {
    if (!Number.isInteger(menuCharacterId) || menuCharacterId < 1 || currentCharacterId !== menuCharacterId) {
      return;
    }

    const resolvedImageUrl = String(imageUrl || "").trim();
    const nextFocusX = clampPercent(focusXValue, savedFocusX);
    const nextFocusY = clampPercent(focusYValue, savedFocusY);

    menuIconAnchors.forEach((anchor) => {
      anchor.style.setProperty("--serverlist-account-icon-focus-x", `${nextFocusX}%`);
      anchor.style.setProperty("--serverlist-account-icon-focus-y", `${nextFocusY}%`);
      anchor.classList.toggle("has-custom-icon", Boolean(resolvedImageUrl));

      const existingImage = anchor.querySelector("[data-serverlist-account-icon-image]");
      if (!resolvedImageUrl) {
        existingImage?.remove();
        return;
      }

      let imageNode = existingImage;
      if (!(imageNode instanceof HTMLImageElement)) {
        imageNode = document.createElement("img");
        imageNode.alt = "";
        imageNode.setAttribute("data-serverlist-account-icon-image", "");
        anchor.appendChild(imageNode);
      }

      imageNode.src = resolvedImageUrl;
      attachFallbackOnError(imageNode);
    });
  }

  function syncCharacterButtons(imageUrl, focusXValue, focusYValue) {
    if (!Number.isInteger(currentCharacterId) || currentCharacterId < 1) {
      return;
    }

    const selector = `[data-serverlist-account-icon-open][data-character-id="${currentCharacterId}"]`;
    document.querySelectorAll(selector).forEach((button) => {
      if (!(button instanceof HTMLElement)) {
        return;
      }

      button.dataset.currentImageUrl = String(imageUrl || "").trim();
      button.dataset.currentFocusX = String(clampPercent(focusXValue, savedFocusX));
      button.dataset.currentFocusY = String(clampPercent(focusYValue, savedFocusY));
    });
  }

  function applyCharacterState(characterState = {}) {
    currentCharacterId = Number.parseInt(characterState.characterId || form.dataset.menuCharacterId || "", 10);
    currentCharacterName = String(characterState.characterName || form.dataset.characterName || "").trim();
    savedImageUrl = String(characterState.imageUrl || "").trim();
    savedFocusX = clampPercent(characterState.focusX, 50);
    savedFocusY = clampPercent(characterState.focusY, 50);
    form.dataset.characterId = Number.isInteger(currentCharacterId) ? String(currentCharacterId) : "";
    form.dataset.characterName = currentCharacterName;
    form.dataset.currentImageUrl = savedImageUrl;
    form.dataset.currentFocusX = String(savedFocusX);
    form.dataset.currentFocusY = String(savedFocusY);

    if (titleNode instanceof HTMLElement) {
      titleNode.textContent = "Icon editieren";
    }

    if (copyNode instanceof HTMLElement) {
      copyNode.textContent = currentCharacterName
        ? `Dieses Icon gilt nur für ${currentCharacterName}. Von URL oder vom PC auswählen, die Größe wird automatisch angepasst.`
        : "Von URL oder vom PC auswählen, die Größe wird automatisch angepasst.";
    }
  }

  function resetFormToSavedState() {
    activeFilePayload = null;
    if (fileInput instanceof HTMLInputElement) {
      fileInput.value = "";
    }
    if (urlInput instanceof HTMLInputElement) {
      urlInput.value = savedImageUrl;
    }
    if (focusXInput instanceof HTMLInputElement) {
      focusXInput.value = String(savedFocusX);
    }
    if (focusYInput instanceof HTMLInputElement) {
      focusYInput.value = String(savedFocusY);
    }
    syncFocusStyles(savedFocusX, savedFocusY);
    setPreviewSource(savedImageUrl);
    setStatus("");
  }

  function openModal(button = null) {
    const buttonDataset = button?.dataset || {};
    applyCharacterState({
      characterId: buttonDataset.characterId || form.dataset.characterId,
      characterName: buttonDataset.characterName || form.dataset.characterName,
      imageUrl: Object.prototype.hasOwnProperty.call(buttonDataset, "currentImageUrl")
        ? buttonDataset.currentImageUrl
        : form.dataset.currentImageUrl,
      focusX: buttonDataset.currentFocusX || form.dataset.currentFocusX,
      focusY: buttonDataset.currentFocusY || form.dataset.currentFocusY
    });
    lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    resetFormToSavedState();
    modal.hidden = false;
    document.body.classList.add("serverlist-account-icon-modal-open");
    userMenu?.removeAttribute("open");
    window.setTimeout(() => {
      urlInput?.focus();
      urlInput?.select?.();
    }, 0);
  }

  function closeModal() {
    modal.hidden = true;
    document.body.classList.remove("serverlist-account-icon-modal-open");
    setStatus("");
    if (lastFocusedElement instanceof HTMLElement) {
      lastFocusedElement.focus();
    }
  }

  async function readSelectedFile(file) {
    if (!(file instanceof File)) {
      return null;
    }

    if (file.size > maxUploadBytes) {
      throw new Error("Die Datei darf maximal 4 MB gro\u00DF sein.");
    }

    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Die Bilddatei konnte nicht gelesen werden."));
      reader.readAsDataURL(file);
    });

    const dimensions = await new Promise((resolve, reject) => {
      const probeImage = new Image();
      probeImage.onload = () => {
        resolve({
          width: Number(probeImage.naturalWidth || 0),
          height: Number(probeImage.naturalHeight || 0)
        });
      };
      probeImage.onerror = () => reject(new Error("Die Bilddatei konnte nicht geladen werden."));
      probeImage.src = dataUrl;
    });

    return {
      dataUrl,
      mimeType: String(file.type || "").trim().toLowerCase(),
      width: dimensions.width,
      height: dimensions.height
    };
  }

  async function handleFileChange() {
    setStatus("");
    const selectedFile = fileInput?.files?.[0] || null;
    if (!selectedFile) {
      activeFilePayload = null;
      setPreviewSource(String(urlInput?.value || "").trim() || savedImageUrl);
      return;
    }

    try {
      activeFilePayload = await readSelectedFile(selectedFile);
      setPreviewSource(activeFilePayload?.dataUrl || "");
    } catch (error) {
      activeFilePayload = null;
      if (fileInput instanceof HTMLInputElement) {
        fileInput.value = "";
      }
      setPreviewSource(String(urlInput?.value || "").trim() || savedImageUrl);
      setStatus(error instanceof Error ? error.message : "Die Bilddatei konnte nicht geladen werden.", "error");
    }
  }

  function getSubmitPayload() {
    const payload = {
      focusX: clampPercent(focusXInput?.value, savedFocusX),
      focusY: clampPercent(focusYInput?.value, savedFocusY)
    };

    if (activeFilePayload?.dataUrl) {
      return {
        ...payload,
        dataUrl: activeFilePayload.dataUrl,
        mimeType: activeFilePayload.mimeType,
        width: activeFilePayload.width,
        height: activeFilePayload.height
      };
    }

    return {
      ...payload,
      imageUrl: String(urlInput?.value || "").trim()
    };
  }

  openButtons.forEach((button) => {
    button.addEventListener("click", () => openModal(button));
  });

  closeButtons.forEach((button) => {
    button.addEventListener("click", closeModal);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) {
      event.preventDefault();
      closeModal();
    }
  });

  urlInput?.addEventListener("input", () => {
    if (activeFilePayload?.dataUrl) {
      return;
    }

    setStatus("");
    const typedUrl = String(urlInput.value || "").trim();
    setPreviewSource(typedUrl || savedImageUrl);
  });

  fileInput?.addEventListener("change", handleFileChange);

  focusXInput?.addEventListener("input", () => {
    syncFocusStyles(focusXInput.value, focusYInput?.value);
  });

  focusYInput?.addEventListener("input", () => {
    syncFocusStyles(focusXInput?.value, focusYInput.value);
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus("");

    if (!Number.isInteger(currentCharacterId) || currentCharacterId < 1) {
      setStatus("Kein Charakter ausgewählt.", "error");
      return;
    }

    const payload = getSubmitPayload();
    const hasExistingImage = Boolean(savedImageUrl);
    const hasRequestedImage = Boolean(payload.dataUrl || String(payload.imageUrl || "").trim());
    if (!hasExistingImage && !hasRequestedImage) {
      setStatus("Bitte ein Bild per URL oder vom PC ausw\u00E4hlen.", "error");
      return;
    }

    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton instanceof HTMLButtonElement) {
      submitButton.disabled = true;
    }

    try {
      const response = await fetch(`/characters/${currentCharacterId}/serverlist-icon`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify(payload)
      });

      const responsePayload = await response.json().catch(() => ({}));
      if (!response.ok || responsePayload?.ok !== true) {
        throw new Error(String(responsePayload?.error || "Das Icon konnte nicht gespeichert werden."));
      }

      savedImageUrl = String(responsePayload.imageUrl || "").trim();
      savedFocusX = clampPercent(responsePayload.focusX, savedFocusX);
      savedFocusY = clampPercent(responsePayload.focusY, savedFocusY);
      form.dataset.currentImageUrl = savedImageUrl;
      form.dataset.currentFocusX = String(savedFocusX);
      form.dataset.currentFocusY = String(savedFocusY);
      syncCharacterButtons(savedImageUrl, savedFocusX, savedFocusY);
      syncMenuIcons(savedImageUrl, savedFocusX, savedFocusY);
      setStatus("Icon gespeichert.", "success");
      closeModal();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Das Icon konnte nicht gespeichert werden.", "error");
    } finally {
      if (submitButton instanceof HTMLButtonElement) {
        submitButton.disabled = false;
      }
    }
  });

  applyCharacterState({
    characterId: form.dataset.characterId,
    characterName: form.dataset.characterName,
    imageUrl: form.dataset.currentImageUrl,
    focusX: form.dataset.currentFocusX,
    focusY: form.dataset.currentFocusY
  });
  syncMenuIcons(savedImageUrl, savedFocusX, savedFocusY);
})();
