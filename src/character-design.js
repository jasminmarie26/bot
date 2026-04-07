const path = require("path");

const GUESTBOOK_PAGE_SIZE = 12;
const DEFAULT_GUESTBOOK_PAGE_TEXT_COLOR = "#EED7AE";
const LEGACY_GUESTBOOK_PAGE_TEXT_COLOR = "#2B2B2B";
const GUESTBOOK_THEME_TEXT_COLORS = Object.freeze({
  "pergament-gold": "#EED7AE",
  rosenlack: "#F3CAD3",
  mondsilber: "#DCE5F2",
  elfenhain: "#D2EDBC",
  kupferpatina: "#D5E6DF",
  bernsteinfeuer: "#F1D09C",
  sternsamt: "#D9E1FF",
  winterglas: "#E4F2F6",
  tintenmeer: "#D0EEF4",
  "obsidian-ornament": "#E7D1A3",
  "transparent-pur": "#F4F7FB"
});
const GUESTBOOK_CENSOR_OPTIONS = new Set(["none", "ab18", "sexual"]);
const GUESTBOOK_PAGE_STYLE_OPTIONS = new Set(["scroll", "book"]);
const GUESTBOOK_THEME_STYLE_OPTIONS = new Set([
  "pergament-gold",
  "rosenlack",
  "mondsilber",
  "elfenhain",
  "kupferpatina",
  "bernsteinfeuer",
  "sternsamt",
  "winterglas",
  "tintenmeer",
  "obsidian-ornament",
  "transparent-pur"
]);
const GUESTBOOK_FONT_OPTIONS = Object.freeze([
  { id: "default", label: "Default" },
  { id: "serif", label: "Serif" },
  { id: "sans", label: "Sans" },
  { id: "mono", label: "Mono" },
  { id: "audiowide", label: "Audiowide" },
  { id: "berkshire-swash", label: "Berkshire Swash" },
  { id: "cardo", label: "Cardo" },
  { id: "della-respira", label: "Della Respira" },
  { id: "flamenco", label: "Flamenco" },
  { id: "indie-flower", label: "Indie Flower" },
  { id: "josefin-slab", label: "Josefin Slab" },
  { id: "kelly-slab", label: "Kelly Slab" },
  { id: "medieval-sharp", label: "MedievalSharp" },
  { id: "old-standard-tt", label: "Old Standard TT" },
  { id: "russo-one", label: "Russo One" },
  { id: "sunshiney", label: "Sunshiney" },
  { id: "altdeutsch", label: "Altdeutsch (Unifraktur)" },
  { id: "altdeutsch-royal", label: "Altdeutsch Royal" },
  { id: "jedi", label: "Jedi Schrift" },
  { id: "jedi-tech", label: "Jedi Tech" },
  { id: "elfisch", label: "Elfenschrift" },
  { id: "elfisch-rune", label: "Elfenschrift Runen" },
  { id: "magie", label: "Magie Script" },
  { id: "vintage-fantasy", label: "Vintage Fantasy" }
]);
const GUESTBOOK_BBCODE_FONT_STYLES = Object.freeze({
  default: "font-family:var(--font-ui);",
  serif: "font-family:\"Cardo\", \"Times New Roman\", serif;",
  sans: "font-family:var(--font-ui);",
  mono: "font-family:\"Consolas\", \"Courier New\", monospace;",
  audiowide: "font-family:\"Audiowide\", \"Trebuchet MS\", sans-serif;",
  "berkshire-swash": "font-family:\"Berkshire Swash\", \"Palatino Linotype\", serif;",
  cardo: "font-family:\"Cardo\", \"Times New Roman\", serif;",
  "della-respira": "font-family:\"Della Respira\", \"Palatino Linotype\", serif;",
  flamenco: "font-family:\"Flamenco\", var(--font-ui);",
  "indie-flower": "font-family:\"Indie Flower\", \"Comic Sans MS\", cursive;",
  "josefin-slab": "font-family:\"Josefin Slab\", \"Georgia\", serif;",
  "kelly-slab": "font-family:\"Kelly Slab\", var(--font-ui);",
  "medieval-sharp": "font-family:\"MedievalSharp\", \"Cinzel\", serif;",
  "old-standard-tt": "font-family:\"Old Standard TT\", \"Times New Roman\", serif;",
  "russo-one": "font-family:\"Russo One\", \"Arial Black\", sans-serif;",
  sunshiney: "font-family:\"Sunshiney\", \"Comic Sans MS\", cursive;",
  altdeutsch: "font-family:\"UnifrakturCook\", \"Old English Text MT\", serif;",
  "altdeutsch-royal": "font-family:\"Pirata One\", \"Cinzel\", serif;",
  jedi: "font-family:\"Poller One\", \"Russo One\", sans-serif;letter-spacing:0.02em;",
  "jedi-tech": "font-family:\"Orbitron\", \"Audiowide\", sans-serif;letter-spacing:0.02em;",
  elfisch: "font-family:\"Cinzel Decorative\", \"Cinzel\", serif;",
  "elfisch-rune": "font-family:\"Metamorphous\", \"Cinzel\", serif;",
  magie: "font-family:\"Great Vibes\", \"Berkshire Swash\", cursive;",
  "vintage-fantasy": "font-family:\"IM Fell English SC\", \"Old Standard TT\", serif;"
});
const BBCODE_FONT_SAFE_FAMILY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 '&-]*$/i;
const BBCODE_1001FREEFONTS_BASE_URL = "https://www.1001freefonts.com";
const BBCODE_1001FREEFONTS_CACHE_ROOT = path.join(__dirname, "..", "data", "bbcode-font-cache");
const BBCODE_1001FREEFONTS_MISS_TTL_MS = 6 * 60 * 60 * 1000;
const BBCODE_1001FREEFONTS_MAX_ZIP_SIZE_BYTES = 15 * 1024 * 1024;
const BBCODE_1001FREEFONTS_FORMAT_BY_EXTENSION = Object.freeze({
  ".woff2": "woff2",
  ".woff": "woff",
  ".otf": "opentype",
  ".ttf": "truetype"
});
const BBCODE_1001FREEFONTS_EXTENSION_PRIORITY = Object.freeze([".woff2", ".woff", ".otf", ".ttf"]);
const GUESTBOOK_FONT_STYLE_OPTIONS = new Set(
  GUESTBOOK_FONT_OPTIONS.map((option) => option.id)
);

function normalizeGuestbookColor(rawColor) {
  const prepared = String(rawColor || "").trim();
  if (/^#[0-9a-f]{6}$/i.test(prepared)) {
    return prepared.toUpperCase();
  }
  return "#AEE7B7";
}

function normalizeOptionalGuestbookPageColor(rawColor) {
  const prepared = String(rawColor || "").trim();
  if (!prepared) {
    return "";
  }
  if (/^#[0-9a-f]{6}$/i.test(prepared) || /^#[0-9a-f]{8}$/i.test(prepared)) {
    return prepared.toUpperCase();
  }
  return "";
}

function normalizeGuestbookOption(input, allowedValues, fallback) {
  const value = String(input || "").trim().toLowerCase();
  return allowedValues.has(value) ? value : fallback;
}

function normalizeGuestbookOpacity(input, fallback = 100) {
  const value = Number.parseInt(String(input ?? "").trim(), 10);
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(100, Math.max(0, value));
}

function resolveGuestbookPageTextColor(rawColor, themeStyle) {
  const normalizedColor = normalizeGuestbookColor(rawColor);
  if (normalizedColor && normalizedColor !== LEGACY_GUESTBOOK_PAGE_TEXT_COLOR) {
    return normalizedColor;
  }

  const normalizedThemeStyle = String(themeStyle || "").trim().toLowerCase();
  return GUESTBOOK_THEME_TEXT_COLORS[normalizedThemeStyle] || DEFAULT_GUESTBOOK_PAGE_TEXT_COLOR;
}

module.exports = {
  BBCODE_1001FREEFONTS_BASE_URL,
  BBCODE_1001FREEFONTS_CACHE_ROOT,
  BBCODE_1001FREEFONTS_EXTENSION_PRIORITY,
  BBCODE_1001FREEFONTS_FORMAT_BY_EXTENSION,
  BBCODE_1001FREEFONTS_MAX_ZIP_SIZE_BYTES,
  BBCODE_1001FREEFONTS_MISS_TTL_MS,
  BBCODE_FONT_SAFE_FAMILY_PATTERN,
  DEFAULT_GUESTBOOK_PAGE_TEXT_COLOR,
  GUESTBOOK_BBCODE_FONT_STYLES,
  GUESTBOOK_CENSOR_OPTIONS,
  GUESTBOOK_FONT_OPTIONS,
  GUESTBOOK_FONT_STYLE_OPTIONS,
  GUESTBOOK_PAGE_SIZE,
  GUESTBOOK_PAGE_STYLE_OPTIONS,
  GUESTBOOK_THEME_STYLE_OPTIONS,
  GUESTBOOK_THEME_TEXT_COLORS,
  LEGACY_GUESTBOOK_PAGE_TEXT_COLOR,
  normalizeGuestbookColor,
  normalizeGuestbookOpacity,
  normalizeGuestbookOption,
  normalizeOptionalGuestbookPageColor,
  resolveGuestbookPageTextColor
};
