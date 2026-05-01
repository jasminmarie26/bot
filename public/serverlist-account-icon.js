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
  const urlInput = form.elements.imageUrl;
  const fileInput = form.elements.iconFile;
  const focusXInput = form.elements.focusX;
  const focusYInput = form.elements.focusY;
  const userMenu = document.querySelector(".topbar-user-menu");
  const menuIconAnchors = Array.from(document.querySelectorAll("[data-serverlist-account-icon-anchor]"));
  const maxUploadBytes = 4 * 1024 * 1024;
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
    const resolvedImageUrl = String(imageUrl || "").trim();
    const nextFocusX = clampPercent(focusXValue, savedFocusX);
    const nextFocusY = clampPercent(focusYValue, savedFocusY);

    menuIconAnchors.forEach((anchor) => {
      anchor.style.setProperty("--serverlist-account-icon-focus-x", `${nextFocusX}%`);
      anchor.style.setProperty("--serverlist-account-icon-focus-y", `${nextFocusY}%`);

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

  function openModal() {
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
    button.addEventListener("click", openModal);
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
      const response = await fetch("/serverliste/account-icon", {
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

  syncMenuIcons(savedImageUrl, savedFocusX, savedFocusY);
})();
