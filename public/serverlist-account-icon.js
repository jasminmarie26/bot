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

  function clampZoom(value, fallback = 1) {
    const numericValue = Number.parseFloat(value);
    if (!Number.isFinite(numericValue)) {
      return fallback;
    }

    return Math.min(4, Math.max(1, numericValue));
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
  const zoomInput = form.elements.zoom;
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
  let savedZoom = clampZoom(form.dataset.currentZoom);

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
        const parentNode = imageNode.parentElement;
        parentNode?.classList?.remove("has-custom-icon");
        imageNode.remove();
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

  function syncIconStyles(focusXValue, focusYValue, zoomValue) {
    const nextFocusX = clampPercent(focusXValue, savedFocusX);
    const nextFocusY = clampPercent(focusYValue, savedFocusY);
    const nextZoom = clampZoom(zoomValue, savedZoom);
    preview.style.setProperty("--serverlist-account-icon-focus-x", `${nextFocusX}%`);
    preview.style.setProperty("--serverlist-account-icon-focus-y", `${nextFocusY}%`);
    preview.style.setProperty("--serverlist-account-icon-zoom", String(nextZoom));
    preview.style.setProperty("--serverlist-account-icon-size", `${nextZoom * 100}%`);

    if (!Number.isInteger(menuCharacterId) || menuCharacterId < 1 || currentCharacterId !== menuCharacterId) {
      return;
    }

    menuIconAnchors.forEach((anchor) => {
      anchor.style.setProperty("--serverlist-account-icon-focus-x", `${nextFocusX}%`);
      anchor.style.setProperty("--serverlist-account-icon-focus-y", `${nextFocusY}%`);
      anchor.style.setProperty("--serverlist-account-icon-zoom", String(nextZoom));
      anchor.style.setProperty("--serverlist-account-icon-size", `${nextZoom * 100}%`);
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

  function syncMenuIcons(imageUrl, focusXValue, focusYValue, zoomValue) {
    if (!Number.isInteger(menuCharacterId) || menuCharacterId < 1 || currentCharacterId !== menuCharacterId) {
      return;
    }

    const resolvedImageUrl = String(imageUrl || "").trim();
    const nextFocusX = clampPercent(focusXValue, savedFocusX);
    const nextFocusY = clampPercent(focusYValue, savedFocusY);
    const nextZoom = clampZoom(zoomValue, savedZoom);

    menuIconAnchors.forEach((anchor) => {
      anchor.style.setProperty("--serverlist-account-icon-focus-x", `${nextFocusX}%`);
      anchor.style.setProperty("--serverlist-account-icon-focus-y", `${nextFocusY}%`);
      anchor.style.setProperty("--serverlist-account-icon-zoom", String(nextZoom));
      anchor.style.setProperty("--serverlist-account-icon-size", `${nextZoom * 100}%`);
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

  function syncCharacterButtons(imageUrl, focusXValue, focusYValue, zoomValue) {
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
      button.dataset.currentZoom = String(clampZoom(zoomValue, savedZoom));
    });
  }

  function applyCharacterState(characterState = {}) {
    currentCharacterId = Number.parseInt(characterState.characterId || form.dataset.menuCharacterId || "", 10);
    currentCharacterName = String(characterState.characterName || form.dataset.characterName || "").trim();
    savedImageUrl = String(characterState.imageUrl || "").trim();
    savedFocusX = clampPercent(characterState.focusX, 50);
    savedFocusY = clampPercent(characterState.focusY, 50);
    savedZoom = clampZoom(characterState.zoom, 1);
    form.dataset.characterId = Number.isInteger(currentCharacterId) ? String(currentCharacterId) : "";
    form.dataset.characterName = currentCharacterName;
    form.dataset.currentImageUrl = savedImageUrl;
    form.dataset.currentFocusX = String(savedFocusX);
    form.dataset.currentFocusY = String(savedFocusY);
    form.dataset.currentZoom = String(savedZoom);

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
    if (zoomInput instanceof HTMLInputElement) {
      zoomInput.value = String(savedZoom);
    }
    syncIconStyles(savedFocusX, savedFocusY, savedZoom);
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
      focusY: buttonDataset.currentFocusY || form.dataset.currentFocusY,
      zoom: buttonDataset.currentZoom || form.dataset.currentZoom
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
      focusY: clampPercent(focusYInput?.value, savedFocusY),
      zoom: clampZoom(zoomInput?.value, savedZoom)
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
    syncIconStyles(focusXInput.value, focusYInput?.value, zoomInput?.value);
  });

  focusYInput?.addEventListener("input", () => {
    syncIconStyles(focusXInput?.value, focusYInput.value, zoomInput?.value);
  });

  zoomInput?.addEventListener("input", () => {
    syncIconStyles(focusXInput?.value, focusYInput?.value, zoomInput.value);
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
      savedZoom = clampZoom(responsePayload.zoom, savedZoom);
      form.dataset.currentImageUrl = savedImageUrl;
      form.dataset.currentFocusX = String(savedFocusX);
      form.dataset.currentFocusY = String(savedFocusY);
      form.dataset.currentZoom = String(savedZoom);
      syncCharacterButtons(savedImageUrl, savedFocusX, savedFocusY, savedZoom);
      syncMenuIcons(savedImageUrl, savedFocusX, savedFocusY, savedZoom);
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
    focusY: form.dataset.currentFocusY,
    zoom: form.dataset.currentZoom
  });
  syncMenuIcons(savedImageUrl, savedFocusX, savedFocusY, savedZoom);
})();
