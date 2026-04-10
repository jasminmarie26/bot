(() => {
  const colorRoot = document.querySelector("[data-character-color-root]");
  const backgroundColorRoot = document.querySelector("[data-character-background-color-root]");
  const colorText = document.getElementById("character-chat-color-text");
  const colorTrigger = document.getElementById("character-chat-color-trigger");
  const colorSwatch = document.getElementById("character-chat-color-swatch");
  const colorPreview = document.getElementById("character-chat-color-preview");
  const colorPanel = document.getElementById("character-chat-color-panel");
  const colorSurface = document.getElementById("character-chat-color-surface");
  const colorSurfaceHandle = document.getElementById("character-chat-color-surface-handle");
  const colorHue = document.getElementById("character-chat-color-hue");
  const colorHueHandle = document.getElementById("character-chat-color-hue-handle");
  const colorPanelSwatch = document.getElementById("character-chat-color-panel-swatch");
  const colorPanelValue = document.getElementById("character-chat-color-panel-value");
  const backgroundColorText = document.getElementById("character-chat-background-color-text");
  const backgroundColorTrigger = document.getElementById("character-chat-background-color-trigger");
  const backgroundColorSwatch = document.getElementById("character-chat-background-color-swatch");
  const backgroundColorPreview = document.getElementById("character-chat-background-color-preview");
  const backgroundColorPanel = document.getElementById("character-chat-background-color-panel");
  const backgroundColorSurface = document.getElementById("character-chat-background-color-surface");
  const backgroundColorSurfaceHandle = document.getElementById("character-chat-background-color-surface-handle");
  const backgroundColorHue = document.getElementById("character-chat-background-color-hue");
  const backgroundColorHueHandle = document.getElementById("character-chat-background-color-hue-handle");
  const backgroundColorPanelSwatch = document.getElementById("character-chat-background-color-panel-swatch");
  const backgroundColorPanelValue = document.getElementById("character-chat-background-color-panel-value");
  const chatInputBackgroundColorText = document.getElementById("character-chat-input-background-color-text");
  const chatInputBackgroundColorPicker = document.getElementById("character-chat-input-background-color-picker");
  const chatInputBackgroundColorPreview = document.getElementById("character-chat-input-background-color-preview");
  const chatOnlineListBackgroundColorText = document.getElementById(
    "character-chat-online-list-background-color-text"
  );
  const chatOnlineListBackgroundColorPicker = document.getElementById(
    "character-chat-online-list-background-color-picker"
  );
  const chatOnlineListBackgroundColorPreview = document.getElementById(
    "character-chat-online-list-background-color-preview"
  );
  const chatBackgroundInput = document.getElementById("character-chat-background-url");
  const chatBackgroundOpacityInput = document.getElementById("character-chat-background-opacity");
  const chatBackgroundOpacityValue = document.getElementById("character-chat-background-opacity-value");
  const chatBackgroundPreview = document.getElementById("character-chat-background-preview");
  const chatBackgroundPreviewName = document.getElementById("character-chat-background-preview-name");
  const chatBackgroundPreviewState = document.getElementById("character-chat-background-preview-state");
  const nameInput = document.querySelector('input[name="name"]');

  if (
    !colorRoot ||
    !backgroundColorRoot ||
    !colorText ||
    !colorTrigger ||
    !colorSwatch ||
    !colorPreview ||
    !colorPanel ||
    !colorSurface ||
    !colorSurfaceHandle ||
    !colorHue ||
    !colorHueHandle ||
    !colorPanelSwatch ||
    !colorPanelValue ||
    !backgroundColorText ||
    !backgroundColorTrigger ||
    !backgroundColorSwatch ||
    !backgroundColorPreview ||
    !backgroundColorPanel ||
    !backgroundColorSurface ||
    !backgroundColorSurfaceHandle ||
    !backgroundColorHue ||
    !backgroundColorHueHandle ||
    !backgroundColorPanelSwatch ||
    !backgroundColorPanelValue ||
    !chatBackgroundInput ||
    !chatBackgroundOpacityInput ||
    !chatBackgroundOpacityValue ||
    !chatBackgroundPreview ||
    !chatBackgroundPreviewName ||
    !chatBackgroundPreviewState
  ) {
    return;
  }

  let colorState = { h: 120, s: 0.24, v: 0.91 };
  let backgroundColorState = { h: 0, s: 0, v: 0.94 };

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const normalizeHexColor = (value) => {
    const normalized = String(value || "").trim().toUpperCase();
    return /^#[0-9A-F]{6}$/.test(normalized) ? normalized : "";
  };

  const normalizeBackgroundColor = (value) => normalizeHexColor(value) || "#EFEFEF";

  const normalizeBackgroundUrl = (value) => {
    const normalized = String(value || "").trim();
    return /^https?:\/\/.+/i.test(normalized) ? normalized : "";
  };

  const normalizeOpacity = (value) => clamp(Number.parseInt(String(value ?? "").trim(), 10) || 100, 0, 100);

  const rgbToHex = (rgb) =>
    `#${[rgb.r, rgb.g, rgb.b]
      .map((channel) => clamp(Math.round(channel), 0, 255).toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()}`;

  const hexToRgb = (hex, fallback = "#AEE7B7") => {
    const normalized = normalizeHexColor(hex) || fallback;
    return {
      r: Number.parseInt(normalized.slice(1, 3), 16),
      g: Number.parseInt(normalized.slice(3, 5), 16),
      b: Number.parseInt(normalized.slice(5, 7), 16)
    };
  };

  const getReadablePreviewTextColor = (hex) => {
    const { r, g, b } = hexToRgb(hex, "#EFEFEF");
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 150 ? "#1A1C20" : "#F4F5F7";
  };

  const rgbToHsv = ({ r, g, b }) => {
    const red = r / 255;
    const green = g / 255;
    const blue = b / 255;
    const max = Math.max(red, green, blue);
    const min = Math.min(red, green, blue);
    const delta = max - min;

    let hue = 0;
    if (delta > 0) {
      if (max === red) {
        hue = ((green - blue) / delta) % 6;
      } else if (max === green) {
        hue = (blue - red) / delta + 2;
      } else {
        hue = (red - green) / delta + 4;
      }
    }

    hue = Math.round(hue * 60);
    if (hue < 0) hue += 360;

    return {
      h: hue,
      s: max === 0 ? 0 : delta / max,
      v: max
    };
  };

  const hsvToRgb = ({ h, s, v }) => {
    const hue = ((h % 360) + 360) % 360;
    const chroma = v * s;
    const section = hue / 60;
    const x = chroma * (1 - Math.abs((section % 2) - 1));
    let red = 0;
    let green = 0;
    let blue = 0;

    if (section >= 0 && section < 1) {
      red = chroma;
      green = x;
    } else if (section < 2) {
      red = x;
      green = chroma;
    } else if (section < 3) {
      green = chroma;
      blue = x;
    } else if (section < 4) {
      green = x;
      blue = chroma;
    } else if (section < 5) {
      red = x;
      blue = chroma;
    } else {
      red = chroma;
      blue = x;
    }

    const match = v - chroma;
    return {
      r: (red + match) * 255,
      g: (green + match) * 255,
      b: (blue + match) * 255
    };
  };

  const positionFloatingColorPanel = (panel, trigger) => {
    if (!panel || panel.hidden || !trigger) {
      return;
    }

    const gap = 10;
    const triggerRect = trigger.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const panelWidth = Math.max(panelRect.width || 0, 240);
    const panelHeight = Math.max(panelRect.height || 0, 220);
    const maxLeft = Math.max(gap, window.innerWidth - panelWidth - gap);
    const left = Math.min(Math.max(gap, triggerRect.right - panelWidth), maxLeft);
    let top = triggerRect.bottom + gap;
    const maxTop = window.innerHeight - panelHeight - gap;

    if (top > maxTop) {
      top = Math.max(gap, triggerRect.top - panelHeight - gap);
    }

    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
  };

  const syncOpenColorPanels = () => {
    positionFloatingColorPanel(colorPanel, colorTrigger);
    positionFloatingColorPanel(backgroundColorPanel, backgroundColorTrigger);
  };

  const bindPointerDrag = (element, updateFn, onStart) => {
    element.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      onStart();
      updateFn(event);
      element.setPointerCapture(event.pointerId);

      const handlePointerMove = (moveEvent) => updateFn(moveEvent);

      const handlePointerEnd = () => {
        element.removeEventListener("pointermove", handlePointerMove);
        element.removeEventListener("pointerup", handlePointerEnd);
        element.removeEventListener("pointercancel", handlePointerEnd);
      };

      element.addEventListener("pointermove", handlePointerMove);
      element.addEventListener("pointerup", handlePointerEnd);
      element.addEventListener("pointercancel", handlePointerEnd);
    });
  };

  const setStateFromHex = (value, force = false) => {
    const normalized = normalizeHexColor(value);
    if (!normalized && !force) {
      return;
    }

    colorState = rgbToHsv(hexToRgb(normalized || "#AEE7B7"));
    renderColorState(true);
  };

  const setBackgroundColorStateFromHex = (value, force = false) => {
    const normalized = normalizeHexColor(value);
    if (!normalized && !force) {
      return;
    }

    backgroundColorState = rgbToHsv(hexToRgb(normalized || "#EFEFEF", "#EFEFEF"));
    renderBackgroundColorState(true);
  };

  const renderBackgroundPreview = () => {
    const normalizedUrl = normalizeBackgroundUrl(chatBackgroundInput.value);
    const normalizedName = String(nameInput?.value || "").trim();

    chatBackgroundPreviewName.textContent = `${normalizedName || "Dein Charakter"}:`;

    if (!normalizedUrl) {
      chatBackgroundPreview.classList.add("is-empty");
      chatBackgroundPreview.style.setProperty("--character-chat-background-image", "none");
      chatBackgroundPreviewState.textContent = chatBackgroundInput.value.trim()
        ? "Ungueltiger Link. Bitte http:// oder https:// verwenden."
        : "Kein Hintergrund gesetzt.";
      return;
    }

    chatBackgroundPreview.classList.remove("is-empty");
    chatBackgroundPreview.style.setProperty(
      "--character-chat-background-image",
      `url(${JSON.stringify(normalizedUrl)})`
    );
    chatBackgroundPreviewState.textContent = "So sieht dein Chat nach dem Speichern aus.";
  };

  const renderColorState = (forceText = true) => {
    const nextColor = rgbToHex(hsvToRgb(colorState));

    if (forceText) {
      colorText.value = nextColor;
    }

    colorSwatch.style.backgroundColor = nextColor;
    colorPreview.style.color = nextColor;
    colorPanelSwatch.style.backgroundColor = nextColor;
    colorPanelValue.textContent = nextColor;
    chatBackgroundPreviewName.style.color = nextColor;
    colorSurface.style.setProperty("--character-picker-hue", String(Math.round(colorState.h)));
    colorSurface.setAttribute(
      "aria-valuetext",
      `Saettigung ${Math.round(colorState.s * 100)} Prozent, Helligkeit ${Math.round(colorState.v * 100)} Prozent`
    );
    colorHue.setAttribute("aria-valuenow", String(Math.round(colorState.h)));
    colorSurfaceHandle.style.left = `${colorState.s * 100}%`;
    colorSurfaceHandle.style.top = `${(1 - colorState.v) * 100}%`;
    colorHueHandle.style.top = `${(colorState.h / 360) * 100}%`;
  };

  const updateEnhancedBackgroundPreview = () => {
    const normalizedColor = normalizeBackgroundColor(backgroundColorText.value);
    const normalizedUrl = normalizeBackgroundUrl(chatBackgroundInput.value);
    const normalizedOpacity = normalizeOpacity(chatBackgroundOpacityInput.value);
    const normalizedName = String(nameInput?.value || "").trim();

    chatBackgroundPreviewName.textContent = `${normalizedName || "Dein Charakter"}:`;
    chatBackgroundPreview.style.setProperty("--character-chat-background-color", normalizedColor);
    chatBackgroundPreview.style.setProperty(
      "--character-chat-background-image",
      normalizedUrl ? `url(${JSON.stringify(normalizedUrl)})` : "none"
    );
    chatBackgroundPreview.style.setProperty(
      "--character-chat-background-image-opacity",
      String(normalizedOpacity / 100)
    );
    chatBackgroundOpacityValue.textContent = `${normalizedOpacity}%`;
    chatBackgroundPreview.classList.toggle(
      "is-empty",
      !normalizedUrl && normalizedColor === "#EFEFEF" && normalizedOpacity === 100
    );

    if (chatBackgroundInput.value.trim() && !normalizedUrl) {
      chatBackgroundPreviewState.textContent = "Ungueltiger Link. Bitte http:// oder https:// verwenden.";
      return;
    }

    if (normalizedUrl) {
      chatBackgroundPreviewState.textContent = `Bild aktiv mit ${normalizedOpacity}% Deckkraft.`;
      return;
    }

    chatBackgroundPreviewState.textContent =
      normalizedColor === "#EFEFEF" ? "Standard-Hintergrund aktiv." : "Hintergrundfarbe aktiv.";
  };

  const renderBackgroundColorState = (forceText = true) => {
    const nextColor = rgbToHex(hsvToRgb(backgroundColorState));

    if (forceText) {
      backgroundColorText.value = nextColor;
    }

    backgroundColorSwatch.style.backgroundColor = nextColor;
    backgroundColorPreview.style.backgroundColor = nextColor;
    backgroundColorPreview.style.color = getReadablePreviewTextColor(nextColor);
    backgroundColorPanelSwatch.style.backgroundColor = nextColor;
    backgroundColorPanelValue.textContent = nextColor;
    backgroundColorSurface.style.setProperty("--character-picker-hue", String(Math.round(backgroundColorState.h)));
    backgroundColorSurface.setAttribute(
      "aria-valuetext",
      `Saettigung ${Math.round(backgroundColorState.s * 100)} Prozent, Helligkeit ${Math.round(backgroundColorState.v * 100)} Prozent`
    );
    backgroundColorHue.setAttribute("aria-valuenow", String(Math.round(backgroundColorState.h)));
    backgroundColorSurfaceHandle.style.left = `${backgroundColorState.s * 100}%`;
    backgroundColorSurfaceHandle.style.top = `${(1 - backgroundColorState.v) * 100}%`;
    backgroundColorHueHandle.style.top = `${(backgroundColorState.h / 360) * 100}%`;
    updateEnhancedBackgroundPreview();
  };

  const bindSimpleColorField = ({
    textInput,
    pickerInput,
    previewNode,
    fallback = "#EFEFEF"
  }) => {
    if (!textInput || !pickerInput || !previewNode) {
      return;
    }

    const render = (value, forceText = false) => {
      const normalized = normalizeBackgroundColor(value || fallback);
      if (forceText) {
        textInput.value = normalized;
      }
      pickerInput.value = normalized;
      previewNode.style.backgroundColor = normalized;
      previewNode.style.color = getReadablePreviewTextColor(normalized);
    };

    textInput.addEventListener("input", () => {
      const normalized = normalizeHexColor(textInput.value);
      if (normalized) {
        render(normalized);
      }
    });

    textInput.addEventListener("blur", () => {
      render(textInput.value, true);
    });

    pickerInput.addEventListener("input", () => {
      render(pickerInput.value, true);
    });

    render(textInput.value || fallback, true);
  };

  const openColorPanel = () => {
    colorPanel.hidden = false;
    colorTrigger.setAttribute("aria-expanded", "true");
    positionFloatingColorPanel(colorPanel, colorTrigger);
  };

  const closeColorPanel = () => {
    if (colorPanel.hidden) return;
    colorPanel.hidden = true;
    colorTrigger.setAttribute("aria-expanded", "false");
  };

  const openBackgroundColorPanel = () => {
    backgroundColorPanel.hidden = false;
    backgroundColorTrigger.setAttribute("aria-expanded", "true");
    positionFloatingColorPanel(backgroundColorPanel, backgroundColorTrigger);
  };

  const closeBackgroundColorPanel = () => {
    if (backgroundColorPanel.hidden) return;
    backgroundColorPanel.hidden = true;
    backgroundColorTrigger.setAttribute("aria-expanded", "false");
  };

  bindPointerDrag(colorSurface, (event) => {
    const rect = colorSurface.getBoundingClientRect();
    colorState.s = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    colorState.v = clamp(1 - (event.clientY - rect.top) / rect.height, 0, 1);
    renderColorState(true);
  }, openColorPanel);

  bindPointerDrag(colorHue, (event) => {
    const rect = colorHue.getBoundingClientRect();
    const nextHue = clamp((event.clientY - rect.top) / rect.height, 0, 1) * 360;
    colorState.h = nextHue >= 360 ? 359.999 : nextHue;
    renderColorState(true);
  }, openColorPanel);

  bindPointerDrag(backgroundColorSurface, (event) => {
    const rect = backgroundColorSurface.getBoundingClientRect();
    backgroundColorState.s = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    backgroundColorState.v = clamp(1 - (event.clientY - rect.top) / rect.height, 0, 1);
    renderBackgroundColorState(true);
  }, openBackgroundColorPanel);

  bindPointerDrag(backgroundColorHue, (event) => {
    const rect = backgroundColorHue.getBoundingClientRect();
    const nextHue = clamp((event.clientY - rect.top) / rect.height, 0, 1) * 360;
    backgroundColorState.h = nextHue >= 360 ? 359.999 : nextHue;
    renderBackgroundColorState(true);
  }, openBackgroundColorPanel);

  colorText.addEventListener("focus", openColorPanel);
  colorText.addEventListener("input", () => setStateFromHex(colorText.value));
  colorText.addEventListener("blur", () => setStateFromHex(colorText.value, true));
  backgroundColorText.addEventListener("focus", openBackgroundColorPanel);
  backgroundColorText.addEventListener("input", () => setBackgroundColorStateFromHex(backgroundColorText.value));
  backgroundColorText.addEventListener("blur", () => setBackgroundColorStateFromHex(backgroundColorText.value, true));
  backgroundColorTrigger.addEventListener("click", () => {
    if (backgroundColorPanel.hidden) {
      openBackgroundColorPanel();
    } else {
      closeBackgroundColorPanel();
    }
  });
  colorTrigger.addEventListener("click", () => {
    if (colorPanel.hidden) {
      openColorPanel();
    } else {
      closeColorPanel();
    }
  });
  chatBackgroundInput.addEventListener("input", updateEnhancedBackgroundPreview);
  chatBackgroundInput.addEventListener("blur", updateEnhancedBackgroundPreview);
  chatBackgroundInput.addEventListener("input", renderBackgroundPreview);
  chatBackgroundInput.addEventListener("blur", renderBackgroundPreview);
  chatBackgroundOpacityInput.addEventListener("input", updateEnhancedBackgroundPreview);
  nameInput?.addEventListener("input", renderBackgroundPreview);
  nameInput?.addEventListener("input", updateEnhancedBackgroundPreview);

  document.addEventListener("pointerdown", (event) => {
    if (colorRoot.contains(event.target) || backgroundColorRoot.contains(event.target)) {
      return;
    }
    closeColorPanel();
    closeBackgroundColorPanel();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeColorPanel();
      closeBackgroundColorPanel();
    }
  });

  window.addEventListener("resize", syncOpenColorPanels);
  window.addEventListener("scroll", syncOpenColorPanels, true);

  setStateFromHex(colorText.value, true);
  setBackgroundColorStateFromHex(backgroundColorText.value || "#EFEFEF", true);
  bindSimpleColorField({
    textInput: chatInputBackgroundColorText,
    pickerInput: chatInputBackgroundColorPicker,
    previewNode: chatInputBackgroundColorPreview
  });
  bindSimpleColorField({
    textInput: chatOnlineListBackgroundColorText,
    pickerInput: chatOnlineListBackgroundColorPicker,
    previewNode: chatOnlineListBackgroundColorPreview
  });
  renderBackgroundPreview();
})();
