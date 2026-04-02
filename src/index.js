require("dotenv").config();

const fs = require("fs");
const path = require("path");
const http = require("http");
const express = require("express");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const PDFDocument = require("pdfkit");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const FacebookStrategy = require("passport-facebook").Strategy;
const Database = require("better-sqlite3");
const { Server } = require("socket.io");
const {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun
} = require("docx");
const db = require("./db");
const CHAT_ROOM_COLUMN_NAMES = new Set(
  db
    .prepare("PRAGMA table_info(chat_rooms)")
    .all()
    .map((column) => String(column?.name || "").trim())
    .filter(Boolean)
);

function hasChatRoomColumn(columnName) {
  return CHAT_ROOM_COLUMN_NAMES.has(String(columnName || "").trim());
}

const THEME_OPTIONS = [
  { id: "glass-aurora", label: "Glass Aurora" },
  { id: "glass-noir", label: "Glass Noir" },
  { id: "glass-sunset", label: "Glass Sunset" },
  { id: "future", label: "Future" },
  { id: "paper-ink", label: "Paper Ink" },
  { id: "windows-xp", label: "Windows XP" },
  { id: "atari", label: "Atari" },
  { id: "sith", label: "Sith" },
  { id: "jedi", label: "Jedi" },
  { id: "larp", label: "LARP" }
];
const SERVER_OPTIONS = [
  { id: "free-rp", label: "FREE-RP" },
  { id: "erp", label: "ERP" }
];
const GUESTBOOK_PAGE_SIZE = 12;
const DEFAULT_GUESTBOOK_PAGE_TEXT_COLOR = "#2B2B2B";
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
  "obsidian-ornament"
]);
const GUESTBOOK_FONT_OPTIONS = [
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
];
const BIRTHDAY_GREETING_OPENERS = [
  "Herzlichen Glückwunsch zum Geburtstag, {name}!",
  "Alles Liebe zum Geburtstag, {name}!",
  "Heute feiern wir dich, {name}!",
  "Ein strahlender Geburtstagsgruß für dich, {name}!",
  "Geburtstagspost für dich, {name}!",
  "Ein großes Hurra für dich, {name}!",
  "Zeit für Konfetti und gute Laune, {name}!",
  "Heute gehört die Bühne dir, {name}!",
  "Ein besonderer Tag für einen besonderen Menschen: {name}!",
  "Geburtstagsalarm für {name}!"
];
const BIRTHDAY_GREETING_WISHES = [
  "Wir wünschen dir Gesundheit, Freude und ganz viele schöne Momente.",
  "Möge dein neues Lebensjahr voller Licht, Mut und Lieblingsszenen sein.",
  "Für dein neues Lebensjahr schicken wir dir ganz viel Wärme und gute Energie.",
  "Wir wünschen dir einen Tag voller Lachen, lieber Worte und kleiner Wunder.",
  "Möge heute alles ein kleines bisschen heller, leichter und schöner sein.",
  "Wir wünschen dir Zeit für Herzensmenschen, gute Gedanken und tolle Abenteuer.",
  "Für dein neues Lebensjahr wünschen wir dir Kraft, Glück und ganz viel Sonnenschein.",
  "Möge dein Tag nach Freude klingen und dein neues Jahr nach Zuversicht schmecken.",
  "Wir wünschen dir viele Gründe zum Lachen und nur die besten Geschichten.",
  "Für heute und das kommende Jahr schicken wir dir eine Extraportion Freude mit."
];
const BIRTHDAY_GREETING_SIGNOFFS = [
  "Das ganze Heldenhafte Reisen Team denkt heute an dich und drückt dich ganz fest aus der Ferne.",
  "Vom ganzen Heldenhafte Reisen Team kommen heute die herzlichsten Geburtstagswünsche direkt zu dir."
];
const BIRTHDAY_NOTIFICATION_TYPE = "birthday_greeting";
const BIRTHDAY_NOTIFICATION_TITLE = "Geburtstagsgrüße vom Heldenhafte Reisen Team";
const BIRTHDAY_NOTIFICATION_DECORATION = "🎉 🎂 ✨";
const GUESTBOOK_FONT_STYLE_OPTIONS = new Set(
  GUESTBOOK_FONT_OPTIONS.map((option) => option.id)
);
const DEFAULT_THEME = "glass-aurora";
const ALLOWED_THEME_IDS = new Set(THEME_OPTIONS.map((theme) => theme.id));
const THEME_COOKIE_NAME = "theme_preference";
const THEME_COOKIE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 365 * 2;
const DEFAULT_SERVER_ID = "free-rp";
const ALLOWED_SERVER_IDS = new Set(SERVER_OPTIONS.map((server) => server.id));
const DEFAULT_HOME_HERO_TITLE = "Heldenhaft Reisen";
const DEFAULT_HOME_HERO_BODY =
  "Aktuelle Neuigkeiten findest du oben über den Live-Updates-Tab im Header. Dort können Admins und Moderatoren neue Meldungen direkt veröffentlichen und bearbeiten.";
const DEFAULT_UPDATES_TITLE = "Live Updates";
const ROOM_EMPTY_DELETE_DELAY_MS = 0;
const AUTO_DELETE_EMPTY_ROOMS = false;
const ROOM_INVITE_TTL_MS = 1000 * 60 * 10;
const ROOM_INVITE_ACCESS_TTL_MS = 1000 * 60 * 60 * 3;
const APP_BASE_URL = String(process.env.APP_BASE_URL || "")
  .trim()
  .replace(/\/+$/, "");
const LEGAL_OPERATOR_NAME = "Jasmin Beyer";
const LEGAL_OPERATOR_STREET = "Sternstraße 98";
const LEGAL_OPERATOR_CITY = "06886 Lutherstadt Wittenberg";
const LEGAL_CONTACT_NAME = "Heldenhaft Reisen";
const LEGAL_CONTACT_EMAIL = "admin@heldenhaftereisen.net";
const LEGAL_CONTACT_FORWARD_EMAIL = "jasmin.marie87@t-online.de";
const GOOGLE_CLIENT_ID = String(process.env.GOOGLE_CLIENT_ID || "").trim();
const GOOGLE_CLIENT_SECRET = String(process.env.GOOGLE_CLIENT_SECRET || "").trim();
const FACEBOOK_APP_ID = String(process.env.FACEBOOK_APP_ID || "").trim();
const FACEBOOK_APP_SECRET = String(process.env.FACEBOOK_APP_SECRET || "").trim();
const GOOGLE_CALLBACK_PATH = "/auth/google/callback";
const FACEBOOK_CALLBACK_PATH = "/auth/facebook/callback";

function normalizeOAuthCallbackUrl(value, fallbackPath) {
  const rawValue = String(value || "").trim();
  const candidate = rawValue || fallbackPath;
  if (!candidate) return "";
  if (/^https?:\/\//i.test(candidate)) {
    return candidate.replace(/\/+$/, "");
  }

  if (candidate.startsWith("/")) {
    return candidate;
  }

  return `/${candidate.replace(/^\/+/, "")}`;
}

function getOAuthDisplayCallbackUrl(callbackUrl) {
  const normalized = String(callbackUrl || "").trim();
  if (!normalized) return "";
  if (/^https?:\/\//i.test(normalized)) return normalized;
  if (!APP_BASE_URL) return normalized;
  return `${APP_BASE_URL}${normalized}`;
}

function getLegalMeta() {
  return {
    siteName: "Heldenhafte Reisen",
    appBaseUrl: APP_BASE_URL || "https://heldenhaftereisen.net",
    operatorName: LEGAL_OPERATOR_NAME,
    operatorStreet: LEGAL_OPERATOR_STREET,
    operatorCity: LEGAL_OPERATOR_CITY,
    contactName: LEGAL_CONTACT_NAME,
    contactEmail: LEGAL_CONTACT_EMAIL,
    contactForwardEmail: LEGAL_CONTACT_FORWARD_EMAIL
  };
}

function buildOAuthProviderStatus(label, clientId, clientSecret, callbackUrl) {
  const missing = [];
  if (!clientId) missing.push("Client ID");
  if (!clientSecret) missing.push("Client Secret");

  return {
    label,
    enabled: Boolean(clientId && clientSecret),
    callbackUrl,
    displayCallbackUrl: getOAuthDisplayCallbackUrl(callbackUrl),
    missing
  };
}

function formatOAuthMissingFields(missingFields) {
  if (!Array.isArray(missingFields) || missingFields.length === 0) {
    return "";
  }

  if (missingFields.length === 1) {
    return missingFields[0];
  }

  if (missingFields.length === 2) {
    return `${missingFields[0]} und ${missingFields[1]}`;
  }

  return `${missingFields.slice(0, -1).join(", ")} und ${missingFields[missingFields.length - 1]}`;
}

function getOAuthDisabledMessage(providerStatus) {
  if (!providerStatus?.missing?.length) {
    return `${providerStatus?.label || "OAuth"} Login ist noch nicht eingerichtet.`;
  }

  return `${providerStatus.label} Login ist noch nicht eingerichtet. Es fehlen ${formatOAuthMissingFields(providerStatus.missing)}.`;
}

const GOOGLE_CALLBACK_URL = normalizeOAuthCallbackUrl(
  process.env.GOOGLE_CALLBACK_URL,
  GOOGLE_CALLBACK_PATH
);
const FACEBOOK_CALLBACK_URL = normalizeOAuthCallbackUrl(
  process.env.FACEBOOK_CALLBACK_URL,
  FACEBOOK_CALLBACK_PATH
);
const OAUTH_PROVIDERS = {
  google: buildOAuthProviderStatus(
    "Google",
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_CALLBACK_URL
  ),
  facebook: buildOAuthProviderStatus(
    "Facebook",
    FACEBOOK_APP_ID,
    FACEBOOK_APP_SECRET,
    FACEBOOK_CALLBACK_URL
  )
};
const GOOGLE_AUTH_ENABLED = OAUTH_PROVIDERS.google.enabled;
const FACEBOOK_AUTH_ENABLED = OAUTH_PROVIDERS.facebook.enabled;
const SMTP_HOST = String(process.env.SMTP_HOST || "").trim();
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE = String(process.env.SMTP_SECURE || "false").toLowerCase() === "true";
const SMTP_USER = String(process.env.SMTP_USER || "").trim();
const SMTP_PASS = String(process.env.SMTP_PASS || "");
const MAIL_FROM = String(process.env.MAIL_FROM || SMTP_USER || "").trim();
const SMTP_AUTH_ENABLED = Boolean(SMTP_USER && SMTP_PASS);
const EMAIL_VERIFICATION_MAIL_ENABLED =
  Boolean(SMTP_HOST && Number.isFinite(SMTP_PORT) && SMTP_PORT > 0 && MAIL_FROM) &&
  (SMTP_AUTH_ENABLED || (!SMTP_USER && !SMTP_PASS));
const TURNSTILE_SITE_KEY = String(
  process.env.TURNSTILE_SITE_KEY || process.env.TURNSTILE_SITEKEY || ""
).trim();
const TURNSTILE_SECRET_KEY = String(process.env.TURNSTILE_SECRET_KEY || "").trim();
const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const REGISTRATION_CAPTCHA_ENABLED = Boolean(TURNSTILE_SITE_KEY && TURNSTILE_SECRET_KEY);
const REGISTRATION_CAPTCHA_ACTION = "register";
const OAUTH_CAPTCHA_ACTION = "oauth-start";
const REGISTRATION_CAPTCHA_TIMEOUT_MS = 8000;
const HUMAN_VERIFICATION_CHALLENGE_LENGTH = 5;
const HUMAN_VERIFICATION_MAX_AGE_MS = 1000 * 60 * 10;
const HUMAN_VERIFICATION_CHARSET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
let verificationMailer = null;
const USERNAME_PATTERN = /^[\p{L}0-9_.+\- ]{3,24}$/u;
const USERNAME_CHANGE_COOLDOWN_DAYS = 182;
const USERNAME_CHANGE_COOLDOWN_MS = USERNAME_CHANGE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
const CHARACTER_RENAME_COOLDOWN_MONTHS = 3;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REGISTRATION_FORM_MIN_AGE_MS = 3500;
const REGISTRATION_FORM_MAX_AGE_MS = 1000 * 60 * 60 * 6;
const REGISTRATION_MAX_REQUESTS_PER_MINUTE = 3;
const REGISTRATION_MAX_REQUESTS_PER_10_MINUTES = 8;
const REGISTRATION_MAX_ATTEMPTS_PER_HOUR = 6;
const REGISTRATION_MAX_SUCCESSES_PER_DAY = 3;
const PASSWORD_RESET_TOKEN_LIFETIME_HOURS = 2;
const STATIC_ASSET_VERSION = Date.now().toString(36);
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "10minutemail.com",
  "10minutemail.net",
  "20minutemail.com",
  "dispostable.com",
  "emailondeck.com",
  "fakeinbox.com",
  "guerrillamail.com",
  "guerrillamailblock.com",
  "guerrillamail.net",
  "guerrillamail.org",
  "maildrop.cc",
  "mailinator.com",
  "mohmal.com",
  "sharklasers.com",
  "temp-mail.org",
  "temp-mail.io",
  "tempmailo.com",
  "throwawaymail.com",
  "yopmail.com"
]);
for (const extraDomain of String(process.env.BLOCKED_EMAIL_DOMAINS || "").split(",")) {
  const normalizedDomain = extraDomain.trim().toLowerCase();
  if (normalizedDomain) {
    DISPOSABLE_EMAIL_DOMAINS.add(normalizedDomain);
  }
}

function normalizeTheme(themeValue) {
  const input = (themeValue || "").trim().toLowerCase();
  return ALLOWED_THEME_IDS.has(input) ? input : DEFAULT_THEME;
}

function getCookieValue(req, cookieName) {
  const rawCookieHeader = String(req.headers.cookie || "");
  if (!rawCookieHeader) return "";

  for (const cookieChunk of rawCookieHeader.split(";")) {
    const trimmedChunk = cookieChunk.trim();
    if (!trimmedChunk) continue;

    const separatorIndex = trimmedChunk.indexOf("=");
    if (separatorIndex < 0) continue;

    const name = trimmedChunk.slice(0, separatorIndex).trim();
    if (name !== cookieName) continue;

    const value = trimmedChunk.slice(separatorIndex + 1).trim();
    try {
      return decodeURIComponent(value);
    } catch (error) {
      return value;
    }
  }

  return "";
}

function getThemeCookie(req) {
  const themeValue = (getCookieValue(req, THEME_COOKIE_NAME) || "").trim().toLowerCase();
  return ALLOWED_THEME_IDS.has(themeValue) ? themeValue : "";
}

function setThemeCookie(res, theme) {
  res.cookie(THEME_COOKIE_NAME, theme, {
    httpOnly: false,
    maxAge: THEME_COOKIE_MAX_AGE_MS,
    sameSite: "lax"
  });
}

function normalizeServer(serverValue) {
  const input = (serverValue || "").trim().toLowerCase();
  return ALLOWED_SERVER_IDS.has(input) ? input : DEFAULT_SERVER_ID;
}

function normalizeFestplayDashboardMode(value) {
  return String(value || "").trim().toLowerCase() === "main" ? "main" : "festplay";
}

function parseRequestedFestplayDashboardMode(value) {
  const input = String(value || "").trim().toLowerCase();
  return input === "main" || input === "festplay" ? input : "";
}

function getServerLabel(serverId) {
  const normalized = normalizeServer(serverId);
  const found = SERVER_OPTIONS.find((server) => server.id === normalized);
  return found?.label || "FREE-RP";
}

function normalizePreferredCharacterMap(value) {
  const normalized = {};
  if (!value || typeof value !== "object") {
    return normalized;
  }

  for (const server of SERVER_OPTIONS) {
    const candidate = Number(value?.[server.id]);
    if (Number.isInteger(candidate) && candidate > 0) {
      normalized[server.id] = candidate;
    }
  }

  return normalized;
}

function getPreferredCharacterIdFromSession(req, serverId = DEFAULT_SERVER_ID) {
  const normalizedServerId = normalizeServer(serverId);
  const preferredMap = normalizePreferredCharacterMap(req.session?.preferred_character_ids);
  req.session.preferred_character_ids = preferredMap;
  return preferredMap[normalizedServerId] || null;
}

function rememberPreferredCharacter(req, character) {
  const parsedCharacterId = Number(character?.id);
  if (!Number.isInteger(parsedCharacterId) || parsedCharacterId < 1) return;
  const characterOwnerId = Number(character?.user_id);
  if (
    Number.isInteger(characterOwnerId) &&
    characterOwnerId !== Number(req.session?.user?.id)
  ) {
    return;
  }

  const normalizedServerId = normalizeServer(character.server_id);
  const preferredMap = normalizePreferredCharacterMap(req.session?.preferred_character_ids);
  preferredMap[normalizedServerId] = parsedCharacterId;
  req.session.preferred_character_ids = preferredMap;
}

function getStaffCharacterUsageForUser(user, character) {
  const parsedCharacterId = Number(character?.id);
  const canUseAdmin = Boolean(user?.is_admin);
  const canUseModerator = Boolean(user?.is_moderator);

  return {
    canUseAdmin,
    canUseModerator,
    isAdminCharacterSelected:
      canUseAdmin && Number.isInteger(parsedCharacterId) && parsedCharacterId > 0
        ? Number(user?.admin_character_id) === parsedCharacterId
        : false,
    isModeratorCharacterSelected:
      canUseModerator && Number.isInteger(parsedCharacterId) && parsedCharacterId > 0
        ? Number(user?.moderator_character_id) === parsedCharacterId
        : false
  };
}

function updateUserRoleCharacterSelection(user, characterId, payload = {}) {
  const parsedUserId = Number(user?.id);
  const parsedCharacterId = Number(characterId);
  const safePayload = payload || {};
  if (!Number.isInteger(parsedUserId) || parsedUserId < 1) {
    return null;
  }
  if (!Number.isInteger(parsedCharacterId) || parsedCharacterId < 1) {
    return getUserForSessionById(parsedUserId);
  }

  const hasAdminCharacterField = Object.prototype.hasOwnProperty.call(safePayload, "use_as_admin_character");
  const hasModeratorCharacterField = Object.prototype.hasOwnProperty.call(
    safePayload,
    "use_as_moderator_character"
  );
  const useAsAdminCharacter = safePayload.use_as_admin_character === "1";
  const useAsModeratorCharacter = safePayload.use_as_moderator_character === "1";
  const currentAdminCharacterId = Number(user?.admin_character_id);
  const currentModeratorCharacterId = Number(user?.moderator_character_id);

  if (user?.is_admin && hasAdminCharacterField) {
    if (useAsAdminCharacter) {
      db.prepare("UPDATE users SET admin_character_id = ? WHERE id = ?").run(parsedCharacterId, parsedUserId);
    } else if (currentAdminCharacterId === parsedCharacterId) {
      db.prepare("UPDATE users SET admin_character_id = NULL WHERE id = ?").run(parsedUserId);
    }
  }

  if (user?.is_moderator && hasModeratorCharacterField) {
    if (useAsModeratorCharacter) {
      db.prepare("UPDATE users SET moderator_character_id = ? WHERE id = ?").run(parsedCharacterId, parsedUserId);
    } else if (currentModeratorCharacterId === parsedCharacterId) {
      db.prepare("UPDATE users SET moderator_character_id = NULL WHERE id = ?").run(parsedUserId);
    }
  }

  return getUserForSessionById(parsedUserId);
}

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const dataDir = path.join(__dirname, "..", "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const sessionsDbPath = path.join(dataDir, "sessions.sqlite");

function getAcmeChallengeRoots() {
  const appRoot = path.join(__dirname, "..");
  const candidateRoots = [
    path.join(process.cwd(), ".well-known", "acme-challenge"),
    path.join(process.cwd(), "htdocs", ".well-known", "acme-challenge"),
    path.join(process.cwd(), "httpdocs", ".well-known", "acme-challenge"),
    path.join(appRoot, ".well-known", "acme-challenge"),
    path.join(appRoot, "htdocs", ".well-known", "acme-challenge"),
    path.join(appRoot, "httpdocs", ".well-known", "acme-challenge"),
    path.join(appRoot, "..", "htdocs", ".well-known", "acme-challenge"),
    path.join(appRoot, "..", "httpdocs", ".well-known", "acme-challenge")
  ];

  return Array.from(new Set(candidateRoots.map((candidate) => path.resolve(candidate))));
}

const ACME_CHALLENGE_ROOTS = getAcmeChallengeRoots();
const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30;
const SESSION_TAB_IDLE_TIMEOUT_MS = 1000 * 60 * 20;
const SESSION_COOKIE_NAME = "connect.sid";
const SESSION_STORE_CLEANUP_INTERVAL_MS = 1000 * 60;
const FESTPLAY_INACTIVITY_MONTHS = 6;
const FESTPLAY_INACTIVITY_SQL_OFFSET = `-${FESTPLAY_INACTIVITY_MONTHS} months`;
const FESTPLAY_INACTIVITY_CLEANUP_INTERVAL_MS = 1000 * 60 * 60;
const LOGIN_STATS_CACHE_TTL_MS = 10 * 1000;
let cachedLoginStats = null;
let cachedLoginStatsExpiresAt = 0;
let inactiveFestplayCleanupRunning = false;
const DEFAULT_SEO_DESCRIPTION =
  "Heldenhafte Reisen ist eine deutschsprachige Rollenspielplattform mit Charakteren, Räumen, Festspielen, Live Updates und gemeinschaftlichem Schreiben.";
const DEFAULT_SEO_IMAGE_PATH = "/apple-touch-icon-hr.png";
const SEO_DESCRIPTION_BY_PATH = {
  "/":
    "Heldenhafte Reisen ist eine deutschsprachige Rollenspielplattform mit Charakteren, Räumen, Festspielen, Live Updates und gemeinschaftlichem Schreiben.",
  "/community-regeln":
    "Lies die Community-Regeln von Heldenhafte Reisen und erfahre, wie das gemeinsame Rollenspiel auf der Plattform organisiert ist.",
  "/datenschutz":
    "Datenschutzinformationen von Heldenhafte Reisen mit allen wichtigen Angaben zur Verarbeitung personenbezogener Daten.",
  "/help":
    "Die Hilfe von Heldenhafte Reisen erklärt die wichtigsten Bereiche, Einstellungen und Chatbefehle übersichtlich an einem Ort.",
  "/impressum":
    "Impressum von Heldenhafte Reisen mit den rechtlichen Pflichtangaben und den öffentlichen Kontaktinformationen der Plattform.",
  "/kontakt":
    "Kontaktiere Heldenhafte Reisen direkt über das Kontaktformular, wenn du Fragen, Hinweise oder Unterstützung brauchst.",
  "/live-updates":
    "In den Live Updates von Heldenhafte Reisen siehst du aktuelle Neuerungen, Hinweise und Änderungen der Plattform.",
  "/register":
    "Registriere dich bei Heldenhafte Reisen und starte mit deinem Account auf der Rollenspielplattform."
};
const SEO_SITEMAP_PATHS = [
  "/",
  "/community-regeln",
  "/datenschutz",
  "/help",
  "/impressum",
  "/kontakt",
  "/live-updates",
  "/register"
];
const NOINDEX_PATH_PREFIXES = [
  "/account",
  "/admin",
  "/auth",
  "/character-backups",
  "/chat",
  "/dashboard",
  "/logout",
  "/members",
  "/session",
  "/staff"
];

const sessionMiddleware = session({
  store: new SQLiteStore({
    db: "sessions.sqlite",
    dir: dataDir
  }),
  secret: process.env.SESSION_SECRET || "change-me-in-production",
  resave: false,
  rolling: true,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: SESSION_MAX_AGE_MS,
    sameSite: "lax"
  }
});

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "..", "views"));
app.use(express.urlencoded({ extended: false }));
app.get("/healthz", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({
    ok: true,
    uptime_seconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString()
  });
});
for (const acmeChallengeRoot of ACME_CHALLENGE_ROOTS) {
  app.use(
    "/.well-known/acme-challenge",
    express.static(acmeChallengeRoot, {
      fallthrough: true,
      index: false,
      redirect: false,
      etag: false,
      maxAge: 0
    })
  );
}
app.use(express.static(path.join(__dirname, "..", "public")));
app.use(sessionMiddleware);
app.use((req, res, next) => {
  if (isSessionTabHeartbeatExpired(req.session)) {
    return respondToInactiveSession(req, res);
  }

  markSessionTabHeartbeat(req.session);

  if (req.session?.user) {
    req.session.cookie.maxAge = getSessionMaxAgeForUser(req.session.user);
  }
  next();
});
app.use(passport.initialize());

function setFlash(req, type, text) {
  req.session.flash = { type, text };
}

function clearLoginStatsCache() {
  cachedLoginStats = null;
  cachedLoginStatsExpiresAt = 0;
}

function collectActiveSessionUserIds(options = {}) {
  const shouldDeleteInactive = options.deleteInactive !== false;
  const now = Date.now();
  let sessionsDb;
  try {
    sessionsDb = new Database(sessionsDbPath, {
      fileMustExist: true,
      timeout: 1000
    });
  } catch (error) {
    return {
      activeUserIds: [],
      deletedSessionCount: 0
    };
  }

  try {
    const rows = sessionsDb
      .prepare("SELECT sid, sess FROM sessions WHERE expired > ?")
      .all(now);
    const deleteSessionStatement = shouldDeleteInactive
      ? sessionsDb.prepare("DELETE FROM sessions WHERE sid = ?")
      : null;

    const uniqueUserIds = new Set();
    let deletedSessionCount = 0;
    for (const row of rows) {
      try {
        const parsed = JSON.parse(row.sess);
        if (isSessionTabHeartbeatExpired(parsed, now)) {
          if (deleteSessionStatement) {
            deletedSessionCount += deleteSessionStatement.run(row.sid).changes;
          }
          continue;
        }

        const userId = Number(parsed?.user?.id);
        if (Number.isInteger(userId) && userId > 0) {
          uniqueUserIds.add(userId);
        }
      } catch (error) {
        if (deleteSessionStatement) {
          deletedSessionCount += deleteSessionStatement.run(row.sid).changes;
        }
      }
    }

    const candidateUserIds = Array.from(uniqueUserIds);
    if (!candidateUserIds.length) {
      return {
        activeUserIds: [],
        deletedSessionCount
      };
    }

    const placeholders = candidateUserIds.map(() => "?").join(", ");
    const existingUsers = db
      .prepare(`SELECT id FROM users WHERE id IN (${placeholders})`)
      .all(...candidateUserIds);

    return {
      activeUserIds: existingUsers
        .map((row) => Number(row.id))
        .filter((id) => Number.isInteger(id) && id > 0),
      deletedSessionCount
    };
  } catch (error) {
    return {
      activeUserIds: [],
      deletedSessionCount: 0
    };
  } finally {
    sessionsDb.close();
  }
}

function purgeInactiveStoredSessions() {
  const sessionSnapshot = collectActiveSessionUserIds({ deleteInactive: true });
  if (sessionSnapshot.deletedSessionCount > 0) {
    clearLoginStatsCache();
  }
  return sessionSnapshot.deletedSessionCount;
}

function getActiveSessionUserIds() {
  return collectActiveSessionUserIds({ deleteInactive: true }).activeUserIds;
}

function getConnectedSocketUserIds() {
  const sockets = io?.of("/")?.sockets;
  if (!sockets || typeof sockets.values !== "function") {
    return [];
  }

  const connectedUserIds = new Set();
  for (const socket of sockets.values()) {
    const userId = Number(socket?.data?.user?.id);
    if (Number.isInteger(userId) && userId > 0) {
      connectedUserIds.add(userId);
    }
  }

  return Array.from(connectedUserIds);
}

function getLoggedInUsersCount(activeUserIds = null) {
  if (Array.isArray(activeUserIds)) {
    return activeUserIds.length;
  }
  return getActiveSessionUserIds().length;
}

function getSocketChatServerId(socket) {
  const rawServerId = String(socket?.data?.serverId || "").trim().toLowerCase();
  if (!ALLOWED_SERVER_IDS.has(rawServerId)) {
    return null;
  }
  return normalizeServer(rawServerId);
}

function getSocketPresenceServerId(socket) {
  const rawServerId = String(socket?.data?.presenceServerId || "").trim().toLowerCase();
  if (!ALLOWED_SERVER_IDS.has(rawServerId)) {
    return null;
  }
  return normalizeServer(rawServerId);
}

function normalizeStaffOnlineName(name, role) {
  const trimmedName = String(name || "").trim();
  if (role === "moderator" && /\s+\(m\)$/i.test(trimmedName)) {
    return trimmedName.replace(/\s+\(m\)$/i, "").trim();
  }
  return trimmedName;
}

function getSocketStaffOnlineEntry(socket) {
  const user = socket?.data?.user;
  const userId = Number(user?.id);
  const activeCharacterId = Number(socket?.data?.activeCharacterId);
  const serverId = getSocketChatServerId(socket) || getSocketPresenceServerId(socket);

  if (
    !Number.isInteger(userId) ||
    userId < 1 ||
    !Number.isInteger(activeCharacterId) ||
    activeCharacterId < 1 ||
    !serverId
  ) {
    return null;
  }

  const displayProfile = getSocketHeaderDisplayProfile(socket);
  if (
    (user?.is_admin === 1 || user?.is_admin === true) &&
    Number(user?.admin_character_id) === activeCharacterId
  ) {
    return {
      userId,
      role: "admin",
      serverId,
      name:
        normalizeStaffOnlineName(displayProfile?.label, "admin") ||
        String(user?.username || "").trim() ||
        `User ${userId}`
    };
  }

  if (
    (user?.is_moderator === 1 || user?.is_moderator === true) &&
    Number(user?.moderator_character_id) === activeCharacterId
  ) {
    return {
      userId,
      role: "moderator",
      serverId,
      name:
        normalizeStaffOnlineName(displayProfile?.label, "moderator") ||
        String(user?.username || "").trim() ||
        `User ${userId}`
    };
  }

  return null;
}

function getOnlineStaffStats() {
  const sockets = io?.of("/")?.sockets;
  if (!sockets || typeof sockets.values !== "function") {
    return {
      adminOnlineCount: 0,
      adminOnlineNames: [],
      moderatorOnlineCount: 0,
      moderatorOnlineNames: []
    };
  }

  const onlineStaffByUserId = new Map();
  for (const socket of sockets.values()) {
    const staffEntry = getSocketStaffOnlineEntry(socket);
    if (!staffEntry) {
      continue;
    }

    const existingEntry = onlineStaffByUserId.get(staffEntry.userId);
    if (!existingEntry || (existingEntry.role !== "admin" && staffEntry.role === "admin")) {
      onlineStaffByUserId.set(staffEntry.userId, staffEntry);
    }
  }

  const adminOnlineNames = [];
  const moderatorOnlineNames = [];

  for (const staffEntry of onlineStaffByUserId.values()) {
    if (staffEntry.role === "admin") {
      adminOnlineNames.push(staffEntry.name);
      continue;
    }
    if (staffEntry.role === "moderator") {
      moderatorOnlineNames.push(staffEntry.name);
    }
  }

  adminOnlineNames.sort((a, b) => a.localeCompare(b, "de", { sensitivity: "base" }));
  moderatorOnlineNames.sort((a, b) => a.localeCompare(b, "de", { sensitivity: "base" }));

  return {
    adminOnlineCount: adminOnlineNames.length,
    adminOnlineNames,
    moderatorOnlineCount: moderatorOnlineNames.length,
    moderatorOnlineNames
  };
}

function getOnlineUserIdsForServers(serverIds) {
  const requestedServerIds = Array.isArray(serverIds) ? serverIds : [serverIds];
  const normalizedServerIds = new Set(
    requestedServerIds
      .map((serverId) => String(serverId || "").trim().toLowerCase())
      .filter((serverId) => serverId.length > 0)
  );

  if (!normalizedServerIds.size) {
    return new Set();
  }

  const sockets = io?.of("/")?.sockets;
  if (!sockets || typeof sockets.values !== "function") {
    return new Set();
  }

  const userIds = new Set();
  for (const socket of sockets.values()) {
    const userId = Number(socket?.data?.user?.id);
    if (!Number.isInteger(userId) || userId < 1) {
      continue;
    }

    const chatServerId = getSocketChatServerId(socket);
    if (chatServerId && normalizedServerIds.has(chatServerId)) {
      userIds.add(userId);
      continue;
    }

    const staffEntry = getSocketStaffOnlineEntry(socket);
    if (staffEntry?.serverId && normalizedServerIds.has(staffEntry.serverId)) {
      userIds.add(userId);
    }
  }

  return userIds;
}

function getOnlineUserCountForServers(serverIds) {
  return getOnlineUserIdsForServers(serverIds).size;
}

function buildLoginStats() {
  const activeUserIds = getActiveSessionUserIds();
  const accountCount =
    db.prepare("SELECT COUNT(*) AS count FROM users").get()?.count || 0;
  const characterCount =
    db.prepare("SELECT COUNT(*) AS count FROM characters").get()?.count || 0;
  const serverCharacterRows = db
    .prepare(
      `SELECT server_id, COUNT(*) AS count
       FROM characters
       GROUP BY server_id`
    )
    .all();
  const staffStats = getOnlineStaffStats();
  const freeRpCharacterCount =
    serverCharacterRows.find((row) => normalizeServer(row.server_id) === "free-rp")?.count || 0;
  const erpCharacterCount =
    serverCharacterRows.find((row) => normalizeServer(row.server_id) === "erp")?.count || 0;
  const freeRpOnlineCount = getOnlineUserCountForServers("free-rp");
  const erpOnlineCount = getOnlineUserCountForServers("erp");
  const rpOnlineCount = getOnlineUserCountForServers(["free-rp", "erp"]);

  return {
    accountCount,
    characterCount,
    rpServerCount: freeRpCharacterCount + erpCharacterCount,
    freeRpCharacterCount,
    erpCharacterCount,
    larpServerCount: 0,
    freeRpOnlineCount,
    erpOnlineCount,
    rpOnlineCount,
    larpOnlineCount: 0,
    loggedInUserCount: getLoggedInUsersCount(activeUserIds),
    adminOnlineCount: staffStats.adminOnlineCount,
    adminOnlineNames: staffStats.adminOnlineNames,
    moderatorOnlineCount: staffStats.moderatorOnlineCount,
    moderatorOnlineNames: staffStats.moderatorOnlineNames
  };
}

function getLoginStats() {
  const now = Date.now();
  if (cachedLoginStats && now < cachedLoginStatsExpiresAt) {
    return cachedLoginStats;
  }

  cachedLoginStats = buildLoginStats();
  cachedLoginStatsExpiresAt = now + LOGIN_STATS_CACHE_TTL_MS;
  return cachedLoginStats;
}

function emitHomeStatsUpdate() {
  io.emit("site:stats:update", getLoginStats());
}

function normalizeEmail(value) {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase().slice(0, 255);
}

function normalizeBirthDate(value) {
  const prepared = String(value || "").trim().slice(0, 10);
  if (!prepared) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(prepared)) return "";

  const parsed = new Date(`${prepared}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return "";
  if (parsed.toISOString().slice(0, 10) !== prepared) return "";

  const today = new Date().toISOString().slice(0, 10);
  if (prepared < "1900-01-01" || prepared > today) {
    return "";
  }

  return prepared;
}

function parseSqliteDateTime(value) {
  const prepared = String(value || "").trim();
  if (!prepared) return null;

  let isoCandidate = prepared;
  if (/^\d{4}-\d{2}-\d{2}$/.test(prepared)) {
    isoCandidate = `${prepared}T00:00:00Z`;
  } else if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(prepared)) {
    isoCandidate = prepared.replace(" ", "T") + "Z";
  }

  const parsed = new Date(isoCandidate);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatGermanDate(value) {
  const parsed = value instanceof Date ? value : parseSqliteDateTime(value);
  if (!parsed) return "";

  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(parsed);
}

function formatGermanDateTime(value) {
  const parsed = value instanceof Date ? value : parseSqliteDateTime(value);
  if (!parsed) return "";

  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  })
    .format(parsed)
    .replace(",", " -");
}

function getAgeFromBirthDate(rawBirthDate, referenceDate = new Date()) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(rawBirthDate || "").trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  const now = referenceDate instanceof Date && !Number.isNaN(referenceDate.getTime())
    ? referenceDate
    : new Date();
  let age = now.getFullYear() - year;
  const hasHadBirthdayThisYear =
    now.getMonth() + 1 > month ||
    (now.getMonth() + 1 === month && now.getDate() >= day);

  if (!hasHadBirthdayThisYear) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

function isBirthdayToday(rawBirthDate, referenceDate = new Date()) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(rawBirthDate || "").trim());
  if (!match) return false;

  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }

  const now = referenceDate instanceof Date && !Number.isNaN(referenceDate.getTime())
    ? referenceDate
    : new Date();
  return now.getMonth() + 1 === month && now.getDate() === day;
}

function getBirthdayGreetingCharacterForUser(userId, options = {}) {
  const parsedUserId = Number(userId);
  if (!Number.isInteger(parsedUserId) || parsedUserId < 1) {
    return null;
  }

  const explicitCharacterId = Number(options?.activeCharacterId || options?.preferredCharacterId);
  if (Number.isInteger(explicitCharacterId) && explicitCharacterId > 0) {
    const explicitCharacter = getCharacterById(explicitCharacterId);
    if (explicitCharacter && Number(explicitCharacter.user_id) === parsedUserId) {
      return explicitCharacter;
    }
  }

  const explicitCharacter = options?.activeCharacter;
  if (explicitCharacter && Number(explicitCharacter.user_id) === parsedUserId && String(explicitCharacter.name || "").trim()) {
    return explicitCharacter;
  }

  const sockets = io?.of("/")?.sockets;
  if (sockets && typeof sockets.values === "function") {
    for (const socket of sockets.values()) {
      if (Number(socket?.data?.user?.id) !== parsedUserId) {
        continue;
      }

      const socketServerId =
        getSocketChatServerId(socket) ||
        getSocketPresenceServerId(socket) ||
        normalizeServer(options?.serverId || DEFAULT_SERVER_ID);
      const socketCharacterId = getSocketPreferredCharacterId(socket, socketServerId);
      const socketCharacter = getPreferredCharacterForUser(parsedUserId, socketServerId, socketCharacterId);
      if (socketCharacter?.name) {
        return socketCharacter;
      }
    }
  }

  const normalizedServerId = String(options?.serverId || "").trim()
    ? normalizeServer(options.serverId)
    : "";
  if (normalizedServerId) {
    const preferredCharacter = getPreferredCharacterForUser(parsedUserId, normalizedServerId, explicitCharacterId);
    if (preferredCharacter?.name) {
      return preferredCharacter;
    }
  }

  return db
    .prepare(
      `SELECT c.*
       FROM characters c
       WHERE c.user_id = ?
       ORDER BY c.updated_at DESC, c.id DESC
       LIMIT 1`
    )
    .get(parsedUserId);
}

function getBirthdayGreetingRecipientName(userId, options = {}) {
  const parsedUserId = Number(userId);
  if (!Number.isInteger(parsedUserId) || parsedUserId < 1) {
    return "Abenteurer";
  }

  const character = getBirthdayGreetingCharacterForUser(parsedUserId, options);
  if (character?.name) {
    return String(character.name).trim();
  }

  return String(getAccountUserById(parsedUserId)?.username || "").trim() || "Abenteurer";
}

function splitBirthdayGreetingMessageSections(rawMessage) {
  const normalizedMessage = String(rawMessage || "")
    .replace(/\r\n?/g, "\n")
    .trim();
  if (!normalizedMessage) {
    return null;
  }

  const sections = normalizedMessage
    .split(/\n{2,}/)
    .map((section) => String(section || "").trim())
    .filter(Boolean);
  if (!sections.length) {
    return null;
  }

  return {
    intro: sections[0] || "",
    wish: sections[1] || "",
    signoff: sections.slice(2).join("\n\n"),
    message: normalizedMessage
  };
}

function buildBirthdayGreetingContent(name, notificationId = 0) {
  const safeName = String(name || "").trim() || "Abenteurer";
  const openerVariants = BIRTHDAY_GREETING_OPENERS.length > 0
    ? BIRTHDAY_GREETING_OPENERS
    : ["Herzlichen Glückwunsch zum Geburtstag, {name}!"];
  const wishVariants = BIRTHDAY_GREETING_WISHES.length > 0
    ? BIRTHDAY_GREETING_WISHES
    : ["Wir wünschen dir von Herzen einen wundervollen Geburtstag."];
  const signoffVariants = BIRTHDAY_GREETING_SIGNOFFS.length > 0
    ? BIRTHDAY_GREETING_SIGNOFFS
    : ["Das ganze Heldenhafte Reisen Team denkt heute an dich und drückt dich ganz fest aus der Ferne."];
  const normalizedNotificationId = Number(notificationId);
  const variantSeed =
    Number.isInteger(normalizedNotificationId) && normalizedNotificationId > 0
      ? normalizedNotificationId - 1
      : crypto.randomInt(0, openerVariants.length * wishVariants.length * signoffVariants.length);
  const openerIndex = variantSeed % openerVariants.length;
  const wishIndex = Math.floor(variantSeed / openerVariants.length) % wishVariants.length;
  const signoffIndex =
    Math.floor(variantSeed / (openerVariants.length * wishVariants.length)) % signoffVariants.length;
  const introTemplate = openerVariants[openerIndex];
  const intro = introTemplate.replace(/\{name\}/g, safeName);
  const wish = wishVariants[wishIndex];
  const signoff = signoffVariants[signoffIndex];

  return {
    title: BIRTHDAY_NOTIFICATION_TITLE,
    decoration: BIRTHDAY_NOTIFICATION_DECORATION,
    intro,
    wish,
    signoff
  };
}

function buildBirthdayGreetingNotificationPayloadForUser(userId, notificationId, options = {}) {
  const storedTitle = String(options?.notificationTitle || "").trim();
  const storedMessage = String(options?.notificationMessage || "").trim();
  const storedDecoration = String(options?.notificationDecoration || "").trim();
  const storedSections = splitBirthdayGreetingMessageSections(storedMessage);

  if (storedSections) {
    return {
      id: Number(notificationId) || 0,
      type: BIRTHDAY_NOTIFICATION_TYPE,
      title: storedTitle || BIRTHDAY_NOTIFICATION_TITLE,
      message: storedSections.message,
      intro: storedSections.intro || storedSections.message,
      wish: storedSections.wish,
      signoff: storedSections.signoff,
      decoration: storedDecoration || BIRTHDAY_NOTIFICATION_DECORATION
    };
  }

  const content = buildBirthdayGreetingContent(
    getBirthdayGreetingRecipientName(userId, options),
    notificationId
  );

  return {
    id: Number(notificationId) || 0,
    type: BIRTHDAY_NOTIFICATION_TYPE,
    title: content.title,
    message: `${content.intro} ${content.wish} ${content.signoff}`,
    intro: content.intro,
    wish: content.wish,
    signoff: content.signoff,
    decoration: content.decoration
  };
}

function buildBirthdayGreetingPlainTextForUser(userId, options = {}) {
  const content = buildBirthdayGreetingNotificationPayloadForUser(
    userId,
    options?.notificationId || 0,
    options
  );
  return [content.intro, content.wish, content.signoff]
    .map((entry) => String(entry || "").trim())
    .filter(Boolean)
    .join("\n\n");
}

function getBirthdayNotificationDateKey(referenceDate = new Date()) {
  const now = referenceDate instanceof Date && !Number.isNaN(referenceDate.getTime())
    ? referenceDate
    : new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createSystemNotification(userId, notificationType, notificationKey, title, message) {
  const parsedUserId = Number(userId);
  const normalizedNotificationType = String(notificationType || "").trim().toLowerCase().slice(0, 80);
  const normalizedNotificationKey = String(notificationKey || "").trim().slice(0, 120);
  const normalizedTitle = String(title || "").trim().slice(0, 160);
  const normalizedMessage = String(message || "").trim().slice(0, 4000);

  if (
    !Number.isInteger(parsedUserId) ||
    parsedUserId < 1 ||
    !normalizedNotificationType ||
    !normalizedNotificationKey ||
    !normalizedTitle ||
    !normalizedMessage
  ) {
    return false;
  }

  const result = db.prepare(
    `INSERT INTO system_notifications (
       user_id,
       notification_type,
       notification_key,
       title,
       message,
       is_read,
       created_at
     )
     VALUES (?, ?, ?, ?, ?, 0, strftime('%Y-%m-%d %H:%M:%f', 'now'))
     ON CONFLICT(user_id, notification_type, notification_key) DO NOTHING`
  ).run(
    parsedUserId,
    normalizedNotificationType,
    normalizedNotificationKey,
    normalizedTitle,
    normalizedMessage
  );

  if (result.changes > 0) {
    emitGuestbookNotificationUpdateForUser(parsedUserId);
    return true;
  }

  return false;
}

function createBirthdayGreetingNotificationIfNeeded(userId, referenceDate = new Date(), options = {}) {
  const parsedUserId = Number(userId);
  if (!Number.isInteger(parsedUserId) || parsedUserId < 1) {
    return false;
  }

  const accountUser = getAccountUserById(parsedUserId);
  if (!accountUser || !isBirthdayToday(accountUser.birth_date, referenceDate)) {
    return false;
  }

  return createSystemNotification(
    parsedUserId,
    BIRTHDAY_NOTIFICATION_TYPE,
    getBirthdayNotificationDateKey(referenceDate),
    BIRTHDAY_NOTIFICATION_TITLE,
    buildBirthdayGreetingPlainTextForUser(parsedUserId, options)
  );
}

function setPostLoginFlash(req, userId, fallbackText = "Erfolgreich eingeloggt.") {
  createBirthdayGreetingNotificationIfNeeded(userId, new Date(), {
    activeCharacter: getPreferredMenuCharacterForUser(req)
  });
  setFlash(req, "success", fallbackText);
}

function getUsernameChangeAvailability(user) {
  const isAdmin = Boolean(user?.is_admin === 1 || user?.is_admin === true);
  if (isAdmin) {
    return {
      is_admin_bypass: true,
      can_change: true,
      available_at: null,
      available_at_text: ""
    };
  }

  const lastChangedAt = parseSqliteDateTime(user?.username_changed_at);
  if (!lastChangedAt) {
    return {
      is_admin_bypass: false,
      can_change: true,
      available_at: null,
      available_at_text: ""
    };
  }

  const availableAt = new Date(lastChangedAt.getTime() + USERNAME_CHANGE_COOLDOWN_MS);
  return {
    is_admin_bypass: false,
    can_change: Date.now() >= availableAt.getTime(),
    available_at: availableAt,
    available_at_text: formatGermanDateTime(availableAt)
  };
}

function addUtcCalendarMonths(value, months) {
  const parsed = value instanceof Date ? new Date(value.getTime()) : parseSqliteDateTime(value);
  if (!parsed || !Number.isInteger(months)) return null;

  const year = parsed.getUTCFullYear();
  const month = parsed.getUTCMonth();
  const day = parsed.getUTCDate();
  const hours = parsed.getUTCHours();
  const minutes = parsed.getUTCMinutes();
  const seconds = parsed.getUTCSeconds();
  const milliseconds = parsed.getUTCMilliseconds();
  const shiftedMonthIndex = month + months;
  const shiftedYear = year + Math.floor(shiftedMonthIndex / 12);
  const normalizedMonth = ((shiftedMonthIndex % 12) + 12) % 12;
  const lastDayOfTargetMonth = new Date(Date.UTC(shiftedYear, normalizedMonth + 1, 0)).getUTCDate();

  return new Date(
    Date.UTC(
      shiftedYear,
      normalizedMonth,
      Math.min(day, lastDayOfTargetMonth),
      hours,
      minutes,
      seconds,
      milliseconds
    )
  );
}

function getCharacterRenameAvailability(character, actorUser = null) {
  if (actorUser?.is_admin) {
    return {
      can_change: true,
      available_at: null,
      available_at_text: ""
    };
  }

  const lastChangedAt = parseSqliteDateTime(character?.name_changed_at);
  if (!lastChangedAt) {
    return {
      can_change: true,
      available_at: null,
      available_at_text: ""
    };
  }

  const availableAt = addUtcCalendarMonths(lastChangedAt, CHARACTER_RENAME_COOLDOWN_MONTHS);
  if (!availableAt) {
    return {
      can_change: true,
      available_at: null,
      available_at_text: ""
    };
  }

  return {
    can_change: Date.now() >= availableAt.getTime(),
    available_at: availableAt,
    available_at_text: formatGermanDate(availableAt)
  };
}

function normalizeCharacterEditGuestbookPageId(value) {
  const pageId = Number(value);
  return Number.isInteger(pageId) && pageId > 0 ? pageId : null;
}

function buildStandaloneGuestbookEditorUrl(characterId, guestbookPageId = null) {
  const normalizedPageId = normalizeCharacterEditGuestbookPageId(guestbookPageId);
  return normalizedPageId
    ? `/characters/${characterId}/guestbook/edit?page_id=${normalizedPageId}`
    : `/characters/${characterId}/guestbook/edit`;
}

function buildEmbeddedGuestbookEditorUrl(characterId, guestbookPageId = null) {
  const normalizedPageId = normalizeCharacterEditGuestbookPageId(guestbookPageId);
  const query = normalizedPageId ? `?guestbook_page_id=${normalizedPageId}` : "";
  return `/characters/${characterId}/edit${query}#guestbook-design`;
}

function buildGuestbookEditorReturnUrl(req, character, guestbookPageId = null) {
  const isOwner = Number(character?.user_id) === Number(req?.session?.user?.id);
  return isOwner
    ? buildEmbeddedGuestbookEditorUrl(character.id, guestbookPageId)
    : buildStandaloneGuestbookEditorUrl(character.id, guestbookPageId);
}

function buildCharacterGuestbookEditorState(characterId, requestedPageId = null) {
  const pages = ensureGuestbookPages(characterId);
  const normalizedRequestedPageId = normalizeCharacterEditGuestbookPageId(requestedPageId);
  const activePage = pages.find((page) => page.id === normalizedRequestedPageId) || pages[0];
  const settings = buildGuestbookPageSettings(getOrCreateGuestbookSettings(characterId), activePage);
  return {
    pages,
    activePage,
    settings
  };
}

function buildCharacterEditFormViewModel(character, options = {}) {
  return {
    title: options.title || `Bearbeiten: ${character.name}`,
    mode: "edit",
    error: options.error || null,
    festplays: options.festplays || getFestplays(),
    serverOptions: SERVER_OPTIONS,
    renameAvailability: options.renameAvailability || getCharacterRenameAvailability(character),
    guestbookEditor: buildCharacterGuestbookEditorState(character.id, options.requestedGuestbookPageId),
    character: options.character || character
  };
}

function getEmailDomain(email) {
  const normalized = normalizeEmail(email);
  const atIndex = normalized.lastIndexOf("@");
  if (atIndex < 0) return "";
  return normalized.slice(atIndex + 1);
}

function isDisposableEmailDomain(email) {
  const domain = getEmailDomain(email);
  return Boolean(domain) && DISPOSABLE_EMAIL_DOMAINS.has(domain);
}

function getRequestIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").trim();
  if (forwarded) {
    return forwarded.split(",")[0].trim().slice(0, 120);
  }
  return String(req.ip || req.socket?.remoteAddress || "").trim().slice(0, 120);
}

function getHostnameFromUrl(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  try {
    return String(new URL(normalized).hostname || "").trim().toLowerCase();
  } catch (_error) {
    return "";
  }
}

function getExpectedRegistrationCaptchaHostnames(req) {
  const hostnames = new Set();
  const requestHostname = String(req.hostname || "").trim().toLowerCase();
  const appHostname = getHostnameFromUrl(APP_BASE_URL);

  if (requestHostname) {
    hostnames.add(requestHostname);
  }
  if (appHostname) {
    hostnames.add(appHostname);
  }
  if (!hostnames.size && process.env.NODE_ENV !== "production") {
    hostnames.add("localhost");
    hostnames.add("127.0.0.1");
  }

  return Array.from(hostnames);
}

function getRegistrationSecurityFailureResponse(reason) {
  switch (reason) {
    case "captcha-missing":
      return {
        status: 400,
        error: "Bitte bestätige zuerst das CAPTCHA."
      };
    case "captcha-failed":
    case "captcha-action-mismatch":
    case "captcha-hostname-mismatch":
      return {
        status: 400,
        error: "Das CAPTCHA konnte nicht bestätigt werden. Bitte versuche es erneut."
      };
    case "captcha-service-unavailable":
    case "captcha-not-configured":
      return {
        status: 503,
        error: "Die Registrierung ist gerade nicht verfügbar. Bitte versuche es später erneut."
      };
    case "ip-temporarily-blocked":
      return {
        status: 403,
        error:
          "Von dieser Verbindung wurden auffällige Registrierungsversuche erkannt. Bitte versuche es später erneut."
      };
    case "too-many-requests":
    case "too-many-blocked-attempts":
    case "too-many-successes":
      return {
        status: 429,
        error: "Zu viele Registrierungsversuche in kurzer Zeit. Bitte warte kurz und versuche es dann erneut."
      };
    default:
      return {
        status: 429,
        error: "Registrierung im Moment nicht möglich. Bitte versuche es in ein paar Minuten erneut."
      };
  }
}

const DUPLICATE_ACCOUNT_REGISTRATION_MESSAGE =
  'Doppelaccounts sind nur nach Freigabe durch einen Admin erlaubt. Bitte nutze im bestehenden Account in den Einstellungen den Link "Doppel Accounts Beantragen".';

function getDuplicateAccountRegistrationStatus(ip) {
  const normalizedIp = String(ip || "").trim().slice(0, 120);
  if (!normalizedIp) {
    return {
      ip: "",
      existingAccountCount: 0,
      hasApproval: false,
      isBlocked: false
    };
  }

  const row = db
    .prepare(
      `SELECT COUNT(*) AS existing_account_count,
              MAX(COALESCE(duplicate_accounts_allowed, 0)) AS has_approval
       FROM users
       WHERE registration_ip = ?`
    )
    .get(normalizedIp);

  const existingAccountCount = Number(row?.existing_account_count || 0);
  const hasApproval = Number(row?.has_approval || 0) === 1;

  return {
    ip: normalizedIp,
    existingAccountCount,
    hasApproval,
    isBlocked: existingAccountCount > 0 && !hasApproval
  };
}

function touchUserLoginMetadata(userId, req) {
  const parsedUserId = Number(userId);
  if (!Number.isInteger(parsedUserId) || parsedUserId < 1) return;

  const ip = getRequestIp(req);
  db.prepare(
    `UPDATE users
     SET last_login_ip = ?, last_login_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).run(ip, parsedUserId);
}

function issueRegistrationGuard(req) {
  const guard = {
    token: crypto.randomBytes(18).toString("hex"),
    issuedAt: Date.now()
  };
  req.session.registrationGuard = guard;
  return guard;
}

function getHumanVerificationMode() {
  return REGISTRATION_CAPTCHA_ENABLED ? "turnstile" : "fallback";
}

function getHumanVerificationStore(req) {
  if (!req.session.humanVerificationChallenges || typeof req.session.humanVerificationChallenges !== "object") {
    req.session.humanVerificationChallenges = {};
  }
  return req.session.humanVerificationChallenges;
}

function generateHumanVerificationText(length = HUMAN_VERIFICATION_CHALLENGE_LENGTH) {
  const preparedLength = Math.max(4, Math.min(8, Number(length) || HUMAN_VERIFICATION_CHALLENGE_LENGTH));
  let result = "";
  while (result.length < preparedLength) {
    const index = crypto.randomInt(0, HUMAN_VERIFICATION_CHARSET.length);
    result += HUMAN_VERIFICATION_CHARSET[index];
  }
  return result;
}

function issueHumanVerificationChallenge(req, context) {
  const normalizedContext = String(context || "").trim().toLowerCase() || "default";
  const store = getHumanVerificationStore(req);
  const challenge = {
    answer: generateHumanVerificationText(),
    token: crypto.randomBytes(12).toString("hex"),
    issuedAt: Date.now()
  };
  store[normalizedContext] = challenge;
  return challenge;
}

function getHumanVerificationChallenge(req, context, { reissueIfMissing = false, forceReissue = false } = {}) {
  const normalizedContext = String(context || "").trim().toLowerCase() || "default";
  const store = getHumanVerificationStore(req);
  if (forceReissue) {
    return issueHumanVerificationChallenge(req, normalizedContext);
  }
  const existingChallenge = store[normalizedContext];
  const ageMs = existingChallenge ? Date.now() - Number(existingChallenge.issuedAt || 0) : Number.POSITIVE_INFINITY;

  if (
    existingChallenge &&
    Number.isFinite(ageMs) &&
    ageMs >= 0 &&
    ageMs <= HUMAN_VERIFICATION_MAX_AGE_MS &&
    String(existingChallenge.answer || "").trim()
  ) {
    return existingChallenge;
  }

  delete store[normalizedContext];
  if (reissueIfMissing) {
    return issueHumanVerificationChallenge(req, normalizedContext);
  }
  return null;
}

function renderAuthPage(req, res, options = {}) {
  const mode = options.mode || "login";
  const values = {
    username: options.values?.username || "",
    email: options.values?.email || "",
    birth_date: options.values?.birth_date || ""
  };

  const pageTitles = {
    login: "Login",
    register: "Registrieren",
    "forgot-username": "Benutzernamen vergessen",
    "forgot-password": "Passwort vergessen",
    "reset-password": "Passwort zurücksetzen"
  };

  const viewData = {
    title: options.title || pageTitles[mode] || "Login",
    mode,
    error: options.error || null,
    success: options.success || null,
    recoveredUsername: options.recoveredUsername || "",
    resetUrl: options.resetUrl || "",
    values,
    registrationGuardToken: "",
    registrationCaptchaMode: getHumanVerificationMode(),
    registrationCaptchaSiteKey: REGISTRATION_CAPTCHA_ENABLED ? TURNSTILE_SITE_KEY : "",
    registrationFallbackCaptchaUrl: "",
    registrationReady: EMAIL_VERIFICATION_MAIL_ENABLED,
    resetToken: options.resetToken || ""
  };

  if (mode === "register") {
    const guard = issueRegistrationGuard(req);
    viewData.registrationGuardToken = guard.token;
    if (viewData.registrationCaptchaMode === "fallback") {
      const challenge = getHumanVerificationChallenge(req, "register", { forceReissue: true });
      viewData.registrationFallbackCaptchaUrl = `/auth/captcha.svg?context=register&v=${encodeURIComponent(
        challenge.token
      )}`;
    }
  }

  return res.status(options.status || 200).render("auth", viewData);
}

function renderOAuthVerificationPage(req, res, provider, options = {}) {
  const normalizedProvider = String(provider || "").trim().toLowerCase() === "facebook" ? "facebook" : "google";
  const providerLabel = normalizedProvider === "facebook" ? "Facebook" : "Google";
  const captchaMode = getHumanVerificationMode();
  let fallbackCaptchaUrl = "";

  if (captchaMode === "fallback") {
    const challenge = getHumanVerificationChallenge(req, `oauth-${normalizedProvider}`, {
      forceReissue: true
    });
    fallbackCaptchaUrl = `/auth/captcha.svg?context=${encodeURIComponent(
      `oauth-${normalizedProvider}`
    )}&v=${encodeURIComponent(challenge.token)}`;
  }

  return res.status(options.status || 200).render("oauth-human-check", {
    title: `${providerLabel} Sicherheitsprüfung`,
    provider: normalizedProvider,
    providerLabel,
    error: options.error || "",
    captchaMode,
    captchaSiteKey: REGISTRATION_CAPTCHA_ENABLED ? TURNSTILE_SITE_KEY : "",
    fallbackCaptchaUrl
  });
}

function renderRegisterPage(req, res, options = {}) {
  return renderAuthPage(req, res, {
    ...options,
    mode: "register"
  });
}

function renderOAuthBirthDatePage(req, res, options = {}) {
  const provider = String(
    options.provider || req.session.oauth_birth_date_provider || "google"
  ).trim().toLowerCase();
  const providerLabel = provider === "facebook" ? "Facebook" : "Google";
  const requireBirthDate = options.requireBirthDate !== false;
  const requirePassword = Boolean(options.requirePassword);
  const pageTitle = requireBirthDate && requirePassword
    ? "Profil vervollständigen"
    : (requirePassword ? "Passwort festlegen" : "Geburtsdatum ergänzen");

  return res.status(options.status || 200).render("oauth-birth-date", {
    title: pageTitle,
    provider,
    providerLabel,
    requireBirthDate,
    requirePassword,
    error: options.error || "",
    values: {
      birth_date: options.values?.birth_date || ""
    }
  });
}

function renderKontaktPage(req, res, options = {}) {
  return res.status(options.status || 200).render("kontakt", {
    title: "Kontakt",
    legalMeta: getLegalMeta(),
    pageClass: "page-legal",
    contactError: options.error || "",
    contactSuccess: options.success || "",
    contactValues: options.values || {
      name: "",
      email: "",
      subject: "",
      message: "",
      privacy_consent: false
    }
  });
}

function renderLoginPage(req, res, options = {}) {
  return renderAuthPage(req, res, {
    ...options,
    mode: "login"
  });
}

function getSessionMaxAgeForUser(user) {
  return SESSION_MAX_AGE_MS;
}

function normalizeSeoPath(value = "/") {
  let normalized = String(value || "").trim();
  if (!normalized) return "/";
  normalized = normalized.split("#")[0].split("?")[0].trim() || "/";
  if (!normalized.startsWith("/")) {
    normalized = `/${normalized}`;
  }
  if (normalized.length > 1) {
    normalized = normalized.replace(/\/+$/, "");
  }
  return normalized || "/";
}

function buildAbsoluteUrl(baseUrl, pathOrUrl = "/") {
  const normalizedBaseUrl = String(baseUrl || "").trim().replace(/\/+$/, "");
  if (!normalizedBaseUrl) return "";
  const normalizedPath = normalizeSeoPath(pathOrUrl);
  return normalizedPath === "/" ? normalizedBaseUrl : `${normalizedBaseUrl}${normalizedPath}`;
}

function buildCanonicalUrl(baseUrl, rawUrl = "/") {
  const normalizedBaseUrl = String(baseUrl || "").trim().replace(/\/+$/, "");
  if (!normalizedBaseUrl) return "";
  let relativeUrl = String(rawUrl || "").trim();
  if (!relativeUrl) return normalizedBaseUrl;
  relativeUrl = relativeUrl.split("#")[0].trim() || "/";
  if (!relativeUrl.startsWith("/")) {
    relativeUrl = `/${relativeUrl}`;
  }
  return relativeUrl === "/" ? normalizedBaseUrl : `${normalizedBaseUrl}${relativeUrl}`;
}

function getSeoDescriptionForPath(pathname) {
  const normalizedPath = normalizeSeoPath(pathname).toLowerCase();
  return SEO_DESCRIPTION_BY_PATH[normalizedPath] || DEFAULT_SEO_DESCRIPTION;
}

function getRobotsMetaForRequest(req) {
  const normalizedPath = normalizeSeoPath(req.path).toLowerCase();
  const isPrivatePath = NOINDEX_PATH_PREFIXES.some(
    (prefix) => normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`)
  );

  if (req.session?.user || isPrivatePath) {
    return "noindex, nofollow, noarchive";
  }

  return "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1";
}

function getSessionLastTabHeartbeatAt(sessionData) {
  const explicitHeartbeatAt = Number(sessionData?.last_tab_heartbeat_at || 0);
  if (Number.isFinite(explicitHeartbeatAt) && explicitHeartbeatAt > 0) {
    return explicitHeartbeatAt;
  }

  const sessionMaxAge = getSessionMaxAgeForUser(sessionData?.user);
  const cookieExpiresAt = new Date(sessionData?.cookie?.expires || "").getTime();
  if (!Number.isFinite(cookieExpiresAt) || cookieExpiresAt <= 0 || sessionMaxAge <= 0) {
    return 0;
  }

  const inferredHeartbeatAt = cookieExpiresAt - sessionMaxAge;
  return Number.isFinite(inferredHeartbeatAt) && inferredHeartbeatAt > 0 ? inferredHeartbeatAt : 0;
}

function isSessionTabHeartbeatExpired(sessionData, now = Date.now()) {
  if (!sessionData?.user) return false;
  const lastHeartbeatAt = getSessionLastTabHeartbeatAt(sessionData);
  if (!Number.isFinite(lastHeartbeatAt) || lastHeartbeatAt <= 0) {
    return false;
  }
  return now - lastHeartbeatAt >= SESSION_TAB_IDLE_TIMEOUT_MS;
}

function markSessionTabHeartbeat(sessionData, now = Date.now()) {
  if (!sessionData?.user) return;
  const lastHeartbeatAt = Number(sessionData?.last_tab_heartbeat_at || 0);
  if (Number.isFinite(lastHeartbeatAt) && lastHeartbeatAt > 0 && now - lastHeartbeatAt < 1000 * 30) {
    return;
  }
  sessionData.last_tab_heartbeat_at = now;
}

function isXmlHttpRequest(req) {
  return String(req.get("x-requested-with") || "").trim().toLowerCase() === "xmlhttprequest";
}

function respondToInactiveSession(req, res) {
  const finishResponse = () => {
    res.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
    if (isXmlHttpRequest(req)) {
      return res.status(401).json({ error: "session_inactive" });
    }
    if (req.method === "GET") {
      return res.redirect(req.originalUrl || "/");
    }
    return res.redirect("/login");
  };

  if (!req.session) {
    return finishResponse();
  }

  clearAdminImpersonationSession(req.session);
  delete req.session.last_tab_heartbeat_at;
  delete req.session.user;

  return req.session.destroy(() => finishResponse());
}

function renderForgotUsernamePage(req, res, options = {}) {
  return renderAuthPage(req, res, {
    ...options,
    mode: "forgot-username"
  });
}

function renderAccountPage(req, res, options = {}) {
  const currentUserId = Number(req.session.user?.id);
  if (!Number.isInteger(currentUserId) || currentUserId < 1) {
    req.session.user = null;
    setFlash(req, "error", "Account konnte nicht zugeordnet werden.");
    return res.redirect("/login");
  }

  const accountUser = options.accountUser || getAccountUserById(currentUserId);
  if (!accountUser) {
    req.session.user = null;
    setFlash(req, "error", "Account existiert nicht mehr.");
    return res.redirect("/login");
  }

  const usernameChangeInfo = getUsernameChangeAvailability(accountUser);

  return res.render("account", {
    title: options.title || "Account",
    error: options.error || null,
    accountUser: {
      ...accountUser,
      account_number: getAccountNumberByUserId(accountUser.id)
    },
    accountCreatedAtLabel: formatGermanDate(accountUser.created_at),
    formValues: {
      username: options.values?.username ?? accountUser.username ?? "",
      email: options.values?.email ?? accountUser.email ?? "",
      birth_date: accountUser.birth_date ?? "",
      auto_afk_enabled:
        options.values?.auto_afk_enabled ??
        normalizeAutoAfkEnabled(accountUser.auto_afk_enabled),
      afk_timeout_minutes:
        options.values?.afk_timeout_minutes ??
        normalizeAfkTimeoutMinutes(accountUser.afk_timeout_minutes),
      room_log_email_enabled:
        options.values?.room_log_email_enabled ??
        (Number(accountUser.room_log_email_enabled) !== 0),
      show_own_chat_time:
        options.values?.show_own_chat_time ??
        (Number(accountUser.show_own_chat_time) === 1)
    },
    usernameChangeInfo
  });
}

function renderForgotPasswordPage(req, res, options = {}) {
  return renderAuthPage(req, res, {
    ...options,
    mode: "forgot-password"
  });
}

function renderResetPasswordPage(req, res, options = {}) {
  return renderAuthPage(req, res, {
    ...options,
    mode: "reset-password"
  });
}

function logRegistrationGuardEvent({ ip, username = "", email = "", outcome, reason = "" }) {
  db.prepare(
    `DELETE FROM registration_guard_events
     WHERE created_at < datetime('now', '-30 days')`
  ).run();
  db.prepare(
    `INSERT INTO registration_guard_events (ip, username, email, outcome, reason)
     VALUES (?, ?, ?, ?, ?)`
  ).run(ip, username.slice(0, 24), email.slice(0, 255), outcome, reason.slice(0, 120));
}

function getRecentRegistrationGuardCount(ip, outcome, sinceModifier) {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM registration_guard_events
       WHERE ip = ?
         AND outcome = ?
         AND created_at >= datetime('now', ?)`
    )
    .get(ip, outcome, sinceModifier);
  return Number(row?.count || 0);
}

function getRecentRegistrationGuardReasonCount(ip, reasons, sinceModifier) {
  const normalizedIp = String(ip || "").trim().slice(0, 120);
  const reasonList = (Array.isArray(reasons) ? reasons : [reasons])
    .map((entry) => String(entry || "").trim())
    .filter(Boolean);
  if (!normalizedIp || !reasonList.length) {
    return 0;
  }

  const placeholders = reasonList.map(() => "?").join(", ");
  const row = db
    .prepare(
      `SELECT COUNT(*) AS count
         FROM registration_guard_events
        WHERE ip = ?
          AND reason IN (${placeholders})
          AND created_at >= datetime('now', ?)`
    )
    .get(normalizedIp, ...reasonList, sinceModifier);
  return Number(row?.count || 0);
}

function isRegistrationIpTemporarilyBlocked(ip) {
  const normalizedIp = String(ip || "").trim().slice(0, 120);
  if (!normalizedIp) {
    return false;
  }

  if (
    getRecentRegistrationGuardReasonCount(
      normalizedIp,
      ["honeypot-filled", "suspicious-payload", "captcha-hostname-mismatch"],
      "-24 hours"
    ) >= 1
  ) {
    return true;
  }

  if (
    getRecentRegistrationGuardReasonCount(
      normalizedIp,
      ["captcha-failed", "too-many-requests"],
      "-1 hour"
    ) >= 4
  ) {
    return true;
  }

  return false;
}

function isSuspiciousRegistrationPayload({ username, email }) {
  const sample = `${username} ${email}`.toLowerCase();
  return /https?:\/\/|www\.|<[^>]+>|\[url|\[link|discord\.gg|t\.me|bit\.ly|tinyurl/i.test(sample);
}

function validateRegistrationGuard(req, submittedToken) {
  const guard = req.session.registrationGuard;
  delete req.session.registrationGuard;

  if (!guard || !submittedToken || submittedToken !== guard.token) {
    return { ok: false, reason: "invalid-token" };
  }

  const ageMs = Date.now() - Number(guard.issuedAt || 0);
  if (!Number.isFinite(ageMs) || ageMs < REGISTRATION_FORM_MIN_AGE_MS) {
    return { ok: false, reason: "too-fast" };
  }

  if (ageMs > REGISTRATION_FORM_MAX_AGE_MS) {
    return { ok: false, reason: "expired-form" };
  }

  return { ok: true };
}

function getRegistrationBlockReason(req, { username, email, honeypotValue, submittedToken }) {
  const ip = getRequestIp(req);

  if (isRegistrationIpTemporarilyBlocked(ip)) {
    return { ip, reason: "ip-temporarily-blocked" };
  }

  if (honeypotValue) {
    return { ip, reason: "honeypot-filled" };
  }

  if (getRecentRegistrationGuardCount(ip, "request", "-1 minute") > REGISTRATION_MAX_REQUESTS_PER_MINUTE) {
    return { ip, reason: "too-many-requests" };
  }

  if (
    getRecentRegistrationGuardCount(ip, "request", "-10 minutes") > REGISTRATION_MAX_REQUESTS_PER_10_MINUTES
  ) {
    return { ip, reason: "too-many-requests" };
  }

  if (getRecentRegistrationGuardCount(ip, "blocked", "-1 hour") >= REGISTRATION_MAX_ATTEMPTS_PER_HOUR) {
    return { ip, reason: "too-many-blocked-attempts" };
  }

  if (getRecentRegistrationGuardCount(ip, "success", "-24 hours") >= REGISTRATION_MAX_SUCCESSES_PER_DAY) {
    return { ip, reason: "too-many-successes" };
  }

  const guardCheck = validateRegistrationGuard(req, submittedToken);
  if (!guardCheck.ok) {
    return { ip, reason: guardCheck.reason };
  }

  if (isSuspiciousRegistrationPayload({ username, email })) {
    return { ip, reason: "suspicious-payload" };
  }

  return null;
}

function getPublicBaseUrl(req) {
  if (APP_BASE_URL) return APP_BASE_URL;
  const forwardedProtoRaw = String(req.headers["x-forwarded-proto"] || "").trim();
  const forwardedProto = forwardedProtoRaw
    ? forwardedProtoRaw.split(",")[0].trim()
    : "";
  const protocol = forwardedProto || req.protocol || "http";
  const host = req.get("host");
  return host ? `${protocol}://${host}` : "";
}

function getVerificationMailer() {
  if (!EMAIL_VERIFICATION_MAIL_ENABLED) return null;
  if (verificationMailer) return verificationMailer;

  const transporterConfig = {
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE
  };
  if (SMTP_AUTH_ENABLED) {
    transporterConfig.auth = {
      user: SMTP_USER,
      pass: SMTP_PASS
    };
  }

  verificationMailer = nodemailer.createTransport(transporterConfig);
  return verificationMailer;
}

async function sendVerificationEmail(req, payload) {
  const transporter = getVerificationMailer();
  if (!transporter) {
    throw new Error("Verification mailer is not configured");
  }

  const baseUrl = getPublicBaseUrl(req);
  if (!baseUrl) {
    throw new Error("Public base URL missing");
  }

  const verifyUrl = `${baseUrl}/verify-email?token=${encodeURIComponent(
    payload.verificationToken
  )}`;
  const text = [
    `Hallo ${payload.username},`,
    "",
    "danke für deine Registrierung bei Heldenhafte Reisen.",
    "Bitte bestätige deine E-Mail-Adresse über diesen Link:",
    verifyUrl,
    "",
    "Danach kannst du dich ganz normal einloggen."
  ].join("\n");

  await transporter.sendMail({
    from: MAIL_FROM,
    to: payload.email,
    subject: "Bitte bestätige deine E-Mail bei Heldenhafte Reisen",
    text
  });
}

async function sendRegistrationAdminNotification(req, payload) {
  const transporter = getVerificationMailer();
  if (!transporter || !LEGAL_CONTACT_FORWARD_EMAIL) return false;

  const baseUrl = getPublicBaseUrl(req) || APP_BASE_URL || "https://heldenhaftereisen.net";
  const text = [
    "Neue Registrierung bei Heldenhafte Reisen",
    "",
    `Benutzername: ${payload.username}`,
    `E-Mail: ${payload.email}`,
    payload.accountNumber ? `Accountnummer: ${payload.accountNumber}` : "",
    `Zeitpunkt: ${new Date().toLocaleString("de-DE", { timeZone: "Europe/Berlin" })}`,
    "",
    `Plattform: ${baseUrl}`
  ]
    .filter(Boolean)
    .join("\n");

  await transporter.sendMail({
    from: MAIL_FROM,
    to: LEGAL_CONTACT_FORWARD_EMAIL,
    subject: `Neue Registrierung: ${payload.username}`,
    text
  });

  return true;
}

async function sendContactMessageEmail(payload) {
  const transporter = getVerificationMailer();
  if (!transporter) {
    throw new Error("Contact mailer is not configured");
  }

  const recipients = [LEGAL_CONTACT_EMAIL].filter(Boolean);
  const bccRecipients = [LEGAL_CONTACT_FORWARD_EMAIL].filter(
    (email) => email && !recipients.includes(email)
  );

  const text = [
    "Neue Kontaktanfrage über Heldenhafte Reisen",
    "",
    `Name: ${payload.name}`,
    `E-Mail: ${payload.email}`,
    `Betreff: ${payload.subject}`,
    "",
    "Nachricht:",
    payload.message
  ].join("\n");

  await transporter.sendMail({
    from: MAIL_FROM,
    to: recipients.join(", "),
    bcc: bccRecipients.length ? bccRecipients.join(", ") : undefined,
    replyTo: payload.email,
    subject: `[Kontakt] ${payload.subject}`,
    text
  });

  return true;
}

async function sendAccountDeletionEmail(payload) {
  const transporter = getVerificationMailer();
  if (!transporter) return false;

  const email = normalizeEmail(payload.email || "");
  if (!email) return false;

  const username = String(payload.username || "Account").trim() || "Account";
  const text = [
    `Hallo ${username},`,
    "",
    "dein Account bei Heldenhafte Reisen wurde soeben gelöscht.",
    "Falls du das nicht selbst warst, kontaktiere bitte umgehend den Support.",
    "",
    "Hinweis: Diese E-Mail wurde automatisch versendet."
  ].join("\n");

  await transporter.sendMail({
    from: MAIL_FROM,
    to: email,
    subject: "Bestätigung: Dein Account wurde gelöscht",
    text
  });

  return true;
}

async function sendFestplayInactivityDeletionEmail(payload) {
  const transporter = getVerificationMailer();
  if (!transporter) return false;

  const email = normalizeEmail(payload.email || "");
  if (!email) return false;

  const username = String(payload.username || "Account").trim() || "Account";
  const festplayName = String(payload.festplayName || "Dein Festplay").trim() || "Dein Festplay";
  const lastActivityLabel = formatGermanDateTime(payload.lastActivityAt) || "unbekannt";
  const text = [
    `Hallo ${username},`,
    "",
    `dein Festplay ${festplayName} wurde automatisch gelöscht, weil 6 Monate lang keine Aktivität mehr erkannt wurde.`,
    "",
    `Letzte erkannte Aktivität: ${lastActivityLabel}`,
    "",
    "Als Aktivität zählen zum Beispiel Chat-Beitritte, Chat-Nachrichten, Änderungen am Festplay, Raumänderungen, Bewerbungen und RP-Aushang-Einträge.",
    "",
    "Hinweis: Diese E-Mail wurde automatisch versendet."
  ].join("\n");

  await transporter.sendMail({
    from: MAIL_FROM,
    to: email,
    subject: `Festplay automatisch gelöscht: ${festplayName}`,
    text
  });

  return true;
}

function sanitizeGuestbookExportAttachmentPart(rawValue, fallback = "gaestebuch") {
  const prepared = String(rawValue || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  return prepared || fallback;
}

function buildGuestbookExportAttachmentBaseName(label, exportedAt = new Date()) {
  const safeLabel = sanitizeGuestbookExportAttachmentPart(label, "gaestebuch");
  const safeDate =
    formatChatTimestamp(exportedAt)
      .replace(/[^0-9]/g, "")
      .slice(0, 14) || formatChatTimestamp().replace(/[^0-9]/g, "").slice(0, 14);
  return `${safeLabel}-${safeDate}`;
}

function getGuestbookExportDataForCharacter(characterId) {
  const parsedCharacterId = Number(characterId);
  if (!Number.isInteger(parsedCharacterId) || parsedCharacterId < 1) {
    return null;
  }

  const character = getCharacterById(parsedCharacterId);
  if (!character) {
    return null;
  }

  const settings = getOrCreateGuestbookSettings(parsedCharacterId);
  const pages = ensureGuestbookPages(parsedCharacterId);
  const entries = db
    .prepare(
      `SELECT ge.id,
              ge.character_id,
              ge.author_id,
              ge.author_character_id,
              ge.author_name,
              ge.content,
              ge.is_private,
              ge.guestbook_page_id,
              ge.created_at,
              ge.updated_at,
              author_character.name AS author_character_name
         FROM guestbook_entries ge
         LEFT JOIN characters author_character ON author_character.id = ge.author_character_id
         WHERE ge.character_id = ?
         ORDER BY COALESCE(ge.guestbook_page_id, 0) ASC,
                  ge.created_at ASC,
                  ge.id ASC`
    )
    .all(parsedCharacterId)
    .map((entry) => ({
      ...entry,
      is_private: Number(entry.is_private) === 1
    }));

  return {
    character,
    settings,
    pages,
    entries
  };
}

function buildGuestbookExportText(items) {
  const exports = Array.isArray(items) ? items.filter(Boolean) : [];
  const sections = [];

  exports.forEach((item, index) => {
    const character = item.character || {};
    const settings = item.settings || {};
    const pages = Array.isArray(item.pages) ? item.pages : [];
    const lines = [
      `Charakter: ${String(character.name || "").trim() || "-"}`,
      `Server: ${getServerLabel(character.server_id) || "-"}`,
      "",
      "Gästebuch-Einstellungen:",
      `Bild: ${String(settings.image_url || "").trim() || "-"}`,
      `Zensur: ${String(settings.censor_level || "").trim() || "-"}`,
      `Textfarbe: ${String(settings.chat_text_color || "").trim() || "-"}`,
      `Rahmenfarbe: ${String(settings.frame_color || "").trim() || "-"}`,
      `Hintergrundfarbe: ${String(settings.background_color || "").trim() || "-"}`,
      `Fläche hinter dem Rahmen: ${String(settings.surround_color || "").trim() || "-"}`,
      `Seitenstil: ${String(settings.page_style || "").trim() || "-"}`,
      `Design: ${String(settings.theme_style || "").trim() || "-"}`,
      `Schrift: ${String(settings.font_style || "").trim() || "-"}`,
      "",
      "Gästebuch-Seiten:"
    ];

    if (!pages.length) {
      lines.push("Keine Seiten vorhanden.");
    } else {
      pages.forEach((page) => {
        lines.push("");
        lines.push(`Seite ${page.page_number || "-"}: ${String(page.title || "").trim() || "-"}`);
        lines.push(String(page.content || "").trim() || "(leer)");
      });
    }

    sections.push(lines.join("\n"));

    if (index < exports.length - 1) {
      sections.push("========================================================================");
    }
  });

  return sections.join("\n\n").trim() || "Keine Gästebuchdaten vorhanden.";
}

function createGuestbookExportPdfBuffer(payload) {
  return new Promise((resolve, reject) => {
    try {
      const title = String(payload.title || "Gästebuch-Code").trim() || "Gästebuch-Code";
      const exportText = String(payload.exportText || "").trim() || "Keine Gästebuchdaten vorhanden.";
      const doc = new PDFDocument({
        size: "A4",
        margin: 48,
        info: {
          Title: title,
          Author: "Heldenhafte Reisen"
        }
      });
      const chunks = [];

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      doc.font("Helvetica-Bold").fontSize(20).fillColor("#16324f").text(title);
      doc.moveDown(0.25);
      doc.font("Helvetica").fontSize(10.5).fillColor("#243447").text(exportText, {
        width: doc.page.width - doc.page.margins.left - doc.page.margins.right
      });
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

async function createGuestbookExportDocxBuffer(payload) {
  const title = String(payload.title || "Gästebuch-Code").trim() || "Gästebuch-Code";
  const exportText = String(payload.exportText || "").trim() || "Keine Gästebuchdaten vorhanden.";
  const paragraphs = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      children: [
        new TextRun({
          text: title,
          color: "16324f"
        })
      ]
    })
  ];

  exportText.split(/\r?\n/).forEach((line) => {
    paragraphs.push(
      new Paragraph({
        children: line
          ? [
              new TextRun({
                text: line,
                color: "243447"
              })
            ]
          : []
      })
    );
  });

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: paragraphs
      }
    ]
  });

  return Packer.toBuffer(doc);
}

async function sendGuestbookCodeEmail(payload) {
  const transporter = getVerificationMailer();
  if (!transporter) return false;

  const email = normalizeEmail(payload.email || "");
  if (!email) return false;

  const username = String(payload.username || "Abenteurer").trim() || "Abenteurer";
  const exportLabel = String(payload.exportLabel || "deinem Gästebuch").trim() || "deinem Gästebuch";
  const exportText = String(payload.exportText || "").trim() || "Keine Gästebuchdaten vorhanden.";
  const attachmentBaseName =
    String(payload.attachmentBaseName || "").trim() ||
    buildGuestbookExportAttachmentBaseName(exportLabel, new Date());
  const [pdfBuffer, docxBuffer] = await Promise.all([
    createGuestbookExportPdfBuffer(payload),
    createGuestbookExportDocxBuffer(payload)
  ]);

  const text = [
    `Hallo ${username},`,
    "",
    `hier ist der Gästebuch-Code aus ${exportLabel}.`,
    "Im Anhang findest du den Export zusätzlich als PDF und Word-Datei.",
    "",
    "Gästebuch-Code:",
    "",
    exportText,
    "",
    "Hinweis: Diese E-Mail wurde automatisch versendet."
  ].join("\n");

  const pdfOnlyText = [
    `Hallo ${username},`,
    "",
    `hier ist der Gästebuch-Code aus ${exportLabel}.`,
    "Im Anhang findest du den Export als PDF.",
    "Der Word-Anhang wurde vom Mailserver nicht akzeptiert und deshalb weggelassen.",
    "",
    "Gästebuch-Code:",
    "",
    exportText,
    "",
    "Hinweis: Diese E-Mail wurde automatisch versendet."
  ].join("\n");

  const plainText = [
    `Hallo ${username},`,
    "",
    `hier ist der Gästebuch-Code aus ${exportLabel}.`,
    "Die Anhänge wurden vom Mailserver nicht akzeptiert.",
    "Darum bekommst du den Export diesmal direkt in der E-Mail ohne PDF- oder Word-Datei.",
    "",
    "Gästebuch-Code:",
    "",
    exportText,
    "",
    "Hinweis: Diese E-Mail wurde automatisch versendet."
  ].join("\n");

  const mailBase = {
    from: MAIL_FROM,
    to: email,
    subject: `Gästebuch-Code: ${exportLabel}`
  };
  const attempts = [
    {
      deliveryMode: "pdf-docx",
      text,
      attachments: [
        {
          filename: `${attachmentBaseName}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf"
        },
        {
          filename: `${attachmentBaseName}.docx`,
          content: docxBuffer,
          contentType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        }
      ]
    },
    {
      deliveryMode: "pdf",
      text: pdfOnlyText,
      attachments: [
        {
          filename: `${attachmentBaseName}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf"
        }
      ]
    },
    {
      deliveryMode: "plain",
      text: plainText,
      attachments: []
    }
  ];

  let lastError = null;
  for (const attempt of attempts) {
    try {
      await transporter.sendMail({
        ...mailBase,
        text: attempt.text,
        attachments: attempt.attachments
      });
      return {
        delivered: true,
        deliveryMode: attempt.deliveryMode
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Guestbook export email delivery failed");
}

async function sendRoomLogEmail(payload) {
  const transporter = getVerificationMailer();
  if (!transporter) return false;

  const email = normalizeEmail(payload.email || "");
  if (!email) return false;

  const username = String(payload.username || "Abenteurer").trim() || "Abenteurer";
  const roomLabel = String(payload.roomLabel || "einem Chatraum").trim() || "einem Chatraum";
  const participantNames = Array.isArray(payload.participantNames)
    ? payload.participantNames.filter(Boolean)
    : [];
  const attachmentBaseName = buildRoomLogAttachmentBaseName(roomLabel, payload.endedAt);
  const [pdfBuffer, docxBuffer] = await Promise.all([
    createRoomLogPdfBuffer(payload),
    createRoomLogDocxBuffer(payload)
  ]);
  const text = [
    `Hallo ${username},`,
    "",
    `hier ist das Chat-Log aus ${roomLabel}.`,
    `Gestartet: ${payload.startedAt || "-"}`,
    `Beendet: ${payload.endedAt || "-"}`,
    payload.endReasonText ? `Grund: ${payload.endReasonText}` : "",
    participantNames.length ? `Beteiligte: ${participantNames.join(", ")}` : "",
    "",
    "Im Anhang findest du das Log zusätzlich als PDF und Word-Datei.",
    "Formatierungen wie kursiv/fett und die farbliche Hervorhebung werden dort mit übernommen.",
    "",
    "Chatverlauf:",
    "",
    String(payload.logText || "").trim() || "Es wurden keine Nachrichten erfasst.",
    "",
    "Hinweis: Diese E-Mail wurde automatisch versendet."
  ]
    .filter((line, index, lines) => {
      if (line) return true;
      return lines[index - 1] !== "";
    })
    .join("\n");

  const pdfOnlyText = [
    `Hallo ${username},`,
    "",
    `hier ist das Chat-Log aus ${roomLabel}.`,
    `Gestartet: ${payload.startedAt || "-"}`,
    `Beendet: ${payload.endedAt || "-"}`,
    payload.endReasonText ? `Grund: ${payload.endReasonText}` : "",
    participantNames.length ? `Beteiligte: ${participantNames.join(", ")}` : "",
    "",
    "Im Anhang findest du das Log als PDF.",
    "Der Word-Anhang wurde vom Mailserver nicht akzeptiert und daher weggelassen.",
    "",
    "Chatverlauf:",
    "",
    String(payload.logText || "").trim() || "Es wurden keine Nachrichten erfasst.",
    "",
    "Hinweis: Diese E-Mail wurde automatisch versendet."
  ]
    .filter((line, index, lines) => {
      if (line) return true;
      return lines[index - 1] !== "";
    })
    .join("\n");

  const plainText = [
    `Hallo ${username},`,
    "",
    `hier ist das Chat-Log aus ${roomLabel}.`,
    `Gestartet: ${payload.startedAt || "-"}`,
    `Beendet: ${payload.endedAt || "-"}`,
    payload.endReasonText ? `Grund: ${payload.endReasonText}` : "",
    participantNames.length ? `Beteiligte: ${participantNames.join(", ")}` : "",
    "",
    "Die Anhänge wurden vom Mailserver nicht akzeptiert.",
    "Darum bekommst du das Log diesmal direkt in der E-Mail ohne PDF- oder Word-Datei.",
    "",
    "Chatverlauf:",
    "",
    String(payload.logText || "").trim() || "Es wurden keine Nachrichten erfasst.",
    "",
    "Hinweis: Diese E-Mail wurde automatisch versendet."
  ]
    .filter((line, index, lines) => {
      if (line) return true;
      return lines[index - 1] !== "";
    })
    .join("\n");

  const mailBase = {
    from: MAIL_FROM,
    to: email,
    subject: `Chat-Log: ${roomLabel}`
  };
  const attempts = [
    {
      deliveryMode: "pdf-docx",
      text,
      attachments: [
        {
          filename: `${attachmentBaseName}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf"
        },
        {
          filename: `${attachmentBaseName}.docx`,
          content: docxBuffer,
          contentType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        }
      ]
    },
    {
      deliveryMode: "pdf",
      text: pdfOnlyText,
      attachments: [
        {
          filename: `${attachmentBaseName}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf"
        }
      ]
    },
    {
      deliveryMode: "plain",
      text: plainText,
      attachments: []
    }
  ];

  let lastError = null;
  for (const attempt of attempts) {
    try {
      await transporter.sendMail({
        ...mailBase,
        text: attempt.text,
        attachments: attempt.attachments
      });
      return {
        delivered: true,
        deliveryMode: attempt.deliveryMode
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Room log email delivery failed");
}

function summarizeMailError(error) {
  const code = String(error?.code || "").trim().toUpperCase();
  const responseCode = Number(error?.responseCode);
  const message = String(error?.message || "").trim();

  if (code === "EAUTH") {
    return "SMTP-Anmeldung fehlgeschlagen.";
  }
  if (code === "ESOCKET" || code === "ECONNECTION") {
    return "SMTP-Server nicht erreichbar.";
  }
  if (code === "EENVELOPE") {
    return "Absender oder Empfänger wurde vom Mailserver abgelehnt.";
  }
  if (responseCode === 535) {
    return "SMTP-Benutzername oder Passwort ist falsch.";
  }
  if (responseCode === 550 || responseCode === 553) {
    return "Mailserver lehnt Absender oder Empfänger ab.";
  }
  if (responseCode === 552) {
    return "Mailserver lehnt die Nachricht wegen Größe oder Anhang ab.";
  }
  if (/self[- ]signed|certificate/i.test(message)) {
    return "TLS-/Zertifikatsproblem beim SMTP-Server.";
  }
  if (/timeout/i.test(message)) {
    return "Verbindung zum SMTP-Server läuft in ein Timeout.";
  }

  return message || "Unbekannter Mailfehler.";
}

async function sendUsernameReminderEmail(payload) {
  const transporter = getVerificationMailer();
  if (!transporter) {
    throw new Error("Verification mailer is not configured");
  }

  const email = normalizeEmail(payload.email || "");
  const username = String(payload.username || "").trim();
  if (!email || !username) {
    throw new Error("Username reminder payload incomplete");
  }

  const text = [
    "Hallo,",
    "",
    "du hast eine Erinnerung für deinen Benutzernamen angefordert.",
    `Dein Benutzername lautet: ${username}`,
    "",
    "Wenn du diese Anfrage nicht selbst gestellt hast, kannst du diese E-Mail ignorieren."
  ].join("\n");

  await transporter.sendMail({
    from: MAIL_FROM,
    to: email,
    subject: "Dein Benutzername bei Heldenhafte Reisen",
    text
  });
}

function getPasswordResetPath(resetToken) {
  return `/reset-password?token=${encodeURIComponent(String(resetToken || "").trim())}`;
}

function getPasswordResetUrl(req, resetToken) {
  const resetPath = getPasswordResetPath(resetToken);
  const baseUrl = getPublicBaseUrl(req);
  return baseUrl ? `${baseUrl}${resetPath}` : resetPath;
}

async function sendPasswordResetEmail(req, payload) {
  const transporter = getVerificationMailer();
  if (!transporter) {
    throw new Error("Verification mailer is not configured");
  }

  const email = normalizeEmail(payload.email || "");
  const username = String(payload.username || "").trim() || "Account";
  if (!email || !payload.resetToken) {
    throw new Error("Password reset payload incomplete");
  }

  const resetUrl = getPasswordResetUrl(req, payload.resetToken);
  if (!/^https?:\/\//i.test(resetUrl)) {
    throw new Error("Public base URL missing");
  }
  const text = [
    `Hallo ${username},`,
    "",
    "du hast ein neues Passwort angefordert.",
    "Öffne diesen Link, um ein neues Passwort zu setzen:",
    resetUrl,
    "",
    `Der Link ist ${PASSWORD_RESET_TOKEN_LIFETIME_HOURS} Stunden gültig.`,
    "Wenn du diese Anfrage nicht selbst gestellt hast, kannst du diese E-Mail ignorieren."
  ].join("\n");

  await transporter.sendMail({
    from: MAIL_FROM,
    to: email,
    subject: "Passwort zurücksetzen bei Heldenhafte Reisen",
    text
  });
}

function getValidPasswordResetUser(token) {
  if (!/^[a-f0-9]{64}$/i.test(String(token || "").trim())) {
    return null;
  }

  return db
    .prepare(
      `SELECT id, username, is_admin, is_moderator, theme, email_verified
       FROM users
       WHERE password_reset_token = ?
         AND password_reset_sent_at >= datetime('now', ?)`
    )
    .get(String(token || "").trim(), `-${PASSWORD_RESET_TOKEN_LIFETIME_HOURS} hours`);
}

function getAccountNumberByUserId(userId) {
  const parsedUserId = Number(userId);
  if (!Number.isInteger(parsedUserId) || parsedUserId < 1) {
    return null;
  }

  const existingUser = db
    .prepare("SELECT id, account_number FROM users WHERE id = ?")
    .get(parsedUserId);
  if (!existingUser) {
    return null;
  }

  const currentAccountNumber = String(existingUser.account_number || "").trim();
  if (currentAccountNumber) {
    return currentAccountNumber;
  }

  const usedAccountNumbers = new Set(
    db
      .prepare(
        `SELECT account_number
           FROM users
          WHERE account_number IS NOT NULL
            AND trim(account_number) != ''`
      )
      .all()
      .map((row) => {
        const normalized = String(row?.account_number || "").trim();
        if (!/^\d+$/.test(normalized)) {
          return null;
        }

        const parsedAccountNumber = Number(normalized);
        return Number.isSafeInteger(parsedAccountNumber) && parsedAccountNumber > 0
          ? parsedAccountNumber
          : null;
      })
      .filter((value) => value !== null)
  );

  let nextAccountNumber = 1;
  while (usedAccountNumbers.has(nextAccountNumber)) {
    nextAccountNumber += 1;
  }

  const nextAccountNumberText = String(nextAccountNumber);
  db.prepare("UPDATE users SET account_number = ? WHERE id = ?").run(
    nextAccountNumberText,
    parsedUserId
  );
  return nextAccountNumberText;
}

function normalizeStaffDisplayName(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
}

const DEFAULT_AFK_TIMEOUT_MINUTES = 20;
const MIN_AFK_TIMEOUT_MINUTES = 5;
const MAX_AFK_TIMEOUT_MINUTES = 240;

function normalizeAutoAfkEnabled(value, fallback = true) {
  if (value === true || value === 1 || value === "1") {
    return true;
  }

  if (value === false || value === 0 || value === "0") {
    return false;
  }

  return fallback !== false;
}

function parseAfkTimeoutMinutes(value) {
  const parsedValue = Number(value);
  if (!Number.isInteger(parsedValue)) {
    return null;
  }

  if (parsedValue < MIN_AFK_TIMEOUT_MINUTES || parsedValue > MAX_AFK_TIMEOUT_MINUTES) {
    return null;
  }

  return parsedValue;
}

function normalizeAfkTimeoutMinutes(value, fallback = DEFAULT_AFK_TIMEOUT_MINUTES) {
  const parsedValue = parseAfkTimeoutMinutes(value);
  if (parsedValue != null) {
    return parsedValue;
  }

  const parsedFallback = parseAfkTimeoutMinutes(fallback);
  return parsedFallback != null ? parsedFallback : DEFAULT_AFK_TIMEOUT_MINUTES;
}

function getUserRoleCharacter(user, role) {
  if (!user) return null;

  const normalizedRole = role === "moderator" ? "moderator" : "admin";
  const isAllowedRole =
    normalizedRole === "admin"
      ? user.is_admin === 1 || user.is_admin === true
      : user.is_moderator === 1 || user.is_moderator === true;
  if (!isAllowedRole) return null;

  const rawCharacterId =
    normalizedRole === "admin" ? user.admin_character_id : user.moderator_character_id;
  const parsedCharacterId = Number(rawCharacterId);
  if (!Number.isInteger(parsedCharacterId) || parsedCharacterId < 1) {
    return null;
  }

  const parsedUserId = Number(user.id);
  if (!Number.isInteger(parsedUserId) || parsedUserId < 1) {
    return null;
  }

  return (
    db
      .prepare(
        `SELECT c.id,
                c.user_id,
                c.name,
                c.server_id,
                COALESCE(gs.chat_text_color, '#AEE7B7') AS chat_text_color
         FROM characters c
         LEFT JOIN guestbook_settings gs ON gs.character_id = c.id
         WHERE c.id = ? AND c.user_id = ?`
      )
      .get(parsedCharacterId, parsedUserId) || null
  );
}

function getUserStaffBaseName(user) {
  if (!user) return "";
  const adminCharacter = getUserRoleCharacter(user, "admin");
  if (adminCharacter?.name) {
    return String(adminCharacter.name).trim();
  }
  const moderatorCharacter = getUserRoleCharacter(user, "moderator");
  if (moderatorCharacter?.name) {
    return String(moderatorCharacter.name).trim();
  }
  return "";
}

function getPublicAdminCharacterName() {
  const adminUser =
    db
      .prepare(
        `SELECT id,
                username,
                is_admin,
                is_moderator,
                admin_character_id,
                moderator_character_id,
                account_number
           FROM users
          WHERE is_admin = 1
          ORDER BY
            CASE
              WHEN trim(COALESCE(account_number, '')) GLOB '[0-9]*'
                AND trim(COALESCE(account_number, '')) != ''
              THEN CAST(account_number AS INTEGER)
              ELSE 2147483647
            END ASC,
            id ASC
          LIMIT 1`
      )
      .get() || null;

  const adminCharacterName = String(getUserRoleCharacter(adminUser, "admin")?.name || "").trim();
  return adminCharacterName || "Administration";
}

function getUserDisplayProfile(user, activeCharacter = null) {
  const fallbackName = String(user?.username || "").trim() || "User";
  const activeCharacterId = Number(activeCharacter?.id);
  const activeCharacterName = String(activeCharacter?.name || "").trim();
  const activeCharacterChatTextColor = /^#[0-9a-f]{6}$/i.test(String(activeCharacter?.chat_text_color || "").trim())
    ? normalizeGuestbookColor(activeCharacter.chat_text_color)
    : "";

  if (Number.isInteger(activeCharacterId) && activeCharacterId > 0 && activeCharacterName) {
    if (Number(user?.admin_character_id) === activeCharacterId && (user?.is_admin === 1 || user?.is_admin === true)) {
      return { label: activeCharacterName, role_style: "admin", chat_text_color: activeCharacterChatTextColor };
    }

    if (
      Number(user?.moderator_character_id) === activeCharacterId &&
      (user?.is_moderator === 1 || user?.is_moderator === true)
    ) {
      return {
        label: activeCharacterName,
        role_style: "moderator",
        chat_text_color: activeCharacterChatTextColor
      };
    }

    return { label: activeCharacterName, role_style: "", chat_text_color: activeCharacterChatTextColor };
  }

  const adminCharacter = getUserRoleCharacter(user, "admin");
  if (adminCharacter?.name) {
    return {
      label: String(adminCharacter.name).trim(),
      role_style: "admin",
      chat_text_color: normalizeGuestbookColor(adminCharacter.chat_text_color)
    };
  }

  const moderatorCharacter = getUserRoleCharacter(user, "moderator");
  if (moderatorCharacter?.name) {
    return {
      label: String(moderatorCharacter.name).trim(),
      role_style: "moderator",
      chat_text_color: normalizeGuestbookColor(moderatorCharacter.chat_text_color)
    };
  }

  return { label: fallbackName, role_style: "", chat_text_color: "" };
}

function getUserDefaultDisplayName(user) {
  return getUserDisplayProfile(user).label;
}

function toSessionUser(user) {
  const displayProfile = getUserDisplayProfile(user);
  return {
    id: user.id,
    username: user.username,
    is_admin: user.is_admin === 1,
    is_moderator: user.is_moderator === 1,
    admin_character_id: Number(user.admin_character_id) || null,
    moderator_character_id: Number(user.moderator_character_id) || null,
    admin_display_name: normalizeStaffDisplayName(user.admin_display_name),
    moderator_display_name: normalizeStaffDisplayName(user.moderator_display_name),
    display_name: displayProfile.label,
    display_role_style: displayProfile.role_style,
    display_chat_text_color: displayProfile.chat_text_color || "",
    theme: normalizeTheme(user.theme),
    afk_timeout_minutes: normalizeAfkTimeoutMinutes(user?.afk_timeout_minutes),
    auto_afk_enabled: normalizeAutoAfkEnabled(user?.auto_afk_enabled),
    show_own_chat_time: Number(user?.show_own_chat_time) === 1,
    account_number: getAccountNumberByUserId(user.id)
  };
}

function clearAdminImpersonationSession(session) {
  if (!session || typeof session !== "object") {
    return;
  }

  delete session.admin_impersonator_user_id;
}

function getUserForSessionById(userId) {
  return db
    .prepare(
      `SELECT id, username, is_admin, is_moderator, admin_display_name, moderator_display_name, theme,
              afk_timeout_minutes, auto_afk_enabled, show_own_chat_time
       , admin_character_id, moderator_character_id
       FROM users
       WHERE id = ?`
    )
    .get(userId);
}

function getUserForSessionByUsername(username) {
  return db
    .prepare(
      `SELECT id, username, is_admin, is_moderator, admin_display_name, moderator_display_name, theme,
              afk_timeout_minutes, auto_afk_enabled, show_own_chat_time
       , admin_character_id, moderator_character_id
       FROM users
       WHERE lower(username) = lower(?)
       LIMIT 1`
    )
    .get(username);
}

function getAccountUserById(userId) {
  return db
    .prepare(
      `SELECT id, username, email, birth_date, afk_timeout_minutes, auto_afk_enabled, show_own_chat_time,
              room_log_email_enabled, is_admin, is_moderator, created_at, username_changed_at,
              oauth_password_pending
       FROM users
       WHERE id = ?`
    )
    .get(userId);
}

function makeUsernameBase(input) {
  const prepared = String(input || "")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!prepared) return "user";
  if (prepared.length >= 3) return prepared.slice(0, 24);
  return (prepared + "_user").slice(0, 24);
}

function makeUniqueUsername(baseInput) {
  const base = makeUsernameBase(baseInput);
  let candidate = base;
  let counter = 1;

  while (db.prepare("SELECT id FROM users WHERE username = ?").get(candidate)) {
    const suffix = `_${counter}`;
    const maxBaseLen = 24 - suffix.length;
    candidate = `${base.slice(0, Math.max(1, maxBaseLen))}${suffix}`;
    counter += 1;
  }

  return candidate;
}

function getProfileEmail(profile) {
  const emailEntry = Array.isArray(profile?.emails)
    ? profile.emails.find((item) => item && typeof item.value === "string")
    : null;
  return normalizeEmail(emailEntry?.value || "");
}

function findOrCreateOAuthUser(provider, profile, requestIp = "") {
  const providerId = String(profile?.id || "").trim();
  if (!providerId) {
    throw new Error("OAuth profile without provider id");
  }

  const providerColumn = provider === "google" ? "google_id" : "facebook_id";
  const email = getProfileEmail(profile);
  if (email && isDisposableEmailDomain(email)) {
    const error = new Error("Disposable email domains are not allowed");
    error.code = "DISPOSABLE_EMAIL_DOMAIN";
    throw error;
  }
  const userByProvider = db
    .prepare(
      `SELECT id, username, is_admin, is_moderator, admin_display_name, moderator_display_name, admin_character_id, moderator_character_id, theme
       FROM users
       WHERE ${providerColumn} = ?`
    )
    .get(providerId);

  if (userByProvider) {
    return {
      sessionUser: toSessionUser(userByProvider),
      isNewUser: false
    };
  }

  if (email) {
    const userByEmail = db
      .prepare(
        `SELECT id, username, is_admin, is_moderator, admin_display_name, moderator_display_name, admin_character_id, moderator_character_id, theme, ${providerColumn} AS provider_value
         FROM users
         WHERE email = ?`
      )
      .get(email);

    if (userByEmail) {
      if (
        userByEmail.provider_value &&
        userByEmail.provider_value !== providerId
      ) {
        throw new Error("OAuth account already linked to another provider id");
      }

      db.prepare(
        `UPDATE users
         SET ${providerColumn} = ?, email = CASE WHEN email = '' THEN ? ELSE email END
         WHERE id = ?`
      ).run(providerId, email, userByEmail.id);

      const refreshed = getUserForSessionById(userByEmail.id);
      return {
        sessionUser: toSessionUser(refreshed),
        isNewUser: false
      };
    }
  }

  const displayName = String(profile?.displayName || "").trim();
  const emailBase = email ? email.split("@")[0] : "";
  const username = makeUniqueUsername(displayName || emailBase || provider);
  const randomPassword = crypto.randomBytes(24).toString("hex");
  const passwordHash = bcrypt.hashSync(randomPassword, 10);
  const adminCount = db
    .prepare("SELECT COUNT(*) AS count FROM users WHERE is_admin = 1")
    .get().count;
  const isAdmin = adminCount === 0 ? 1 : 0;

  const googleId = provider === "google" ? providerId : "";
  const facebookId = provider === "facebook" ? providerId : "";
  const oauthPasswordPending = provider === "google" ? 1 : 0;
  const duplicateAccountStatus = getDuplicateAccountRegistrationStatus(requestIp);

  if (duplicateAccountStatus.isBlocked) {
    const error = new Error("Duplicate accounts require admin approval");
    error.code = "DUPLICATE_ACCOUNT_IP_BLOCKED";
    error.ip = duplicateAccountStatus.ip;
    throw error;
  }

  const info = db
    .prepare(
      `INSERT INTO users
       (username, password_hash, is_admin, is_moderator, theme, email, google_id, facebook_id, registration_ip, username_changed_at, oauth_password_pending)
       VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)`
    )
    .run(
      username,
      passwordHash,
      isAdmin,
      DEFAULT_THEME,
      email,
      googleId,
      facebookId,
      duplicateAccountStatus.ip,
      oauthPasswordPending
    );

  getAccountNumberByUserId(info.lastInsertRowid);
  const created = getUserForSessionById(info.lastInsertRowid);
  return {
    sessionUser: toSessionUser(created),
    isNewUser: true
  };
}

if (GOOGLE_AUTH_ENABLED) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: GOOGLE_CALLBACK_URL
      },
      (accessToken, refreshToken, profile, done) => {
        return done(null, profile);
      }
    )
  );
}

if (FACEBOOK_AUTH_ENABLED) {
  passport.use(
    new FacebookStrategy(
      {
        clientID: FACEBOOK_APP_ID,
        clientSecret: FACEBOOK_APP_SECRET,
        callbackURL: FACEBOOK_CALLBACK_URL,
        profileFields: ["id", "displayName", "emails"]
      },
      (accessToken, refreshToken, profile, done) => {
        return done(null, profile);
      }
    )
  );
}

for (const providerStatus of Object.values(OAUTH_PROVIDERS)) {
  if (providerStatus.enabled) {
    console.log(
      `[auth] ${providerStatus.label} Login aktiv (${providerStatus.displayCallbackUrl || providerStatus.callbackUrl}).`
    );
    continue;
  }

  console.warn(
    `[auth] ${providerStatus.label} Login deaktiviert. Fehlt: ${formatOAuthMissingFields(providerStatus.missing)}.`
  );
}

function normalizeCharacterInput(body) {
  const parsedFestplayId = Number(body.festplay_id);
  return {
    server_id: normalizeServer(body.server_id),
    festplay_id:
      Number.isInteger(parsedFestplayId) && parsedFestplayId > 0
        ? parsedFestplayId
        : null,
    name: (body.name || "").trim().slice(0, 80),
    species: (body.species || "").trim().slice(0, 80),
    age: (body.age || "").trim().slice(0, 40),
    faceclaim: (body.faceclaim || "").trim().slice(0, 120),
    description: "",
    chat_text_color: normalizeGuestbookColor(body.chat_text_color),
    avatar_url: (body.avatar_url || "").trim().slice(0, 500),
    is_public: 1
  };
}

function findCharacterWithSameName(name, excludedCharacterId = null) {
  const normalizedName = String(name || "").trim();
  if (!normalizedName) return null;

  if (Number.isInteger(excludedCharacterId) && excludedCharacterId > 0) {
    return db
      .prepare(
        `SELECT id, name
         FROM characters
         WHERE lower(trim(name)) = lower(trim(?))
           AND id != ?
         LIMIT 1`
      )
      .get(normalizedName, excludedCharacterId);
  }

  return db
    .prepare(
      `SELECT id, name
       FROM characters
       WHERE lower(trim(name)) = lower(trim(?))
       LIMIT 1`
    )
    .get(normalizedName);
}

function isAvatarUrlValid(url) {
  if (!url) return true;
  return /^https?:\/\/.+/i.test(url);
}

function getCharacterById(id) {
  return db
    .prepare(
      `SELECT c.*, u.username AS owner_name, f.name AS festplay_name,
              COALESCE(gs.chat_text_color, '#AEE7B7') AS chat_text_color
       FROM characters c
       JOIN users u ON u.id = c.user_id
       LEFT JOIN festplays f ON f.id = c.festplay_id
       LEFT JOIN guestbook_settings gs ON gs.character_id = c.id
       WHERE c.id = ?`
    )
    .get(id);
}

function getCharacterBackupsForUser(userId) {
  const parsedUserId = Number(userId);
  if (!Number.isInteger(parsedUserId) || parsedUserId < 1) return [];

  return db
    .prepare(
      `SELECT id,
              user_id,
              original_character_id,
              character_name,
              server_id,
              deleted_at,
              restored_at
         FROM character_backups
        WHERE user_id = ?
          AND trim(COALESCE(restored_at, '')) = ''
        ORDER BY deleted_at DESC, id DESC`
    )
    .all(parsedUserId);
}

function parseStoredJsonArray(rawValue) {
  const prepared = String(rawValue || "").trim();
  if (!prepared) return [];

  try {
    const parsed = JSON.parse(prepared);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_error) {
    return [];
  }
}

const insertChatLogBackupStatement = db.prepare(
  `INSERT INTO chat_log_backups (
     user_id,
     character_id,
     character_name,
     room_id,
     room_label,
     server_id,
     started_at,
     ended_at,
     end_reason_text,
     participant_names_json,
     entry_count,
     log_text,
     entries_json,
     email_enabled,
     email_sent,
     email_delivery_mode,
     email_error
   ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
);

const selectActiveRoomLogsStatement = db.prepare(
  `SELECT room_id,
          server_id,
          room_label,
          started_at,
          started_by_user_id,
          started_by_name,
          participants_json,
          messages_json
     FROM active_chat_room_logs`
);

const upsertActiveRoomLogStatement = db.prepare(
  `INSERT INTO active_chat_room_logs (
     room_id,
     server_id,
     room_label,
     started_at,
     started_by_user_id,
     started_by_name,
     participants_json,
     messages_json,
     updated_at
   ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
   ON CONFLICT(room_id, server_id) DO UPDATE SET
     room_label = excluded.room_label,
     started_at = excluded.started_at,
     started_by_user_id = excluded.started_by_user_id,
     started_by_name = excluded.started_by_name,
     participants_json = excluded.participants_json,
     messages_json = excluded.messages_json,
     updated_at = CURRENT_TIMESTAMP`
);

const deleteActiveRoomLogStatement = db.prepare(
  `DELETE FROM active_chat_room_logs
    WHERE room_id = ?
      AND server_id = ?`
);

function saveChatLogBackupForUser(payload = {}) {
  const userId = Number(payload.userId);
  if (!Number.isInteger(userId) || userId < 1) {
    return false;
  }

  const characterId = Number(payload.characterId);
  const normalizedCharacterId = Number.isInteger(characterId) && characterId > 0 ? characterId : 0;
  const characterName = String(payload.characterName || "").trim() || "Unbekannt";
  const roomId = Number(payload.roomId);
  const normalizedRoomId = Number.isInteger(roomId) && roomId > 0 ? roomId : 0;
  const participantNames = Array.from(
    new Set((Array.isArray(payload.participantNames) ? payload.participantNames : [])
      .map((entry) => String(entry || "").trim())
      .filter(Boolean))
  );
  const entries = Array.isArray(payload.entries) ? payload.entries : [];

  insertChatLogBackupStatement.run(
    userId,
    normalizedCharacterId,
    characterName,
    normalizedRoomId,
    String(payload.roomLabel || "").trim(),
    normalizeServer(payload.serverId),
    String(payload.startedAt || "").trim(),
    String(payload.endedAt || "").trim(),
    String(payload.endReasonText || "").trim(),
    JSON.stringify(participantNames),
    entries.length,
    String(payload.logText || "").trim(),
    JSON.stringify(entries),
    payload.emailEnabled ? 1 : 0,
    payload.emailSent ? 1 : 0,
    String(payload.emailDeliveryMode || "").trim(),
    String(payload.emailError || "").trim()
  );

  return true;
}

function getChatLogBackupCharactersForUser(userId) {
  const parsedUserId = Number(userId);
  if (!Number.isInteger(parsedUserId) || parsedUserId < 1) return [];

  return db
    .prepare(
      `SELECT character_id,
              character_name,
              server_id,
              COUNT(*) AS log_count,
              MAX(COALESCE(NULLIF(ended_at, ''), created_at)) AS last_log_at
         FROM chat_log_backups
        WHERE user_id = ?
        GROUP BY character_id, character_name, server_id
        ORDER BY last_log_at DESC, lower(character_name) ASC`
    )
    .all(parsedUserId);
}

function buildChatLogBackupDetailTarget(characterId, characterName = "", serverId = "") {
  const parsedCharacterId = Number(characterId);
  if (!Number.isInteger(parsedCharacterId) || parsedCharacterId < 0) {
    return "/character-backups/logs";
  }

  const searchParams = new URLSearchParams();
  if (parsedCharacterId === 0) {
    const normalizedCharacterName = String(characterName || "").trim();
    const normalizedServerId = String(serverId || "").trim();
    if (normalizedCharacterName) {
      searchParams.set("name", normalizedCharacterName);
    }
    if (normalizedServerId) {
      searchParams.set("server_id", normalizeServer(normalizedServerId));
    }
  }

  const query = searchParams.toString();
  return `/character-backups/logs/${parsedCharacterId}${query ? `?${query}` : ""}`;
}

function getChatLogBackupsForUserCharacter(userId, characterId, options = {}) {
  const parsedUserId = Number(userId);
  const parsedCharacterId = Number(characterId);
  if (!Number.isInteger(parsedUserId) || parsedUserId < 1) return [];
  if (!Number.isInteger(parsedCharacterId) || parsedCharacterId < 0) return [];

  const clauses = ["user_id = ?", "character_id = ?"];
  const values = [parsedUserId, parsedCharacterId];
  const requestedCharacterName = String(options.characterName || "").trim();
  const requestedServerId = String(options.serverId || "").trim();

  if (parsedCharacterId === 0 && requestedCharacterName) {
    clauses.push("character_name = ?");
    values.push(requestedCharacterName);
  }

  if (parsedCharacterId === 0 && requestedServerId) {
    clauses.push("server_id = ?");
    values.push(normalizeServer(requestedServerId));
  }

  return db
    .prepare(
      `SELECT id,
              character_id,
              character_name,
              room_id,
              room_label,
              server_id,
              started_at,
              ended_at,
              end_reason_text,
              participant_names_json,
              entry_count,
              log_text,
              email_enabled,
              email_sent,
              email_delivery_mode,
              email_error,
              created_at
         FROM chat_log_backups
        WHERE ${clauses.join(" AND ")}
        ORDER BY COALESCE(NULLIF(ended_at, ''), created_at) DESC, id DESC`
    )
    .all(...values)
    .map((row) => ({
      ...row,
      participant_names: parseStoredJsonArray(row.participant_names_json)
    }));
}

function parseCharacterBackupSnapshot(rawValue) {
  const prepared = String(rawValue || "").trim();
  if (!prepared) return null;

  try {
    const parsed = JSON.parse(prepared);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (_error) {
    return null;
  }
}

function cloneDbRow(row) {
  return row && typeof row === "object" ? { ...row } : null;
}

function cloneDbRows(rows) {
  return Array.isArray(rows) ? rows.map((row) => ({ ...row })) : [];
}

function sanitizeCharacterBackupName(rawValue) {
  const originalName = String(rawValue || "").replace(/\s+/g, " ").trim();
  if (!originalName) return "";

  const sanitizedName = originalName.replace(/\bbackup\b/gi, " ").replace(/\s+/g, " ").trim();
  return sanitizedName || originalName;
}

function buildCharacterBackupSnapshot(characterId) {
  const parsedCharacterId = Number(characterId);
  if (!Number.isInteger(parsedCharacterId) || parsedCharacterId < 1) {
    return null;
  }

  const character = db
    .prepare("SELECT * FROM characters WHERE id = ?")
    .get(parsedCharacterId);

  if (!character) {
    return null;
  }

  const sanitizedCharacterName = sanitizeCharacterBackupName(character.name);

  return {
    version: 1,
    character: {
      ...cloneDbRow(character),
      name: sanitizedCharacterName
    },
    guestbookSettings: cloneDbRow(
      db
        .prepare("SELECT * FROM guestbook_settings WHERE character_id = ?")
        .get(parsedCharacterId)
    ),
    guestbookPages: cloneDbRows(
      db
        .prepare(
          `SELECT *
             FROM guestbook_pages
            WHERE character_id = ?
            ORDER BY page_number ASC, id ASC`
        )
        .all(parsedCharacterId)
    ),
    guestbookEntries: cloneDbRows(
      db
        .prepare(
          `SELECT *
             FROM guestbook_entries
            WHERE character_id = ?
            ORDER BY id ASC`
        )
        .all(parsedCharacterId)
    )
  };
}

function insertTableRow(tableName, row) {
  if (!row || typeof row !== "object") return;
  const columns = Object.keys(row);
  if (!columns.length) return;

  const placeholders = columns.map(() => "?").join(", ");
  const values = columns.map((column) => row[column]);
  db.prepare(
    `INSERT INTO ${tableName} (${columns.join(", ")})
     VALUES (${placeholders})`
  ).run(...values);
}

const deleteCharacterWithBackupTx = db.transaction((characterId) => {
  const snapshot = buildCharacterBackupSnapshot(characterId);
  if (!snapshot?.character) {
    const error = new Error("character_not_found");
    error.code = "CHARACTER_NOT_FOUND";
    throw error;
  }

  db.prepare(
    `INSERT INTO character_backups
       (user_id, original_character_id, character_name, server_id, snapshot_json)
     VALUES (?, ?, ?, ?, ?)`
  ).run(
    snapshot.character.user_id,
    snapshot.character.id,
    sanitizeCharacterBackupName(snapshot.character.name),
    normalizeServer(snapshot.character.server_id),
    JSON.stringify(snapshot)
  );

  db.prepare("UPDATE users SET admin_character_id = NULL WHERE admin_character_id = ?").run(characterId);
  db.prepare("UPDATE users SET moderator_character_id = NULL WHERE moderator_character_id = ?").run(characterId);
  db.prepare("UPDATE festplays SET creator_character_id = NULL WHERE creator_character_id = ?").run(characterId);
  deleteGuestbookNotificationsForCharacter(characterId);
  db.prepare("DELETE FROM characters WHERE id = ?").run(characterId);
});

const restoreCharacterBackupTx = db.transaction((backupId, userId) => {
  const parsedBackupId = Number(backupId);
  const parsedUserId = Number(userId);
  const backup = db
    .prepare(
      `SELECT *
         FROM character_backups
        WHERE id = ?
          AND user_id = ?
          AND trim(COALESCE(restored_at, '')) = ''`
    )
    .get(parsedBackupId, parsedUserId);

  if (!backup) {
    const error = new Error("backup_not_found");
    error.code = "BACKUP_NOT_FOUND";
    throw error;
  }

  const snapshot = parseCharacterBackupSnapshot(backup.snapshot_json);
  if (!snapshot?.character) {
    const error = new Error("backup_invalid");
    error.code = "BACKUP_INVALID";
    throw error;
  }

  const restoredCharacter = {
    ...snapshot.character,
    user_id: parsedUserId,
    name: sanitizeCharacterBackupName(snapshot.character.name),
    server_id: normalizeServer(snapshot.character.server_id),
    festplay_id: null,
    festplay_dashboard_mode: "main"
  };

  const duplicateCharacter = findCharacterWithSameName(restoredCharacter.name);
  if (duplicateCharacter) {
    const error = new Error("character_name_taken");
    error.code = "CHARACTER_NAME_TAKEN";
    throw error;
  }

  const existingCharacterId = db
    .prepare("SELECT id FROM characters WHERE id = ?")
    .get(restoredCharacter.id);
  if (existingCharacterId) {
    const error = new Error("character_id_taken");
    error.code = "CHARACTER_ID_TAKEN";
    throw error;
  }

  insertTableRow("characters", restoredCharacter);

  if (snapshot.guestbookSettings) {
    insertTableRow("guestbook_settings", {
      ...snapshot.guestbookSettings,
      character_id: restoredCharacter.id
    });
  }

  (Array.isArray(snapshot.guestbookPages) ? snapshot.guestbookPages : []).forEach((page) => {
    insertTableRow("guestbook_pages", {
      ...page,
      character_id: restoredCharacter.id
    });
  });

  (Array.isArray(snapshot.guestbookEntries) ? snapshot.guestbookEntries : []).forEach((entry) => {
    insertTableRow("guestbook_entries", {
      ...entry,
      character_id: restoredCharacter.id,
      author_character_id:
        Number(entry.author_character_id) === Number(backup.original_character_id)
          ? restoredCharacter.id
          : entry.author_character_id
    });
  });

  db.prepare(
    `UPDATE character_backups
        SET restored_at = CURRENT_TIMESTAMP
      WHERE id = ?`
  ).run(parsedBackupId);

  return {
    id: restoredCharacter.id,
    name: restoredCharacter.name
  };
});

const cleanExistingCharacterBackupNamesTx = db.transaction(() => {
  const backups = db
    .prepare(
      `SELECT id,
              original_character_id,
              character_name,
              restored_at,
              snapshot_json
         FROM character_backups`
    )
    .all();

  backups.forEach((backup) => {
    const snapshot = parseCharacterBackupSnapshot(backup.snapshot_json);
    const snapshotName = snapshot?.character?.name || backup.character_name || "";
    const sanitizedName = sanitizeCharacterBackupName(snapshotName);
    const currentBackupName = String(backup.character_name || "").trim();
    let shouldUpdateBackupRow = false;
    let nextSnapshotJson = backup.snapshot_json;

    if (snapshot?.character && snapshot.character.name !== sanitizedName) {
      snapshot.character.name = sanitizedName;
      nextSnapshotJson = JSON.stringify(snapshot);
      shouldUpdateBackupRow = true;
    }

    if (currentBackupName !== sanitizedName) {
      shouldUpdateBackupRow = true;
    }

    if (shouldUpdateBackupRow) {
      db.prepare(
        `UPDATE character_backups
            SET character_name = ?,
                snapshot_json = ?
          WHERE id = ?`
      ).run(sanitizedName, nextSnapshotJson, backup.id);
    }

    if (!String(backup.restored_at || "").trim()) {
      return;
    }

    const restoredCharacter = db
      .prepare("SELECT id, name FROM characters WHERE id = ?")
      .get(backup.original_character_id);

    if (!restoredCharacter) {
      return;
    }

    if (String(restoredCharacter.name || "").trim() === sanitizedName) {
      return;
    }

    const duplicateCharacter = db
      .prepare("SELECT id FROM characters WHERE lower(trim(name)) = lower(trim(?)) AND id != ? LIMIT 1")
      .get(sanitizedName, restoredCharacter.id);

    if (duplicateCharacter) {
      return;
    }

    db.prepare(
      `UPDATE characters
          SET name = ?,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`
    ).run(sanitizedName, restoredCharacter.id);
  });
});

try {
  cleanExistingCharacterBackupNamesTx();
} catch (error) {
  console.error("Konnte bestehende Backup-Namen nicht bereinigen:", error);
}

function getFestplays() {
  return db
    .prepare(
      `SELECT id, name
       FROM festplays
       ORDER BY lower(name) ASC`
    )
    .all();
}

function normalizeFestplayName(input) {
  return String(input || "").trim().replace(/\s+/g, " ").slice(0, 80);
}

function normalizeFestplayText(input, maxLength) {
  const normalized = String(input || "").replace(/\r\n/g, "\n").trim();
  if (!Number.isInteger(maxLength) || maxLength < 1) {
    return normalized;
  }
  return normalized.slice(0, maxLength);
}

function normalizeFestplayServerId(serverValue) {
  const normalizedValue = String(serverValue || "").trim().toLowerCase();
  return ALLOWED_SERVER_IDS.has(normalizedValue) ? normalizedValue : "";
}

function decorateFestplayRecord(festplay) {
  if (!festplay) return null;
  const creatorCharacterName = String(festplay.creator_character_name || "").trim();
  const serverId = normalizeFestplayServerId(festplay.server_id);
  return {
    ...festplay,
    creator_character_name: creatorCharacterName,
    creator_display_name: creatorCharacterName,
    server_id: serverId,
    server_label: serverId ? getServerLabel(serverId) : "",
    is_server_locked: Boolean(serverId),
    is_public: Number(festplay.is_public) === 1,
    long_description_html: festplay.long_description
      ? renderGuestbookBbcode(festplay.long_description)
      : ""
  };
}

function festplayExists(festplayId) {
  if (!Number.isInteger(festplayId) || festplayId < 1) return false;
  const row = db
    .prepare("SELECT id FROM festplays WHERE id = ?")
    .get(festplayId);
  return Boolean(row);
}

function touchFestplayActivity(festplayId, activityAt = null) {
  const parsedFestplayId = Number(festplayId);
  if (!Number.isInteger(parsedFestplayId) || parsedFestplayId < 1) {
    return false;
  }

  const trimmedActivityAt = String(activityAt || "").trim();
  const result = trimmedActivityAt
    ? db.prepare("UPDATE festplays SET last_activity_at = ? WHERE id = ?").run(trimmedActivityAt, parsedFestplayId)
    : db.prepare("UPDATE festplays SET last_activity_at = CURRENT_TIMESTAMP WHERE id = ?").run(parsedFestplayId);

  return Number(result.changes) > 0;
}

function touchFestplayActivityForRoom(room) {
  const festplayId = Number(room?.festplay_id);
  if (!Number.isInteger(festplayId) || festplayId < 1) {
    return false;
  }

  return touchFestplayActivity(festplayId);
}

function getLiveFestplayIdsWithChatPresence() {
  const sockets = io?.of("/")?.sockets;
  if (!sockets || typeof sockets.values !== "function") {
    return new Set();
  }

  const liveFestplayIds = new Set();
  for (const socket of sockets.values()) {
    if (!socket?.data?.user || socket?.data?.hasJoinedChat !== true) {
      continue;
    }

    const roomId = Number.isInteger(socket.data.roomId) && socket.data.roomId > 0
      ? socket.data.roomId
      : null;
    if (!roomId) {
      continue;
    }

    const room = getRoomWithCharacter(roomId);
    const festplayId = Number(room?.festplay_id);
    if (Number.isInteger(festplayId) && festplayId > 0) {
      liveFestplayIds.add(festplayId);
    }
  }

  return liveFestplayIds;
}

function getOwnedFestplaysForUser(userId, serverId = "") {
  const parsedUserId = Number(userId);
  const normalizedServerId = normalizeFestplayServerId(serverId);
  if (!Number.isInteger(parsedUserId) || parsedUserId < 1) return [];
  return db
    .prepare(
      `SELECT f.id,
              f.name,
              f.is_public,
              f.short_description,
              f.long_description,
              f.created_by_user_id,
              f.server_id,
              COALESCE(creator.name, '') AS creator_character_name
         FROM festplays f
         LEFT JOIN characters creator ON creator.id = f.creator_character_id
         WHERE created_by_user_id = ?
           AND (? = '' OR lower(trim(COALESCE(f.server_id, ''))) = ?)
         ORDER BY f.created_at ASC, f.id ASC`
    )
    .all(parsedUserId, normalizedServerId, normalizedServerId)
    .map(decorateFestplayRecord);
}

function getOtherFestplaysForUser(userId, serverId) {
  const parsedUserId = Number(userId);
  const normalizedServerId = normalizeServer(serverId);
  if (!Number.isInteger(parsedUserId) || parsedUserId < 1) return [];
  return db
    .prepare(
      `SELECT DISTINCT
              f.id,
              f.name,
              f.is_public,
              f.short_description,
              f.long_description,
              f.server_id,
              COALESCE(creator.name, '') AS creator_character_name
         FROM festplays f
         LEFT JOIN characters creator ON creator.id = f.creator_character_id
         WHERE COALESCE(f.created_by_user_id, 0) != ?
           AND NOT (
             lower(trim(COALESCE(f.name, ''))) = 'freeplay'
             AND COALESCE(f.created_by_user_id, 0) = 0
             AND COALESCE(f.creator_character_id, 0) = 0
           )
           AND (trim(COALESCE(f.server_id, '')) = '' OR lower(trim(f.server_id)) = ?)
           AND (
             EXISTS (
               SELECT 1
               FROM characters c
               WHERE c.festplay_id = f.id
                 AND c.user_id = ?
                 AND c.server_id = ?
             )
             OR EXISTS (
               SELECT 1
               FROM festplay_permissions fp
               JOIN characters c ON c.id = fp.character_id
               WHERE fp.festplay_id = f.id
                 AND fp.user_id = ?
                 AND c.server_id = ?
             )
           )
         ORDER BY lower(f.name) ASC, f.id ASC`
    )
    .all(
      parsedUserId,
      normalizedServerId,
      parsedUserId,
      normalizedServerId,
      parsedUserId,
      normalizedServerId
    )
    .map(decorateFestplayRecord);
}

function getDashboardFestplaysForUser(userId, serverId) {
  const parsedUserId = Number(userId);
  const normalizedServerId = normalizeServer(serverId);
  if (!Number.isInteger(parsedUserId) || parsedUserId < 1) return [];

  const festplayMap = new Map();
  const addDashboardFestplayCharacter = (row, caption) => {
    const festplayId = Number(row.id);
    if (!Number.isInteger(festplayId) || festplayId < 1) {
      return;
    }

    const characterId = Number(row.character_id);
    if (!Number.isInteger(characterId) || characterId < 1) {
      return;
    }

    const characterServerId =
      normalizeServer(row.character_server_id || row.linked_character_server_id) || normalizedServerId;
    const dashboardPosition = getCharacterDashboardPlacement(
      characterServerId,
      normalizedServerId,
      row.character_festplay_dashboard_mode || row.linked_character_festplay_dashboard_mode
    );
    const isInFestplayArea = dashboardPosition === "festplay";

    if (!festplayMap.has(festplayId)) {
      festplayMap.set(festplayId, {
        id: festplayId,
        name: row.name,
        creator_character_name: row.creator_character_name,
        caption: String(caption || "").trim(),
        server_id: normalizedServerId,
        characters: []
      });
    }

    const festplay = festplayMap.get(festplayId);
    if (!festplay.characters.some((character) => Number(character.id) === characterId)) {
      festplay.characters.push({
        id: characterId,
        name: row.character_name,
        current_server_id: characterServerId,
        current_server_label: getServerLabel(characterServerId),
        is_on_festplay_server: characterServerId === normalizedServerId,
        is_in_festplay_area: isInFestplayArea,
        dashboard_position: dashboardPosition
      });
    }
  };

  const approvedRows = db
    .prepare(
      `SELECT DISTINCT
              f.id,
              f.name,
              f.server_id,
              COALESCE(creator.name, '') AS creator_character_name,
              c.id AS character_id,
              c.name AS character_name,
              c.server_id AS character_server_id,
              c.festplay_dashboard_mode AS character_festplay_dashboard_mode
         FROM festplay_permissions fp
         JOIN festplays f ON f.id = fp.festplay_id
         LEFT JOIN characters creator ON creator.id = f.creator_character_id
         JOIN characters c ON c.id = fp.character_id
         WHERE fp.user_id = ?
           AND (trim(COALESCE(f.server_id, '')) = '' OR lower(trim(f.server_id)) = ?)
           AND COALESCE(f.created_by_user_id, 0) != ?
         ORDER BY lower(f.name) ASC, f.id ASC, lower(c.name) ASC, c.id ASC`
    )
    .all(parsedUserId, normalizedServerId, parsedUserId);

  approvedRows.forEach((row) => {
    addDashboardFestplayCharacter(
      row,
      row.creator_character_name
        ? `Festspiel von ${row.creator_character_name}.`
        : "Freigeschaltetes Festspiel auf diesem Bereich."
    );
  });

  const fallbackOwnedCharacters = db
    .prepare(
      `SELECT f.id AS festplay_id,
              c.id AS character_id,
              c.name AS character_name,
              c.server_id AS character_server_id,
              c.festplay_dashboard_mode AS character_festplay_dashboard_mode
         FROM festplays f
         JOIN characters c
           ON c.user_id = f.created_by_user_id
        WHERE f.created_by_user_id = ?
          AND (trim(COALESCE(f.server_id, '')) = '' OR lower(trim(f.server_id)) = ?)
          AND (
            c.festplay_id = f.id
            OR EXISTS (
              SELECT 1
                FROM festplay_permissions fp
               WHERE fp.festplay_id = f.id
                 AND fp.character_id = c.id
            )
          )
        ORDER BY lower(f.name) ASC,
                 f.id ASC,
                 CASE WHEN c.festplay_id = f.id THEN 0 ELSE 1 END ASC,
                 lower(c.name) ASC,
                 c.id ASC`
    )
    .all(parsedUserId, normalizedServerId);

  const fallbackOwnedCharacterMap = new Map();
  fallbackOwnedCharacters.forEach((row) => {
    const festplayId = Number(row.festplay_id);
    if (!Number.isInteger(festplayId) || festplayId < 1 || fallbackOwnedCharacterMap.has(festplayId)) {
      return;
    }

    fallbackOwnedCharacterMap.set(festplayId, row);
  });

  const ownedRows = db
    .prepare(
      `SELECT f.id,
              f.name,
              f.creator_character_id,
              f.server_id,
              COALESCE(creator.name, '') AS creator_character_name,
              creator.id AS linked_character_id,
              creator.name AS linked_character_name,
              creator.user_id AS linked_character_user_id,
              creator.server_id AS linked_character_server_id,
              creator.festplay_dashboard_mode AS linked_character_festplay_dashboard_mode
         FROM festplays f
         LEFT JOIN characters creator ON creator.id = f.creator_character_id
         WHERE f.created_by_user_id = ?
           AND (trim(COALESCE(f.server_id, '')) = '' OR lower(trim(f.server_id)) = ?)
         ORDER BY lower(f.name) ASC, f.id ASC`
    )
    .all(parsedUserId, normalizedServerId);

  ownedRows.forEach((row) => {
    const linkedCharacterId = Number(row.linked_character_id);
    const linkedCharacterUserId = Number(row.linked_character_user_id);
    if (
      Number.isInteger(linkedCharacterId) &&
      linkedCharacterId > 0 &&
      linkedCharacterUserId === parsedUserId
    ) {
      addDashboardFestplayCharacter(
        {
          ...row,
          character_id: linkedCharacterId,
          character_name: row.linked_character_name,
          character_server_id: row.linked_character_server_id,
          character_festplay_dashboard_mode: row.linked_character_festplay_dashboard_mode
        },
        row.creator_character_name
          ? `Erstellt mit ${row.creator_character_name}.`
          : "Dein eigenes Festspiel."
      );
      return;
    }

    if (Number.isInteger(Number(row.creator_character_id)) && Number(row.creator_character_id) > 0) {
      return;
    }

    const fallbackCharacter = fallbackOwnedCharacterMap.get(Number(row.id));
    if (!fallbackCharacter) {
      return;
    }

    addDashboardFestplayCharacter(
        {
          ...row,
          character_id: fallbackCharacter.character_id,
          character_name: fallbackCharacter.character_name,
          character_server_id: fallbackCharacter.character_server_id,
          character_festplay_dashboard_mode: fallbackCharacter.character_festplay_dashboard_mode
        },
      row.creator_character_name
        ? `Erstellt mit ${row.creator_character_name}.`
        : "Dein eigenes Festspiel."
    );
  });

  return Array.from(festplayMap.values())
    .map((festplay) => ({
      ...festplay,
      characters: [...festplay.characters].sort((left, right) => {
        if (Boolean(left.is_in_festplay_area) !== Boolean(right.is_in_festplay_area)) {
          return left.is_in_festplay_area ? -1 : 1;
        }

        if (Boolean(left.is_on_festplay_server) !== Boolean(right.is_on_festplay_server)) {
          return left.is_on_festplay_server ? -1 : 1;
        }

        const nameCompare = String(left.name || "").localeCompare(String(right.name || ""), "de", {
          sensitivity: "base"
        });
        if (nameCompare !== 0) {
          return nameCompare;
        }

        return Number(left.id) - Number(right.id);
      })
    }))
    .sort((left, right) => {
      const nameCompare = String(left.name || "").localeCompare(String(right.name || ""), "de", {
        sensitivity: "base"
      });
      if (nameCompare !== 0) {
        return nameCompare;
      }
      return Number(left.id) - Number(right.id);
    });
}

function getOwnedFestplayById(userId, festplayId) {
  const parsedUserId = Number(userId);
  const parsedFestplayId = Number(festplayId);
  if (
    !Number.isInteger(parsedUserId) ||
    parsedUserId < 1 ||
    !Number.isInteger(parsedFestplayId) ||
    parsedFestplayId < 1
  ) {
    return null;
  }
  return (
    (() => {
      const festplay = db
      .prepare(
        `SELECT f.id,
                f.name,
                f.is_public,
                f.short_description,
                f.long_description,
                f.created_by_user_id,
                f.server_id,
                COALESCE(creator.name, '') AS creator_character_name
           FROM festplays f
           LEFT JOIN characters creator ON creator.id = f.creator_character_id
           WHERE f.id = ?
             AND f.created_by_user_id = ?`
      )
      .get(parsedFestplayId, parsedUserId);
      return decorateFestplayRecord(festplay);
    })()
  );
}

function getPublicFestplays(serverId = "") {
  const normalizedServerId = normalizeFestplayServerId(serverId);
  return db
    .prepare(
      `SELECT f.id,
              f.name,
              f.is_public,
              f.short_description,
              f.long_description,
              f.server_id,
              COALESCE(creator.name, '') AS creator_character_name
         FROM festplays f
         LEFT JOIN characters creator ON creator.id = f.creator_character_id
         WHERE f.is_public = 1
           AND COALESCE(f.created_by_user_id, 0) > 0
           AND (? = '' OR trim(COALESCE(f.server_id, '')) = '' OR lower(trim(COALESCE(f.server_id, ''))) = ?)
         ORDER BY lower(f.name) ASC, f.id ASC`
    )
    .all(normalizedServerId, normalizedServerId)
    .map(decorateFestplayRecord);
}

function getPublicFestplayById(festplayId, serverId = "") {
  const parsedFestplayId = Number(festplayId);
  const normalizedServerId = normalizeFestplayServerId(serverId);
  if (!Number.isInteger(parsedFestplayId) || parsedFestplayId < 1) return null;
  return decorateFestplayRecord(
    db
      .prepare(
        `SELECT f.id,
                f.name,
                f.is_public,
                f.short_description,
                f.long_description,
                f.server_id,
                COALESCE(creator.name, '') AS creator_character_name,
                f.created_by_user_id
             FROM festplays f
             LEFT JOIN characters creator ON creator.id = f.creator_character_id
             WHERE f.id = ?
               AND f.is_public = 1
               AND (? = '' OR trim(COALESCE(f.server_id, '')) = '' OR lower(trim(COALESCE(f.server_id, ''))) = ?)
               AND COALESCE(f.created_by_user_id, 0) > 0`
        )
      .get(parsedFestplayId, normalizedServerId, normalizedServerId)
  );
}

function canCharacterManageFestplayRooms(festplay, character, userId) {
  const parsedUserId = Number(userId);
  if (!festplay || !character || !Number.isInteger(parsedUserId) || parsedUserId < 1) {
    return false;
  }

  if (Number(festplay.created_by_user_id) === parsedUserId) {
    return true;
  }

  return characterHasFestplayRoomRights(festplay.id, character.id, parsedUserId);
}

function buildFestplayEditorTarget(characterId, festplayId, options = {}) {
  const parsedCharacterId = Number(characterId);
  const parsedFestplayId = Number(festplayId);
  if (
    !Number.isInteger(parsedCharacterId) ||
    parsedCharacterId < 1 ||
    !Number.isInteger(parsedFestplayId) ||
    parsedFestplayId < 1
  ) {
    return `/characters/${characterId}/festplays`;
  }

  const overview =
    String(options?.overview || "").trim().toLowerCase() === "andere"
      ? "andere"
      : "eigene";
  const tab = String(options?.tab || "").trim().toLowerCase();
  const parsedRoomId = Number(options?.roomId);
  const params = new URLSearchParams();
  if (overview === "andere") {
    params.set("overview", "andere");
  }
  params.set("selected_festplay", String(parsedFestplayId));
  if (tab === "raeume" || tab === "bewerbungen") {
    params.set("tab", tab);
  }
  if (Number.isInteger(parsedRoomId) && parsedRoomId > 0) {
    params.set("selected_room", String(parsedRoomId));
  }
  return `/characters/${parsedCharacterId}/festplays?${params.toString()}#festplay-selected-editor`;
}

function getFestplayRoomsForUser(userId, festplayId, options = {}) {
  const parsedUserId = Number(userId);
  const parsedFestplayId = Number(festplayId);
  const manualOnly = options?.manualOnly !== false;
  const supportsSortOrder = hasChatRoomColumn("sort_order");
  if (
    !Number.isInteger(parsedUserId) ||
    parsedUserId < 1 ||
    !Number.isInteger(parsedFestplayId) ||
    parsedFestplayId < 1
  ) {
    return [];
  }

  return db
    .prepare(
      `SELECT r.id,
              r.name,
              r.description,
              r.teaser,
              r.image_url,
              r.character_id,
              r.email_log_enabled,
              r.is_locked,
              r.is_public_room,
              r.is_saved_room,
              COALESCE(r.is_manual_festplay_room, 0) AS is_manual_festplay_room,
              ${supportsSortOrder ? "COALESCE(r.sort_order, 0)" : "0"} AS sort_order,
              r.server_id,
              r.created_at,
              r.created_by_user_id,
              anchor.name AS creator_character_name,
              CASE
                WHEN r.created_by_user_id = ? THEN 1
                WHEN EXISTS (
                  SELECT 1
                    FROM chat_room_permissions crp
                   WHERE crp.room_id = r.id
                     AND crp.user_id = ?
                ) THEN 1
                ELSE 0
              END AS can_manage_room
         FROM chat_rooms r
         JOIN characters anchor ON anchor.id = r.character_id
        WHERE r.festplay_id = ?
          AND COALESCE(r.is_festplay_chat, 0) = 1
          ${manualOnly ? "AND COALESCE(r.is_manual_festplay_room, 0) = 1" : ""}
        ORDER BY ${supportsSortOrder ? "COALESCE(r.sort_order, 0) ASC," : ""} r.created_at ASC, r.id ASC`
     )
    .all(parsedUserId, parsedUserId, parsedFestplayId)
    .map((room) => ({
      ...room,
      sort_order: Number(room.sort_order) || 0,
      email_log_enabled: Number(room.email_log_enabled) === 1,
      is_locked: Number(room.is_locked) === 1,
      is_public_room: Number(room.is_public_room) === 1,
      is_saved_room: Number(room.is_saved_room) === 1,
      is_manual_festplay_room: Number(room.is_manual_festplay_room) === 1,
      teaser_html: room.teaser ? renderGuestbookBbcode(room.teaser) : "",
      can_manage_room: Number(room.can_manage_room) === 1,
      can_enter:
        Number(room.is_locked) !== 1 ||
        Number(room.can_manage_room) === 1 ||
        hasRoomInviteAccess({ id: parsedUserId }, room),
      is_owned_room: Number(room.created_by_user_id) === parsedUserId
    }));
}

function isLegacyAutoFestplayRoom(room, festplay) {
  const roomName = String(room?.name || "").trim().toLowerCase();
  const festplayName = String(festplay?.name || "").trim().toLowerCase();

  if (!roomName || !festplayName || roomName !== festplayName) {
    return false;
  }

  if (Number(room?.created_by_user_id) !== Number(festplay?.created_by_user_id)) {
    return false;
  }

  if (normalizeServer(room?.server_id) !== normalizeServer(festplay?.server_id)) {
    return false;
  }

  return (
    !String(room?.description || "").trim() &&
    !String(room?.teaser || "").trim() &&
    !String(room?.image_url || "").trim() &&
    room?.email_log_enabled !== true &&
    room?.is_locked !== true &&
    room?.is_public_room !== true
  );
}

function characterHasFestplayRoomRights(festplayId, characterId, userId = null) {
  const parsedFestplayId = Number(festplayId);
  const parsedCharacterId = Number(characterId);
  const parsedUserId = Number(userId);
  if (
    !Number.isInteger(parsedFestplayId) ||
    parsedFestplayId < 1 ||
    !Number.isInteger(parsedCharacterId) ||
    parsedCharacterId < 1
  ) {
    return false;
  }

  const creatorMatch = Number.isInteger(parsedUserId) && parsedUserId > 0
    ? db
        .prepare(
          `SELECT 1
             FROM festplays
            WHERE id = ?
              AND creator_character_id = ?
              AND created_by_user_id = ?
            LIMIT 1`
        )
        .get(parsedFestplayId, parsedCharacterId, parsedUserId)
    : db
        .prepare(
          `SELECT 1
             FROM festplays
            WHERE id = ?
              AND creator_character_id = ?
            LIMIT 1`
        )
        .get(parsedFestplayId, parsedCharacterId);
  if (creatorMatch) {
    return true;
  }

  const permissionMatch = Number.isInteger(parsedUserId) && parsedUserId > 0
    ? db
        .prepare(
          `SELECT 1
             FROM festplay_permissions
            WHERE festplay_id = ?
              AND character_id = ?
              AND user_id = ?
              AND COALESCE(source, 'manual') = 'manual'
             LIMIT 1`
        )
        .get(parsedFestplayId, parsedCharacterId, parsedUserId)
    : db
        .prepare(
          `SELECT 1
             FROM festplay_permissions
            WHERE festplay_id = ?
              AND character_id = ?
              AND COALESCE(source, 'manual') = 'manual'
             LIMIT 1`
        )
        .get(parsedFestplayId, parsedCharacterId);

  return Boolean(permissionMatch);
}

function getFestplayById(festplayId) {
  const parsedFestplayId = Number(festplayId);
  if (!Number.isInteger(parsedFestplayId) || parsedFestplayId < 1) {
    return null;
  }

  return decorateFestplayRecord(
    db
      .prepare(
        `SELECT f.id,
                f.name,
                f.is_public,
                f.short_description,
                f.long_description,
                f.server_id,
                f.created_by_user_id,
                f.creator_character_id,
                COALESCE(creator.name, '') AS creator_character_name
           FROM festplays f
           LEFT JOIN characters creator ON creator.id = f.creator_character_id
           WHERE f.id = ?`
      )
      .get(parsedFestplayId)
  );
}

function getFestplayServerBinding(festplayId) {
  const parsedFestplayId = Number(festplayId);
  if (!Number.isInteger(parsedFestplayId) || parsedFestplayId < 1) {
    return null;
  }

  const festplay = db
    .prepare(
      `SELECT id, name, server_id
         FROM festplays
         WHERE id = ?`
    )
    .get(parsedFestplayId);
  if (!festplay) {
    return null;
  }

  const serverId = normalizeFestplayServerId(festplay.server_id);
  return {
    ...festplay,
    server_id: serverId,
    server_label: serverId ? getServerLabel(serverId) : ""
  };
}

function getPreferredFestplayChatCharacterForUser(userId, festplayId, preferredCharacterId = null) {
  const parsedUserId = Number(userId);
  const parsedFestplayId = Number(festplayId);
  const parsedPreferredCharacterId = Number(preferredCharacterId);
  if (
    !Number.isInteger(parsedUserId) ||
    parsedUserId < 1 ||
    !Number.isInteger(parsedFestplayId) ||
    parsedFestplayId < 1
  ) {
    return null;
  }

  return (
    db
      .prepare(
        `SELECT c.id,
                c.name,
                c.server_id,
                COALESCE(gs.chat_text_color, '#AEE7B7') AS chat_text_color
           FROM characters c
           LEFT JOIN guestbook_settings gs ON gs.character_id = c.id
           WHERE c.user_id = ?
             AND (
               c.festplay_id = ?
               OR EXISTS (
                 SELECT 1
                   FROM festplays f
                  WHERE f.id = ?
                    AND f.creator_character_id = c.id
                    AND COALESCE(f.created_by_user_id, 0) = ?
               )
               OR EXISTS (
                 SELECT 1
                 FROM festplay_permissions fp
                 WHERE fp.festplay_id = ?
                   AND fp.character_id = c.id
               )
             )
           ORDER BY CASE WHEN c.id = ? THEN 0 ELSE 1 END,
                    lower(c.name) ASC,
                    c.id ASC
           LIMIT 1`
      )
      .get(
        parsedUserId,
        parsedFestplayId,
        parsedFestplayId,
        parsedUserId,
        parsedFestplayId,
        parsedPreferredCharacterId
      ) || null
  );
}

function userHasFestplayAccess(userId, festplayId) {
  const parsedUserId = Number(userId);
  const parsedFestplayId = Number(festplayId);
  if (
    !Number.isInteger(parsedUserId) ||
    parsedUserId < 1 ||
    !Number.isInteger(parsedFestplayId) ||
    parsedFestplayId < 1
  ) {
    return false;
  }

  return Boolean(
    db
      .prepare(
        `SELECT 1
           FROM festplays f
          WHERE f.id = ?
            AND (
              COALESCE(f.created_by_user_id, 0) = ?
              OR EXISTS (
                SELECT 1
                  FROM characters c
                 WHERE c.user_id = ?
                   AND c.festplay_id = f.id
              )
              OR EXISTS (
                SELECT 1
                  FROM festplay_permissions fp
                 WHERE fp.festplay_id = f.id
                   AND fp.user_id = ?
              )
            )
          LIMIT 1`
      )
      .get(parsedFestplayId, parsedUserId, parsedUserId, parsedUserId)
  );
}

function resolveFestplayChatAnchorCharacterId(festplay, preferredCharacterId = null) {
  const parsedFestplayId = Number(festplay?.id);
  const parsedPreferredCharacterId = Number(preferredCharacterId);
  if (!Number.isInteger(parsedFestplayId) || parsedFestplayId < 1) {
    return null;
  }

  if (
    Number.isInteger(parsedPreferredCharacterId) &&
    parsedPreferredCharacterId > 0 &&
    characterHasFestplayAccess(parsedFestplayId, parsedPreferredCharacterId)
  ) {
    return parsedPreferredCharacterId;
  }

  const creatorCharacterId = Number(festplay?.creator_character_id);
  if (Number.isInteger(creatorCharacterId) && creatorCharacterId > 0) {
    const creatorCharacter = db
      .prepare("SELECT id FROM characters WHERE id = ?")
      .get(creatorCharacterId);
    if (creatorCharacter) {
      return creatorCharacterId;
    }
  }

  const fallbackCharacter = db
    .prepare(
      `SELECT c.id
         FROM characters c
        WHERE c.festplay_id = ?
           OR EXISTS (
             SELECT 1
               FROM festplay_permissions fp
              WHERE fp.festplay_id = ?
                AND fp.character_id = c.id
           )
        ORDER BY CASE
                   WHEN c.user_id = ? THEN 0
                   ELSE 1
                 END,
                 lower(c.name) ASC,
                 c.id ASC
        LIMIT 1`
    )
    .get(parsedFestplayId, parsedFestplayId, Number(festplay?.created_by_user_id) || 0);

  return Number.isInteger(Number(fallbackCharacter?.id)) ? Number(fallbackCharacter.id) : null;
}

function ensureFestplayChatRoom(festplay, preferredCharacterId = null) {
  const parsedFestplayId = Number(festplay?.id);
  const parsedOwnerUserId = Number(festplay?.created_by_user_id);
  const normalizedServerId = normalizeServer(festplay?.server_id);
  const normalizedRoomName = normalizeRoomName(festplay?.name);
  const anchorCharacterId = resolveFestplayChatAnchorCharacterId(festplay, preferredCharacterId);

  if (
    !Number.isInteger(parsedFestplayId) ||
    parsedFestplayId < 1 ||
    !Number.isInteger(parsedOwnerUserId) ||
    parsedOwnerUserId < 1 ||
    !normalizedRoomName ||
    !normalizedServerId ||
    !Number.isInteger(anchorCharacterId) ||
    anchorCharacterId < 1
  ) {
    return null;
  }

  const roomNameKey = toRoomNameKey(normalizedRoomName);
  const existingRoom = db
    .prepare(
      `SELECT id
         FROM chat_rooms
        WHERE festplay_id = ?
          AND COALESCE(is_manual_festplay_room, 0) = 0
        LIMIT 1`
    )
    .get(parsedFestplayId);

  if (existingRoom) {
    db.prepare(
      `UPDATE chat_rooms
          SET character_id = ?,
              created_by_user_id = ?,
              name = ?,
              name_key = ?,
              description = '',
              teaser = '',
              image_url = '',
              email_log_enabled = 0,
              is_locked = 0,
              is_public_room = 0,
              is_saved_room = 0,
              is_festplay_chat = 1,
              is_manual_festplay_room = 0,
              festplay_id = ?,
              server_id = ?
        WHERE id = ?`
    ).run(
      anchorCharacterId,
      parsedOwnerUserId,
      normalizedRoomName,
      roomNameKey,
      parsedFestplayId,
      normalizedServerId,
      existingRoom.id
    );

    return getRoomWithCharacter(Number(existingRoom.id));
  }

  const info = db.prepare(
    `INSERT INTO chat_rooms (
       character_id,
       created_by_user_id,
       name,
       name_key,
       description,
       teaser,
       image_url,
       email_log_enabled,
       is_locked,
       is_public_room,
       is_saved_room,
       is_festplay_chat,
       is_manual_festplay_room,
       festplay_id,
       server_id
     )
     VALUES (?, ?, ?, ?, '', '', '', 0, 0, 0, 0, 1, 0, ?, ?)`
  ).run(
    anchorCharacterId,
    parsedOwnerUserId,
    normalizedRoomName,
    roomNameKey,
    parsedFestplayId,
    normalizedServerId
  );

  return getRoomWithCharacter(Number(info.lastInsertRowid));
}

function getBoundFestplaysForCharacter(characterId) {
  const parsedCharacterId = Number(characterId);
  if (!Number.isInteger(parsedCharacterId) || parsedCharacterId < 1) {
    return [];
  }

  const rows = db
    .prepare(
      `SELECT id, name, server_id
         FROM festplays
        WHERE creator_character_id = ?
        UNION
       SELECT f.id, f.name, f.server_id
         FROM festplays f
         JOIN characters c ON c.festplay_id = f.id
        WHERE c.id = ?
        UNION
       SELECT f.id, f.name, f.server_id
         FROM festplays f
         JOIN festplay_permissions fp ON fp.festplay_id = f.id
        WHERE fp.character_id = ?`
    )
    .all(parsedCharacterId, parsedCharacterId, parsedCharacterId);

  return rows
    .map((row) => ({
      ...row,
      server_id: normalizeFestplayServerId(row.server_id)
    }))
    .filter((row) => row.server_id)
    .map((row) => ({
      ...row,
      server_label: getServerLabel(row.server_id)
    }));
}

function getCharacterFestplayServerBlock(characterId, targetServerId) {
  const normalizedTargetServerId = normalizeServer(targetServerId);
  return (
    getBoundFestplaysForCharacter(characterId).find(
      (festplay) => festplay.server_id !== normalizedTargetServerId
    ) || null
  );
}

function buildFestplayServerLockMessage(festplay, targetServerId = "") {
  if (!festplay?.server_id) {
    return "";
  }

  const targetLabel = targetServerId ? getServerLabel(targetServerId) : "";
  if (targetLabel && targetLabel !== festplay.server_label) {
    return `${festplay.name} liegt auf ${festplay.server_label}. Charaktere dieses Festspiels können nicht nach ${targetLabel} verschoben werden.`;
  }

  return `${festplay.name} liegt auf ${festplay.server_label}.`;
}

function getCharacterFestplayHomeServer(characterId) {
  const uniqueServerIds = [
    ...new Set(
      getBoundFestplaysForCharacter(characterId)
        .map((festplay) => normalizeServer(festplay.server_id))
        .filter(Boolean)
    )
  ];

  if (uniqueServerIds.length !== 1) {
    return "";
  }

  return uniqueServerIds[0];
}

function getCharacterDashboardPlacement(currentServerId, festplayHomeServerId, dashboardMode) {
  const normalizedCurrentServerId = normalizeServer(currentServerId);
  const normalizedFestplayHomeServerId = normalizeFestplayServerId(festplayHomeServerId);
  if (!normalizedFestplayHomeServerId || normalizedCurrentServerId !== normalizedFestplayHomeServerId) {
    return "main";
  }
  return normalizeFestplayDashboardMode(dashboardMode);
}

function characterHasFestplayAccess(festplayId, characterId) {
  const parsedFestplayId = Number(festplayId);
  const parsedCharacterId = Number(characterId);
  if (
    !Number.isInteger(parsedFestplayId) ||
    parsedFestplayId < 1 ||
    !Number.isInteger(parsedCharacterId) ||
    parsedCharacterId < 1
  ) {
    return false;
  }

  const directCharacter = db
    .prepare(
      `SELECT id
       FROM characters
       WHERE id = ?
         AND festplay_id = ?`
    )
    .get(parsedCharacterId, parsedFestplayId);
  if (directCharacter) return true;

  const creatorCharacter = db
    .prepare(
      `SELECT id
         FROM festplays
        WHERE id = ?
          AND creator_character_id = ?`
    )
    .get(parsedFestplayId, parsedCharacterId);
  if (creatorCharacter) return true;

  const permission = db
    .prepare(
      `SELECT id
       FROM festplay_permissions
       WHERE festplay_id = ?
         AND character_id = ?`
    )
    .get(parsedFestplayId, parsedCharacterId);
  return Boolean(permission);
}

function getFestplayApplicationForCharacter(festplayId, characterId) {
  const parsedFestplayId = Number(festplayId);
  const parsedCharacterId = Number(characterId);
  if (
    !Number.isInteger(parsedFestplayId) ||
    parsedFestplayId < 1 ||
    !Number.isInteger(parsedCharacterId) ||
    parsedCharacterId < 1
  ) {
    return null;
  }

  return (
    db
      .prepare(
        `SELECT id,
                festplay_id,
                applicant_user_id,
                applicant_character_id,
                status,
                approved_by_user_id,
                created_at,
                updated_at
           FROM festplay_applications
           WHERE festplay_id = ?
             AND applicant_character_id = ?`
      )
      .get(parsedFestplayId, parsedCharacterId) || null
  );
}

function submitFestplayApplication(festplayId, applicantCharacterId, applicantUserId) {
  const parsedFestplayId = Number(festplayId);
  const parsedCharacterId = Number(applicantCharacterId);
  const parsedUserId = Number(applicantUserId);
  if (
    !Number.isInteger(parsedFestplayId) ||
    parsedFestplayId < 1 ||
    !Number.isInteger(parsedCharacterId) ||
    parsedCharacterId < 1 ||
    !Number.isInteger(parsedUserId) ||
    parsedUserId < 1
  ) {
    return false;
  }

  db.prepare(
    `INSERT INTO festplay_applications (
       festplay_id,
       applicant_user_id,
       applicant_character_id,
       status,
       approved_by_user_id,
       updated_at
     )
     VALUES (?, ?, ?, 'pending', NULL, CURRENT_TIMESTAMP)
     ON CONFLICT(festplay_id, applicant_character_id) DO UPDATE SET
       applicant_user_id = excluded.applicant_user_id,
       status = 'pending',
       approved_by_user_id = NULL,
       updated_at = CURRENT_TIMESTAMP`
  ).run(parsedFestplayId, parsedUserId, parsedCharacterId);

  const application = db
    .prepare(
      `SELECT id
         FROM festplay_applications
        WHERE festplay_id = ?
          AND applicant_character_id = ?`
    )
    .get(parsedFestplayId, parsedCharacterId);

  return Number.isInteger(Number(application?.id)) ? Number(application.id) : null;
}

function getPendingFestplayApplications(festplayId, serverId) {
  const parsedFestplayId = Number(festplayId);
  const normalizedServerId = normalizeServer(serverId);
  if (!Number.isInteger(parsedFestplayId) || parsedFestplayId < 1) return [];

  return db
    .prepare(
      `SELECT fa.id,
              fa.applicant_user_id,
              fa.applicant_character_id,
              fa.status,
              fa.created_at,
              c.name AS character_name
         FROM festplay_applications fa
         JOIN characters c ON c.id = fa.applicant_character_id
         WHERE fa.festplay_id = ?
           AND fa.status = 'pending'
           AND c.server_id = ?
         ORDER BY fa.created_at ASC, fa.id ASC`
    )
    .all(parsedFestplayId, normalizedServerId);
}

function findFestplayByName(name, excludeId = null) {
  const normalizedName = normalizeFestplayName(name);
  if (!normalizedName) return null;
  const parsedExcludeId = Number(excludeId);
  if (Number.isInteger(parsedExcludeId) && parsedExcludeId > 0) {
    return (
      db
        .prepare(
          `SELECT id, name
           FROM festplays
           WHERE lower(name) = lower(?)
             AND id != ?`
        )
        .get(normalizedName, parsedExcludeId) || null
    );
  }
  return (
    db
      .prepare(
        `SELECT id, name
         FROM festplays
         WHERE lower(name) = lower(?)`
      )
      .get(normalizedName) || null
  );
}

function getFestplayPermissionEntries(festplayId, serverId) {
  const parsedFestplayId = Number(festplayId);
  const normalizedServerId = normalizeServer(serverId);
  if (!Number.isInteger(parsedFestplayId) || parsedFestplayId < 1) {
    return [];
  }

  return db
    .prepare(
      `SELECT fp.id,
              fp.user_id,
              fp.character_id,
              c.name AS character_name
        FROM festplay_permissions fp
        JOIN characters c ON c.id = fp.character_id
        WHERE fp.festplay_id = ?
          AND COALESCE(fp.source, 'manual') = 'manual'
          AND c.server_id = ?
        ORDER BY lower(c.name) ASC, fp.id ASC`
    )
    .all(parsedFestplayId, normalizedServerId);
}

function addFestplayPermission(festplayId, targetCharacterId, grantedByUserId, options = {}) {
  const parsedFestplayId = Number(festplayId);
  const parsedCharacterId = Number(targetCharacterId);
  const parsedGrantedByUserId = Number(grantedByUserId);
  const normalizedSource =
    String(options?.source || "manual").trim().toLowerCase() === "application"
      ? "application"
      : "manual";
  if (
    !Number.isInteger(parsedFestplayId) ||
    parsedFestplayId < 1 ||
    !Number.isInteger(parsedCharacterId) ||
    parsedCharacterId < 1 ||
    !Number.isInteger(parsedGrantedByUserId) ||
    parsedGrantedByUserId < 1
  ) {
    return false;
  }

  const targetCharacter = db
    .prepare("SELECT id, user_id FROM characters WHERE id = ?")
    .get(parsedCharacterId);
  if (!targetCharacter) {
    return false;
  }

  const upsertPermission = db.transaction(() => {
    db.prepare(
      `INSERT OR IGNORE INTO festplay_permissions (festplay_id, user_id, character_id, granted_by_user_id, source)
       VALUES (?, ?, ?, ?, ?)`
    ).run(
      parsedFestplayId,
      targetCharacter.user_id,
      parsedCharacterId,
      parsedGrantedByUserId,
      normalizedSource
    );

    db.prepare(
      `UPDATE festplay_permissions
          SET character_id = ?,
              granted_by_user_id = ?,
              source = ?
        WHERE festplay_id = ?
          AND user_id = ?`
    ).run(
      parsedCharacterId,
      parsedGrantedByUserId,
      normalizedSource,
      parsedFestplayId,
      targetCharacter.user_id
    );
  });

  upsertPermission();

  return true;
}

function syncFestplayCreatorCharacter(festplayId, ownerUserId, characterId) {
  const parsedFestplayId = Number(festplayId);
  const parsedOwnerUserId = Number(ownerUserId);
  const parsedCharacterId = Number(characterId);
  if (
    !Number.isInteger(parsedFestplayId) ||
    parsedFestplayId < 1 ||
    !Number.isInteger(parsedOwnerUserId) ||
    parsedOwnerUserId < 1 ||
    !Number.isInteger(parsedCharacterId) ||
    parsedCharacterId < 1
  ) {
    return false;
  }

  const festplay = db
    .prepare(
      `SELECT id, created_by_user_id, creator_character_id, server_id
         FROM festplays
         WHERE id = ?`
    )
    .get(parsedFestplayId);
  if (!festplay || Number(festplay.created_by_user_id) !== parsedOwnerUserId) {
    return false;
  }

  const character = db
    .prepare(
      `SELECT id, user_id, server_id
         FROM characters
         WHERE id = ?`
    )
    .get(parsedCharacterId);
  if (!character || Number(character.user_id) !== parsedOwnerUserId) {
    return false;
  }

  const characterServerId = normalizeServer(character.server_id);
  const lockedFestplayServerId = normalizeFestplayServerId(festplay.server_id);
  if (lockedFestplayServerId && lockedFestplayServerId !== characterServerId) {
    return false;
  }
  const effectiveServerId = lockedFestplayServerId || characterServerId;
  if (!lockedFestplayServerId) {
    db.prepare(
      `UPDATE festplays
       SET server_id = ?
       WHERE id = ?`
    ).run(effectiveServerId, parsedFestplayId);
  }

  let permissionCharacterId = parsedCharacterId;
  const existingCreatorCharacterId = Number(festplay.creator_character_id);
  if (existingCreatorCharacterId > 0) {
    const existingCreatorCharacter = db
      .prepare(
        `SELECT id, user_id, server_id
           FROM characters
           WHERE id = ?`
      )
      .get(existingCreatorCharacterId);
    if (
      existingCreatorCharacter &&
      Number(existingCreatorCharacter.user_id) === parsedOwnerUserId &&
      normalizeServer(existingCreatorCharacter.server_id) === effectiveServerId
    ) {
      permissionCharacterId = existingCreatorCharacterId;
    } else {
      db.prepare(
        `UPDATE festplays
         SET creator_character_id = ?
         WHERE id = ?`
      ).run(parsedCharacterId, parsedFestplayId);
    }
  } else {
    db.prepare(
      `UPDATE festplays
       SET creator_character_id = ?
       WHERE id = ?`
    ).run(parsedCharacterId, parsedFestplayId);
  }

  addFestplayPermission(parsedFestplayId, permissionCharacterId, parsedOwnerUserId);
  return true;
}

function deleteFestplayAndResetCharacters(festplayId) {
  const parsedFestplayId = Number(festplayId);
  if (!Number.isInteger(parsedFestplayId) || parsedFestplayId < 1) {
    return false;
  }

  const resetAssignedCharacters = db.prepare(
    `UPDATE characters
        SET festplay_id = NULL,
            festplay_dashboard_mode = 'main',
            updated_at = CURRENT_TIMESTAMP
      WHERE festplay_id = ?
         OR id = (
              SELECT creator_character_id
                FROM festplays
               WHERE id = ?
            )`
  );
  const resetPermissionCharacters = db.prepare(
    `UPDATE characters
        SET festplay_dashboard_mode = 'main',
            updated_at = CURRENT_TIMESTAMP
      WHERE id IN (
              SELECT fp.character_id
                FROM festplay_permissions fp
               WHERE fp.festplay_id = ?
            )`
  );
  const deleteFestplayRooms = db.prepare("DELETE FROM chat_rooms WHERE festplay_id = ?");
  const deleteFestplay = db.prepare("DELETE FROM festplays WHERE id = ?");

  db.transaction(() => {
    resetPermissionCharacters.run(parsedFestplayId);
    resetAssignedCharacters.run(parsedFestplayId, parsedFestplayId);
    deleteFestplayRooms.run(parsedFestplayId);
    deleteFestplay.run(parsedFestplayId);
  })();

  return true;
}

async function purgeInactiveFestplays() {
  if (inactiveFestplayCleanupRunning) {
    return {
      deletedCount: 0,
      emailedCount: 0
    };
  }

  inactiveFestplayCleanupRunning = true;

  try {
    const liveFestplayIds = getLiveFestplayIdsWithChatPresence();
    liveFestplayIds.forEach((festplayId) => {
      touchFestplayActivity(festplayId);
    });

    const staleFestplays = db
      .prepare(
        `SELECT f.id,
                f.name,
                f.server_id,
                COALESCE(NULLIF(f.last_activity_at, ''), f.created_at, CURRENT_TIMESTAMP) AS last_activity_at,
                COALESCE(u.username, '') AS owner_username,
                COALESCE(u.email, '') AS owner_email
           FROM festplays f
           LEFT JOIN users u ON u.id = f.created_by_user_id
          WHERE NOT (
                  lower(trim(COALESCE(f.name, ''))) = 'freeplay'
              AND COALESCE(f.created_by_user_id, 0) = 0
              AND COALESCE(f.creator_character_id, 0) = 0
          )
            AND datetime(COALESCE(NULLIF(f.last_activity_at, ''), f.created_at, CURRENT_TIMESTAMP)) <= datetime('now', ?)
          ORDER BY datetime(COALESCE(NULLIF(f.last_activity_at, ''), f.created_at, CURRENT_TIMESTAMP)) ASC, f.id ASC`
      )
      .all(FESTPLAY_INACTIVITY_SQL_OFFSET);

    let deletedCount = 0;
    let emailedCount = 0;

    for (const festplay of staleFestplays) {
      const festplayId = Number(festplay?.id);
      if (!Number.isInteger(festplayId) || festplayId < 1) {
        continue;
      }

      if (liveFestplayIds.has(festplayId)) {
        touchFestplayActivity(festplayId);
        continue;
      }

      try {
        const deleted = deleteFestplayAndResetCharacters(festplayId);
        if (!deleted) {
          continue;
        }

        deletedCount += 1;

        try {
          const emailed = await sendFestplayInactivityDeletionEmail({
            email: festplay.owner_email,
            username: festplay.owner_username,
            festplayName: festplay.name,
            lastActivityAt: festplay.last_activity_at
          });
          if (emailed) {
            emailedCount += 1;
          }
        } catch (mailError) {
          console.error("Konnte Festplay-Inaktivitätsmail nicht senden:", {
            festplayId,
            error: mailError
          });
        }
      } catch (error) {
        console.error("Automatische Festplay-Löschung fehlgeschlagen:", {
          festplayId,
          error
        });
      }
    }

    return {
      deletedCount,
      emailedCount
    };
  } finally {
    inactiveFestplayCleanupRunning = false;
  }
}

function removeFestplayPermission(festplayId, permissionId) {
  const parsedFestplayId = Number(festplayId);
  const parsedPermissionId = Number(permissionId);
  if (
    !Number.isInteger(parsedFestplayId) ||
    parsedFestplayId < 1 ||
    !Number.isInteger(parsedPermissionId) ||
    parsedPermissionId < 1
  ) {
    return false;
  }

  const result = db
    .prepare(
      `DELETE FROM festplay_permissions
       WHERE id = ?
         AND festplay_id = ?`
    )
    .run(parsedPermissionId, parsedFestplayId);

  return Number(result.changes) > 0;
}

function removeFestplayPlayer(festplayId, characterId) {
  const parsedFestplayId = Number(festplayId);
  const parsedCharacterId = Number(characterId);
  if (
    !Number.isInteger(parsedFestplayId) ||
    parsedFestplayId < 1 ||
    !Number.isInteger(parsedCharacterId) ||
    parsedCharacterId < 1
  ) {
    return false;
  }

  const festplay = db
    .prepare(
      `SELECT creator_character_id
         FROM festplays
        WHERE id = ?`
    )
    .get(parsedFestplayId);
  if (!festplay) {
    return false;
  }

  if (Number(festplay.creator_character_id) === parsedCharacterId) {
    return false;
  }

  const player = db
    .prepare(
      `SELECT c.id
         FROM characters c
         LEFT JOIN festplay_permissions fp
           ON fp.character_id = c.id
          AND fp.festplay_id = ?
        WHERE c.id = ?
          AND (
            c.festplay_id = ?
            OR fp.id IS NOT NULL
          )
        LIMIT 1`
    )
    .get(parsedFestplayId, parsedCharacterId, parsedFestplayId);
  if (!player) {
    return false;
  }

  const applicationIds = db
    .prepare(
      `SELECT id
         FROM festplay_applications
        WHERE festplay_id = ?
          AND applicant_character_id = ?`
    )
    .all(parsedFestplayId, parsedCharacterId)
    .map((row) => Number(row.id))
    .filter((applicationId) => Number.isInteger(applicationId) && applicationId > 0);

  db.transaction(() => {
    db.prepare(
      `UPDATE characters
          SET festplay_id = NULL,
              festplay_dashboard_mode = 'main',
              updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND festplay_id = ?`
    ).run(parsedCharacterId, parsedFestplayId);

    db.prepare(
      `UPDATE characters
          SET festplay_dashboard_mode = 'main',
              updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`
    ).run(parsedCharacterId);

    db.prepare(
      `DELETE FROM festplay_permissions
       WHERE festplay_id = ?
         AND character_id = ?`
    ).run(parsedFestplayId, parsedCharacterId);

    db.prepare(
      `DELETE FROM festplay_applications
       WHERE festplay_id = ?
         AND applicant_character_id = ?`
    ).run(parsedFestplayId, parsedCharacterId);
  })();

  applicationIds.forEach((applicationId) => {
    deleteFestplayApplicationNotificationsForApplication(applicationId);
  });

  return true;
}

function getFestplayPlayerOverview(festplayId, serverId) {
  const parsedFestplayId = Number(festplayId);
  const normalizedServerId = normalizeServer(serverId);
  if (!Number.isInteger(parsedFestplayId) || parsedFestplayId < 1) {
    return {
      characters: [],
      playerCount: 0,
      characterCount: 0,
      activePlayerCount: 0,
      activeCharacterCount: 0
    };
  }

  const characters = db
    .prepare(
      `SELECT DISTINCT c.id,
                       c.user_id,
                       c.name,
                       u.username AS owner_name,
                       CASE
                         WHEN c.id = (
                           SELECT creator_character_id
                             FROM festplays
                            WHERE id = ?
                         ) THEN 1
                         ELSE 0
                       END AS is_creator_character
       FROM characters c
       JOIN users u ON u.id = c.user_id
       LEFT JOIN festplay_permissions fp
         ON fp.character_id = c.id
        AND fp.festplay_id = ?
       WHERE c.server_id = ?
         AND (
           c.festplay_id = ?
           OR fp.id IS NOT NULL
         )
       ORDER BY lower(c.name) ASC, c.id ASC`
    )
    .all(parsedFestplayId, parsedFestplayId, normalizedServerId, parsedFestplayId);

  const uniquePlayerIds = new Set();
  const activeUserIds = new Set(getConnectedSocketUserIds());
  const activePlayers = new Set();
  const activeCharacters = [];

  characters.forEach((character) => {
    const parsedUserId = Number(character.user_id);
    if (Number.isInteger(parsedUserId) && parsedUserId > 0) {
      uniquePlayerIds.add(parsedUserId);
      if (activeUserIds.has(parsedUserId)) {
        activePlayers.add(parsedUserId);
        activeCharacters.push(character);
      }
    }
  });

  return {
    characters,
    playerCount: uniquePlayerIds.size,
    characterCount: characters.length,
    activePlayerCount: activePlayers.size,
    activeCharacterCount: activeCharacters.length
  };
}

function normalizeRoomName(input) {
  return String(input || "").trim().replace(/\s+/g, " ").slice(0, 80);
}

function normalizeRoomNameKey(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function toRoomNameKey(roomName) {
  return normalizeRoomNameKey(normalizeRoomName(roomName));
}

function findOwnedRoomByNameKey(userId, serverId, roomNameKey, roomDescription = "") {
  const parsedUserId = Number(userId);
  const normalizedServerId = normalizeServer(serverId);
  const normalizedRoomNameKey = normalizeRoomNameKey(roomNameKey);
  const normalizedRoomDescription = normalizeRoomDescription(roomDescription);
  if (!Number.isInteger(parsedUserId) || parsedUserId < 1 || !normalizedRoomNameKey) {
    return null;
  }

  return (
    db.prepare(
      `SELECT id, name, description
       FROM chat_rooms
       WHERE server_id = ?
         AND created_by_user_id = ?
         AND name_key = ?
         AND COALESCE(description, '') = ?
         AND COALESCE(festplay_id, 0) = 0
         AND COALESCE(is_saved_room, 0) = 1
         AND COALESCE(is_festplay_chat, 0) = 0
         AND COALESCE(is_manual_festplay_room, 0) = 0
         AND COALESCE(is_festplay_side_chat, 0) = 0`
    ).get(normalizedServerId, parsedUserId, normalizedRoomNameKey, normalizedRoomDescription) || null
  );
}

function dedupeSavedNonFestplayRooms(rooms, serverId) {
  const normalizedServerId = normalizeServer(serverId);
  const sourceRooms = Array.isArray(rooms) ? rooms : [];
  const dedupedRooms = [];
  const seenRooms = new Map();
  const curatedRoomKeys = new Set(
    getCuratedPublicRoomDefinitionsForServer(normalizedServerId)
      .map((definition) => normalizeRoomNameKey(definition?.key || definition?.name || ""))
      .filter(Boolean)
  );

  sourceRooms.forEach((room) => {
    const roomNameKey = normalizeRoomNameKey(room?.name_key || "") || toRoomNameKey(room?.name || "");
    const roomDescriptionKey = normalizeRoomDescription(room?.description || "");
    const dedupeKey = curatedRoomKeys.has(roomNameKey)
      ? `${normalizeServer(room?.server_id || normalizedServerId)}:curated:${roomNameKey}`
      : `${normalizeServer(room?.server_id || normalizedServerId)}:${roomNameKey}:${roomDescriptionKey}`;
    const existingIndex = seenRooms.get(dedupeKey);

    if (existingIndex == null) {
      seenRooms.set(dedupeKey, dedupedRooms.length);
      dedupedRooms.push(room);
      return;
    }

    const existingRoom = dedupedRooms[existingIndex];
    const shouldReplaceExistingRoom =
      (!existingRoom?.is_public_room && room.is_public_room) ||
      (Boolean(existingRoom?.is_public_room) === Boolean(room.is_public_room) &&
        Number(room?.id) > 0 &&
        (!Number(existingRoom?.id) || Number(room.id) < Number(existingRoom.id)));

    if (shouldReplaceExistingRoom) {
      dedupedRooms[existingIndex] = room;
    }
  });

  return dedupedRooms;
}

function getSavedNonFestplayRoomsForUser(userId, serverId) {
  const parsedUserId = Number(userId);
  const normalizedServerId = normalizeServer(serverId);
  const supportsSortOrder = hasChatRoomColumn("sort_order");
  if (!Number.isInteger(parsedUserId) || parsedUserId < 1) {
    return [];
  }

  const rooms = db
    .prepare(
      `SELECT id, name, name_key, description, teaser, image_url, email_log_enabled, is_locked, is_public_room, server_id,
              ${supportsSortOrder ? "COALESCE(sort_order, 0)" : "0"} AS sort_order
       FROM chat_rooms
       WHERE server_id = ?
         AND created_by_user_id = ?
         AND COALESCE(festplay_id, 0) = 0
         AND COALESCE(is_saved_room, 0) = 1
         AND COALESCE(is_festplay_chat, 0) = 0
         AND COALESCE(is_manual_festplay_room, 0) = 0
         AND COALESCE(is_festplay_side_chat, 0) = 0
        ORDER BY ${supportsSortOrder ? "COALESCE(sort_order, 0) ASC," : ""} created_at ASC, id ASC`
    )
    .all(normalizedServerId, parsedUserId)
    .map((room) => ({
      ...room,
      sort_order: Number(room.sort_order) || 0,
      email_log_enabled: Number(room.email_log_enabled) === 1,
      is_locked: Number(room.is_locked) === 1,
      is_public_room: Number(room.is_public_room) === 1
    }));

  return dedupeSavedNonFestplayRooms(rooms, normalizedServerId);
}

function getFestplaySideChatsForUser(userId, festplayId) {
  const parsedUserId = Number(userId);
  const parsedFestplayId = Number(festplayId);
  if (
    !Number.isInteger(parsedUserId) ||
    parsedUserId < 1 ||
    !Number.isInteger(parsedFestplayId) ||
    parsedFestplayId < 1
  ) {
    return [];
  }

  return db
    .prepare(
      `SELECT r.id,
              r.name,
              r.description,
              r.teaser,
              r.image_url,
              r.character_id,
              r.email_log_enabled,
              r.is_locked,
              r.is_public_room,
              r.is_saved_room,
              r.server_id,
              r.created_at,
              r.created_by_user_id,
              anchor.name AS creator_character_name,
              CASE
                WHEN r.created_by_user_id = ? THEN 1
                WHEN EXISTS (
                  SELECT 1
                    FROM chat_room_permissions crp
                   WHERE crp.room_id = r.id
                     AND crp.user_id = ?
                ) THEN 1
                ELSE 0
              END AS can_manage_room
         FROM chat_rooms r
         JOIN characters anchor ON anchor.id = r.character_id
        WHERE r.festplay_id = ?
          AND COALESCE(r.is_festplay_chat, 0) = 0
          AND COALESCE(r.is_festplay_side_chat, 0) = 1
        ORDER BY r.created_at ASC, r.id ASC`
    )
    .all(parsedUserId, parsedUserId, parsedFestplayId)
    .map((room) => ({
      ...room,
      email_log_enabled: Number(room.email_log_enabled) === 1,
      is_locked: Number(room.is_locked) === 1,
      is_public_room: Number(room.is_public_room) === 1,
      is_saved_room: Number(room.is_saved_room) === 1,
      teaser_html: room.teaser ? renderGuestbookBbcode(room.teaser) : "",
      can_manage_room: Number(room.can_manage_room) === 1,
      can_enter:
        Number(room.is_locked) !== 1 ||
        Number(room.can_manage_room) === 1 ||
        hasRoomInviteAccess({ id: parsedUserId }, room),
      is_owned_room: Number(room.created_by_user_id) === parsedUserId
    }));
}

function findFestplaySideChatByNameKey(festplayId, serverId, roomNameKey, roomDescription = "") {
  const parsedFestplayId = Number(festplayId);
  const normalizedServerId = normalizeServer(serverId);
  const normalizedRoomNameKey = String(roomNameKey || "").trim().toLowerCase();
  const normalizedRoomDescription = normalizeRoomDescription(roomDescription);
  if (
    !Number.isInteger(parsedFestplayId) ||
    parsedFestplayId < 1 ||
    !normalizedServerId ||
    !normalizedRoomNameKey
  ) {
    return null;
  }

  return (
    db.prepare(
      `SELECT id, name, description
       FROM chat_rooms
       WHERE festplay_id = ?
         AND server_id = ?
         AND name_key = ?
         AND COALESCE(description, '') = ?
         AND COALESCE(is_festplay_chat, 0) = 0
         AND COALESCE(is_festplay_side_chat, 0) = 1`
    ).get(parsedFestplayId, normalizedServerId, normalizedRoomNameKey, normalizedRoomDescription) || null
  );
}

function findOwnedFestplayRoomByNameKey(userId, festplayId, roomNameKey, roomDescription = "") {
  const parsedUserId = Number(userId);
  const parsedFestplayId = Number(festplayId);
  const normalizedRoomNameKey = String(roomNameKey || "").trim().toLowerCase();
  const normalizedRoomDescription = normalizeRoomDescription(roomDescription);
  if (
    !Number.isInteger(parsedUserId) ||
    parsedUserId < 1 ||
    !Number.isInteger(parsedFestplayId) ||
    parsedFestplayId < 1 ||
    !normalizedRoomNameKey
  ) {
    return null;
  }

  return (
    db.prepare(
       `SELECT id, name, description
          FROM chat_rooms
         WHERE festplay_id = ?
           AND created_by_user_id = ?
           AND name_key = ?
           AND COALESCE(description, '') = ?
           AND COALESCE(is_saved_room, 0) = 1
           AND COALESCE(is_festplay_chat, 0) = 1
           AND COALESCE(is_manual_festplay_room, 0) = 1`
    ).get(parsedFestplayId, parsedUserId, normalizedRoomNameKey, normalizedRoomDescription) || null
  );
}

function findPublicRoomByNameKey(serverId, roomNameKey, roomDescription = "") {
  const normalizedServerId = normalizeServer(serverId);
  const normalizedRoomNameKey = String(roomNameKey || "").trim().toLowerCase();
  const normalizedRoomDescription = normalizeRoomDescription(roomDescription);
  if (!normalizedRoomNameKey) {
    return null;
  }

  return (
    db.prepare(
       `SELECT id, name, description
        FROM chat_rooms
        WHERE server_id = ?
          AND name_key = ?
          AND COALESCE(description, '') = ?
          AND COALESCE(festplay_id, 0) = 0
          AND COALESCE(is_public_room, 0) = 1
          AND COALESCE(is_festplay_chat, 0) = 0
          AND COALESCE(is_manual_festplay_room, 0) = 0
          AND COALESCE(is_festplay_side_chat, 0) = 0
         ORDER BY id ASC
         LIMIT 1`
    ).get(normalizedServerId, normalizedRoomNameKey, normalizedRoomDescription) || null
  );
}

function ensureFestplaySideChatRoom(userId, character, festplayId, roomName, roomDescription = "") {
  const parsedUserId = Number(userId);
  const parsedCharacterId = Number(character?.id);
  const parsedFestplayId = Number(festplayId);
  const normalizedServerId = normalizeServer(character?.server_id);
  const normalizedRoomName = normalizeRoomName(roomName);
  const normalizedRoomDescription = normalizeRoomDescription(roomDescription);

  if (
    !Number.isInteger(parsedUserId) ||
    parsedUserId < 1 ||
    !Number.isInteger(parsedCharacterId) ||
    parsedCharacterId < 1 ||
    !Number.isInteger(parsedFestplayId) ||
    parsedFestplayId < 1 ||
    normalizedRoomName.length < 2 ||
    !userHasFestplayAccess(parsedUserId, parsedFestplayId)
  ) {
    return null;
  }

  const roomNameKey = toRoomNameKey(normalizedRoomName);
  const existingRoom = findFestplaySideChatByNameKey(
    parsedFestplayId,
    normalizedServerId,
    roomNameKey,
    normalizedRoomDescription
  );
  if (existingRoom) {
    return {
      id: Number(existingRoom.id),
      name: String(existingRoom.name || normalizedRoomName).trim() || normalizedRoomName,
      created: false
    };
  }

  const info = db.prepare(
    `INSERT INTO chat_rooms (
       character_id,
       created_by_user_id,
       name,
       name_key,
       description,
       teaser,
       image_url,
       email_log_enabled,
       is_locked,
       is_public_room,
       is_saved_room,
       is_festplay_chat,
       is_manual_festplay_room,
       is_festplay_side_chat,
       festplay_id,
       server_id
     )
     VALUES (?, ?, ?, ?, ?, '', '', 0, 0, 1, 0, 0, 0, 1, ?, ?)`
  ).run(
    parsedCharacterId,
    parsedUserId,
    normalizedRoomName,
    roomNameKey,
    normalizedRoomDescription,
    parsedFestplayId,
    normalizedServerId
  );

  return {
    id: Number(info.lastInsertRowid),
    name: normalizedRoomName,
    created: true
  };
}

function ensureOwnedRoomForCharacter(userId, character, roomName, roomDescription = "") {
  const parsedUserId = Number(userId);
  const parsedCharacterId = Number(character?.id);
  const normalizedServerId = normalizeServer(character?.server_id);
  const normalizedRoomName = normalizeRoomName(roomName);
  const normalizedRoomDescription = normalizeRoomDescription(roomDescription);

  if (
    !Number.isInteger(parsedUserId) ||
    parsedUserId < 1 ||
    !Number.isInteger(parsedCharacterId) ||
    parsedCharacterId < 1 ||
    normalizedRoomName.length < 2
  ) {
    return null;
  }

  const roomNameKey = toRoomNameKey(normalizedRoomName);
  const existingRoom = findOwnedRoomByNameKey(
    parsedUserId,
    normalizedServerId,
    roomNameKey,
    normalizedRoomDescription
  );
  if (existingRoom) {
    return {
      id: Number(existingRoom.id),
      name: String(existingRoom.name || normalizedRoomName).trim() || normalizedRoomName,
      created: false
    };
  }

  const supportsSortOrder = hasChatRoomColumn("sort_order");
  const nextSortOrder = supportsSortOrder
    ? Number(
        db
          .prepare(
            `SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_sort_order
               FROM chat_rooms
              WHERE server_id = ?
                AND created_by_user_id = ?
                AND COALESCE(festplay_id, 0) = 0
                AND COALESCE(is_saved_room, 0) = 1
                AND COALESCE(is_festplay_chat, 0) = 0
                AND COALESCE(is_manual_festplay_room, 0) = 0
                AND COALESCE(is_festplay_side_chat, 0) = 0`
          )
          .get(normalizedServerId, parsedUserId)?.next_sort_order || 1
      )
    : 0;

  const info = supportsSortOrder
    ? db.prepare(
        `INSERT INTO chat_rooms (
           character_id,
           created_by_user_id,
           name,
           name_key,
           description,
           server_id,
           sort_order,
           is_saved_room
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)`
      ).run(
        parsedCharacterId,
        parsedUserId,
        normalizedRoomName,
        roomNameKey,
        normalizedRoomDescription,
        normalizedServerId,
        nextSortOrder
      )
    : db.prepare(
        `INSERT INTO chat_rooms (character_id, created_by_user_id, name, name_key, description, server_id, is_saved_room)
           VALUES (?, ?, ?, ?, ?, ?, 1)`
      ).run(
        parsedCharacterId,
        parsedUserId,
        normalizedRoomName,
        roomNameKey,
        normalizedRoomDescription,
        normalizedServerId
      );

  return {
    id: Number(info.lastInsertRowid),
    name: normalizedRoomName,
    created: true
  };
}

function reorderOwnedRooms(userId, serverId, orderedRoomIds = []) {
  const parsedUserId = Number(userId);
  const normalizedServerId = normalizeServer(serverId);
  const normalizedRoomIds = Array.isArray(orderedRoomIds)
    ? orderedRoomIds
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0)
    : [];

  if (!Number.isInteger(parsedUserId) || parsedUserId < 1 || !normalizedServerId || !normalizedRoomIds.length) {
    return false;
  }

  const availableRoomIds = getSavedNonFestplayRoomsForUser(parsedUserId, normalizedServerId)
    .map((room) => Number(room.id))
    .filter((roomId) => Number.isInteger(roomId) && roomId > 0);

  if (!availableRoomIds.length) {
    return false;
  }

  const availableSet = new Set(availableRoomIds);
  const normalizedSet = new Set(normalizedRoomIds);
  if (normalizedSet.size !== normalizedRoomIds.length) {
    return false;
  }

  for (const roomId of normalizedRoomIds) {
    if (!availableSet.has(roomId)) {
      return false;
    }
  }

  const orderedIds = normalizedRoomIds.concat(
    availableRoomIds.filter((roomId) => !normalizedSet.has(roomId))
  );

  const updateSortOrder = db.prepare(
    `UPDATE chat_rooms
        SET sort_order = ?
      WHERE id = ?
        AND server_id = ?
        AND created_by_user_id = ?
        AND COALESCE(festplay_id, 0) = 0
        AND COALESCE(is_saved_room, 0) = 1
        AND COALESCE(is_festplay_chat, 0) = 0
        AND COALESCE(is_manual_festplay_room, 0) = 0
        AND COALESCE(is_festplay_side_chat, 0) = 0`
  );

  db.transaction((roomIds) => {
    roomIds.forEach((roomId, index) => {
      updateSortOrder.run(index + 1, roomId, normalizedServerId, parsedUserId);
    });
  })(orderedIds);

  return true;
}

function ensurePublicRoomForServer(userId, character, roomName, roomDescription = "") {
  const parsedUserId = Number(userId);
  const parsedCharacterId = Number(character?.id);
  const normalizedServerId = normalizeServer(character?.server_id);
  const normalizedRoomName = normalizeRoomName(roomName);
  const normalizedRoomDescription = normalizeRoomDescription(roomDescription);

  if (
    !Number.isInteger(parsedUserId) ||
    parsedUserId < 1 ||
    !Number.isInteger(parsedCharacterId) ||
    parsedCharacterId < 1 ||
    normalizedRoomName.length < 2
  ) {
    return null;
  }

  const roomNameKey = toRoomNameKey(normalizedRoomName);
  const existingRoom = findPublicRoomByNameKey(
    normalizedServerId,
    roomNameKey,
    normalizedRoomDescription
  );
  if (existingRoom) {
    return {
      id: Number(existingRoom.id),
      name: String(existingRoom.name || normalizedRoomName).trim() || normalizedRoomName,
      created: false
    };
  }

  const info = db.prepare(
    `INSERT INTO chat_rooms
       (character_id, created_by_user_id, name, name_key, description, server_id, is_public_room)
     VALUES (?, ?, ?, ?, ?, ?, 1)`
  ).run(
    parsedCharacterId,
    parsedUserId,
    normalizedRoomName,
    roomNameKey,
    normalizedRoomDescription,
    normalizedServerId
  );

  return {
    id: Number(info.lastInsertRowid),
    name: normalizedRoomName,
    created: true
  };
}

function parseRoomSwitchCommandArguments(rawArgs) {
  const value = String(rawArgs || "").trim();
  if (!value) {
    return {
      roomName: "",
      roomDescription: ""
    };
  }

  const quotedTeaserMatch = value.match(/^(.*?)\s+"([^"]+)"\s*$/);
  if (quotedTeaserMatch) {
    return {
      roomName: normalizeRoomName(quotedTeaserMatch[1]),
      roomDescription: normalizeRoomDescription(quotedTeaserMatch[2])
    };
  }

  return {
    roomName: normalizeRoomName(value),
    roomDescription: ""
  };
}

function parseRoomRenameCommandArguments(rawArgs) {
  const value = String(rawArgs || "").trim();
  if (!value) {
    return {
      roomName: "",
      roomDescription: "",
      hasDescription: false
    };
  }

  const quotedDescriptionMatch = value.match(/^(.*?)\s*"([^"]*)"\s*$/);
  if (quotedDescriptionMatch) {
    return {
      roomName: normalizeRoomName(quotedDescriptionMatch[1]),
      roomDescription: normalizeRoomDescription(quotedDescriptionMatch[2]),
      hasDescription: true
    };
  }

  return {
    roomName: normalizeRoomName(value),
    roomDescription: "",
    hasDescription: false
  };
}

function parseRollCommandArguments(rawArgs) {
  const value = String(rawArgs || "").trim();
  if (!value) {
    return null;
  }

  const match = value.match(/^(\d{1,2})\s*[wd]\s*(\d{1,4})(?:\s*([+-])\s*(\d{1,4}))?$/i);
  if (!match) {
    return null;
  }

  const diceCount = Number(match[1]);
  const diceSides = Number(match[2]);
  const modifierValue = match[4] ? Number(match[4]) : 0;
  const modifier = match[3] === "-" ? -modifierValue : modifierValue;

  if (
    !Number.isInteger(diceCount) ||
    !Number.isInteger(diceSides) ||
    !Number.isInteger(modifierValue) ||
    diceCount < 1 ||
    diceCount > 20 ||
    diceSides < 2 ||
    diceSides > 1000 ||
    modifierValue > 1000
  ) {
    return null;
  }

  return {
    diceCount,
    diceSides,
    modifier,
    notation:
      `${diceCount}w${diceSides}` +
      (modifier > 0 ? `+${modifier}` : modifier < 0 ? `-${Math.abs(modifier)}` : "")
  };
}

function rollDiceExpression(rollConfig) {
  const diceCount = Number(rollConfig?.diceCount);
  const diceSides = Number(rollConfig?.diceSides);
  const modifier = Number(rollConfig?.modifier) || 0;
  if (!Number.isInteger(diceCount) || diceCount < 1 || !Number.isInteger(diceSides) || diceSides < 2) {
    return null;
  }

  const rolls = Array.from({ length: diceCount }, () => crypto.randomInt(1, diceSides + 1));
  const baseTotal = rolls.reduce((sum, value) => sum + value, 0);
  const total = baseTotal + modifier;

  let resultLabel = String(total);
  if (rolls.length > 1 || modifier !== 0) {
    const detailParts = [rolls.join(" + ")];
    if (modifier > 0) {
      detailParts.push(`+ ${modifier}`);
    } else if (modifier < 0) {
      detailParts.push(`- ${Math.abs(modifier)}`);
    }
    resultLabel = `${detailParts.join(" ")} = ${total}`;
  }

  return {
    total,
    resultLabel
  };
}

function normalizeInviteTargetName(rawValue) {
  return String(rawValue || "").trim().replace(/\s+/g, " ").slice(0, 80);
}

function normalizeInviteTargetLookupKey(rawValue) {
  return normalizeInviteTargetName(rawValue).toLocaleLowerCase("de");
}

function parseInviteCommandArguments(rawArgs) {
  const value = String(rawArgs || "").trim();
  if (!value) {
    return "";
  }

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return normalizeInviteTargetName(value.slice(1, -1));
  }

  return normalizeInviteTargetName(value);
}

function parseWhisperCommandArguments(rawArgs) {
  const value = String(rawArgs || "").trim();
  if (!value) {
    return {
      targetName: "",
      message: ""
    };
  }

  const quotedMatch = value.match(/^"([^"]+)"\s+([\s\S]+)$/);
  if (quotedMatch) {
    return {
      targetName: normalizeInviteTargetName(quotedMatch[1]),
      message: String(quotedMatch[2] || "").trim()
    };
  }

  const singleQuotedMatch = value.match(/^'([^']+)'\s+([\s\S]+)$/);
  if (singleQuotedMatch) {
    return {
      targetName: normalizeInviteTargetName(singleQuotedMatch[1]),
      message: String(singleQuotedMatch[2] || "").trim()
    };
  }

  const plainMatch = value.match(/^(\S+)\s+([\s\S]+)$/);
  if (plainMatch) {
    return {
      targetName: normalizeInviteTargetName(plainMatch[1]),
      message: String(plainMatch[2] || "").trim()
    };
  }

  return {
    targetName: normalizeInviteTargetName(value),
    message: ""
  };
}

const SHARED_STANDARD_ROOM_SCOPE_KEY = "shared-standard-room";
const STANDARD_ROOM_DEFINITIONS = Object.freeze({
  "free-rp": [
    {
      id: "zwischenwelten-foyer",
      name: "Zwischenwelten-Foyer",
      category: "Offplay",
      teaser: "Locker reden, planen und ankommen."
    }
  ],
  erp: [
    {
      id: "zwischenwelten-foyer",
      name: "Zwischenwelten-Foyer",
      category: "Offplay",
      teaser: "Locker reden, planen und ankommen."
    }
  ]
});
const CURATED_PUBLIC_ROOM_DEFINITIONS = Object.freeze({
  "free-rp": [
    {
      key: "zum-silbermond-krug",
      section: "Fantasy Räume",
      name: "Zum Silbermond-Krug",
      teaser: "[b]Wirt: Edric Mühlenbrand[/b]\nEin ruhiger Wirt mit warmer Stimme, der Gäste mit Met, Eintopf und einem offenen Ohr begrüßt.",
      description: "Warme Taverne für Reisende, Met und Geschichten."
    }
  ],
  erp: []
});

function getStandardRoomsForServer(serverId) {
  const normalizedServerId = normalizeServer(serverId);
  return Array.isArray(STANDARD_ROOM_DEFINITIONS[normalizedServerId])
    ? STANDARD_ROOM_DEFINITIONS[normalizedServerId]
    : [];
}

function getCuratedPublicRoomDefinitionsForServer(serverId) {
  const normalizedServerId = normalizeServer(serverId);
  return Array.isArray(CURATED_PUBLIC_ROOM_DEFINITIONS[normalizedServerId])
    ? CURATED_PUBLIC_ROOM_DEFINITIONS[normalizedServerId]
    : [];
}

function getCuratedPublicRoomDefinition(room, serverId = null) {
  const normalizedServerId = normalizeServer(serverId || room?.server_id);
  const explicitRoomNameKey = normalizeRoomNameKey(room?.name_key || "");
  const roomNameKey = explicitRoomNameKey || toRoomNameKey(room?.name || "");
  if (!roomNameKey) {
    return null;
  }

  return (
    getCuratedPublicRoomDefinitionsForServer(normalizedServerId).find(
      (definition) => normalizeRoomNameKey(definition?.key || definition?.name || "") === roomNameKey
    ) || null
  );
}

function isCuratedPublicRoom(room, serverId = null) {
  return Boolean(getCuratedPublicRoomDefinition(room, serverId));
}

const selectCuratedRoomOverrideStatement = db.prepare(`
  SELECT description, teaser
    FROM curated_room_overrides
   WHERE server_id = ?
     AND room_key = ?
   LIMIT 1
`);
const upsertCuratedRoomOverrideStatement = db.prepare(`
  INSERT INTO curated_room_overrides (server_id, room_key, description, teaser, updated_at)
  VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
  ON CONFLICT(server_id, room_key)
  DO UPDATE SET
    description = excluded.description,
    teaser = excluded.teaser,
    updated_at = CURRENT_TIMESTAMP
`);

function getCuratedRoomOverride(serverId, roomKey) {
  const normalizedServerId = normalizeServer(serverId);
  const normalizedRoomKey = normalizeRoomNameKey(roomKey);
  if (!normalizedRoomKey) {
    return null;
  }

  const row = selectCuratedRoomOverrideStatement.get(normalizedServerId, normalizedRoomKey);
  if (!row) {
    return null;
  }

  return {
    description: String(row.description || ""),
    teaser: String(row.teaser || "")
  };
}

function saveCuratedRoomOverride(serverId, roomKey, description = "", teaser = "") {
  const normalizedServerId = normalizeServer(serverId);
  const normalizedRoomKey = normalizeRoomNameKey(roomKey);
  if (!normalizedRoomKey) {
    return false;
  }

  upsertCuratedRoomOverrideStatement.run(
    normalizedServerId,
    normalizedRoomKey,
    normalizeRoomDescription(description),
    normalizeRoomTeaser(teaser)
  );
  return true;
}

const TAVERN_INNKEEPER_ROOM_KEY = "zum-silbermond-krug";
const TAVERN_INNKEEPER_NAME = "Edric Mühlenbrand";
const TAVERN_INNKEEPER_PRESENCE_KEY = "npc:edric-muehlenbrand";
const TAVERN_INNKEEPER_CHAT_TEXT_COLOR = "#c4863a";
const TAVERN_INNKEEPER_COOLDOWN_MS = 8000;
const tavernInnkeeperLastReactionAtByRoom = new Map();
const TAVERN_INNKEEPER_DRINK_ORDERS = [
  { label: "einen Krug dunkles Bier", keywords: ["dunkelbier", "dunkles bier", "stout", "porter"] },
  { label: "ein helles Bier", keywords: ["helles bier", "helles", "lager", "pils", "pilsner"] },
  { label: "ein großes Weizen", keywords: ["weizen", "weissbier", "weizenbier"] },
  { label: "einen Krug Ale", keywords: ["ale"] },
  { label: "einen Becher Met", keywords: ["met", "honigwein"] },
  { label: "ein Glas Rotwein", keywords: ["rotwein"] },
  { label: "ein Glas Weißwein", keywords: ["weisswein"] },
  { label: "ein Glas Rosé", keywords: ["rose", "rosé"] },
  { label: "ein Glas Wein", keywords: ["wein"] },
  { label: "einen Krug Cider", keywords: ["cider", "cidre"] },
  { label: "ein Glas Sekt", keywords: ["sekt", "schaumwein"] },
  { label: "ein Glas Prosecco", keywords: ["prosecco"] },
  { label: "einen guten Rum", keywords: ["rum", "grog"] },
  { label: "einen Schluck Whisky", keywords: ["whisky", "whiskey", "bourbon", "scotch"] },
  { label: "einen klaren Wodka", keywords: ["wodka", "vodka"] },
  { label: "einen kräftigen Gin", keywords: ["gin"] },
  { label: "einen kleinen Tequila", keywords: ["tequila"] },
  { label: "einen Kräuterlikör", keywords: ["likoer", "likör", "kraeuterlikoer", "kräuterlikör"] },
  { label: "einen Schluck Absinth", keywords: ["absinth", "absinthe"] },
  { label: "einen Weinbrand", keywords: ["weinbrand", "brandy", "cognac"] },
  { label: "einen Schnaps", keywords: ["schnaps", "obstler", "korn"] },
  { label: "einen warmen Tee", keywords: ["tee", "kraeutertee", "kräutertee"] },
  { label: "einen heißen Kaffee", keywords: ["kaffee"] },
  { label: "einen heißen Kakao", keywords: ["kakao", "schokolade", "heisse schokolade", "heiße schokolade"] },
  { label: "ein Glas Wasser", keywords: ["wasser", "quellwasser"] },
  { label: "einen Krug Milch", keywords: ["milch"] },
  { label: "ein Glas Apfelsaft", keywords: ["apfelsaft", "most"] },
  { label: "ein Glas Orangensaft", keywords: ["orangensaft", "orangesaft"] },
  { label: "ein Glas Beerensaft", keywords: ["beerensaft", "beerensaefte", "beerensafte"] },
  { label: "ein Glas Traubensaft", keywords: ["traubensaft"] },
  { label: "ein kühles Bier", keywords: ["bier"] }
];

function isTavernInnkeeperRoom(room, serverId = null) {
  const definition = getCuratedPublicRoomDefinition(room, serverId);
  return String(definition?.key || "").trim().toLowerCase() === TAVERN_INNKEEPER_ROOM_KEY;
}

function normalizeTavernInnkeeperTriggerText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tavernInnkeeperTextIncludesAny(normalizedText, keywords) {
  if (!normalizedText || !Array.isArray(keywords) || !keywords.length) {
    return false;
  }

  return keywords.some((keyword) => normalizedText.includes(String(keyword || "").trim()));
}

function pickRandomTavernInnkeeperReply(replies) {
  if (!Array.isArray(replies) || !replies.length) {
    return "";
  }

  const randomIndex = Math.floor(Math.random() * replies.length);
  return String(replies[randomIndex] || "").trim();
}

function getRequestedTavernDrinkLabel(normalizedText) {
  if (!normalizedText) {
    return "";
  }

  const matchedDrink = TAVERN_INNKEEPER_DRINK_ORDERS.find((entry) =>
    tavernInnkeeperTextIncludesAny(normalizedText, entry.keywords)
  );
  return String(matchedDrink?.label || "").trim();
}

function buildTavernInnkeeperReaction(content, actorName) {
  const normalizedText = normalizeTavernInnkeeperTriggerText(content);
  if (!normalizedText) {
    return "";
  }

  const safeActorName = String(actorName || "").trim() || "dem Gast";
  const mentionsInnkeeper = tavernInnkeeperTextIncludesAny(normalizedText, [
    "edric",
    "muehlenbrand",
    "wirt"
  ]);
  const requestedDrinkLabel = getRequestedTavernDrinkLabel(normalizedText);
  const mentionsDrink = Boolean(requestedDrinkLabel) || tavernInnkeeperTextIncludesAny(normalizedText, [
    "durst",
    "trinken",
    "bestellen",
    "zu trinken"
  ]);
  const mentionsFood = tavernInnkeeperTextIncludesAny(normalizedText, [
    "eintopf",
    "essen",
    "hunger",
    "brot",
    "kueche",
    "mahlzeit"
  ]);
  const mentionsRoom = tavernInnkeeperTextIncludesAny(normalizedText, [
    "zimmer",
    "bett",
    "schlafen",
    "nachtlager",
    "uebernachten"
  ]);
  const saysThanks = tavernInnkeeperTextIncludesAny(normalizedText, [
    "danke",
    "dankeschoen",
    "vielen dank"
  ]);
  const greets = tavernInnkeeperTextIncludesAny(normalizedText, [
    "hallo",
    "guten morgen",
    "guten abend",
    "gruess",
    "grues",
    "moin",
    "servus",
    "tag"
  ]);

  if (!mentionsInnkeeper) {
    return "";
  }

  if (mentionsDrink) {
    const servedDrink = requestedDrinkLabel || "einen frisch gefüllten Krug";
    return pickRandomTavernInnkeeperReply([
      `schiebt ${safeActorName} ${servedDrink} über den Tresen. #Hier, frisch eingeschenkt.#`,
      `stellt ${safeActorName} ${servedDrink} hin und wischt den Tresen sauber. #Greif zu, solange es noch gut ist.#`,
      `gießt ${safeActorName} ${servedDrink} ein und nickt zufrieden. #Der erste Schluck geht auf gute Geschichten.#`,
      `reicht ${safeActorName} ${servedDrink} mit ruhiger Hand. #Im Silbermond-Krug bleibt niemand durstig.#`,
      `stellt ${safeActorName} ${servedDrink} hin und lehnt sich kurz auf den Tresen. #Das wärmt besser als kalte Straßen.#`
    ]);
  }

  if (mentionsFood) {
    return pickRandomTavernInnkeeperReply([
      `stellt ${safeActorName} eine dampfende Schale Eintopf und frisches Brot hin. #Iss erst einmal etwas Warmes.#`,
      `ruft in Richtung Küche und schickt ${safeActorName} kurz darauf eine warme Mahlzeit. #Der Löffel steht schon bereit.#`,
      `legt ${safeActorName} Brot, Käse und einen großen Löffel Eintopf bereit. #Das bringt wieder Kraft in die Knochen.#`,
      `schiebt ${safeActorName} einen Teller mit Braten und Brot heran. #Mehr braucht ein langer Abend nicht.#`
    ]);
  }

  if (mentionsRoom) {
    return pickRandomTavernInnkeeperReply([
      `nickt zum Treppenaufgang. #Oben ist noch ein freies Zimmer für müde Reisende, ${safeActorName}.#`,
      `deutet auf den Flur. #Für die Nacht findet sich hier noch ein ruhiges Bett.#`,
      `stellt einen Schlüssel auf den Tresen. #Im oberen Stock ist noch etwas frei.#`,
      `zieht einen kleinen Messingschlüssel hervor. #Wenn du Ruhe suchst, findest du sie hier oben.#`
    ]);
  }

  if (saysThanks) {
    return pickRandomTavernInnkeeperReply([
      `nickt ruhig. #Gern. Dafür ist der Krug schließlich da.#`,
      `meint freundlich. #Schon gut. Solange die Gäste zufrieden sind, ist der Abend gelungen.#`,
      `winkt ab. #Trink in Ruhe, der Silbermond-Krug kümmert sich um den Rest.#`,
      `lächelt knapp. #Ein dankbarer Gast ist mir lieber als zehn laute.#`
    ]);
  }

  if (greets) {
    return pickRandomTavernInnkeeperReply([
      `hebt ${safeActorName} grüßend die Hand. #Willkommen im Silbermond-Krug.#`,
      `nickt ${safeActorName} freundlich zu. #Kamin, Met und ein freier Platz warten schon.#`,
      `stellt ${safeActorName} einen sauberen Krug hin. #Setz dich, Reisende sind hier willkommen.#`,
      `mustert ${safeActorName} kurz und lächelt dann. #Such dir einen Platz, ich bring dir gleich etwas.#`
    ]);
  }

  return pickRandomTavernInnkeeperReply([
    `wischt den Tresen mit einem Tuch ab und schaut zu ${safeActorName}. #Was darf es sein?#`,
    `stellt sich etwas näher und verschränkt ruhig die Arme. #Wenn du etwas brauchst, sag es nur.#`,
    `hebt fragend eine Braue. #Bier, Bett oder bloß ein offenes Ohr?#`,
    `nickt ${safeActorName} zu. #Der Krug hat heute noch genug Platz und genug Vorräte.#`
  ]);
}

function maybeTriggerTavernInnkeeperReaction({ room, roomId, serverId, content, actorName }) {
  const normalizedRoomId = Number(roomId);
  if (!Number.isInteger(normalizedRoomId) || normalizedRoomId < 1 || !isTavernInnkeeperRoom(room, serverId)) {
    return;
  }

  const reaction = buildTavernInnkeeperReaction(content, actorName);
  if (!reaction) {
    return;
  }

  const normalizedServerId = normalizeServer(serverId);
  const cooldownKey = `${normalizedServerId}:${normalizedRoomId}`;
  const lastReactionAt = Number(tavernInnkeeperLastReactionAtByRoom.get(cooldownKey) || 0);
  const now = Date.now();
  if (now - lastReactionAt < TAVERN_INNKEEPER_COOLDOWN_MS) {
    return;
  }

  tavernInnkeeperLastReactionAtByRoom.set(cooldownKey, now);
  setTimeout(() => {
    if (!getSocketsInChannel(normalizedRoomId, normalizedServerId).length) {
      return;
    }

    emitSystemChatMessage(normalizedRoomId, normalizedServerId, reaction, {
      system_kind: "actor-message",
      presence_actor_name: TAVERN_INNKEEPER_NAME,
      presence_actor_chat_text_color: TAVERN_INNKEEPER_CHAT_TEXT_COLOR
    });
  }, 650);
}

function getStandardRoomForServer(serverId, roomId) {
  const normalizedRoomId = String(roomId || "").trim().toLowerCase();
  if (!normalizedRoomId) return null;
  return (
    getStandardRoomsForServer(serverId).find((room) => room.id === normalizedRoomId) ||
    null
  );
}

function isSharedStandardRoomContext(roomId) {
  const normalizedRoomId = Number(roomId);
  return !(Number.isInteger(normalizedRoomId) && normalizedRoomId > 0);
}

function getChatScopeServerKey(roomId, serverId = DEFAULT_SERVER_ID) {
  return isSharedStandardRoomContext(roomId)
    ? SHARED_STANDARD_ROOM_SCOPE_KEY
    : normalizeServer(serverId);
}

function getSocketActiveServerId(memberSocket, fallbackServerId = DEFAULT_SERVER_ID) {
  const socketServerId = String(memberSocket?.data?.serverId || "").trim().toLowerCase();
  if (ALLOWED_SERVER_IDS.has(socketServerId)) {
    return normalizeServer(socketServerId);
  }

  const presenceServerId = String(memberSocket?.data?.presenceServerId || "").trim().toLowerCase();
  if (ALLOWED_SERVER_IDS.has(presenceServerId)) {
    return normalizeServer(presenceServerId);
  }

  return normalizeServer(fallbackServerId);
}

function getSocketChannelServerId(memberSocket, roomId = null, fallbackServerId = DEFAULT_SERVER_ID) {
  return isSharedStandardRoomContext(roomId)
    ? getSocketActiveServerId(memberSocket, fallbackServerId)
    : normalizeServer(fallbackServerId);
}

function normalizeRoomDescription(rawValue) {
  return String(rawValue || "").trim().slice(0, 160);
}

function normalizeRoomTeaser(rawValue) {
  return normalizeBbcodeInput(rawValue, 4000);
}

function normalizeRoomImageUrl(rawValue) {
  const value = String(rawValue || "").trim().slice(0, 500);
  return /^https?:\/\/.+/i.test(value) ? value : "";
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeBbcodeUrl(rawUrl) {
  const value = normalizeCommonBbcodeUrlTypos(rawUrl);
  if (!value) return null;

  if (/^\/(?!\/)[^\s]*$/i.test(value)) {
    return value;
  }

  if (!/^https?:\/\//i.test(value)) return null;

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch (error) {
    return null;
  }
}

function sanitizeBbcodeColor(rawColor) {
  const value = String(rawColor || "").trim();
  if (!value) return null;
  if (/^#[0-9a-f]{3,8}$/i.test(value)) return value;
  if (/^[a-z]{3,20}$/i.test(value)) return value.toLowerCase();
  return null;
}

function normalizeCommonBbcodeUrlTypos(rawUrl) {
  let value = String(rawUrl || "").trim();
  if (!value) return "";

  value = value
    .replace(/^hhttps:\/\//i, "https://")
    .replace(/^hhttp:\/\//i, "http://")
    .replace(/^ttps:\/\//i, "https://")
    .replace(/^ttp:\/\//i, "http://");

  return value;
}

function sanitizeBbcodeImageUrl(rawUrl) {
  const value = normalizeCommonBbcodeUrlTypos(rawUrl);
  if (!value) return null;

  if (/^\/(?!\/)[^\s]*$/i.test(value)) {
    return value;
  }

  if (/^\/\//.test(value)) {
    return `https:${value}`;
  }

  if (!/^https?:\/\//i.test(value)) {
    const looksLikeHostPath = /^[a-z0-9.-]+\.[a-z]{2,}(?:\/[^\s]*)?$/i.test(value);
    if (!looksLikeHostPath) return null;
    const normalized = `https://${value}`;
    try {
      const parsed = new URL(normalized);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
      return parsed.toString();
    } catch (error) {
      return null;
    }
  }

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch (error) {
    return null;
  }
}

function toGuestbookImageSrc(safeUrl) {
  const value = String(safeUrl || "").trim();
  if (!value) return "";
  if (!/^https?:\/\//i.test(value)) return value;
  return `/media/guestbook-image?url=${encodeURIComponent(value)}`;
}

function toGuestbookDirectImageSrc(safeUrl) {
  const value = String(safeUrl || "").trim();
  if (!value) return "";
  return value;
}

function toGuestbookFallbackImageSrc(safeUrl) {
  const value = toGuestbookDirectImageSrc(safeUrl);
  if (!value) return "";
  if (value.startsWith("/")) return value;
  if (/^https?:\/\/images\.weserv\.nl\//i.test(value)) return value;

  const normalized = value.replace(/^https?:\/\//i, "");
  return `https://images.weserv.nl/?n=-1&url=${encodeURIComponent(normalized)}`;
}

function normalizeGradientColorToken(rawToken) {
  const token = String(rawToken || "").trim();
  if (!token) return null;

  if (/^#?[0-9a-f]{3}$/i.test(token) || /^#?[0-9a-f]{6}$/i.test(token)) {
    return token.startsWith("#") ? token : `#${token}`;
  }

  return sanitizeBbcodeColor(token);
}

function parseGradientSpec(rawSpec) {
  const tokens = String(rawSpec || "")
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
  if (tokens.length < 2) {
    return null;
  }

  let directionKey = null;
  let colorTokens = tokens;
  if (tokens.length >= 4 && /^[01]$/.test(tokens[0]) && /^[01]$/.test(tokens[1])) {
    directionKey = `${tokens[0]},${tokens[1]}`;
    colorTokens = tokens.slice(2);
  }

  const colors = colorTokens
    .map((token) => normalizeGradientColorToken(token))
    .filter(Boolean);
  if (colors.length < 2) {
    return null;
  }

  const angleMap = {
    "0,0": 90,
    "0,1": 135,
    "1,0": 45,
    "1,1": 180
  };

  return {
    angle: directionKey ? angleMap[directionKey] ?? 90 : 90,
    colors
  };
}

function createBbcodeWrapRegex(tag) {
  return new RegExp(`\\[\\s*${tag}\\s*\\]([\\s\\S]*?)\\[\\s*\\/\\s*${tag}\\s*\\]`, "gi");
}

function createBbcodeOptionRegex(tag) {
  return new RegExp(`\\[\\s*${tag}\\s*=\\s*([^\\]]+?)\\s*\\]([\\s\\S]*?)\\[\\s*\\/\\s*${tag}\\s*\\]`, "gi");
}

function createBbcodeSingleRegex(tag) {
  return new RegExp(`\\[\\s*${tag}\\s*\\]`, "gi");
}

function createBbcodeShortGradientRegex() {
  const colorTokenPattern = "(?:#?[0-9a-f]{3}(?:[0-9a-f]{3})?|[a-z]{3,20})";
  const specPattern = `((?:[01]\\s*,\\s*[01]\\s*,\\s*)?(?:${colorTokenPattern}\\s*,\\s*)+${colorTokenPattern})`;
  return new RegExp(`\\[\\s*${specPattern}\\s*\\]([\\s\\S]*?)\\[\\s*\\/\\s*gradient\\s*\\]`, "gi");
}

function replaceInnermostBbcodeWrap(html, tag, replacement) {
  const pattern = new RegExp(
    `\\[\\s*${tag}\\s*\\]((?:(?!\\[\\s*${tag}\\s*\\]|\\[\\s*\\/\\s*${tag}\\s*\\])[\\s\\S])*)\\[\\s*\\/\\s*${tag}\\s*\\]`,
    "gi"
  );

  let nextHtml = String(html || "");
  let previousHtml = "";
  while (nextHtml !== previousHtml) {
    previousHtml = nextHtml;
    nextHtml = nextHtml.replace(pattern, replacement);
  }

  return nextHtml;
}

const BBCODE_LITERAL_OPEN_TOKEN = "__BBCODE_LITERAL_OPEN__";
const BBCODE_LITERAL_CLOSE_TOKEN = "__BBCODE_LITERAL_CLOSE__";

function normalizeBbcodeMarkup(rawContent) {
  return String(rawContent || "")
    .replace(/[ï¼»ã€]/g, "[")
    .replace(/[ï¼½ã€‘]/g, "]")
    .replace(/\[([\s\S]*?)\]/g, (full, inner) => {
      const normalizedInner = String(inner || "")
        .replace(/[\u200B\u200C\u200D\u2060\uFEFF]/g, "")
        .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, " ");
      return `[${normalizedInner}]`;
    });
}

function normalizeBbcodeMarkup(rawContent) {
  const supportedTags = [
    "gradient",
    "spoiler",
    "center",
    "right",
    "left",
    "block",
    "table",
    "quote",
    "color",
    "url",
    "img",
    "code",
    "gb",
    "hr",
    "tr",
    "td",
    "h1",
    "h2",
    "h3",
    "ab18",
    "b",
    "i",
    "u",
    "s"
  ];

  return String(rawContent || "")
    .replace(/\\\[/g, BBCODE_LITERAL_OPEN_TOKEN)
    .replace(/\\\]/g, BBCODE_LITERAL_CLOSE_TOKEN)
    .replace(/[\uFF3B\u3010\u3014\u2772\u27E6]/g, "[")
    .replace(/[\uFF3D\u3011\u3015\u2773\u27E7]/g, "]")
    .replace(/\[([\s\S]*?)\]/g, (full, inner) => {
      const normalizedInner = String(inner || "")
        .replace(/\p{Cf}/gu, "")
        .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      const findTagName = (candidate) => supportedTags.find((tag) => {
        const flexibleTagPattern = `^${tag.split("").map((char) => `${char}\\s*`).join("")}$`;
        return new RegExp(flexibleTagPattern, "i").test(candidate);
      }) || null;

      const closingBody = normalizedInner.startsWith("/") ? normalizedInner.slice(1).trim() : "";
      if (closingBody) {
        const closingTagName = findTagName(closingBody);
        if (closingTagName) {
          return `[/${closingTagName}]`;
        }
      }

      for (const tag of supportedTags) {
        const flexibleTagPattern = tag.split("").map((char) => `${char}\\s*`).join("");
        const openingMatch = normalizedInner.match(new RegExp(`^(${flexibleTagPattern})([\\s\\S]*)$`, "i"));
        if (!openingMatch) {
          continue;
        }

        const remainder = String(openingMatch[2] || "").trim();
        if (!remainder) {
          return `[${tag}]`;
        }
        if (remainder.startsWith("=")) {
          return `[${tag}=${remainder.slice(1).trim()}]`;
        }
        return `[${tag} ${remainder}]`;
      }

      return `[${normalizedInner}]`;
    });
}

function normalizeBbcodeInput(rawContent, maxLength) {
  return normalizeBbcodeMarkup(String(rawContent || "").slice(0, maxLength)).trim();
}

function normalizeGuestbookPageContentInput(rawContent, maxLength) {
  return normalizeBbcodeMarkup(String(rawContent || "").slice(0, maxLength)).replace(/\r\n?/g, "\n");
}

function getCharacterByExactName(name) {
  const normalizedName = String(name || "").trim();
  if (!normalizedName) return null;

  return db
    .prepare(
      `SELECT c.id, c.name
       FROM characters c
       WHERE c.name = ? COLLATE NOCASE
       LIMIT 1`
    )
    .get(normalizedName);
}

function getCharacterByExactNameForServer(name, serverId) {
  const normalizedName = String(name || "").trim();
  const normalizedServerId = normalizeServer(serverId);
  if (!normalizedName) return null;

  return db
    .prepare(
      `SELECT c.id, c.user_id, c.name, c.server_id
       FROM characters c
       WHERE c.name = ? COLLATE NOCASE
         AND c.server_id = ?
       LIMIT 1`
    )
    .get(normalizedName, normalizedServerId);
}

function renderGuestbookBbcode(rawContent) {
  const normalizedContent = normalizeBbcodeMarkup(String(rawContent || "").slice(0, 12000));
  let html = escapeHtml(normalizedContent).replace(/\r\n?/g, "\n");

  const inlineTags = [
    ["b", "strong"],
    ["i", "em"],
    ["u", "u"],
    ["s", "s"]
  ];

  html = html.replace(createBbcodeSingleRegex("hr"), "<hr class=\"bb-hr\">");

  [
    ["h1", "<h1>$1</h1>"],
    ["h2", "<h2>$1</h2>"],
    ["h3", "<h3>$1</h3>"],
    ["left", "<div class=\"bb-left\">$1</div>"],
    ["center", "<div class=\"bb-center\">$1</div>"],
    ["right", "<div class=\"bb-right\">$1</div>"],
    ["block", "<div class=\"bb-block\">$1</div>"]
  ].forEach(([tag, replacement]) => {
    html = replaceInnermostBbcodeWrap(html, tag, replacement);
  });

  html = replaceInnermostBbcodeWrap(html, "table", "<table class=\"bb-table\">$1</table>");
  html = replaceInnermostBbcodeWrap(html, "tr", "<tr>$1</tr>");
  html = replaceInnermostBbcodeWrap(html, "td", "<td>$1</td>");

  html = html.replace(createBbcodeOptionRegex("spoiler"), (full, title, inner) => (
    `<details class="bb-spoiler"><summary>${title}</summary><div class="bb-spoiler-content">${inner}</div></details>`
  ));
  html = replaceInnermostBbcodeWrap(
    html,
    "ab18",
    "<details class=\"bb-spoiler bb-spoiler-ab18\"><summary>Ab 18 Inhalt</summary><div class=\"bb-spoiler-content\">$1</div></details>"
  );

  html = html.replace(/\[\s*img([^\]]*)\]([\s\S]*?)\[\s*\/\s*img\s*\]/gi, (full, rawAttributes, rawUrl) => {
    const safeUrl = sanitizeBbcodeImageUrl(rawUrl);
    if (!safeUrl) return "";

    const attributeText = String(rawAttributes || "");
    const floatMatch = attributeText.match(/\bfloat\s*=\s*["']?\s*(left|right)\s*["']?/i);
    const floatValue = floatMatch ? floatMatch[1].toLowerCase() : "";
    const floatClass = floatValue ? ` bb-image-${floatValue}` : "";
    const directSrc = escapeHtml(toGuestbookImageSrc(safeUrl));
    const fallbackSrc = escapeHtml(toGuestbookFallbackImageSrc(safeUrl));
    return `<img class="bb-image${floatClass}" src="${directSrc}" data-guestbook-image-fallback="1" data-fallback-src="${fallbackSrc}" alt="Bild" loading="lazy" />`;
  });

  inlineTags.forEach(([bbTag, htmlTag]) => {
    const re = createBbcodeWrapRegex(bbTag);
    html = html.replace(re, `<${htmlTag}>$1</${htmlTag}>`);
  });

  html = replaceInnermostBbcodeWrap(html, "quote", "<blockquote>$1</blockquote>");
  html = replaceInnermostBbcodeWrap(html, "code", "<code>$1</code>");

  html = html.replace(/\[\s*url\s*=\s*([^\]]+?)\s*\]([\s\S]*?)\[\s*\/\s*url\s*\]/gi, (full, rawUrl, label) => {
    const safeUrl = sanitizeBbcodeUrl(rawUrl);
    if (!safeUrl) return label;
    return `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });

  html = html.replace(/\[\s*url\s*\]([^\[]+)\[\s*\/\s*url\s*\]/gi, (full, rawUrl) => {
    const safeUrl = sanitizeBbcodeUrl(rawUrl);
    if (!safeUrl) return escapeHtml(rawUrl);
    const safeLabel = escapeHtml(safeUrl);
    return `<a href="${safeLabel}" target="_blank" rel="noopener noreferrer">${safeLabel}</a>`;
  });

  html = html.replace(createBbcodeWrapRegex("gb"), (full, rawName) => {
    const safeLabel = String(rawName || "").replace(/<br\s*\/?>/gi, " ").trim();
    if (!safeLabel) return "";

    const targetCharacter = getCharacterByExactName(safeLabel);
    if (!targetCharacter) return safeLabel;

    return `<a href="/characters/${targetCharacter.id}/guestbook" target="_blank" rel="noopener noreferrer">${safeLabel}</a>`;
  });

  html = html.replace(createBbcodeOptionRegex("color"), (full, rawColor, inner) => {
    const safeColor = sanitizeBbcodeColor(rawColor);
    if (!safeColor) return inner;
    return `<span style="color:${safeColor}">${inner}</span>`;
  });

  html = html.replace(createBbcodeOptionRegex("gradient"), (full, rawSpec, inner) => {
    const gradient = parseGradientSpec(rawSpec);
    if (!gradient) return inner;
    return `<span class="bb-gradient" style="background-image:linear-gradient(${gradient.angle}deg, ${gradient.colors.join(", ")})">${inner}</span>`;
  });

  html = html.replace(createBbcodeShortGradientRegex(), (full, rawSpec, inner) => {
    const gradient = parseGradientSpec(rawSpec);
    if (!gradient) return inner;
    return `<span class="bb-gradient" style="background-image:linear-gradient(${gradient.angle}deg, ${gradient.colors.join(", ")})">${inner}</span>`;
  });

  html = html.replace(/\n/g, "<br>");
  html = html.replace(
    /<br>\s*(<img class="bb-image(?: bb-image-(?:left|right))?"[^>]*>)/gi,
    "$1"
  );
  html = html.replace(
    /(<img class="bb-image(?: bb-image-(?:left|right))?"[^>]*>)\s*<br>/gi,
    "$1"
  );
  html = html.replace(
    /<br>\s*(<\/?(?:table|tr|td|h1|h2|h3|blockquote|details|summary|div)\b[^>]*>|<hr class="bb-hr">)/gi,
    "$1"
  );
  html = html.replace(
    /(<\/?(?:table|tr|td|h1|h2|h3|blockquote|details|summary|div)\b[^>]*>|<hr class="bb-hr">)\s*<br>/gi,
    "$1"
  );
  html = html
    .replace(new RegExp(BBCODE_LITERAL_OPEN_TOKEN, "g"), "[")
    .replace(new RegExp(BBCODE_LITERAL_CLOSE_TOKEN, "g"), "]");

  return html;
}

function normalizeGuestbookColor(rawColor) {
  const prepared = String(rawColor || "").trim();
  if (/^#[0-9a-f]{6}$/i.test(prepared)) {
    return prepared.toUpperCase();
  }
  return "#AEE7B7";
}

function normalizeOptionalGuestbookColor(rawColor) {
  const prepared = String(rawColor || "").trim();
  if (!prepared) {
    return "";
  }
  return /^#[0-9a-f]{6}$/i.test(prepared) ? prepared.toUpperCase() : "";
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

function getGuestbookEditorPayload(body, existingSettings = null) {
  const pageContent = normalizeGuestbookPageContentInput(body.page_content, 12000);
  const safeBody = body || {};
  const existingImageUrl = String(existingSettings?.image_url || "").trim().slice(0, 500);
  const existingInnerImageUrl = String(existingSettings?.inner_image_url || "").trim().slice(0, 500);
  const existingOuterImageUrl = String(existingSettings?.outer_image_url || "").trim().slice(0, 500);
  const existingCensorLevel = normalizeGuestbookOption(
    existingSettings?.censor_level,
    GUESTBOOK_CENSOR_OPTIONS,
    "none"
  );
  const existingPageStyle = normalizeGuestbookOption(
    existingSettings?.page_style,
    GUESTBOOK_PAGE_STYLE_OPTIONS,
    "scroll"
  );
  const existingChatTextColor = normalizeGuestbookColor(existingSettings?.chat_text_color);
  const existingPageTextColor =
    normalizeGuestbookColor(existingSettings?.page_text_color) || DEFAULT_GUESTBOOK_PAGE_TEXT_COLOR;
  const existingFrameColor = normalizeOptionalGuestbookColor(existingSettings?.frame_color);
  const existingBackgroundColor = normalizeOptionalGuestbookColor(existingSettings?.background_color);
  const existingSurroundColor = normalizeOptionalGuestbookColor(existingSettings?.surround_color);
  const existingInnerImageOpacity = normalizeGuestbookOpacity(existingSettings?.inner_image_opacity, 100);
  const existingOuterImageOpacity = normalizeGuestbookOpacity(existingSettings?.outer_image_opacity, 100);
  const existingInnerImageRepeat = 0;
  const existingOuterImageRepeat = 0;
  const hasImageUrlField = Object.prototype.hasOwnProperty.call(safeBody, "image_url");
  const hasInnerImageUrlField = Object.prototype.hasOwnProperty.call(safeBody, "inner_image_url");
  const hasOuterImageUrlField = Object.prototype.hasOwnProperty.call(safeBody, "outer_image_url");
  const hasClearInnerImageField = Object.prototype.hasOwnProperty.call(safeBody, "clear_inner_image");
  const hasClearOuterImageField = Object.prototype.hasOwnProperty.call(safeBody, "clear_outer_image");
  const hasInnerImageOpacityField = Object.prototype.hasOwnProperty.call(safeBody, "inner_image_opacity");
  const hasOuterImageOpacityField = Object.prototype.hasOwnProperty.call(safeBody, "outer_image_opacity");
  const hasInnerImageRepeatField = Object.prototype.hasOwnProperty.call(safeBody, "inner_image_repeat");
  const hasOuterImageRepeatField = Object.prototype.hasOwnProperty.call(safeBody, "outer_image_repeat");
  const hasCensorLevelField = Object.prototype.hasOwnProperty.call(safeBody, "censor_level");
  const hasChatTextColorField = Object.prototype.hasOwnProperty.call(safeBody, "chat_text_color");
  const hasFrameColorField = Object.prototype.hasOwnProperty.call(safeBody, "frame_color");
  const hasBackgroundColorField = Object.prototype.hasOwnProperty.call(safeBody, "background_color");
  const hasSurroundColorField = Object.prototype.hasOwnProperty.call(safeBody, "surround_color");
  const hasPageStyleField = Object.prototype.hasOwnProperty.call(safeBody, "page_style");
  const imageUrl = hasImageUrlField
    ? String(safeBody.image_url || "").trim().slice(0, 500)
    : existingImageUrl;
  const innerImageUrl = hasInnerImageUrlField
    ? String(safeBody.inner_image_url || "").trim().slice(0, 500)
    : existingInnerImageUrl;
  const outerImageUrl = hasOuterImageUrlField
    ? String(safeBody.outer_image_url || "").trim().slice(0, 500)
    : existingOuterImageUrl;
  const shouldClearInnerImage = hasClearInnerImageField && String(safeBody.clear_inner_image || "").trim() === "1";
  const shouldClearOuterImage = hasClearOuterImageField && String(safeBody.clear_outer_image || "").trim() === "1";
  const sanitizedImageUrl = /^https?:\/\/.+/i.test(imageUrl) ? imageUrl : "";
  const sanitizedInnerImageUrl = shouldClearInnerImage
    ? ""
    : (/^https?:\/\/.+/i.test(innerImageUrl) ? innerImageUrl : "");
  const sanitizedOuterImageUrl = shouldClearOuterImage
    ? ""
    : (/^https?:\/\/.+/i.test(outerImageUrl) ? outerImageUrl : "");
  const censorLevel = hasCensorLevelField
    ? normalizeGuestbookOption(safeBody.censor_level, GUESTBOOK_CENSOR_OPTIONS, existingCensorLevel)
    : existingCensorLevel;
  const chatTextColor = hasChatTextColorField
    ? normalizeGuestbookColor(safeBody.chat_text_color)
    : existingChatTextColor;
  const frameColor = hasFrameColorField
    ? normalizeOptionalGuestbookColor(safeBody.frame_color)
    : existingFrameColor;
  const backgroundColor = hasBackgroundColorField
    ? normalizeOptionalGuestbookColor(safeBody.background_color)
    : existingBackgroundColor;
  const surroundColor = hasSurroundColorField
    ? normalizeOptionalGuestbookColor(safeBody.surround_color)
    : existingSurroundColor;
  const innerImageOpacity = hasInnerImageOpacityField
    ? normalizeGuestbookOpacity(safeBody.inner_image_opacity, existingInnerImageOpacity)
    : existingInnerImageOpacity;
  const outerImageOpacity = hasOuterImageOpacityField
    ? normalizeGuestbookOpacity(safeBody.outer_image_opacity, existingOuterImageOpacity)
    : existingOuterImageOpacity;
  const innerImageRepeat = hasInnerImageRepeatField
    ? (String(safeBody.inner_image_repeat || "").trim() === "1" ? 1 : 0)
    : 0;
  const outerImageRepeat = hasOuterImageRepeatField
    ? (String(safeBody.outer_image_repeat || "").trim() === "1" ? 1 : 0)
    : 0;
  const pageStyle = hasPageStyleField
    ? normalizeGuestbookOption(safeBody.page_style, GUESTBOOK_PAGE_STYLE_OPTIONS, existingPageStyle)
    : existingPageStyle;
  const themeStyle = normalizeGuestbookOption(
    safeBody.theme_style,
    GUESTBOOK_THEME_STYLE_OPTIONS,
    "pergament-gold"
  );
  const fontStyle = normalizeGuestbookOption(
    safeBody.font_style,
    GUESTBOOK_FONT_STYLE_OPTIONS,
    "default"
  );
  return {
    pageContent,
    settings: {
      image_url: sanitizedImageUrl,
      inner_image_url: sanitizedInnerImageUrl,
      outer_image_url: sanitizedOuterImageUrl,
      inner_image_opacity: innerImageOpacity,
      outer_image_opacity: outerImageOpacity,
      inner_image_repeat: innerImageRepeat,
      outer_image_repeat: outerImageRepeat,
      censor_level: censorLevel,
      chat_text_color: chatTextColor,
      page_text_color: existingPageTextColor,
      frame_color: frameColor,
      background_color: backgroundColor,
      surround_color: surroundColor,
      page_style: pageStyle,
      theme_style: themeStyle,
      font_style: fontStyle,
      tags: ""
    }
  };
}

function buildGuestbookPageSettings(baseSettings = null, page = null) {
  return {
    image_url: /^https?:\/\/.+/i.test(String(page?.image_url || "").trim())
      ? String(page.image_url || "").trim().slice(0, 500)
      : "",
    inner_image_url: /^https?:\/\/.+/i.test(String(page?.inner_image_url || "").trim())
      ? String(page.inner_image_url || "").trim().slice(0, 500)
      : "",
    outer_image_url: /^https?:\/\/.+/i.test(String(page?.outer_image_url || "").trim())
      ? String(page.outer_image_url || "").trim().slice(0, 500)
      : "",
    inner_image_opacity: normalizeGuestbookOpacity(page?.inner_image_opacity, 100),
    outer_image_opacity: normalizeGuestbookOpacity(page?.outer_image_opacity, 100),
    inner_image_repeat: 0,
    outer_image_repeat: 0,
    censor_level: normalizeGuestbookOption(baseSettings?.censor_level, GUESTBOOK_CENSOR_OPTIONS, "none"),
    chat_text_color: normalizeGuestbookColor(baseSettings?.chat_text_color),
    page_text_color:
      normalizeGuestbookColor(baseSettings?.page_text_color) || DEFAULT_GUESTBOOK_PAGE_TEXT_COLOR,
    frame_color: normalizeOptionalGuestbookColor(page?.frame_color),
    background_color: normalizeOptionalGuestbookColor(page?.background_color),
    surround_color: normalizeOptionalGuestbookColor(page?.surround_color),
    page_style: normalizeGuestbookOption(page?.page_style, GUESTBOOK_PAGE_STYLE_OPTIONS, "scroll"),
    theme_style: normalizeGuestbookOption(page?.theme_style, GUESTBOOK_THEME_STYLE_OPTIONS, "pergament-gold"),
    font_style: normalizeGuestbookOption(baseSettings?.font_style, GUESTBOOK_FONT_STYLE_OPTIONS, "default"),
    tags: ""
  };
}

function ensureGuestbookPages(characterId) {
  const existingPages = db
    .prepare(
      `SELECT id, character_id, page_number, title, content, image_url, inner_image_url, outer_image_url,
              inner_image_opacity, outer_image_opacity, inner_image_repeat, outer_image_repeat, frame_color,
              background_color, surround_color, page_style, theme_style, created_at, updated_at
       FROM guestbook_pages
       WHERE character_id = ?
       ORDER BY page_number ASC, id ASC`
    )
    .all(characterId);

  if (existingPages.length) {
    return existingPages;
  }

  const currentSettings = getOrCreateGuestbookSettings(characterId);
  const defaultSettings = buildGuestbookPageSettings(currentSettings, currentSettings);

  db.prepare(
    `INSERT INTO guestbook_pages (
       character_id,
       page_number,
       title,
       content,
       image_url,
       inner_image_url,
       outer_image_url,
       inner_image_opacity,
       outer_image_opacity,
       inner_image_repeat,
       outer_image_repeat,
       frame_color,
       background_color,
       surround_color,
       page_style,
       theme_style
     )
     VALUES (?, 1, '1', '', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    characterId,
    defaultSettings.image_url,
    defaultSettings.inner_image_url,
    defaultSettings.outer_image_url,
    defaultSettings.inner_image_opacity,
    defaultSettings.outer_image_opacity,
    defaultSettings.inner_image_repeat,
    defaultSettings.outer_image_repeat,
    defaultSettings.frame_color,
    defaultSettings.background_color,
    defaultSettings.surround_color,
    defaultSettings.page_style,
    defaultSettings.theme_style
  );

  return db
    .prepare(
      `SELECT id, character_id, page_number, title, content, image_url, inner_image_url, outer_image_url,
              inner_image_opacity, outer_image_opacity, inner_image_repeat, outer_image_repeat, frame_color,
              background_color, surround_color, page_style, theme_style, created_at, updated_at
       FROM guestbook_pages
       WHERE character_id = ?
       ORDER BY page_number ASC, id ASC`
    )
    .all(characterId);
}

function orderGuestbookPages(pages) {
  return Array.isArray(pages)
    ? [...pages].sort((left, right) => {
        const leftPageNumber = Number(left.page_number) || 0;
        const rightPageNumber = Number(right.page_number) || 0;
        if (leftPageNumber !== rightPageNumber) return leftPageNumber - rightPageNumber;
        return (Number(left.id) || 0) - (Number(right.id) || 0);
      })
    : [];
}

function buildGuestbookPageNavigation(pages, activePageId, buildPageUrl) {
  const orderedPages = orderGuestbookPages(pages);
  const activeIndex = orderedPages.findIndex((page) => Number(page.id) === Number(activePageId));
  const previousPage = activeIndex > 0 ? orderedPages[activeIndex - 1] : null;
  const nextPage =
    activeIndex >= 0 && activeIndex < orderedPages.length - 1 ? orderedPages[activeIndex + 1] : null;

  const withUrl = (page) => (page ? { ...page, url: buildPageUrl(page.id) } : null);

  return {
    hasMultiplePages: orderedPages.length > 1,
    previousPage: withUrl(previousPage),
    nextPage: withUrl(nextPage)
  };
}

function renumberGuestbookPages(characterId) {
  const pages = db
    .prepare(
      `SELECT id
       FROM guestbook_pages
       WHERE character_id = ?
       ORDER BY page_number ASC, id ASC`
    )
    .all(characterId);

  const updatePage = db.prepare(
    `UPDATE guestbook_pages
     SET page_number = ?, title = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  );

  const tx = db.transaction(() => {
    pages.forEach((page, index) => {
      const nextNumber = index + 1;
      updatePage.run(nextNumber, String(nextNumber), page.id);
    });
  });

  tx();
}

function getOrCreateGuestbookSettings(characterId) {
  let settings = db
    .prepare(
      `SELECT character_id, image_url, inner_image_url, outer_image_url, inner_image_opacity, outer_image_opacity, inner_image_repeat, outer_image_repeat, censor_level, chat_text_color, page_text_color, frame_color, background_color, surround_color, page_style, theme_style, font_style, tags
       FROM guestbook_settings
       WHERE character_id = ?`
    )
    .get(characterId);

  if (!settings) {
    db.prepare(
      `INSERT INTO guestbook_settings (character_id)
       VALUES (?)`
    ).run(characterId);
    settings = db
      .prepare(
        `SELECT character_id, image_url, inner_image_url, outer_image_url, inner_image_opacity, outer_image_opacity, inner_image_repeat, outer_image_repeat, censor_level, chat_text_color, page_text_color, frame_color, background_color, surround_color, page_style, theme_style, font_style, tags
         FROM guestbook_settings
         WHERE character_id = ?`
      )
      .get(characterId);
  }

  return settings;
}

function saveCharacterChatColor(characterId, rawColor) {
  getOrCreateGuestbookSettings(characterId);
  db.prepare(
    `UPDATE guestbook_settings
     SET chat_text_color = ?
     WHERE character_id = ?`
  ).run(normalizeGuestbookColor(rawColor), characterId);
}

function getOwnedCharactersForUser(userId, preferredServerId = DEFAULT_SERVER_ID) {
  const normalizedPreferredServerId = normalizeServer(preferredServerId);
  return db
    .prepare(
      `SELECT id, user_id, name, server_id, is_public, updated_at
       FROM characters
       WHERE user_id = ?
       ORDER BY CASE WHEN server_id = ? THEN 0 ELSE 1 END, lower(name) ASC, id ASC`
    )
    .all(userId, normalizedPreferredServerId);
}

const getOwnedCharacterForUserStatement = db.prepare(
  `SELECT id, user_id, name, server_id
   FROM characters
   WHERE id = ?
     AND user_id = ?
   LIMIT 1`
);
const getCharacterPrivateNoteForUserStatement = db.prepare(
  `SELECT content, updated_at
   FROM character_private_notes
   WHERE character_id = ?
     AND user_id = ?
   LIMIT 1`
);
const upsertCharacterPrivateNoteForUserStatement = db.prepare(`
  INSERT INTO character_private_notes (character_id, user_id, content, updated_at)
  VALUES (?, ?, ?, CURRENT_TIMESTAMP)
  ON CONFLICT(character_id)
  DO UPDATE SET
    user_id = excluded.user_id,
    content = excluded.content,
    updated_at = CURRENT_TIMESTAMP
`);
const deleteCharacterPrivateNoteForUserStatement = db.prepare(
  `DELETE FROM character_private_notes
   WHERE character_id = ?
     AND user_id = ?`
);

function normalizeCharacterPrivateNoteInput(input, maxLength = 4000) {
  return String(input || "")
    .replace(/\r\n?/g, "\n")
    .slice(0, maxLength);
}

function getOwnedCharacterForUser(userId, characterId) {
  const parsedUserId = Number(userId);
  const parsedCharacterId = Number(characterId);
  if (!Number.isInteger(parsedUserId) || parsedUserId < 1) {
    return null;
  }
  if (!Number.isInteger(parsedCharacterId) || parsedCharacterId < 1) {
    return null;
  }

  return getOwnedCharacterForUserStatement.get(parsedCharacterId, parsedUserId) || null;
}

function getCharacterPrivateNoteForUser(userId, characterId) {
  const character = getOwnedCharacterForUser(userId, characterId);
  if (!character) {
    return null;
  }

  const row = getCharacterPrivateNoteForUserStatement.get(character.id, Number(userId));
  return {
    character,
    content: String(row?.content || ""),
    updated_at: String(row?.updated_at || "").trim()
  };
}

function saveCharacterPrivateNoteForUser(userId, characterId, rawContent) {
  const character = getOwnedCharacterForUser(userId, characterId);
  if (!character) {
    return null;
  }

  const normalizedContent = normalizeCharacterPrivateNoteInput(rawContent);
  if (normalizedContent.trim()) {
    upsertCharacterPrivateNoteForUserStatement.run(
      character.id,
      Number(userId),
      normalizedContent
    );
  } else {
    deleteCharacterPrivateNoteForUserStatement.run(character.id, Number(userId));
  }

  return getCharacterPrivateNoteForUser(userId, character.id);
}

function getPreferredMenuCharacterForUser(req) {
  const currentUserId = Number(req.session?.user?.id);
  if (!Number.isInteger(currentUserId) || currentUserId < 1) {
    return null;
  }

  const preferredMap = normalizePreferredCharacterMap(req.session?.preferred_character_ids);
  const candidateIds = SERVER_OPTIONS.map((server) => Number(preferredMap[server.id]))
    .filter((id) => Number.isInteger(id) && id > 0);

  for (const characterId of candidateIds) {
    const character = getCharacterById(characterId);
    if (character && Number(character.user_id) === currentUserId) {
      return character;
    }
  }

  return db
    .prepare(
      `SELECT c.*, u.username AS owner_name, f.name AS festplay_name
       FROM characters c
       JOIN users u ON u.id = c.user_id
       LEFT JOIN festplays f ON f.id = c.festplay_id
       WHERE c.user_id = ?
       ORDER BY c.updated_at DESC, c.id DESC
       LIMIT 1`
    )
    .get(currentUserId);
}

function getGuestbookPostingCharacters(req, targetCharacter) {
  const currentUserId = Number(req.session?.user?.id);
  if (!Number.isInteger(currentUserId) || currentUserId < 1) {
    return { characters: [], selectedCharacterId: null };
  }

  const targetServerId = normalizeServer(targetCharacter?.server_id);
  const characters = getOwnedCharactersForUser(currentUserId, targetServerId);
  const preferredCharacterId = getPreferredCharacterIdFromSession(req, targetServerId);
  let selectedCharacterId = null;

  if (Number.isInteger(preferredCharacterId) && characters.some((entry) => Number(entry.id) === preferredCharacterId)) {
    selectedCharacterId = preferredCharacterId;
  } else {
    const sameServerCharacter = characters.find(
      (entry) => normalizeServer(entry.server_id) === targetServerId
    );
    selectedCharacterId = sameServerCharacter ? Number(sameServerCharacter.id) : Number(characters[0]?.id || 0) || null;
  }

  return {
    characters,
    selectedCharacterId
  };
}

function isGuestbookReplyAccessAllowed(userId, targetCharacterId, sourceEntryId, replyToCharacterId) {
  const parsedUserId = Number(userId);
  const parsedTargetCharacterId = Number(targetCharacterId);
  const parsedSourceEntryId = Number(sourceEntryId);
  const parsedReplyToCharacterId = Number(replyToCharacterId);

  if (
    !Number.isInteger(parsedUserId) ||
    parsedUserId < 1 ||
    !Number.isInteger(parsedTargetCharacterId) ||
    parsedTargetCharacterId < 1 ||
    !Number.isInteger(parsedSourceEntryId) ||
    parsedSourceEntryId < 1 ||
    !Number.isInteger(parsedReplyToCharacterId) ||
    parsedReplyToCharacterId < 1
  ) {
    return false;
  }

  const row = db
    .prepare(
      `SELECT ge.id
       FROM guestbook_entries ge
       JOIN characters reply_target ON reply_target.id = ge.character_id
       WHERE ge.id = ?
         AND ge.author_character_id = ?
         AND ge.character_id = ?
         AND reply_target.user_id = ?
       LIMIT 1`
    )
    .get(parsedSourceEntryId, parsedTargetCharacterId, parsedReplyToCharacterId, parsedUserId);

  return Boolean(row);
}

function getGuestbookAccessState(req, targetCharacter) {
  const currentUserId = Number(req.session?.user?.id);
  const isOwner = currentUserId === Number(targetCharacter?.user_id);
  const isAdmin = req.session?.user?.is_admin === true;
  const canAccessDirectly = canAccessCharacter(
    currentUserId,
    targetCharacter?.user_id,
    targetCharacter?.is_public,
    isAdmin
  );
  const replyContextEntryId = Number(req.query.reply_from_entry || req.body.reply_context_entry_id);
  const replyContextCharacterId = Number(req.query.reply_to_character || req.body.reply_context_character_id);
  const viaReplyAccess = !canAccessDirectly && isGuestbookReplyAccessAllowed(
    currentUserId,
    targetCharacter?.id,
    replyContextEntryId,
    replyContextCharacterId
  );
  const canAccessBase = canAccessDirectly || viaReplyAccess;
  const guestbookSettings = canAccessBase ? getOrCreateGuestbookSettings(targetCharacter?.id) : null;
  const censorLevel = canAccessBase
    ? normalizeGuestbookOption(guestbookSettings?.censor_level, GUESTBOOK_CENSOR_OPTIONS, "none")
    : "none";
  const isAgeRestricted = censorLevel === "ab18" || censorLevel === "sexual";
  let viewerAge = null;
  let missingBirthDate = false;
  let passesAgeGate = true;

  if (canAccessBase && isAgeRestricted && !isOwner && !isAdmin) {
    const viewerAccount = getAccountUserById(currentUserId);
    viewerAge = getAgeFromBirthDate(viewerAccount?.birth_date);
    missingBirthDate = viewerAge === null;
    passesAgeGate = viewerAge !== null && viewerAge >= 18;
  }

  const denialReason = !canAccessBase
    ? "private"
    : (!passesAgeGate ? "age-restricted" : null);

  return {
    isOwner,
    isAdmin,
    canAccess: canAccessBase && passesAgeGate,
    viaReplyAccess,
    denialReason,
    censorLevel,
    minimumAge: isAgeRestricted ? 18 : null,
    viewerAge,
    missingBirthDate,
    replyContextEntryId: Number.isInteger(replyContextEntryId) && replyContextEntryId > 0 ? replyContextEntryId : null,
    replyContextCharacterId:
      Number.isInteger(replyContextCharacterId) && replyContextCharacterId > 0 ? replyContextCharacterId : null
  };
}

function buildGuestbookAccessDeniedPayload(accessState = {}) {
  if (accessState?.denialReason === "age-restricted") {
    if (accessState?.censorLevel === "sexual") {
      return {
        title: "Du bist nicht alt genug",
        message: accessState?.missingBirthDate
          ? "Dieses Gästebuch enthält sexuelle Darstellung. Ohne hinterlegtes Geburtsdatum bleibt der Vorhang leider zu."
          : "Dieses Gästebuch enthält sexuelle Darstellung. Der Vorhang bleibt bis zu deinem 18. Geburtstag noch geschlossen."
      };
    }

    return {
      title: "Du bist nicht alt genug",
      message: accessState?.missingBirthDate
        ? "Dieses Gästebuch ist ab 18 freigeschaltet. Ohne hinterlegtes Geburtsdatum nickt der Türsteher dich leider nicht durch."
        : "Dieses Gästebuch ist ab 18 freigeschaltet. Der Türsteher hat deinen Ausweis geprüft und dich diesmal noch nicht reingewunken."
    };
  }

  return {
    title: "Kein Zugriff",
    message: "Dieser Charakter ist privat."
  };
}

function renderGuestbookAccessDenied(res, accessState) {
  return res.status(403).render("error", buildGuestbookAccessDeniedPayload(accessState));
}

function buildGuestbookContextQuery(accessState = {}) {
  if (!accessState?.viaReplyAccess || !accessState.replyContextEntryId || !accessState.replyContextCharacterId) {
    return "";
  }

  return `&reply_from_entry=${accessState.replyContextEntryId}&reply_to_character=${accessState.replyContextCharacterId}`;
}

function normalizeGuestbookEntriesPageNumber(value) {
  const pageNumber = Number(value);
  return Number.isInteger(pageNumber) && pageNumber > 0 ? pageNumber : 1;
}

function buildGuestbookViewUrl(characterId, guestbookPageId, accessState, entriesPageNumber = 1) {
  const normalizedEntriesPageNumber = normalizeGuestbookEntriesPageNumber(entriesPageNumber);
  let url = `/characters/${characterId}/guestbook?page_id=${guestbookPageId}`;

  if (normalizedEntriesPageNumber > 1) {
    url += `&entries_page=${normalizedEntriesPageNumber}`;
  }

  return `${url}${buildGuestbookContextQuery(accessState)}`;
}

function getGuestbookEntriesCountForViewer(character, pageId, viewerUser, accessState) {
  const viewerUserId = Number(viewerUser?.id);
  const viewerIsAdmin = Boolean(accessState?.isAdmin);
  const viewerIsOwner = Boolean(accessState?.isOwner);

  const row = db
    .prepare(
      `SELECT COUNT(*) AS total
       FROM guestbook_entries ge
       WHERE ge.character_id = ?
         AND ge.guestbook_page_id = ?
         AND (
           ge.is_private = 0
           OR ge.author_id = ?
           OR ? = 1
           OR ? = 1
         )`
    )
    .get(character.id, pageId, viewerUserId, viewerIsOwner ? 1 : 0, viewerIsAdmin ? 1 : 0);

  return Number(row?.total || 0);
}

function getGuestbookEntriesForViewer(character, pageId, viewerUser, accessState, entriesPageNumber = 1) {
  const viewerUserId = Number(viewerUser?.id);
  const viewerIsAdmin = Boolean(accessState?.isAdmin);
  const viewerIsOwner = Boolean(accessState?.isOwner);
  const normalizedEntriesPageNumber = normalizeGuestbookEntriesPageNumber(entriesPageNumber);
  const offset = (normalizedEntriesPageNumber - 1) * GUESTBOOK_PAGE_SIZE;

  return db
    .prepare(
      `SELECT ge.id,
              ge.character_id,
              ge.author_id,
              ge.author_character_id,
              ge.author_name,
              ge.content,
              ge.is_private,
              ge.created_at,
              ge.updated_at,
              author_character.name AS author_character_name
       FROM guestbook_entries ge
       LEFT JOIN characters author_character ON author_character.id = ge.author_character_id
       WHERE ge.character_id = ?
         AND ge.guestbook_page_id = ?
         AND (
           ge.is_private = 0
           OR ge.author_id = ?
           OR ? = 1
           OR ? = 1
         )
       ORDER BY ge.created_at DESC, ge.id DESC
       LIMIT ?
       OFFSET ?`
    )
    .all(
      character.id,
      pageId,
      viewerUserId,
      viewerIsOwner ? 1 : 0,
      viewerIsAdmin ? 1 : 0,
      GUESTBOOK_PAGE_SIZE,
      offset
    )
    .map((entry) => {
      const entryAuthorId = Number(entry.author_id);
      const authorCharacterId = Number(entry.author_character_id);
      const isPrivate = Number(entry.is_private) === 1;
      return {
        ...entry,
        is_private: isPrivate,
        content_html: renderGuestbookBbcode(entry.content),
        can_edit: entryAuthorId === viewerUserId || viewerIsAdmin,
        can_delete: entryAuthorId === viewerUserId || viewerIsOwner || viewerIsAdmin,
        author_guestbook_url:
          Number.isInteger(authorCharacterId) && authorCharacterId > 0
            ? `/characters/${authorCharacterId}/guestbook?reply_from_entry=${entry.id}&reply_to_character=${character.id}`
            : "",
        updated_label:
          entry.updated_at && String(entry.updated_at) !== String(entry.created_at)
            ? `bearbeitet ${entry.updated_at}`
            : "",
        private_label:
          isPrivate
            ? (viewerIsOwner ? "Privater Eintrag" : entryAuthorId === viewerUserId ? "Nur für dich und den Besitzer sichtbar" : "Privater Eintrag")
            : ""
      };
    });
}

function createGuestbookNotification(userId, characterId, guestbookEntryId) {
  const parsedUserId = Number(userId);
  const parsedCharacterId = Number(characterId);
  const parsedEntryId = Number(guestbookEntryId);
  if (
    !Number.isInteger(parsedUserId) ||
    parsedUserId < 1 ||
    !Number.isInteger(parsedCharacterId) ||
    parsedCharacterId < 1 ||
    !Number.isInteger(parsedEntryId) ||
    parsedEntryId < 1
  ) {
    return;
  }

  const result = db.prepare(
    `INSERT OR IGNORE INTO guestbook_notifications (user_id, character_id, guestbook_entry_id)
     VALUES (?, ?, ?)`
  ).run(parsedUserId, parsedCharacterId, parsedEntryId);

  if (result.changes > 0) {
    emitGuestbookNotificationUpdateForUser(parsedUserId);
  }
}

function createFestplayApplicationNotification(userId, festplayId, festplayApplicationId, options = {}) {
  const parsedUserId = Number(userId);
  const parsedFestplayId = Number(festplayId);
  const parsedApplicationId = Number(festplayApplicationId);
  const normalizedNotificationKind =
    String(options?.notification_kind || "").trim().toLowerCase() === "approved"
      ? "approved"
      : "application";
  const normalizedActorName = String(options?.actor_name || "").trim().slice(0, 120);
  if (
    !Number.isInteger(parsedUserId) ||
    parsedUserId < 1 ||
    !Number.isInteger(parsedFestplayId) ||
    parsedFestplayId < 1 ||
    !Number.isInteger(parsedApplicationId) ||
    parsedApplicationId < 1
  ) {
    return;
  }

  db.prepare(
    `INSERT INTO festplay_application_notifications (
       user_id,
       festplay_id,
       festplay_application_id,
       notification_kind,
       actor_name,
       is_read,
       created_at
     )
     VALUES (?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
     ON CONFLICT(user_id, festplay_application_id) DO UPDATE SET
       festplay_id = excluded.festplay_id,
       notification_kind = excluded.notification_kind,
       actor_name = excluded.actor_name,
       is_read = 0,
       created_at = CURRENT_TIMESTAMP`
  ).run(
    parsedUserId,
    parsedFestplayId,
    parsedApplicationId,
    normalizedNotificationKind,
    normalizedActorName
  );

  emitGuestbookNotificationUpdateForUser(parsedUserId);
}

function getUnreadFestplayApplicationNotificationCountForUser(userId) {
  const parsedUserId = Number(userId);
  if (!Number.isInteger(parsedUserId) || parsedUserId < 1) {
    return 0;
  }

  return Number(
    db
      .prepare(
        `SELECT COUNT(*) AS count
         FROM festplay_application_notifications
         WHERE user_id = ? AND is_read = 0`
      )
      .get(parsedUserId)?.count || 0
  );
}

function getUnreadSystemNotificationCountForUser(userId) {
  const parsedUserId = Number(userId);
  if (!Number.isInteger(parsedUserId) || parsedUserId < 1) {
    return 0;
  }

  return Number(
    db
      .prepare(
        `SELECT COUNT(*) AS count
         FROM system_notifications
         WHERE user_id = ? AND is_read = 0`
      )
      .get(parsedUserId)?.count || 0
  );
}

function getUnreadGuestbookNotificationCountForUser(userId) {
  const parsedUserId = Number(userId);
  if (!Number.isInteger(parsedUserId) || parsedUserId < 1) {
    return 0;
  }

  const guestbookCount = Number(
    db
      .prepare(
        `SELECT COUNT(*) AS count
         FROM guestbook_notifications
         WHERE user_id = ? AND is_read = 0`
      )
      .get(parsedUserId)?.count || 0
  );

  return (
    guestbookCount +
    getUnreadFestplayApplicationNotificationCountForUser(parsedUserId) +
    getUnreadSystemNotificationCountForUser(parsedUserId)
  );
}

function getLatestFestplayApplicationNotificationForUser(userId, unreadOnly = true) {
  const parsedUserId = Number(userId);
  if (!Number.isInteger(parsedUserId) || parsedUserId < 1) {
    return null;
  }

  return db
    .prepare(
      `SELECT fan.id,
              CASE
                WHEN COALESCE(fan.notification_kind, 'application') = 'approved'
                  THEN 'festplay_approval'
                ELSE 'festplay_application'
              END AS notification_type,
              fan.user_id,
              fan.festplay_id,
              fan.festplay_application_id,
              fan.actor_name,
              fan.is_read,
              fan.created_at,
              fa.applicant_character_id,
              applicant.name AS applicant_character_name,
              f.name AS festplay_name,
              f.creator_character_id,
              f.server_id AS festplay_server_id
       FROM festplay_application_notifications fan
       JOIN festplay_applications fa ON fa.id = fan.festplay_application_id
       JOIN festplays f ON f.id = fan.festplay_id
       JOIN characters applicant ON applicant.id = fa.applicant_character_id
       WHERE fan.user_id = ?
         ${unreadOnly ? "AND fan.is_read = 0" : ""}
       ORDER BY fan.created_at DESC, fan.id DESC
       LIMIT 1`
    )
    .get(parsedUserId);
}

function getFestplayApprovalNotificationsForUser(userId, unreadOnly = false, limit = 25) {
  const parsedUserId = Number(userId);
  const parsedLimit = Math.max(1, Math.min(100, Number(limit) || 25));
  if (!Number.isInteger(parsedUserId) || parsedUserId < 1) {
    return [];
  }

  return db
    .prepare(
      `SELECT fan.id,
              'festplay_approval' AS notification_type,
              fan.user_id,
              fan.festplay_id,
              fan.festplay_application_id,
              fan.actor_name,
              fan.is_read,
              fan.created_at,
              fa.applicant_character_id,
              applicant.name AS applicant_character_name,
              f.name AS festplay_name,
              f.creator_character_id,
              f.server_id AS festplay_server_id
       FROM festplay_application_notifications fan
       JOIN festplay_applications fa ON fa.id = fan.festplay_application_id
       JOIN festplays f ON f.id = fan.festplay_id
       JOIN characters applicant ON applicant.id = fa.applicant_character_id
       WHERE fan.user_id = ?
         AND COALESCE(fan.notification_kind, 'application') = 'approved'
         ${unreadOnly ? "AND fan.is_read = 0" : ""}
       ORDER BY fan.created_at DESC, fan.id DESC
       LIMIT ?`
    )
    .all(parsedUserId, parsedLimit);
}

function getLatestSystemNotificationForUser(userId, unreadOnly = true) {
  const parsedUserId = Number(userId);
  if (!Number.isInteger(parsedUserId) || parsedUserId < 1) {
    return null;
  }

  return db
    .prepare(
      `SELECT sn.id,
              sn.user_id,
              sn.notification_type,
              sn.notification_key,
              sn.title,
              sn.message,
              sn.is_read,
              sn.created_at
       FROM system_notifications sn
       WHERE sn.user_id = ?
         AND trim(COALESCE(sn.message, '')) != ''
         ${unreadOnly ? "AND sn.is_read = 0" : ""}
       ORDER BY sn.created_at DESC, sn.id DESC
       LIMIT 1`
    )
    .get(parsedUserId);
}

function getSystemNotificationsForUser(userId, unreadOnly = false, limit = 25) {
  const parsedUserId = Number(userId);
  const parsedLimit = Math.max(1, Math.min(100, Number(limit) || 25));
  if (!Number.isInteger(parsedUserId) || parsedUserId < 1) {
    return [];
  }

  return db
    .prepare(
      `SELECT sn.id,
              sn.user_id,
              sn.notification_type,
              sn.notification_key,
              sn.title,
              sn.message,
              sn.is_read,
              sn.created_at
       FROM system_notifications sn
       WHERE sn.user_id = ?
         AND trim(COALESCE(sn.message, '')) != ''
         ${unreadOnly ? "AND sn.is_read = 0" : ""}
       ORDER BY sn.created_at DESC, sn.id DESC
       LIMIT ?`
    )
    .all(parsedUserId, parsedLimit);
}

function compareNotificationRecency(left, right) {
  const leftCreatedAt = String(left?.created_at || "");
  const rightCreatedAt = String(right?.created_at || "");
  if (leftCreatedAt !== rightCreatedAt) {
    return rightCreatedAt.localeCompare(leftCreatedAt);
  }

  return Number(right?.id || 0) - Number(left?.id || 0);
}

function pickLatestNotification(notifications = []) {
  const entries = Array.isArray(notifications) ? notifications.filter(Boolean) : [];
  if (!entries.length) {
    return null;
  }

  return entries.sort(compareNotificationRecency)[0];
}

function getSystemInboxNotificationsForUser(userId, options = {}) {
  const parsedUserId = Number(userId);
  const unreadOnly = options?.unreadOnly === true;
  const parsedLimit = Math.max(1, Math.min(100, Number(options?.limit) || 25));
  if (!Number.isInteger(parsedUserId) || parsedUserId < 1) {
    return [];
  }

  return [
    ...getSystemNotificationsForUser(parsedUserId, unreadOnly, parsedLimit),
    ...getFestplayApprovalNotificationsForUser(parsedUserId, unreadOnly, parsedLimit)
  ]
    .sort(compareNotificationRecency)
    .slice(0, parsedLimit);
}

function getLatestSystemInboxNotificationForUser(userId, unreadOnly = false) {
  return getSystemInboxNotificationsForUser(userId, { unreadOnly, limit: 1 })[0] || null;
}

function getLatestGuestbookNotificationForUser(userId, unreadOnly = true) {
  const parsedUserId = Number(userId);
  if (!Number.isInteger(parsedUserId) || parsedUserId < 1) {
    return null;
  }

  const guestbookNotification = db
    .prepare(
      `SELECT gn.id,
              'guestbook_entry' AS notification_type,
              gn.user_id,
              gn.character_id,
              gn.guestbook_entry_id,
              gn.is_read,
              gn.created_at,
              ge.guestbook_page_id,
              ge.author_name,
              c.name AS character_name
       FROM guestbook_notifications gn
       JOIN guestbook_entries ge ON ge.id = gn.guestbook_entry_id
       JOIN characters c ON c.id = gn.character_id
       WHERE gn.user_id = ?
         ${unreadOnly ? "AND gn.is_read = 0" : ""}
       ORDER BY gn.created_at DESC, gn.id DESC
      LIMIT 1`
    )
    .get(parsedUserId);
  const festplayNotification = getLatestFestplayApplicationNotificationForUser(parsedUserId, unreadOnly);
  const systemNotification = getLatestSystemNotificationForUser(parsedUserId, unreadOnly);

  return pickLatestNotification([
    guestbookNotification,
    festplayNotification,
    systemNotification
  ]);
}

function getLatestVisibleGuestbookNotificationForUser(userId) {
  const parsedUserId = Number(userId);
  if (!Number.isInteger(parsedUserId) || parsedUserId < 1) {
    return null;
  }

  return getUnreadGuestbookNotificationCountForUser(parsedUserId) > 0
    ? getLatestGuestbookNotificationForUser(parsedUserId, true)
    : getLatestSystemInboxNotificationForUser(parsedUserId, false);
}

function socketChannelForGuestbookNotifications(userId) {
  const parsedUserId = Number(userId);
  return Number.isInteger(parsedUserId) && parsedUserId > 0
    ? `guestbook-notifications:${parsedUserId}`
    : "guestbook-notifications:unknown";
}

function socketChannelForSocialUpdates(userId) {
  const parsedUserId = Number(userId);
  return Number.isInteger(parsedUserId) && parsedUserId > 0
    ? `social:${parsedUserId}`
    : "social:unknown";
}

function buildNotificationPayloadEntryForUser(notification, userId, options = {}) {
  if (!notification || typeof notification !== "object") {
    return null;
  }

  const normalizedType = String(notification.notification_type || "").trim();
  if (normalizedType === "festplay_application" || normalizedType === "festplay_approval") {
    return {
      id: Number(notification.id),
      type: normalizedType,
      festplay_id: Number(notification.festplay_id),
      festplay_application_id: Number(notification.festplay_application_id),
      festplay_name: String(notification.festplay_name || "").trim(),
      applicant_character_name: String(notification.applicant_character_name || "").trim(),
      actor_name: String(notification.actor_name || "").trim(),
      festplay_server_id: normalizeServer(notification.festplay_server_id),
      is_read: Number(notification.is_read) === 1,
      created_at: String(notification.created_at || "").trim()
    };
  }

  if (normalizedType === BIRTHDAY_NOTIFICATION_TYPE) {
    return {
      ...buildBirthdayGreetingNotificationPayloadForUser(
        Number(userId),
        notification.id,
        {
          ...options,
          notificationTitle: notification.title,
          notificationMessage: notification.message
        }
      ),
      is_read: Number(notification.is_read) === 1,
      created_at: String(notification.created_at || "").trim()
    };
  }

  if (normalizedType === "guestbook_entry") {
    return {
      id: Number(notification.id),
      type: "guestbook_entry",
      character_id: Number(notification.character_id),
      guestbook_entry_id: Number(notification.guestbook_entry_id),
      guestbook_page_id: Number(notification.guestbook_page_id),
      author_name: String(notification.author_name || "").trim(),
      character_name: String(notification.character_name || "").trim(),
      is_read: Number(notification.is_read) === 1,
      created_at: String(notification.created_at || "").trim()
    };
  }

  return null;
}

function escapeSvgText(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildHumanVerificationSvg(text) {
  const safeText = escapeSvgText(text);
  const chars = safeText.split("");
  const lines = Array.from({ length: 5 }, (_entry, index) => {
    const y = 14 + index * 8;
    const x1 = 8 + ((index * 19) % 40);
    const x2 = 180 - ((index * 17) % 44);
    return `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y + 8}" stroke="rgba(120,70,28,0.28)" stroke-width="1.2" />`;
  }).join("");
  const glyphs = chars
    .map((char, index) => {
      const x = 20 + index * 28;
      const y = 37 + ((index % 2) * 4 - 2);
      const rotation = (index % 2 === 0 ? -8 : 7) + index;
      return `<text x="${x}" y="${y}" font-size="28" font-family="Georgia, 'Times New Roman', serif" font-weight="700" fill="#44250f" transform="rotate(${rotation} ${x} ${y})">${char}</text>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="180" height="56" viewBox="0 0 180 56" role="img" aria-label="Sicherheitscode">
  <rect width="180" height="56" rx="10" fill="#f2dfba" />
  <rect x="1" y="1" width="178" height="54" rx="9" fill="none" stroke="#b98b4d" stroke-width="2" />
  ${lines}
  ${glyphs}
</svg>`;
}

function validateFallbackHumanVerification(req, context, submittedAnswer) {
  const normalizedContext = String(context || "").trim().toLowerCase() || "default";
  const store = getHumanVerificationStore(req);
  const challenge = getHumanVerificationChallenge(req, normalizedContext);
  delete store[normalizedContext];

  if (!challenge) {
    return { ok: false, reason: "captcha-missing" };
  }

  const ageMs = Date.now() - Number(challenge.issuedAt || 0);
  if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > HUMAN_VERIFICATION_MAX_AGE_MS) {
    return { ok: false, reason: "captcha-failed" };
  }

  const expectedAnswer = String(challenge.answer || "").trim().toUpperCase();
  const receivedAnswer = String(submittedAnswer || "").trim().toUpperCase();
  if (!expectedAnswer || !receivedAnswer || expectedAnswer !== receivedAnswer) {
    return { ok: false, reason: "captcha-failed" };
  }

  return { ok: true };
}

async function validateTurnstileCaptcha(req, expectedAction = REGISTRATION_CAPTCHA_ACTION) {
  if (!REGISTRATION_CAPTCHA_ENABLED) {
    return { ok: false, reason: "captcha-not-configured" };
  }

  const token = String(req.body["cf-turnstile-response"] || "").trim();
  if (!token) {
    return { ok: false, reason: "captcha-missing" };
  }

  const remoteIp = getRequestIp(req);
  const formData = new URLSearchParams();
  formData.set("secret", TURNSTILE_SECRET_KEY);
  formData.set("response", token);
  if (remoteIp) {
    formData.set("remoteip", remoteIp);
  }
  if (typeof crypto.randomUUID === "function") {
    formData.set("idempotency_key", crypto.randomUUID());
  }

  const abortController = new AbortController();
  const timeoutHandle = setTimeout(() => abortController.abort(), REGISTRATION_CAPTCHA_TIMEOUT_MS);

  let verificationPayload = null;
  try {
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: formData.toString(),
      signal: abortController.signal
    });

    verificationPayload = await response.json().catch(() => null);
    if (!response.ok || !verificationPayload) {
      return { ok: false, reason: "captcha-service-unavailable" };
    }
  } catch (error) {
    console.error("CAPTCHA-Prüfung fehlgeschlagen:", error);
    return { ok: false, reason: "captcha-service-unavailable" };
  } finally {
    clearTimeout(timeoutHandle);
  }

  if (verificationPayload.success !== true) {
    return {
      ok: false,
      reason: "captcha-failed",
      errorCodes: Array.isArray(verificationPayload["error-codes"])
        ? verificationPayload["error-codes"]
        : []
    };
  }

  const returnedAction = String(verificationPayload.action || "").trim();
  if (returnedAction && returnedAction !== String(expectedAction || "").trim()) {
    return { ok: false, reason: "captcha-action-mismatch" };
  }

  const returnedHostname = String(verificationPayload.hostname || "").trim().toLowerCase();
  const expectedHostnames = getExpectedRegistrationCaptchaHostnames(req);
  if (returnedHostname && expectedHostnames.length && !expectedHostnames.includes(returnedHostname)) {
    return { ok: false, reason: "captcha-hostname-mismatch" };
  }

  return { ok: true };
}

async function validateHumanVerification(req, options = {}) {
  const context = String(options.context || "").trim().toLowerCase() || "register";
  const submittedAnswer = String(options.submittedAnswer || "").trim();
  const expectedAction = String(options.expectedAction || REGISTRATION_CAPTCHA_ACTION).trim();

  if (getHumanVerificationMode() === "turnstile") {
    return validateTurnstileCaptcha(req, expectedAction);
  }

  return validateFallbackHumanVerification(req, context, submittedAnswer);
}

function renderRegistrationSecurityFailure(req, res, { reason, values, username, email, ip }) {
  const failure = getRegistrationSecurityFailureResponse(reason);
  logRegistrationGuardEvent({
    ip,
    username,
    email,
    outcome: "blocked",
    reason
  });
  return renderRegisterPage(req, res, {
    status: failure.status,
    error: failure.error,
    values
  });
}

function renderOAuthVerificationFailure(req, res, provider, reason, { username = "", email = "" } = {}) {
  const ip = getRequestIp(req);
  const failure = getRegistrationSecurityFailureResponse(reason);
  logRegistrationGuardEvent({
    ip,
    username,
    email,
    outcome: "blocked",
    reason: `oauth-${String(reason || "").trim()}`
  });
  return renderOAuthVerificationPage(req, res, provider, {
    status: failure.status,
    error: failure.error
  });
}

function buildGuestbookNotificationPayloadForUser(userId, options = {}) {
  const parsedUserId = Number(userId);
  if (!Number.isInteger(parsedUserId) || parsedUserId < 1) {
    return {
      count: 0,
      latest: null
    };
  }

  const count = getUnreadGuestbookNotificationCountForUser(parsedUserId);
  const latestNotification = count > 0
    ? getLatestGuestbookNotificationForUser(parsedUserId, true)
    : getLatestSystemInboxNotificationForUser(parsedUserId, false);

  return {
    count,
    latest: buildNotificationPayloadEntryForUser(latestNotification, parsedUserId, options)
  };
}

function buildSystemInboxListForUser(userId, options = {}) {
  const parsedUserId = Number(userId);
  if (!Number.isInteger(parsedUserId) || parsedUserId < 1) {
    return [];
  }

  return getSystemInboxNotificationsForUser(parsedUserId, {
    unreadOnly: false,
    limit: options?.limit || 30
  })
    .map((notification) => buildNotificationPayloadEntryForUser(notification, parsedUserId, options))
    .filter(Boolean);
}

function emitGuestbookNotificationUpdateForUser(userId) {
  const parsedUserId = Number(userId);
  if (!Number.isInteger(parsedUserId) || parsedUserId < 1) {
    return;
  }

  io.to(socketChannelForGuestbookNotifications(parsedUserId)).emit(
    "guestbook:notification:update",
    buildGuestbookNotificationPayloadForUser(parsedUserId)
  );
}

function markGuestbookNotificationAsRead(notificationId, userId) {
  const parsedNotificationId = Number(notificationId);
  const parsedUserId = Number(userId);
  if (
    !Number.isInteger(parsedNotificationId) ||
    parsedNotificationId < 1 ||
    !Number.isInteger(parsedUserId) ||
    parsedUserId < 1
  ) {
    return;
  }

  const result = db.prepare(
    `UPDATE guestbook_notifications
     SET is_read = 1
     WHERE id = ? AND user_id = ?`
  ).run(parsedNotificationId, parsedUserId);

  if (result.changes > 0) {
    emitGuestbookNotificationUpdateForUser(parsedUserId);
  }
}

function markAllSystemInboxNotificationsAsReadForUser(userId) {
  const parsedUserId = Number(userId);
  if (!Number.isInteger(parsedUserId) || parsedUserId < 1) {
    return false;
  }

  const systemResult = db.prepare(
    `UPDATE system_notifications
     SET is_read = 1
     WHERE user_id = ? AND is_read = 0`
  ).run(parsedUserId);
  const approvalResult = db.prepare(
    `UPDATE festplay_application_notifications
     SET is_read = 1
     WHERE user_id = ?
       AND COALESCE(notification_kind, 'application') = 'approved'
       AND is_read = 0`
  ).run(parsedUserId);

  const hasChanges = Number(systemResult.changes || 0) > 0 || Number(approvalResult.changes || 0) > 0;
  if (hasChanges) {
    emitGuestbookNotificationUpdateForUser(parsedUserId);
  }

  return hasChanges;
}

function markSystemNotificationAsRead(notificationId, userId) {
  const parsedNotificationId = Number(notificationId);
  const parsedUserId = Number(userId);
  if (
    !Number.isInteger(parsedNotificationId) ||
    parsedNotificationId < 1 ||
    !Number.isInteger(parsedUserId) ||
    parsedUserId < 1
  ) {
    return;
  }

  const result = db.prepare(
    `UPDATE system_notifications
     SET is_read = 1
     WHERE id = ? AND user_id = ?`
  ).run(parsedNotificationId, parsedUserId);

  if (result.changes > 0) {
    emitGuestbookNotificationUpdateForUser(parsedUserId);
  }
}

function deleteSystemInboxNotification(notificationId, userId, notificationType) {
  const parsedNotificationId = Number(notificationId);
  const parsedUserId = Number(userId);
  const normalizedType = String(notificationType || "").trim().toLowerCase();
  if (
    !Number.isInteger(parsedNotificationId) ||
    parsedNotificationId < 1 ||
    !Number.isInteger(parsedUserId) ||
    parsedUserId < 1
  ) {
    return false;
  }

  let result = { changes: 0 };
  if (normalizedType === BIRTHDAY_NOTIFICATION_TYPE) {
    result = db.prepare(
      `UPDATE system_notifications
       SET is_read = 1,
           title = '',
           message = ''
       WHERE id = ?
         AND user_id = ?
         AND notification_type = ?`
    ).run(parsedNotificationId, parsedUserId, BIRTHDAY_NOTIFICATION_TYPE);
  } else if (normalizedType === "festplay_approval") {
    result = db.prepare(
      `DELETE FROM festplay_application_notifications
       WHERE id = ?
         AND user_id = ?
         AND COALESCE(notification_kind, 'application') = 'approved'`
    ).run(parsedNotificationId, parsedUserId);
  }

  if (Number(result.changes || 0) > 0) {
    emitGuestbookNotificationUpdateForUser(parsedUserId);
    return true;
  }

  return false;
}

function markFestplayApplicationNotificationAsRead(notificationId, userId) {
  const parsedNotificationId = Number(notificationId);
  const parsedUserId = Number(userId);
  if (
    !Number.isInteger(parsedNotificationId) ||
    parsedNotificationId < 1 ||
    !Number.isInteger(parsedUserId) ||
    parsedUserId < 1
  ) {
    return;
  }

  const result = db.prepare(
    `UPDATE festplay_application_notifications
     SET is_read = 1
     WHERE id = ? AND user_id = ?`
  ).run(parsedNotificationId, parsedUserId);

  if (result.changes > 0) {
    emitGuestbookNotificationUpdateForUser(parsedUserId);
  }
}

function normalizeRpBoardFestplayId(value) {
  const parsedFestplayId = Number(value);
  return Number.isInteger(parsedFestplayId) && parsedFestplayId > 0 ? parsedFestplayId : 0;
}

function normalizeRpBoardContent(value) {
  return String(value || "")
    .replace(/\r\n?/g, "\n")
    .trim()
    .slice(0, 500);
}

function socketChannelForRpBoard(serverId = DEFAULT_SERVER_ID, festplayId = 0) {
  const normalizedServerId = normalizeServer(serverId);
  const normalizedFestplayId = normalizeRpBoardFestplayId(festplayId);
  return `rp-board:${normalizedServerId}:${normalizedFestplayId}`;
}

function getRpBoardCharacterForUser(userId, characterId) {
  const parsedUserId = Number(userId);
  const parsedCharacterId = Number(characterId);
  if (
    !Number.isInteger(parsedUserId) ||
    parsedUserId < 1 ||
    !Number.isInteger(parsedCharacterId) ||
    parsedCharacterId < 1
  ) {
    return null;
  }

  return db
    .prepare(
      `SELECT c.id,
              c.user_id,
              c.name,
              c.server_id,
              COALESCE(c.festplay_id, 0) AS festplay_id,
              COALESCE(gs.chat_text_color, '#AEE7B7') AS chat_text_color
       FROM characters c
       LEFT JOIN guestbook_settings gs ON gs.character_id = c.id
       WHERE c.id = ? AND c.user_id = ?
       LIMIT 1`
    )
    .get(parsedCharacterId, parsedUserId);
}

function resolveRpBoardContextForUser(userId, serverId, festplayId, characterId) {
  const character = getRpBoardCharacterForUser(userId, characterId);
  if (!character) {
    return null;
  }

  const normalizedServerId = normalizeServer(serverId || character.server_id);
  const normalizedFestplayId = normalizeRpBoardFestplayId(festplayId);
  const characterServerId = normalizeServer(character.server_id);

  if (normalizedFestplayId > 0) {
    if (
      Number(character.festplay_id) !== normalizedFestplayId &&
      !characterHasFestplayAccess(normalizedFestplayId, character.id)
    ) {
      return null;
    }
  } else if (characterServerId !== normalizedServerId) {
    return null;
  }

  return {
    serverId: normalizedServerId,
    festplayId: normalizedFestplayId,
    character: {
      ...character,
      server_id: characterServerId,
      festplay_id: Number(character.festplay_id) || 0,
      chat_text_color: normalizeGuestbookColor(character.chat_text_color)
    }
  };
}

function getLatestRpBoardEntryId(serverId = DEFAULT_SERVER_ID, festplayId = 0) {
  const normalizedServerId = normalizeServer(serverId);
  const normalizedFestplayId = normalizeRpBoardFestplayId(festplayId);
  const row = db
    .prepare(
      `SELECT MAX(id) AS latest_id
       FROM rp_board_entries
       WHERE server_id = ? AND festplay_id = ?`
    )
    .get(normalizedServerId, normalizedFestplayId);
  return Number(row?.latest_id || 0);
}

function setRpBoardReadMarker(userId, serverId = DEFAULT_SERVER_ID, festplayId = 0, entryId = 0) {
  const parsedUserId = Number(userId);
  const normalizedServerId = normalizeServer(serverId);
  const normalizedFestplayId = normalizeRpBoardFestplayId(festplayId);
  const parsedEntryId = Number(entryId);
  if (
    !Number.isInteger(parsedUserId) ||
    parsedUserId < 1 ||
    !Number.isInteger(parsedEntryId) ||
    parsedEntryId < 0
  ) {
    return;
  }

  db.prepare(
    `INSERT INTO rp_board_reads (
       user_id,
       server_id,
       festplay_id,
       last_seen_entry_id,
       updated_at
     )
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id, server_id, festplay_id) DO UPDATE SET
       last_seen_entry_id = CASE
         WHEN excluded.last_seen_entry_id > rp_board_reads.last_seen_entry_id
           THEN excluded.last_seen_entry_id
         ELSE rp_board_reads.last_seen_entry_id
       END,
       updated_at = excluded.updated_at`
  ).run(parsedUserId, normalizedServerId, normalizedFestplayId, parsedEntryId, formatChatTimestamp());
}

function getRpBoardReadMarker(userId, serverId = DEFAULT_SERVER_ID, festplayId = 0) {
  const parsedUserId = Number(userId);
  if (!Number.isInteger(parsedUserId) || parsedUserId < 1) {
    return 0;
  }

  const row = db
    .prepare(
      `SELECT last_seen_entry_id
       FROM rp_board_reads
       WHERE user_id = ? AND server_id = ? AND festplay_id = ?
       LIMIT 1`
    )
    .get(parsedUserId, normalizeServer(serverId), normalizeRpBoardFestplayId(festplayId));
  return Number(row?.last_seen_entry_id || 0);
}

function getRpBoardEntries(serverId = DEFAULT_SERVER_ID, festplayId = 0, currentUserId = 0) {
  const normalizedServerId = normalizeServer(serverId);
  const normalizedFestplayId = normalizeRpBoardFestplayId(festplayId);
  const parsedCurrentUserId = Number(currentUserId);

  return db
    .prepare(
      `SELECT id,
              user_id,
              character_id,
              author_name,
              author_chat_text_color,
              content,
              created_at
       FROM rp_board_entries
       WHERE server_id = ? AND festplay_id = ?
       ORDER BY id DESC
       LIMIT 40`
    )
    .all(normalizedServerId, normalizedFestplayId)
    .map((entry) => ({
      id: Number(entry.id),
      character_id: Number(entry.character_id),
      author_name: String(entry.author_name || "").trim(),
      author_chat_text_color: normalizeGuestbookColor(entry.author_chat_text_color),
      content: String(entry.content || ""),
      created_at: String(entry.created_at || "").trim(),
      can_delete: parsedCurrentUserId > 0 && Number(entry.user_id) === parsedCurrentUserId
    }));
}

function getRpBoardUnreadCountForUser(userId, serverId = DEFAULT_SERVER_ID, festplayId = 0) {
  const parsedUserId = Number(userId);
  if (!Number.isInteger(parsedUserId) || parsedUserId < 1) {
    return 0;
  }

  const normalizedServerId = normalizeServer(serverId);
  const normalizedFestplayId = normalizeRpBoardFestplayId(festplayId);
  const readMarker = getRpBoardReadMarker(parsedUserId, normalizedServerId, normalizedFestplayId);
  return Number(
    db
      .prepare(
        `SELECT COUNT(*) AS count
         FROM rp_board_entries
         WHERE server_id = ? AND festplay_id = ? AND id > ?`
      )
      .get(normalizedServerId, normalizedFestplayId, readMarker)?.count || 0
  );
}

function buildRpBoardStateForUser(userId, serverId = DEFAULT_SERVER_ID, festplayId = 0) {
  const normalizedServerId = normalizeServer(serverId);
  const normalizedFestplayId = normalizeRpBoardFestplayId(festplayId);

  return {
    unreadCount: getRpBoardUnreadCountForUser(userId, normalizedServerId, normalizedFestplayId),
    entries: getRpBoardEntries(normalizedServerId, normalizedFestplayId, userId)
  };
}

function emitRpBoardChanged(serverId = DEFAULT_SERVER_ID, festplayId = 0) {
  const normalizedServerId = normalizeServer(serverId);
  const normalizedFestplayId = normalizeRpBoardFestplayId(festplayId);
  io.to(socketChannelForRpBoard(normalizedServerId, normalizedFestplayId)).emit("rp-board:changed", {
    serverId: normalizedServerId,
    festplayId: normalizedFestplayId
  });
}

function getGuestbookEntryById(entryId) {
  const parsedEntryId = Number(entryId);
  if (!Number.isInteger(parsedEntryId) || parsedEntryId < 1) {
    return null;
  }

  return db
    .prepare(
      `SELECT ge.id,
              ge.character_id,
              ge.guestbook_page_id,
              ge.author_id,
              ge.author_character_id,
              ge.author_name,
              ge.content,
              ge.is_private,
              ge.created_at,
              ge.updated_at
       FROM guestbook_entries ge
       WHERE ge.id = ?`
    )
    .get(parsedEntryId);
}

function deleteGuestbookNotificationsForEntry(entryId) {
  const parsedEntryId = Number(entryId);
  if (!Number.isInteger(parsedEntryId) || parsedEntryId < 1) {
    return;
  }

  db.prepare("DELETE FROM guestbook_notifications WHERE guestbook_entry_id = ?").run(parsedEntryId);
}

function deleteFestplayApplicationNotificationsForApplication(festplayApplicationId) {
  const parsedApplicationId = Number(festplayApplicationId);
  if (!Number.isInteger(parsedApplicationId) || parsedApplicationId < 1) {
    return;
  }

  const userIds = db
    .prepare(
      `SELECT DISTINCT user_id
         FROM festplay_application_notifications
        WHERE festplay_application_id = ?`
    )
    .all(parsedApplicationId)
    .map((row) => Number(row.user_id))
    .filter((userId) => Number.isInteger(userId) && userId > 0);

  db.prepare(
    `DELETE FROM festplay_application_notifications
     WHERE festplay_application_id = ?`
  ).run(parsedApplicationId);

  userIds.forEach((userId) => {
    emitGuestbookNotificationUpdateForUser(userId);
  });
}

function deleteGuestbookNotificationsForCharacterPage(characterId, pageId) {
  const parsedCharacterId = Number(characterId);
  const parsedPageId = Number(pageId);
  if (
    !Number.isInteger(parsedCharacterId) ||
    parsedCharacterId < 1 ||
    !Number.isInteger(parsedPageId) ||
    parsedPageId < 1
  ) {
    return;
  }

  db.prepare(
    `DELETE FROM guestbook_notifications
     WHERE guestbook_entry_id IN (
       SELECT id
       FROM guestbook_entries
       WHERE character_id = ? AND guestbook_page_id = ?
     )`
  ).run(parsedCharacterId, parsedPageId);
}

function deleteGuestbookNotificationsForCharacter(characterId) {
  const parsedCharacterId = Number(characterId);
  if (!Number.isInteger(parsedCharacterId) || parsedCharacterId < 1) {
    return;
  }

  db.prepare(
    `DELETE FROM guestbook_notifications
     WHERE guestbook_entry_id IN (
       SELECT id
       FROM guestbook_entries
       WHERE character_id = ?
     )`
  ).run(parsedCharacterId);
}

function getRoomWithCharacter(roomId) {
  if (!Number.isInteger(roomId) || roomId < 1) return null;
  return db
    .prepare(
        `SELECT r.id, r.name, r.description, r.teaser, r.character_id, r.created_by_user_id, r.created_at, r.image_url, r.email_log_enabled, r.is_locked, r.is_public_room, r.is_saved_room, r.server_id,
                COALESCE(r.is_festplay_chat, 0) AS is_festplay_chat,
                COALESCE(r.is_manual_festplay_room, 0) AS is_manual_festplay_room,
                r.festplay_id,
                c.user_id AS character_owner_id, c.is_public AS character_is_public, c.name AS character_name, c.server_id AS character_server_id,
                 u.username AS room_owner_name
         FROM chat_rooms r
       JOIN characters c ON c.id = r.character_id
       JOIN users u ON u.id = r.created_by_user_id
       WHERE r.id = ?`
    )
    .get(roomId);
}

function resolveCuratedPublicRoomAnchor(serverId) {
  const normalizedServerId = normalizeServer(serverId);
  const anchor = db
    .prepare(
      `SELECT c.id AS character_id, c.user_id AS user_id, COALESCE(u.is_admin, 0) AS is_admin
         FROM characters c
         JOIN users u ON u.id = c.user_id
        WHERE c.server_id = ?
        ORDER BY CASE
          WHEN u.is_admin = 1 THEN 0
          WHEN u.is_moderator = 1 THEN 1
          ELSE 2
        END,
        CASE
          WHEN COALESCE(c.festplay_id, 0) = 0 THEN 0
          ELSE 1
        END,
        c.id ASC
        LIMIT 1`
    )
    .get(normalizedServerId);

  return {
    characterId: Number(anchor?.character_id) || null,
    userId: Number(anchor?.user_id) || null,
    isAdmin: Number(anchor?.is_admin) === 1
  };
}

function ensureCuratedPublicRooms() {
  const findExistingRoom = db.prepare(
    `SELECT id, description, teaser
       FROM chat_rooms
      WHERE server_id = ?
        AND (
          name_key = ?
          OR (LOWER(name) = LOWER(?) AND created_by_user_id = ?)
        )
        AND COALESCE(festplay_id, 0) = 0
        AND COALESCE(is_festplay_chat, 0) = 0
        AND COALESCE(is_manual_festplay_room, 0) = 0
        AND COALESCE(is_festplay_side_chat, 0) = 0
      ORDER BY CASE
        WHEN name_key = ? THEN 0
        ELSE 1
      END,
      id ASC
      LIMIT 1`
  );
  const updateRoom = db.prepare(
    `UPDATE chat_rooms
        SET character_id = ?,
            created_by_user_id = ?,
            name = ?,
            name_key = ?,
            description = ?,
            teaser = ?,
            is_public_room = 1,
            is_saved_room = ?,
            is_locked = 0,
            sort_order = ?
      WHERE id = ?`
  );
  const insertRoom = db.prepare(
    `INSERT INTO chat_rooms (
       character_id,
       created_by_user_id,
       name,
       name_key,
       description,
       teaser,
       server_id,
       is_public_room,
       is_saved_room,
       is_locked,
       sort_order
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, 0, ?)`
  );

  Object.entries(CURATED_PUBLIC_ROOM_DEFINITIONS).forEach(([serverId, definitions]) => {
    if (!Array.isArray(definitions) || !definitions.length) {
      return;
    }

    const anchor = resolveCuratedPublicRoomAnchor(serverId);
    if (!Number.isInteger(anchor.characterId) || anchor.characterId < 1 || !Number.isInteger(anchor.userId) || anchor.userId < 1) {
      return;
    }
    const savedState = anchor.isAdmin ? 1 : 0;

    definitions.forEach((definition, index) => {
      const normalizedName = normalizeRoomName(definition.name);
      const nameKey = normalizeRoomNameKey(definition.key || normalizedName);
      const normalizedDescription = normalizeRoomDescription(definition.description || "");
      const normalizedTeaser = normalizeRoomTeaser(definition.teaser || "");
      if (!normalizedName || !nameKey) {
        return;
      }

      const existingRoom = findExistingRoom.get(
        normalizeServer(serverId),
        nameKey,
        normalizedName,
        anchor.userId,
        nameKey
      );
      const override = getCuratedRoomOverride(serverId, nameKey);
      const persistedDescription = override
        ? normalizeRoomDescription(override.description)
        : normalizeRoomDescription(existingRoom?.description || "") || normalizedDescription;
      const persistedTeaser = override
        ? normalizeRoomTeaser(override.teaser)
        : normalizeRoomTeaser(existingRoom?.teaser || "") || normalizedTeaser;
      const sortOrder = Number.isInteger(Number(definition.sort_order)) ? Number(definition.sort_order) : index + 1;

      if (existingRoom?.id) {
        updateRoom.run(
          anchor.characterId,
          anchor.userId,
          normalizedName,
          nameKey,
          persistedDescription,
          persistedTeaser,
          savedState,
          sortOrder,
          existingRoom.id
        );
        return;
      }

      insertRoom.run(
        anchor.characterId,
        anchor.userId,
        normalizedName,
        nameKey,
        persistedDescription,
        persistedTeaser,
        normalizeServer(serverId),
        savedState,
        sortOrder
      );
    });
  });
}

ensureCuratedPublicRooms();

function isRoomOwner(user, room = null) {
  if (!user || !room) return false;
  return Number(room.created_by_user_id) === Number(user.id);
}

function hasPersistentRoomRights(userOrId, roomOrId) {
  const parsedUserId =
    Number.isInteger(Number(userOrId?.id)) ? Number(userOrId.id) : Number(userOrId);
  const parsedRoomId =
    Number.isInteger(Number(roomOrId?.id)) ? Number(roomOrId.id) : Number(roomOrId);
  if (
    !Number.isInteger(parsedUserId) ||
    parsedUserId < 1 ||
    !Number.isInteger(parsedRoomId) ||
    parsedRoomId < 1
  ) {
    return false;
  }

  return Boolean(
    db
      .prepare(
        `SELECT 1
         FROM chat_room_permissions
         WHERE room_id = ? AND user_id = ?
         LIMIT 1`
      )
      .get(parsedRoomId, parsedUserId)
  );
}

function grantPersistentRoomRights(roomId, userId, grantedByUserId) {
  const parsedRoomId = Number(roomId);
  const parsedUserId = Number(userId);
  const parsedGrantedByUserId = Number(grantedByUserId);
  if (
    !Number.isInteger(parsedRoomId) ||
    parsedRoomId < 1 ||
    !Number.isInteger(parsedUserId) ||
    parsedUserId < 1 ||
    !Number.isInteger(parsedGrantedByUserId) ||
    parsedGrantedByUserId < 1
  ) {
    return false;
  }

  const result = db
    .prepare(
      `INSERT OR IGNORE INTO chat_room_permissions (room_id, user_id, granted_by_user_id)
       VALUES (?, ?, ?)`
    )
    .run(parsedRoomId, parsedUserId, parsedGrantedByUserId);
  return Number(result.changes) > 0;
}

function revokePersistentRoomRights(roomId, userId) {
  const parsedRoomId = Number(roomId);
  const parsedUserId = Number(userId);
  if (
    !Number.isInteger(parsedRoomId) ||
    parsedRoomId < 1 ||
    !Number.isInteger(parsedUserId) ||
    parsedUserId < 1
  ) {
    return false;
  }

  const result = db
    .prepare(
      `DELETE FROM chat_room_permissions
       WHERE room_id = ? AND user_id = ?`
    )
    .run(parsedRoomId, parsedUserId);
  return Number(result.changes) > 0;
}

function canBypassRoomLock(user, room = null) {
  if (!user || !room) return false;
  return isRoomOwner(user, room) || hasPersistentRoomRights(user, room);
}

function canGrantRoomPermissions(user, room = null) {
  return isRoomOwner(user, room);
}

const roomInviteAccessGrants = new Map();

function getActiveRoomInviteAccessGrantsForUser(userId) {
  const parsedUserId = Number(userId);
  if (!Number.isInteger(parsedUserId) || parsedUserId < 1) {
    return null;
  }

  const grants = roomInviteAccessGrants.get(parsedUserId);
  if (!grants) {
    return null;
  }

  const now = Date.now();
  for (const [roomId, expiresAt] of grants.entries()) {
    if (!Number.isFinite(expiresAt) || expiresAt <= now) {
      grants.delete(roomId);
    }
  }

  if (!grants.size) {
    roomInviteAccessGrants.delete(parsedUserId);
    return null;
  }

  return grants;
}

function grantRoomInviteAccess(userId, roomId, ttlMs = ROOM_INVITE_ACCESS_TTL_MS) {
  const parsedUserId = Number(userId);
  const parsedRoomId = Number(roomId);
  if (
    !Number.isInteger(parsedUserId) ||
    parsedUserId < 1 ||
    !Number.isInteger(parsedRoomId) ||
    parsedRoomId < 1
  ) {
    return;
  }

  const grants =
    getActiveRoomInviteAccessGrantsForUser(parsedUserId) || new Map();
  grants.set(parsedRoomId, Date.now() + Math.max(1000, Number(ttlMs) || ROOM_INVITE_ACCESS_TTL_MS));
  roomInviteAccessGrants.set(parsedUserId, grants);
}

function hasRoomInviteAccess(userOrId, roomOrId) {
  const parsedUserId =
    Number.isInteger(Number(userOrId?.id)) ? Number(userOrId.id) : Number(userOrId);
  const parsedRoomId =
    Number.isInteger(Number(roomOrId?.id)) ? Number(roomOrId.id) : Number(roomOrId);
  if (
    !Number.isInteger(parsedUserId) ||
    parsedUserId < 1 ||
    !Number.isInteger(parsedRoomId) ||
    parsedRoomId < 1
  ) {
    return false;
  }

  const grants = getActiveRoomInviteAccessGrantsForUser(parsedUserId);
  return Boolean(grants && grants.has(parsedRoomId));
}

function isRoomLockedForUser(user, room = null) {
  return (
    Boolean(room) &&
    Number(room.is_locked) === 1 &&
    !canBypassRoomLock(user, room) &&
    !hasRoomInviteAccess(user, room)
  );
}

function canAccessRoom(user, room = null) {
  if (!user || !room) return false;
  const parsedFestplayId = Number(room.festplay_id);
  if (Number.isInteger(parsedFestplayId) && parsedFestplayId > 0) {
    const festplay = getFestplayById(parsedFestplayId);
    if (!festplay) {
      return false;
    }
    if (Number(room.is_festplay_chat) === 1 && isLegacyAutoFestplayRoom(room, festplay)) {
      return false;
    }
    return Boolean(user?.is_admin) || userHasFestplayAccess(user.id, parsedFestplayId);
  }
  if (Number(room.is_public_room) === 1) {
    return true;
  }
  return (
    canAccessCharacter(user.id, room.character_owner_id, room.character_is_public, user.is_admin) ||
    hasPersistentRoomRights(user, room) ||
    hasRoomInviteAccess(user, room)
  );
}

function getRoomStatePayloadForUser(user, room = null, serverId = DEFAULT_SERVER_ID) {
  const normalizedRoomId = Number.isInteger(Number(room?.id)) ? Number(room.id) : null;
  const normalizedServerId = normalizeServer(serverId || room?.server_id);
  const isLocked = Boolean(room) && Number(room.is_locked) === 1;
  const canAccess = !room || canAccessRoom(user, room);

  return {
    roomId: normalizedRoomId,
    serverId: normalizedServerId,
    isLocked,
    canEnter: canAccess && !isRoomLockedForUser(user, room)
  };
}

function canAccessCharacter(userId, characterOwnerId, isCharacterPublic, isAdmin = false) {
  if (isAdmin === true || Number(isAdmin) === 1) {
    return true;
  }
  return Number(userId) === Number(characterOwnerId) || Number(isCharacterPublic) === 1;
}

function normalizeHomeSectionTitle(rawTitle) {
  return String(rawTitle || "").trim().slice(0, 120);
}

function normalizeHomeSectionBody(rawBody) {
  return String(rawBody || "").trim().slice(0, 2000);
}

function decorateHomeContent(homeContent) {
  const heroTitle = normalizeHomeSectionTitle(homeContent?.hero_title || "") || DEFAULT_HOME_HERO_TITLE;
  const heroBody = normalizeHomeSectionBody(homeContent?.hero_body || "") || DEFAULT_HOME_HERO_BODY;
  const updatesTitle =
    normalizeHomeSectionTitle(homeContent?.updates_title || "") || DEFAULT_UPDATES_TITLE;

  return {
    hero_title: heroTitle,
    hero_body: heroBody,
    hero_body_html: renderGuestbookBbcode(heroBody),
    updates_title: updatesTitle
  };
}

function getHomeContent() {
  const homeContent = db
    .prepare(
      `SELECT hero_title, hero_body, updates_title
       FROM site_home_settings
       WHERE id = 1`
    )
    .get();

  return decorateHomeContent(homeContent);
}

function normalizeSiteUpdateContent(rawContent) {
  return String(rawContent || "").trim().slice(0, 1200);
}

function normalizeSiteUpdateDisplayTimestamp(rawValue) {
  const prepared = String(rawValue || "").trim();
  if (!prepared) {
    return "";
  }

  const match = prepared.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/);
  if (match) {
    return `${match[1]} ${match[2]}`;
  }

  return prepared;
}

function decorateSiteUpdate(siteUpdate) {
  if (!siteUpdate) {
    return null;
  }

  const revisionBase = String(siteUpdate.updated_at || siteUpdate.created_at || "").trim();
  const revisionToken = revisionBase
    ? `${revisionBase}:${Number(siteUpdate.id) || 0}`
    : "";

  return {
    ...siteUpdate,
    author_name: getSiteUpdateAuthorName(siteUpdate),
    display_timestamp: normalizeSiteUpdateDisplayTimestamp(revisionBase),
    revision_token: revisionToken,
    content_html: renderGuestbookBbcode(siteUpdate.content || "")
  };
}

function getSiteUpdateAuthorName(siteUpdate) {
  const fallbackName = String(siteUpdate?.author_name || "").trim() || "Administration";
  const authorId = Number(siteUpdate?.author_id);
  if (!Number.isInteger(authorId) || authorId < 1) {
    return fallbackName;
  }

  const authorUser = getUserForSessionById(authorId);
  if (!authorUser) {
    return fallbackName;
  }

  return String(getUserDisplayProfile(authorUser).label || "").trim() || fallbackName;
}

function getSiteUpdateById(updateId) {
  const siteUpdate = db
    .prepare(
      `SELECT id, author_id, author_name, content, created_at, updated_at
       FROM site_updates
       WHERE id = ?`
    )
    .get(updateId);

  return decorateSiteUpdate(siteUpdate);
}

function getRecentSiteUpdates(limit = 10) {
  const parsedLimit = Number(limit);
  if (!Number.isInteger(parsedLimit) || parsedLimit < 1) {
    return [];
  }

  return db
    .prepare(
      `SELECT id, author_id, author_name, content, created_at, updated_at
       FROM site_updates
       ORDER BY COALESCE(NULLIF(updated_at, ''), created_at) DESC, id DESC
       LIMIT ?`
    )
    .all(parsedLimit)
    .map((siteUpdate) => decorateSiteUpdate(siteUpdate));
}

function getAllSiteUpdates() {
  return db
    .prepare(
      `SELECT id, author_id, author_name, content, created_at, updated_at
       FROM site_updates
       ORDER BY COALESCE(NULLIF(updated_at, ''), created_at) DESC, id DESC`
    )
    .all()
    .map((siteUpdate) => decorateSiteUpdate(siteUpdate));
}

function getLatestSiteUpdateRevisionToken() {
  const latestSiteUpdate = db
    .prepare(
      `SELECT id, created_at, updated_at
       FROM site_updates
       ORDER BY COALESCE(NULLIF(updated_at, ''), created_at) DESC, id DESC
       LIMIT 1`
    )
    .get();

  return decorateSiteUpdate(latestSiteUpdate)?.revision_token || "";
}

function getLiveUpdatesStatePayload(options = {}) {
  const scope = String(options.scope || "recent").trim().toLowerCase();
  const requestedLimit = Number.parseInt(options.limit, 10);
  const limit = Number.isInteger(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), 100)
    : 50;
  const siteUpdates = scope === "full" ? getAllSiteUpdates() : getRecentSiteUpdates(limit);
  const recentSiteUpdateRevisions = siteUpdates
    .slice(0, 50)
    .map((siteUpdate) => String(siteUpdate.revision_token || "").trim())
    .filter(Boolean);

  return {
    homeContent: getHomeContent(),
    siteUpdates,
    recentSiteUpdateRevisions,
    latestSiteUpdateRevisionToken:
      String(siteUpdates[0]?.revision_token || "").trim() || getLatestSiteUpdateRevisionToken()
  };
}

function getUsersTableColumnSet() {
  try {
    const rows = db.prepare("PRAGMA table_info(users)").all();
    return new Set(rows.map((row) => row.name));
  } catch (error) {
    return new Set();
  }
}

function requireAuth(req, res, next) {
  if (!req.session.user) {
    setFlash(req, "error", "Bitte melde dich zuerst an.");
    return res.redirect("/login");
  }
  return next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user?.is_admin) {
    return res.status(403).render("error", {
      title: "Kein Zugriff",
      message: "Nur Admins dürfen diese Seite sehen."
    });
  }
  return next();
}

function requireStaff(req, res, next) {
  if (!req.session.user?.is_admin && !req.session.user?.is_moderator) {
    return res.status(403).render("error", {
      title: "Kein Zugriff",
      message: "Nur Admins und Moderatoren dürfen diese Seite sehen."
    });
  }
  return next();
}

function canPublishSiteUpdates(user) {
  return Boolean(user?.is_admin || user?.is_moderator);
}

function requireSiteUpdateEditor(req, res, next) {
  if (!canPublishSiteUpdates(req.session.user)) {
    return res.status(403).render("error", {
      title: "Kein Zugriff",
      message: "Nur Admins und Moderatoren dürfen Live-Updates veröffentlichen."
    });
  }
  return next();
}

function clearOAuthProfileCompletionSession(req) {
  delete req.session.oauth_birth_date_required;
  delete req.session.oauth_password_required;
  delete req.session.oauth_birth_date_provider;
  delete req.session.oauth_birth_date_redirect;
}

function getOAuthProfileCompletionState(req) {
  if (
    !req.session?.user ||
    (!req.session?.oauth_birth_date_required && !req.session?.oauth_password_required)
  ) {
    return {
      required: false,
      requireBirthDate: false,
      requirePassword: false
    };
  }

  const accountUser = getAccountUserById(req.session.user.id);
  if (!accountUser) {
    req.session.user = null;
    clearOAuthProfileCompletionSession(req);
    return {
      required: false,
      requireBirthDate: false,
      requirePassword: false
    };
  }

  const requireBirthDate =
    Boolean(req.session.oauth_birth_date_required) &&
    !normalizeBirthDate(accountUser.birth_date);
  const requirePassword =
    Boolean(req.session.oauth_password_required) &&
    Number(accountUser.oauth_password_pending) === 1;

  if (!requireBirthDate && !requirePassword) {
    clearOAuthProfileCompletionSession(req);
    return {
      required: false,
      requireBirthDate: false,
      requirePassword: false
    };
  }

  const provider = String(req.session.oauth_birth_date_provider || "google")
    .trim()
    .toLowerCase() === "facebook"
    ? "facebook"
    : "google";

  return {
    required: true,
    provider,
    providerLabel: provider === "facebook" ? "Facebook" : "Google",
    requireBirthDate,
    requirePassword,
    accountUser
  };
}

app.use((req, res, next) => {
  const cookieTheme = getThemeCookie(req);
  let adminImpersonatorUser = null;

  if (req.session.guest_theme) {
    req.session.guest_theme = normalizeTheme(req.session.guest_theme);
  }

  req.session.preferred_character_ids = normalizePreferredCharacterMap(
    req.session.preferred_character_ids
  );

  if (req.session.admin_impersonator_user_id) {
    adminImpersonatorUser = getUserForSessionById(req.session.admin_impersonator_user_id);

    if (!adminImpersonatorUser || adminImpersonatorUser.is_admin !== 1) {
      clearAdminImpersonationSession(req.session);
      req.session.user = null;
      adminImpersonatorUser = null;
      setFlash(req, "error", "Der Admin-Testmodus wurde beendet.");
    }
  }

  if (req.session.user) {
    const user = getUserForSessionById(req.session.user.id);

    if (user) {
      req.session.user = toSessionUser(user);
    } else if (adminImpersonatorUser) {
      req.session.user = toSessionUser(adminImpersonatorUser);
      clearAdminImpersonationSession(req.session);
      adminImpersonatorUser = null;
      setFlash(
        req,
        "error",
        "Der getestete Benutzer existiert nicht mehr. Du bist wieder im Admin-Account."
      );
    } else {
      req.session.user = null;
    }
  }

  const oauthCompletionState = getOAuthProfileCompletionState(req);
  if (oauthCompletionState.required) {
    const normalizedPath = String(req.path || "").trim();
    const isAllowedPath =
      normalizedPath === "/auth/complete-profile" ||
      normalizedPath === "/logout";

    if (!isAllowedPath) {
      return res.redirect("/auth/complete-profile");
    }
  }

  if (req.session.user && req.method === "GET" && req.accepts("html")) {
    res.setHeader("Cache-Control", "private, no-store, max-age=0, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }

  if (req.session.user?.id) {
    createBirthdayGreetingNotificationIfNeeded(req.session.user.id, new Date(), {
      activeCharacter: getPreferredMenuCharacterForUser(req)
    });
  }

  res.locals.currentUser = req.session.user || null;
  res.locals.currentUserAccountName = req.session.user?.username || "";
  res.locals.currentUserDisplayName = req.session.user?.display_name || req.session.user?.username || "";
  res.locals.currentUserDisplayRoleStyle = req.session.user?.display_role_style || "";
  const topbarPreferredCharacter = req.session.user ? getPreferredMenuCharacterForUser(req) : null;
  res.locals.topbarOwnedCharacters = req.session.user
    ? getOwnedCharactersForUser(req.session.user.id, topbarPreferredCharacter?.server_id || DEFAULT_SERVER_ID)
    : [];
  const guestbookNotificationPayload = req.session.user
    ? buildGuestbookNotificationPayloadForUser(req.session.user.id, {
        activeCharacter: topbarPreferredCharacter
      })
    : { count: 0, latest: null };
  res.locals.adminImpersonation =
    req.session.user && adminImpersonatorUser
      ? {
          active: true,
          adminUsername: adminImpersonatorUser.username,
          adminDisplayName: getUserDefaultDisplayName(adminImpersonatorUser),
          adminUserId: Number(adminImpersonatorUser.id) || null
        }
      : null;
  res.locals.guestbookNotificationCount = guestbookNotificationPayload.count;
  res.locals.latestGuestbookNotification = guestbookNotificationPayload.latest;
  res.locals.oauthEnabled = {
    google: GOOGLE_AUTH_ENABLED,
    facebook: FACEBOOK_AUTH_ENABLED
  };
  res.locals.oauthProviders = OAUTH_PROVIDERS;
  res.locals.availableThemes = THEME_OPTIONS;
  res.locals.serverOptions = SERVER_OPTIONS;
  res.locals.guestbookFontOptions = GUESTBOOK_FONT_OPTIONS;
  const publicBaseUrl = getPublicBaseUrl(req) || getLegalMeta().appBaseUrl;
  res.locals.siteName = getLegalMeta().siteName;
  res.locals.metaDescription = getSeoDescriptionForPath(req.path);
  res.locals.robotsMeta = getRobotsMetaForRequest(req);
  res.locals.canonicalUrl = buildCanonicalUrl(publicBaseUrl, req.originalUrl || req.path || "/");
  res.locals.metaImageUrl = buildAbsoluteUrl(publicBaseUrl, DEFAULT_SEO_IMAGE_PATH);
  const recentSiteUpdatesForHeader = getRecentSiteUpdates(50);
  res.locals.latestSiteUpdateRevisionToken =
    String(recentSiteUpdatesForHeader[0]?.revision_token || "").trim() ||
    getLatestSiteUpdateRevisionToken();
  res.locals.recentSiteUpdateRevisions = recentSiteUpdatesForHeader
    .map((siteUpdate) => String(siteUpdate.revision_token || "").trim())
    .filter(Boolean);
  const currentPath = String(req.originalUrl || "/").trim();
  res.locals.currentPath =
    currentPath.startsWith("/") && !currentPath.startsWith("//")
      ? currentPath
      : "/";
  res.locals.activeTheme =
    cookieTheme ||
    req.session.user?.theme ||
    req.session.guest_theme ||
    DEFAULT_THEME;

  if (cookieTheme !== res.locals.activeTheme) {
    setThemeCookie(res, res.locals.activeTheme);
  }

  res.locals.flash = req.session.flash || null;
  res.locals.staticAssetVersion = STATIC_ASSET_VERSION;
  delete req.session.flash;
  next();
});

app.get("/character-notes/:characterId", requireAuth, (req, res) => {
  const userId = Number(req.session?.user?.id);
  const characterId = Number(req.params.characterId);
  const noteState = getCharacterPrivateNoteForUser(userId, characterId);

  if (!noteState?.character) {
    return res.status(404).json({
      error: "not_found"
    });
  }

  return res.json({
    character: {
      id: noteState.character.id,
      name: noteState.character.name,
      server_id: noteState.character.server_id
    },
    content: noteState.content,
    updated_at: noteState.updated_at
  });
});

app.post("/character-notes/:characterId", requireAuth, (req, res) => {
  const userId = Number(req.session?.user?.id);
  const characterId = Number(req.params.characterId);
  const noteState = saveCharacterPrivateNoteForUser(userId, characterId, req.body?.content);

  if (!noteState?.character) {
    return res.status(404).json({
      error: "not_found"
    });
  }

  return res.json({
    ok: true,
    message: noteState.content.trim() ? "Notiz gespeichert." : "Notiz geleert.",
    character: {
      id: noteState.character.id,
      name: noteState.character.name,
      server_id: noteState.character.server_id
    },
    content: noteState.content,
    updated_at: noteState.updated_at
  });
});

app.get("/media/guestbook-image", async (req, res) => {
  const safeUrl = sanitizeBbcodeImageUrl(req.query?.url);
  if (!safeUrl || !/^https?:\/\//i.test(safeUrl)) {
    return res.status(404).end();
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(safeUrl, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36"
      }
    });

    if (!response.ok) {
      return res.status(502).end();
    }

    const contentType = String(response.headers.get("content-type") || "").trim().toLowerCase();
    if (!contentType.startsWith("image/")) {
      return res.status(415).end();
    }

    const cacheControl = String(response.headers.get("cache-control") || "").trim();
    const imageBuffer = Buffer.from(await response.arrayBuffer());

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", String(imageBuffer.length));
    res.setHeader(
      "Cache-Control",
      cacheControl || "public, max-age=21600, s-maxage=21600"
    );
    return res.send(imageBuffer);
  } catch (error) {
    return res.status(502).end();
  } finally {
    clearTimeout(timeout);
  }
});

app.get("/", (req, res) => {
  const homeContent = getHomeContent();
  const recentSiteUpdates = getRecentSiteUpdates(30);
  return res.render("home", {
    title: homeContent.hero_title || DEFAULT_HOME_HERO_TITLE,
    metaDescription:
      "Entdecke Heldenhafte Reisen, eine deutschsprachige Rollenspielplattform mit Charakteren, Räumen, Festspielen und aktuellen Live Updates.",
    stats: getLoginStats(),
    homeContent,
    recentSiteUpdateRevisions: recentSiteUpdates
      .map((siteUpdate) => String(siteUpdate.revision_token || "").trim())
      .filter(Boolean),
    latestSiteUpdateRevisionToken: getLatestSiteUpdateRevisionToken(),
    pageClass: "page-home-screen"
  });
});

app.get("/live-updates", (req, res) => {
  const homeContent = getHomeContent();
  const siteUpdates = getAllSiteUpdates();
  const recentSiteUpdateRevisions = siteUpdates
    .slice(0, 50)
    .map((siteUpdate) => String(siteUpdate.revision_token || "").trim())
    .filter(Boolean);
  return res.render("live-updates", {
    title: homeContent.updates_title || DEFAULT_UPDATES_TITLE,
    metaDescription:
      "Verfolge in den Live Updates von Heldenhafte Reisen neue Funktionen, Änderungen und wichtige Hinweise zur Plattform.",
    homeContent,
    siteUpdates,
    recentSiteUpdateRevisions,
    latestSiteUpdateRevisionToken: getLatestSiteUpdateRevisionToken(),
    pageClass: "page-live-updates"
  });
});

app.get("/api/live-updates/state", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  return res.json(
    getLiveUpdatesStatePayload({
      scope: req.query.scope,
      limit: req.query.limit
    })
  );
});

app.get("/impressum", (req, res) => {
  return res.render("impressum", {
    title: "Impressum",
    legalMeta: getLegalMeta(),
    adminContactName: getPublicAdminCharacterName(),
    pageClass: "page-legal"
  });
});

app.get("/datenschutz", (req, res) => {
  return res.render("datenschutz", {
    title: "Datenschutz",
    legalMeta: getLegalMeta(),
    pageClass: "page-legal"
  });
});

app.get("/community-regeln", (req, res) => {
  return res.render("verhaltensregeln", {
    title: "Community-Regeln",
    legalMeta: getLegalMeta(),
    adminContactName: getPublicAdminCharacterName(),
    pageClass: "page-legal"
  });
});

app.get("/kontakt", (req, res) => {
  return renderKontaktPage(req, res, {
    success: req.query.sent === "1" ? "Deine Nachricht wurde versendet." : ""
  });
});

app.post("/kontakt", async (req, res) => {
  const name = String(req.body.name || "").trim().slice(0, 80);
  const email = normalizeEmail(req.body.email || "");
  const subject = String(req.body.subject || "").trim().slice(0, 140);
  const message = String(req.body.message || "").trim().slice(0, 5000);
  const privacyConsent =
    String(req.body.privacy_consent || "").trim() === "1" ||
    String(req.body.privacy_consent || "").trim().toLowerCase() === "on";
  const honeypotValue = String(req.body.website || "").trim();
  const values = { name, email, subject, message, privacy_consent: privacyConsent };

  if (honeypotValue) {
    return renderKontaktPage(req, res, {
      status: 400,
      error: "Die Nachricht konnte nicht versendet werden.",
      values
    });
  }

  if (!name || !EMAIL_PATTERN.test(email) || !subject || !message) {
    return renderKontaktPage(req, res, {
      status: 400,
      error: "Bitte fülle Name, E-Mail, Betreff und Nachricht vollständig aus.",
      values
    });
  }

  if (!privacyConsent) {
    return renderKontaktPage(req, res, {
      status: 400,
      error: "Bitte bestätige, dass du die Datenschutzerklärung gelesen hast.",
      values
    });
  }

  if (!getVerificationMailer()) {
    return renderKontaktPage(req, res, {
      status: 503,
      error: "Der E-Mail-Versand ist derzeit nicht verfügbar. Bitte versuche es später erneut.",
      values
    });
  }

  try {
    await sendContactMessageEmail({ name, email, subject, message });
  } catch (error) {
    console.error("Konnte Kontaktanfrage nicht senden:", error);
    return renderKontaktPage(req, res, {
      status: 500,
      error: "Die Nachricht konnte gerade nicht versendet werden. Bitte versuche es später erneut.",
      values
    });
  }

  return res.redirect("/kontakt?sent=1");
});

app.get("/register", (req, res) => {
  return renderRegisterPage(req, res);
});

app.post("/register", async (req, res) => {
  const username = (req.body.username || "").trim().slice(0, 24);
  const email = normalizeEmail(req.body.email || "");
  const rawBirthDate = String(req.body.birth_date || "").trim().slice(0, 10);
  const birthDate = normalizeBirthDate(rawBirthDate);
  const password = req.body.password || "";
  const requestIp = getRequestIp(req);
  const submittedToken = String(req.body.form_token || "").trim();
  const honeypotValue = String(req.body.website || "").trim();
  const values = { username, email, birth_date: rawBirthDate };
  logRegistrationGuardEvent({
    ip: requestIp,
    username,
    email,
    outcome: "request",
    reason: "register-submit"
  });
  const blockReason = getRegistrationBlockReason(req, {
    username,
    email,
    honeypotValue,
    submittedToken
  });

  if (blockReason) {
    return renderRegistrationSecurityFailure(req, res, {
      reason: blockReason.reason,
      values,
      username,
      email,
      ip: blockReason.ip
    });
  }

  if (!USERNAME_PATTERN.test(username)) {
    return renderRegisterPage(req, res, {
      status: 400,
      error: "Username nur mit Buchstaben, Zahlen, Leerzeichen und . _ + - (3-24 Zeichen).",
      values
    });
  }

  if (!EMAIL_PATTERN.test(email)) {
    return renderRegisterPage(req, res, {
      status: 400,
      error: "Bitte gib eine gültige E-Mail-Adresse ein.",
      values
    });
  }

  if (!birthDate) {
    return renderRegisterPage(req, res, {
      status: 400,
      error: "Bitte gib ein gültiges Geburtsdatum ein.",
      values
    });
  }

  if (isDisposableEmailDomain(email)) {
    logRegistrationGuardEvent({
      ip: requestIp,
      username,
      email,
      outcome: "blocked",
      reason: "disposable-email-domain"
    });
    return renderRegisterPage(req, res, {
      status: 400,
      error: "Wegwerf-E-Mail-Adressen sind für die Registrierung nicht erlaubt.",
      values
    });
  }

  if (password.length < 6) {
    return renderRegisterPage(req, res, {
      status: 400,
      error: "Passwort muss mindestens 6 Zeichen lang sein.",
      values
    });
  }

  if (!EMAIL_VERIFICATION_MAIL_ENABLED) {
    return renderRegisterPage(req, res, {
      status: 503,
      error:
        "Registrierung ist derzeit nicht verfügbar, weil der E-Mail-Versand noch nicht konfiguriert ist.",
      values
    });
  }

  const captchaCheck = await validateHumanVerification(req, {
    context: "register",
    submittedAnswer: req.body.captcha_answer || "",
    expectedAction: REGISTRATION_CAPTCHA_ACTION
  });
  if (!captchaCheck.ok) {
    return renderRegistrationSecurityFailure(req, res, {
      reason: captchaCheck.reason,
      values,
      username,
      email,
      ip: requestIp
    });
  }

  const existingUsername = db
    .prepare("SELECT id FROM users WHERE username = ?")
    .get(username);
  if (existingUsername) {
    return renderRegisterPage(req, res, {
      status: 400,
      error: "Dieser Username ist bereits vergeben.",
      values
    });
  }

  const existingEmail = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existingEmail) {
    return renderRegisterPage(req, res, {
      status: 400,
      error: "Diese E-Mail-Adresse wird bereits verwendet.",
      values
    });
  }

  const duplicateAccountStatus = getDuplicateAccountRegistrationStatus(requestIp);
  if (duplicateAccountStatus.isBlocked) {
    logRegistrationGuardEvent({
      ip: duplicateAccountStatus.ip,
      username,
      email,
      outcome: "blocked",
      reason: "duplicate-account-ip-blocked"
    });
    return renderRegisterPage(req, res, {
      status: 403,
      error: DUPLICATE_ACCOUNT_REGISTRATION_MESSAGE,
      values
    });
  }

  logRegistrationGuardEvent({
    ip: requestIp,
    username,
    email,
    outcome: "attempt",
    reason: "validated"
  });

  const passwordHash = bcrypt.hashSync(password, 10);
  const verificationToken = crypto.randomBytes(32).toString("hex");
  const adminCount = db
    .prepare("SELECT COUNT(*) AS count FROM users WHERE is_admin = 1")
    .get().count;
  const isAdmin = adminCount === 0 ? 1 : 0;
  let createdUserId = null;
  let accountNumber = null;

  try {
    const info = db
      .prepare(
        `INSERT INTO users
         (username, password_hash, is_admin, theme, email, birth_date, email_verified, email_verification_token, last_login_ip, last_login_at, registration_ip, username_changed_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, CURRENT_TIMESTAMP, ?, CURRENT_TIMESTAMP)`
      )
      .run(
        username,
        passwordHash,
        isAdmin,
        DEFAULT_THEME,
        email,
        birthDate,
        verificationToken,
        requestIp,
        requestIp
      );
    createdUserId = info.lastInsertRowid;
    accountNumber = getAccountNumberByUserId(createdUserId);

    await sendVerificationEmail(req, {
      username,
      email,
      verificationToken
    });

    try {
      await sendRegistrationAdminNotification(req, {
        username,
        email,
        accountNumber
      });
    } catch (notificationError) {
      console.error("Konnte Registrierungsinfo nicht an die Betreiberadresse senden:", notificationError);
    }
  } catch (error) {
    console.error(error);
    if (createdUserId) {
      db.prepare("DELETE FROM users WHERE id = ?").run(createdUserId);
    }
    return renderRegisterPage(req, res, {
      status: 500,
      error:
        "Die Bestätigungs-E-Mail konnte nicht gesendet werden. Bitte versuche es in ein paar Minuten erneut.",
      values
    });
  }

  logRegistrationGuardEvent({
    ip: getRequestIp(req),
    username,
    email,
    outcome: "success",
    reason: "account-created"
  });

  setFlash(
    req,
    "success",
    "Account erstellt. Bitte bestätige jetzt deine E-Mail über den Link aus der Nachricht."
  );
  return res.redirect("/login");
});

app.get("/verify-email", (req, res) => {
  const token = String(req.query.token || "").trim();

  if (!/^[a-f0-9]{64}$/i.test(token)) {
    setFlash(req, "error", "Der Bestätigungslink ist ungültig.");
    return res.redirect("/login");
  }

  const user = db
    .prepare(
      "SELECT id, email_verified FROM users WHERE email_verification_token = ?"
    )
    .get(token);
  if (!user) {
    setFlash(req, "error", "Der Bestätigungslink ist ungültig oder bereits verwendet.");
    return res.redirect("/login");
  }

  if (user.email_verified !== 1) {
    db.prepare(
      "UPDATE users SET email_verified = 1, email_verification_token = '' WHERE id = ?"
    ).run(user.id);
  } else {
    db.prepare("UPDATE users SET email_verification_token = '' WHERE id = ?").run(user.id);
  }

  setFlash(req, "success", "E-Mail bestätigt. Du kannst dich jetzt einloggen.");
  return res.redirect("/login");
});

app.get("/login", (req, res) => {
  return renderLoginPage(req, res, {});
});

app.post("/login", (req, res) => {
  const username = (req.body.username || "").trim().slice(0, 24);
  const password = req.body.password || "";

  const user = db
    .prepare(
      `SELECT id, username, password_hash, is_admin, is_moderator, admin_display_name, moderator_display_name, admin_character_id, moderator_character_id, theme, email_verified
       FROM users
       WHERE username = ?`
    )
    .get(username);

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return renderLoginPage(req, res, {
      status: 401,
      error: "Ungültige Zugangsdaten.",
      values: { username }
    });
  }

  if (user.email_verified !== 1) {
    return renderLoginPage(req, res, {
      status: 403,
      error:
        "Bitte bestätige zuerst deine E-Mail-Adresse über den Link aus der Willkommensmail.",
      values: { username }
    });
  }

  touchUserLoginMetadata(user.id, req);
  req.session.user = toSessionUser(user);
  req.session.cookie.maxAge = getSessionMaxAgeForUser(req.session.user);
  setPostLoginFlash(req, user.id, "Erfolgreich eingeloggt.");
  return res.redirect("/dashboard");
});

app.get("/forgot-username", (req, res) => {
  return renderForgotUsernamePage(req, res);
});

app.post("/forgot-username", async (req, res) => {
  const email = normalizeEmail(req.body.email || "");

  if (!EMAIL_PATTERN.test(email)) {
    return renderForgotUsernamePage(req, res, {
      status: 400,
      error: "Bitte gib eine gültige E-Mail-Adresse ein.",
      values: { email }
    });
  }

  const user = db
    .prepare("SELECT username, email FROM users WHERE email = ?")
    .get(email);

  if (!user) {
    return renderForgotUsernamePage(req, res, {
      status: 404,
      error: "Zu dieser E-Mail-Adresse wurde kein Benutzer gefunden.",
      values: { email }
    });
  }

  let success = "Der Benutzername zu dieser E-Mail-Adresse wurde gefunden.";
  if (EMAIL_VERIFICATION_MAIL_ENABLED) {
    try {
      await sendUsernameReminderEmail(user);
      success = "Der Benutzername wurde angezeigt und zusätzlich per E-Mail gesendet.";
    } catch (error) {
      console.error("Konnte Username-Erinnerung nicht senden:", error);
    }
  }

  return renderForgotUsernamePage(req, res, {
    success,
    recoveredUsername: user.username,
    values: { email }
  });
});

app.get("/forgot-password", (req, res) => {
  return renderForgotPasswordPage(req, res);
});

app.post("/forgot-password", async (req, res) => {
  const email = normalizeEmail(req.body.email || "");

  if (!EMAIL_PATTERN.test(email)) {
    return renderForgotPasswordPage(req, res, {
      status: 400,
      error: "Bitte gib eine gültige E-Mail-Adresse ein.",
      values: { email }
    });
  }

  const user = db
    .prepare("SELECT id, username, email FROM users WHERE email = ?")
    .get(email);

  if (!user) {
    return renderForgotPasswordPage(req, res, {
      status: 404,
      error: "Zu dieser E-Mail-Adresse wurde kein Account gefunden.",
      values: { email }
    });
  }

  const resetToken = crypto.randomBytes(32).toString("hex");
  db.prepare(
    `UPDATE users
     SET password_reset_token = ?, password_reset_sent_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).run(resetToken, user.id);

  const resetUrl = getPasswordResetUrl(req, resetToken);
  let success = "Klicke auf den Link unten, um dein neues Passwort festzulegen.";
  if (EMAIL_VERIFICATION_MAIL_ENABLED) {
    try {
      await sendPasswordResetEmail(req, {
        email: user.email,
        username: user.username,
        resetToken
      });
      success = "Der Passwort-Link wurde erstellt. Du kannst ihn unten direkt anklicken.";
    } catch (error) {
      console.error("Konnte Passwort-Reset-E-Mail nicht senden:", error);
    }
  }

  return renderForgotPasswordPage(req, res, {
    success,
    resetUrl,
    values: { email }
  });
});

app.get("/reset-password", (req, res) => {
  const token = String(req.query.token || "").trim();
  const user = getValidPasswordResetUser(token);

  if (!user) {
    setFlash(req, "error", "Der Passwort-Link ist ungültig oder abgelaufen.");
    return res.redirect("/forgot-password");
  }

  return renderResetPasswordPage(req, res, {
    resetToken: token
  });
});

app.post("/reset-password", (req, res) => {
  const token = String(req.body.token || "").trim();
  const password = String(req.body.password || "");
  const passwordConfirm = String(req.body.password_confirm || "");
  const user = getValidPasswordResetUser(token);

  if (!user) {
    setFlash(req, "error", "Der Passwort-Link ist ungültig oder abgelaufen.");
    return res.redirect("/forgot-password");
  }

  if (password.length < 6) {
    return renderResetPasswordPage(req, res, {
      status: 400,
      error: "Das neue Passwort muss mindestens 6 Zeichen lang sein.",
      resetToken: token
    });
  }

  if (password !== passwordConfirm) {
    return renderResetPasswordPage(req, res, {
      status: 400,
      error: "Die beiden Passwörter stimmen nicht überein.",
      resetToken: token
    });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  db.prepare(
    `UPDATE users
     SET password_hash = ?, password_reset_token = '', password_reset_sent_at = ''
     WHERE id = ?`
  ).run(passwordHash, user.id);

  setFlash(req, "success", "Passwort gespeichert. Du kannst dich jetzt mit dem neuen Passwort einloggen.");
  return res.redirect("/login");
});

app.get("/auth/captcha.svg", (req, res) => {
  const requestedContext = String(req.query.context || "register").trim().toLowerCase();
  const allowedContexts = new Set(["register", "oauth-google", "oauth-facebook"]);
  const context = allowedContexts.has(requestedContext) ? requestedContext : "register";
  const challenge = getHumanVerificationChallenge(req, context, { reissueIfMissing: true });
  const svg = buildHumanVerificationSvg(challenge?.answer || generateHumanVerificationText());
  res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  return res.status(200).send(svg);
});

app.get("/auth/google", (req, res, next) => {
  if (!GOOGLE_AUTH_ENABLED) {
    setFlash(req, "error", getOAuthDisabledMessage(OAUTH_PROVIDERS.google));
    return res.redirect("/login");
  }

  return renderOAuthVerificationPage(req, res, "google");
});

app.post("/auth/google/start", async (req, res, next) => {
  if (!GOOGLE_AUTH_ENABLED) {
    setFlash(req, "error", getOAuthDisabledMessage(OAUTH_PROVIDERS.google));
    return res.redirect("/login");
  }

  const captchaCheck = await validateHumanVerification(req, {
    context: "oauth-google",
    submittedAnswer: req.body.captcha_answer || "",
    expectedAction: OAUTH_CAPTCHA_ACTION
  });
  if (!captchaCheck.ok) {
    return renderOAuthVerificationFailure(req, res, "google", captchaCheck.reason);
  }

  return passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false
  })(req, res, next);
});

app.get("/auth/google/callback", (req, res, next) => {
  if (!GOOGLE_AUTH_ENABLED) {
    setFlash(req, "error", getOAuthDisabledMessage(OAUTH_PROVIDERS.google));
    return res.redirect("/login");
  }

  return passport.authenticate(
      "google",
      { session: false, failureRedirect: "/login" },
      (error, profile) => {
      if (error || !profile) {
        setFlash(req, "error", "Google Login fehlgeschlagen.");
        return res.redirect("/login");
      }

        try {
          const oauthUser = findOrCreateOAuthUser("google", profile, getRequestIp(req));
          req.session.user = oauthUser.sessionUser;
          req.session.cookie.maxAge = getSessionMaxAgeForUser(req.session.user);
          touchUserLoginMetadata(req.session.user.id, req);
          const accountUser = getAccountUserById(req.session.user.id);
          const requiresBirthDate = !normalizeBirthDate(accountUser?.birth_date);
          const requiresPassword = Number(accountUser?.oauth_password_pending) === 1;
          if (requiresBirthDate || requiresPassword) {
            req.session.oauth_birth_date_required = requiresBirthDate;
            req.session.oauth_password_required = requiresPassword;
            req.session.oauth_birth_date_provider = "google";
            req.session.oauth_birth_date_redirect = "/dashboard";
            return res.redirect("/auth/complete-profile");
          }
          clearOAuthProfileCompletionSession(req);
          setPostLoginFlash(req, req.session.user.id, "Mit Google eingeloggt.");
          return res.redirect("/dashboard");
        } catch (oauthError) {
        console.error(oauthError);
        if (oauthError?.code === "DISPOSABLE_EMAIL_DOMAIN") {
          logRegistrationGuardEvent({
            ip: getRequestIp(req),
            username: String(profile?.displayName || "").trim(),
            email: getProfileEmail(profile),
            outcome: "blocked",
            reason: "oauth-disposable-email-domain"
          });
          setFlash(req, "error", "Wegwerf-E-Mail-Adressen sind für die Registrierung nicht erlaubt.");
        } else if (oauthError?.code === "DUPLICATE_ACCOUNT_IP_BLOCKED") {
          logRegistrationGuardEvent({
            ip: String(oauthError.ip || getRequestIp(req)).trim(),
            username: String(profile?.displayName || "").trim(),
            email: getProfileEmail(profile),
            outcome: "blocked",
            reason: "oauth-duplicate-account-ip-blocked"
          });
          setFlash(req, "error", DUPLICATE_ACCOUNT_REGISTRATION_MESSAGE);
        } else {
          setFlash(req, "error", "Google Login konnte nicht verarbeitet werden.");
        }
        return res.redirect("/login");
      }
    }
  )(req, res, next);
});

app.get("/auth/facebook", (req, res, next) => {
  if (!FACEBOOK_AUTH_ENABLED) {
    setFlash(req, "error", getOAuthDisabledMessage(OAUTH_PROVIDERS.facebook));
    return res.redirect("/login");
  }

  return renderOAuthVerificationPage(req, res, "facebook");
});

app.post("/auth/facebook/start", async (req, res, next) => {
  if (!FACEBOOK_AUTH_ENABLED) {
    setFlash(req, "error", getOAuthDisabledMessage(OAUTH_PROVIDERS.facebook));
    return res.redirect("/login");
  }

  const captchaCheck = await validateHumanVerification(req, {
    context: "oauth-facebook",
    submittedAnswer: req.body.captcha_answer || "",
    expectedAction: OAUTH_CAPTCHA_ACTION
  });
  if (!captchaCheck.ok) {
    return renderOAuthVerificationFailure(req, res, "facebook", captchaCheck.reason);
  }

  return passport.authenticate("facebook", {
    scope: ["email"],
    session: false
  })(req, res, next);
});

app.get("/auth/facebook/callback", (req, res, next) => {
  if (!FACEBOOK_AUTH_ENABLED) {
    setFlash(req, "error", getOAuthDisabledMessage(OAUTH_PROVIDERS.facebook));
    return res.redirect("/login");
  }

  return passport.authenticate(
      "facebook",
      { session: false, failureRedirect: "/login" },
      (error, profile) => {
      if (error || !profile) {
        setFlash(req, "error", "Facebook Login fehlgeschlagen.");
        return res.redirect("/login");
      }

        try {
          const oauthUser = findOrCreateOAuthUser("facebook", profile, getRequestIp(req));
          req.session.user = oauthUser.sessionUser;
          req.session.cookie.maxAge = getSessionMaxAgeForUser(req.session.user);
          touchUserLoginMetadata(req.session.user.id, req);
          const accountUser = getAccountUserById(req.session.user.id);
          if (!normalizeBirthDate(accountUser?.birth_date)) {
            req.session.oauth_birth_date_required = true;
            req.session.oauth_password_required = false;
            req.session.oauth_birth_date_provider = "facebook";
            req.session.oauth_birth_date_redirect = "/dashboard";
            return res.redirect("/auth/complete-profile");
          }
          clearOAuthProfileCompletionSession(req);
          setPostLoginFlash(req, req.session.user.id, "Mit Facebook eingeloggt.");
          return res.redirect("/dashboard");
        } catch (oauthError) {
        console.error(oauthError);
        if (oauthError?.code === "DISPOSABLE_EMAIL_DOMAIN") {
          logRegistrationGuardEvent({
            ip: getRequestIp(req),
            username: String(profile?.displayName || "").trim(),
            email: getProfileEmail(profile),
            outcome: "blocked",
            reason: "oauth-disposable-email-domain"
          });
          setFlash(req, "error", "Wegwerf-E-Mail-Adressen sind für die Registrierung nicht erlaubt.");
        } else if (oauthError?.code === "DUPLICATE_ACCOUNT_IP_BLOCKED") {
          logRegistrationGuardEvent({
            ip: String(oauthError.ip || getRequestIp(req)).trim(),
            username: String(profile?.displayName || "").trim(),
            email: getProfileEmail(profile),
            outcome: "blocked",
            reason: "oauth-duplicate-account-ip-blocked"
          });
          setFlash(req, "error", DUPLICATE_ACCOUNT_REGISTRATION_MESSAGE);
        } else {
          setFlash(req, "error", "Facebook Login konnte nicht verarbeitet werden.");
        }
        return res.redirect("/login");
      }
    }
  )(req, res, next);
});

app.get("/auth/complete-profile", requireAuth, (req, res) => {
  const completionState = getOAuthProfileCompletionState(req);
  if (!completionState.required) {
    return res.redirect("/dashboard");
  }

  return renderOAuthBirthDatePage(req, res, completionState);
});

app.post("/auth/complete-profile", requireAuth, (req, res) => {
  const completionState = getOAuthProfileCompletionState(req);
  if (!completionState.required) {
    return res.redirect("/dashboard");
  }

  const rawBirthDate = String(req.body.birth_date || "").trim().slice(0, 10);
  const birthDate = normalizeBirthDate(rawBirthDate);
  const password = String(req.body.password || "");

  if (completionState.requireBirthDate && !birthDate) {
    return renderOAuthBirthDatePage(req, res, {
      ...completionState,
      status: 400,
      error: "Bitte trage ein gültiges Geburtsdatum ein, bevor du weitermachen kannst.",
      values: {
        birth_date: rawBirthDate
      }
    });
  }

  if (completionState.requirePassword && password.length < 6) {
    return renderOAuthBirthDatePage(req, res, {
      ...completionState,
      status: 400,
      error: "Bitte vergib ein Passwort mit mindestens 6 Zeichen für diese Seite.",
      values: {
        birth_date: rawBirthDate
      }
    });
  }

  if (completionState.requireBirthDate) {
    db.prepare("UPDATE users SET birth_date = ? WHERE id = ?").run(birthDate, req.session.user.id);
  }

  if (completionState.requirePassword) {
    const passwordHash = bcrypt.hashSync(password, 10);
    db.prepare("UPDATE users SET password_hash = ?, oauth_password_pending = 0 WHERE id = ?").run(
      passwordHash,
      req.session.user.id
    );
  }

  const refreshedUser = getUserForSessionById(req.session.user.id);
  if (refreshedUser) {
    req.session.user = toSessionUser(refreshedUser);
  }

  const nextUrl = String(req.session.oauth_birth_date_redirect || "/dashboard").trim() || "/dashboard";
  clearOAuthProfileCompletionSession(req);
  setPostLoginFlash(req, req.session.user.id, "Profil gespeichert. Du kannst jetzt weitermachen.");
  return res.redirect(nextUrl);
});

app.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

app.post("/session/touch", (req, res) => {
  const isFetchRequest = isXmlHttpRequest(req);

  if (!req.session.user) {
    if (isFetchRequest) {
      return res.status(401).json({ error: "auth_required" });
    }

    setFlash(req, "error", "Bitte melde dich zuerst an.");
    return res.redirect("/login");
  }

  markSessionTabHeartbeat(req.session);
  req.session.cookie.maxAge = getSessionMaxAgeForUser(req.session.user);
  return req.session.save((error) => {
    if (error) {
      console.error("session touch failed", error);
      if (isFetchRequest) {
        return res.status(500).json({ error: "session_touch_failed" });
      }
      return res.status(500).render("error", {
        title: "Serverfehler",
        message: "Die Sitzung konnte gerade nicht aktualisiert werden."
      });
    }

    return res.status(204).end();
  });
});

app.get("/account", requireAuth, (req, res) => {
  return renderAccountPage(req, res);
});

app.post("/account/update", requireAuth, (req, res) => {
  const currentUserId = Number(req.session.user?.id);
  if (!Number.isInteger(currentUserId) || currentUserId < 1) {
    req.session.user = null;
    setFlash(req, "error", "Account konnte nicht zugeordnet werden.");
    return res.redirect("/login");
  }

  const accountUser = getAccountUserById(currentUserId);
  if (!accountUser) {
    req.session.user = null;
    setFlash(req, "error", "Account existiert nicht mehr.");
    return res.redirect("/login");
  }

  const username = String(req.body.username || "").trim().slice(0, 24);
  const email = normalizeEmail(req.body.email || "");
  const autoAfkEnabled = String(req.body.auto_afk_enabled || "").trim() === "1";
  const rawAfkTimeoutMinutes = String(req.body.afk_timeout_minutes || "").trim().slice(0, 3);
  const roomLogEmailEnabled = String(req.body.room_log_email_enabled || "").trim() === "1";
  const showOwnChatTime = String(req.body.show_own_chat_time || "").trim() === "1";
  const birthDate = normalizeBirthDate(accountUser.birth_date) || "";
  const afkTimeoutMinutes = parseAfkTimeoutMinutes(rawAfkTimeoutMinutes);
  const usernameChanged = username !== accountUser.username;
  const usernameChangeInfo = getUsernameChangeAvailability(accountUser);

  const renderWithError = (errorMessage) =>
    renderAccountPage(req, res, {
      error: errorMessage,
      accountUser,
      values: {
        username,
        email,
        auto_afk_enabled: autoAfkEnabled,
        afk_timeout_minutes: rawAfkTimeoutMinutes,
        room_log_email_enabled: roomLogEmailEnabled,
        show_own_chat_time: showOwnChatTime
      }
    });

  if (!USERNAME_PATTERN.test(username)) {
    return renderWithError(
      "Account-Name nur mit Buchstaben, Zahlen, Leerzeichen und . _ + - (3-24 Zeichen)."
    );
  }

  if (email && !EMAIL_PATTERN.test(email)) {
    return renderWithError("Bitte eine gültige E-Mail-Adresse verwenden.");
  }

  if (afkTimeoutMinutes == null) {
    return renderWithError(
      `Bitte eine AFK-Zeit zwischen ${MIN_AFK_TIMEOUT_MINUTES} und ${MAX_AFK_TIMEOUT_MINUTES} Minuten verwenden.`
    );
  }

  if (usernameChanged && !usernameChangeInfo.can_change) {
    return renderWithError(
      `Du kannst deinen Account-Namen erst wieder ab ${usernameChangeInfo.available_at_text} ändern.`
    );
  }

  const usernameOwner = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
  if (usernameOwner && Number(usernameOwner.id) !== currentUserId) {
    return renderWithError("Dieser Account-Name ist bereits vergeben.");
  }

  if (email) {
    const emailOwner = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
    if (emailOwner && Number(emailOwner.id) !== currentUserId) {
      return renderWithError("Diese E-Mail-Adresse wird bereits verwendet.");
    }
  }

  db.prepare(
    `UPDATE users
     SET username = ?,
         email = ?,
         birth_date = ?,
         afk_timeout_minutes = ?,
         auto_afk_enabled = ?,
         room_log_email_enabled = ?,
         show_own_chat_time = ?,
         username_changed_at = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE username_changed_at END
     WHERE id = ?`
  ).run(
    username,
    email,
    birthDate,
    afkTimeoutMinutes,
    autoAfkEnabled ? 1 : 0,
    roomLogEmailEnabled ? 1 : 0,
    showOwnChatTime ? 1 : 0,
    usernameChanged ? 1 : 0,
    currentUserId
  );

  const refreshedSessionUser = refreshConnectedUserDisplay(currentUserId);
  if (refreshedSessionUser) {
    req.session.user = refreshedSessionUser;
  } else {
    const refreshedUser = getUserForSessionById(currentUserId);
    if (refreshedUser) {
      req.session.user = toSessionUser(refreshedUser);
    }
  }

  if (usernameChanged) {
    if (usernameChangeInfo.is_admin_bypass) {
      setFlash(req, "success", "Account gespeichert. Dein Account-Name wurde aktualisiert.");
    } else {
      setFlash(
        req,
        "success",
        `Account gespeichert. Dein Account-Name wurde aktualisiert. Die nächste Änderung ist für normale Nutzer wieder in ${USERNAME_CHANGE_COOLDOWN_DAYS} Tagen möglich.`
      );
    }
  } else {
    setFlash(req, "success", "Account gespeichert.");
  }

  return res.redirect("/account");
});

app.get("/api/social/state", requireAuth, (req, res) => {
  return res.json({
    ok: true,
    state: buildSocialStatePayloadForUser(req.session.user.id)
  });
});

app.post("/api/social/friends", requireAuth, (req, res) => {
  const currentUserId = Number(req.session.user?.id);
  const directUserId = Number(req.body.user_id);
  const lookup = normalizeSocialLookupValue(req.body.lookup || "");
  if (!Number.isInteger(currentUserId) || currentUserId < 1) {
    return res.status(401).json({ ok: false, error: "Bitte erneut einloggen." });
  }

  if (!(Number.isInteger(directUserId) && directUserId > 0) && !lookup) {
    return res.status(400).json({ ok: false, error: "Bitte einen Charakternamen eingeben." });
  }

  const targetUser =
    Number.isInteger(directUserId) && directUserId > 0
      ? db.prepare("SELECT id, username, account_number FROM users WHERE id = ? LIMIT 1").get(directUserId)
      : findUserBySocialLookup(lookup);
  if (!targetUser) {
    return res.status(404).json({ ok: false, error: "Dieser Charakter wurde nicht gefunden." });
  }

  if (Number(targetUser.id) === currentUserId) {
    return res.status(400).json({ ok: false, error: "Du kannst dich nicht selbst als Freund hinzufügen." });
  }

  db.prepare(
    `INSERT OR IGNORE INTO friend_links (user_id, friend_user_id)
     VALUES (?, ?)`
  ).run(currentUserId, Number(targetUser.id));

  emitSocialStateUpdateForUser(currentUserId);

  return res.json({
    ok: true,
    message: "Freund wurde hinzugefügt.",
    state: buildSocialStatePayloadForUser(currentUserId)
  });
});

app.post("/api/social/friends/:friendUserId/delete", requireAuth, (req, res) => {
  const currentUserId = Number(req.session.user?.id);
  const friendUserId = Number(req.params.friendUserId);
  if (!Number.isInteger(currentUserId) || currentUserId < 1) {
    return res.status(401).json({ ok: false, error: "Bitte erneut einloggen." });
  }

  if (!Number.isInteger(friendUserId) || friendUserId < 1) {
    return res.status(400).json({ ok: false, error: "Freund konnte nicht zugeordnet werden." });
  }

  db.prepare(
    `DELETE FROM friend_links
      WHERE user_id = ?
        AND friend_user_id = ?`
  ).run(currentUserId, friendUserId);

  emitSocialStateUpdateForUser(currentUserId);

  return res.json({
    ok: true,
    message: "Freund wurde entfernt.",
    state: buildSocialStatePayloadForUser(currentUserId)
  });
});

app.post("/api/social/ignored-accounts", requireAuth, (req, res) => {
  const currentUserId = Number(req.session.user?.id);
  const directUserId = Number(req.body.user_id);
  const lookup = normalizeSocialLookupValue(req.body.lookup || "");
  const currentUser = req.session.user || null;
  if (!Number.isInteger(currentUserId) || currentUserId < 1) {
    return res.status(401).json({ ok: false, error: "Bitte erneut einloggen." });
  }

  const targetUser =
    Number.isInteger(directUserId) && directUserId > 0
      ? db
          .prepare(
            "SELECT id, username, account_number, is_admin, is_moderator FROM users WHERE id = ? LIMIT 1"
          )
          .get(directUserId)
      : findUserBySocialLookup(lookup);

  if (!targetUser) {
    return res.status(404).json({ ok: false, error: "Dieser Charakter wurde nicht gefunden." });
  }

  if (Number(targetUser.id) === currentUserId) {
    return res.status(400).json({ ok: false, error: "Du kannst deinen eigenen Account nicht ignorieren." });
  }

  if (isSocialBlockProtectedTarget(currentUser, targetUser)) {
    return res.status(403).json({
      ok: false,
      error: "Admins und Moderatoren können von normalen Usern nicht blockiert oder ignoriert werden."
    });
  }

  db.prepare(
    `INSERT OR IGNORE INTO ignored_accounts (user_id, ignored_user_id)
     VALUES (?, ?)`
  ).run(currentUserId, Number(targetUser.id));

  emitSocialStateUpdateForUser(currentUserId);

  return res.json({
    ok: true,
    message: "Account wird jetzt ignoriert.",
    state: buildSocialStatePayloadForUser(currentUserId)
  });
});

app.post("/api/social/ignored-accounts/:ignoredUserId/delete", requireAuth, (req, res) => {
  const currentUserId = Number(req.session.user?.id);
  const ignoredUserId = Number(req.params.ignoredUserId);
  if (!Number.isInteger(currentUserId) || currentUserId < 1) {
    return res.status(401).json({ ok: false, error: "Bitte erneut einloggen." });
  }

  if (!Number.isInteger(ignoredUserId) || ignoredUserId < 1) {
    return res.status(400).json({ ok: false, error: "Account konnte nicht zugeordnet werden." });
  }

  db.prepare(
    `DELETE FROM ignored_accounts
      WHERE user_id = ?
        AND ignored_user_id = ?`
  ).run(currentUserId, ignoredUserId);

  emitSocialStateUpdateForUser(currentUserId);

  return res.json({
    ok: true,
    message: "Account-Ignorieren wurde entfernt.",
    state: buildSocialStatePayloadForUser(currentUserId)
  });
});

app.post("/api/social/ignored-characters", requireAuth, (req, res) => {
  const currentUserId = Number(req.session.user?.id);
  const characterId = Number(req.body.character_id);
  const currentUser = req.session.user || null;
  if (!Number.isInteger(currentUserId) || currentUserId < 1) {
    return res.status(401).json({ ok: false, error: "Bitte erneut einloggen." });
  }

  const targetCharacter = getCharacterSocialTargetById(characterId);
  if (!targetCharacter) {
    return res.status(404).json({ ok: false, error: "Dieser Charakter wurde nicht gefunden." });
  }

  if (Number(targetCharacter.user_id) === currentUserId) {
    return res.status(400).json({ ok: false, error: "Deinen eigenen Charakter kannst du nicht ignorieren." });
  }

  if (isSocialBlockProtectedTarget(currentUser, targetCharacter)) {
    return res.status(403).json({
      ok: false,
      error: "Admins und Moderatoren können von normalen Usern nicht blockiert oder ignoriert werden."
    });
  }

  db.prepare(
    `INSERT OR IGNORE INTO ignored_characters (user_id, ignored_character_id)
     VALUES (?, ?)`
  ).run(currentUserId, Number(targetCharacter.character_id));

  emitSocialStateUpdateForUser(currentUserId);

  return res.json({
    ok: true,
    message: `${targetCharacter.name} wird jetzt ignoriert.`,
    state: buildSocialStatePayloadForUser(currentUserId)
  });
});

app.post("/api/social/ignored-characters/:ignoredCharacterId/delete", requireAuth, (req, res) => {
  const currentUserId = Number(req.session.user?.id);
  const ignoredCharacterId = Number(req.params.ignoredCharacterId);
  if (!Number.isInteger(currentUserId) || currentUserId < 1) {
    return res.status(401).json({ ok: false, error: "Bitte erneut einloggen." });
  }

  if (!Number.isInteger(ignoredCharacterId) || ignoredCharacterId < 1) {
    return res.status(400).json({ ok: false, error: "Charakter konnte nicht zugeordnet werden." });
  }

  db.prepare(
    `DELETE FROM ignored_characters
      WHERE user_id = ?
        AND ignored_character_id = ?`
  ).run(currentUserId, ignoredCharacterId);

  emitSocialStateUpdateForUser(currentUserId);

  return res.json({
    ok: true,
    message: "Charakter-Ignorieren wurde entfernt.",
    state: buildSocialStatePayloadForUser(currentUserId)
  });
});

app.post("/account/delete", requireAuth, async (req, res) => {
  const currentUserId = Number(req.session.user?.id);
  if (!Number.isInteger(currentUserId) || currentUserId < 1) {
    setFlash(req, "error", "Account konnte nicht zugeordnet werden.");
    return res.redirect("/login");
  }

  const confirmUsername = (req.body.confirm_username || "").trim().slice(0, 24);
  const password = String(req.body.password || "");
  const user = db
    .prepare(
      `SELECT id, username, password_hash, is_admin, email
       FROM users
       WHERE id = ?`
    )
    .get(currentUserId);

  if (!user) {
    req.session.user = null;
    setFlash(req, "error", "Account existiert nicht mehr.");
    return res.redirect("/login");
  }

  if (confirmUsername !== user.username) {
    setFlash(
      req,
      "error",
      "Bitte gib zur Bestätigung exakt deinen aktuellen Username ein."
    );
    return res.redirect("/dashboard");
  }

  if (!bcrypt.compareSync(password, user.password_hash)) {
    setFlash(req, "error", "Passwort stimmt nicht.");
    return res.redirect("/dashboard");
  }

  try {
    const deleteAccountTx = db.transaction((userId, isAdmin) => {
      if (isAdmin === 1) {
        const replacement = db
          .prepare(
            `SELECT id
             FROM users
             WHERE id != ?
             ORDER BY is_admin DESC, created_at ASC, id ASC
             LIMIT 1`
          )
          .get(userId);

        if (replacement) {
          db.prepare("UPDATE users SET is_admin = 1 WHERE id = ?").run(replacement.id);
        }
      }

      db.prepare("DELETE FROM users WHERE id = ?").run(userId);
    });

    deleteAccountTx(user.id, user.is_admin);
  } catch (error) {
    console.error(error);
    setFlash(req, "error", "Account konnte nicht gelöscht werden.");
    return res.redirect("/dashboard");
  }

  try {
    await sendAccountDeletionEmail({
      username: user.username,
      email: user.email
    });
  } catch (error) {
    console.error("Konnte Account-Lösch-E-Mail nicht senden:", error);
  }

  req.session.destroy(() => {
    res.redirect("/");
  });
});

app.get("/rp-board", requireAuth, (req, res) => {
  const requestedServerId = normalizeServer(req.query.server_id);
  const requestedCharacterId = Number(req.query.character_id);
  let context = resolveRpBoardContextForUser(
    req.session.user.id,
    requestedServerId,
    0,
    requestedCharacterId
  );

  if (!context) {
    const preferredCharacterId = getPreferredCharacterIdFromSession(req, requestedServerId);
    const preferredCharacter = getPreferredCharacterForUser(
      req.session.user.id,
      requestedServerId,
      preferredCharacterId
    );

    if (preferredCharacter) {
      context = resolveRpBoardContextForUser(
        req.session.user.id,
        requestedServerId,
        0,
        preferredCharacter.id
      );
    }
  }

  if (!context) {
    return res.status(403).render("error", {
      title: "Kein Zugriff",
      message: "Für diesen RP-Aushang wurde kein passender eigener Charakter gefunden."
    });
  }

  rememberPreferredCharacter(req, context.character);
  setRpBoardReadMarker(
    req.session.user.id,
    context.serverId,
    0,
    getLatestRpBoardEntryId(context.serverId, 0)
  );

  return res.render("rp-board-page", {
    title: `RP-Aushang: ${getServerLabel(context.serverId)}`,
    topbarCharacter: context.character,
    activeCharacter: context.character,
    rpBoardServerId: context.serverId,
    rpBoardCharacterId: context.character.id,
    rpBoardServerLabel: getServerLabel(context.serverId),
    rpBoardEntries: getRpBoardEntries(context.serverId, 0, req.session.user.id)
  });
});

app.get("/character-backups", requireAuth, (req, res) => {
  const characterBackups = getCharacterBackupsForUser(req.session.user.id);

  return res.render("character-backups", {
    title: "Gelöschte Charaktere",
    activeTab: "characters",
    characterBackups
  });
});

app.get("/character-backups/logs", requireAuth, (req, res) => {
  const logCharacters = getChatLogBackupCharactersForUser(req.session.user.id).map((entry) => ({
    ...entry,
    detail_href: buildChatLogBackupDetailTarget(entry.character_id, entry.character_name, entry.server_id),
    server_label: getServerLabel(entry.server_id),
    last_log_at_label: formatGermanDateTime(entry.last_log_at)
  }));

  return res.render("character-backup-logs", {
    title: "Log-Backups",
    activeTab: "logs",
    logCharacters
  });
});

app.get("/character-backups/logs/:characterId", requireAuth, (req, res) => {
  const characterId = Number(req.params.characterId);
  if (!Number.isInteger(characterId) || characterId < 0) {
    return res.status(404).render("404", { title: "Nicht gefunden" });
  }

  const requestedCharacterName = String(req.query.name || "").trim();
  const requestedServerId = String(req.query.server_id || "").trim();
  const characterLogs = getChatLogBackupsForUserCharacter(req.session.user.id, characterId, {
    characterName: requestedCharacterName,
    serverId: requestedServerId
  }).map((entry) => ({
    ...entry,
    server_label: getServerLabel(entry.server_id),
    started_at_label: formatGermanDateTime(entry.started_at || entry.created_at),
    ended_at_label: formatGermanDateTime(entry.ended_at || entry.created_at)
  }));

  if (!characterLogs.length) {
    setFlash(req, "error", "Für diesen Charakter wurden keine Log-Backups gefunden.");
    return res.redirect("/character-backups/logs");
  }

  return res.render("character-backup-log-detail", {
    title: `Logs: ${characterLogs[0].character_name}`,
    activeTab: "logs",
    characterLogGroup: {
      character_id: characterId,
      character_name: characterLogs[0].character_name,
      server_id: characterLogs[0].server_id,
      server_label: characterLogs[0].server_label,
      log_count: characterLogs.length
    },
    characterLogs
  });
});

app.post("/character-backups/logs/:logId/delete", requireAuth, (req, res) => {
  const logId = Number(req.params.logId);
  if (!Number.isInteger(logId) || logId < 1) {
    setFlash(req, "error", "Log-Backup wurde nicht gefunden.");
    return res.redirect("/character-backups/logs");
  }

  const existingLog = db
    .prepare(
      `SELECT id, character_id, character_name, server_id
         FROM chat_log_backups
        WHERE id = ?
          AND user_id = ?`
    )
    .get(logId, req.session.user.id);

  if (!existingLog) {
    setFlash(req, "error", "Log-Backup wurde nicht gefunden.");
    return res.redirect("/character-backups/logs");
  }

  db.prepare(
    `DELETE FROM chat_log_backups
      WHERE id = ?
        AND user_id = ?`
  ).run(logId, req.session.user.id);

  const remainingLogs = getChatLogBackupsForUserCharacter(
    req.session.user.id,
    existingLog.character_id,
    {
      characterName: existingLog.character_name,
      serverId: existingLog.server_id
    }
  );

  setFlash(req, "success", "Log-Backup wurde gelöscht.");
  if (remainingLogs.length > 0) {
    return res.redirect(
      buildChatLogBackupDetailTarget(
        existingLog.character_id,
        existingLog.character_name,
        existingLog.server_id
      )
    );
  }

  return res.redirect("/character-backups/logs");
});

app.post("/character-backups/:backupId/restore", requireAuth, (req, res) => {
  const backupId = Number(req.params.backupId);
  if (!Number.isInteger(backupId) || backupId < 1) {
    setFlash(req, "error", "Backup wurde nicht gefunden.");
    return res.redirect("/character-backups");
  }

  try {
    const restoredCharacter = restoreCharacterBackupTx(backupId, req.session.user.id);
    const refreshedUser = getUserForSessionById(req.session.user.id);
    if (refreshedUser) {
      req.session.user = toSessionUser(refreshedUser);
    }
    refreshConnectedUserDisplay(req.session.user.id);
    emitHomeStatsUpdate();
    setFlash(req, "success", `Charakter ${restoredCharacter.name} wurde wiederhergestellt.`);
    return res.redirect("/character-backups");
  } catch (error) {
    if (error?.code === "BACKUP_NOT_FOUND") {
      setFlash(req, "error", "Backup wurde nicht gefunden.");
      return res.redirect("/character-backups");
    }

    if (error?.code === "BACKUP_INVALID") {
      setFlash(req, "error", "Dieses Backup ist beschädigt und kann nicht wiederhergestellt werden.");
      return res.redirect("/character-backups");
    }

    if (error?.code === "CHARACTER_NAME_TAKEN") {
      setFlash(req, "error", "Der Charaktername ist bereits vergeben. Das Backup kann gerade nicht wiederhergestellt werden.");
      return res.redirect("/character-backups");
    }

    console.error(error);
    setFlash(req, "error", "Backup konnte nicht wiederhergestellt werden.");
    return res.redirect("/character-backups");
  }
});

app.post("/character-backups/:backupId/delete", requireAuth, (req, res) => {
  const backupId = Number(req.params.backupId);
  if (!Number.isInteger(backupId) || backupId < 1) {
    setFlash(req, "error", "Backup wurde nicht gefunden.");
    return res.redirect("/character-backups");
  }

  const info = db
    .prepare(
      `DELETE FROM character_backups
        WHERE id = ?
          AND user_id = ?`
    )
    .run(backupId, req.session.user.id);

  if (!info.changes) {
    setFlash(req, "error", "Backup wurde nicht gefunden.");
    return res.redirect("/character-backups");
  }

  setFlash(req, "success", "Backup endgültig gelöscht.");
  return res.redirect("/character-backups");
});

app.get("/rp-board/state", requireAuth, (req, res) => {
  const context = resolveRpBoardContextForUser(
    req.session.user.id,
    req.query.server_id,
    req.query.festplay_id,
    req.query.character_id
  );
  if (!context) {
    return res.status(403).json({ error: "forbidden" });
  }

  return res.json({
    boardName: "RP-Aushang",
    ...buildRpBoardStateForUser(req.session.user.id, context.serverId, context.festplayId)
  });
});

app.post("/rp-board/read", requireAuth, (req, res) => {
  const context = resolveRpBoardContextForUser(
    req.session.user.id,
    req.body.server_id,
    req.body.festplay_id,
    req.body.character_id
  );
  if (!context) {
    return res.status(403).json({ error: "forbidden" });
  }

  setRpBoardReadMarker(
    req.session.user.id,
    context.serverId,
    context.festplayId,
    getLatestRpBoardEntryId(context.serverId, context.festplayId)
  );

  return res.json(buildRpBoardStateForUser(req.session.user.id, context.serverId, context.festplayId));
});

app.post("/rp-board/entries", requireAuth, (req, res) => {
  const context = resolveRpBoardContextForUser(
    req.session.user.id,
    req.body.server_id,
    req.body.festplay_id,
    req.body.character_id
  );
  if (!context) {
    return res.status(403).json({ error: "forbidden" });
  }

  const content = normalizeRpBoardContent(req.body.content);
  if (!content) {
    return res.status(400).json({ error: "content_required" });
  }

  const createdAt = formatChatTimestamp();
  const insertInfo = db.prepare(
    `INSERT INTO rp_board_entries (
       server_id,
       festplay_id,
       user_id,
       character_id,
       author_name,
       author_chat_text_color,
       content,
       created_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    context.serverId,
    context.festplayId,
    req.session.user.id,
    context.character.id,
    context.character.name,
    context.character.chat_text_color,
    content,
    createdAt
  );
  if (Number(context.festplayId) > 0) {
    touchFestplayActivity(context.festplayId, createdAt);
  }

  setRpBoardReadMarker(req.session.user.id, context.serverId, context.festplayId, Number(insertInfo.lastInsertRowid));
  emitRpBoardChanged(context.serverId, context.festplayId);

  return res.json(buildRpBoardStateForUser(req.session.user.id, context.serverId, context.festplayId));
});

app.post("/rp-board/entries/:entryId/delete", requireAuth, (req, res) => {
  const entryId = Number(req.params.entryId);
  if (!Number.isInteger(entryId) || entryId < 1) {
    return res.status(404).json({ error: "not_found" });
  }

  const entry = db
    .prepare(
      `SELECT id, user_id, server_id, festplay_id
       FROM rp_board_entries
       WHERE id = ?
       LIMIT 1`
    )
    .get(entryId);
  if (!entry) {
    return res.status(404).json({ error: "not_found" });
  }
  if (Number(entry.user_id) !== Number(req.session.user.id)) {
    return res.status(403).json({ error: "forbidden" });
  }

  db.prepare("DELETE FROM rp_board_entries WHERE id = ? AND user_id = ?").run(entryId, req.session.user.id);
  if (Number(entry.festplay_id) > 0) {
    touchFestplayActivity(entry.festplay_id);
  }
  emitRpBoardChanged(entry.server_id, entry.festplay_id);

  return res.json(
    buildRpBoardStateForUser(req.session.user.id, normalizeServer(entry.server_id), normalizeRpBoardFestplayId(entry.festplay_id))
  );
});

app.get("/guestbook/notifications/system", requireAuth, (req, res) => {
  const activeCharacter = getPreferredMenuCharacterForUser(req);
  if (String(req.query.mark_read || "").trim() === "1") {
    markAllSystemInboxNotificationsAsReadForUser(req.session.user.id);
  }

  return res.json({
    ok: true,
    notifications: buildSystemInboxListForUser(req.session.user.id, {
      activeCharacter
    }),
    payload: buildGuestbookNotificationPayloadForUser(req.session.user.id, {
      activeCharacter
    })
  });
});

app.get("/guestbook/notifications/open", requireAuth, (req, res) => {
  const latestNotification = getLatestVisibleGuestbookNotificationForUser(req.session.user.id);
  const notificationType = String(latestNotification?.notification_type || "").trim();

  if (!latestNotification) {
    setFlash(req, "error", "Du hast gerade keine neuen Benachrichtigungen.");
    return res.redirect("/dashboard");
  }

  if (
    notificationType === "festplay_application" ||
    notificationType === "festplay_approval"
  ) {
    markFestplayApplicationNotificationAsRead(latestNotification.id, req.session.user.id);

    if (notificationType === "festplay_approval") {
      const festplayName = String(latestNotification.festplay_name || "").trim();
      setFlash(
        req,
        "success",
        festplayName
          ? `System Administrator: Du wurdest für ${festplayName} freigeschaltet.`
          : "System Administrator: Du wurdest für ein Festspiel freigeschaltet."
      );
      return res.redirect(req.get("referer") || "/dashboard");
    }

    const festplay = getOwnedFestplayById(req.session.user.id, latestNotification.festplay_id);
    if (!festplay) {
      setFlash(req, "error", "Diese Festspiel-Bewerbung ist nicht mehr verfügbar.");
      return res.redirect("/dashboard");
    }

    const notificationServerId = normalizeServer(latestNotification.festplay_server_id || festplay.server_id);
    const preferredCharacterId = getPreferredCharacterIdFromSession(req, notificationServerId);
    let targetCharacter = null;
    const creatorCharacterId = Number(festplay.creator_character_id);

    if (Number.isInteger(creatorCharacterId) && creatorCharacterId > 0) {
      const creatorCharacter = getCharacterById(creatorCharacterId);
      if (
        creatorCharacter &&
        Number(creatorCharacter.user_id) === Number(req.session.user.id) &&
        normalizeServer(creatorCharacter.server_id) === notificationServerId
      ) {
        targetCharacter = creatorCharacter;
      }
    }

    if (!targetCharacter) {
      targetCharacter = getPreferredCharacterForUser(req.session.user.id, notificationServerId, preferredCharacterId);
    }

    if (!targetCharacter) {
      setFlash(req, "error", "Es wurde kein passender Charakter für dieses Festspiel gefunden.");
      return res.redirect("/dashboard");
    }

    rememberPreferredCharacter(req, targetCharacter);
    return res.redirect(
      `/characters/${targetCharacter.id}/festplays?selected_festplay=${festplay.id}&tab=bewerbungen#festplay-selected-editor`
    );
  }

  if (notificationType === BIRTHDAY_NOTIFICATION_TYPE) {
    markSystemNotificationAsRead(latestNotification.id, req.session.user.id);
    const birthdayGreetingText = buildBirthdayGreetingPlainTextForUser(req.session.user.id, {
      activeCharacter: getPreferredMenuCharacterForUser(req),
      notificationId: latestNotification.id,
      notificationTitle: latestNotification.title,
      notificationMessage: latestNotification.message
    });
    setFlash(
      req,
      "success",
      birthdayGreetingText || "Herzlichen Glückwunsch zum Geburtstag!"
    );
    return res.redirect(req.get("referer") || "/dashboard");
  }

  markGuestbookNotificationAsRead(latestNotification.id, req.session.user.id);

  const targetCharacterId = Number(latestNotification.character_id);
  const targetPageId = Number(latestNotification.guestbook_page_id);
  const targetEntryId = Number(latestNotification.guestbook_entry_id);
  const entryPosition =
    Number.isInteger(targetEntryId) && targetEntryId > 0
      ? Number(
          db
            .prepare(
              `SELECT COUNT(*) AS total
               FROM guestbook_entries ge
               JOIN guestbook_entries target ON target.id = ?
               WHERE ge.character_id = target.character_id
                 AND ge.guestbook_page_id = target.guestbook_page_id
                 AND (
                   ge.created_at > target.created_at
                   OR (ge.created_at = target.created_at AND ge.id >= target.id)
                 )`
            )
            .get(targetEntryId)?.total || 1
        )
      : 1;
  const targetEntriesPageNumber = Math.max(1, Math.ceil(entryPosition / GUESTBOOK_PAGE_SIZE));
  const pageQuery =
    Number.isInteger(targetPageId) && targetPageId > 0
      ? `?page_id=${targetPageId}${targetEntriesPageNumber > 1 ? `&entries_page=${targetEntriesPageNumber}` : ""}`
      : "";
  const anchor =
    Number.isInteger(targetEntryId) && targetEntryId > 0 ? `#guestbook-entry-${targetEntryId}` : "";

  return res.redirect(`/characters/${targetCharacterId}/guestbook${pageQuery}${anchor}`);
});

app.post("/guestbook/notifications/:notificationId/dismiss", requireAuth, (req, res) => {
  const notificationId = Number(req.params.notificationId);
  const notificationType = String(req.body.type || "").trim().toLowerCase();

  if (!Number.isInteger(notificationId) || notificationId < 1) {
    return res.status(404).json({ ok: false });
  }

  if (notificationType === "festplay_application" || notificationType === "festplay_approval") {
    markFestplayApplicationNotificationAsRead(notificationId, req.session.user.id);
  } else if (notificationType === BIRTHDAY_NOTIFICATION_TYPE) {
    markSystemNotificationAsRead(notificationId, req.session.user.id);
  } else {
    markGuestbookNotificationAsRead(notificationId, req.session.user.id);
  }

  return res.json({
    ok: true,
    payload: buildGuestbookNotificationPayloadForUser(req.session.user.id)
  });
});

app.post("/guestbook/notifications/:notificationId/delete", requireAuth, (req, res) => {
  const notificationId = Number(req.params.notificationId);
  const notificationType = String(req.body.type || "").trim().toLowerCase();

  if (!Number.isInteger(notificationId) || notificationId < 1) {
    return res.status(404).json({ ok: false });
  }

  if (!deleteSystemInboxNotification(notificationId, req.session.user.id, notificationType)) {
    return res.status(404).json({ ok: false });
  }

  const activeCharacter = getPreferredMenuCharacterForUser(req);
  return res.json({
    ok: true,
    notifications: buildSystemInboxListForUser(req.session.user.id, {
      activeCharacter
    }),
    payload: buildGuestbookNotificationPayloadForUser(req.session.user.id, {
      activeCharacter
    })
  });
});

app.post("/updates", requireAuth, requireSiteUpdateEditor, (req, res) => {
  const content = normalizeSiteUpdateContent(req.body.content);
  if (!content) {
    setFlash(req, "error", "Update darf nicht leer sein.");
    return res.redirect(req.get("referer") || "/");
  }

  const info = db
    .prepare(
      `INSERT INTO site_updates (author_id, author_name, content, updated_at)
       VALUES (?, ?, ?, strftime('%Y-%m-%d %H:%M:%f', 'now'))`
    )
    .run(req.session.user.id, req.session.user.display_name || req.session.user.username, content);

  const saved = getSiteUpdateById(info.lastInsertRowid);

  io.emit("site:update:create", saved);
  setFlash(req, "success", "Live-Update veröffentlicht.");
  return res.redirect(req.get("referer") || "/");
});

app.post("/updates/:id/edit", requireAuth, requireSiteUpdateEditor, (req, res) => {
  const updateId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(updateId) || updateId <= 0) {
    setFlash(req, "error", "Update wurde nicht gefunden.");
    return res.redirect(req.get("referer") || "/");
  }

  if (!getSiteUpdateById(updateId)) {
    setFlash(req, "error", "Update wurde nicht gefunden.");
    return res.redirect(req.get("referer") || "/");
  }

  const content = normalizeSiteUpdateContent(req.body.content);
  if (!content) {
    setFlash(req, "error", "Update darf nicht leer sein.");
    return res.redirect(req.get("referer") || "/");
  }

  db
    .prepare(
      "UPDATE site_updates SET content = ?, updated_at = strftime('%Y-%m-%d %H:%M:%f', 'now') WHERE id = ?"
    )
    .run(content, updateId);

  const saved = getSiteUpdateById(updateId);
  io.emit("site:update:update", saved);
  setFlash(req, "success", "Live-Update aktualisiert.");
  return res.redirect(req.get("referer") || "/");
});

app.post("/updates/:id/delete", requireAuth, requireSiteUpdateEditor, (req, res) => {
  const updateId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(updateId) || updateId <= 0) {
    setFlash(req, "error", "Update wurde nicht gefunden.");
    return res.redirect(req.get("referer") || "/");
  }

  const deleteInfo = db.prepare("DELETE FROM site_updates WHERE id = ?").run(updateId);
  if (deleteInfo.changes < 1) {
    setFlash(req, "error", "Update wurde nicht gefunden.");
    return res.redirect(req.get("referer") || "/");
  }

  io.emit("site:update:delete", { id: updateId });
  setFlash(req, "success", "Live-Update gelöscht.");
  return res.redirect(req.get("referer") || "/");
});

app.post("/site-content/hero", requireAuth, requireAdmin, (req, res) => {
  const heroTitle = normalizeHomeSectionTitle(req.body.title);
  const heroBody = normalizeHomeSectionBody(req.body.body);

  if (!heroTitle) {
    setFlash(req, "error", "Die Startseiten-Überschrift darf nicht leer sein.");
    return res.redirect(req.get("referer") || "/");
  }

  if (!heroBody) {
    setFlash(req, "error", "Der Startseitentext darf nicht leer sein.");
    return res.redirect(req.get("referer") || "/");
  }

  db.prepare(
    `UPDATE site_home_settings
     SET hero_title = ?, hero_body = ?
     WHERE id = 1`
  ).run(heroTitle, heroBody);

  const homeContent = getHomeContent();
  io.emit("site:home-content:update", homeContent);
  setFlash(req, "success", "Startseitenbereich aktualisiert.");
  return res.redirect(req.get("referer") || "/");
});

app.post("/site-content/updates-title", requireAuth, requireAdmin, (req, res) => {
  const updatesTitle = normalizeHomeSectionTitle(req.body.title);

  if (!updatesTitle) {
    setFlash(req, "error", "Die Live-Updates-Überschrift darf nicht leer sein.");
    return res.redirect(req.get("referer") || "/");
  }

  db.prepare(
    `UPDATE site_home_settings
     SET updates_title = ?
     WHERE id = 1`
  ).run(updatesTitle);

  const homeContent = getHomeContent();
  io.emit("site:home-content:update", homeContent);
  setFlash(req, "success", "Live-Updates-Überschrift aktualisiert.");
  return res.redirect(req.get("referer") || "/");
});

app.post("/settings/theme", (req, res) => {
  const theme = normalizeTheme(req.body.theme);

  if (req.session.user) {
    db.prepare("UPDATE users SET theme = ? WHERE id = ?").run(theme, req.session.user.id);
    req.session.user.theme = theme;
  } else {
    req.session.guest_theme = theme;
  }

  setThemeCookie(res, theme);

  const acceptsJson = req.accepts(["html", "json"]) === "json";
  const isAsyncRequest =
    String(req.get("x-requested-with") || "").toLowerCase() === "xmlhttprequest";

  if (acceptsJson || isAsyncRequest) {
    return res.json({ ok: true, theme });
  }

  const returnTo = String(req.body.return_to || "").trim();
  if (returnTo.startsWith("/") && !returnTo.startsWith("//")) {
    return res.redirect(returnTo);
  }

  const referer = req.get("referer");
  if (referer) {
    try {
      const url = new URL(referer);
      const target = `${url.pathname}${url.search}${url.hash}`;
      if (target.startsWith("/") && !target.startsWith("//")) {
        return res.redirect(target);
      }
    } catch (error) {
      // Ignore malformed referer and use fallback.
    }
  }

  return res.redirect("/");
});

function getSafeReturnTarget(req, fallback = "/") {
  const returnTo = String(req.body.return_to || "").trim();
  if (returnTo.startsWith("/") && !returnTo.startsWith("//")) {
    return returnTo;
  }

  const referer = req.get("referer");
  if (referer) {
    try {
      const url = new URL(referer);
      const target = `${url.pathname}${url.search}${url.hash}`;
      if (target.startsWith("/") && !target.startsWith("//")) {
        return target;
      }
    } catch (error) {
      // Ignore malformed referer and use fallback.
    }
  }

  return fallback;
}

function getDashboardOwnCharacters(userId) {
  const parsedUserId = Number(userId);
  if (!Number.isInteger(parsedUserId) || parsedUserId < 1) {
    return [];
  }

  return db
    .prepare(
      `SELECT c.id,
              c.name,
              c.server_id,
              c.is_public,
              c.updated_at,
              c.festplay_dashboard_mode,
              f.name AS festplay_name
       FROM characters c
       LEFT JOIN festplays f ON f.id = c.festplay_id
       WHERE c.user_id = ?
       ORDER BY c.updated_at DESC`
    )
    .all(parsedUserId)
    .map((character) => {
      const festplayHomeServerId = getCharacterFestplayHomeServer(character.id);
      return {
        ...character,
        festplay_home_server_id: festplayHomeServerId,
        festplay_home_server_label: getServerLabel(festplayHomeServerId)
      };
    });
}

function buildDashboardServerSection(server, ownCharacters, userId) {
  if (!server?.id) {
    return null;
  }

  const parsedUserId = Number(userId);
  const festplays = getDashboardFestplaysForUser(parsedUserId, server.id);
  const isFreeRp = server.id === "free-rp";
  return {
    ...server,
    dashboard_label: isFreeRp ? "Free - RP" : server.label,
    dashboard_area_title: isFreeRp ? "Rollenspiel - Free" : "Rollenspiel - Erotik",
    dashboard_area_description: isFreeRp
      ? "Hier liegen deine Charaktere und Festspiele für Free RP."
      : "Hier liegen deine Charaktere und Festspiele für den Erotik-Bereich.",
    dashboard_card_caption: isFreeRp
      ? "Charaktere und Festspiele für offene Geschichten und lockere Begegnungen."
      : "Charaktere und Festspiele für intensivere Szenen und feste Dynamiken.",
    festplays,
    characters: ownCharacters
      .filter((character) => {
        if (normalizeServer(character.server_id) !== server.id) {
          return false;
        }

        const dashboardPosition = getCharacterDashboardPlacement(
          character.server_id,
          character.festplay_home_server_id,
          character.festplay_dashboard_mode
        );

        return dashboardPosition === "main";
      })
      .map((character) => ({
        ...character,
        dashboard_position: getCharacterDashboardPlacement(
          character.server_id,
          character.festplay_home_server_id,
          character.festplay_dashboard_mode
        ),
        can_dashboard_move: true
      }))
  };
}

function ensureFestplayRoomForCharacter(
  userId,
  character,
  festplayId,
  roomName,
  roomDescription = "",
  roomTeaser = "",
  emailLogEnabled = 0
) {
  const parsedUserId = Number(userId);
  const parsedCharacterId = Number(character?.id);
  const parsedFestplayId = Number(festplayId);
  const normalizedServerId = normalizeServer(character?.server_id);
  const normalizedRoomName = normalizeRoomName(roomName);
  const normalizedRoomDescription = normalizeRoomDescription(roomDescription);
  const normalizedRoomTeaser = normalizeBbcodeInput(roomTeaser, 4000);
  const normalizedEmailLogEnabled = Number(emailLogEnabled) === 1 ? 1 : 0;

  if (
    !Number.isInteger(parsedUserId) ||
    parsedUserId < 1 ||
    !Number.isInteger(parsedCharacterId) ||
    parsedCharacterId < 1 ||
    !Number.isInteger(parsedFestplayId) ||
    parsedFestplayId < 1 ||
    normalizedRoomName.length < 2
  ) {
    return null;
  }

  if (!characterHasFestplayAccess(parsedFestplayId, parsedCharacterId)) {
    return null;
  }

  const roomNameKey = toRoomNameKey(normalizedRoomName);
  const existingRoom = findOwnedFestplayRoomByNameKey(
    parsedUserId,
    parsedFestplayId,
    roomNameKey,
    normalizedRoomDescription
  );
  if (existingRoom) {
    return {
      id: Number(existingRoom.id),
      name: String(existingRoom.name || normalizedRoomName).trim() || normalizedRoomName,
      created: false
    };
  }

  const supportsSortOrder = hasChatRoomColumn("sort_order");
  const nextSortOrder = supportsSortOrder
    ? Number(
        db
          .prepare(
            `SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_sort_order
               FROM chat_rooms
              WHERE festplay_id = ?
                AND COALESCE(is_festplay_chat, 0) = 1
                AND COALESCE(is_manual_festplay_room, 0) = 1`
          )
          .get(parsedFestplayId)?.next_sort_order || 1
      )
    : 0;

  const info = supportsSortOrder
    ? db.prepare(
        `INSERT INTO chat_rooms (
           character_id,
           created_by_user_id,
           name,
           name_key,
           description,
           teaser,
           email_log_enabled,
           server_id,
           sort_order,
           is_saved_room,
           is_festplay_chat,
           is_manual_festplay_room,
           festplay_id
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 1, ?)`
      ).run(
        parsedCharacterId,
        parsedUserId,
        normalizedRoomName,
        roomNameKey,
        normalizedRoomDescription,
        normalizedRoomTeaser,
        normalizedEmailLogEnabled,
        normalizedServerId,
        nextSortOrder,
        parsedFestplayId
      )
    : db.prepare(
        `INSERT INTO chat_rooms (
           character_id,
           created_by_user_id,
           name,
           name_key,
           description,
           teaser,
           email_log_enabled,
           server_id,
           is_saved_room,
           is_festplay_chat,
           is_manual_festplay_room,
           festplay_id
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 1, ?)`
      ).run(
        parsedCharacterId,
        parsedUserId,
        normalizedRoomName,
        roomNameKey,
        normalizedRoomDescription,
        normalizedRoomTeaser,
        normalizedEmailLogEnabled,
        normalizedServerId,
        parsedFestplayId
      );

  return {
    id: Number(info.lastInsertRowid),
    name: normalizedRoomName,
    created: true
  };
}

function reorderOwnedFestplayRooms(userId, festplayId, serverId, orderedRoomIds = []) {
  const parsedUserId = Number(userId);
  const parsedFestplayId = Number(festplayId);
  const normalizedServerId = normalizeServer(serverId);
  const normalizedRoomIds = Array.isArray(orderedRoomIds)
    ? orderedRoomIds
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0)
    : [];

  if (
    !Number.isInteger(parsedUserId) ||
    parsedUserId < 1 ||
    !Number.isInteger(parsedFestplayId) ||
    parsedFestplayId < 1 ||
    !normalizedServerId ||
    !normalizedRoomIds.length
  ) {
    return false;
  }

  const festplay = getFestplayById(parsedFestplayId);
  if (!festplay) {
    return false;
  }

  const availableRoomIds = getFestplayRoomsForUser(parsedUserId, parsedFestplayId)
    .filter((room) => {
      if (!room || typeof room !== "object" || room.is_saved_room !== true) {
        return false;
      }

      if (normalizeServer(room.server_id) !== normalizeServer(festplay.server_id || normalizedServerId)) {
        return false;
      }

      return !isLegacyAutoFestplayRoom(room, festplay);
    })
    .map((room) => Number(room.id))
    .filter((roomId) => Number.isInteger(roomId) && roomId > 0);

  if (!availableRoomIds.length || availableRoomIds.length !== normalizedRoomIds.length) {
    return false;
  }

  const availableSet = new Set(availableRoomIds);
  const normalizedSet = new Set(normalizedRoomIds);
  if (normalizedSet.size !== normalizedRoomIds.length) {
    return false;
  }

  for (const roomId of normalizedRoomIds) {
    if (!availableSet.has(roomId)) {
      return false;
    }
  }

  const orderedIds = normalizedRoomIds.concat(
    availableRoomIds.filter((roomId) => !normalizedSet.has(roomId))
  );

  const updateSortOrder = db.prepare(
    `UPDATE chat_rooms
        SET sort_order = ?
      WHERE id = ?
        AND festplay_id = ?
        AND COALESCE(is_festplay_chat, 0) = 1
        AND COALESCE(is_manual_festplay_room, 0) = 1`
  );

  db.transaction((roomIds) => {
    roomIds.forEach((roomId, index) => {
      updateSortOrder.run(index + 1, roomId, parsedFestplayId);
    });
  })(orderedIds);

  return true;
}

function ensureOwnedFestplayAreaRoomForCharacter(
  userId,
  character,
  festplayId,
  roomName,
  roomDescription = ""
) {
  const parsedUserId = Number(userId);
  const parsedCharacterId = Number(character?.id);
  const parsedFestplayId = Number(festplayId);
  const normalizedServerId = normalizeServer(character?.server_id);
  const normalizedRoomName = normalizeRoomName(roomName);
  const normalizedRoomDescription = normalizeRoomDescription(roomDescription);

  if (
    !Number.isInteger(parsedUserId) ||
    parsedUserId < 1 ||
    !Number.isInteger(parsedCharacterId) ||
    parsedCharacterId < 1 ||
    !Number.isInteger(parsedFestplayId) ||
    parsedFestplayId < 1 ||
    normalizedRoomName.length < 2
  ) {
    return null;
  }

  if (!characterHasFestplayAccess(parsedFestplayId, parsedCharacterId)) {
    return null;
  }

  const roomNameKey = toRoomNameKey(normalizedRoomName);
  const existingRoom =
    db
      .prepare(
        `SELECT id, name
           FROM chat_rooms
          WHERE festplay_id = ?
            AND created_by_user_id = ?
            AND name_key = ?
            AND COALESCE(is_saved_room, 0) = 1
            AND COALESCE(is_festplay_chat, 0) = 1
          LIMIT 1`
      )
      .get(parsedFestplayId, parsedUserId, roomNameKey) || null;
  if (existingRoom) {
    return {
      id: Number(existingRoom.id),
      name: String(existingRoom.name || normalizedRoomName).trim() || normalizedRoomName,
      created: false
    };
  }

  const info = db.prepare(
    `INSERT INTO chat_rooms (
       character_id,
       created_by_user_id,
       name,
       name_key,
       description,
       server_id,
       is_saved_room,
       is_festplay_chat,
       is_manual_festplay_room,
       festplay_id
     )
     VALUES (?, ?, ?, ?, ?, ?, 1, 1, 0, ?)`
  ).run(
    parsedCharacterId,
    parsedUserId,
    normalizedRoomName,
    roomNameKey,
    normalizedRoomDescription,
    normalizedServerId,
    parsedFestplayId
  );

  return {
    id: Number(info.lastInsertRowid),
    name: normalizedRoomName,
    created: true
  };
}

function getDashboardServerSections(userId) {
  const ownCharacters = getDashboardOwnCharacters(userId);
  const parsedUserId = Number(userId);
  return SERVER_OPTIONS
    .map((server) => buildDashboardServerSection(server, ownCharacters, parsedUserId))
    .filter(Boolean);
}

function getDashboardServerSection(userId, serverId) {
  const normalizedServerId = normalizeServer(serverId);
  const server = SERVER_OPTIONS.find((entry) => entry.id === normalizedServerId);
  if (!server) {
    return null;
  }

  const ownCharacters = getDashboardOwnCharacters(userId);
  return buildDashboardServerSection(server, ownCharacters, userId);
}

function getDashboardGuestbookExportCharacters(serverSection) {
  if (!serverSection) {
    return [];
  }

  const characters = [];
  const characterIds = new Set();
  const addCharacter = (character) => {
    const characterId = Number(character?.id);
    if (!Number.isInteger(characterId) || characterId < 1 || characterIds.has(characterId)) {
      return;
    }

    characterIds.add(characterId);
    characters.push({
      id: characterId,
      name: String(character.name || "").trim()
    });
  };

  (Array.isArray(serverSection.characters) ? serverSection.characters : []).forEach(addCharacter);
  (Array.isArray(serverSection.festplays) ? serverSection.festplays : []).forEach((festplay) => {
    (Array.isArray(festplay.characters) ? festplay.characters : []).forEach(addCharacter);
  });

  return characters;
}

function getDashboardLarpSection() {
  return {
    title: "LARP Bereich",
    description:
      "Hier entsteht später dein Bereich für LARP-Gruppen, Termine, Lagerideen und gemeinsame Abenteuer abseits der RP-Server.",
    note: "Noch nicht freigeschaltet."
  };
}

app.get("/dashboard", requireAuth, (req, res) => {
  const serverSections = getDashboardServerSections(req.session.user.id);
  const larpSection = getDashboardLarpSection();

  return res.render("dashboard", {
    title: "Serverliste",
    serverSections,
    larpSection
  });
});

app.get("/dashboard/areas/:serverId", requireAuth, (req, res) => {
  const serverSection = getDashboardServerSection(req.session.user.id, req.params.serverId);
  if (!serverSection) {
    return res.redirect("/dashboard");
  }

  const accountUser = getAccountUserById(req.session.user.id);
  const viewerAge = getAgeFromBirthDate(accountUser?.birth_date);
  const erpMoveAllowed = viewerAge !== null && viewerAge >= 18;

  return res.render("dashboard-area", {
    title: serverSection.dashboard_area_title || serverSection.dashboard_label || "Rollenspiel",
    serverSection,
    erpMoveAllowed
  });
});

app.post("/characters/:id/guestbook-code-email", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const character = getCharacterById(id);
  const returnTarget = getSafeReturnTarget(req, "/dashboard");

  if (!character) {
    return res.status(404).render("404", { title: "Nicht gefunden" });
  }

  if (character.user_id !== req.session.user.id) {
    return res.status(403).render("error", {
      title: "Kein Zugriff",
      message: "Nur der Besitzer darf diesen Gästebuch-Code per E-Mail anfordern."
    });
  }

  const accountUser = getAccountUserById(req.session.user.id);
  const email = normalizeEmail(accountUser?.email || "");
  if (!email) {
    setFlash(req, "error", "In deinem Account ist keine gültige E-Mail-Adresse hinterlegt.");
    return res.redirect(returnTarget);
  }

  const exportData = getGuestbookExportDataForCharacter(id);
  if (!exportData) {
    setFlash(req, "error", "Gästebuch-Code konnte nicht geladen werden.");
    return res.redirect(returnTarget);
  }

  try {
    const deliveryResult = await sendGuestbookCodeEmail({
      email,
      username: accountUser?.username || req.session.user.username,
      exportLabel: exportData.character.name,
      title: `Gästebuch-Code: ${exportData.character.name}`,
      exportText: buildGuestbookExportText([exportData]),
      attachmentBaseName: buildGuestbookExportAttachmentBaseName(exportData.character.name, new Date())
    });
    if (!deliveryResult?.delivered) {
      setFlash(req, "error", "Der E-Mail-Versand ist aktuell nicht verfügbar.");
      return res.redirect(returnTarget);
    }
    setFlash(req, "success", `Gästebuch-Code von ${exportData.character.name} wurde per E-Mail verschickt.`);
  } catch (error) {
    console.error(error);
    setFlash(
      req,
      "error",
      `Gästebuch-Code konnte nicht per E-Mail verschickt werden (${summarizeMailError(error)}).`
    );
  }

  return res.redirect(returnTarget);
});

app.post("/dashboard/areas/:serverId/guestbook-code-email", requireAuth, async (req, res) => {
  const serverSection = getDashboardServerSection(req.session.user.id, req.params.serverId);
  if (!serverSection) {
    return res.redirect("/dashboard");
  }

  const returnTarget = getSafeReturnTarget(req, `/dashboard/areas/${serverSection.id}`);
  const dashboardCharacters = getDashboardGuestbookExportCharacters(serverSection);
  if (!dashboardCharacters.length) {
    setFlash(req, "error", "Es sind keine eigenen Charaktere für diesen Bereich vorhanden.");
    return res.redirect(returnTarget);
  }

  const accountUser = getAccountUserById(req.session.user.id);
  const email = normalizeEmail(accountUser?.email || "");
  if (!email) {
    setFlash(req, "error", "In deinem Account ist keine gültige E-Mail-Adresse hinterlegt.");
    return res.redirect(returnTarget);
  }

  const exportItems = dashboardCharacters
    .map((character) => getGuestbookExportDataForCharacter(character.id))
    .filter((item) => item && Number(item.character?.user_id) === Number(req.session.user.id));

  if (!exportItems.length) {
    setFlash(req, "error", "Gästebuch-Codes konnten nicht geladen werden.");
    return res.redirect(returnTarget);
  }

  try {
    const deliveryResult = await sendGuestbookCodeEmail({
      email,
      username: accountUser?.username || req.session.user.username,
      exportLabel: `${serverSection.dashboard_label || serverSection.label} (${exportItems.length})`,
      title: `Gästebuch-Codes: ${serverSection.dashboard_label || serverSection.label}`,
      exportText: buildGuestbookExportText(exportItems),
      attachmentBaseName: buildGuestbookExportAttachmentBaseName(
        `${serverSection.dashboard_label || serverSection.label}-alle`,
        new Date()
      )
    });
    if (!deliveryResult?.delivered) {
      setFlash(req, "error", "Der E-Mail-Versand ist aktuell nicht verfügbar.");
      return res.redirect(returnTarget);
    }
    setFlash(
      req,
      "success",
      `Gästebuch-Codes von ${exportItems.length} Charakteren wurden per E-Mail verschickt.`
    );
  } catch (error) {
    console.error(error);
    setFlash(
      req,
      "error",
      `Gästebuch-Codes konnten nicht per E-Mail verschickt werden (${summarizeMailError(error)}).`
    );
  }

  return res.redirect(returnTarget);
});

app.get("/dashboard-legacy", requireAuth, (req, res) => {
  return res.redirect("/dashboard");
  const ownCharacters = db
    .prepare(
      `SELECT c.id, c.name, c.server_id, c.is_public, c.updated_at, f.name AS festplay_name
       FROM characters c
       LEFT JOIN festplays f ON f.id = c.festplay_id
       WHERE c.user_id = ?
       ORDER BY c.updated_at DESC`
    )
    .all(req.session.user.id);

  const serverSections = SERVER_OPTIONS.map((server) => {
    const festplays = getDashboardFestplaysForUser(req.session.user.id, server.id);
    const festplayCharacterIds = new Set();

    festplays.forEach((festplay) => {
      (festplay.characters || []).forEach((character) => {
        const characterId = Number(character.id);
        if (Number.isInteger(characterId) && characterId > 0) {
          festplayCharacterIds.add(characterId);
        }
      });
    });

    return {
      ...server,
      dashboard_label: server.id === "free-rp" ? "Free - RP" : server.label,
      dashboard_caption:
        server.id === "free-rp"
          ? "Für offene Geschichten, entspannte Begegnungen und neue Charakterideen."
          : "Für intensivere Szenen, klare Dynamik und laufende Verbindungen.",
      festplays,
      characters: ownCharacters.filter((character) => {
        const characterId = Number(character.id);
        return (
          normalizeServer(character.server_id) === server.id &&
          !festplayCharacterIds.has(characterId)
        );
      })
    };
  });

  const larpSection = {
    title: "Welten & Cons",
    description:
      "Hier entsteht dein Bereich für LARP-Gruppen, Termine, Lagerideen und gemeinsame Abenteuer abseits der RP-Server.",
    note: "In Planung für Kampagnen, Orga-Ideen und Charakterkonzepte."
  };

  return res.render("dashboard", {
    title: "Serverliste",
    serverSections,
    larpSection
  });
});

app.get("/members", requireAuth, (req, res) => {
  const currentUserId = Number(req.session.user?.id);
  const isAdmin = req.session.user?.is_admin === true;
  const visibleMembers = db
    .prepare(
      `SELECT c.id,
              c.user_id,
              c.name,
              c.server_id,
              c.is_public,
              c.updated_at,
              u.username AS owner_name
       FROM characters c
       JOIN users u ON u.id = c.user_id
       WHERE c.is_public = 1
          OR c.user_id = ?
          OR ? = 1
       ORDER BY lower(c.name) ASC, c.id ASC`
    )
    .all(currentUserId, isAdmin ? 1 : 0)
    .map((member) => ({
      ...member,
      server_label: getServerLabel(member.server_id),
      visibility_label:
        Number(member.user_id) === currentUserId
          ? "Dein Charakter"
          : Number(member.is_public) === 1
            ? "Öffentlich"
            : "Privat"
    }));

  const staffCharacterIds = new Set();
  const staffMembers = [];
  const staffUsers = db
    .prepare(
      `SELECT u.id,
              u.username,
              u.is_admin,
              u.is_moderator,
              u.admin_character_id,
              u.moderator_character_id,
              admin_character.name AS admin_character_name,
              admin_character.server_id AS admin_character_server_id,
              moderator_character.name AS moderator_character_name,
              moderator_character.server_id AS moderator_character_server_id
       FROM users u
       LEFT JOIN characters admin_character ON admin_character.id = u.admin_character_id
       LEFT JOIN characters moderator_character ON moderator_character.id = u.moderator_character_id
       WHERE u.is_admin = 1 OR u.is_moderator = 1
       ORDER BY lower(u.username) ASC, u.id ASC`
    )
    .all();

  staffUsers.forEach((user) => {
    const adminCharacterId = Number(user.admin_character_id);
    if (
      user.is_admin &&
      Number.isInteger(adminCharacterId) &&
      adminCharacterId > 0 &&
      String(user.admin_character_name || "").trim() &&
      !staffCharacterIds.has(adminCharacterId)
    ) {
      staffCharacterIds.add(adminCharacterId);
      staffMembers.push({
        id: adminCharacterId,
        name: user.admin_character_name,
        owner_name: user.username,
        server_id: normalizeServer(user.admin_character_server_id),
        server_label: getServerLabel(user.admin_character_server_id),
        visibility_label: "Rollencharakter",
        role_label: "Administrator (A)",
        role_style: "admin"
      });
    }

    const moderatorCharacterId = Number(user.moderator_character_id);
    if (
      user.is_moderator &&
      Number.isInteger(moderatorCharacterId) &&
      moderatorCharacterId > 0 &&
      String(user.moderator_character_name || "").trim() &&
      !staffCharacterIds.has(moderatorCharacterId)
    ) {
      staffCharacterIds.add(moderatorCharacterId);
      staffMembers.push({
        id: moderatorCharacterId,
        name: user.moderator_character_name,
        owner_name: user.username,
        server_id: normalizeServer(user.moderator_character_server_id),
        server_label: getServerLabel(user.moderator_character_server_id),
        visibility_label: "Rollencharakter",
        role_label: "Moderator",
        role_style: "moderator"
      });
    }
  });

  const regularMembers = visibleMembers.filter((member) => !staffCharacterIds.has(Number(member.id)));
  const rpMembers = regularMembers.filter((member) => normalizeServer(member.server_id) === "free-rp");
  const erpMembers = regularMembers.filter((member) => normalizeServer(member.server_id) === "erp");

  return res.render("members", {
    title: "Mitgliederliste",
    staffMembers,
    rpMembers,
    erpMembers,
    memberCount: staffMembers.length + rpMembers.length + erpMembers.length
  });
});

const HELP_TOPICS = [
  { slug: "bereich-charaktere", title: "Bereich & Charaktere" },
  { slug: "raeume-chat", title: "Räume & Chat" },
  { slug: "festspiele-rp-aushang", title: "Festspiele & RP-Aushang" },
  { slug: "gaestebuch-design-bbcode", title: "Gästebuch, Design & BBCode" },
  { slug: "backup", title: "Backup" },
  { slug: "staff-sicherheit", title: "Staff & Sicherheit" }
];
const HELP_TOPIC_ALIASES = {
  "charakter-anlegen": "bereich-charaktere",
  "eigene-raeume": "raeume-chat",
  "raumliste-raeume": "raeume-chat",
  "chat-fluestern": "raeume-chat",
  "chat-formatierung": "raeume-chat",
  "festspiele-anlegen": "festspiele-rp-aushang",
  "rp-aushang": "festspiele-rp-aushang",
  "admin-moderatorname": "staff-sicherheit",
  "auto-logoff": "staff-sicherheit"
};

const HELP_BBCODE_EXAMPLES = [
  { title: "Fett", code: "[b]Das ist fett[/b]" },
  { title: "Kursiv", code: "[i]Das ist kursiv[/i]" },
  { title: "Unterstrichen", code: "[u]Das ist unterstrichen[/u]" },
  { title: "Farbe", code: "[color=#6ec8ff]Blauer Text[/color]" },
  { title: "Gradient", code: "[0,0,ff7a7a,ffd36e]Leuchtender Titel[/gradient]" },
  { title: "Überschrift 1", code: "[h1]Überschrift 1[/h1]" },
  { title: "Überschrift 2", code: "[h2]Überschrift 2[/h2]" },
  { title: "Überschrift 3", code: "[h3]Überschrift 3[/h3]" },
  { title: "Zentriert", code: "[center]Zentrierter Text[/center]" },
  { title: "Rechts", code: "[right]Rechts formatierter Text[/right]" },
  { title: "Block", code: "[block]Blocktext[/block]" },
  {
    title: "Spalten",
    code: "[block][table][tr][td]Textspalte links[/td][td]Textspalte rechts[/td][/tr][/table][/block]"
  },
  { title: "Bild", code: "[img]https://i.ibb.co/zH50MX7w/Unbenannt-2.png[/img]" },
  {
    title: "Bild links",
    code: "[img float=left]https://i.ibb.co/zH50MX7w/Unbenannt-2.png[/img]Text neben Bild links"
  },
  {
    title: "Bild rechts",
    code: "[img float=right]https://i.ibb.co/zH50MX7w/Unbenannt-2.png[/img]Text neben Bild rechts"
  },
  { title: "Link", code: "[url=https://heldenhaftereisen.net]Startseite[/url]" },
  { title: "Zitat", code: "[quote]Ein stilles Zitat.[/quote]" },
  { title: "Code", code: "[code]Beispielcode[/code]" },
  { title: "Spoiler", code: "[spoiler=Mehr anzeigen]Versteckter Inhalt[/spoiler]" },
  { title: "Ab 18", code: "[ab18]Ab 18 Inhalt[/ab18]" },
  { title: "Linie", code: "[hr]" }
];

function decorateHelpBbcodeExamples() {
  return HELP_BBCODE_EXAMPLES.map((entry) => ({
    ...entry,
    preview_html:
      entry.title === "Linie"
        ? "<div class=\"help-example-line-text\" aria-hidden=\"true\">__________</div>"
        : renderGuestbookBbcode(entry.code)
  }));
}

app.get("/help", (req, res) => {
  return res.render("help", {
    title: "Hilfe",
    metaDescription:
      "Hier findest du die Hilfe von Heldenhafte Reisen mit Befehlen, Erklärungen und einer übersichtlichen Orientierung durch die Plattform.",
    helpTopics: HELP_TOPICS,
    helpTopic: null,
    helpBbcodeExamples: decorateHelpBbcodeExamples(),
    adminContactName: getPublicAdminCharacterName()
  });
});

app.get("/help/:slug", (req, res) => {
  const requestedSlug = String(req.params.slug || "").trim().toLowerCase();
  const resolvedSlug = HELP_TOPIC_ALIASES[requestedSlug] || requestedSlug;
  const helpTopic = HELP_TOPICS.find((topic) => topic.slug === resolvedSlug);
  if (!helpTopic) {
    return res.status(404).render("404", { title: "Nicht gefunden" });
  }

  return res.render("help", {
    title: `Hilfe: ${helpTopic.title}`,
    metaDescription:
      "Hier findest du die Hilfe von Heldenhafte Reisen mit Befehlen, Erklärungen und einer übersichtlichen Orientierung durch die Plattform.",
    helpTopics: HELP_TOPICS,
    helpTopic,
    helpBbcodeExamples: decorateHelpBbcodeExamples(),
    adminContactName: getPublicAdminCharacterName()
  });
});

function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildSitemapXml(urlEntries) {
  const urls = Array.isArray(urlEntries)
    ? urlEntries
        .filter((entry) => String(entry?.loc || "").trim())
        .map(
          (entry) => [
            "  <url>",
            `    <loc>${escapeXml(entry.loc)}</loc>`,
            entry.lastmod ? `    <lastmod>${escapeXml(entry.lastmod)}</lastmod>` : "",
            "  </url>"
          ]
            .filter(Boolean)
            .join("\n")
        )
    : [];

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    "</urlset>"
  ].join("\n");
}

app.get("/robots.txt", (req, res) => {
  const publicBaseUrl = getPublicBaseUrl(req) || getLegalMeta().appBaseUrl;
  const sitemapUrl = buildAbsoluteUrl(publicBaseUrl, "/sitemap.xml");
  const lines = [
    "User-agent: *",
    "Allow: /",
    "Disallow: /account",
    "Disallow: /admin",
    "Disallow: /auth",
    "Disallow: /character-backups",
    "Disallow: /chat",
    "Disallow: /dashboard",
    "Disallow: /logout",
    "Disallow: /members",
    "Disallow: /session",
    "Disallow: /staff",
    sitemapUrl ? `Sitemap: ${sitemapUrl}` : ""
  ].filter(Boolean);

  res.type("text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600");
  return res.send(lines.join("\n"));
});

app.get("/sitemap.xml", (req, res) => {
  const publicBaseUrl = getPublicBaseUrl(req) || getLegalMeta().appBaseUrl;
  const lastmod = new Date().toISOString();
  const entries = SEO_SITEMAP_PATHS.map((pathName) => ({
    loc: buildAbsoluteUrl(publicBaseUrl, pathName),
    lastmod
  })).filter((entry) => entry.loc);

  res.type("application/xml");
  res.setHeader("Cache-Control", "public, max-age=3600");
  return res.send(buildSitemapXml(entries));
});

app.get("/characters/new", requireAuth, (req, res) => {
  const festplays = getFestplays();
  const requestedServer = normalizeServer(req.query.server);
  res.render("character-form", {
    title: "Neuer Charakter",
    mode: "create",
    error: null,
    festplays,
    serverOptions: SERVER_OPTIONS,
    staffCharacterUsage: getStaffCharacterUsageForUser(req.session.user, null),
    character: {
      server_id: requestedServer,
      festplay_id: null,
      name: "",
      species: "",
      age: "",
      faceclaim: "",
      description: "",
      chat_text_color: "#AEE7B7",
      avatar_url: "",
      is_public: 1
    }
  });
});

app.post("/characters", requireAuth, (req, res) => {
  const payload = normalizeCharacterInput(req.body);
  const festplays = getFestplays();
  payload.festplay_id = null;

  if (!payload.name) {
    return res.status(400).render("character-form", {
      title: "Neuer Charakter",
      mode: "create",
      error: "Name ist erforderlich.",
      festplays,
      serverOptions: SERVER_OPTIONS,
      staffCharacterUsage: getStaffCharacterUsageForUser(req.session.user, null),
      character: payload
    });
  }

  if (!isAvatarUrlValid(payload.avatar_url)) {
    return res.status(400).render("character-form", {
      title: "Neuer Charakter",
      mode: "create",
      error: "Avatar-URL muss mit http:// oder https:// starten.",
      festplays,
      serverOptions: SERVER_OPTIONS,
      staffCharacterUsage: getStaffCharacterUsageForUser(req.session.user, null),
      character: payload
    });
  }

  if (findCharacterWithSameName(payload.name)) {
    return res.status(400).render("character-form", {
      title: "Neuer Charakter",
      mode: "create",
      error: "Dieser Charaktername ist bereits vergeben.",
      festplays,
      serverOptions: SERVER_OPTIONS,
      staffCharacterUsage: getStaffCharacterUsageForUser(req.session.user, null),
      character: payload
    });
  }

  const info = db
    .prepare(
      `INSERT INTO characters
       (user_id, server_id, festplay_id, name, species, age, faceclaim, description, avatar_url, is_public)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      req.session.user.id,
      payload.server_id,
      payload.festplay_id,
      payload.name,
      payload.species,
      payload.age,
      payload.faceclaim,
      payload.description,
      payload.avatar_url,
      payload.is_public
    );

  saveCharacterChatColor(Number(info.lastInsertRowid), payload.chat_text_color);

  emitHomeStatsUpdate();
  setFlash(req, "success", "Charakter gespeichert.");
  return res.redirect("/dashboard");
});

app.get("/characters/:id", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(404).render("404", { title: "Nicht gefunden" });
  }

  const character = getCharacterById(id);
  if (!character) {
    return res.status(404).render("404", { title: "Nicht gefunden" });
  }

  const isOwner = req.session.user.id === character.user_id;
  const isAdmin = req.session.user.is_admin === true;
  if (!canAccessCharacter(req.session.user.id, character.user_id, character.is_public, isAdmin)) {
    return res.status(403).render("error", {
      title: "Kein Zugriff",
      message: "Dieser Charakter ist privat."
    });
  }

  const rooms = dedupeSavedNonFestplayRooms(
    db
    .prepare(
        `SELECT r.id, r.name, r.name_key, r.description, r.teaser, r.is_locked, r.is_public_room, r.is_saved_room, r.server_id, r.created_at, r.created_by_user_id,
                COALESCE(owner_character.name, '') AS creator_name,
                 CASE
                  WHEN r.created_by_user_id = ? THEN 1
                  WHEN EXISTS (
                    SELECT 1
                    FROM chat_room_permissions crp
                   WHERE crp.room_id = r.id AND crp.user_id = ?
                 ) THEN 1
                 ELSE 0
                END AS can_manage_room
       FROM chat_rooms r
        LEFT JOIN characters owner_character ON owner_character.id = r.character_id
        WHERE r.server_id = ?
          AND COALESCE(r.festplay_id, 0) = 0
          AND COALESCE(r.is_festplay_chat, 0) = 0
          AND COALESCE(r.is_manual_festplay_room, 0) = 0
          AND COALESCE(r.is_festplay_side_chat, 0) = 0
        ORDER BY r.created_at ASC, r.id ASC`
    )
    .all(req.session.user.id, req.session.user.id, normalizeServer(character.server_id))
    .map((room) => ({
      ...room,
      is_locked: Number(room.is_locked) === 1,
      is_public_room: Number(room.is_public_room) === 1,
      is_saved_room: Number(room.is_saved_room) === 1,
      can_manage_room: Number(room.can_manage_room) === 1,
      can_enter:
        Number(room.is_locked) !== 1 ||
        Number(room.can_manage_room) === 1 ||
        hasRoomInviteAccess(req.session.user, room)
    })),
    character.server_id
  );
  const publicRooms = rooms.filter(
    (room) => room.is_public_room
  );
  const fantasyPublicRooms = publicRooms.filter((room) => {
    const curatedDefinition = getCuratedPublicRoomDefinition(room, character.server_id);
    return curatedDefinition?.section === "Fantasy Räume";
  });
  const defaultPublicRooms = publicRooms.filter((room) => {
    const curatedDefinition = getCuratedPublicRoomDefinition(room, character.server_id);
    return !curatedDefinition?.section;
  });
  const ownedRooms = isOwner
    ? rooms.filter(
        (room) =>
          room.is_saved_room &&
          (!room.is_public_room || isCuratedPublicRoom(room, character.server_id)) &&
          Number(room.created_by_user_id) === Number(req.session.user.id)
      ).map((room) => ({
        ...room,
        hide_owned_room_users: isCuratedPublicRoom(room, character.server_id)
      }))
    : [];
  const standardRooms = getStandardRoomsForServer(character.server_id);
  const standardRoomUsers = Object.fromEntries(
    standardRooms.map((room) => [room.id, getOnlineCharactersForChannel(null, character.server_id)])
  );
  const publicRoomUsers = Object.fromEntries(
    publicRooms.map((room) => [room.id, getOnlineCharactersForChannel(room.id, character.server_id)])
  );
  const roomUsers = Object.fromEntries(
    ownedRooms.map((room) => [room.id, getOnlineCharactersForChannel(room.id, character.server_id)])
  );
  const ownedFestplays = isOwner
    ? getOwnedFestplaysForUser(req.session.user.id, character.server_id)
    : [];
  const guestbookPages = ensureGuestbookPages(id);
  const requestedPageId = Number(req.query.page_id);
  const activeGuestbookPage =
    guestbookPages.find((page) => page.id === requestedPageId) || guestbookPages[0];
  const preferredViewerCharacterId = getPreferredCharacterIdFromSession(req, character.server_id);
  const currentHeaderCharacter = isOwner
    ? {
        id: character.id,
        user_id: character.user_id,
        name: character.name,
        server_id: character.server_id,
        chat_text_color: character.chat_text_color
      }
    : (getPreferredCharacterForUser(
        req.session.user.id,
        character.server_id,
        preferredViewerCharacterId
      ) || null);

  if (currentHeaderCharacter) {
    rememberPreferredCharacter(req, currentHeaderCharacter);
  }

  return res.render("character-view", {
    title: character.name,
    character,
    currentHeaderCharacter,
    characterCreatedAtLabel: formatGermanDate(character.created_at),
    isOwner,
    standardRooms,
    standardRoomUsers,
    publicRooms: defaultPublicRooms,
    fantasyPublicRooms,
    publicRoomUsers,
    roomUsers,
    ownedRooms,
    ownedFestplays,
    activeGuestbookPage
  });
});

app.get("/characters/:id/rooms/new", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(404).render("404", { title: "Nicht gefunden" });
  }

  const character = getCharacterById(id);
  if (!character) {
    return res.status(404).render("404", { title: "Nicht gefunden" });
  }

  if (character.user_id !== req.session.user.id) {
    return res.status(403).render("error", {
      title: "Kein Zugriff",
      message: "Nur der Besitzer darf mit diesem Charakter einen eigenen Raum erstellen."
    });
  }

  rememberPreferredCharacter(req, character);
  const ownedRooms = getSavedNonFestplayRoomsForUser(req.session.user.id, character.server_id);
  const selectedRoomId = Number(req.query.selected_room);
  const selectedRoom =
    ownedRooms.find((room) => Number(room.id) === selectedRoomId) || null;
  return res.render("room-create", {
    title: `Raum erstellen: ${character.name}`,
    character,
    ownedRooms,
    selectedRoom
  });
});

app.post("/characters/:id/rooms/reorder", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const fallbackReturnTarget = `/characters/${id}/rooms/new#room-create`;
  const isFetchRequest =
    String(req.get("x-requested-with") || "").trim().toLowerCase() === "fetch";

  if (!Number.isInteger(id) || id < 1) {
    if (isFetchRequest) {
      return res.status(404).json({ error: "Nicht gefunden" });
    }
    return res.status(404).render("404", { title: "Nicht gefunden" });
  }

  const character = getCharacterById(id);
  if (!character) {
    if (isFetchRequest) {
      return res.status(404).json({ error: "Nicht gefunden" });
    }
    return res.status(404).render("404", { title: "Nicht gefunden" });
  }

  if (character.user_id !== req.session.user.id) {
    if (isFetchRequest) {
      return res.status(403).json({ error: "Kein Zugriff" });
    }
    return res.status(403).render("error", {
      title: "Kein Zugriff",
      message: "Nur der Besitzer darf eigene Raeume sortieren."
    });
  }

  let orderedRoomIds = [];
  try {
    const rawRoomIds = req.body.room_ids;
    if (Array.isArray(rawRoomIds)) {
      orderedRoomIds = rawRoomIds;
    } else if (typeof rawRoomIds === "string") {
      const trimmedValue = rawRoomIds.trim();
      orderedRoomIds = trimmedValue.startsWith("[")
        ? JSON.parse(trimmedValue)
        : trimmedValue.split(",").map((entry) => entry.trim()).filter(Boolean);
    }
  } catch (error) {
    console.error("owned room reorder payload parse failed", {
      characterId: id,
      userId: req.session.user.id,
      error
    });
  }

  try {
    const updated = reorderOwnedRooms(req.session.user.id, character.server_id, orderedRoomIds);
    if (!updated) {
      if (isFetchRequest) {
        return res.status(400).json({ error: "Raumreihenfolge konnte nicht gespeichert werden." });
      }
      setFlash(req, "error", "Die Raumreihenfolge konnte nicht gespeichert werden.");
      return res.redirect(getSafeReturnTarget(req, fallbackReturnTarget));
    }
  } catch (error) {
    console.error("owned room reorder failed", {
      characterId: id,
      userId: req.session.user.id,
      roomIds: orderedRoomIds,
      error
    });
    if (isFetchRequest) {
      return res.status(500).json({ error: "Raumreihenfolge konnte nicht gespeichert werden." });
    }
    setFlash(req, "error", "Beim Sortieren der Raeume ist ein Fehler aufgetreten.");
    return res.redirect(getSafeReturnTarget(req, fallbackReturnTarget));
  }

  if (isFetchRequest) {
    return res.status(204).end();
  }

  return res.redirect(getSafeReturnTarget(req, fallbackReturnTarget));
});

app.get("/characters/:id/festplays/public", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(404).render("404", { title: "Nicht gefunden" });
  }

  const character = getCharacterById(id);
  if (!character) {
    return res.status(404).render("404", { title: "Nicht gefunden" });
  }

  if (character.user_id !== req.session.user.id) {
    return res.redirect(`/characters/${id}`);
  }

  rememberPreferredCharacter(req, character);

  return res.render("festplays-public", {
    title: `Festspiele: ${character.name}`,
    character,
    publicFestplays: getPublicFestplays(character.server_id)
  });
});

app.get("/characters/:id/festplays/public/:festplayId", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const festplayId = Number(req.params.festplayId);
  if (!Number.isInteger(id) || id < 1 || !Number.isInteger(festplayId) || festplayId < 1) {
    return res.status(404).render("404", { title: "Nicht gefunden" });
  }

  const character = getCharacterById(id);
  if (!character) {
    return res.status(404).render("404", { title: "Nicht gefunden" });
  }

  if (character.user_id !== req.session.user.id) {
    return res.redirect(`/characters/${id}`);
  }

  const festplay = getPublicFestplayById(festplayId, character.server_id);
  if (!festplay) {
    return res.status(404).render("404", { title: "Nicht gefunden" });
  }

  rememberPreferredCharacter(req, character);
  const hasAccess = characterHasFestplayAccess(festplay.id, character.id);
  const application = getFestplayApplicationForCharacter(festplay.id, character.id);
  const applicationState = hasAccess ? "approved" : application?.status || "none";

  return res.render("festplay-public-detail", {
    title: `Festspiel: ${festplay.name}`,
    character,
    festplay,
    applicationState,
    isOwnerFestplay: Number(festplay.created_by_user_id) === Number(req.session.user.id)
  });
});

app.get("/characters/:id/festplays/:festplayId/rooms", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const festplayId = Number(req.params.festplayId);
  if (!Number.isInteger(id) || id < 1 || !Number.isInteger(festplayId) || festplayId < 1) {
    return res.status(404).render("404", { title: "Nicht gefunden" });
  }

  const character = getCharacterById(id);
  if (!character) {
    return res.status(404).render("404", { title: "Nicht gefunden" });
  }

  if (character.user_id !== req.session.user.id) {
    return res.status(403).render("error", {
      title: "Kein Zugriff",
      message: "Nur der Besitzer darf diesen Festspiel-Chat mit dem Charakter betreten."
    });
  }

  const festplay = getFestplayById(festplayId);
  if (!festplay) {
    return res.status(404).render("404", { title: "Nicht gefunden" });
  }

  if (!characterHasFestplayAccess(festplayId, character.id)) {
    return res.status(403).render("error", {
      title: "Kein Zugriff",
      message: "Dieser Charakter ist nicht für dieses Festspiel freigeschaltet."
    });
  }

  const isFestplayOwner = Number(festplay.created_by_user_id) === Number(req.session.user.id);
  const fallbackReturnTarget = isFestplayOwner
    ? `/characters/${id}/festplays?selected_festplay=${festplayId}&tab=raeume#festplay-selected-editor`
    : `/characters/${id}/festplays?overview=andere&selected_festplay=${festplayId}#festplay-selected-editor`;

  try {
    rememberPreferredCharacter(req, character);
    const festplayRooms = getFestplayRoomsForUser(req.session.user.id, festplayId, {
      manualOnly: true
    }).filter((room) => {
      if (!room || typeof room !== "object" || room.is_saved_room !== true) {
        return false;
      }

      if (normalizeServer(room.server_id) !== normalizeServer(festplay.server_id || character.server_id)) {
        return false;
      }

      return !isLegacyAutoFestplayRoom(room, festplay);
    });
    const festplayRoomUsers = Object.fromEntries(
      festplayRooms.map((room) => [
        room.id,
        sanitizeOnlineCharacterEntries(
          getOnlineCharactersForChannel(
            room.id,
            normalizeServer(festplay.server_id || character.server_id)
          )
        )
      ])
    );
    const festplayChatEntries = getFestplaySideChatsForUser(req.session.user.id, festplayId)
      .filter((room) => {
        if (!room || typeof room !== "object") {
          return false;
        }

        if (normalizeServer(room.server_id) !== normalizeServer(festplay.server_id || character.server_id)) {
          return false;
        }
        return true;
      })
      .map((room) => {
        const activeUsers = sanitizeOnlineCharacterEntries(
          getOnlineCharactersForChannel(room.id, normalizeServer(character.server_id))
        );
        if (!activeUsers.length) {
          maybeRemoveEmptyRoom(room.id);
          return null;
        }

        return {
          room,
          activeUsers
        };
      })
      .filter(Boolean);
    const festplayChats = festplayChatEntries.map((entry) => entry.room);
    const festplayChatUsers = Object.fromEntries(
      festplayChatEntries.map((entry) => [entry.room.id, entry.activeUsers])
    );

    return res.render("festplay-rooms", {
      title: `Festspiel-Räume: ${festplay.name}`,
      character,
      festplay,
      festplayRooms,
      festplayRoomUsers,
      festplayChats,
      festplayChatUsers
    });
  } catch (error) {
    console.error("festplay rooms page failed", {
      festplayId,
      characterId: character.id,
      userId: req.session.user.id,
      error
    });
    setFlash(req, "error", "Die Festspiel-Raumseite konnte nicht geladen werden.");
    return res.redirect(getSafeReturnTarget(req, fallbackReturnTarget));
  }
});

app.get("/characters/:id/festplays/:festplayId/chat", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const festplayId = Number(req.params.festplayId);
  return res.redirect(`/characters/${id}/festplays/${festplayId}/rooms`);
});

app.post("/characters/:id/festplays/:festplayId/enter-room", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const festplayId = Number(req.params.festplayId);
  const fallbackReturnTarget = `/characters/${id}/festplays/${festplayId}/rooms`;
  if (!Number.isInteger(id) || id < 1 || !Number.isInteger(festplayId) || festplayId < 1) {
    return res.status(404).render("404", { title: "Nicht gefunden" });
  }

  const character = getCharacterById(id);
  if (!character) {
    return res.status(404).render("404", { title: "Nicht gefunden" });
  }

  if (character.user_id !== req.session.user.id) {
    return res.status(403).render("error", {
      title: "Kein Zugriff",
      message: "Nur der Besitzer darf mit diesem Charakter einen Festspiel-Raum anlegen."
    });
  }

  const festplay = getFestplayById(festplayId);
  if (!festplay) {
    return res.status(404).render("404", { title: "Nicht gefunden" });
  }

  if (!characterHasFestplayAccess(festplayId, character.id)) {
    return res.status(403).render("error", {
      title: "Kein Zugriff",
      message: "Dieser Charakter ist nicht für dieses Festspiel freigeschaltet."
    });
  }

  if (festplay.server_id && normalizeServer(character.server_id) !== festplay.server_id) {
    setFlash(req, "error", buildFestplayServerLockMessage(festplay));
    return res.redirect(getSafeReturnTarget(req, fallbackReturnTarget));
  }

  const roomName = normalizeRoomName(req.body.room_name);
  const roomDescription = normalizeRoomDescription(req.body.room_description || req.body.room_teaser);
  if (roomName.length < 2) {
    setFlash(req, "error", "Bitte einen gültigen Chatnamen eingeben.");
    return res.redirect(getSafeReturnTarget(req, fallbackReturnTarget));
  }

  try {
    rememberPreferredCharacter(req, character);
    const targetRoom = ensureFestplaySideChatRoom(
      req.session.user.id,
      character,
      festplayId,
      roomName,
      roomDescription
    );
    if (!targetRoom) {
      setFlash(req, "error", "Chat konnte nicht angelegt werden.");
      return res.redirect(getSafeReturnTarget(req, fallbackReturnTarget));
    }

    touchFestplayActivity(festplayId);
    return res.redirect(`/chat?room_id=${targetRoom.id}&character_id=${character.id}`);
  } catch (error) {
    console.error("festplay side chat creation failed", {
      festplayId,
      characterId: character.id,
      userId: req.session.user.id,
      error
    });
    setFlash(req, "error", "Beim Anlegen des normalen Raums ist ein Fehler aufgetreten.");
    return res.redirect(getSafeReturnTarget(req, fallbackReturnTarget));
  }
});

app.post("/characters/:id/festplays/:festplayId/rooms", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const festplayId = Number(req.params.festplayId);
  const character = getCharacterById(id);
  const festplay = getFestplayById(festplayId);

  if (!character || !festplay) {
    return res.status(404).render("404", { title: "Nicht gefunden" });
  }

  const canManageFestplayRooms = canCharacterManageFestplayRooms(
    festplay,
    character,
    req.session.user.id
  );
  const editorOverview = Number(festplay.created_by_user_id) === Number(req.session.user.id)
    ? "eigene"
    : "andere";
  const editorBaseTarget = buildFestplayEditorTarget(id, festplayId, {
    overview: editorOverview,
    tab: "raeume"
  });

  if (character.user_id !== req.session.user.id) {
    return res.status(403).render("error", {
      title: "Kein Zugriff",
      message: "Nur der Besitzer darf mit diesem Charakter Festspiel-Räume anlegen."
    });
  }

  if (!canManageFestplayRooms) {
    return res.status(403).render("error", {
      title: "Kein Zugriff",
      message: "Mit diesem Charakter dürfen für dieses Festspiel keine eigenen Räume angelegt werden."
    });
  }

  if (festplay.server_id && normalizeServer(character.server_id) !== festplay.server_id) {
    setFlash(req, "error", buildFestplayServerLockMessage(festplay));
    return res.redirect(getSafeReturnTarget(req, editorBaseTarget));
  }

  const roomName = normalizeRoomName(req.body.room_name);
  const roomDescription = normalizeRoomDescription(req.body.room_description);
  const roomTeaser = normalizeBbcodeInput(req.body.room_teaser, 4000);
  const emailLogEnabled = req.body.email_log_enabled ? 1 : 0;
  if (roomName.length < 2) {
    setFlash(req, "error", "Bitte einen gültigen Raumnamen eingeben.");
    return res.redirect(getSafeReturnTarget(req, editorBaseTarget));
  }

  try {
    rememberPreferredCharacter(req, character);
    const targetRoom = ensureFestplayRoomForCharacter(
      req.session.user.id,
      character,
      festplayId,
      roomName,
      roomDescription,
      roomTeaser,
      emailLogEnabled
    );
    if (!targetRoom) {
      setFlash(req, "error", "Festspiel-Raum konnte nicht angelegt werden.");
      return res.redirect(getSafeReturnTarget(req, editorBaseTarget));
    }

    const refreshedRoom = getRoomWithCharacter(targetRoom.id);
    if (emailLogEnabled === 1 && refreshedRoom) {
      try {
        maybeStartAutomaticRoomLog(targetRoom.id, refreshedRoom.server_id, refreshedRoom);
      } catch (logError) {
        console.error("festplay room log start failed", {
          festplayId,
          roomId: targetRoom.id,
          userId: req.session.user.id,
          error: logError
        });
        setFlash(req, "error", "Der Raum wurde angelegt, aber das Log konnte nicht sofort gestartet werden.");
      }
    }

    touchFestplayActivity(festplayId);
    return res.redirect(
      `/characters/${id}/festplays?selected_festplay=${festplayId}&tab=raeume#festplay-selected-editor`
    );
  } catch (error) {
    console.error("festplay room creation failed", {
      festplayId,
      userId: req.session.user.id,
      characterId: character.id,
      error
    });
    setFlash(req, "error", "Beim Anlegen des Festspiel-Raums ist ein Fehler aufgetreten.");
    return res.redirect(getSafeReturnTarget(req, editorBaseTarget));
  }
});

app.post("/characters/:id/festplays/:festplayId/rooms/reorder", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const festplayId = Number(req.params.festplayId);
  const fallbackReturnTarget =
    `/characters/${id}/festplays?selected_festplay=${festplayId}&tab=raeume#festplay-selected-editor`;
  const isFetchRequest =
    String(req.get("x-requested-with") || "").trim().toLowerCase() === "fetch";

  if (!Number.isInteger(id) || id < 1 || !Number.isInteger(festplayId) || festplayId < 1) {
    if (isFetchRequest) {
      return res.status(404).json({ error: "Nicht gefunden" });
    }
    return res.status(404).render("404", { title: "Nicht gefunden" });
  }

  const character = getCharacterById(id);
  const festplay = getOwnedFestplayById(req.session.user.id, festplayId);
  if (!character || !festplay) {
    if (isFetchRequest) {
      return res.status(404).json({ error: "Nicht gefunden" });
    }
    return res.status(404).render("404", { title: "Nicht gefunden" });
  }

  if (character.user_id !== req.session.user.id) {
    if (isFetchRequest) {
      return res.status(403).json({ error: "Kein Zugriff" });
    }
    return res.status(403).render("error", {
      title: "Kein Zugriff",
      message: "Nur der Besitzer darf eigene Festspiel-Raeume sortieren."
    });
  }

  if (festplay.server_id && normalizeServer(character.server_id) !== festplay.server_id) {
    if (isFetchRequest) {
      return res.status(403).json({ error: buildFestplayServerLockMessage(festplay) });
    }
    setFlash(req, "error", buildFestplayServerLockMessage(festplay));
    return res.redirect(getSafeReturnTarget(req, fallbackReturnTarget));
  }

  let orderedRoomIds = [];
  try {
    const rawRoomIds = req.body.room_ids;
    if (Array.isArray(rawRoomIds)) {
      orderedRoomIds = rawRoomIds;
    } else if (typeof rawRoomIds === "string") {
      const trimmedValue = rawRoomIds.trim();
      orderedRoomIds = trimmedValue.startsWith("[")
        ? JSON.parse(trimmedValue)
        : trimmedValue.split(",").map((entry) => entry.trim()).filter(Boolean);
    }
  } catch (error) {
    console.error("festplay room reorder payload parse failed", {
      festplayId,
      userId: req.session.user.id,
      error
    });
  }

  try {
    const updated = reorderOwnedFestplayRooms(
      req.session.user.id,
      festplayId,
      character.server_id,
      orderedRoomIds
    );
    if (!updated) {
      if (isFetchRequest) {
        return res.status(400).json({ error: "Raumreihenfolge konnte nicht gespeichert werden." });
      }
      setFlash(req, "error", "Die Raumreihenfolge konnte nicht gespeichert werden.");
      return res.redirect(getSafeReturnTarget(req, fallbackReturnTarget));
    }
    touchFestplayActivity(festplayId);
  } catch (error) {
    console.error("festplay room reorder failed", {
      festplayId,
      userId: req.session.user.id,
      roomIds: orderedRoomIds,
      error
    });
    if (isFetchRequest) {
      return res.status(500).json({ error: "Raumreihenfolge konnte nicht gespeichert werden." });
    }
    setFlash(req, "error", "Beim Sortieren der Festspiel-Raeume ist ein Fehler aufgetreten.");
    return res.redirect(getSafeReturnTarget(req, fallbackReturnTarget));
  }

  if (isFetchRequest) {
    return res.status(204).end();
  }

  return res.redirect(getSafeReturnTarget(req, fallbackReturnTarget));
});

app.post("/characters/:id/festplays/:festplayId/rooms/:roomId/update", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const festplayId = Number(req.params.festplayId);
  const roomId = Number(req.params.roomId);
  if (
    !Number.isInteger(id) || id < 1 ||
    !Number.isInteger(festplayId) || festplayId < 1 ||
    !Number.isInteger(roomId) || roomId < 1
  ) {
    return res.status(404).render("404", { title: "Nicht gefunden" });
  }

  const character = getCharacterById(id);
  if (!character) {
    return res.status(404).render("404", { title: "Nicht gefunden" });
  }

  if (character.user_id !== req.session.user.id) {
    return res.status(403).render("error", {
      title: "Kein Zugriff",
      message: "Nur der Besitzer darf eigene Festspiel-Raeume bearbeiten."
    });
  }

  const festplay = getFestplayById(festplayId);
  if (!festplay) {
    setFlash(req, "error", "Dieses Festspiel konnte nicht gefunden werden.");
    return res.redirect(`/characters/${id}/festplays`);
  }

  const canManageFestplayRooms = canCharacterManageFestplayRooms(
    festplay,
    character,
    req.session.user.id
  );
  const editorOverview = Number(festplay.created_by_user_id) === Number(req.session.user.id)
    ? "eigene"
    : "andere";
  const editorBaseTarget = buildFestplayEditorTarget(id, festplayId, {
    overview: editorOverview,
    tab: "raeume"
  });
  const editorReturnTarget = buildFestplayEditorTarget(id, festplayId, {
    overview: editorOverview,
    tab: "raeume",
    roomId
  });

  if (!canManageFestplayRooms) {
    return res.status(403).render("error", {
      title: "Kein Zugriff",
      message: "Mit diesem Charakter dürfen für dieses Festspiel keine eigenen Räume bearbeitet werden."
    });
  }

  if (festplay.server_id && normalizeServer(character.server_id) !== festplay.server_id) {
    setFlash(req, "error", buildFestplayServerLockMessage(festplay));
    return res.redirect(getSafeReturnTarget(req, editorReturnTarget));
  }

  const room = db
    .prepare(
      `SELECT id, server_id, festplay_id, created_by_user_id, name, description, teaser, image_url, email_log_enabled, is_locked, is_public_room, is_saved_room
         FROM chat_rooms
        WHERE id = ?
          AND festplay_id = ?
          AND COALESCE(is_festplay_chat, 0) = 1
          AND COALESCE(is_manual_festplay_room, 0) = 1`
    )
    .get(roomId, festplayId);

  if (
    !room ||
    Number(room.created_by_user_id) !== Number(req.session.user.id) ||
    Number(room.is_saved_room) !== 1
  ) {
    setFlash(req, "error", "Dieser Festspiel-Raum konnte nicht gefunden werden.");
    return res.redirect(getSafeReturnTarget(req, editorReturnTarget));
  }

  const roomName = normalizeRoomName(req.body.room_name);
  const roomDescription = normalizeRoomDescription(req.body.room_description);
  const roomTeaser = normalizeBbcodeInput(req.body.room_teaser, 4000);
  const roomImageUrl = "";
  const emailLogEnabled = req.body.email_log_enabled ? 1 : 0;
  const isLocked = 0;

  if (req.body.delete_room) {
    if (getSocketsInChannel(roomId, room.server_id).length > 0) {
      setFlash(req, "error", "Der Raum kann erst gelöscht werden, wenn niemand mehr darin ist.");
      return res.redirect(getSafeReturnTarget(req, editorReturnTarget));
    }

    clearPendingRoomDeletion(roomId);
    await finalizeRoomLog(roomId, room.server_id, { reason: "manual" });
    touchFestplayActivity(festplayId);
    deleteRoomData(roomId);
    io.emit("chat:room-removed", { room_id: roomId });
    setFlash(req, "success", "Festspiel-Raum gelöscht.");
    return res.redirect(getSafeReturnTarget(req, editorBaseTarget));
  }

  if (roomName.length < 2) {
    setFlash(req, "error", "Bitte einen gültigen Raumnamen eingeben.");
    return res.redirect(getSafeReturnTarget(req, editorReturnTarget));
  }

  const conflictingRoom = findOwnedFestplayRoomByNameKey(
    req.session.user.id,
    festplayId,
    toRoomNameKey(roomName),
    roomDescription
  );
  if (conflictingRoom && Number(conflictingRoom.id) !== roomId) {
    setFlash(req, "error", "Du hast in diesem Festspiel bereits einen Raum mit diesem Namen.");
    return res.redirect(getSafeReturnTarget(req, editorReturnTarget));
  }

  db.prepare(
    `UPDATE chat_rooms
        SET name = ?,
            name_key = ?,
            description = ?,
            teaser = ?,
            image_url = ?,
            email_log_enabled = ?,
            is_locked = ?
      WHERE id = ?`
  ).run(
    roomName,
    toRoomNameKey(roomName),
    roomDescription,
    roomTeaser,
    roomImageUrl,
    emailLogEnabled,
    isLocked,
    roomId
  );
  touchFestplayActivity(festplayId);

  const refreshedRoom = getRoomWithCharacter(roomId);
  if (emailLogEnabled === 1 && Number(room.email_log_enabled) !== 1) {
    maybeStartAutomaticRoomLog(roomId, room.server_id, refreshedRoom);
  } else if (emailLogEnabled !== 1 && Number(room.email_log_enabled) === 1 && getActiveRoomLog(roomId, room.server_id)) {
    emitSystemChatMessage(roomId, room.server_id, "Log wurde deaktiviert.");
    await finalizeRoomLog(roomId, room.server_id, { reason: "manual" });
  }

  emitRoomStateUpdate(roomId, room.server_id, refreshedRoom);
  return res.redirect(getSafeReturnTarget(req, editorReturnTarget));
});

app.post("/characters/:id/festplays/:festplayId/rooms/:roomId/delete", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const festplayId = Number(req.params.festplayId);
  const roomId = Number(req.params.roomId);
  if (
    !Number.isInteger(id) || id < 1 ||
    !Number.isInteger(festplayId) || festplayId < 1 ||
    !Number.isInteger(roomId) || roomId < 1
  ) {
    return res.status(404).render("404", { title: "Nicht gefunden" });
  }

  const character = getCharacterById(id);
  if (!character) {
    return res.status(404).render("404", { title: "Nicht gefunden" });
  }

  if (character.user_id !== req.session.user.id) {
    return res.status(403).render("error", {
      title: "Kein Zugriff",
      message: "Nur der Besitzer darf eigene Festspiel-Räume löschen."
    });
  }

  const festplay = getFestplayById(festplayId);
  if (!festplay) {
    setFlash(req, "error", "Dieses Festspiel konnte nicht gefunden werden.");
    return res.redirect(`/characters/${id}/festplays`);
  }

  const canManageFestplayRooms = canCharacterManageFestplayRooms(
    festplay,
    character,
    req.session.user.id
  );
  const editorOverview = Number(festplay.created_by_user_id) === Number(req.session.user.id)
    ? "eigene"
    : "andere";
  const editorBaseTarget = buildFestplayEditorTarget(id, festplayId, {
    overview: editorOverview,
    tab: "raeume"
  });

  if (!canManageFestplayRooms) {
    return res.status(403).render("error", {
      title: "Kein Zugriff",
      message: "Mit diesem Charakter dürfen für dieses Festspiel keine eigenen Räume gelöscht werden."
    });
  }

  if (festplay.server_id && normalizeServer(character.server_id) !== festplay.server_id) {
    setFlash(req, "error", buildFestplayServerLockMessage(festplay));
    return res.redirect(getSafeReturnTarget(req, editorBaseTarget));
  }

  const room = db
    .prepare(
      `SELECT id, name, server_id, festplay_id, created_by_user_id, is_public_room, is_saved_room
         FROM chat_rooms
        WHERE id = ?
          AND festplay_id = ?
          AND COALESCE(is_festplay_chat, 0) = 1
          AND COALESCE(is_manual_festplay_room, 0) = 1`
    )
    .get(roomId, festplayId);

  if (
    !room ||
    Number(room.created_by_user_id) !== Number(req.session.user.id) ||
    Number(room.is_saved_room) !== 1
  ) {
    setFlash(req, "error", "Dieser Festspiel-Raum konnte nicht gefunden werden.");
    return res.redirect(getSafeReturnTarget(req, editorBaseTarget));
  }

  if (getSocketsInChannel(roomId, room.server_id).length > 0) {
    setFlash(req, "error", "Der Raum kann erst gelöscht werden, wenn niemand mehr darin ist.");
    return res.redirect(getSafeReturnTarget(req, editorBaseTarget));
  }

  clearPendingRoomDeletion(roomId);
  await finalizeRoomLog(roomId, room.server_id, { reason: "manual" });
  touchFestplayActivity(festplayId);
  deleteRoomData(roomId);
  io.emit("chat:room-removed", { room_id: roomId });
  setFlash(req, "success", "Festspiel-Raum gelöscht.");
  return res.redirect(getSafeReturnTarget(req, editorBaseTarget));
});

app.post("/characters/:id/festplays/public/:festplayId/apply", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const festplayId = Number(req.params.festplayId);
  if (!Number.isInteger(id) || id < 1 || !Number.isInteger(festplayId) || festplayId < 1) {
    return res.status(404).render("404", { title: "Nicht gefunden" });
  }

  const character = getCharacterById(id);
  if (!character) {
    return res.status(404).render("404", { title: "Nicht gefunden" });
  }

  if (character.user_id !== req.session.user.id) {
    return res.redirect(`/characters/${id}`);
  }

  const festplay = getPublicFestplayById(festplayId, character.server_id);
  if (!festplay) {
    setFlash(req, "error", "Dieses Festspiel ist nicht öffentlich sichtbar.");
    return res.redirect(`/characters/${id}/festplays/public`);
  }

  if (festplay.server_id && normalizeServer(character.server_id) !== festplay.server_id) {
    setFlash(req, "error", buildFestplayServerLockMessage(festplay));
    return res.redirect(`/characters/${id}/festplays/public/${festplayId}`);
  }

  if (Number(festplay.created_by_user_id) === Number(req.session.user.id)) {
    return res.redirect(`/characters/${id}/festplays/public/${festplayId}`);
  }

  if (!characterHasFestplayAccess(festplayId, character.id)) {
    const applicationId = submitFestplayApplication(festplayId, character.id, req.session.user.id);
    const festplayOwnerUserId = Number(festplay.created_by_user_id);
    if (
      Number.isInteger(applicationId) &&
      applicationId > 0 &&
      Number.isInteger(festplayOwnerUserId) &&
      festplayOwnerUserId > 0 &&
      festplayOwnerUserId !== Number(req.session.user.id)
    ) {
      createFestplayApplicationNotification(festplayOwnerUserId, festplayId, applicationId);
    }
    touchFestplayActivity(festplayId);
  }

  return res.redirect(`/characters/${id}/festplays/public/${festplayId}`);
});

app.post("/characters/:id/festplays/public/:festplayId/withdraw", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const festplayId = Number(req.params.festplayId);
  if (!Number.isInteger(id) || id < 1 || !Number.isInteger(festplayId) || festplayId < 1) {
    return res.status(404).render("404", { title: "Nicht gefunden" });
  }

  const character = getCharacterById(id);
  if (!character) {
    return res.status(404).render("404", { title: "Nicht gefunden" });
  }

  if (character.user_id !== req.session.user.id) {
    return res.redirect(`/characters/${id}`);
  }

  const festplay = getPublicFestplayById(festplayId, character.server_id);
  if (!festplay) {
    setFlash(req, "error", "Dieses Festspiel ist nicht öffentlich sichtbar.");
    return res.redirect(`/characters/${id}/festplays/public`);
  }

  const application = getFestplayApplicationForCharacter(festplayId, character.id);
  if (!application || String(application.status || "").trim().toLowerCase() !== "pending") {
    setFlash(req, "error", "Es gibt gerade keine offene Bewerbung zum Zurückziehen.");
    return res.redirect(`/characters/${id}/festplays/public/${festplayId}`);
  }

  db.prepare(
    `UPDATE festplay_applications
     SET status = 'withdrawn',
         approved_by_user_id = NULL,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?
       AND festplay_id = ?
     AND applicant_user_id = ?`
  ).run(application.id, festplayId, req.session.user.id);

  deleteFestplayApplicationNotificationsForApplication(application.id);
  touchFestplayActivity(festplayId);

  return res.redirect(`/characters/${id}/festplays/public/${festplayId}`);
});

app.get("/characters/:id/festplays", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(404).render("404", { title: "Nicht gefunden" });
  }

  const character = getCharacterById(id);
  if (!character) {
    return res.status(404).render("404", { title: "Nicht gefunden" });
  }

  if (character.user_id !== req.session.user.id) {
    return res.redirect(`/characters/${id}`);
  }

  const selectedFestplayId = Number(req.query.selected_festplay);
  let ownedFestplays = [];
  let otherFestplays = [];
  let selectedFestplay = null;
  let selectedFestplayMode = null;
  let selectedFestplayHasRoomRights = false;
  let festplayPermissionEntries = [];
  let festplayApplications = [];
  let festplayPlayerOverview = null;
  let festplayRooms = [];
  let selectedFestplayRoom = null;
  let selectedFestplayRoomPreviewHtml = "";
  const requestedFestplayOverviewTab =
    String(req.query.overview || "").trim().toLowerCase() === "andere"
      ? "andere"
      : "eigene";
  const requestedFestplayTab = String(req.query.tab || "").trim().toLowerCase();
  let activeFestplayTab =
    requestedFestplayTab === "bewerbungen"
      ? "bewerbungen"
      : requestedFestplayTab === "raeume"
        ? "raeume"
        : "allgemein";
  let activeFestplayOverviewTab = requestedFestplayOverviewTab;

  try {
    rememberPreferredCharacter(req, character);
    ownedFestplays = getOwnedFestplaysForUser(req.session.user.id, character.server_id);
    if (
      Number.isInteger(selectedFestplayId) &&
      selectedFestplayId > 0 &&
      ownedFestplays.some((festplay) => Number(festplay.id) === selectedFestplayId)
    ) {
      syncFestplayCreatorCharacter(selectedFestplayId, req.session.user.id, character.id);
      ownedFestplays = getOwnedFestplaysForUser(req.session.user.id, character.server_id);
    }

    otherFestplays = getOtherFestplaysForUser(req.session.user.id, character.server_id);
    const selectedOwnedFestplay =
      ownedFestplays.find((festplay) => Number(festplay.id) === selectedFestplayId) || null;
    const selectedOtherFestplay =
      selectedOwnedFestplay
        ? null
        : otherFestplays.find((festplay) => Number(festplay.id) === selectedFestplayId) || null;
    selectedFestplay = selectedOwnedFestplay || selectedOtherFestplay || null;
    selectedFestplayMode = selectedOwnedFestplay
      ? "owned"
      : selectedOtherFestplay
        ? "other"
        : null;
    selectedFestplayHasRoomRights =
      selectedFestplayMode === "other" && selectedFestplay
        ? characterHasFestplayRoomRights(selectedFestplay.id, character.id, req.session.user.id)
        : false;
    if (selectedFestplayMode === "other" && activeFestplayTab === "raeume" && !selectedFestplayHasRoomRights) {
      activeFestplayTab = "allgemein";
    }
    activeFestplayOverviewTab = selectedFestplayMode === "other"
      ? "andere"
      : selectedFestplayMode === "owned"
        ? "eigene"
        : requestedFestplayOverviewTab;

    festplayPermissionEntries = selectedFestplayMode === "owned"
      ? getFestplayPermissionEntries(selectedFestplay.id, character.server_id)
      : [];
    festplayApplications = selectedFestplayMode === "owned"
      ? getPendingFestplayApplications(selectedFestplay.id, character.server_id)
      : [];
    festplayPlayerOverview = selectedFestplay
      ? getFestplayPlayerOverview(selectedFestplay.id, character.server_id)
      : null;
    festplayRooms =
      selectedFestplay &&
      (selectedFestplayMode === "owned" || selectedFestplayHasRoomRights)
      ? getFestplayRoomsForUser(req.session.user.id, selectedFestplay.id).filter((room) => {
          if (!room || typeof room !== "object" || room.is_saved_room !== true) {
            return false;
          }

          if (
            normalizeServer(room.server_id) !==
            normalizeServer(selectedFestplay.server_id || character.server_id)
          ) {
            return false;
          }

          return !isLegacyAutoFestplayRoom(room, selectedFestplay);
        })
      : [];

    const selectedFestplayRoomId = Number(req.query.selected_room);
    selectedFestplayRoom =
      (selectedFestplayMode === "owned" || selectedFestplayHasRoomRights) &&
      activeFestplayTab === "raeume"
        ? festplayRooms.find((room) => Number(room.id) === selectedFestplayRoomId) || null
        : null;
    selectedFestplayRoomPreviewHtml =
      selectedFestplayRoom?.teaser ? renderGuestbookBbcode(selectedFestplayRoom.teaser) : "";
    return res.render("festplay-create", {
      title: `Festspiele erstellen: ${character.name}`,
      character,
      ownedFestplays,
      otherFestplays,
      selectedFestplay,
      selectedFestplayMode,
      activeFestplayOverviewTab,
      activeFestplayTab,
      selectedFestplayHasRoomRights,
      festplayRooms,
      festplayRoomSortingEnabled:
        hasChatRoomColumn("sort_order") && selectedFestplayMode === "owned",
      selectedFestplayRoom,
      selectedFestplayRoomPreviewHtml,
      festplayPermissionEntries,
      festplayApplications,
      festplayPlayerOverview
    });
  } catch (error) {
    console.error("festplay editor page failed", {
      characterId: character.id,
      userId: req.session.user.id,
      selectedFestplayId,
      error
    });
    setFlash(req, "error", "Die Festspiel-Verwaltung konnte nicht geladen werden.");
    return res.redirect(`/characters/${id}`);
  }
});

app.post("/characters/:id/festplays", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(404).render("404", { title: "Nicht gefunden" });
  }

  const character = getCharacterById(id);
  if (!character) {
    return res.status(404).render("404", { title: "Nicht gefunden" });
  }

  if (character.user_id !== req.session.user.id) {
    return res.redirect(`/characters/${id}`);
  }

  const festplayName = normalizeFestplayName(req.body.festplay_name);
  const isPublic = String(req.body.is_public || "").trim() === "1";
  const shortDescription = "";
  const longDescription = normalizeBbcodeInput(req.body.long_description, 8000);
  if (!festplayName) {
    setFlash(req, "error", "Bitte einen gültigen Festspielnamen eingeben.");
    return res.redirect(`/characters/${id}/festplays`);
  }

  if (findFestplayByName(festplayName)) {
    setFlash(req, "error", "Dieses Festspiel existiert bereits.");
    return res.redirect(`/characters/${id}/festplays`);
  }

  try {
    const createdFestplay = db.prepare(
      `INSERT INTO festplays (name, is_public, created_by_user_id, creator_character_id, server_id, last_activity_at)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
    ).run(festplayName, isPublic ? 1 : 0, req.session.user.id, id, normalizeServer(character.server_id));
    const createdFestplayId = Number(createdFestplay.lastInsertRowid);
    if (Number.isInteger(createdFestplayId) && createdFestplayId > 0) {
      syncFestplayCreatorCharacter(createdFestplayId, req.session.user.id, id);
      return res.redirect(`/characters/${id}/festplays?selected_festplay=${createdFestplayId}#festplay-selected-editor`);
    }
  } catch (error) {
    console.error("festplay creation failed", {
      characterId: character.id,
      userId: req.session.user.id,
      festplayName,
      error
    });
    setFlash(req, "error", "Beim Anlegen des Festspiels ist ein Fehler aufgetreten.");
    return res.redirect(`/characters/${id}/festplays`);
  }

  return res.redirect(`/characters/${id}/festplays`);
});

app.post("/characters/:id/festplays/:festplayId/permissions", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const festplayId = Number(req.params.festplayId);
  if (!Number.isInteger(id) || id < 1 || !Number.isInteger(festplayId) || festplayId < 1) {
    return res.status(404).render("404", { title: "Nicht gefunden" });
  }

  const character = getCharacterById(id);
  if (!character) {
    return res.status(404).render("404", { title: "Nicht gefunden" });
  }

  if (character.user_id !== req.session.user.id) {
    return res.redirect(`/characters/${id}`);
  }

  const festplay = getOwnedFestplayById(req.session.user.id, festplayId);
  if (!festplay) {
    setFlash(req, "error", "Dieses Festspiel konnte nicht gefunden werden.");
    return res.redirect(`/characters/${id}/festplays`);
  }

  if (festplay.server_id && normalizeServer(character.server_id) !== festplay.server_id) {
    setFlash(req, "error", buildFestplayServerLockMessage(festplay));
    return res.redirect(`/characters/${id}/festplays?selected_festplay=${festplayId}&tab=bewerbungen#festplay-selected-editor`);
  }

  const targetCharacter = getCharacterByExactNameForServer(
    req.body.character_name,
    festplay.server_id || character.server_id
  );
  if (!targetCharacter) {
    setFlash(req, "error", "Dieser Charakter wurde auf diesem Server nicht gefunden.");
    return res.redirect(`/characters/${id}/festplays?selected_festplay=${festplayId}&tab=bewerbungen#festplay-selected-editor`);
  }

  addFestplayPermission(festplayId, targetCharacter.id, req.session.user.id);
  touchFestplayActivity(festplayId);
  return res.redirect(`/characters/${id}/festplays?selected_festplay=${festplayId}&tab=bewerbungen#festplay-selected-editor`);
});

app.post("/characters/:id/festplays/:festplayId/permissions/:permissionId/delete", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const festplayId = Number(req.params.festplayId);
  const permissionId = Number(req.params.permissionId);
  if (
    !Number.isInteger(id) ||
    id < 1 ||
    !Number.isInteger(festplayId) ||
    festplayId < 1 ||
    !Number.isInteger(permissionId) ||
    permissionId < 1
  ) {
    return res.status(404).render("404", { title: "Nicht gefunden" });
  }

  const character = getCharacterById(id);
  if (!character) {
    return res.status(404).render("404", { title: "Nicht gefunden" });
  }

  if (character.user_id !== req.session.user.id) {
    return res.redirect(`/characters/${id}`);
  }

  const festplay = getOwnedFestplayById(req.session.user.id, festplayId);
  if (!festplay) {
    setFlash(req, "error", "Dieses Festspiel konnte nicht gefunden werden.");
    return res.redirect(`/characters/${id}/festplays`);
  }

  if (festplay.server_id && normalizeServer(character.server_id) !== festplay.server_id) {
    setFlash(req, "error", buildFestplayServerLockMessage(festplay));
    return res.redirect(`/characters/${id}/festplays?selected_festplay=${festplayId}&tab=bewerbungen#festplay-selected-editor`);
  }

  removeFestplayPermission(festplayId, permissionId);
  touchFestplayActivity(festplayId);
  return res.redirect(`/characters/${id}/festplays?selected_festplay=${festplayId}&tab=bewerbungen#festplay-selected-editor`);
});

app.post("/characters/:id/festplays/:festplayId/players/:playerCharacterId/delete", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const festplayId = Number(req.params.festplayId);
  const playerCharacterId = Number(req.params.playerCharacterId);
  if (
    !Number.isInteger(id) ||
    id < 1 ||
    !Number.isInteger(festplayId) ||
    festplayId < 1 ||
    !Number.isInteger(playerCharacterId) ||
    playerCharacterId < 1
  ) {
    return res.status(404).render("404", { title: "Nicht gefunden" });
  }

  const character = getCharacterById(id);
  if (!character) {
    return res.status(404).render("404", { title: "Nicht gefunden" });
  }

  if (character.user_id !== req.session.user.id) {
    return res.redirect(`/characters/${id}`);
  }

  const festplay = getOwnedFestplayById(req.session.user.id, festplayId);
  if (!festplay) {
    setFlash(req, "error", "Dieses Festspiel konnte nicht gefunden werden.");
    return res.redirect(`/characters/${id}/festplays`);
  }

  if (festplay.server_id && normalizeServer(character.server_id) !== festplay.server_id) {
    setFlash(req, "error", buildFestplayServerLockMessage(festplay));
    return res.redirect(`/characters/${id}/festplays?selected_festplay=${festplayId}&tab=bewerbungen#festplay-selected-editor`);
  }

  if (!removeFestplayPlayer(festplayId, playerCharacterId)) {
    setFlash(req, "error", "Dieser Spieler konnte nicht aus dem Festspiel entfernt werden.");
  }

  touchFestplayActivity(festplayId);

  return res.redirect(`/characters/${id}/festplays?selected_festplay=${festplayId}&tab=bewerbungen#festplay-selected-editor`);
});

app.post("/characters/:id/festplays/:festplayId/applications/:applicationId/approve", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const festplayId = Number(req.params.festplayId);
  const applicationId = Number(req.params.applicationId);
  if (
    !Number.isInteger(id) ||
    id < 1 ||
    !Number.isInteger(festplayId) ||
    festplayId < 1 ||
    !Number.isInteger(applicationId) ||
    applicationId < 1
  ) {
    return res.status(404).render("404", { title: "Nicht gefunden" });
  }

  const character = getCharacterById(id);
  if (!character) {
    return res.status(404).render("404", { title: "Nicht gefunden" });
  }

  if (character.user_id !== req.session.user.id) {
    return res.redirect(`/characters/${id}`);
  }

  const festplay = getOwnedFestplayById(req.session.user.id, festplayId);
  if (!festplay) {
    setFlash(req, "error", "Dieses Festspiel konnte nicht gefunden werden.");
    return res.redirect(`/characters/${id}/festplays`);
  }

  if (festplay.server_id && normalizeServer(character.server_id) !== festplay.server_id) {
    setFlash(req, "error", buildFestplayServerLockMessage(festplay));
    return res.redirect(`/characters/${id}/festplays`);
  }

  const application = db
    .prepare(
      `SELECT fa.id,
              fa.applicant_character_id,
              c.server_id,
              c.user_id AS applicant_user_id
         FROM festplay_applications fa
         JOIN characters c ON c.id = fa.applicant_character_id
         WHERE fa.id = ?
           AND fa.festplay_id = ?
           AND fa.status = 'pending'`
    )
    .get(applicationId, festplayId);

  if (
    !application ||
    normalizeServer(application.server_id) !== normalizeServer(festplay.server_id || character.server_id)
  ) {
    setFlash(req, "error", "Diese Bewerbung wurde nicht gefunden.");
    return res.redirect(`/characters/${id}/festplays?selected_festplay=${festplayId}&tab=bewerbungen#festplay-selected-editor`);
  }

  try {
    const approved = addFestplayPermission(
      festplayId,
      application.applicant_character_id,
      req.session.user.id,
      { source: "application" }
    );
    if (!approved) {
      setFlash(req, "error", "Die Bewerbung konnte nicht freigeschaltet werden.");
      return res.redirect(`/characters/${id}/festplays?selected_festplay=${festplayId}&tab=bewerbungen#festplay-selected-editor`);
    }

    db.prepare(
      `UPDATE festplay_applications
       SET status = 'approved',
           approved_by_user_id = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?
         AND festplay_id = ?`
    ).run(req.session.user.id, applicationId, festplayId);
    deleteFestplayApplicationNotificationsForApplication(applicationId);

    const approverProfile = getUserDisplayProfile(req.session.user);
    createFestplayApplicationNotification(
      application.applicant_user_id,
      festplayId,
      applicationId,
      {
        notification_kind: "approved",
        actor_name: approverProfile.label || getUserDefaultDisplayName(req.session.user)
      }
    );
    touchFestplayActivity(festplayId);
  } catch (error) {
    console.error("festplay application approval failed", {
      festplayId,
      applicationId,
      applicantCharacterId: application.applicant_character_id,
      approverUserId: req.session.user.id,
      error
    });
    setFlash(req, "error", "Beim Freischalten der Bewerbung ist ein Fehler aufgetreten.");
    return res.redirect(`/characters/${id}/festplays?selected_festplay=${festplayId}&tab=bewerbungen#festplay-selected-editor`);
  }

  return res.redirect(`/characters/${id}/festplays?selected_festplay=${festplayId}&tab=bewerbungen#festplay-selected-editor`);
});

app.post("/characters/:id/festplays/:festplayId/update", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const festplayId = Number(req.params.festplayId);
  if (!Number.isInteger(id) || id < 1 || !Number.isInteger(festplayId) || festplayId < 1) {
    return res.status(404).render("404", { title: "Nicht gefunden" });
  }

  const character = getCharacterById(id);
  if (!character) {
    return res.status(404).render("404", { title: "Nicht gefunden" });
  }

  if (character.user_id !== req.session.user.id) {
    return res.redirect(`/characters/${id}`);
  }

  const festplay = getOwnedFestplayById(req.session.user.id, festplayId);
  if (!festplay) {
    setFlash(req, "error", "Dieses Festspiel konnte nicht gefunden werden.");
    return res.redirect(`/characters/${id}/festplays`);
  }

  if (festplay.server_id && normalizeServer(character.server_id) !== festplay.server_id) {
    setFlash(req, "error", buildFestplayServerLockMessage(festplay));
    return res.redirect(`/characters/${id}/festplays?selected_festplay=${festplayId}#festplay-selected-editor`);
  }

  const festplayName = normalizeFestplayName(req.body.festplay_name);
  const isPublic = String(req.body.is_public || "").trim() === "1";
  const shortDescription = normalizeFestplayText(req.body.short_description, 280);
  const longDescription = normalizeFestplayText(req.body.long_description, 8000);
  if (!festplayName) {
    setFlash(req, "error", "Bitte einen gültigen Festspielnamen eingeben.");
    return res.redirect(`/characters/${id}/festplays?selected_festplay=${festplayId}#festplay-selected-editor`);
  }

  if (findFestplayByName(festplayName, festplayId)) {
    setFlash(req, "error", "Dieses Festspiel existiert bereits.");
    return res.redirect(`/characters/${id}/festplays?selected_festplay=${festplayId}#festplay-selected-editor`);
  }

  syncFestplayCreatorCharacter(festplayId, req.session.user.id, id);
  db.prepare(
    `UPDATE festplays
     SET name = ?,
         is_public = ?,
         short_description = ?,
         long_description = ?
     WHERE id = ?`
  ).run(festplayName, isPublic ? 1 : 0, shortDescription, longDescription, festplayId);
  touchFestplayActivity(festplayId);

  return res.redirect(`/characters/${id}/festplays?selected_festplay=${festplayId}#festplay-selected-editor`);
});

app.post("/characters/:id/festplays/:festplayId/delete", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const festplayId = Number(req.params.festplayId);
  if (!Number.isInteger(id) || id < 1 || !Number.isInteger(festplayId) || festplayId < 1) {
    return res.status(404).render("404", { title: "Nicht gefunden" });
  }

  const character = getCharacterById(id);
  if (!character) {
    return res.status(404).render("404", { title: "Nicht gefunden" });
  }

  if (character.user_id !== req.session.user.id) {
    return res.redirect(`/characters/${id}`);
  }

  const festplay = getOwnedFestplayById(req.session.user.id, festplayId);
  if (!festplay) {
    setFlash(req, "error", "Dieses Festspiel konnte nicht gefunden werden.");
    return res.redirect(`/characters/${id}/festplays`);
  }

  if (festplay.server_id && normalizeServer(character.server_id) !== festplay.server_id) {
    setFlash(req, "error", buildFestplayServerLockMessage(festplay));
    return res.redirect(`/characters/${id}/festplays`);
  }

  try {
    deleteFestplayAndResetCharacters(festplayId);
  } catch (error) {
    console.error("festplay deletion failed", {
      festplayId,
      userId: req.session.user.id,
      characterId: character.id,
      error
    });
    setFlash(req, "error", "Das Festspiel konnte nicht gelöscht werden.");
    return res.redirect(`/characters/${id}/festplays`);
  }

  setFlash(
    req,
    "success",
    `Festspiel ${festplay.name} wurde gelöscht. Zugeordnete Charaktere wurden wieder in den normalen Bereich gesetzt.`
  );
  return res.redirect(`/characters/${id}/festplays`);
});

app.get("/characters/:id/edit", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(404).render("404", { title: "Nicht gefunden" });
  }

  const character = getCharacterById(id);
  if (!character) {
    return res.status(404).render("404", { title: "Nicht gefunden" });
  }

  if (character.user_id !== req.session.user.id) {
    return res.status(403).render("error", {
      title: "Kein Zugriff",
      message: "Nur der Besitzer darf diesen Charakter bearbeiten."
    });
  }

  const renameAvailability = getCharacterRenameAvailability(character, req.session.user);
  const requestedGuestbookPageId = normalizeCharacterEditGuestbookPageId(
    req.query.guestbook_page_id || req.query.page_id
  );

  return res.render(
    "character-form",
    buildCharacterEditFormViewModel(character, {
      renameAvailability,
      requestedGuestbookPageId
    })
  );
});

app.post("/characters/:id/update", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const character = getCharacterById(id);
  const festplays = getFestplays();

  if (!character) {
    return res.status(404).render("404", { title: "Nicht gefunden" });
  }

  if (character.user_id !== req.session.user.id) {
    return res.status(403).render("error", {
      title: "Kein Zugriff",
      message: "Nur der Besitzer darf diesen Charakter bearbeiten."
    });
  }

  const renameAvailability = getCharacterRenameAvailability(character, req.session.user);
  const payload = normalizeCharacterInput(req.body);
  const requestedGuestbookPageId = normalizeCharacterEditGuestbookPageId(req.body.guestbook_page_id);
  if (!Object.prototype.hasOwnProperty.call(req.body || {}, "avatar_url")) {
    payload.avatar_url = String(character.avatar_url || "").trim().slice(0, 500);
  }
  const characterFormValues = renameAvailability.can_change
    ? { ...character, ...payload }
    : { ...character, ...payload, name: character.name };

  if (!payload.name) {
    return res.status(400).render(
      "character-form",
      buildCharacterEditFormViewModel(character, {
        error: "Name ist erforderlich.",
        festplays,
        renameAvailability,
        requestedGuestbookPageId,
        character: characterFormValues
      })
    );
  }

  if (!isAvatarUrlValid(payload.avatar_url)) {
    return res.status(400).render(
      "character-form",
      buildCharacterEditFormViewModel(character, {
        error: "Avatar-URL muss mit http:// oder https:// starten.",
        festplays,
        renameAvailability,
        requestedGuestbookPageId,
        character: characterFormValues
      })
    );
  }

  if (payload.festplay_id && !festplayExists(payload.festplay_id)) {
    return res.status(400).render(
      "character-form",
      buildCharacterEditFormViewModel(character, {
        error: "Bitte ein gültiges Festplay auswählen.",
        festplays,
        renameAvailability,
        requestedGuestbookPageId,
        character: characterFormValues
      })
    );
  }

  const selectedFestplayServer = getFestplayServerBinding(payload.festplay_id);
  const keepsExistingFestplayBinding =
    Number.isInteger(Number(payload.festplay_id)) &&
    Number(payload.festplay_id) > 0 &&
    (Number(character.festplay_id) === Number(payload.festplay_id) ||
      isCharacterAllowedInFestplay(payload.festplay_id, id));
  if (
    selectedFestplayServer?.server_id &&
    selectedFestplayServer.server_id !== normalizeServer(payload.server_id) &&
    !keepsExistingFestplayBinding
  ) {
    return res.status(400).render(
      "character-form",
      buildCharacterEditFormViewModel(character, {
        error: buildFestplayServerLockMessage(selectedFestplayServer, payload.server_id),
        festplays,
        renameAvailability,
        requestedGuestbookPageId,
        character: characterFormValues
      })
    );
  }

  const nameChanged = payload.name !== character.name;
  if (nameChanged && !renameAvailability.can_change) {
    return res.status(400).render(
      "character-form",
      buildCharacterEditFormViewModel(character, {
        error: `Der Charaktername kann erst wieder ab ${renameAvailability.available_at_text} geändert werden.`,
        festplays,
        renameAvailability,
        requestedGuestbookPageId,
        character: characterFormValues
      })
    );
  }

  if (findCharacterWithSameName(payload.name, id)) {
    return res.status(400).render(
      "character-form",
      buildCharacterEditFormViewModel(character, {
        error: "Dieser Charaktername ist bereits vergeben.",
        festplays,
        renameAvailability,
        requestedGuestbookPageId,
        character: characterFormValues
      })
    );
  }

  db.prepare(
    `UPDATE characters
     SET server_id = ?, festplay_id = ?, name = ?, species = ?, age = ?, faceclaim = ?, description = ?, avatar_url = ?, is_public = ?,
         name_changed_at = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE name_changed_at END,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).run(
    payload.server_id,
    payload.festplay_id,
    payload.name,
    payload.species,
    payload.age,
    payload.faceclaim,
    payload.description,
    payload.avatar_url,
    payload.is_public,
    nameChanged ? 1 : 0,
    id
  );

  saveCharacterChatColor(id, payload.chat_text_color);

  const refreshedUser = getUserForSessionById(req.session.user.id);
  if (refreshedUser) {
    req.session.user = toSessionUser(refreshedUser);
  }
  refreshConnectedUserDisplay(req.session.user.id);

  emitHomeStatsUpdate();
  setFlash(
    req,
    "success",
    nameChanged
      ? `Charakter aktualisiert. Der Name kann wieder ab ${formatGermanDate(addUtcCalendarMonths(new Date(), CHARACTER_RENAME_COOLDOWN_MONTHS))} geändert werden.`
      : "Charakter aktualisiert."
  );
  return res.redirect(`/characters/${id}/edit`);
});

app.post("/characters/:id/delete", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const character = getCharacterById(id);

  if (!character) {
    return res.status(404).render("404", { title: "Nicht gefunden" });
  }

  if (character.user_id !== req.session.user.id) {
    return res.status(403).render("error", {
      title: "Kein Zugriff",
      message: "Nur der Besitzer darf diesen Charakter löschen."
    });
  }

  try {
    deleteCharacterWithBackupTx(id);
  } catch (error) {
    console.error(error);
    setFlash(req, "error", "Charakter konnte nicht gelöscht werden.");
    return res.redirect("/dashboard");
  }

  const refreshedUser = getUserForSessionById(req.session.user.id);
  if (refreshedUser) {
    req.session.user = toSessionUser(refreshedUser);
  }
  emitHomeStatsUpdate();
  setFlash(req, "success", "Charakter gelöscht und als Backup gespeichert.");
  return res.redirect("/dashboard");
});

app.post("/characters/:id/move", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const character = getCharacterById(id);
  const returnTarget = getSafeReturnTarget(req, "/dashboard");

  if (!character) {
    return res.status(404).render("404", { title: "Nicht gefunden" });
  }

  if (character.user_id !== req.session.user.id) {
    return res.status(403).render("error", {
      title: "Kein Zugriff",
      message: "Nur der Besitzer darf diesen Charakter verschieben."
    });
  }

  const currentServerId = normalizeServer(character.server_id);
  const requestedServerId = normalizeFestplayServerId(req.body.target_server_id);
  const festplayHomeServerId = getCharacterFestplayHomeServer(id);
  const requestedDashboardMode = parseRequestedFestplayDashboardMode(
    req.body.target_dashboard_mode
  );
  const currentDashboardPlacement = getCharacterDashboardPlacement(
    character.server_id,
    festplayHomeServerId,
    character.festplay_dashboard_mode
  );
  const nextServerId =
    requestedServerId || (currentServerId === "free-rp" ? "erp" : "free-rp");
  const nextDashboardMode =
    festplayHomeServerId && nextServerId === festplayHomeServerId
      ? normalizeFestplayDashboardMode(
          requestedDashboardMode ||
            (currentServerId === festplayHomeServerId
              ? character.festplay_dashboard_mode
              : "main")
        )
      : "main";
  const nextDashboardPlacement = getCharacterDashboardPlacement(
    nextServerId,
    festplayHomeServerId,
    nextDashboardMode
  );

  if (!ALLOWED_SERVER_IDS.has(nextServerId)) {
    setFlash(req, "error", "Bitte einen gültigen Zielserver auswählen.");
    return res.redirect(returnTarget);
  }

  if (
    nextServerId === currentServerId &&
    nextDashboardPlacement === currentDashboardPlacement
  ) {
    if (currentDashboardPlacement === "festplay") {
      setFlash(req, "error", "Der Charakter liegt bereits in diesem Festspiel.");
    } else {
      setFlash(req, "error", `Der Charakter liegt bereits auf ${getServerLabel(currentServerId)}.`);
    }
    return res.redirect(returnTarget);
  }

  const accountUser = getAccountUserById(req.session.user.id);
  const viewerAge = getAgeFromBirthDate(accountUser?.birth_date);
  if (nextServerId === "erp" && (viewerAge === null || viewerAge < 18)) {
    setFlash(req, "error", "ERP ist erst ab 18 Jahren verfügbar.");
    return res.redirect(returnTarget);
  }

  db.prepare(
    `UPDATE characters
     SET server_id = ?, festplay_dashboard_mode = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).run(nextServerId, nextDashboardMode, id);

  const preferredMap = normalizePreferredCharacterMap(req.session.preferred_character_ids);
  if (Number(preferredMap[currentServerId]) === id) {
    delete preferredMap[currentServerId];
  }
  preferredMap[nextServerId] = id;
  req.session.preferred_character_ids = preferredMap;

  emitHomeStatsUpdate();
  let successMessage = `Charakter wurde nach ${nextServerId === "erp" ? "ERP" : "FREE-RP"} verschoben.`;
  if (
    festplayHomeServerId &&
    nextServerId === festplayHomeServerId &&
    nextDashboardPlacement === "festplay"
  ) {
    successMessage = "Charakter wurde zurück ins Festspiel gelegt.";
  } else if (
    festplayHomeServerId &&
    nextServerId === festplayHomeServerId &&
    currentDashboardPlacement === "festplay" &&
    nextDashboardPlacement === "main"
  ) {
    successMessage = `Charakter wurde in ${getServerLabel(nextServerId)} zu den normalen Charakteren gelegt.`;
  }

  setFlash(req, "success", successMessage);
  return res.redirect(returnTarget);
});

app.post("/characters/:id/role-character", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const character = getCharacterById(id);

  if (!character) {
    return res.status(404).render("404", { title: "Nicht gefunden" });
  }

  if (character.user_id !== req.session.user.id) {
    return res.status(403).render("error", {
      title: "Kein Zugriff",
      message: "Nur der Besitzer darf diesen Charakter als Rollenname setzen."
    });
  }

  if (!req.session.user.is_admin && !req.session.user.is_moderator) {
    setFlash(req, "error", "Nur Admins oder Moderatoren können einen Rollencharakter auswählen.");
    return res.redirect(`/characters/${id}`);
  }

  const refreshedUser = updateUserRoleCharacterSelection(req.session.user, id, req.body);
  if (refreshedUser) {
    req.session.user = toSessionUser(refreshedUser);
  }

  emitHomeStatsUpdate();
  setFlash(req, "success", "Rollenname aktualisiert.");
  return res.redirect(`/characters/${id}`);
});

app.post("/characters/:id/enter-room", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const character = getCharacterById(id);

  if (!character) {
    return res.status(404).render("404", { title: "Nicht gefunden" });
  }

  if (
    !canAccessCharacter(
      req.session.user.id,
      character.user_id,
      character.is_public,
      req.session.user.is_admin
    )
  ) {
    return res.status(403).render("error", {
      title: "Kein Zugriff",
      message: "Dieser Charakter ist privat."
    });
  }

  if (character.user_id !== req.session.user.id) {
    return res.status(403).render("error", {
      title: "Kein Zugriff",
      message: "Nur der Besitzer darf mit diesem Charakter einen eigenen Raum anlegen."
    });
  }

  const roomName = normalizeRoomName(req.body.room_name);
  const roomDescription = normalizeRoomDescription(req.body.room_description || req.body.room_teaser);
  const returnTarget = String(req.body.return_to || "").trim().toLowerCase();
  if (roomName.length < 2) {
    setFlash(req, "error", "Bitte einen gültigen Raumnamen eingeben.");
    return res.redirect(returnTarget === "roomlist" ? `/characters/${id}#roomlist` : `/characters/${id}/rooms/new`);
  }

  if (character.user_id === req.session.user.id) {
    rememberPreferredCharacter(req, character);
  }

  const targetRoom = returnTarget === "roomlist"
    ? ensurePublicRoomForServer(req.session.user.id, character, roomName, roomDescription)
    : ensureOwnedRoomForCharacter(req.session.user.id, character, roomName, roomDescription);
  if (!targetRoom) {
    setFlash(req, "error", "Raum konnte nicht angelegt werden.");
    return res.redirect(returnTarget === "roomlist" ? `/characters/${id}#roomlist` : `/characters/${id}/rooms/new`);
  }

  if (targetRoom.created) {
    emitRoomListRefresh(character.server_id);
  }

  if (returnTarget === "roomlist") {
    return res.redirect(`/chat?room_id=${targetRoom.id}&character_id=${character.id}`);
  }

  return res.redirect(`/characters/${id}/rooms/new`);
});

app.post("/characters/:id/rooms/:roomId/update", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const roomId = Number(req.params.roomId);
  if (!Number.isInteger(id) || id < 1 || !Number.isInteger(roomId) || roomId < 1) {
    return res.status(404).render("404", { title: "Nicht gefunden" });
  }

  const character = getCharacterById(id);
  if (!character) {
    return res.status(404).render("404", { title: "Nicht gefunden" });
  }

  if (character.user_id !== req.session.user.id) {
    return res.status(403).render("error", {
      title: "Kein Zugriff",
      message: "Nur der Besitzer darf eigene Räume bearbeiten."
    });
  }

  const room = db
    .prepare(
      `SELECT id, server_id, created_by_user_id, name, description, teaser, image_url, email_log_enabled, is_locked, is_public_room, is_saved_room
       FROM chat_rooms
       WHERE id = ?
         AND COALESCE(festplay_id, 0) = 0
         AND COALESCE(is_festplay_chat, 0) = 0
         AND COALESCE(is_manual_festplay_room, 0) = 0
         AND COALESCE(is_festplay_side_chat, 0) = 0`
    )
    .get(roomId);
  if (
    !room ||
    Number(room.created_by_user_id) !== Number(req.session.user.id) ||
    Number(room.is_saved_room) !== 1 ||
    normalizeServer(room.server_id) !== normalizeServer(character.server_id)
  ) {
    setFlash(req, "error", "Dieser Raum konnte nicht gefunden werden.");
    return res.redirect(`/characters/${id}/rooms/new`);
  }

  const roomName = normalizeRoomName(req.body.room_name);
  const roomDescription = normalizeRoomDescription(req.body.room_description);
  const roomTeaser = normalizeRoomTeaser(req.body.room_teaser);
  const roomImageUrl = String(room.image_url || "");
  const emailLogEnabled = req.body.email_log_enabled ? 1 : 0;
  const isLocked = req.body.is_locked ? 1 : 0;

  if (req.body.delete_room) {
    if (getSocketsInChannel(roomId, room.server_id).length > 0) {
      setFlash(req, "error", "Der Raum kann erst gelöscht werden, wenn niemand mehr darin ist.");
      return res.redirect(`/characters/${id}/rooms/new?selected_room=${roomId}#room-selected-editor`);
    }

    clearPendingRoomDeletion(roomId);
    await finalizeRoomLog(roomId, room.server_id, { reason: "manual" });
    deleteRoomData(roomId);
    io.emit("chat:room-removed", { room_id: roomId });
    emitRoomListRefresh(room.server_id);
    setFlash(req, "success", "Raum gelöscht.");
    return res.redirect(`/characters/${id}/rooms/new`);
  }

  if (roomName.length < 2) {
    setFlash(req, "error", "Bitte einen gültigen Raumnamen eingeben.");
    return res.redirect(`/characters/${id}/rooms/new?selected_room=${roomId}#room-selected-editor`);
  }

  const nextRoomNameKey = toRoomNameKey(roomName);
  const currentRoomNameKey = toRoomNameKey(room.name);
  const conflictingRoom = nextRoomNameKey === currentRoomNameKey
    ? null
    : findOwnedRoomByNameKey(
        req.session.user.id,
        character.server_id,
        nextRoomNameKey,
        roomDescription
      );
  if (conflictingRoom && Number(conflictingRoom.id) !== roomId) {
    setFlash(req, "error", "Du hast bereits einen Raum mit diesem Namen.");
    return res.redirect(`/characters/${id}/rooms/new?selected_room=${roomId}#room-selected-editor`);
  }

  db.prepare(
      `UPDATE chat_rooms
       SET name = ?,
           name_key = ?,
           description = ?,
           teaser = ?,
           image_url = ?,
           email_log_enabled = ?,
           is_locked = ?
       WHERE id = ?`
    ).run(
      roomName,
      nextRoomNameKey,
      roomDescription,
      roomTeaser,
      roomImageUrl,
      emailLogEnabled,
    isLocked,
    roomId
  );
  if (isCuratedPublicRoom(room, room.server_id)) {
    saveCuratedRoomOverride(
      room.server_id,
      room.name_key || toRoomNameKey(roomName),
      roomDescription,
      roomTeaser
    );
  }

  const refreshedRoom = getRoomWithCharacter(roomId);
  if (emailLogEnabled === 1 && Number(room.email_log_enabled) !== 1) {
    maybeStartAutomaticRoomLog(roomId, room.server_id, refreshedRoom);
  } else if (emailLogEnabled !== 1 && Number(room.email_log_enabled) === 1 && getActiveRoomLog(roomId, room.server_id)) {
    emitSystemChatMessage(roomId, room.server_id, "Log wurde deaktiviert.");
    await finalizeRoomLog(roomId, room.server_id, { reason: "manual" });
  }

  emitRoomStateUpdate(roomId, room.server_id, refreshedRoom);
  emitRoomListRefresh(room.server_id);
  return res.redirect(`/characters/${id}/rooms/new?selected_room=${roomId}#room-selected-editor`);
});

app.post("/characters/:id/rooms/:roomId/delete", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const roomId = Number(req.params.roomId);
  if (!Number.isInteger(id) || id < 1 || !Number.isInteger(roomId) || roomId < 1) {
    return res.status(404).render("404", { title: "Nicht gefunden" });
  }

  const character = getCharacterById(id);
  if (!character) {
    return res.status(404).render("404", { title: "Nicht gefunden" });
  }

  if (character.user_id !== req.session.user.id) {
    return res.status(403).render("error", {
      title: "Kein Zugriff",
      message: "Nur der Besitzer darf eigene Räume löschen."
    });
  }

  const room = db
    .prepare(
      `SELECT id, name, server_id, created_by_user_id, is_public_room, is_saved_room
       FROM chat_rooms
       WHERE id = ?
         AND COALESCE(festplay_id, 0) = 0`
    )
    .get(roomId);
  if (
    !room ||
    Number(room.created_by_user_id) !== Number(req.session.user.id) ||
    Number(room.is_saved_room) !== 1 ||
    normalizeServer(room.server_id) !== normalizeServer(character.server_id)
  ) {
    setFlash(req, "error", "Dieser Raum konnte nicht gefunden werden.");
    return res.redirect(`/characters/${id}/rooms/new`);
  }

  if (getSocketsInChannel(roomId, room.server_id).length > 0) {
    setFlash(req, "error", "Der Raum kann erst gelöscht werden, wenn niemand mehr darin ist.");
    return res.redirect(`/characters/${id}/rooms/new`);
  }

  clearPendingRoomDeletion(roomId);
  await finalizeRoomLog(roomId, room.server_id, { reason: "manual" });
  deleteRoomData(roomId);
  io.emit("chat:room-removed", { room_id: roomId });
  emitRoomListRefresh(room.server_id);

  return res.redirect(`/characters/${id}/rooms/new`);
});

app.get("/characters/:id/guestbook", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(404).render("404", { title: "Nicht gefunden" });
  }

  const character = getCharacterById(id);
  if (!character) {
    return res.status(404).render("404", { title: "Nicht gefunden" });
  }

  const guestbookAccessState = getGuestbookAccessState(req, character);
  if (!guestbookAccessState.canAccess) {
    return renderGuestbookAccessDenied(res, guestbookAccessState);
  }

  const guestbookPages = ensureGuestbookPages(id);
  const requestedPageId = Number(req.query.page_id);
  const activeGuestbookPage =
    guestbookPages.find((page) => page.id === requestedPageId) || guestbookPages[0];
  const guestbookSettings = buildGuestbookPageSettings(
    getOrCreateGuestbookSettings(id),
    activeGuestbookPage
  );
  const requestedEntriesPageNumber = normalizeGuestbookEntriesPageNumber(req.query.entries_page);
  const totalGuestbookEntries = getGuestbookEntriesCountForViewer(
    character,
    activeGuestbookPage.id,
    req.session.user,
    guestbookAccessState
  );
  const totalGuestbookEntryPages = Math.max(1, Math.ceil(totalGuestbookEntries / GUESTBOOK_PAGE_SIZE));
  const activeGuestbookEntriesPageNumber = Math.min(requestedEntriesPageNumber, totalGuestbookEntryPages);
  const guestbookEntries = getGuestbookEntriesForViewer(
    character,
    activeGuestbookPage.id,
    req.session.user,
    guestbookAccessState,
    activeGuestbookEntriesPageNumber
  );
  const postingCharactersState = getGuestbookPostingCharacters(req, character);
  const replyCharacterId = Number(guestbookAccessState.replyContextCharacterId);
  if (
    Number.isInteger(replyCharacterId) &&
    replyCharacterId > 0 &&
    postingCharactersState.characters.some((entry) => Number(entry.id) === replyCharacterId)
  ) {
    postingCharactersState.selectedCharacterId = replyCharacterId;
  }

  const topbarCharacter = getPreferredMenuCharacterForUser(req);
  const guestbookPageNavigation = buildGuestbookPageNavigation(
    guestbookPages,
    activeGuestbookPage.id,
    (pageId) =>
      `/characters/${character.id}/guestbook?page_id=${pageId}` +
      (activeGuestbookEntriesPageNumber > 1 ? `&entries_page=${activeGuestbookEntriesPageNumber}` : "") +
      buildGuestbookContextQuery(guestbookAccessState)
  );

  return res.render("guestbook-view", {
    title: `Gästebuch: ${character.name}`,
    character,
    characterCreatedAtLabel: formatGermanDate(character.created_at),
    isOwner: guestbookAccessState.isOwner,
    guestbookAccessState,
    guestbookEntries,
    guestbookPages,
    guestbookEntryPagination: {
      currentPage: activeGuestbookEntriesPageNumber,
      totalPages: totalGuestbookEntryPages,
      hasPreviousPage: activeGuestbookEntriesPageNumber > 1,
      hasNextPage: activeGuestbookEntriesPageNumber < totalGuestbookEntryPages,
      previousPage: Math.max(1, activeGuestbookEntriesPageNumber - 1),
      nextPage: Math.min(totalGuestbookEntryPages, activeGuestbookEntriesPageNumber + 1)
    },
    activeGuestbookPage: {
      ...activeGuestbookPage,
      content_html: renderGuestbookBbcode(activeGuestbookPage.content || "")
    },
    guestbookPageNavigation,
    guestbookSettings,
    guestbookPostingCharacters: postingCharactersState.characters,
    selectedGuestbookAuthorCharacterId: postingCharactersState.selectedCharacterId,
    guestbookContextQuery: buildGuestbookContextQuery(guestbookAccessState),
    topbarCharacter
  });
});

app.post("/characters/:id/guestbook", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const character = getCharacterById(id);

  if (!character) {
    return res.status(404).render("404", { title: "Nicht gefunden" });
  }

  const guestbookAccessState = getGuestbookAccessState(req, character);
  if (!guestbookAccessState.canAccess) {
    return renderGuestbookAccessDenied(res, guestbookAccessState);
  }

  const pages = ensureGuestbookPages(id);
  const requestedPageId = Number(req.body.page_id);
  const activePage =
    pages.find((page) => page.id === requestedPageId) || pages[0];
  const requestedEntriesPageNumber = normalizeGuestbookEntriesPageNumber(req.body.entries_page);
  const guestbookRedirectBase = buildGuestbookViewUrl(
    id,
    activePage.id,
    guestbookAccessState,
    requestedEntriesPageNumber
  );
  const content = normalizeBbcodeInput(req.body.content, 4000);
  if (!content) {
    setFlash(req, "error", "Gästebucheintrag darf nicht leer sein.");
    return res.redirect(guestbookRedirectBase);
  }

  const postingCharactersState = getGuestbookPostingCharacters(req, character);
  if (!postingCharactersState.characters.length) {
    setFlash(req, "error", "Du brauchst erst einen eigenen Charakter, um ins Gästebuch zu schreiben.");
    return res.redirect(guestbookRedirectBase);
  }

  const requestedAuthorCharacterId = Number(req.body.author_character_id);
  const fallbackAuthorCharacterId =
    postingCharactersState.selectedCharacterId || Number(postingCharactersState.characters[0]?.id || 0);
  const selectedAuthorCharacterId =
    Number.isInteger(requestedAuthorCharacterId) && requestedAuthorCharacterId > 0
      ? requestedAuthorCharacterId
      : fallbackAuthorCharacterId;
  const authorCharacter = postingCharactersState.characters.find(
    (entry) => Number(entry.id) === Number(selectedAuthorCharacterId)
  );

  if (!authorCharacter) {
    setFlash(req, "error", "Bitte wähle einen gültigen Charakter für den Eintrag aus.");
    return res.redirect(guestbookRedirectBase);
  }

  const info = db.prepare(
    `INSERT INTO guestbook_entries (
       character_id,
       author_id,
       author_character_id,
       author_name,
       content,
       guestbook_page_id,
       is_private,
       updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
  ).run(
    id,
    req.session.user.id,
    authorCharacter.id,
    authorCharacter.name,
    content,
    activePage.id,
    req.body.is_private === "1" ? 1 : 0
  );

  if (Number(character.user_id) !== Number(req.session.user.id)) {
    createGuestbookNotification(character.user_id, id, info.lastInsertRowid);
  }

  return res.redirect(`${buildGuestbookViewUrl(id, activePage.id, guestbookAccessState, 1)}#guestbook-entry-${info.lastInsertRowid}`);
});

app.post("/characters/:id/guestbook/entries/:entryId/update", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const entryId = Number(req.params.entryId);
  const character = getCharacterById(id);

  if (!character || !Number.isInteger(entryId) || entryId < 1) {
    return res.status(404).render("404", { title: "Nicht gefunden" });
  }

  const guestbookAccessState = getGuestbookAccessState(req, character);
  if (!guestbookAccessState.canAccess) {
    return renderGuestbookAccessDenied(res, guestbookAccessState);
  }

  const entry = getGuestbookEntryById(entryId);
  if (!entry || Number(entry.character_id) !== id) {
    return res.status(404).render("404", { title: "Nicht gefunden" });
  }

  const isAuthor = Number(entry.author_id) === Number(req.session.user.id);
  if (!isAuthor && !guestbookAccessState.isAdmin) {
    return res.status(403).render("error", {
      title: "Kein Zugriff",
      message: "Nur der Verfasser oder ein Admin darf diesen Eintrag bearbeiten."
    });
  }

  const pages = ensureGuestbookPages(id);
  const requestedPageId = Number(req.body.page_id);
  const activePage =
    pages.find((page) => page.id === requestedPageId) ||
    pages.find((page) => page.id === Number(entry.guestbook_page_id)) ||
    pages[0];
  const requestedEntriesPageNumber = normalizeGuestbookEntriesPageNumber(req.body.entries_page);
  const guestbookRedirectBase = buildGuestbookViewUrl(
    id,
    activePage.id,
    guestbookAccessState,
    requestedEntriesPageNumber
  );
  const content = normalizeBbcodeInput(req.body.content, 4000);

  if (!content) {
    setFlash(req, "error", "Gästebucheintrag darf nicht leer sein.");
    return res.redirect(`${guestbookRedirectBase}#guestbook-entry-${entryId}`);
  }

  db.prepare(
    `UPDATE guestbook_entries
     SET content = ?, is_private = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND character_id = ?`
  ).run(content, req.body.is_private === "1" ? 1 : 0, entryId, id);

  setFlash(req, "success", "Eintrag aktualisiert.");
  return res.redirect(`${guestbookRedirectBase}#guestbook-entry-${entryId}`);
});

app.post("/characters/:id/guestbook/entries/:entryId/delete", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const entryId = Number(req.params.entryId);
  const character = getCharacterById(id);

  if (!character || !Number.isInteger(entryId) || entryId < 1) {
    return res.status(404).render("404", { title: "Nicht gefunden" });
  }

  const guestbookAccessState = getGuestbookAccessState(req, character);
  if (!guestbookAccessState.canAccess) {
    return renderGuestbookAccessDenied(res, guestbookAccessState);
  }

  const entry = getGuestbookEntryById(entryId);
  if (!entry || Number(entry.character_id) !== id) {
    return res.status(404).render("404", { title: "Nicht gefunden" });
  }

  const isAuthor = Number(entry.author_id) === Number(req.session.user.id);
  if (!isAuthor && !guestbookAccessState.isOwner && !guestbookAccessState.isAdmin) {
    return res.status(403).render("error", {
      title: "Kein Zugriff",
      message: "Nur der Verfasser, der Besitzer oder ein Admin darf diesen Eintrag löschen."
    });
  }

  const pages = ensureGuestbookPages(id);
  const requestedPageId = Number(req.body.page_id);
  const activePage =
    pages.find((page) => page.id === requestedPageId) ||
    pages.find((page) => page.id === Number(entry.guestbook_page_id)) ||
    pages[0];
  const requestedEntriesPageNumber = normalizeGuestbookEntriesPageNumber(req.body.entries_page);
  const guestbookRedirectBase = buildGuestbookViewUrl(
    id,
    activePage.id,
    guestbookAccessState,
    requestedEntriesPageNumber
  );

  const deleteTx = db.transaction(() => {
    deleteGuestbookNotificationsForEntry(entryId);
    db.prepare("DELETE FROM guestbook_entries WHERE id = ? AND character_id = ?").run(entryId, id);
  });
  deleteTx();

  return res.redirect(guestbookRedirectBase);
});

app.get("/characters/:id/guestbook/edit", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const character = getCharacterById(id);

  if (!character) {
    return res.status(404).render("404", { title: "Nicht gefunden" });
  }

  if (character.user_id !== req.session.user.id && !req.session.user.is_admin) {
    return res.status(403).render("error", {
      title: "Kein Zugriff",
      message: "Nur Besitzer oder Admins dürfen das Gästebuch bearbeiten."
    });
  }

  const guestbookEditorState = buildCharacterGuestbookEditorState(
    id,
    normalizeCharacterEditGuestbookPageId(req.query.page_id)
  );

  if (character.user_id === req.session.user.id) {
    return res.redirect(buildEmbeddedGuestbookEditorUrl(id, guestbookEditorState.activePage.id));
  }

  return res.render("guestbook-editor", {
    title: `Gästebuch bearbeiten: ${character.name}`,
    character,
    pages: guestbookEditorState.pages,
    activePage: guestbookEditorState.activePage,
    settings: guestbookEditorState.settings
  });
});

app.get("/characters/:id/guestbook/edit/preview", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const character = getCharacterById(id);

  if (!character) {
    return res.status(404).render("404", { title: "Nicht gefunden" });
  }

  if (character.user_id !== req.session.user.id && !req.session.user.is_admin) {
    return res.status(403).render("error", {
      title: "Kein Zugriff",
      message: "Nur Besitzer oder Admins dürfen das Gästebuch bearbeiten."
    });
  }

  const pages = ensureGuestbookPages(id);
  const requestedPageId = Number(req.query.page_id);
  const fallbackPage = pages.find((page) => page.id === requestedPageId) || pages[0];

  const storedPreview = req.session.guestbookPreview;
  const canUseStoredPreview = Boolean(
    storedPreview &&
      Number(storedPreview.character_id) === id &&
      (!requestedPageId || Number(storedPreview.page_id) === requestedPageId)
  );

  const previewPage = canUseStoredPreview
    ? pages.find((page) => page.id === Number(storedPreview.page_id)) || fallbackPage
    : fallbackPage;

  const baseSettings = buildGuestbookPageSettings(getOrCreateGuestbookSettings(id), previewPage);
  const previewSettings = canUseStoredPreview
    ? { ...baseSettings, ...(storedPreview.settings || {}) }
    : baseSettings;
  const previewContent = canUseStoredPreview
    ? String(storedPreview.page_content || "")
    : String(previewPage.content || "");
  const guestbookPageNavigation = buildGuestbookPageNavigation(
    pages,
    previewPage.id,
    (pageId) => `/characters/${id}/guestbook/edit/preview?page_id=${pageId}`
  );

  return res.render("guestbook-preview", {
    title: `Vorschau: ${character.name}`,
    character,
    characterCreatedAtLabel: formatGermanDate(character.created_at),
    pageId: previewPage.id,
    pageNumber: previewPage.page_number,
    guestbookPageNavigation,
    guestbookSettings: previewSettings,
    previewHtml: renderGuestbookBbcode(previewContent),
    previewBackUrl: buildGuestbookEditorReturnUrl(req, character, previewPage.id)
  });
});

app.post("/characters/:id/guestbook/edit/save", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const character = getCharacterById(id);

  if (!character) {
    return res.status(404).render("404", { title: "Nicht gefunden" });
  }

  if (character.user_id !== req.session.user.id && !req.session.user.is_admin) {
    return res.status(403).render("error", {
      title: "Kein Zugriff",
      message: "Nur Besitzer oder Admins dürfen das Gästebuch bearbeiten."
    });
  }

  const pages = ensureGuestbookPages(id);
  const requestedPageId = Number(req.body.page_id);
  const activePage = pages.find((page) => page.id === requestedPageId) || pages[0];
  const currentSettings = buildGuestbookPageSettings(getOrCreateGuestbookSettings(id), activePage);
  const payload = getGuestbookEditorPayload(req.body, currentSettings);

  db.prepare(
    `UPDATE guestbook_pages
     SET content = ?,
         image_url = ?,
         inner_image_url = ?,
         outer_image_url = ?,
         inner_image_opacity = ?,
         outer_image_opacity = ?,
         inner_image_repeat = ?,
         outer_image_repeat = ?,
         frame_color = ?,
         background_color = ?,
         surround_color = ?,
         page_style = ?,
         theme_style = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND character_id = ?`
  ).run(
    payload.pageContent,
    payload.settings.image_url,
    payload.settings.inner_image_url,
    payload.settings.outer_image_url,
    payload.settings.inner_image_opacity,
    payload.settings.outer_image_opacity,
    payload.settings.inner_image_repeat,
    payload.settings.outer_image_repeat,
    payload.settings.frame_color,
    payload.settings.background_color,
    payload.settings.surround_color,
    payload.settings.page_style,
    payload.settings.theme_style,
    activePage.id,
    id
  );

  db.prepare(
    `UPDATE guestbook_settings
     SET image_url = ?,
         inner_image_url = ?,
         outer_image_url = ?,
         inner_image_opacity = ?,
         outer_image_opacity = ?,
         inner_image_repeat = ?,
         outer_image_repeat = ?,
         censor_level = ?,
         chat_text_color = ?,
         page_text_color = ?,
         frame_color = ?,
         background_color = ?,
         surround_color = ?,
         page_style = ?,
         theme_style = ?,
         font_style = ?,
         tags = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE character_id = ?`
  ).run(
    payload.settings.image_url,
    payload.settings.inner_image_url,
    payload.settings.outer_image_url,
    payload.settings.inner_image_opacity,
    payload.settings.outer_image_opacity,
    payload.settings.inner_image_repeat,
    payload.settings.outer_image_repeat,
    payload.settings.censor_level,
    payload.settings.chat_text_color,
    payload.settings.page_text_color,
    payload.settings.frame_color,
    payload.settings.background_color,
    payload.settings.surround_color,
    payload.settings.page_style,
    payload.settings.theme_style,
    payload.settings.font_style,
    payload.settings.tags,
    id
  );

  if (character.user_id === req.session.user.id) {
    const refreshedUser = updateUserRoleCharacterSelection(req.session.user, id, req.body);
    if (refreshedUser) {
      req.session.user = toSessionUser(refreshedUser);
    }
    refreshConnectedUserDisplay(req.session.user.id);
  }

  if (req.session.guestbookPreview && Number(req.session.guestbookPreview.character_id) === id) {
    delete req.session.guestbookPreview;
  }

  emitHomeStatsUpdate();
  setFlash(req, "success", "Gästebuch gespeichert.");
  return res.redirect(buildGuestbookEditorReturnUrl(req, character, activePage.id));
});

app.post("/characters/:id/guestbook/edit/preview", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const character = getCharacterById(id);

  if (!character) {
    return res.status(404).render("404", { title: "Nicht gefunden" });
  }

  if (character.user_id !== req.session.user.id && !req.session.user.is_admin) {
    return res.status(403).render("error", {
      title: "Kein Zugriff",
      message: "Nur Besitzer oder Admins dürfen das Gästebuch bearbeiten."
    });
  }

  const pages = ensureGuestbookPages(id);
  const requestedPageId = Number(req.body.page_id);
  const activePage = pages.find((page) => page.id === requestedPageId) || pages[0];
  const currentSettings = buildGuestbookPageSettings(getOrCreateGuestbookSettings(id), activePage);
  const payload = getGuestbookEditorPayload(req.body, currentSettings);

  req.session.guestbookPreview = {
    character_id: id,
    page_id: activePage.id,
    page_number: activePage.page_number,
    settings: payload.settings,
    page_content: payload.pageContent,
    saved_at: Date.now()
  };

  if (String(req.get("X-Requested-With") || "").trim().toLowerCase() === "xmlhttprequest") {
    return res.status(204).end();
  }

  return res.redirect(`/characters/${id}/guestbook/edit/preview?page_id=${activePage.id}`);
});

app.post("/characters/:id/guestbook/edit/add-page", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const character = getCharacterById(id);

  if (!character) {
    return res.status(404).render("404", { title: "Nicht gefunden" });
  }

  if (character.user_id !== req.session.user.id && !req.session.user.is_admin) {
    return res.status(403).render("error", {
      title: "Kein Zugriff",
      message: "Nur Besitzer oder Admins dürfen das Gästebuch bearbeiten."
    });
  }

  const pages = ensureGuestbookPages(id);
  const requestedPageId = Number(req.body.page_id);
  const sourcePage = pages.find((page) => page.id === requestedPageId) || pages[0];
  const sourcePageSettings = buildGuestbookPageSettings(getOrCreateGuestbookSettings(id), sourcePage);
  const nextPageNumber =
    db
      .prepare(
        `SELECT COALESCE(MAX(page_number), 0) + 1 AS next_number
         FROM guestbook_pages
         WHERE character_id = ?`
      )
      .get(id).next_number || 1;

  const info = db
    .prepare(
      `INSERT INTO guestbook_pages (
         character_id,
         page_number,
         title,
         content,
         image_url,
         inner_image_url,
         outer_image_url,
         inner_image_opacity,
         outer_image_opacity,
         inner_image_repeat,
         outer_image_repeat,
         frame_color,
         background_color,
         surround_color,
         page_style,
         theme_style
       )
       VALUES (?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      nextPageNumber,
      String(nextPageNumber),
      sourcePageSettings.image_url,
      sourcePageSettings.inner_image_url,
      sourcePageSettings.outer_image_url,
      sourcePageSettings.inner_image_opacity,
      sourcePageSettings.outer_image_opacity,
      sourcePageSettings.inner_image_repeat,
      sourcePageSettings.outer_image_repeat,
      sourcePageSettings.frame_color,
      sourcePageSettings.background_color,
      sourcePageSettings.surround_color,
      sourcePageSettings.page_style,
      sourcePageSettings.theme_style
    );

  if (req.session.guestbookPreview && Number(req.session.guestbookPreview.character_id) === id) {
    delete req.session.guestbookPreview;
  }

  setFlash(req, "success", `Seite ${nextPageNumber} erstellt.`);
  return res.redirect(buildGuestbookEditorReturnUrl(req, character, info.lastInsertRowid));
});

app.post("/characters/:id/guestbook/edit/delete-page", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const character = getCharacterById(id);

  if (!character) {
    return res.status(404).render("404", { title: "Nicht gefunden" });
  }

  if (character.user_id !== req.session.user.id && !req.session.user.is_admin) {
    return res.status(403).render("error", {
      title: "Kein Zugriff",
      message: "Nur Besitzer oder Admins dürfen das Gästebuch bearbeiten."
    });
  }

  const pages = ensureGuestbookPages(id);
  if (pages.length <= 1) {
    setFlash(req, "error", "Mindestens eine Seite muss bestehen bleiben.");
    return res.redirect(buildGuestbookEditorReturnUrl(req, character, pages[0].id));
  }

  const requestedPageId = Number(req.body.page_id);
  const pageToDelete = pages.find((page) => page.id === requestedPageId) || pages[pages.length - 1];

  const removeTx = db.transaction(() => {
    deleteGuestbookNotificationsForCharacterPage(id, pageToDelete.id);
    db.prepare("DELETE FROM guestbook_entries WHERE character_id = ? AND guestbook_page_id = ?").run(
      id,
      pageToDelete.id
    );
    db.prepare("DELETE FROM guestbook_pages WHERE id = ? AND character_id = ?").run(
      pageToDelete.id,
      id
    );
  });
  removeTx();

  renumberGuestbookPages(id);
  const remainingPages = ensureGuestbookPages(id);
  const redirectPage = remainingPages[0];
  if (req.session.guestbookPreview && Number(req.session.guestbookPreview.character_id) === id) {
    delete req.session.guestbookPreview;
  }
  setFlash(req, "success", "Aktuelle Seite gelöscht.");
  return res.redirect(buildGuestbookEditorReturnUrl(req, character, redirectPage.id));
});

app.get("/chat", requireAuth, (req, res) => {
  const requestedServerId = normalizeServer(req.query.server);
  const requestedStandardRoomId = String(req.query.standard_room || "").trim().toLowerCase();
  const requestedCharacterId = Number(req.query.character_id);
  const roomId = Number(req.query.room_id);
  let activeServerId = requestedServerId;
  let activeRoom = null;
  let activeCharacter = null;
  let standardRoom = null;

  if (Number.isInteger(roomId) && roomId > 0) {
    let room = getRoomWithCharacter(roomId);
    if (!room) {
      setFlash(req, "error", "Raum wurde nicht gefunden.");
      return res.redirect("/dashboard");
    }

    room = ensureSavedRoomVisibleForOwner(room, req.session.user.id);

    if (!canAccessRoom(req.session.user, room)) {
      return res.status(403).render("error", {
        title: "Kein Zugriff",
        message: "Dieser Raum ist nicht für dich sichtbar."
      });
    }

    if (isRoomLockedForUser(req.session.user, room)) {
      setFlash(req, "error", "Dieser Raum ist abgeschlossen.");
      return res.redirect(`/characters/${room.character_id}#roomlist`);
    }

    activeRoom = {
      id: room.id,
      name: room.name,
      description: room.description,
      teaser: room.teaser,
      is_locked: Number(room.is_locked) === 1,
      is_festplay_chat: Number(room.is_festplay_chat) === 1,
      festplay_id: Number(room.festplay_id) || null,
      category: "Offplay",
      has_room_rights: canBypassRoomLock(req.session.user, room),
      owner_name: room.room_owner_name
    };
    activeServerId = normalizeServer(room.server_id || room.character_server_id);
  }

  if (!activeCharacter) {
    const preferredCharacterIdFromSession = getPreferredCharacterIdFromSession(req, activeServerId);
    const chosenCharacterId =
      Number.isInteger(requestedCharacterId) && requestedCharacterId > 0
        ? requestedCharacterId
        : preferredCharacterIdFromSession;
    const preferredCharacter =
      activeRoom?.is_festplay_chat && Number.isInteger(activeRoom?.festplay_id)
        ? getPreferredFestplayChatCharacterForUser(
            req.session.user.id,
            activeRoom.festplay_id,
            chosenCharacterId
          )
        : getPreferredCharacterForUser(
            req.session.user.id,
            activeServerId,
            chosenCharacterId
          );

    if (preferredCharacter) {
      rememberPreferredCharacter(req, preferredCharacter);
      activeCharacter = {
        id: preferredCharacter.id,
        name: preferredCharacter.name,
        is_owner: true,
        server_id: normalizeServer(preferredCharacter.server_id),
        chat_text_color: normalizeGuestbookColor(preferredCharacter.chat_text_color)
      };
    }
  }

  if (!activeRoom) {
    standardRoom = getStandardRoomForServer(activeServerId, requestedStandardRoomId);
  }

  const messages = [];

  const onlineCharacters = getOnlineCharactersForChannel(
    activeRoom ? activeRoom.id : null,
    activeServerId
  );

  return res.render("chat", {
    title: activeRoom
      ? `${getServerLabel(activeServerId)} Raum: ${activeRoom.name}`
      : standardRoom
        ? `${getServerLabel(activeServerId)} Raum: ${standardRoom.name}`
        : `${getServerLabel(activeServerId)} Chat`,
    messages,
    activeRoom,
    activeRoomDescriptionHtml: activeRoom?.teaser ? renderGuestbookBbcode(activeRoom.teaser) : "",
    activeCharacter,
    activeServerId,
    standardRoom,
    onlineCharacters
  });
});

app.post("/chat/disconnect-now", requireAuth, async (req, res) => {
  const requestedSocketId = String(req.body.socketId || "").trim();
  if (!requestedSocketId) {
    return res.sendStatus(204);
  }

  const memberSocket = io.sockets.sockets.get(requestedSocketId);
  if (!memberSocket || Number(memberSocket.data?.user?.id) !== Number(req.session.user?.id)) {
    return res.sendStatus(204);
  }

  const previousRoomId =
    Number.isInteger(memberSocket.data?.roomId) && memberSocket.data.roomId > 0
      ? memberSocket.data.roomId
      : null;
  const previousServerId = ALLOWED_SERVER_IDS.has(String(memberSocket.data?.serverId || "").trim().toLowerCase())
    ? normalizeServer(memberSocket.data.serverId)
    : null;
  if (!previousServerId) {
    return res.sendStatus(204);
  }

  const previousCharacterId = getSocketPreferredCharacterId(memberSocket, previousServerId);
  const disconnectDisplayProfile = getSocketDisplayProfile(memberSocket, previousServerId);

  if (memberSocket.data.isTyping) {
    memberSocket.data.isTyping = false;
    emitChatTypingState(memberSocket, previousRoomId, previousServerId);
  }

  clearPendingChatDisconnect(
    memberSocket.data.user.id,
    previousRoomId,
    previousServerId,
    previousCharacterId
  );

  schedulePendingChatDisconnect({
    userId: memberSocket.data.user.id,
    characterId: previousCharacterId,
    roomId: previousRoomId,
    serverId: previousServerId,
    displayName: disconnectDisplayProfile.label || `User ${memberSocket.data.user?.id || "?"}`,
    chatTextColor: disconnectDisplayProfile?.chat_text_color || "",
    skipPresence: memberSocket.data.skipDisconnectPresence === true
  });

  memberSocket.data.immediateDisconnectHandled = true;
  await Promise.resolve(memberSocket.leave(socketChannelForRoom(previousRoomId, previousServerId)));
  memberSocket.disconnect(true);
  memberSocket.data.roomId = null;
  memberSocket.data.serverId = null;
  memberSocket.data.presenceServerId = null;
  maybeRemoveEmptyRoom(previousRoomId);
  return res.sendStatus(204);
});

function getAdminUsersOverview() {
  const userColumns = getUsersTableColumnSet();
  const emailExpr = userColumns.has("email") ? "u.email" : "'' AS email";
  const birthDateExpr = userColumns.has("birth_date")
    ? "u.birth_date"
    : "'' AS birth_date";
  const accountNumberExpr = userColumns.has("account_number")
    ? "u.account_number"
    : "'' AS account_number";
  const loginIpExpr = userColumns.has("last_login_ip")
    ? "u.last_login_ip"
    : "'' AS last_login_ip";
  const loginAtExpr = userColumns.has("last_login_at")
    ? "u.last_login_at"
    : "'' AS last_login_at";
  const duplicateAccountsAllowedExpr = userColumns.has("duplicate_accounts_allowed")
    ? "u.duplicate_accounts_allowed"
    : "0 AS duplicate_accounts_allowed";

  return db
    .prepare(
      `SELECT u.id, u.username, ${emailExpr}, ${birthDateExpr}, ${loginIpExpr}, ${loginAtExpr},
              ${duplicateAccountsAllowedExpr},
              u.is_admin, u.is_moderator, u.admin_display_name, u.moderator_display_name, u.created_at,
              ${accountNumberExpr},
              COUNT(c.id) AS character_count
       FROM users u
       LEFT JOIN characters c ON c.user_id = u.id
       GROUP BY u.id
       ORDER BY lower(u.username) ASC, u.id ASC`
    )
    .all()
    .map((user) => ({
      ...user,
      account_number: getAccountNumberByUserId(user.id)
    }));
}

function decorateAdminUsers(users) {
  const ipUsage = new Map();
  for (const user of users) {
    const ip = String(user.last_login_ip || "").trim();
    if (!ip) continue;
    ipUsage.set(ip, (ipUsage.get(ip) || 0) + 1);
  }

  return users.map((user) => {
    const reasons = [];
    const email = String(user.email || "").trim();
    const ip = String(user.last_login_ip || "").trim();

    if (email && isDisposableEmailDomain(email)) {
      reasons.push("Wegwerf-E-Mail");
    }

    if (ip && (ipUsage.get(ip) || 0) >= 3) {
      reasons.push(`Mehrere Accounts über dieselbe IP (${ipUsage.get(ip)})`);
    }

    return {
      ...user,
      suspicion_reasons: reasons,
      is_suspicious: reasons.length > 0
    };
  });
}

function getAdminUserCharacters(userId) {
  return db
    .prepare(
      `SELECT c.id, c.name, c.server_id, c.is_public, c.updated_at,
              (
                SELECT COUNT(*)
                FROM guestbook_pages gp
                WHERE gp.character_id = c.id
              ) AS page_count,
              (
                SELECT COUNT(*)
                FROM guestbook_entries ge
                WHERE ge.character_id = c.id
              ) AS entry_count
       FROM characters c
       WHERE c.user_id = ?
       ORDER BY c.updated_at DESC, c.id DESC`
    )
    .all(userId);
}

function getStaffPanelConfig(user) {
  if (user?.is_admin) {
    return {
      pageTitle: "Adminbereich",
      panelTitle: "Adminbereich",
      panelBasePath: "/admin",
      userDetailsBasePath: "/admin/users",
      backLabel: "Zurück zum Adminbereich",
      canEditUsers: true,
      canResetPasswords: true,
      canManageUsers: true,
      canDeleteUsers: true,
      canClearGuestbooks: true
    };
  }

  return {
    pageTitle: "Moderatorenbereich",
    panelTitle: "Moderatorenbereich",
    panelBasePath: "/staff",
    userDetailsBasePath: "/staff/users",
    backLabel: "Zurück zum Moderatorenbereich",
    canEditUsers: false,
    canResetPasswords: false,
    canManageUsers: false,
    canDeleteUsers: false,
    canClearGuestbooks: false
  };
}

function renderStaffOverview(req, res) {
  const panelConfig = getStaffPanelConfig(req.session.user);
  const users = decorateAdminUsers(getAdminUsersOverview());
  const suspiciousUsers = users.filter((user) => user.is_suspicious);

  const adminCount = db
    .prepare("SELECT COUNT(*) AS count FROM users WHERE is_admin = 1")
    .get().count;
  const moderatorCount = db
    .prepare("SELECT COUNT(*) AS count FROM users WHERE is_moderator = 1")
    .get().count;
  const accountCount = db
    .prepare("SELECT COUNT(*) AS count FROM users")
    .get().count;

  return res.render("admin", {
    title: panelConfig.pageTitle,
    panelTitle: panelConfig.panelTitle,
    panelBasePath: panelConfig.panelBasePath,
    userDetailsBasePath: panelConfig.userDetailsBasePath,
    backLabel: panelConfig.backLabel,
    canEditUsers: panelConfig.canEditUsers,
    canResetPasswords: panelConfig.canResetPasswords,
    canManageUsers: panelConfig.canManageUsers,
    canDeleteUsers: panelConfig.canDeleteUsers,
    canClearGuestbooks: panelConfig.canClearGuestbooks,
    users,
    suspiciousUsers,
    accountCount,
    adminCount,
    moderatorCount
  });
}

function renderStaffUserDetails(req, res) {
  const panelConfig = getStaffPanelConfig(req.session.user);
  const targetId = Number(req.params.id);
  if (!Number.isInteger(targetId) || targetId < 1) {
    setFlash(req, "error", "User-ID ist ungültig.");
    return res.redirect(panelConfig.panelBasePath);
  }

  const users = decorateAdminUsers(getAdminUsersOverview());
  const targetUser = users.find((user) => Number(user.id) === targetId);
  if (!targetUser) {
    setFlash(req, "error", "User wurde nicht gefunden.");
    return res.redirect(panelConfig.panelBasePath);
  }

  const userCharacters = getAdminUserCharacters(targetId);

  return res.render("admin-user", {
    title: `${panelConfig.panelTitle}: ${targetUser.username}`,
    panelTitle: panelConfig.panelTitle,
    panelBasePath: panelConfig.panelBasePath,
    userDetailsBasePath: panelConfig.userDetailsBasePath,
    backLabel: panelConfig.backLabel,
    canEditUsers: panelConfig.canEditUsers,
    canResetPasswords: panelConfig.canResetPasswords,
    canManageUsers: panelConfig.canManageUsers,
    canDeleteUsers: panelConfig.canDeleteUsers,
    canClearGuestbooks: panelConfig.canClearGuestbooks,
    targetUser,
    userCharacters
  });
}

app.get("/admin", requireAuth, requireAdmin, renderStaffOverview);

app.post("/admin/impersonate", requireAuth, requireAdmin, (req, res) => {
  const username = String(req.body.username || "").trim().slice(0, 24);
  if (!username) {
    setFlash(req, "error", "Bitte gib einen Benutzernamen ein.");
    return res.redirect("/admin");
  }

  const originalAdminId = Number(req.session.admin_impersonator_user_id || req.session.user?.id);
  const originalAdmin = getUserForSessionById(originalAdminId);
  if (!originalAdmin || originalAdmin.is_admin !== 1) {
    clearAdminImpersonationSession(req.session);
    req.session.user = null;
    setFlash(req, "error", "Der Admin-Account konnte nicht mehr gepr\u00fcft werden.");
    return res.redirect("/login");
  }

  const targetUser = getUserForSessionByUsername(username);
  if (!targetUser) {
    setFlash(req, "error", "Dieser Benutzer wurde nicht gefunden.");
    return res.redirect("/admin");
  }

  if (Number(targetUser.id) === Number(originalAdmin.id)) {
    setFlash(req, "error", "Das ist dein eigener Admin-Account.");
    return res.redirect("/admin");
  }

  if (Number(targetUser.id) === Number(req.session.user?.id)) {
    setFlash(req, "error", "Diesen Benutzer testest du bereits.");
    return res.redirect("/dashboard");
  }

  req.session.admin_impersonator_user_id = Number(originalAdmin.id);
  req.session.user = toSessionUser(targetUser);
  req.session.cookie.maxAge = getSessionMaxAgeForUser(req.session.user);
  setFlash(req, "success", `${originalAdmin.username} testet jetzt ${targetUser.username}.`);
  return res.redirect("/dashboard");
});

app.get("/staff", requireAuth, requireStaff, renderStaffOverview);

app.get("/admin/users/:id", requireAuth, requireAdmin, renderStaffUserDetails);
app.get("/staff/users/:id", requireAuth, requireStaff, renderStaffUserDetails);

app.post("/admin/impersonation/stop", requireAuth, (req, res) => {
  const adminUserId = Number(req.session.admin_impersonator_user_id);
  if (!Number.isInteger(adminUserId) || adminUserId < 1) {
    setFlash(req, "error", "Es ist kein Admin-Testmodus aktiv.");
    return res.redirect("/dashboard");
  }

  const adminUser = getUserForSessionById(adminUserId);
  if (!adminUser || adminUser.is_admin !== 1) {
    clearAdminImpersonationSession(req.session);
    req.session.user = null;
    setFlash(req, "error", "Der Admin-Account konnte nicht wiederhergestellt werden.");
    return res.redirect("/login");
  }

  clearAdminImpersonationSession(req.session);
  req.session.user = toSessionUser(adminUser);
  req.session.cookie.maxAge = getSessionMaxAgeForUser(req.session.user);
  setFlash(req, "success", `Du bist wieder als ${adminUser.username} eingeloggt.`);
  return res.redirect("/admin");
});

app.post("/admin/festplays", requireAuth, requireAdmin, (req, res) => {
  const name = (req.body.name || "").trim().slice(0, 80);
  if (name.length < 2) {
    setFlash(req, "error", "Festplay-Name muss mindestens 2 Zeichen haben.");
    return res.redirect("/admin");
  }

  const existing = db
    .prepare("SELECT id FROM festplays WHERE lower(name) = lower(?)")
    .get(name);
  if (existing) {
    setFlash(req, "error", "Dieses Festplay existiert bereits.");
    return res.redirect("/admin");
  }

  db.prepare(
    `INSERT INTO festplays (name, created_by_user_id, creator_character_id, last_activity_at)
     VALUES (?, ?, NULL, CURRENT_TIMESTAMP)`
  ).run(name, req.session.user.id);

  setFlash(req, "success", "Festplay erstellt.");
  return res.redirect("/admin");
});

app.post("/admin/festplays/:id/delete", requireAuth, requireAdmin, (req, res) => {
  const festplayId = Number(req.params.id);
  if (!Number.isInteger(festplayId) || festplayId < 1) {
    setFlash(req, "error", "Ungültige Festplay-ID.");
    return res.redirect("/admin");
  }

  const festplay = db
    .prepare("SELECT id, name FROM festplays WHERE id = ?")
    .get(festplayId);
  if (!festplay) {
    setFlash(req, "error", "Festplay wurde nicht gefunden.");
    return res.redirect("/admin");
  }

  const count = db
    .prepare("SELECT COUNT(*) AS count FROM festplays")
    .get().count;
  if (count <= 1) {
    setFlash(req, "error", "Mindestens ein Festplay muss bestehen bleiben.");
    return res.redirect("/admin");
  }

  deleteFestplayAndResetCharacters(festplayId);

  setFlash(req, "success", `Festplay ${festplay.name} gelöscht.`);
  return res.redirect("/admin");
});

app.post("/admin/users/:id/toggle-admin", requireAuth, requireAdmin, (req, res) => {
  const targetId = Number(req.params.id);
  if (!Number.isInteger(targetId) || targetId < 1) {
    return res.status(400).render("error", {
      title: "Ungültige Anfrage",
      message: "User-ID ist ungültig."
    });
  }

  const targetUser = db
    .prepare("SELECT id, username, is_admin FROM users WHERE id = ?")
    .get(targetId);
  if (!targetUser) {
    return res.status(404).render("error", {
      title: "Nicht gefunden",
      message: "User wurde nicht gefunden."
    });
  }

  const action = req.body.action === "demote" ? "demote" : "promote";

  if (action === "demote" && targetUser.id === req.session.user.id) {
    setFlash(req, "error", "Du kannst dich nicht selbst als Admin entfernen.");
    return res.redirect("/admin");
  }

  if (action === "demote") {
    const adminCount = db
      .prepare("SELECT COUNT(*) AS count FROM users WHERE is_admin = 1")
      .get().count;

    if (adminCount <= 1) {
      setFlash(req, "error", "Mindestens ein Admin muss erhalten bleiben.");
      return res.redirect("/admin");
    }
  }

  const nextValue = action === "promote" ? 1 : 0;
  db.prepare("UPDATE users SET is_admin = ? WHERE id = ?").run(nextValue, targetId);
  emitHomeStatsUpdate();

  if (nextValue === 1) {
    setFlash(req, "success", `User ${targetUser.username} ist jetzt Admin.`);
  } else {
    setFlash(req, "success", `User ${targetUser.username} ist kein Admin mehr.`);
  }

  return res.redirect("/admin");
});

app.post("/admin/users/:id/toggle-moderator", requireAuth, requireAdmin, (req, res) => {
  const targetId = Number(req.params.id);
  if (!Number.isInteger(targetId) || targetId < 1) {
    return res.status(400).render("error", {
      title: "Ungültige Anfrage",
      message: "User-ID ist ungültig."
    });
  }

  const targetUser = db
    .prepare("SELECT id, username, is_moderator FROM users WHERE id = ?")
    .get(targetId);
  if (!targetUser) {
    return res.status(404).render("error", {
      title: "Nicht gefunden",
      message: "User wurde nicht gefunden."
    });
  }

  const action = req.body.action === "demote" ? "demote" : "promote";
  const nextValue = action === "promote" ? 1 : 0;
  db.prepare("UPDATE users SET is_moderator = ? WHERE id = ?").run(nextValue, targetId);
  emitHomeStatsUpdate();

  if (nextValue === 1) {
    setFlash(req, "success", `User ${targetUser.username} ist jetzt Moderator.`);
  } else {
    setFlash(req, "success", `User ${targetUser.username} ist kein Moderator mehr.`);
  }

  return res.redirect("/admin");
});

app.post("/admin/users/:id/toggle-duplicate-accounts", requireAuth, requireAdmin, (req, res) => {
  const targetId = Number(req.params.id);
  if (!Number.isInteger(targetId) || targetId < 1) {
    setFlash(req, "error", "User-ID ist ungültig.");
    return res.redirect("/admin");
  }

  const targetUser = db
    .prepare(
      `SELECT id, username, registration_ip, duplicate_accounts_allowed
       FROM users
       WHERE id = ?`
    )
    .get(targetId);
  if (!targetUser) {
    setFlash(req, "error", "User wurde nicht gefunden.");
    return res.redirect("/admin");
  }

  const action = req.body.action === "disable" ? "disable" : "enable";
  const nextValue = action === "enable" ? 1 : 0;

  if (nextValue === 1 && !String(targetUser.registration_ip || "").trim()) {
    setFlash(req, "error", "Für diesen Account ist keine Registrierungs-IP gespeichert.");
    return res.redirect(`/admin/users/${targetId}`);
  }

  db.prepare("UPDATE users SET duplicate_accounts_allowed = ? WHERE id = ?").run(nextValue, targetId);

  if (nextValue === 1) {
    setFlash(req, "success", `Doppelaccounts sind für ${targetUser.username} jetzt freigeschaltet.`);
  } else {
    setFlash(req, "success", `Doppelaccounts sind für ${targetUser.username} jetzt gesperrt.`);
  }

  return res.redirect(`/admin/users/${targetId}`);
});

app.post("/admin/users/:id/update-basic", requireAuth, requireAdmin, (req, res) => {
  const targetId = Number(req.params.id);
  if (!Number.isInteger(targetId) || targetId < 1) {
    setFlash(req, "error", "User-ID ist ungültig.");
    return res.redirect("/admin");
  }

  const username = String(req.body.username || "").trim().slice(0, 24);
  const email = normalizeEmail(req.body.email || "");
  const rawBirthDate = String(req.body.birth_date || "").trim().slice(0, 10);
  const birthDate = rawBirthDate ? normalizeBirthDate(rawBirthDate) : "";

  if (!USERNAME_PATTERN.test(username)) {
    setFlash(
      req,
      "error",
      "Username nur mit Buchstaben, Zahlen, Leerzeichen und . _ + - (3-24 Zeichen)."
    );
    return res.redirect("/admin");
  }

  if (email && !EMAIL_PATTERN.test(email)) {
    setFlash(req, "error", "Bitte eine gültige E-Mail-Adresse verwenden.");
    return res.redirect("/admin");
  }

  if (rawBirthDate && !birthDate) {
    setFlash(req, "error", "Bitte ein gültiges Geburtsdatum verwenden.");
    return res.redirect("/admin");
  }

  const targetUser = db
    .prepare(
      `SELECT id, username, email, birth_date
       FROM users
       WHERE id = ?`
    )
    .get(targetId);
  if (!targetUser) {
    setFlash(req, "error", "User wurde nicht gefunden.");
    return res.redirect("/admin");
  }

  const usernameOwner = db
    .prepare("SELECT id FROM users WHERE username = ?")
    .get(username);
  if (usernameOwner && Number(usernameOwner.id) !== targetId) {
    setFlash(req, "error", "Dieser Username ist bereits vergeben.");
    return res.redirect("/admin");
  }

  if (email) {
    const emailOwner = db
      .prepare("SELECT id FROM users WHERE email = ?")
      .get(email);
    if (emailOwner && Number(emailOwner.id) !== targetId) {
      setFlash(req, "error", "Diese E-Mail-Adresse wird bereits verwendet.");
      return res.redirect("/admin");
    }
  }

  db.prepare(
    `UPDATE users
     SET username = ?,
         email = ?,
         birth_date = ?,
         username_changed_at = CASE WHEN ? != ? THEN CURRENT_TIMESTAMP ELSE username_changed_at END
     WHERE id = ?`
  ).run(username, email, birthDate, username, targetUser.username, targetId);

  if (targetId === Number(req.session.user?.id)) {
    const refreshed = getUserForSessionById(targetId);
    if (refreshed) {
      req.session.user = toSessionUser(refreshed);
    }
  }

  emitHomeStatsUpdate();
  setFlash(req, "success", `Basisdaten für ${targetUser.username} gespeichert.`);
  return res.redirect("/admin");
});

app.post("/admin/users/:id/reset-password", requireAuth, requireAdmin, (req, res) => {
  const targetId = Number(req.params.id);
  if (!Number.isInteger(targetId) || targetId < 1) {
    setFlash(req, "error", "User-ID ist ungültig.");
    return res.redirect("/admin");
  }

  const newPassword = String(req.body.new_password || "");
  if (newPassword.length < 6) {
    setFlash(req, "error", "Neues Passwort muss mindestens 6 Zeichen lang sein.");
    return res.redirect("/admin");
  }

  const targetUser = db
    .prepare("SELECT id, username FROM users WHERE id = ?")
    .get(targetId);
  if (!targetUser) {
    setFlash(req, "error", "User wurde nicht gefunden.");
    return res.redirect("/admin");
  }

  const nextHash = bcrypt.hashSync(newPassword, 10);
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(nextHash, targetId);

  setFlash(req, "success", `Passwort für ${targetUser.username} wurde zurückgesetzt.`);
  return res.redirect("/admin");
});

app.post("/admin/users/:id/delete", requireAuth, requireAdmin, async (req, res) => {
  const targetId = Number(req.params.id);
  if (!Number.isInteger(targetId) || targetId < 1) {
    setFlash(req, "error", "User-ID ist ungültig.");
    return res.redirect("/admin");
  }

  if (targetId === Number(req.session.user?.id)) {
    setFlash(req, "error", "Du kannst deinen eigenen Admin-Account hier nicht löschen.");
    return res.redirect("/admin");
  }

  const targetUser = db
    .prepare("SELECT id, username, email, is_admin FROM users WHERE id = ?")
    .get(targetId);
  if (!targetUser) {
    setFlash(req, "error", "User wurde nicht gefunden.");
    return res.redirect("/admin");
  }

  if (targetUser.is_admin === 1) {
    const adminCount = db
      .prepare("SELECT COUNT(*) AS count FROM users WHERE is_admin = 1")
      .get().count;
    if (adminCount <= 1) {
      setFlash(req, "error", "Mindestens ein Admin muss erhalten bleiben.");
      return res.redirect("/admin");
    }
  }

  try {
    const tx = db.transaction((userId, isAdmin) => {
      if (isAdmin === 1) {
        const replacement = db
          .prepare(
            `SELECT id
             FROM users
             WHERE id != ?
             ORDER BY is_admin DESC, created_at ASC, id ASC
             LIMIT 1`
          )
          .get(userId);

        if (replacement) {
          db.prepare("UPDATE users SET is_admin = 1 WHERE id = ?").run(replacement.id);
        }
      }

      db.prepare("DELETE FROM users WHERE id = ?").run(userId);
    });

    tx(targetUser.id, targetUser.is_admin);
  } catch (error) {
    console.error(error);
    setFlash(req, "error", "User konnte nicht gelöscht werden.");
    return res.redirect("/admin");
  }

  try {
    await sendAccountDeletionEmail({
      username: targetUser.username,
      email: targetUser.email
    });
  } catch (error) {
    console.error("Konnte Account-Lösch-E-Mail nicht senden:", error);
  }

  setFlash(req, "success", `User ${targetUser.username} wurde gelöscht.`);
  return res.redirect("/admin");
});

app.post("/admin/guestbooks/:id/clear", requireAuth, requireAdmin, (req, res) => {
  const characterId = Number(req.params.id);
  if (!Number.isInteger(characterId) || characterId < 1) {
    setFlash(req, "error", "Charakter-ID ist ungültig.");
    return res.redirect("/admin");
  }

  const character = db
    .prepare("SELECT id, name FROM characters WHERE id = ?")
    .get(characterId);
  if (!character) {
    setFlash(req, "error", "Charakter wurde nicht gefunden.");
    return res.redirect("/admin");
  }

  try {
    const tx = db.transaction((id) => {
      const currentSettings = getOrCreateGuestbookSettings(id);
      const resetPageSettings = buildGuestbookPageSettings(currentSettings, currentSettings);
      deleteGuestbookNotificationsForCharacter(id);
      db.prepare("DELETE FROM guestbook_entries WHERE character_id = ?").run(id);
      db.prepare("DELETE FROM guestbook_pages WHERE character_id = ?").run(id);
      db.prepare(
        `INSERT INTO guestbook_pages (
           character_id,
           page_number,
           title,
           content,
           image_url,
           inner_image_url,
           outer_image_url,
           inner_image_opacity,
           outer_image_opacity,
           inner_image_repeat,
           outer_image_repeat,
           frame_color,
           background_color,
           surround_color,
           page_style,
           theme_style
         )
         VALUES (?, 1, '1', '', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        id,
        resetPageSettings.image_url,
        resetPageSettings.inner_image_url,
        resetPageSettings.outer_image_url,
        resetPageSettings.inner_image_opacity,
        resetPageSettings.outer_image_opacity,
        resetPageSettings.inner_image_repeat,
        resetPageSettings.outer_image_repeat,
        resetPageSettings.frame_color,
        resetPageSettings.background_color,
        resetPageSettings.surround_color,
        resetPageSettings.page_style,
        resetPageSettings.theme_style
      );
    });
    tx(characterId);
  } catch (error) {
    console.error(error);
    setFlash(req, "error", "Gästebuch konnte nicht geleert werden.");
    return res.redirect("/admin");
  }

  setFlash(req, "success", `Gästebuch von ${character.name} wurde geleert.`);
  return res.redirect("/admin");
});

app.use((req, res) => {
  res.status(404).render("404", { title: "Nicht gefunden" });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render("error", {
    title: "Serverfehler",
    message: "Es ist ein unerwarteter Fehler aufgetreten."
  });
});

io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, () => {
    socket.data.user = socket.request.session?.user || null;
    socket.data.preferredCharacterIds = normalizePreferredCharacterMap(
      socket.request.session?.preferred_character_ids
    );
    socket.data.activeCharacterId = null;
    next();
  });
});

function socketChannelForRoom(roomId, serverId = DEFAULT_SERVER_ID) {
  if (Number.isInteger(roomId) && roomId > 0) {
    return `room:${roomId}`;
  }
  return `lobby:${getChatScopeServerKey(roomId, serverId)}`;
}

const chatAfkStates = new Map();
const CHAT_AFK_REASON_PREFIXES = [
  "versucht gerade,",
  "muss kurz",
  "ist gerade damit beschäftigt,",
  "nimmt sich einen Moment und",
  "hat sich kurz verabschiedet, um",
  "ist für einen Augenblick weg und",
  "hat sich kurz verloren, um",
  "kümmert sich gerade darum,",
  "wurde kurz abgelenkt und",
  "ist heimlich unterwegs, um",
  "ist für einen Moment verschwunden, um",
  "hat gerade Wichtigeres vor und",
  "wurde von der Realität entführt, um",
  "ist kurz im Nebenplot und",
  "bearbeitet gerade ein dringendes Problem und",
  "musste plötzlich los, um",
  "steht kurz nicht zur Verfügung und",
  "ist eben aus dem Bild, um",
  "macht eine winzige Pause und",
  "ist gerade auf geheimer Mission und"
];
const CHAT_AFK_REASON_SUFFIXES = [
  "den letzten Keks zu retten",
  "einen widerspenstigen Umhang zu falten",
  "einem Teebeutel gut zuzureden",
  "das Sockenmysterium zu lösen",
  "einen verirrten Würfel einzusammeln",
  "eine Tür ohne Tür zu finden",
  "den inneren Dramabalken neu zu justieren",
  "einer Brieftaube den Weg zu erklären",
  "ein beleidigtes Schwert zu besänftigen",
  "den Plot kurz wieder einzufangen"
];
const CHAT_AUTOMATIC_AFK_REASONS = CHAT_AFK_REASON_PREFIXES.flatMap((prefix) =>
  CHAT_AFK_REASON_SUFFIXES.map((suffix) => `${prefix} ${suffix}`)
);
const CHAT_CHARACTER_SWITCH_SUFFIXES = [
  "wirbelt einmal durch eine Wolke aus Funken und taucht als %NAME% wieder auf.",
  "zieht kurz einen schiefen Zauber durch die Luft und steht plötzlich als %NAME% da.",
  "verheddert sich für einen Herzschlag im Plot und landet dann als %NAME% wieder auf den Füßen.",
  "tauscht mit einem frechen Grinsen die Rolle und antwortet ab jetzt als %NAME%.",
  "blinzelt, knistert einmal magisch und ist im nächsten Moment %NAME%.",
  "verschwindet in einem Puff aus Theaternebel und kehrt als %NAME% zurück."
];

function normalizePresenceCharacterId(characterId) {
  const parsedCharacterId = Number(characterId);
  return Number.isInteger(parsedCharacterId) && parsedCharacterId > 0 ? parsedCharacterId : null;
}

function getPresenceIdentityKey(userId, characterId = null) {
  const parsedUserId = Number(userId);
  if (!Number.isInteger(parsedUserId) || parsedUserId < 1) {
    return "";
  }

  const parsedCharacterId = normalizePresenceCharacterId(characterId);
  return parsedCharacterId ? `character:${parsedCharacterId}` : `user:${parsedUserId}`;
}

function getChatAfkStateKey(userId, roomId, serverId = DEFAULT_SERVER_ID, characterId = null) {
  const scopeServerKey = getChatScopeServerKey(roomId, serverId);
  const roomKey = Number.isInteger(roomId) && roomId > 0 ? String(roomId) : "lobby";
  const presenceKey = getPresenceIdentityKey(userId, characterId);
  return `${presenceKey}:${scopeServerKey}:${roomKey}`;
}

function getChatAfkState(userId, roomId, serverId = DEFAULT_SERVER_ID, characterId = null) {
  if (!getPresenceIdentityKey(userId, characterId)) {
    return null;
  }

  return chatAfkStates.get(getChatAfkStateKey(userId, roomId, serverId, characterId)) || null;
}

function getRandomAutomaticAfkReason() {
  if (!CHAT_AUTOMATIC_AFK_REASONS.length) {
    return "kurz in einem mysteriösen Nebenplot verschwunden";
  }

  return CHAT_AUTOMATIC_AFK_REASONS[crypto.randomInt(CHAT_AUTOMATIC_AFK_REASONS.length)];
}

function emitChatAfkStateToChannel(userId, roomId, serverId = DEFAULT_SERVER_ID, characterId = null) {
  const parsedUserId = Number(userId);
  if (!Number.isInteger(parsedUserId) || parsedUserId < 1) {
    return;
  }

  const normalizedServerId = normalizeServer(serverId);
  const normalizedRoomId = Number.isInteger(roomId) && roomId > 0 ? roomId : null;
  const parsedCharacterId = normalizePresenceCharacterId(characterId);
  const afkState = getChatAfkState(parsedUserId, normalizedRoomId, normalizedServerId, parsedCharacterId);
  const presenceKey = getPresenceIdentityKey(parsedUserId, parsedCharacterId);

  io.to(socketChannelForRoom(normalizedRoomId, normalizedServerId)).emit("chat:afk-state", {
    user_id: parsedUserId,
    character_id: parsedCharacterId,
    presence_key: presenceKey,
    active: Boolean(afkState),
    mode: afkState?.mode || "",
    reason: afkState?.reason || ""
  });
}

function emitChatAfkStateToSocket(memberSocket, roomId, serverId = DEFAULT_SERVER_ID) {
  const parsedUserId = Number(memberSocket?.data?.user?.id);
  if (!memberSocket || !Number.isInteger(parsedUserId) || parsedUserId < 1) {
    return;
  }

  const normalizedServerId = normalizeServer(serverId);
  const normalizedRoomId = Number.isInteger(roomId) && roomId > 0 ? roomId : null;
  const presenceIdentity = getSocketPresenceIdentity(memberSocket, normalizedServerId);
  if (!presenceIdentity?.key) {
    return;
  }
  const afkState = getChatAfkState(
    parsedUserId,
    normalizedRoomId,
    normalizedServerId,
    presenceIdentity.characterId
  );
  memberSocket.emit("chat:afk-state", {
    user_id: parsedUserId,
    character_id: presenceIdentity.characterId,
    presence_key: presenceIdentity.key,
    active: Boolean(afkState),
    mode: afkState?.mode || "",
    reason: afkState?.reason || ""
  });
}

function setChatAfkState({
  userId,
  roomId,
  serverId = DEFAULT_SERVER_ID,
  actorName = "",
  roleStyle = "",
  chatTextColor = "",
  reason = "",
  mode = "manual",
  silent = false,
  characterId = null
}) {
  const parsedUserId = Number(userId);
  if (!Number.isInteger(parsedUserId) || parsedUserId < 1) {
    return null;
  }

  const normalizedServerId = normalizeServer(serverId);
  const normalizedRoomId = Number.isInteger(roomId) && roomId > 0 ? roomId : null;
  const parsedCharacterId = normalizePresenceCharacterId(characterId);
  const normalizedActorName = String(actorName || "").trim() || `User ${parsedUserId}`;
  const normalizedReason = String(reason || "").trim() || getRandomAutomaticAfkReason();
  const normalizedMode = String(mode || "").trim().toLowerCase() === "auto" ? "auto" : "manual";
  const afkState = {
    userId: parsedUserId,
    characterId: parsedCharacterId,
    presenceKey: getPresenceIdentityKey(parsedUserId, parsedCharacterId),
    roomId: normalizedRoomId,
    serverId: normalizedServerId,
    actorName: normalizedActorName,
    roleStyle: String(roleStyle || "").trim().toLowerCase(),
    chatTextColor: String(chatTextColor || "").trim(),
    reason: normalizedReason,
    mode: normalizedMode
  };

  chatAfkStates.set(
    getChatAfkStateKey(parsedUserId, normalizedRoomId, normalizedServerId, parsedCharacterId),
    afkState
  );
  emitChatAfkStateToChannel(parsedUserId, normalizedRoomId, normalizedServerId, parsedCharacterId);
  emitOnlineCharacters(normalizedRoomId, normalizedServerId);
  if (!silent) {
    emitSystemChatMessage(
      normalizedRoomId,
      normalizedServerId,
      `ist afk (${normalizedReason})`,
      {
        system_kind: "actor-message",
        presence_actor_name: normalizedActorName,
        presence_actor_role_style: afkState.roleStyle,
        presence_actor_chat_text_color: afkState.chatTextColor
      }
    );
  }
  return afkState;
}

function clearChatAfkState(userId, roomId, serverId = DEFAULT_SERVER_ID, options = {}, characterId = null) {
  const parsedUserId = Number(userId);
  if (!Number.isInteger(parsedUserId) || parsedUserId < 1) {
    return false;
  }

  const normalizedServerId = normalizeServer(serverId);
  const normalizedRoomId = Number.isInteger(roomId) && roomId > 0 ? roomId : null;
  const parsedCharacterId = normalizePresenceCharacterId(characterId);
  const afkStateKey = getChatAfkStateKey(
    parsedUserId,
    normalizedRoomId,
    normalizedServerId,
    parsedCharacterId
  );
  const existingAfkState = chatAfkStates.get(afkStateKey);
  if (!existingAfkState) {
    return false;
  }

  const onlyMode = String(options?.onlyMode || "").trim().toLowerCase();
  if (onlyMode && existingAfkState.mode !== onlyMode) {
    return false;
  }

  chatAfkStates.delete(afkStateKey);

  if (!options?.skipStateEmit) {
    emitChatAfkStateToChannel(
      parsedUserId,
      normalizedRoomId,
      normalizedServerId,
      existingAfkState.characterId
    );
  }

  if (!options?.skipOnlineRefresh) {
    emitOnlineCharacters(normalizedRoomId, normalizedServerId);
  }

  return true;
}

function getSocketLastChatActivityAt(socket) {
  const parsedTimestamp = Number(socket?.data?.lastChatActivityAt);
  return Number.isFinite(parsedTimestamp) && parsedTimestamp > 0 ? parsedTimestamp : 0;
}

function markSocketChatActivity(socket, timestamp = Date.now()) {
  if (!socket?.data) {
    return 0;
  }

  const parsedTimestamp = Number(timestamp);
  const nextTimestamp =
    Number.isFinite(parsedTimestamp) && parsedTimestamp > 0 ? parsedTimestamp : Date.now();
  socket.data.lastChatActivityAt = nextTimestamp;
  return nextTimestamp;
}

function resolveSocketChatChannel(socket) {
  if (!socket?.data?.user) {
    return null;
  }

  const roomId =
    Number.isInteger(socket.data.roomId) && socket.data.roomId > 0
      ? socket.data.roomId
      : null;
  const rawServerId = String(socket.data.serverId || "").trim().toLowerCase();
  if (!ALLOWED_SERVER_IDS.has(rawServerId)) {
    return null;
  }

  let serverId = normalizeServer(rawServerId);
  if (roomId) {
    const room = getRoomWithCharacter(roomId);
    if (!room || !canAccessRoom(socket.data.user, room)) {
      return null;
    }
    serverId = normalizeServer(room.server_id || room.character_server_id);
  }

  return { roomId, serverId };
}

function getLatestChatPresenceActivityAt(socket, roomId, serverId = DEFAULT_SERVER_ID, characterId = null) {
  const presenceIdentity = getSocketPresenceIdentity(socket, serverId, characterId);
  if (!presenceIdentity?.key) {
    return getSocketLastChatActivityAt(socket);
  }

  return getPresenceSocketsInChannel(roomId, serverId, presenceIdentity).reduce(
    (latestTimestamp, memberSocket) =>
      Math.max(latestTimestamp, getSocketLastChatActivityAt(memberSocket)),
    0
  );
}

function maybeSetSocketAutoAfk(socket, now = Date.now()) {
  const userId = Number(socket?.data?.user?.id);
  if (!Number.isInteger(userId) || userId < 1) {
    return false;
  }

  if (!normalizeAutoAfkEnabled(socket.data.user?.auto_afk_enabled)) {
    return false;
  }

  const chatChannel = resolveSocketChatChannel(socket);
  if (!chatChannel) {
    return false;
  }

  const { roomId, serverId } = chatChannel;
  const characterId = getSocketPreferredCharacterId(socket, serverId);
  if (getChatAfkState(userId, roomId, serverId, characterId)) {
    return false;
  }

  const timeoutMs =
    normalizeAfkTimeoutMinutes(socket.data.user?.afk_timeout_minutes) * 60 * 1000;
  const latestActivityAt = getLatestChatPresenceActivityAt(
    socket,
    roomId,
    serverId,
    characterId
  );
  if (!latestActivityAt) {
    markSocketChatActivity(socket, now);
    return false;
  }

  if (now - latestActivityAt < timeoutMs) {
    return false;
  }

  const displayProfile = getSocketDisplayProfile(socket, serverId);
  setChatAfkState({
    userId,
    characterId,
    roomId,
    serverId,
    actorName: displayProfile?.label || getUserDefaultDisplayName(socket.data.user),
    roleStyle: displayProfile?.role_style || "",
    chatTextColor: displayProfile?.chat_text_color || "",
    reason: "",
    mode: "auto"
  });
  return true;
}

function sweepAutoAfkSockets(now = Date.now()) {
  const sockets = io?.of("/")?.sockets;
  if (!sockets || typeof sockets.values !== "function") {
    return;
  }

  for (const socket of sockets.values()) {
    maybeSetSocketAutoAfk(socket, now);
  }
}

function buildChatCharacterSwitchSuffix(nextDisplayName) {
  const safeNextName = String(nextDisplayName || "").trim() || "jemand anderes";
  const template = CHAT_CHARACTER_SWITCH_SUFFIXES.length
    ? CHAT_CHARACTER_SWITCH_SUFFIXES[crypto.randomInt(CHAT_CHARACTER_SWITCH_SUFFIXES.length)]
    : "verwandelt sich mit einem kleinen Funkenschauer in %NAME%.";
  return template.replace(/%NAME%/g, safeNextName);
}

function getPreferredCharacterForUser(
  userId,
  serverId = DEFAULT_SERVER_ID,
  preferredCharacterId = null
) {
  const parsedUserId = Number(userId);
  if (!Number.isInteger(parsedUserId) || parsedUserId < 1) return null;

  const normalizedServerId = normalizeServer(serverId);
  const parsedPreferredCharacterId = Number(preferredCharacterId);
  if (Number.isInteger(parsedPreferredCharacterId) && parsedPreferredCharacterId > 0) {
    const preferredCharacter = db
      .prepare(
        `SELECT c.id,
                c.name,
                c.server_id,
                COALESCE(gs.chat_text_color, '#AEE7B7') AS chat_text_color
         FROM characters c
         LEFT JOIN guestbook_settings gs ON gs.character_id = c.id
         WHERE c.id = ? AND c.user_id = ? AND c.server_id = ?`
      )
      .get(parsedPreferredCharacterId, parsedUserId, normalizedServerId);
    if (preferredCharacter) {
      return preferredCharacter;
    }
  }

  return db
    .prepare(
      `SELECT c.id,
              c.name,
              c.server_id,
              COALESCE(gs.chat_text_color, '#AEE7B7') AS chat_text_color
       FROM characters c
       LEFT JOIN guestbook_settings gs ON gs.character_id = c.id
       WHERE c.user_id = ? AND c.server_id = ?
       ORDER BY lower(c.name) ASC, c.id ASC
       LIMIT 1`
    )
    .get(parsedUserId, normalizedServerId);
}

function findOwnedChatCharactersByName(userId, serverId = DEFAULT_SERVER_ID, rawName = "") {
  const parsedUserId = Number(userId);
  if (!Number.isInteger(parsedUserId) || parsedUserId < 1) {
    return [];
  }

  const normalizedServerId = normalizeServer(serverId);
  const normalizedName = parseInviteCommandArguments(rawName);
  const lookupKey = normalizeInviteTargetLookupKey(normalizedName);
  if (!lookupKey) {
    return [];
  }

  return db
    .prepare(
      `SELECT c.id,
              c.user_id,
              c.name,
              c.server_id,
              COALESCE(gs.chat_text_color, '#AEE7B7') AS chat_text_color
       FROM characters c
       LEFT JOIN guestbook_settings gs ON gs.character_id = c.id
       WHERE c.user_id = ? AND c.server_id = ?
       ORDER BY lower(c.name) ASC, c.id ASC`
    )
    .all(parsedUserId, normalizedServerId)
    .filter((entry) => normalizeInviteTargetLookupKey(entry?.name) === lookupKey);
}

function getSocketsInChannel(roomId, serverId = DEFAULT_SERVER_ID) {
  const normalizedServerId = normalizeServer(serverId);
  const normalizedRoomId = Number.isInteger(roomId) && roomId > 0 ? roomId : null;
  const sockets = [];
  const seenSocketIds = new Set();
  const members = io.sockets.adapter.rooms.get(socketChannelForRoom(normalizedRoomId, normalizedServerId));
  if (members && members.size > 0) {
    for (const socketId of members) {
      const memberSocket = io.sockets.sockets.get(socketId);
      if (memberSocket) {
        seenSocketIds.add(socketId);
        sockets.push(memberSocket);
      }
    }
  }

  const allSockets = io?.of("/")?.sockets;
  if (!allSockets || typeof allSockets.values !== "function") {
    return sockets;
  }

  for (const memberSocket of allSockets.values()) {
    if (
      !memberSocket?.id ||
      seenSocketIds.has(memberSocket.id) ||
      !memberSocket?.data?.user ||
      memberSocket?.data?.hasJoinedChat !== true
    ) {
      continue;
    }

    const socketRoomId =
      Number.isInteger(memberSocket.data.roomId) && memberSocket.data.roomId > 0
        ? memberSocket.data.roomId
        : null;
    const socketServerId = normalizeServer(memberSocket.data.serverId);
    if (socketRoomId !== normalizedRoomId || socketServerId !== normalizedServerId) {
      continue;
    }

    seenSocketIds.add(memberSocket.id);
    sockets.push(memberSocket);
  }

  return sockets;
}

function getSocketsInWatchChannel(roomId, serverId = DEFAULT_SERVER_ID) {
  const members = io.sockets.adapter.rooms.get(socketChannelForRoomWatch(roomId, serverId));
  if (!members || members.size === 0) {
    return [];
  }

  const sockets = [];
  for (const socketId of members) {
    const memberSocket = io.sockets.sockets.get(socketId);
    if (memberSocket) {
      sockets.push(memberSocket);
    }
  }
  return sockets;
}

function emitToRoomChannelMembers(roomId, serverId, eventName, payload) {
  const normalizedServerId = normalizeServer(serverId);
  const normalizedRoomId = Number.isInteger(roomId) && roomId > 0 ? roomId : null;
  const channelName = socketChannelForRoom(normalizedRoomId, normalizedServerId);
  const members = io.sockets.adapter.rooms.get(channelName);
  if (members && members.size > 0) {
    io.to(channelName).emit(eventName, payload);
    return;
  }

  getSocketsInChannel(normalizedRoomId, normalizedServerId).forEach((memberSocket) => {
    memberSocket.emit(eventName, payload);
  });
}

function getUserSocketsInChannel(roomId, serverId = DEFAULT_SERVER_ID, userId) {
  const parsedUserId = Number(userId);
  if (!Number.isInteger(parsedUserId) || parsedUserId < 1) {
    return [];
  }
  return getSocketsInChannel(roomId, serverId).filter(
    (memberSocket) => Number(memberSocket?.data?.user?.id) === parsedUserId
  );
}

function getSocketPresenceIdentity(socket, serverId = DEFAULT_SERVER_ID, overrideCharacterId = null) {
  const userId = Number(socket?.data?.user?.id);
  if (!Number.isInteger(userId) || userId < 1) {
    return null;
  }

  const characterId =
    normalizePresenceCharacterId(overrideCharacterId) ??
    normalizePresenceCharacterId(getSocketPreferredCharacterId(socket, serverId));

  return {
    userId,
    characterId,
    key: getPresenceIdentityKey(userId, characterId)
  };
}

function getPresenceSocketsInChannel(roomId, serverId = DEFAULT_SERVER_ID, presenceIdentity) {
  const presenceKey = String(presenceIdentity?.key || "").trim();
  if (!presenceKey) {
    return [];
  }

  return getSocketsInChannel(roomId, serverId).filter((memberSocket) => {
    const socketServerId = getSocketChannelServerId(memberSocket, roomId, serverId);
    const socketPresence = getSocketPresenceIdentity(memberSocket, socketServerId);
    return socketPresence?.key === presenceKey;
  });
}

function getUserSocketsOnServer(userId, serverId = DEFAULT_SERVER_ID, roomId = null) {
  const parsedUserId = Number(userId);
  const normalizedServerId = normalizeServer(serverId);
  if (!Number.isInteger(parsedUserId) || parsedUserId < 1) {
    return [];
  }

  if (isSharedStandardRoomContext(roomId)) {
    return getSocketsInChannel(null, normalizedServerId).filter(
      (memberSocket) => Number(memberSocket?.data?.user?.id) === parsedUserId
    );
  }

  return getAllSocketsForUser(parsedUserId).filter((memberSocket) => {
    const socketServerId = ALLOWED_SERVER_IDS.has(String(memberSocket?.data?.serverId || "").trim().toLowerCase())
      ? normalizeServer(memberSocket.data.serverId)
      : ALLOWED_SERVER_IDS.has(String(memberSocket?.data?.presenceServerId || "").trim().toLowerCase())
        ? normalizeServer(memberSocket.data.presenceServerId)
        : null;
    return socketServerId === normalizedServerId;
  });
}

function getCurrentChannelDisplayProfile(user, serverId = DEFAULT_SERVER_ID, preferredCharacterId = null) {
  const preferredCharacter = getPreferredCharacterForUser(user?.id, serverId, preferredCharacterId);
  return getUserDisplayProfile(user, preferredCharacter);
}

function getAllSocketsForUser(userId) {
  const parsedUserId = Number(userId);
  if (!Number.isInteger(parsedUserId) || parsedUserId < 1) {
    return [];
  }

  const sockets = [];
  for (const memberSocket of io.sockets.sockets.values()) {
    if (Number(memberSocket?.data?.user?.id) === parsedUserId) {
      sockets.push(memberSocket);
    }
  }
  return sockets;
}

function buildChatRedirectUrlForLocation(roomId, serverId = DEFAULT_SERVER_ID, characterId = null) {
  const normalizedRoomId = Number.isInteger(roomId) && roomId > 0 ? roomId : null;
  const normalizedServerId = normalizeServer(serverId);
  const normalizedCharacterId = normalizePresenceCharacterId(characterId);

  if (normalizedRoomId) {
    const suffix = normalizedCharacterId ? `&character_id=${normalizedCharacterId}` : "";
    return `/chat?room_id=${normalizedRoomId}${suffix}`;
  }

  const defaultStandardRoom = getStandardRoomsForServer(normalizedServerId)[0];
  const standardRoomSuffix = defaultStandardRoom?.id
    ? `&standard_room=${encodeURIComponent(String(defaultStandardRoom.id))}`
    : "";
  const characterSuffix = normalizedCharacterId ? `&character_id=${normalizedCharacterId}` : "";
  return `/chat?server=${encodeURIComponent(normalizedServerId)}${standardRoomSuffix}${characterSuffix}`;
}

function buildCharacterRoomListRedirectUrl(characterId) {
  const normalizedCharacterId = normalizePresenceCharacterId(characterId);
  return normalizedCharacterId ? `/characters/${normalizedCharacterId}#roomlist` : "/dashboard";
}

function getConflictingChatSocketsForCharacter(
  userId,
  serverId = DEFAULT_SERVER_ID,
  characterId = null,
  excludedSocketId = "",
  targetRoomId = null
) {
  const parsedUserId = Number(userId);
  const normalizedServerId = normalizeServer(serverId);
  const normalizedCharacterId = normalizePresenceCharacterId(characterId);
  const normalizedTargetRoomId = Number.isInteger(targetRoomId) && targetRoomId > 0 ? targetRoomId : null;
  const excludedId = String(excludedSocketId || "").trim();

  if (!Number.isInteger(parsedUserId) || parsedUserId < 1 || !normalizedCharacterId) {
    return [];
  }

  const conflicts = [];
  for (const memberSocket of getAllSocketsForUser(parsedUserId)) {
    if (!memberSocket || memberSocket.data?.hasJoinedChat !== true) {
      continue;
    }

    if (excludedId && memberSocket.id === excludedId) {
      continue;
    }

    const memberServerId = ALLOWED_SERVER_IDS.has(String(memberSocket?.data?.serverId || "").trim().toLowerCase())
      ? normalizeServer(memberSocket.data.serverId)
      : ALLOWED_SERVER_IDS.has(String(memberSocket?.data?.presenceServerId || "").trim().toLowerCase())
        ? normalizeServer(memberSocket.data.presenceServerId)
        : null;
    if (memberServerId !== normalizedServerId) {
      continue;
    }

    const memberCharacterId = normalizePresenceCharacterId(
      getSocketPreferredCharacterId(memberSocket, memberServerId)
    );
    if (memberCharacterId !== normalizedCharacterId) {
      continue;
    }

    const memberRoomId =
      Number.isInteger(memberSocket?.data?.roomId) && memberSocket.data.roomId > 0
        ? Number(memberSocket.data.roomId)
        : null;
    if (memberRoomId === normalizedTargetRoomId) {
      continue;
    }

    conflicts.push({
      socket: memberSocket,
      roomId: memberRoomId,
      serverId: memberServerId,
      characterId: memberCharacterId
    });
  }

  return conflicts;
}

function ejectSocketFromActiveChat(memberSocket, options = {}) {
  const previousRoomId =
    Number.isInteger(memberSocket?.data?.roomId) && memberSocket.data.roomId > 0
      ? memberSocket.data.roomId
      : null;
  const previousServerId = ALLOWED_SERVER_IDS.has(String(memberSocket?.data?.serverId || "").trim().toLowerCase())
    ? normalizeServer(memberSocket.data.serverId)
    : ALLOWED_SERVER_IDS.has(String(memberSocket?.data?.presenceServerId || "").trim().toLowerCase())
      ? normalizeServer(memberSocket.data.presenceServerId)
      : null;
  const previousCharacterId = previousServerId
    ? getSocketPreferredCharacterId(memberSocket, previousServerId)
    : null;
  const redirectUrl = String(options?.redirectUrl || "").trim();
  const notice = String(options?.notice || "").trim();

  if (!previousServerId) {
    if (notice) {
      emitDirectSystemMessageToSocket(memberSocket, notice);
    }
    if (redirectUrl.startsWith("/")) {
      memberSocket.emit("chat:redirect", {
        url: redirectUrl,
        delayMs: 650
      });
    }
    return;
  }

  const previousDisplayProfile = getSocketDisplayProfile(memberSocket, previousServerId);
  const previousDisplayName =
    previousDisplayProfile?.label || getUserDefaultDisplayName(memberSocket.data.user);
  const hasOtherPresenceInPreviousChannel = hasOtherSocketInChannel(
    memberSocket.data.user.id,
    previousRoomId,
    previousServerId,
    memberSocket.id,
    previousCharacterId
  );

  if (memberSocket.data.isTyping) {
    memberSocket.data.isTyping = false;
    emitChatTypingState(memberSocket, previousRoomId, previousServerId);
  }

  clearPendingChatDisconnect(
    memberSocket.data.user.id,
    previousRoomId,
    previousServerId,
    previousCharacterId
  );

  memberSocket.leave(socketChannelForRoom(previousRoomId, previousServerId));

  if (!hasOtherPresenceInPreviousChannel) {
    clearChatAfkState(memberSocket.data.user.id, previousRoomId, previousServerId, {
      skipStateEmit: true,
      skipOnlineRefresh: true
    }, previousCharacterId);

    const previousPresenceMessage = buildRoomPresenceMessage("leave", previousDisplayName);
    emitSystemChatMessage(
      previousRoomId,
      previousServerId,
      previousPresenceMessage.text,
      {
        chat_text_color: "#000000",
        system_kind: "presence",
        presence_kind: previousPresenceMessage.kind,
        presence_actor_name: previousPresenceMessage.actorName,
        presence_actor_chat_text_color: previousDisplayProfile?.chat_text_color || "",
        presence_suffix: previousPresenceMessage.suffix
      }
    );
  }

  memberSocket.data.roomId = null;
  memberSocket.data.serverId = null;
  memberSocket.data.presenceServerId = null;
  memberSocket.data.hasJoinedChat = false;
  memberSocket.data.skipDisconnectPresence = true;

  const previousRoomWasRemoved = maybeRemoveEmptyRoom(previousRoomId);
  if (!previousRoomWasRemoved) {
    emitOnlineCharacters(previousRoomId, previousServerId);
  }
  void finalizeRoomLogIfEmpty(previousRoomId, previousServerId);
  emitHomeStatsUpdate();

  if (notice) {
    emitDirectSystemMessageToSocket(memberSocket, notice);
  }
  if (redirectUrl.startsWith("/")) {
    memberSocket.emit("chat:redirect", {
      url: redirectUrl,
      delayMs: 650
    });
  }
}

function ejectConflictingChatSocketsForCharacter(
  userId,
  serverId = DEFAULT_SERVER_ID,
  characterId = null,
  excludedSocketId = "",
  targetRoomId = null
) {
  const conflicts = getConflictingChatSocketsForCharacter(
    userId,
    serverId,
    characterId,
    excludedSocketId,
    targetRoomId
  );

  conflicts.forEach((conflict) => {
    ejectSocketFromActiveChat(conflict.socket, {
      notice: "Dieser Charakter wurde in einem anderen Raum geöffnet. Dieser Tab wurde deshalb aus dem bisherigen Raum entfernt.",
      redirectUrl: buildCharacterRoomListRedirectUrl(conflict.characterId)
    });
  });

  return conflicts.length;
}

function hasOtherSocketInChannel(
  userId,
  roomId,
  serverId = DEFAULT_SERVER_ID,
  excludedSocketId = "",
  characterId = null
) {
  const normalizedServerId = normalizeServer(serverId);
  const normalizedRoomId = Number.isInteger(roomId) && roomId > 0 ? roomId : null;
  const excludedId = String(excludedSocketId || "").trim();
  const presenceKey = getPresenceIdentityKey(userId, characterId);

  return getAllSocketsForUser(userId).some((memberSocket) => {
    if (!memberSocket) {
      return false;
    }

    if (excludedId && memberSocket.id === excludedId) {
      return false;
    }

    const memberServerId = ALLOWED_SERVER_IDS.has(String(memberSocket.data.serverId || "").trim().toLowerCase())
      ? normalizeServer(memberSocket.data.serverId)
      : null;
    const memberRoomId =
      Number.isInteger(memberSocket.data.roomId) && memberSocket.data.roomId > 0
        ? memberSocket.data.roomId
        : null;
    const socketPresence = getSocketPresenceIdentity(memberSocket, normalizedServerId);

    return (
      memberServerId === normalizedServerId &&
      memberRoomId === normalizedRoomId &&
      socketPresence?.key === presenceKey
    );
  });
}

function findInviteTargetsByDisplayName(displayName, serverId = DEFAULT_SERVER_ID, excludeUserId = null) {
  const normalizedLookupKey = normalizeInviteTargetLookupKey(displayName);
  const normalizedServerId = normalizeServer(serverId);
  const parsedExcludeUserId = Number(excludeUserId);
  if (!normalizedLookupKey) {
    return [];
  }

  const matches = [];
  const seenPresenceKeys = new Set();

  for (const memberSocket of io.sockets.sockets.values()) {
    const presenceIdentity = getSocketPresenceIdentity(memberSocket, normalizedServerId);
    const userId = Number(presenceIdentity?.userId);
    if (
      !Number.isInteger(userId) ||
      userId < 1 ||
      (Number.isInteger(parsedExcludeUserId) && userId === parsedExcludeUserId) ||
      !presenceIdentity?.key ||
      seenPresenceKeys.has(presenceIdentity.key)
    ) {
      continue;
    }

    const socketServerId = ALLOWED_SERVER_IDS.has(String(memberSocket?.data?.serverId || "").trim().toLowerCase())
      ? normalizeServer(memberSocket.data.serverId)
      : null;
    if (socketServerId !== normalizedServerId) {
      continue;
    }

    const profile = getCurrentChannelDisplayProfile(
      memberSocket?.data?.user,
      normalizedServerId,
      getSocketPreferredCharacterId(memberSocket, normalizedServerId)
    );
    const displayNameLabel = String(profile?.label || "").trim();
    if (!displayNameLabel || normalizeInviteTargetLookupKey(displayNameLabel) !== normalizedLookupKey) {
      continue;
    }

    matches.push({
      userId,
      characterId: presenceIdentity.characterId,
      presenceKey: presenceIdentity.key,
      roomId:
        Number.isInteger(Number(memberSocket?.data?.roomId)) && Number(memberSocket.data.roomId) > 0
          ? Number(memberSocket.data.roomId)
          : null,
      name: displayNameLabel,
      roleStyle: profile?.role_style || "",
      chatTextColor: profile?.chat_text_color || ""
    });
    seenPresenceKeys.add(presenceIdentity.key);
  }

  return matches;
}

function findWhisperTargetsByDisplayName(displayName, serverId = DEFAULT_SERVER_ID, excludeUserId = null, roomId = null) {
  const normalizedLookupKey = normalizeInviteTargetLookupKey(displayName);
  const normalizedServerId = normalizeServer(serverId);
  const parsedExcludeUserId = Number(excludeUserId);
  if (!normalizedLookupKey) {
    return [];
  }

  const matches = [];
  const seenPresenceKeys = new Set();
  const candidateSockets = isSharedStandardRoomContext(roomId)
    ? getSocketsInChannel(null, normalizedServerId)
    : Array.from(io.sockets.sockets.values());

  for (const memberSocket of candidateSockets) {
    const socketServerId = getSocketChannelServerId(memberSocket, roomId, normalizedServerId);
    const presenceIdentity = getSocketPresenceIdentity(memberSocket, socketServerId);
    const userId = Number(presenceIdentity?.userId);
    if (
      !Number.isInteger(userId) ||
      userId < 1 ||
      (Number.isInteger(parsedExcludeUserId) && userId === parsedExcludeUserId) ||
      !presenceIdentity?.key ||
      seenPresenceKeys.has(presenceIdentity.key)
    ) {
      continue;
    }

    if (!isSharedStandardRoomContext(roomId) && socketServerId !== normalizedServerId) {
      continue;
    }

    const profile = getCurrentChannelDisplayProfile(
      memberSocket?.data?.user,
      socketServerId,
      getSocketPreferredCharacterId(memberSocket, socketServerId)
    );
    const displayNameLabel = String(profile?.label || "").trim();
    if (!displayNameLabel || normalizeInviteTargetLookupKey(displayNameLabel) !== normalizedLookupKey) {
      continue;
    }

    matches.push({
      userId,
      characterId: presenceIdentity.characterId,
      presenceKey: presenceIdentity.key,
      name: displayNameLabel,
      roleStyle: profile?.role_style || "",
      chatTextColor: profile?.chat_text_color || ""
    });
    seenPresenceKeys.add(presenceIdentity.key);
  }

  return matches;
}

function emitWhisperBetweenUsers(senderSocket, targetUserId, content, serverId = DEFAULT_SERVER_ID, roomId = null) {
  const normalizedContent = String(content || "").trim();
  const parsedTargetUserId = Number(targetUserId);
  if (
    !senderSocket?.data?.user ||
    !Number.isInteger(parsedTargetUserId) ||
    parsedTargetUserId < 1 ||
    !normalizedContent
  ) {
    return { ok: false, reason: "invalid" };
  }

  if (parsedTargetUserId === Number(senderSocket.data.user.id)) {
    return { ok: false, reason: "self" };
  }

  const normalizedServerId = normalizeServer(serverId);
  const senderServerId = getSocketChannelServerId(senderSocket, roomId, normalizedServerId);
  const recipientSockets = getUserSocketsOnServer(parsedTargetUserId, normalizedServerId, roomId);
  if (!recipientSockets.length) {
    return { ok: false, reason: "missing_target" };
  }

  const senderSockets = getUserSocketsOnServer(senderSocket.data.user.id, normalizedServerId, roomId);
  const senderProfile = getSocketDisplayProfile(senderSocket, senderServerId);
  const recipientProfile = recipientSockets[0]
    ? getSocketDisplayProfile(
        recipientSockets[0],
        getSocketChannelServerId(recipientSockets[0], roomId, normalizedServerId)
      )
    : null;
  const senderName = senderProfile.label;
  const recipientName = recipientProfile
    ? recipientProfile.label
    : `User ${parsedTargetUserId}`;
  const createdAt = formatChatTimestamp();

  const senderPayload = {
    outgoing: true,
    from_user_id: Number(senderSocket.data.user.id),
    to_user_id: parsedTargetUserId,
    from_name: senderName,
    to_name: recipientName,
    content: normalizedContent,
    created_at: createdAt
  };
  const recipientPayload = {
    outgoing: false,
    from_user_id: Number(senderSocket.data.user.id),
    to_user_id: parsedTargetUserId,
    from_name: senderName,
    to_name: recipientName,
    content: normalizedContent,
    created_at: createdAt
  };

  senderSockets.forEach((memberSocket) => {
    memberSocket.emit("chat:whisper", senderPayload);
  });
  recipientSockets.forEach((memberSocket) => {
    memberSocket.emit("chat:whisper", recipientPayload);
  });

  return {
    ok: true,
    recipientName
  };
}

function getSocketHeaderDisplayProfile(memberSocket) {
  const normalizedServerId = ALLOWED_SERVER_IDS.has(String(memberSocket?.data?.serverId || "").trim().toLowerCase())
    ? normalizeServer(memberSocket.data.serverId)
    : ALLOWED_SERVER_IDS.has(String(memberSocket?.data?.presenceServerId || "").trim().toLowerCase())
      ? normalizeServer(memberSocket.data.presenceServerId)
      : DEFAULT_SERVER_ID;
  const activeCharacterId = Number(memberSocket?.data?.activeCharacterId);
  return getCurrentChannelDisplayProfile(
    memberSocket?.data?.user,
    normalizedServerId,
    Number.isInteger(activeCharacterId) && activeCharacterId > 0 ? activeCharacterId : null
  );
}

function emitUserDisplayProfileToSocket(memberSocket) {
  if (!memberSocket) {
    return;
  }

  const normalizedServerId = ALLOWED_SERVER_IDS.has(String(memberSocket?.data?.serverId || "").trim().toLowerCase())
    ? normalizeServer(memberSocket.data.serverId)
    : ALLOWED_SERVER_IDS.has(String(memberSocket?.data?.presenceServerId || "").trim().toLowerCase())
      ? normalizeServer(memberSocket.data.presenceServerId)
      : DEFAULT_SERVER_ID;
  const profile = getSocketHeaderDisplayProfile(memberSocket);
  memberSocket.emit("user:display-profile", {
    name: profile.label || memberSocket?.data?.user?.display_name || memberSocket?.data?.user?.username || "User",
    role_style: profile.role_style || "",
    chat_text_color: profile.chat_text_color || "",
    character_id: getSocketPreferredCharacterId(memberSocket, normalizedServerId),
    auto_afk_enabled: normalizeAutoAfkEnabled(memberSocket?.data?.user?.auto_afk_enabled),
    afk_timeout_minutes: normalizeAfkTimeoutMinutes(memberSocket?.data?.user?.afk_timeout_minutes)
  });
}

function refreshConnectedUserDisplay(userId) {
  const refreshedUser = getUserForSessionById(userId);
  if (!refreshedUser) {
    return null;
  }

  const sessionUser = toSessionUser(refreshedUser);
  const sockets = getAllSocketsForUser(userId);
  const roomsToRefresh = new Set();
  const typingRefreshTargets = [];

  sockets.forEach((memberSocket) => {
    memberSocket.data.user = sessionUser;

    if (memberSocket.request?.session) {
      memberSocket.request.session.user = sessionUser;
      memberSocket.request.session.save(() => {});
    }

    emitUserDisplayProfileToSocket(memberSocket);

    const roomId =
      Number.isInteger(memberSocket.data?.roomId) && memberSocket.data.roomId > 0
        ? memberSocket.data.roomId
        : null;
    const serverId = ALLOWED_SERVER_IDS.has(String(memberSocket.data?.serverId || "").trim().toLowerCase())
      ? normalizeServer(memberSocket.data.serverId)
      : null;

    if (serverId) {
      roomsToRefresh.add(`${serverId}:${roomId == null ? "lobby" : roomId}`);
      if (memberSocket.data?.isTyping) {
        typingRefreshTargets.push({ socket: memberSocket, roomId, serverId });
      }
    }
  });

  roomsToRefresh.forEach((entry) => {
    const [serverId, roomKey] = String(entry).split(":");
    const roomId = roomKey === "lobby" ? null : Number(roomKey);
    emitOnlineCharacters(roomId, serverId);
  });

  typingRefreshTargets.forEach(({ socket, roomId, serverId }) => {
    emitChatTypingState(socket, roomId, serverId);
  });

  emitSocialStateUpdatesForRelatedUsers(userId);

  return sessionUser;
}

function getSocialFriendRowsForUser(userId) {
  const parsedUserId = Number(userId);
  if (!Number.isInteger(parsedUserId) || parsedUserId < 1) {
    return [];
  }

  return db
    .prepare(
      `SELECT u.id AS user_id,
              u.username,
              u.account_number
         FROM friend_links fl
         JOIN users u ON u.id = fl.friend_user_id
        WHERE fl.user_id = ?
        ORDER BY lower(u.username) ASC, u.id ASC`
    )
    .all(parsedUserId);
}

function getFriendWatcherUserIdsForUser(userId) {
  const parsedUserId = Number(userId);
  if (!Number.isInteger(parsedUserId) || parsedUserId < 1) {
    return [];
  }

  return db
    .prepare(
      `SELECT user_id
         FROM friend_links
        WHERE friend_user_id = ?
        ORDER BY user_id ASC`
    )
    .all(parsedUserId)
    .map((row) => Number(row.user_id))
    .filter((value, index, list) => Number.isInteger(value) && value > 0 && list.indexOf(value) === index);
}

function getIgnoredAccountRowsForUser(userId) {
  const parsedUserId = Number(userId);
  if (!Number.isInteger(parsedUserId) || parsedUserId < 1) {
    return [];
  }

  return db
    .prepare(
      `SELECT u.id AS user_id,
              u.username,
              u.account_number
         FROM ignored_accounts ia
         JOIN users u ON u.id = ia.ignored_user_id
        WHERE ia.user_id = ?
        ORDER BY lower(u.username) ASC, u.id ASC`
    )
    .all(parsedUserId);
}

function getIgnoredCharacterRowsForUser(userId) {
  const parsedUserId = Number(userId);
  if (!Number.isInteger(parsedUserId) || parsedUserId < 1) {
    return [];
  }

  return db
    .prepare(
      `SELECT c.id AS character_id,
              c.name,
              c.user_id AS owner_user_id,
              u.username AS owner_username,
              u.account_number AS owner_account_number
         FROM ignored_characters ic
         JOIN characters c ON c.id = ic.ignored_character_id
         JOIN users u ON u.id = c.user_id
        WHERE ic.user_id = ?
        ORDER BY lower(c.name) ASC, c.id ASC`
    )
    .all(parsedUserId);
}

function normalizeSocialLookupValue(value) {
  return String(value || "").trim().replace(/^#/, "").slice(0, 80);
}

function isPrivilegedStaffUser(user) {
  return Boolean(
    user?.is_admin === 1 ||
      user?.is_admin === true ||
      user?.is_moderator === 1 ||
      user?.is_moderator === true
  );
}

function isSocialBlockProtectedTarget(actorUser, targetUser) {
  return !isPrivilegedStaffUser(actorUser) && isPrivilegedStaffUser(targetUser);
}

function findUserBySocialLookup(value) {
  const normalizedValue = normalizeSocialLookupValue(value);
  if (!normalizedValue) {
    return null;
  }

  if (/^\d+$/.test(normalizedValue)) {
    return db
      .prepare(
        `SELECT id, username, account_number, is_admin, is_moderator
           FROM users
          WHERE account_number = ?
          LIMIT 1`
      )
      .get(normalizedValue);
  }

  const userMatch = db
    .prepare(
      `SELECT id, username, account_number, is_admin, is_moderator
         FROM users
        WHERE lower(username) = lower(?)
        LIMIT 1`
    )
    .get(normalizedValue);
  if (userMatch) {
    return userMatch;
  }

  return db
    .prepare(
      `SELECT u.id,
              u.username,
              u.account_number,
              u.is_admin,
              u.is_moderator
         FROM characters c
         JOIN users u ON u.id = c.user_id
        WHERE lower(c.name) = lower(?)
        ORDER BY c.id ASC
        LIMIT 1`
    )
    .get(normalizedValue);
}

function getCharacterSocialTargetById(characterId) {
  const parsedCharacterId = Number(characterId);
  if (!Number.isInteger(parsedCharacterId) || parsedCharacterId < 1) {
    return null;
  }

  return db
    .prepare(
      `SELECT c.id AS character_id,
              c.name,
              c.user_id,
              u.username AS owner_username,
              u.account_number AS owner_account_number,
              u.is_admin,
              u.is_moderator
         FROM characters c
         JOIN users u ON u.id = c.user_id
        WHERE c.id = ?
        LIMIT 1`
    )
    .get(parsedCharacterId);
}

function pickPrimaryRealtimeSocketForUser(userId) {
  const sockets = getAllSocketsForUser(userId).filter((memberSocket) => memberSocket?.data?.user);
  if (!sockets.length) {
    return null;
  }

  const scoreSocket = (memberSocket) => {
    let score = 0;
    if (memberSocket.data?.hasJoinedChat === true) {
      score += 300;
    }
    if (Number.isInteger(memberSocket.data?.roomId) && memberSocket.data.roomId > 0) {
      score += 80;
    }
    if (ALLOWED_SERVER_IDS.has(String(memberSocket.data?.serverId || "").trim().toLowerCase())) {
      score += 30;
    }
    if (ALLOWED_SERVER_IDS.has(String(memberSocket.data?.presenceServerId || "").trim().toLowerCase())) {
      score += 20;
    }
    if (Number.isInteger(Number(memberSocket.data?.activeCharacterId)) && Number(memberSocket.data.activeCharacterId) > 0) {
      score += 10;
    }
    return score;
  };

  sockets.sort((leftSocket, rightSocket) => scoreSocket(rightSocket) - scoreSocket(leftSocket));
  return sockets[0] || null;
}

function getRealtimePresenceSummaryForUser(userId) {
  const parsedUserId = Number(userId);
  if (!Number.isInteger(parsedUserId) || parsedUserId < 1) {
    return {
      is_online: false
    };
  }

  const primarySocket = pickPrimaryRealtimeSocketForUser(parsedUserId);
  if (!primarySocket) {
    return {
      is_online: false
    };
  }

  const activeServerId = getSocketActiveServerId(primarySocket, DEFAULT_SERVER_ID);
  const characterId = normalizePresenceCharacterId(
    getSocketPreferredCharacterId(primarySocket, activeServerId)
  );
  const displayProfile = getCurrentChannelDisplayProfile(
    primarySocket?.data?.user,
    activeServerId,
    characterId
  );
  const roomId =
    Number.isInteger(primarySocket.data?.roomId) && primarySocket.data.roomId > 0
      ? Number(primarySocket.data.roomId)
      : null;
  const room = roomId ? getRoomWithCharacter(roomId) : null;

  return {
    is_online: true,
    online_name: String(displayProfile?.label || "").trim(),
    role_style: String(displayProfile?.role_style || "").trim(),
    chat_text_color: String(displayProfile?.chat_text_color || "").trim(),
    character_id: characterId,
    server_id: normalizeServer(activeServerId),
    server_label: getServerLabel(activeServerId),
    room_id: roomId,
    room_name: String(room?.name || "").trim()
  };
}

function buildSocialStatePayloadForUser(userId) {
  const parsedUserId = Number(userId);
  if (!Number.isInteger(parsedUserId) || parsedUserId < 1) {
    return {
      friends: [],
      ignored_accounts: [],
      ignored_characters: [],
      friend_user_ids: [],
      ignored_account_user_ids: [],
      ignored_character_ids: []
    };
  }

  const friends = getSocialFriendRowsForUser(parsedUserId).map((row) => {
    const presence = getRealtimePresenceSummaryForUser(row.user_id);
    return {
      user_id: Number(row.user_id),
      is_online: presence.is_online === true,
      online_name: String(presence.online_name || "").trim(),
      role_style: String(presence.role_style || "").trim(),
      chat_text_color: String(presence.chat_text_color || "").trim(),
      character_id: Number.isInteger(Number(presence.character_id)) && Number(presence.character_id) > 0
        ? Number(presence.character_id)
        : null,
      server_id: String(presence.server_id || "").trim(),
      server_label: String(presence.server_label || "").trim(),
      room_id: Number.isInteger(Number(presence.room_id)) && Number(presence.room_id) > 0
        ? Number(presence.room_id)
        : null,
      room_name: String(presence.room_name || "").trim()
    };
  });
  const ignoredAccounts = getIgnoredAccountRowsForUser(parsedUserId).map((row) => ({
    user_id: Number(row.user_id),
    username: String(row.username || "").trim()
  }));
  const ignoredCharacters = getIgnoredCharacterRowsForUser(parsedUserId).map((row) => ({
    character_id: Number(row.character_id),
    name: String(row.name || "").trim(),
    owner_user_id: Number(row.owner_user_id),
    owner_username: String(row.owner_username || "").trim()
  }));

  return {
    friends,
    ignored_accounts: ignoredAccounts,
    ignored_characters: ignoredCharacters,
    friend_user_ids: friends.map((entry) => entry.user_id),
    ignored_account_user_ids: ignoredAccounts.map((entry) => entry.user_id),
    ignored_character_ids: ignoredCharacters.map((entry) => entry.character_id)
  };
}

function emitSocialStateUpdateForUser(userId) {
  const parsedUserId = Number(userId);
  if (!Number.isInteger(parsedUserId) || parsedUserId < 1) {
    return;
  }

  io.to(socketChannelForSocialUpdates(parsedUserId)).emit(
    "social:update",
    buildSocialStatePayloadForUser(parsedUserId)
  );
}

function emitSocialStateUpdatesForRelatedUsers(userId) {
  const parsedUserId = Number(userId);
  if (!Number.isInteger(parsedUserId) || parsedUserId < 1) {
    return;
  }

  const relatedUserIds = new Set([parsedUserId]);
  getFriendWatcherUserIdsForUser(parsedUserId).forEach((watcherUserId) => {
    relatedUserIds.add(watcherUserId);
  });

  relatedUserIds.forEach((relatedUserId) => {
    emitSocialStateUpdateForUser(relatedUserId);
  });
}

function getCurrentChannelDisplayName(user, serverId = DEFAULT_SERVER_ID, preferredCharacterId = null) {
  return getCurrentChannelDisplayProfile(user, serverId, preferredCharacterId).label;
}

function socketChannelForRoomWatch(roomId, serverId = DEFAULT_SERVER_ID) {
  const scopeServerKey = getChatScopeServerKey(roomId, serverId);
  const roomKey = Number.isInteger(roomId) && roomId > 0 ? String(roomId) : "lobby";
  return `watch:${scopeServerKey}:${roomKey}`;
}

function formatChatTimestamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join("-") +
    " " +
    [pad(date.getHours()), pad(date.getMinutes()), pad(date.getSeconds())].join(":");
}

function getRoomLogKey(roomId, serverId = DEFAULT_SERVER_ID) {
  const scopeServerKey = getChatScopeServerKey(roomId, serverId);
  const normalizedRoomId = Number.isInteger(roomId) && roomId > 0 ? String(roomId) : "lobby";
  return `${scopeServerKey}:${normalizedRoomId}`;
}

function getRoomLogLabel(roomId, serverId = DEFAULT_SERVER_ID, room = null) {
  if (room?.name) {
    return String(room.name).trim();
  }

  const normalizedRoomId = Number(roomId);
  if (Number.isInteger(normalizedRoomId) && normalizedRoomId > 0) {
    const persistedRoom = getRoomWithCharacter(normalizedRoomId);
    if (persistedRoom?.name) {
      return String(persistedRoom.name).trim();
    }
  }

  const standardRoom = getStandardRoomsForServer(serverId)[0];
  if (standardRoom?.name) {
    return String(standardRoom.name).trim();
  }

  return `${getServerLabel(serverId)} Chat`;
}

function getChatEmoteActionText(rawText, displayName) {
  const text = String(rawText || "").trim();
  if (!text.toLowerCase().startsWith("/me ")) {
    return "";
  }

  let actionText = text.slice(4).trim();
  const actorName = String(displayName || "").trim();

  if (actorName) {
    const actorPattern = new RegExp(
      `^${String(actorName).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:(?=\\s)|(?=[,.:;!?]))\\s*`,
      "i"
    );
    actionText = actionText.replace(actorPattern, "").trimStart();
  }

  return actionText;
}

function formatRoomLogLine(entry) {
  const createdAt = String(entry?.created_at || "").trim();
  const linePrefix = createdAt ? `[${createdAt}] ` : "";
  const type = String(entry?.type || "chat").trim().toLowerCase();
  const content = String(entry?.content || "").trim();
  if (!content) {
    return "";
  }

  if (type === "system") {
    return `${linePrefix}${content}`;
  }

  const username = String(entry?.username || "Jemand").trim() || "Jemand";
  const emoteAction = getChatEmoteActionText(content, username);
  if (emoteAction) {
    return `${linePrefix}${username} ${emoteAction}`.trim();
  }

  return `${linePrefix}${username}: ${content}`;
}

function mergeFormattedRuns(runs) {
  const merged = [];
  for (const run of Array.isArray(runs) ? runs : []) {
    const text = String(run?.text || "");
    if (!text) continue;

    const normalizedRun = {
      text,
      bold: Boolean(run?.bold),
      italic: Boolean(run?.italic),
      color: String(run?.color || "").trim() || undefined,
      size: Number(run?.size) || undefined
    };

    const previous = merged[merged.length - 1];
    if (
      previous &&
      previous.bold === normalizedRun.bold &&
      previous.italic === normalizedRun.italic &&
      previous.color === normalizedRun.color &&
      previous.size === normalizedRun.size
    ) {
      previous.text += normalizedRun.text;
    } else {
      merged.push(normalizedRun);
    }
  }
  return merged;
}

function parseFormattedRuns(
  text,
  {
    allowItalic = true,
    allowBold = true,
    inheritedItalic = false,
    inheritedBold = false
  } = {}
) {
  const source = String(text || "");
  let cursor = 0;
  let plainBuffer = "";
  const runs = [];

  function flushPlainBuffer() {
    if (!plainBuffer) return;
    runs.push({
      text: plainBuffer,
      italic: inheritedItalic,
      bold: inheritedBold
    });
    plainBuffer = "";
  }

  while (cursor < source.length) {
    const currentChar = source[cursor];

    if (allowItalic && currentChar === "*") {
      const closingIndex = source.indexOf("*", cursor + 1);
      if (closingIndex > cursor + 1) {
        flushPlainBuffer();
        runs.push(
          ...parseFormattedRuns(source.slice(cursor + 1, closingIndex), {
            allowItalic: false,
            allowBold: true,
            inheritedItalic: true,
            inheritedBold
          })
        );
        cursor = closingIndex + 1;
        continue;
      }
    }

    if (allowBold && currentChar === '"') {
      let contentStart = cursor + 1;
      while (source[contentStart] === '"') {
        contentStart += 1;
      }

      const closingIndex = source.indexOf('"', contentStart);
      if (closingIndex > contentStart) {
        let contentEnd = closingIndex;
        while (contentEnd > contentStart && source[contentEnd - 1] === '"') {
          contentEnd -= 1;
        }

        if (contentEnd > contentStart) {
          flushPlainBuffer();
          runs.push(
            ...parseFormattedRuns(source.slice(contentStart, contentEnd), {
              allowItalic: true,
              allowBold: false,
              inheritedItalic,
              inheritedBold: true
            })
          );

          cursor = closingIndex + 1;
          while (source[cursor] === '"') {
            cursor += 1;
          }
          continue;
        }
      }
    }

    plainBuffer += currentChar;
    cursor += 1;
  }

  flushPlainBuffer();
  return mergeFormattedRuns(runs);
}

function getRoleColor(roleStyle = "") {
  const normalizedRoleStyle = String(roleStyle || "").trim().toLowerCase();
  if (normalizedRoleStyle === "admin") return "2ea8ff";
  if (normalizedRoleStyle === "moderator") return "68c7ff";
  return "1f2a37";
}

function buildSystemLogRuns(content) {
  const text = String(content || "").trim();
  if (!text) return [];

  const matchingSuffix = ROOM_PRESENCE_SUFFIXES.find((suffix) => text.endsWith(suffix));
  if (matchingSuffix) {
    const actorName = text.slice(0, -matchingSuffix.length).trim();
    if (actorName) {
      return mergeFormattedRuns([
        { text: actorName, bold: true, italic: true, color: "55759a" },
        { text: matchingSuffix, italic: true, color: "55759a" }
      ]);
    }
  }

  return mergeFormattedRuns(
    parseFormattedRuns(text, {
      allowItalic: true,
      allowBold: true,
      inheritedItalic: true
    }).map((run) => ({
      ...run,
      color: "55759a"
    }))
  );
}

function buildLogEntryRuns(entry) {
  const createdAt = String(entry?.created_at || "").trim();
  const timestampPrefix = createdAt ? `[${createdAt}] ` : "";
  const type = String(entry?.type || "chat").trim().toLowerCase();
  const content = String(entry?.content || "").trim();
  if (!content) {
    return [];
  }

  const runs = [];
  if (timestampPrefix) {
    runs.push({ text: timestampPrefix, color: "7a8699", size: 18 });
  }

  if (type === "system") {
    runs.push(...buildSystemLogRuns(content));
    return mergeFormattedRuns(runs);
  }

  const username = String(entry?.username || "Jemand").trim() || "Jemand";
  const roleColor = getRoleColor(entry?.role_style);
  const emoteAction = getChatEmoteActionText(content, username);

  if (emoteAction) {
    runs.push({ text: username, bold: true, italic: true, color: roleColor });
    runs.push({ text: " ", italic: true, color: "425a73" });
    runs.push(
      ...parseFormattedRuns(emoteAction, {
        allowItalic: false,
        allowBold: true,
        inheritedItalic: true
      }).map((run) => ({
        ...run,
        italic: true,
        color: "425a73"
      }))
    );
    return mergeFormattedRuns(runs);
  }

  runs.push({ text: username, bold: true, color: roleColor });
  runs.push({ text: ": ", color: "1f2a37" });
  runs.push(
    ...parseFormattedRuns(content, {
      allowItalic: true,
      allowBold: true
    }).map((run) => ({
      ...run,
      color: "1f2a37"
    }))
  );

  return mergeFormattedRuns(runs);
}

function sanitizeAttachmentFilenamePart(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase()
    .slice(0, 60) || "chat-log";
}

function buildRoomLogAttachmentBaseName(roomLabel, endedAt) {
  const safeRoomLabel = sanitizeAttachmentFilenamePart(roomLabel || "chat-log");
  const safeDate = String(endedAt || "")
    .replace(/[^0-9]/g, "")
    .slice(0, 14) || formatChatTimestamp().replace(/[^0-9]/g, "").slice(0, 14);
  return `${safeRoomLabel}-${safeDate}`;
}

function createRoomLogPdfBuffer(payload) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: 48,
        info: {
          Title: `Chat-Log: ${payload.roomLabel}`,
          Author: "Heldenhafte Reisen"
        }
      });
      const chunks = [];

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      doc.font("Helvetica-Bold").fontSize(22).fillColor("#16324f").text(`Chat-Log: ${payload.roomLabel}`);
      doc.moveDown(0.35);
      doc.font("Helvetica").fontSize(10).fillColor("#4b5c70").text(`Gestartet: ${payload.startedAt}`);
      doc.text(`Beendet: ${payload.endedAt}`);
      if (payload.endReasonText) {
        doc.text(`Grund: ${payload.endReasonText}`);
      }
      if (payload.participantNames?.length) {
        doc.text(`Beteiligte: ${payload.participantNames.join(", ")}`);
      }
      doc.moveDown(0.7);

      for (const entry of payload.entries || []) {
        const runs = buildLogEntryRuns(entry);
        if (!runs.length) continue;

        runs.forEach((run, index) => {
          let fontName = "Helvetica";
          if (run.bold && run.italic) fontName = "Helvetica-BoldOblique";
          else if (run.bold) fontName = "Helvetica-Bold";
          else if (run.italic) fontName = "Helvetica-Oblique";

          doc
            .font(fontName)
            .fontSize(run.size ? run.size / 2 : 10.5)
            .fillColor(run.color ? `#${run.color}` : "#1f2a37")
            .text(run.text, {
              continued: index < runs.length - 1,
              lineGap: 2
            });
        });
        doc.moveDown(0.45);
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

async function createRoomLogDocxBuffer(payload) {
  const paragraphs = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      children: [
        new TextRun({
          text: `Chat-Log: ${payload.roomLabel}`,
          color: "16324f"
        })
      ]
    }),
    new Paragraph({
      children: [new TextRun({ text: `Gestartet: ${payload.startedAt}`, color: "4b5c70" })]
    }),
    new Paragraph({
      children: [new TextRun({ text: `Beendet: ${payload.endedAt}`, color: "4b5c70" })]
    })
  ];

  if (payload.endReasonText) {
    paragraphs.push(
      new Paragraph({
        children: [new TextRun({ text: `Grund: ${payload.endReasonText}`, color: "4b5c70" })]
      })
    );
  }

  if (payload.participantNames?.length) {
    paragraphs.push(
      new Paragraph({
        children: [new TextRun({ text: `Beteiligte: ${payload.participantNames.join(", ")}`, color: "4b5c70" })]
      })
    );
  }

  paragraphs.push(new Paragraph({ text: "" }));

  for (const entry of payload.entries || []) {
    const runs = buildLogEntryRuns(entry);
    if (!runs.length) continue;

    paragraphs.push(
      new Paragraph({
        spacing: {
          after: 120
        },
        children: runs.map(
          (run) =>
            new TextRun({
              text: run.text,
              bold: run.bold,
              italics: run.italic,
              color: run.color || "1f2a37",
              size: run.size || 21
            })
        )
      })
    );
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: paragraphs
      }
    ]
  });

  return Packer.toBuffer(doc);
}

function getRoomLogRecipients(userIds) {
  const parsedIds = Array.from(new Set((Array.isArray(userIds) ? userIds : [])
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0)));

  if (!parsedIds.length) {
    return [];
  }

  const placeholders = parsedIds.map(() => "?").join(", ");
  return db
    .prepare(
      `SELECT id, username, email, room_log_email_enabled
       FROM users
       WHERE id IN (${placeholders})`
    )
    .all(...parsedIds);
}

const activeRoomLogs = new Map();

function getActiveRoomLog(roomId, serverId = DEFAULT_SERVER_ID) {
  return activeRoomLogs.get(getRoomLogKey(roomId, serverId)) || null;
}

function clearPendingRoomLogFinalization(roomId, serverId = DEFAULT_SERVER_ID) {
  const key = getRoomLogKey(roomId, serverId);
  const timer = pendingRoomLogFinalizations.get(key);
  if (!timer) {
    return false;
  }

  clearTimeout(timer);
  pendingRoomLogFinalizations.delete(key);
  return true;
}

function schedulePendingRoomLogFinalization(
  roomId,
  serverId = DEFAULT_SERVER_ID,
  delayMs = ROOM_LOG_EMPTY_GRACE_MS
) {
  const roomLog = getActiveRoomLog(roomId, serverId);
  if (!roomLog) {
    return false;
  }

  const normalizedRoomId = Number.isInteger(roomId) && roomId > 0 ? roomId : null;
  const normalizedServerId = normalizeServer(serverId);
  const key = getRoomLogKey(normalizedRoomId, normalizedServerId);

  clearPendingRoomLogFinalization(normalizedRoomId, normalizedServerId);

  const timer = setTimeout(() => {
    pendingRoomLogFinalizations.delete(key);
    if (getSocketsInChannel(normalizedRoomId, normalizedServerId).length > 0) {
      return;
    }
    void finalizeRoomLog(normalizedRoomId, normalizedServerId, { reason: "empty-room" });
  }, Math.max(0, Number(delayMs) || 0));

  pendingRoomLogFinalizations.set(key, timer);
  return true;
}

function serializeRoomLogParticipants(roomLog) {
  if (!(roomLog?.participants instanceof Map)) {
    return [];
  }

  return Array.from(roomLog.participants.values())
    .map((entry) => {
      const userId = Number(entry?.userId);
      if (!Number.isInteger(userId) || userId < 1) {
        return null;
      }

      const characterId = Number(entry?.characterId);
      return {
        userId,
        displayName: String(entry?.displayName || `User ${userId}`).trim() || `User ${userId}`,
        characterId: Number.isInteger(characterId) && characterId > 0 ? characterId : 0
      };
    })
    .filter(Boolean);
}

function deserializeRoomLogParticipants(rawValue) {
  return new Map(
    parseStoredJsonArray(rawValue)
      .map((entry) => {
        const userId = Number(entry?.userId);
        if (!Number.isInteger(userId) || userId < 1) {
          return null;
        }

        const characterId = Number(entry?.characterId);
        return [
          userId,
          {
            userId,
            displayName: String(entry?.displayName || `User ${userId}`).trim() || `User ${userId}`,
            characterId: Number.isInteger(characterId) && characterId > 0 ? characterId : 0
          }
        ];
      })
      .filter(Boolean)
  );
}

function serializeRoomLogMessages(roomLog) {
  if (!Array.isArray(roomLog?.messages)) {
    return [];
  }

  return roomLog.messages
    .map((entry) => {
      const content = String(entry?.content || "").trim();
      if (!content) {
        return null;
      }

      return {
        type: String(entry?.type || "chat").trim().toLowerCase() === "system" ? "system" : "chat",
        username: String(entry?.username || "").trim(),
        role_style: String(entry?.role_style || "").trim(),
        content,
        created_at: String(entry?.created_at || "").trim() || formatChatTimestamp()
      };
    })
    .filter(Boolean);
}

function hydrateActiveRoomLogRow(row) {
  if (!row) return null;

  const parsedRoomId = Number(row.room_id);
  const roomId = Number.isInteger(parsedRoomId) && parsedRoomId > 0 ? parsedRoomId : null;
  const serverId = normalizeServer(row.server_id);
  return {
    roomId,
    serverId,
    roomLabel: String(row.room_label || "").trim() || getRoomLogLabel(roomId, serverId),
    startedAt: String(row.started_at || "").trim() || formatChatTimestamp(),
    startedByUserId: Number(row.started_by_user_id) || null,
    startedByName: String(row.started_by_name || "").trim() || "Jemand",
    participants: deserializeRoomLogParticipants(row.participants_json),
    messages: serializeRoomLogMessages({
      messages: parseStoredJsonArray(row.messages_json)
    })
  };
}

function persistActiveRoomLog(roomLog) {
  if (!roomLog) return false;

  const roomId = Number(roomLog.roomId);
  const normalizedRoomId = Number.isInteger(roomId) && roomId > 0 ? roomId : 0;
  const normalizedServerId = normalizeServer(roomLog.serverId);

  try {
    upsertActiveRoomLogStatement.run(
      normalizedRoomId,
      normalizedServerId,
      String(roomLog.roomLabel || "").trim() || getRoomLogLabel(normalizedRoomId, normalizedServerId),
      String(roomLog.startedAt || "").trim() || formatChatTimestamp(),
      Number(roomLog.startedByUserId) || 0,
      String(roomLog.startedByName || "").trim() || "Jemand",
      JSON.stringify(serializeRoomLogParticipants(roomLog)),
      JSON.stringify(serializeRoomLogMessages(roomLog))
    );
    return true;
  } catch (error) {
    console.error("Konnte aktives Raum-Log nicht speichern:", error);
    return false;
  }
}

function removePersistedActiveRoomLog(roomId, serverId = DEFAULT_SERVER_ID) {
  const parsedRoomId = Number(roomId);
  const normalizedRoomId = Number.isInteger(parsedRoomId) && parsedRoomId > 0 ? parsedRoomId : 0;

  try {
    deleteActiveRoomLogStatement.run(normalizedRoomId, normalizeServer(serverId));
    return true;
  } catch (error) {
    console.error("Konnte aktives Raum-Log nicht entfernen:", error);
    return false;
  }
}

function restorePersistedActiveRoomLogs() {
  selectActiveRoomLogsStatement.all().forEach((row) => {
    const roomLog = hydrateActiveRoomLogRow(row);
    if (!roomLog) {
      return;
    }

    activeRoomLogs.set(getRoomLogKey(roomLog.roomId, roomLog.serverId), roomLog);
  });
}

function canManageRoomLog(user, room = null) {
  if (!user) return false;
  if (
    user.is_admin === true ||
    user.is_admin === 1 ||
    user.is_moderator === true ||
    user.is_moderator === 1
  ) {
    return true;
  }

  return canBypassRoomLock(user, room);
}

function upsertRoomLogParticipant(roomLog, userId, displayName = "", characterId = null) {
  if (!roomLog) return;
  if (!Number.isInteger(userId) || userId < 1) return;

  const existingParticipant = roomLog.participants.get(userId);
  const safeDisplayName =
    String(displayName || existingParticipant?.displayName || `User ${userId}`).trim() ||
    existingParticipant?.displayName ||
    `User ${userId}`;
  const parsedCharacterId = Number(characterId);
  const normalizedCharacterId =
    Number.isInteger(parsedCharacterId) && parsedCharacterId > 0
      ? parsedCharacterId
      : Number(existingParticipant?.characterId) || 0;

  roomLog.participants.set(userId, {
    userId,
    displayName: safeDisplayName,
    characterId: normalizedCharacterId
  });
  persistActiveRoomLog(roomLog);
}

function rememberRoomLogParticipant(roomId, serverId, user, displayName = "", characterId = null) {
  const roomLog = getActiveRoomLog(roomId, serverId);
  if (!roomLog) return;

  clearPendingRoomLogFinalization(roomId, serverId);

  const userId = Number(user?.id);
  if (!Number.isInteger(userId) || userId < 1) return;

  upsertRoomLogParticipant(
    roomLog,
    userId,
    displayName || user?.display_name || user?.username || `User ${userId}`,
    characterId
  );
}

function appendMessageToActiveRoomLog(roomId, serverId, entry) {
  const roomLog = getActiveRoomLog(roomId, serverId);
  if (!roomLog) return;

  const content = String(entry?.content || "").trim();
  if (!content) return;

  const createdAt = String(entry?.created_at || formatChatTimestamp()).trim() || formatChatTimestamp();
  const type = String(entry?.type || "chat").trim().toLowerCase() === "system" ? "system" : "chat";
  const username = String(entry?.username || "").trim();

  roomLog.messages.push({
    type,
    username,
    role_style: String(entry?.role_style || "").trim(),
    content,
    created_at: createdAt
  });

  const userId = Number(entry?.user_id);
  if (type !== "system" && Number.isInteger(userId) && userId > 0) {
    upsertRoomLogParticipant(roomLog, userId, username || `User ${userId}`, entry?.character_id);
    return;
  }

  persistActiveRoomLog(roomLog);
}

function startRoomLog(roomId, serverId, room, startedBySocket) {
  const key = getRoomLogKey(roomId, serverId);
  if (activeRoomLogs.has(key)) {
    return null;
  }

  clearPendingRoomLogFinalization(roomId, serverId);

  const roomLog = {
    roomId: Number.isInteger(roomId) && roomId > 0 ? roomId : null,
    serverId: normalizeServer(serverId),
    roomLabel: getRoomLogLabel(roomId, serverId, room),
    startedAt: formatChatTimestamp(),
    startedByUserId: Number(startedBySocket?.data?.user?.id) || null,
    startedByName: getSocketDisplayProfile(startedBySocket, serverId).label || "Jemand",
    participants: new Map(),
    messages: []
  };

  activeRoomLogs.set(key, roomLog);

  getSocketsInChannel(roomId, serverId).forEach((memberSocket) => {
    const socketServerId = getSocketChannelServerId(memberSocket, roomId, serverId);
    rememberRoomLogParticipant(
      roomId,
      serverId,
      memberSocket?.data?.user,
      getSocketDisplayProfile(memberSocket, socketServerId).label,
      getSocketPreferredCharacterId(memberSocket, socketServerId)
    );
  });

  persistActiveRoomLog(roomLog);
  return roomLog;
}

function maybeStartAutomaticRoomLog(roomId, serverId, room = null, preferredSocket = null) {
  const normalizedRoomId = Number(roomId);
  if (!Number.isInteger(normalizedRoomId) || normalizedRoomId < 1) {
    return false;
  }

  const normalizedServerId = normalizeServer(serverId || room?.server_id);
  const resolvedRoom = room || getRoomWithCharacter(normalizedRoomId);
  if (!resolvedRoom || Number(resolvedRoom.email_log_enabled) !== 1) {
    return false;
  }

  if (getActiveRoomLog(normalizedRoomId, normalizedServerId)) {
    return false;
  }

  const memberSockets = getSocketsInChannel(normalizedRoomId, normalizedServerId);
  if (!memberSockets.length) {
    return false;
  }

  const starterSocket = memberSockets.includes(preferredSocket) ? preferredSocket : memberSockets[0];
  if (!starterSocket) {
    return false;
  }

  startRoomLog(normalizedRoomId, normalizedServerId, resolvedRoom, starterSocket);
  emitSystemChatMessage(normalizedRoomId, normalizedServerId, "Log ist aktiviert.");
  return true;
}

async function finalizeRoomLog(roomId, serverId, options = {}) {
  const key = getRoomLogKey(roomId, serverId);
  clearPendingRoomLogFinalization(roomId, serverId);
  const roomLog = activeRoomLogs.get(key);
  if (!roomLog) {
    return {
      hadLog: false,
      backupSavedCount: 0,
      deliveredCount: 0,
      emailDisabledCount: 0,
      missingEmailCount: 0,
      mailerUnavailableCount: 0,
      failedCount: 0,
      participantCount: 0
    };
  }

  activeRoomLogs.delete(key);
  removePersistedActiveRoomLog(roomId, serverId);

  const recipientRows = getRoomLogRecipients(Array.from(roomLog.participants.keys()));
  const recipientMap = new Map(
    recipientRows.map((recipient) => [Number(recipient.id), recipient])
  );
  const endedAt = formatChatTimestamp();
  const endReason = String(options.reason || "").trim().toLowerCase();
  const endReasonText =
    endReason === "empty-room"
      ? "Automatisch beendet, weil alle den Raum verlassen haben."
      : "Manuell mit /logoff beendet.";
  const logText = roomLog.messages
    .map((entry) => formatRoomLogLine(entry))
    .filter(Boolean)
    .join("\n");
  const participantEntries = Array.from(roomLog.participants.values())
    .filter((entry) => entry && Number.isInteger(Number(entry.userId)) && Number(entry.userId) > 0);
  const participantNames = Array.from(
    new Set(participantEntries.map((entry) => String(entry.displayName || "").trim()).filter(Boolean))
  )
    .sort((a, b) => a.localeCompare(b, "de", { sensitivity: "base" }));
  const mailerConfigured = Boolean(getVerificationMailer());
  let backupSavedCount = 0;
  let deliveredCount = 0;
  let emailDisabledCount = 0;
  let missingEmailCount = 0;
  let mailerUnavailableCount = 0;
  let failedCount = 0;
  let fullAttachmentCount = 0;
  let pdfOnlyCount = 0;
  let plainOnlyCount = 0;
  let lastErrorSummary = "";

  for (const participant of participantEntries) {
    const recipient = recipientMap.get(Number(participant.userId));
    if (!recipient) {
      continue;
    }

    const emailEnabled = Number(recipient.room_log_email_enabled) !== 0;
    const email = normalizeEmail(recipient?.email || "");
    let emailSent = false;
    let emailDeliveryMode = "";
    let emailError = "";

    if (!emailEnabled) {
      emailDisabledCount += 1;
    } else if (!email) {
      missingEmailCount += 1;
    } else if (!mailerConfigured) {
      mailerUnavailableCount += 1;
      emailError = "Der Mailversand ist aktuell nicht eingerichtet.";
    } else {
      try {
        const deliveryResult = await sendRoomLogEmail({
          email,
          username: recipient.username,
          roomLabel: roomLog.roomLabel,
          startedAt: roomLog.startedAt,
          endedAt,
          endReasonText,
          participantNames,
          logText,
          entries: roomLog.messages
        });
        emailSent = true;
        emailDeliveryMode = String(deliveryResult?.deliveryMode || "").trim();
        deliveredCount += 1;
        if (emailDeliveryMode === "pdf-docx") {
          fullAttachmentCount += 1;
        } else if (emailDeliveryMode === "pdf") {
          pdfOnlyCount += 1;
        } else {
          plainOnlyCount += 1;
        }
      } catch (error) {
        failedCount += 1;
        emailError = summarizeMailError(error);
        lastErrorSummary = emailError;
        console.error("Konnte Log nicht per E-Mail senden:", error);
      }
    }

    if (
      saveChatLogBackupForUser({
        userId: participant.userId,
        characterId: participant.characterId,
        characterName: participant.displayName || recipient.username,
        roomId: roomLog.roomId,
        roomLabel: roomLog.roomLabel,
        serverId: roomLog.serverId,
        startedAt: roomLog.startedAt,
        endedAt,
        endReasonText,
        participantNames,
        logText,
        entries: roomLog.messages,
        emailEnabled,
        emailSent,
        emailDeliveryMode,
        emailError
      })
    ) {
      backupSavedCount += 1;
    }
  }

  return {
    hadLog: true,
    backupSavedCount,
    deliveredCount,
    emailDisabledCount,
    missingEmailCount,
    mailerUnavailableCount,
    failedCount,
    fullAttachmentCount,
    pdfOnlyCount,
    plainOnlyCount,
    participantCount: roomLog.participants.size,
    lastErrorSummary
  };
}

async function finalizeRoomLogIfEmpty(roomId, serverId) {
  if (getSocketsInChannel(roomId, serverId).length > 0) {
    clearPendingRoomLogFinalization(roomId, serverId);
    return false;
  }

  return schedulePendingRoomLogFinalization(roomId, serverId);
}

restorePersistedActiveRoomLogs();

function buildPresenceSuffixPool(basePhrases, tailPhrases, standalonePhrases) {
  const templates = [];

  basePhrases.forEach((basePhrase) => {
    const normalizedBase = String(basePhrase || "").trim();
    if (!normalizedBase) {
      return;
    }

    templates.push(`${normalizedBase}.`);
    tailPhrases.forEach((tailPhrase) => {
      const normalizedTail = String(tailPhrase || "").trim();
      if (!normalizedTail) {
        return;
      }
      templates.push(`${normalizedBase} ${normalizedTail}.`);
    });
  });

  standalonePhrases.forEach((standalonePhrase) => {
    const normalizedStandalone = String(standalonePhrase || "").trim();
    if (normalizedStandalone) {
      templates.push(normalizedStandalone.endsWith(".") ? normalizedStandalone : `${normalizedStandalone}.`);
    }
  });

  return Array.from(new Set(templates));
}

const ROOM_ENTRY_SUFFIXES = buildPresenceSuffixPool(
  [
    "schiebt den Vorhang beiseite und tritt ein",
    "taucht zwischen den Gesprächen auf",
    "findet den Weg herein",
    "erscheint im Raum",
    "tritt aus dem Halbschatten hervor",
    "gleitet durch die Tür",
    "löst sich aus dem Stimmengewirr",
    "kommt mit ruhigen Schritten herein",
    "betritt den Raum",
    "steht plötzlich im Türrahmen",
    "mischt sich unter die Anwesenden",
    "tritt an die Runde heran"
  ],
  [
    "mit einem leisen Nicken in die Runde",
    "als wäre der Platz längst für diesen Moment bestimmt",
    "und lässt den Blick aufmerksam durch den Raum wandern",
    "ohne das Gespräch merklich zu stören",
    "und bringt einen Hauch frischer Luft mit",
    "mit stiller Selbstverständlichkeit",
    "als hätte der Raum genau auf diesen Augenblick gewartet",
    "und sammelt erst einmal die Stimmung auf",
    "mit einer Spur Neugier im Blick",
    "und bleibt kurz an der Schwelle stehen",
    "mit der Ruhe von jemandem, der seinen Platz kennt",
    "und nimmt die Stimmen um sich herum in sich auf",
    "während die Gespräche für einen Atemzug leiser wirken",
    "mit einem kaum hörbaren Schritt",
    "und fügt sich mühelos ins Bild",
    "als würde der Raum die Ankunft kommentarlos hinnehmen",
    "und lässt die Szene einen Takt größer wirken",
    "mit einer kleinen Geste in die Runde"
  ],
  [
    "landet mitten im Gespräch, als wäre der Weg nie ein anderer gewesen",
    "tritt ein und bringt sofort eine neue Spannung in die Runde",
    "ist plötzlich da, als hätte der Raum nur kurz geblinzelt",
    "erscheint zwischen zwei Sätzen und gehört sofort dazu",
    "taucht an der Schwelle auf und nimmt den Raum still in Besitz",
    "kommt herein, als wäre der Abend um genau diesen Schritt reicher",
    "tritt aus dem Rand der Szene direkt ins Zentrum der Wahrnehmung",
    "ist auf einmal Teil des Bildes, als hätte niemand etwas anderes erwartet",
    "findet den Raum, ohne je fehl am Platz zu wirken",
    "tritt über die Schwelle und bringt eine neue Nuance in die Stimmung"
  ]
);

const ROOM_EXIT_SUFFIXES = buildPresenceSuffixPool(
  [
    "zieht sich leise wieder zurück",
    "nickt in die Runde und verschwindet zur Tür hinaus",
    "löst sich aus dem Gespräch und verlässt den Raum",
    "tritt einen Schritt zurück und verschwindet wieder",
    "wendet sich zum Ausgang",
    "gleitet aus der Szene",
    "verschwindet zwischen zwei Atemzügen",
    "nimmt sich leise aus dem Raum",
    "zieht weiter",
    "verlässt den Raum mit ruhigen Schritten",
    "tritt durch die Tür hinaus",
    "geht, ohne mehr als ein kurzes Echo zu hinterlassen"
  ],
  [
    "mit einem letzten Blick über die Runde",
    "als hätte der Raum schon geahnt, dass der Moment gleich endet",
    "und lässt die Gespräche langsam wieder ineinanderfließen",
    "ohne mehr Lärm zu machen als ein ausklingender Gedanke",
    "und nimmt ein kleines Stück der Stimmung mit hinaus",
    "mit der Ruhe eines sauber gesetzten Schlussstrichs",
    "während die Szene sich sacht neu sortiert",
    "und hinterlässt einen Platz, der noch einen Moment nachklingt",
    "mit einem kaum wahrnehmbaren Nicken",
    "als würde der Raum die Bewegung still nachzeichnen",
    "und lässt nur einen kurzen Nachhall zurück",
    "mit derselben Selbstverständlichkeit, mit der die Person gekommen war",
    "während die Gespräche wieder dichter zusammenrücken",
    "und überlässt dem Raum wieder seine alte Balance",
    "mit einem Schritt, der mehr ausblendet als unterbricht",
    "und verschwindet, bevor die Szene ganz nachziehen kann",
    "als wäre der Abschied nur ein leiser Wechsel im Takt",
    "und lässt eine kleine Lücke im Bild zurück"
  ],
  [
    "tritt aus dem Raum, und für einen Moment wirkt alles ein wenig stiller",
    "verschwindet wieder aus der Szene, fast so unaufdringlich wie beim Kommen",
    "zieht sich aus der Runde zurück und lässt nur den Nachhall des Moments stehen",
    "ist fort, noch bevor die Gespräche den letzten Blick ganz aufgefangen haben",
    "geht leise hinaus und nimmt einen Hauch der Szene mit",
    "lässt den Raum hinter sich, ohne das Gespräch hart zu unterbrechen",
    "verschwindet zur Tür hinaus, als würde der Abend nur eine Seite weiterblättern",
    "tritt ab und übergibt die Szene wieder den Verbliebenen",
    "verlässt den Raum mit der Ruhe eines ungesagten Schlusspunkts",
    "zieht sich zurück, bis nur noch die Erinnerung an die Bewegung bleibt"
  ]
);

const ROOM_PRESENCE_SUFFIXES = Array.from(
  new Set([...ROOM_ENTRY_SUFFIXES, ...ROOM_EXIT_SUFFIXES].map((suffix) => ` ${suffix}`))
);

function buildRoomPresenceMessage(kind, displayName) {
  const safeName = String(displayName || "").trim() || "Jemand";
  const suffixes = kind === "leave" ? ROOM_EXIT_SUFFIXES : ROOM_ENTRY_SUFFIXES;
  const suffix = suffixes[Math.floor(Math.random() * suffixes.length)] || suffixes[0] || "ist da.";
  return {
    text: `${safeName} ${suffix}`.trim(),
    actorName: safeName,
    suffix,
    kind: kind === "leave" ? "leave" : "enter"
  };
}

function buildSystemChatPayload(content, options = {}) {
  const text = String(content || "").trim();
  if (!text) return null;
  const systemKind = String(options?.system_kind || "").trim();
  const messageTimeIso = new Date().toISOString();

  const chatTextColor = /^#[0-9a-f]{6}$/i.test(String(options?.chat_text_color || "").trim())
    ? normalizeGuestbookColor(options.chat_text_color)
    : "";

  return {
    type: "system",
    content: text,
    chat_text_color: chatTextColor,
    system_kind: systemKind,
    presence_kind: String(options?.presence_kind || "").trim(),
    presence_actor_name: String(options?.presence_actor_name || "").trim(),
    presence_actor_role_style: String(options?.presence_actor_role_style || "").trim(),
    presence_actor_chat_text_color: String(options?.presence_actor_chat_text_color || "").trim(),
    presence_suffix: String(options?.presence_suffix || "").trim(),
    room_switch_target_name: String(options?.room_switch_target_name || "").trim(),
    message_time_iso: messageTimeIso,
    created_at: formatChatTimestamp()
  };
}

function emitDirectSystemMessageToSocket(memberSocket, content, options = {}) {
  const payload = buildSystemChatPayload(content, options);
  if (!memberSocket || !payload) {
    return;
  }

  memberSocket.emit("chat:message", payload);
}

function emitDirectSystemMessageToUser(userId, content, options = {}) {
  const payload = buildSystemChatPayload(content, options);
  if (!payload) {
    return;
  }

  getAllSocketsForUser(userId).forEach((memberSocket) => {
    memberSocket.emit("chat:message", payload);
  });
}

function emitSystemChatMessage(roomId, serverId, content, options = {}) {
  const normalizedServerId = normalizeServer(serverId);
  const normalizedRoomId = Number.isInteger(roomId) && roomId > 0 ? roomId : null;
  const payload = buildSystemChatPayload(content, options);
  if (!payload) return;

  appendMessageToActiveRoomLog(normalizedRoomId, normalizedServerId, {
    ...payload
  });

  emitToRoomChannelMembers(normalizedRoomId, normalizedServerId, "chat:message", payload);
}

function getSocketPreferredCharacterId(socket, serverId = DEFAULT_SERVER_ID) {
  const normalizedServerId = normalizeServer(serverId);
  const activeCharacterId = Number(socket?.data?.activeCharacterId);
  if (Number.isInteger(activeCharacterId) && activeCharacterId > 0) {
    return activeCharacterId;
  }

  const preferredMap = normalizePreferredCharacterMap(socket?.data?.preferredCharacterIds);
  return preferredMap[normalizedServerId] || null;
}

function getSocketDisplayProfile(socket, serverId = DEFAULT_SERVER_ID) {
  const user = socket?.data?.user;
  return getCurrentChannelDisplayProfile(
    user,
    serverId,
    getSocketPreferredCharacterId(socket, serverId)
  );
}

function getOnlineCharactersForChannel(roomId, serverId = DEFAULT_SERVER_ID) {
  const room =
    Number.isInteger(roomId) && roomId > 0
      ? getRoomWithCharacter(Number(roomId))
      : null;
  const sockets = getSocketsInChannel(roomId, serverId);
  if (!sockets.length && !(room && isTavernInnkeeperRoom(room, serverId))) {
    return [];
  }
  const onlineCharacters = [];
  const seenPresenceKeys = new Set();
  for (const memberSocket of sockets) {
    const user = memberSocket?.data?.user;
    const socketServerId = getSocketChannelServerId(memberSocket, roomId, serverId);
    const presenceIdentity = getSocketPresenceIdentity(memberSocket, socketServerId);
    const userId = Number(presenceIdentity?.userId);

    if (!Number.isInteger(userId) || userId < 1 || !presenceIdentity?.key || seenPresenceKeys.has(presenceIdentity.key)) {
      continue;
    }

    seenPresenceKeys.add(presenceIdentity.key);
    const chosenCharacter = getPreferredCharacterForUser(
      userId,
      socketServerId,
      presenceIdentity.characterId
    );
    const displayProfile = getSocketDisplayProfile(memberSocket, socketServerId);
    const activeCharacterId = chosenCharacter?.id || presenceIdentity.characterId || null;

    onlineCharacters.push({
      presence_key: presenceIdentity.key,
      user_id: userId,
      name: displayProfile.label || `User ${userId}`,
      character_id: activeCharacterId,
      role_style: displayProfile.role_style || "",
      chat_text_color: displayProfile.chat_text_color || "",
      has_room_rights: room ? canBypassRoomLock(user, room) : false,
      is_afk: Boolean(getChatAfkState(userId, roomId, socketServerId, activeCharacterId))
    });
  }

  if (room && isTavernInnkeeperRoom(room, serverId)) {
    onlineCharacters.push({
      presence_key: TAVERN_INNKEEPER_PRESENCE_KEY,
      user_id: 0,
      name: TAVERN_INNKEEPER_NAME,
      character_id: null,
      role_style: "",
      chat_text_color: TAVERN_INNKEEPER_CHAT_TEXT_COLOR,
      has_room_rights: false,
      is_afk: false,
      is_npc: true
    });
  }

  return onlineCharacters.sort((a, b) =>
    a.name.localeCompare(b.name, "de", { sensitivity: "base" })
  );
}

function sanitizeOnlineCharacterEntries(entries) {
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => ({
      presence_key: String(entry.presence_key || "").trim(),
      user_id: Number(entry.user_id) || 0,
      name: String(entry.name || "").trim() || "Unbekannt",
      character_id: Number.isInteger(Number(entry.character_id)) && Number(entry.character_id) > 0
        ? Number(entry.character_id)
        : null,
      role_style: String(entry.role_style || "").trim(),
      chat_text_color: String(entry.chat_text_color || "").trim(),
      has_room_rights: entry.has_room_rights === true,
      is_afk: entry.is_afk === true,
      is_npc: entry.is_npc === true
    }))
    .filter((entry) => entry.user_id > 0 || entry.name);
}

function emitOnlineCharacters(roomId, serverId = DEFAULT_SERVER_ID) {
  const onlineCharacters = getOnlineCharactersForChannel(roomId, serverId);
  const normalizedServerId = normalizeServer(serverId);
  const normalizedRoomId = Number.isInteger(roomId) && roomId > 0 ? roomId : null;

  emitToRoomChannelMembers(
    normalizedRoomId,
    normalizedServerId,
    "chat:online-characters",
    onlineCharacters
  );
  if (normalizedRoomId == null) {
    Array.from(ALLOWED_SERVER_IDS).forEach((watchServerId) => {
      io.to(socketChannelForRoomWatch(normalizedRoomId, watchServerId)).emit("room:watch:update", {
        roomId: normalizedRoomId,
        serverId: watchServerId,
        users: onlineCharacters
      });
    });
    return;
  }

  io.to(socketChannelForRoomWatch(normalizedRoomId, normalizedServerId)).emit("room:watch:update", {
    roomId: normalizedRoomId,
    serverId: normalizedServerId,
    users: onlineCharacters
  });
}

function emitChatTypingState(memberSocket, roomId, serverId = DEFAULT_SERVER_ID) {
  const socketServerId = getSocketChannelServerId(memberSocket, roomId, serverId);
  const presenceIdentity = getSocketPresenceIdentity(memberSocket, socketServerId);
  const userId = Number(presenceIdentity?.userId);
  if (!Number.isInteger(userId) || userId < 1 || !presenceIdentity?.key) {
    return;
  }

  const normalizedServerId = normalizeServer(serverId);
  const normalizedRoomId = Number.isInteger(roomId) && roomId > 0 ? roomId : null;
  const presenceSockets = getPresenceSocketsInChannel(
    normalizedRoomId,
    normalizedServerId,
    presenceIdentity
  );
  const isTyping = presenceSockets.some((socketEntry) => Boolean(socketEntry?.data?.isTyping));
  const displayProfile = getSocketDisplayProfile(memberSocket, socketServerId);

  io.to(socketChannelForRoom(normalizedRoomId, normalizedServerId)).emit("chat:typing", {
    presence_key: presenceIdentity.key,
    user_id: userId,
    character_id: presenceIdentity.characterId,
    name: displayProfile.label || `User ${userId}`,
    role_style: displayProfile.role_style || "",
    chat_text_color: displayProfile.chat_text_color || "",
    is_typing: isTyping
  });
}

function emitRoomStateUpdate(roomId, serverId = DEFAULT_SERVER_ID, room = null) {
  const normalizedServerId = normalizeServer(serverId);
  const normalizedRoomId = Number.isInteger(roomId) && roomId > 0 ? roomId : null;
  const resolvedRoom =
    room ||
    (normalizedRoomId ? getRoomWithCharacter(normalizedRoomId) : null);

  if (!resolvedRoom) {
    return;
  }

  getSocketsInWatchChannel(normalizedRoomId, normalizedServerId).forEach((memberSocket) => {
    memberSocket.emit(
      "room:state:update",
      getRoomStatePayloadForUser(memberSocket?.data?.user, resolvedRoom, normalizedServerId)
    );
  });
}

function emitRoomListRefresh(serverId = DEFAULT_SERVER_ID) {
  const normalizedServerId = normalizeServer(serverId);
  io.emit("roomlist:refresh", {
    serverId: normalizedServerId
  });
}

const pendingRoomDeletionTimers = new Map();
const pendingRoomInvites = new Map();
const pendingChatDisconnects = new Map();
const pendingRoomLogFinalizations = new Map();
const CHAT_RECONNECT_GRACE_MS = 12000;
const ROOM_LOG_EMPTY_GRACE_MS = 10 * 60 * 1000;
const CHAT_RECONNECT_SUPPRESSION_LOBBY_KEY = "lobby";
const pruneExpiredChatReconnectSuppressionsStatement = db.prepare(
  "DELETE FROM chat_reconnect_suppressions WHERE expires_at <= ?"
);
const upsertChatReconnectSuppressionStatement = db.prepare(`
  INSERT INTO chat_reconnect_suppressions (presence_key, room_key, server_id, expires_at)
  VALUES (?, ?, ?, ?)
  ON CONFLICT(presence_key, room_key, server_id)
  DO UPDATE SET expires_at = excluded.expires_at
`);
const selectChatReconnectSuppressionStatement = db.prepare(`
  SELECT expires_at
    FROM chat_reconnect_suppressions
   WHERE presence_key = ?
     AND room_key = ?
     AND server_id = ?
   LIMIT 1
`);
const deleteChatReconnectSuppressionStatement = db.prepare(`
  DELETE FROM chat_reconnect_suppressions
   WHERE presence_key = ?
     AND room_key = ?
     AND server_id = ?
`);

function getChatReconnectSuppressionRoomKey(roomId) {
  return Number.isInteger(roomId) && roomId > 0
    ? String(roomId)
    : CHAT_RECONNECT_SUPPRESSION_LOBBY_KEY;
}

function setChatReconnectSuppression(presenceKey, roomId, serverId = DEFAULT_SERVER_ID, durationMs = CHAT_RECONNECT_GRACE_MS) {
  const normalizedPresenceKey = String(presenceKey || "").trim();
  if (!normalizedPresenceKey) {
    return;
  }

  const now = Date.now();
  const scopeServerKey = getChatScopeServerKey(roomId, serverId);
  pruneExpiredChatReconnectSuppressionsStatement.run(now);
  upsertChatReconnectSuppressionStatement.run(
    normalizedPresenceKey,
    getChatReconnectSuppressionRoomKey(roomId),
    scopeServerKey,
    now + Math.max(0, Number(durationMs) || 0)
  );
}

function consumeChatReconnectSuppression(presenceKey, roomId, serverId = DEFAULT_SERVER_ID) {
  const normalizedPresenceKey = String(presenceKey || "").trim();
  if (!normalizedPresenceKey) {
    return false;
  }

  const now = Date.now();
  const scopeServerKey = getChatScopeServerKey(roomId, serverId);
  const roomKey = getChatReconnectSuppressionRoomKey(roomId);
  pruneExpiredChatReconnectSuppressionsStatement.run(now);
  const row = selectChatReconnectSuppressionStatement.get(
    normalizedPresenceKey,
    roomKey,
    scopeServerKey
  );
  if (!row || Number(row.expires_at) <= now) {
    deleteChatReconnectSuppressionStatement.run(normalizedPresenceKey, roomKey, scopeServerKey);
    return false;
  }

  deleteChatReconnectSuppressionStatement.run(normalizedPresenceKey, roomKey, scopeServerKey);
  return true;
}

function getPendingChatDisconnectKey(userId, roomId, serverId = DEFAULT_SERVER_ID, characterId = null) {
  const scopeServerKey = getChatScopeServerKey(roomId, serverId);
  const roomKey = Number.isInteger(roomId) && roomId > 0 ? String(roomId) : "lobby";
  const presenceKey = getPresenceIdentityKey(userId, characterId);
  return `${presenceKey}:${scopeServerKey}:${roomKey}`;
}

function clearPendingChatDisconnect(userId, roomId, serverId = DEFAULT_SERVER_ID, characterId = null) {
  if (!getPresenceIdentityKey(userId, characterId)) {
    return null;
  }

  const key = getPendingChatDisconnectKey(userId, roomId, serverId, characterId);
  const entry = pendingChatDisconnects.get(key);
  if (!entry) {
    return null;
  }

  clearTimeout(entry.timer);
  pendingChatDisconnects.delete(key);
  return entry;
}

function finalizeChatDisconnectEntry(entry) {
  if (!entry?.presenceKey) {
    return false;
  }

  if (
    getPresenceSocketsInChannel(entry.roomId, entry.serverId, {
      key: entry.presenceKey
    }).length > 0
  ) {
    return false;
  }

  clearChatAfkState(entry.userId, entry.roomId, entry.serverId, {
    skipStateEmit: true,
    skipOnlineRefresh: true
  }, entry.characterId);

  const shouldSuppressReconnectPresence = consumeChatReconnectSuppression(
    entry.presenceKey,
    entry.roomId,
    entry.serverId
  );

  if (!entry.skipPresence && !shouldSuppressReconnectPresence) {
    const disconnectPresenceMessage = buildRoomPresenceMessage(
      "leave",
      entry.displayName || `User ${entry.userId}`
    );
    emitSystemChatMessage(
      entry.roomId,
      entry.serverId,
      disconnectPresenceMessage.text,
      {
        chat_text_color: "#000000",
        system_kind: "presence",
        presence_kind: disconnectPresenceMessage.kind,
        presence_actor_name: disconnectPresenceMessage.actorName,
        presence_actor_chat_text_color: entry.chatTextColor,
        presence_suffix: disconnectPresenceMessage.suffix
      }
    );
  }

  emitOnlineCharacters(entry.roomId, entry.serverId);
  void finalizeRoomLogIfEmpty(entry.roomId, entry.serverId);
  scheduleRoomDeletion(entry.roomId);
  emitHomeStatsUpdate();
  return true;
}

function schedulePendingChatDisconnect({
  userId,
  roomId,
  serverId = DEFAULT_SERVER_ID,
  displayName = "",
  chatTextColor = "",
  skipPresence = false,
  characterId = null
}) {
  const parsedUserId = Number(userId);
  if (!Number.isInteger(parsedUserId) || parsedUserId < 1) {
    return null;
  }

  const normalizedServerId = normalizeServer(serverId);
  const parsedCharacterId = normalizePresenceCharacterId(characterId);
  clearPendingChatDisconnect(parsedUserId, roomId, normalizedServerId, parsedCharacterId);
  const key = getPendingChatDisconnectKey(parsedUserId, roomId, normalizedServerId, parsedCharacterId);

  const entry = {
    userId: parsedUserId,
    characterId: parsedCharacterId,
    presenceKey: getPresenceIdentityKey(parsedUserId, parsedCharacterId),
    roomId: Number.isInteger(roomId) && roomId > 0 ? roomId : null,
    serverId: normalizedServerId,
    displayName: String(displayName || "").trim(),
    chatTextColor: String(chatTextColor || "").trim(),
    skipPresence: Boolean(skipPresence),
    timer: null
  };

  entry.timer = setTimeout(() => {
    pendingChatDisconnects.delete(key);
    finalizeChatDisconnectEntry(entry);
  }, CHAT_RECONNECT_GRACE_MS);

  pendingChatDisconnects.set(key, entry);
  return entry;
}

function getPendingRoomInvite(inviteId) {
  const normalizedInviteId = String(inviteId || "").trim();
  if (!normalizedInviteId) {
    return null;
  }

  const invite = pendingRoomInvites.get(normalizedInviteId);
  if (!invite) {
    return null;
  }

  if (!Number.isFinite(invite.expiresAt) || invite.expiresAt <= Date.now()) {
    pendingRoomInvites.delete(normalizedInviteId);
    return null;
  }

  return invite;
}

function createPendingRoomInvite(payload) {
  const inviteId = crypto.randomBytes(12).toString("hex");
  const invite = {
    id: inviteId,
    roomId: Number(payload?.roomId) || null,
    serverId: normalizeServer(payload?.serverId),
    senderUserId: Number(payload?.senderUserId) || null,
    senderName: String(payload?.senderName || "").trim(),
    senderChatTextColor: String(payload?.senderChatTextColor || "").trim(),
    targetUserId: Number(payload?.targetUserId) || null,
    targetName: String(payload?.targetName || "").trim(),
    roomName: String(payload?.roomName || "").trim(),
    roomTeaser: String(payload?.roomTeaser || "").trim(),
    expiresAt: Date.now() + ROOM_INVITE_TTL_MS
  };

  pendingRoomInvites.set(inviteId, invite);
  return invite;
}

function clearPendingRoomDeletion(roomId) {
  if (!Number.isInteger(roomId) || roomId < 1) return;
  const timer = pendingRoomDeletionTimers.get(roomId);
  if (!timer) return;
  clearTimeout(timer);
  pendingRoomDeletionTimers.delete(roomId);
}

function setSavedRoomPublicState(roomId, isPublic) {
  const parsedRoomId = Number(roomId);
  if (!Number.isInteger(parsedRoomId) || parsedRoomId < 1) return false;
  const result = db
    .prepare(
      `UPDATE chat_rooms
       SET is_public_room = ?
       WHERE id = ?
         AND COALESCE(is_saved_room, 0) = 1`
    )
    .run(isPublic ? 1 : 0, parsedRoomId);
  return Number(result.changes) > 0;
}

function ensureSavedRoomVisibleForOwner(room, userId) {
  const parsedUserId = Number(userId);
  const parsedRoomId = Number(room?.id);
  if (
    !Number.isInteger(parsedUserId) ||
    parsedUserId < 1 ||
    !Number.isInteger(parsedRoomId) ||
    parsedRoomId < 1 ||
    Number(room?.is_saved_room) !== 1 ||
    Number(room?.is_public_room) === 1 ||
    Number(room?.created_by_user_id) !== parsedUserId
  ) {
    return room;
  }

  if (!setSavedRoomPublicState(parsedRoomId, true)) {
    return room;
  }

  const refreshedRoom = getRoomWithCharacter(parsedRoomId) || room;
  emitRoomStateUpdate(parsedRoomId, refreshedRoom.server_id, refreshedRoom);
  emitRoomListRefresh(refreshedRoom.server_id);
  return refreshedRoom;
}

function shouldAutoDeleteRoom(roomId) {
  if (!Number.isInteger(roomId) || roomId < 1) return false;
  const room = db
    .prepare("SELECT id, name, name_key, server_id, is_public_room, is_saved_room FROM chat_rooms WHERE id = ?")
    .get(roomId);
  if (!room) return false;
  if (isCuratedPublicRoom(room, room.server_id)) {
    return false;
  }
  return AUTO_DELETE_EMPTY_ROOMS || Number(room.is_public_room) === 1 || Number(room.is_saved_room) === 1;
}

function scheduleRoomDeletion(roomId) {
  if (!Number.isInteger(roomId) || roomId < 1) return;
  if (!shouldAutoDeleteRoom(roomId)) {
    clearPendingRoomDeletion(roomId);
    return;
  }
  if (ROOM_EMPTY_DELETE_DELAY_MS <= 0) {
    clearPendingRoomDeletion(roomId);
    maybeRemoveEmptyRoom(roomId);
    return;
  }
  if (pendingRoomDeletionTimers.has(roomId)) return;

  const timer = setTimeout(() => {
    pendingRoomDeletionTimers.delete(roomId);
    maybeRemoveEmptyRoom(roomId);
  }, ROOM_EMPTY_DELETE_DELAY_MS);

  pendingRoomDeletionTimers.set(roomId, timer);
}

function deleteRoomData(roomId) {
  const removeTx = db.transaction((targetRoomId) => {
    db.prepare("DELETE FROM chat_messages WHERE room_id = ?").run(targetRoomId);
    db.prepare("DELETE FROM chat_rooms WHERE id = ?").run(targetRoomId);
  });

  removeTx(roomId);
}

function maybeRemoveEmptyRoom(roomId) {
  if (!Number.isInteger(roomId) || roomId < 1) return false;
  if (!shouldAutoDeleteRoom(roomId)) {
    clearPendingRoomDeletion(roomId);
    return false;
  }

  const roomExists = db
    .prepare("SELECT id, is_public_room, is_saved_room, server_id FROM chat_rooms WHERE id = ?")
    .get(roomId);
  if (!roomExists) return false;

  const activeMembers = io.sockets.adapter.rooms.get(socketChannelForRoom(roomId, roomExists.server_id));
  if (activeMembers && activeMembers.size > 0) {
    clearPendingRoomDeletion(roomId);
    return false;
  }

  clearPendingRoomDeletion(roomId);
  if (Number(roomExists.is_saved_room) === 1) {
    if (Number(roomExists.is_public_room) === 1) {
      setSavedRoomPublicState(roomId, false);
      emitRoomStateUpdate(roomId, roomExists.server_id, getRoomWithCharacter(roomId));
      emitRoomListRefresh(roomExists.server_id);
    }
    return false;
  }
  deleteRoomData(roomId);
  io.emit("chat:room-removed", { room_id: roomId });
  emitRoomListRefresh(roomExists.server_id);
  return true;
}

function pruneEmptyRooms() {
  const rooms = db.prepare("SELECT id FROM chat_rooms").all();
  rooms.forEach((room) => {
    scheduleRoomDeletion(Number(room.id));
  });
}

setInterval(() => {
  sweepAutoAfkSockets(Date.now());
}, 15000).unref();

io.on("connection", (socket) => {
  const emitServerInstanceToSocket = () => {
    socket.emit("app:server-instance", {
      instanceId: STATIC_ASSET_VERSION
    });
  };

  socket.data.roomId = null;
  socket.data.serverId = null;
  socket.data.presenceServerId = null;
  socket.data.roomWatchChannels = new Set();
  socket.data.rpBoardChannels = new Set();
  socket.data.isTyping = false;
  socket.data.lastChatActivityAt = Date.now();
  socket.data.hasJoinedChat = false;

  emitServerInstanceToSocket();
  socket.emit("site:stats:update", getLoginStats());

  if (socket.data.user?.id) {
    socket.join(socketChannelForGuestbookNotifications(socket.data.user.id));
    socket.join(socketChannelForSocialUpdates(socket.data.user.id));
    socket.emit(
      "guestbook:notification:update",
      buildGuestbookNotificationPayloadForUser(socket.data.user.id)
    );
    socket.emit(
      "social:update",
      buildSocialStatePayloadForUser(socket.data.user.id)
    );
    emitSocialStateUpdatesForRelatedUsers(socket.data.user.id);
    emitHomeStatsUpdate();
  }

  socket.on("presence:set", (payload) => {
    if (!socket.data.user) return;

    const nextPresenceServerId = String(payload?.serverId || "").trim().toLowerCase();
    const parsedCharacterId = Number(payload?.characterId);
    if (!ALLOWED_SERVER_IDS.has(nextPresenceServerId)) {
      return;
    }

    if (Number.isInteger(parsedCharacterId) && parsedCharacterId > 0) {
      socket.data.activeCharacterId = parsedCharacterId;
    }

    if (socket.data.presenceServerId === nextPresenceServerId) {
      emitUserDisplayProfileToSocket(socket);
      emitGuestbookNotificationUpdateForUser(socket.data.user.id);
      emitSocialStateUpdatesForRelatedUsers(socket.data.user.id);
      return;
    }

    socket.data.presenceServerId = nextPresenceServerId;
    emitUserDisplayProfileToSocket(socket);
    emitGuestbookNotificationUpdateForUser(socket.data.user.id);
    emitSocialStateUpdatesForRelatedUsers(socket.data.user.id);
    emitHomeStatsUpdate();
  });

  socket.on("app:server-instance:request", () => {
    emitServerInstanceToSocket();
  });

  socket.on("room:watch", (payload) => {
    if (!socket.data.user) return;

    const rawServerId =
      payload && typeof payload === "object" ? payload.serverId : DEFAULT_SERVER_ID;
    const rawRoomId = payload && typeof payload === "object" ? payload.roomId : null;
    const parsedRoomId = Number(rawRoomId);
    const nextRoomId =
      Number.isInteger(parsedRoomId) && parsedRoomId > 0 ? parsedRoomId : null;
    const nextServerId = normalizeServer(rawServerId);
    const watcherChannel = socketChannelForRoomWatch(nextRoomId, nextServerId);

    if (!socket.data.roomWatchChannels.has(watcherChannel)) {
      socket.join(watcherChannel);
      socket.data.roomWatchChannels.add(watcherChannel);
    }

    socket.emit("room:watch:update", {
      roomId: nextRoomId,
      serverId: nextServerId,
      users: getOnlineCharactersForChannel(nextRoomId, nextServerId)
    });

    const watchedRoom = nextRoomId ? getRoomWithCharacter(nextRoomId) : null;
    if (watchedRoom) {
      socket.emit(
        "room:state:update",
        getRoomStatePayloadForUser(socket.data.user, watchedRoom, nextServerId)
      );
    }
  });

  socket.on("rp-board:watch", (payload) => {
    if (!socket.data.user) return;

    const context = resolveRpBoardContextForUser(
      socket.data.user.id,
      payload?.serverId,
      payload?.festplayId,
      payload?.characterId
    );
    if (!context) {
      return;
    }

    const boardChannel = socketChannelForRpBoard(context.serverId, context.festplayId);
    if (!socket.data.rpBoardChannels.has(boardChannel)) {
      socket.join(boardChannel);
      socket.data.rpBoardChannels.add(boardChannel);
    }
  });

  socket.on("chat:join", (payload) => {
    if (!socket.data.user) return;

    const rawRoomId =
      payload && typeof payload === "object" ? payload.roomId : payload;
    const rawServerId =
      payload && typeof payload === "object" ? payload.serverId : DEFAULT_SERVER_ID;
    const rawCharacterId =
      payload && typeof payload === "object" ? payload.characterId : null;
    const isReconnectJoin =
      payload && typeof payload === "object" && payload.isReconnect === true;
    const reconnectAgeMs =
      payload && typeof payload === "object"
        ? Number(payload.reconnectAgeMs)
        : NaN;

    const parsedRoomId = Number(rawRoomId);
    const parsedCharacterId = Number(rawCharacterId);
    const nextRoomId =
      Number.isInteger(parsedRoomId) && parsedRoomId > 0 ? parsedRoomId : null;
    let nextServerId = normalizeServer(rawServerId);
    let nextRoom = null;

    if (nextRoomId) {
      nextRoom = getRoomWithCharacter(nextRoomId);
      if (!nextRoom) return;
      if (!canAccessRoom(socket.data.user, nextRoom)) {
        return;
      }
      if (isRoomLockedForUser(socket.data.user, nextRoom)) {
        socket.emit("chat:message", {
          type: "system",
          content: "Dieser Raum ist abgeschlossen.",
          created_at: formatChatTimestamp()
        });
        return;
      }
      nextRoom = ensureSavedRoomVisibleForOwner(nextRoom, socket.data.user.id);
      nextServerId = normalizeServer(nextRoom.server_id || nextRoom.character_server_id);
    }

    const previousRoomId =
      Number.isInteger(socket.data.roomId) && socket.data.roomId > 0
        ? socket.data.roomId
        : null;
    const previousServerId = ALLOWED_SERVER_IDS.has(String(socket.data.serverId || "").trim().toLowerCase())
      ? normalizeServer(socket.data.serverId)
      : null;
    const previousRoom = previousRoomId ? getRoomWithCharacter(previousRoomId) : null;
    const isSameChannel =
      previousServerId === nextServerId &&
      previousRoomId === nextRoomId;
    const previousDisplayProfile = previousServerId
      ? getSocketDisplayProfile(socket, previousServerId)
      : null;
    const previousDisplayName = previousDisplayProfile?.label || "";
    const previousCharacterId = previousServerId
      ? getSocketPreferredCharacterId(socket, previousServerId)
      : null;
    const shouldSkipPreviousDisconnectPresence = socket.data.skipDisconnectPresence === true;
    socket.data.skipDisconnectPresence = false;
    const hasOtherPresenceInPreviousChannel = previousServerId
      ? hasOtherSocketInChannel(
          socket.data.user.id,
          previousRoomId,
          previousServerId,
          socket.id,
          previousCharacterId
        )
      : false;
    const preferredCharacterId =
      Number.isInteger(parsedCharacterId) && parsedCharacterId > 0
        ? parsedCharacterId
        : getSocketPreferredCharacterId(socket, nextServerId);
    const preferredCharacter = getPreferredCharacterForUser(
      socket.data.user.id,
      nextServerId,
      preferredCharacterId
    );
    const nextCharacterId = preferredCharacter?.id || null;
    ejectConflictingChatSocketsForCharacter(
      socket.data.user.id,
      nextServerId,
      nextCharacterId,
      socket.id,
      nextRoomId
    );
    const nextPresenceKey = getPresenceIdentityKey(socket.data.user.id, nextCharacterId);
    const shouldClearPreviousAfkState = Boolean(previousServerId) &&
      (!isSameChannel || Number(previousCharacterId) !== Number(nextCharacterId)) &&
      !hasOtherPresenceInPreviousChannel;
    const recoveredDisconnect = clearPendingChatDisconnect(
      socket.data.user.id,
      nextRoomId,
      nextServerId,
      nextCharacterId
    );
    const shouldMarkReconnectSuppression =
      isReconnectJoin &&
      (Boolean(recoveredDisconnect) ||
        (Number.isFinite(reconnectAgeMs) &&
          reconnectAgeMs >= 0 &&
          reconnectAgeMs <= CHAT_RECONNECT_GRACE_MS));
    if (shouldMarkReconnectSuppression && nextPresenceKey) {
      setChatReconnectSuppression(nextPresenceKey, nextRoomId, nextServerId);
    }
    const shouldSuppressReconnectPresence =
      shouldMarkReconnectSuppression;
    const hasOtherPresenceInNextChannel = hasOtherSocketInChannel(
      socket.data.user.id,
      nextRoomId,
      nextServerId,
      socket.id,
      nextCharacterId
    );
    const nextDisplayProfile = preferredCharacter?.name
      ? getUserDisplayProfile(socket.data.user, preferredCharacter)
      : getUserDisplayProfile(socket.data.user);
    const nextDisplayName = nextDisplayProfile?.label || getUserDefaultDisplayName(socket.data.user);

    if (previousServerId && socket.data.isTyping) {
      socket.data.isTyping = false;
      emitChatTypingState(socket, previousRoomId, previousServerId);
    }

    if (previousServerId) {
      socket.leave(socketChannelForRoom(previousRoomId, previousServerId));
      if (shouldClearPreviousAfkState) {
        clearChatAfkState(socket.data.user.id, previousRoomId, previousServerId, {
          skipStateEmit: true,
          skipOnlineRefresh: true
        }, previousCharacterId);
      }

      if (!isSameChannel) {
        if (!shouldSkipPreviousDisconnectPresence && !hasOtherPresenceInPreviousChannel) {
          const previousPresenceMessage = buildRoomPresenceMessage("leave", previousDisplayName);
          emitSystemChatMessage(
            previousRoomId,
            previousServerId,
            previousPresenceMessage.text,
            {
              chat_text_color: "#000000",
              system_kind: "presence",
              presence_kind: previousPresenceMessage.kind,
              presence_actor_name: previousPresenceMessage.actorName,
              presence_actor_chat_text_color: previousDisplayProfile?.chat_text_color || "",
              presence_suffix: previousPresenceMessage.suffix
            }
          );
        }
        touchFestplayActivityForRoom(previousRoom);
      }
    }

    socket.data.preferredCharacterIds = normalizePreferredCharacterMap(socket.data.preferredCharacterIds);
    if (preferredCharacter?.id) {
      socket.data.preferredCharacterIds[nextServerId] = preferredCharacter.id;
      socket.data.activeCharacterId = preferredCharacter.id;
      if (socket.request.session) {
        socket.request.session.preferred_character_ids = socket.data.preferredCharacterIds;
        socket.request.session.save(() => {});
      }
    } else {
      socket.data.activeCharacterId = null;
    }

    socket.data.roomId = nextRoomId;
    socket.data.serverId = nextServerId;
    socket.data.hasJoinedChat = true;
    const previousPresenceServerId = socket.data.presenceServerId;
    socket.data.presenceServerId = nextServerId;
    markSocketChatActivity(socket);
    socket.join(socketChannelForRoom(nextRoomId, nextServerId));
    emitGuestbookNotificationUpdateForUser(socket.data.user.id);
    emitChatAfkStateToSocket(socket, nextRoomId, nextServerId);
    rememberRoomLogParticipant(
      nextRoomId,
      nextServerId,
      socket.data.user,
      nextDisplayName,
      getSocketPreferredCharacterId(socket, nextServerId)
    );
    if (!isSameChannel) {
      const nextPresenceMessage = buildRoomPresenceMessage("enter", nextDisplayName);
      if (!shouldSuppressReconnectPresence && !hasOtherPresenceInNextChannel) {
        emitSystemChatMessage(
          nextRoomId,
          nextServerId,
          nextPresenceMessage.text,
          {
            chat_text_color: "#000000",
            system_kind: "presence",
            presence_kind: nextPresenceMessage.kind,
            presence_actor_name: nextPresenceMessage.actorName,
            presence_actor_chat_text_color: nextDisplayProfile?.chat_text_color || "",
            presence_suffix: nextPresenceMessage.suffix
          }
        );
      } else if (!shouldSuppressReconnectPresence) {
        emitDirectSystemMessageToSocket(socket, nextPresenceMessage.text, {
          chat_text_color: "#000000",
          system_kind: "presence",
          presence_kind: nextPresenceMessage.kind,
          presence_actor_name: nextPresenceMessage.actorName,
          presence_actor_chat_text_color: nextDisplayProfile?.chat_text_color || "",
          presence_suffix: nextPresenceMessage.suffix
        });
      }
    }
    clearPendingRoomDeletion(nextRoomId);
    touchFestplayActivityForRoom(nextRoom);
    if (nextRoom) {
      maybeStartAutomaticRoomLog(nextRoomId, nextServerId, nextRoom, socket);
    }

    const previousRoomWasRemoved = previousServerId
      ? maybeRemoveEmptyRoom(previousRoomId)
      : false;
    if (previousServerId) {
      void finalizeRoomLogIfEmpty(previousRoomId, previousServerId);
    }
    if (previousServerId && !previousRoomWasRemoved) {
      emitOnlineCharacters(previousRoomId, previousServerId);
    }
    emitOnlineCharacters(nextRoomId, nextServerId);
    emitSocialStateUpdatesForRelatedUsers(socket.data.user.id);
    if (previousPresenceServerId !== nextServerId) {
      emitHomeStatsUpdate();
    }
  });

  socket.on("chat:typing", (payload) => {
    if (!socket.data.user) return;

    const roomId =
      Number.isInteger(socket.data.roomId) && socket.data.roomId > 0
        ? socket.data.roomId
        : null;
    let serverId = normalizeServer(socket.data.serverId);

    if (roomId) {
      const room = getRoomWithCharacter(roomId);
      if (!room) return;
      if (!canAccessRoom(socket.data.user, room)) {
        return;
      }
      serverId = normalizeServer(room.server_id || room.character_server_id);
    }

    const wantsTyping = Boolean(payload && typeof payload === "object" ? payload.isTyping : payload);
    if (wantsTyping) {
      markSocketChatActivity(socket);
    }
    if (socket.data.isTyping === wantsTyping) {
      return;
    }

    socket.data.isTyping = wantsTyping;
    emitChatTypingState(socket, roomId, serverId);
  });

  socket.on("chat:activity", () => {
    if (!socket.data.user) return;

    const roomId =
      Number.isInteger(socket.data.roomId) && socket.data.roomId > 0
        ? socket.data.roomId
        : null;
    let serverId = normalizeServer(socket.data.serverId);

    if (roomId) {
      const room = getRoomWithCharacter(roomId);
      if (!room) return;
      if (!canAccessRoom(socket.data.user, room)) {
        return;
      }
      serverId = normalizeServer(room.server_id || room.character_server_id);
    }

    const activeCharacterId = getSocketPreferredCharacterId(socket, serverId);
    markSocketChatActivity(socket);
    clearChatAfkState(socket.data.user.id, roomId, serverId, {
      onlyMode: "auto"
    }, activeCharacterId);
  });

  socket.on("chat:afk:set", (payload) => {
    if (!socket.data.user) return;

    const roomId =
      Number.isInteger(socket.data.roomId) && socket.data.roomId > 0
        ? socket.data.roomId
        : null;
    let serverId = normalizeServer(socket.data.serverId);

    if (roomId) {
      const room = getRoomWithCharacter(roomId);
      if (!room) return;
      if (!canAccessRoom(socket.data.user, room)) {
        return;
      }
      serverId = normalizeServer(room.server_id || room.character_server_id);
    }

    const displayProfile = getSocketDisplayProfile(socket, serverId);
    const actorName = displayProfile?.label || getUserDefaultDisplayName(socket.data.user);
    const reason = String(payload?.reason || "").trim().slice(0, 180);
    const mode = String(payload?.mode || "").trim().toLowerCase() === "auto" ? "auto" : "manual";
    const activeCharacterId = getSocketPreferredCharacterId(socket, serverId);

    setChatAfkState({
      userId: socket.data.user.id,
      characterId: activeCharacterId,
      roomId,
      serverId,
      actorName,
      roleStyle: displayProfile?.role_style || "",
      chatTextColor: displayProfile?.chat_text_color || "",
      reason,
      mode,
      silent: payload?.silent === true
    });
  });

  socket.on("chat:afk:clear", () => {
    if (!socket.data.user) return;

    const roomId =
      Number.isInteger(socket.data.roomId) && socket.data.roomId > 0
        ? socket.data.roomId
        : null;
    let serverId = normalizeServer(socket.data.serverId);

    if (roomId) {
      const room = getRoomWithCharacter(roomId);
      if (!room) return;
      if (!canAccessRoom(socket.data.user, room)) {
        return;
      }
      serverId = normalizeServer(room.server_id || room.character_server_id);
    }

    markSocketChatActivity(socket);
    clearChatAfkState(
      socket.data.user.id,
      roomId,
      serverId,
      {},
      getSocketPreferredCharacterId(socket, serverId)
    );
  });

  socket.on("chat:message", async (rawMessage) => {
    if (!socket.data.user) return;
    if (typeof rawMessage !== "string") return;

    const roomId =
      Number.isInteger(socket.data.roomId) && socket.data.roomId > 0
        ? socket.data.roomId
        : null;
    let serverId = normalizeServer(socket.data.serverId);
    let room = null;

    if (roomId) {
      room = getRoomWithCharacter(roomId);
      if (!room) return;
      if (!canAccessRoom(socket.data.user, room)) {
        return;
      }
      serverId = normalizeServer(room.server_id || room.character_server_id);
    }

    if (socket.data.isTyping) {
      socket.data.isTyping = false;
      emitChatTypingState(socket, roomId, serverId);
    }

    const content = rawMessage.trim();
    if (!content) return;
    markSocketChatActivity(socket);
    touchFestplayActivityForRoom(room);
    const afkMatch = content.match(/^\/afk(?:\s+([\s\S]+))?$/i);
    const shouldKeepAfkState = /^\/me(?:\s+[\s\S]+)?$/i.test(content);
    if (afkMatch) {
      const currentCharacterId = getSocketPreferredCharacterId(socket, serverId);
      const afkDisplayProfile = getSocketDisplayProfile(socket, serverId);
      const afkDisplayName =
        afkDisplayProfile?.label || getUserDefaultDisplayName(socket.data.user);
      const existingAfkState = getChatAfkState(
        socket.data.user.id,
        roomId,
        serverId,
        currentCharacterId
      );

      if (existingAfkState) {
        const clearedAfkState = clearChatAfkState(
          socket.data.user.id,
          roomId,
          serverId,
          {},
          currentCharacterId
        );

        if (clearedAfkState) {
          emitSystemChatMessage(
            roomId,
            serverId,
            "ist wieder zurück",
            {
              system_kind: "actor-message",
              presence_actor_name: afkDisplayName,
              presence_actor_role_style: afkDisplayProfile?.role_style || "",
              presence_actor_chat_text_color: afkDisplayProfile?.chat_text_color || ""
            }
          );
        }
        return;
      }

      setChatAfkState({
        userId: socket.data.user.id,
        characterId: currentCharacterId,
        roomId,
        serverId,
        actorName: afkDisplayName,
        roleStyle: afkDisplayProfile?.role_style || "",
        chatTextColor: afkDisplayProfile?.chat_text_color || "",
        reason: String(afkMatch[1] || "").trim().slice(0, 180),
        mode: "manual"
      });
      return;
    }

    if (!shouldKeepAfkState) {
      clearChatAfkState(
        socket.data.user.id,
        roomId,
        serverId,
        {},
        getSocketPreferredCharacterId(socket, serverId)
      );
    }

    const normalizedCommand = content.toLowerCase();
    const isFestplayChatRoom = Boolean(room) && Number(room.is_festplay_chat) === 1;
    const isManagedFestplayChatRoom =
      isFestplayChatRoom && Number(room.is_manual_festplay_room) === 1;
    const canUseRoomLog = canManageRoomLog(socket.data.user, room);
    const canManageRoomState = canBypassRoomLock(socket.data.user, room);
    const canGrantRoomRights = canGrantRoomPermissions(socket.data.user, room);

    if (isManagedFestplayChatRoom && /^\/(?:rb|rrw?|i|werfen|s|log|logoff)\b/i.test(content)) {
      socket.emit("chat:message", {
        type: "system",
        content: "Festspiel-Räume steuerst du über die eigene Festspiel-Raumseite, nicht direkt im Chat.",
        created_at: formatChatTimestamp()
      });
      return;
    }

    const whisperMatch = content.match(/^\/fl(?:\s+([\s\S]+))?$/i);
    if (whisperMatch) {
      const whisperArgs = parseWhisperCommandArguments(whisperMatch[1] || "");
      if (whisperArgs.targetName.length < 2 || whisperArgs.message.length < 1) {
        socket.emit("chat:message", {
          type: "system",
          content: 'Bitte nutze /fl Name Nachricht. Bei Namen mit Leerzeichen geht auch /fl "Charaktername" Nachricht.',
          created_at: formatChatTimestamp()
        });
        return;
      }

      const whisperTargets = findWhisperTargetsByDisplayName(
        whisperArgs.targetName,
        serverId,
        socket.data.user.id,
        roomId
      );
      if (!whisperTargets.length) {
        socket.emit("chat:message", {
          type: "system",
          content: `${whisperArgs.targetName} ist gerade nicht online.`,
          created_at: formatChatTimestamp()
        });
        return;
      }

      if (whisperTargets.length > 1) {
        socket.emit("chat:message", {
          type: "system",
          content: `Der Name ${whisperArgs.targetName} ist nicht eindeutig. Bitte nutze den genauen Online-Namen.`,
          created_at: formatChatTimestamp()
        });
        return;
      }

      const whisperResult = emitWhisperBetweenUsers(
        socket,
        whisperTargets[0].userId,
        whisperArgs.message,
        serverId,
        roomId
      );
      if (!whisperResult.ok) {
        socket.emit("chat:message", {
          type: "system",
          content: whisperResult.reason === "self"
            ? "Du kannst dir nicht selbst flüstern."
            : `${whisperArgs.targetName} ist gerade nicht online.`,
          created_at: formatChatTimestamp()
        });
      }
      return;
    }

    const nickMatch = content.match(/^\/nick(?:\s+([\s\S]+))?$/i);
    if (nickMatch) {
      const requestedCharacterName = parseInviteCommandArguments(nickMatch[1] || "");
      if (!requestedCharacterName) {
        socket.emit("chat:message", {
          type: "system",
          content: 'Bitte nutze /nick Name. Namen mit Leerzeichen gehen auch in Anführungszeichen.',
          created_at: formatChatTimestamp()
        });
        return;
      }

      const matchingCharacters = findOwnedChatCharactersByName(
        socket.data.user.id,
        serverId,
        requestedCharacterName
      );
      if (!matchingCharacters.length) {
        socket.emit("chat:message", {
          type: "system",
          content: `Du hast auf ${getServerLabel(serverId)} keinen eigenen Charakter mit dem Namen ${requestedCharacterName}.`,
          created_at: formatChatTimestamp()
        });
        return;
      }

      if (matchingCharacters.length > 1) {
        socket.emit("chat:message", {
          type: "system",
          content: `Den Namen ${requestedCharacterName} gibt es bei deinen eigenen Charakteren mehrfach. Bitte nutze einen eindeutigen Namen.`,
          created_at: formatChatTimestamp()
        });
        return;
      }

      const targetCharacter = matchingCharacters[0];
      const currentCharacterId = getSocketPreferredCharacterId(socket, serverId);
      if (Number(targetCharacter.id) === Number(currentCharacterId)) {
        socket.emit("chat:message", {
          type: "system",
          content: `Du bist bereits als ${targetCharacter.name} unterwegs.`,
          created_at: formatChatTimestamp()
        });
        return;
      }

      ejectConflictingChatSocketsForCharacter(
        socket.data.user.id,
        serverId,
        targetCharacter.id,
        socket.id,
        roomId
      );
      const previousDisplayProfile = getSocketDisplayProfile(socket, serverId);
      const previousDisplayName =
        previousDisplayProfile?.label || getUserDefaultDisplayName(socket.data.user);
      const hasOtherPresenceAsCurrentCharacter = hasOtherSocketInChannel(
        socket.data.user.id,
        roomId,
        serverId,
        socket.id,
        currentCharacterId
      );

      if (!hasOtherPresenceAsCurrentCharacter) {
        clearChatAfkState(socket.data.user.id, roomId, serverId, {
          skipStateEmit: true,
          skipOnlineRefresh: true
        }, currentCharacterId);
      }

      socket.data.preferredCharacterIds = normalizePreferredCharacterMap(socket.data.preferredCharacterIds);
      socket.data.preferredCharacterIds[serverId] = Number(targetCharacter.id);
      socket.data.activeCharacterId = Number(targetCharacter.id);
      if (socket.request.session) {
        socket.request.session.preferred_character_ids = socket.data.preferredCharacterIds;
        socket.request.session.save(() => {});
      }

      const nextDisplayProfile = getSocketDisplayProfile(socket, serverId);
      const nextDisplayName = nextDisplayProfile?.label || String(targetCharacter.name || "").trim() || previousDisplayName;

      emitUserDisplayProfileToSocket(socket);
      emitGuestbookNotificationUpdateForUser(socket.data.user.id);
      emitChatAfkStateToSocket(socket, roomId, serverId);
      rememberRoomLogParticipant(
        roomId,
        serverId,
        socket.data.user,
        nextDisplayName,
        getSocketPreferredCharacterId(socket, serverId)
      );
      emitSystemChatMessage(
        roomId,
        serverId,
        buildChatCharacterSwitchSuffix(nextDisplayName),
        {
          system_kind: "actor-message",
          presence_actor_name: previousDisplayName,
          presence_actor_role_style: previousDisplayProfile?.role_style || "",
          presence_actor_chat_text_color: previousDisplayProfile?.chat_text_color || ""
        }
      );
      emitOnlineCharacters(roomId, serverId);
      emitSocialStateUpdatesForRelatedUsers(socket.data.user.id);
      return;
    }

    if (normalizedCommand === "/s") {
      if (!roomId || !room) {
        socket.emit("chat:message", {
          type: "system",
          content: "Der gemeinsame Treffpunkt kann nicht abgeschlossen werden.",
          created_at: formatChatTimestamp()
        });
        return;
      }

      if (!canManageRoomState) {
        socket.emit("chat:message", {
          type: "system",
          content: "Nur Personen mit Raumrechten können diesen Raum abschließen oder öffnen.",
          created_at: formatChatTimestamp()
        });
        return;
      }

      const nextLockState = Number(room.is_locked) === 1 ? 0 : 1;
      db.prepare("UPDATE chat_rooms SET is_locked = ? WHERE id = ?").run(nextLockState, roomId);
      const refreshedRoom = getRoomWithCharacter(roomId);
      emitSystemChatMessage(
        roomId,
        serverId,
        nextLockState === 1 ? "Der Raum wurde abgeschlossen." : "Der Raum wurde geöffnet."
      );
      emitRoomStateUpdate(roomId, serverId, refreshedRoom);
      io.to(socketChannelForRoom(roomId, serverId)).emit("chat:room-state", {
        roomId,
        isLocked: nextLockState === 1
      });
      return;
    }

    if (normalizedCommand === "/log") {
      if (!canUseRoomLog) {
        socket.emit("chat:message", {
          type: "system",
          content: roomId
            ? "Nur Personen mit Raumrechten können das Log hier starten."
            : "Nur Admins und Moderatoren können das Log hier starten.",
          created_at: formatChatTimestamp()
        });
        return;
      }

      if (getActiveRoomLog(roomId, serverId)) {
        socket.emit("chat:message", {
          type: "system",
          content: "In diesem Raum läuft bereits ein Log.",
          created_at: formatChatTimestamp()
        });
        return;
      }

      startRoomLog(roomId, serverId, room, socket);
      emitSystemChatMessage(roomId, serverId, "Log wurde gestartet.");
      return;
    }

    if (normalizedCommand === "/logoff") {
      if (!canUseRoomLog) {
        socket.emit("chat:message", {
          type: "system",
          content: roomId
            ? "Nur Personen mit Raumrechten können das Log hier beenden."
            : "Nur Admins und Moderatoren können das Log hier beenden.",
          created_at: formatChatTimestamp()
        });
        return;
      }

      if (!getActiveRoomLog(roomId, serverId)) {
        socket.emit("chat:message", {
          type: "system",
          content: "In diesem Raum läuft aktuell kein Log.",
          created_at: formatChatTimestamp()
        });
        return;
      }

      emitSystemChatMessage(roomId, serverId, "Log wurde beendet.");
      const finalizeResult = await finalizeRoomLog(roomId, serverId, { reason: "manual" });
      let resultMessage = "Das Log wurde beendet.";

      if (!finalizeResult.hadLog) {
        resultMessage = "Es war kein aktives Log mehr vorhanden.";
      } else {
        const resultParts = [];
        if (finalizeResult.backupSavedCount > 0) {
          resultParts.push(
            `Log wurde als Backup für ${finalizeResult.backupSavedCount} Person(en) gespeichert.`
          );
        }

        if (finalizeResult.deliveredCount > 0 && finalizeResult.failedCount === 0) {
          resultParts.push(`Per E-Mail ging es an ${finalizeResult.deliveredCount} Person(en).`);
        } else if (finalizeResult.deliveredCount > 0) {
          resultParts.push(
            `Per E-Mail ging es an ${finalizeResult.deliveredCount} Person(en), ${finalizeResult.failedCount} Versand(e) sind fehlgeschlagen.`
          );
        }

        if (finalizeResult.pdfOnlyCount > 0 || finalizeResult.plainOnlyCount > 0) {
          const fallbackParts = [];
          if (finalizeResult.pdfOnlyCount > 0) {
            fallbackParts.push(`${finalizeResult.pdfOnlyCount}x nur als PDF`);
          }
          if (finalizeResult.plainOnlyCount > 0) {
            fallbackParts.push(`${finalizeResult.plainOnlyCount}x ohne Anhang`);
          }
          resultParts.push(`Fallback aktiv: ${fallbackParts.join(", ")}.`);
        }

        if (finalizeResult.emailDisabledCount > 0) {
          resultParts.push(
            `${finalizeResult.emailDisabledCount} Beteiligte haben E-Mail-Logs im Account deaktiviert.`
          );
        }

        if (finalizeResult.missingEmailCount > 0) {
          resultParts.push(
            `${finalizeResult.missingEmailCount} Beteiligte hatten keine hinterlegte E-Mail-Adresse.`
          );
        }

        if (finalizeResult.mailerUnavailableCount > 0) {
          resultParts.push(
            `${finalizeResult.mailerUnavailableCount} E-Mail(s) konnten nicht versendet werden, weil der Mailversand nicht eingerichtet ist.`
          );
        }

        if (finalizeResult.failedCount > 0) {
          resultParts.push(
            "Ein Teil des Log-Versands ist fehlgeschlagen. Bitte prüfe die Mail-Konfiguration."
          );
        }

        if (finalizeResult.lastErrorSummary) {
          resultParts.push(`Ursache: ${finalizeResult.lastErrorSummary}`);
        }

        resultMessage = resultParts.length
          ? resultParts.join(" ")
          : "Das Log wurde beendet.";
      }

      socket.emit("chat:message", {
        type: "system",
        content: resultMessage,
        created_at: formatChatTimestamp()
      });
      return;
    }

    const revokeRoomRightsMatch = content.match(/^\/rrw(?:\s+(.+))?$/i);
    if (revokeRoomRightsMatch) {
      if (!roomId || !room) {
        socket.emit("chat:message", {
          type: "system",
          content: "Raumrechte können nur in einem geöffneten Raum entzogen werden.",
          created_at: formatChatTimestamp()
        });
        return;
      }

      if (!canGrantRoomRights) {
        socket.emit("chat:message", {
          type: "system",
          content: "Nur der Raumbesitzer kann Raumrechte entziehen.",
          created_at: formatChatTimestamp()
        });
        return;
      }

      const requestedTargetName = parseInviteCommandArguments(revokeRoomRightsMatch[1] || "");
      if (requestedTargetName.length < 2) {
        socket.emit("chat:message", {
          type: "system",
          content: 'Bitte nutze /rrw Charaktername. Bei Namen mit Leerzeichen geht auch /rrw "Charaktername".',
          created_at: formatChatTimestamp()
        });
        return;
      }

      const targets = findInviteTargetsByDisplayName(requestedTargetName, serverId);
      if (!targets.length) {
        socket.emit("chat:message", {
          type: "system",
          content: `${requestedTargetName} ist gerade nicht online auf diesem Server.`,
          created_at: formatChatTimestamp()
        });
        return;
      }

      if (targets.length > 1) {
        socket.emit("chat:message", {
          type: "system",
          content: `Der Name ${requestedTargetName} ist nicht eindeutig. Bitte nutze den genauen Online-Namen.`,
          created_at: formatChatTimestamp()
        });
        return;
      }

      const target = targets[0];
      if (Number(target.userId) === Number(room.created_by_user_id)) {
        socket.emit("chat:message", {
          type: "system",
          content: `${target.name} besitzt diesen Raum bereits.`,
          created_at: formatChatTimestamp()
        });
        return;
      }

      const removed = revokePersistentRoomRights(roomId, target.userId);
      if (!removed) {
        socket.emit("chat:message", {
          type: "system",
          content: `${target.name} hat in diesem Raum gerade keine Raumrechte.`,
          created_at: formatChatTimestamp()
        });
        return;
      }

      emitDirectSystemMessageToSocket(
        socket,
        `${target.name} hat nun keine Raumrechte mehr für ${room.name}.`
      );
      emitDirectSystemMessageToUser(
        target.userId,
        `Deine Raumrechte für ${room.name} wurden entzogen.`
      );
      emitOnlineCharacters(roomId, serverId);
      emitRoomStateUpdate(roomId, serverId, getRoomWithCharacter(roomId));
      return;
    }

    const grantRoomRightsMatch = content.match(/^\/rr(?:\s+(.+))?$/i);
    if (grantRoomRightsMatch) {
      if (!roomId || !room) {
        socket.emit("chat:message", {
          type: "system",
          content: "Raumrechte können nur in einem geöffneten Raum vergeben werden.",
          created_at: formatChatTimestamp()
        });
        return;
      }

      if (!canGrantRoomRights) {
        socket.emit("chat:message", {
          type: "system",
          content: "Nur der Raumbesitzer kann Raumrechte vergeben.",
          created_at: formatChatTimestamp()
        });
        return;
      }

      const requestedTargetName = parseInviteCommandArguments(grantRoomRightsMatch[1] || "");
      if (requestedTargetName.length < 2) {
        socket.emit("chat:message", {
          type: "system",
          content: 'Bitte nutze /rr Charaktername. Bei Namen mit Leerzeichen geht auch /rr "Charaktername".',
          created_at: formatChatTimestamp()
        });
        return;
      }

      const targets = findInviteTargetsByDisplayName(requestedTargetName, serverId);
      if (!targets.length) {
        socket.emit("chat:message", {
          type: "system",
          content: `${requestedTargetName} ist gerade nicht online auf diesem Server.`,
          created_at: formatChatTimestamp()
        });
        return;
      }

      if (targets.length > 1) {
        socket.emit("chat:message", {
          type: "system",
          content: `Der Name ${requestedTargetName} ist nicht eindeutig. Bitte nutze den genauen Online-Namen.`,
          created_at: formatChatTimestamp()
        });
        return;
      }

      const target = targets[0];
      if (Number(target.userId) === Number(room.created_by_user_id)) {
        socket.emit("chat:message", {
          type: "system",
          content: `${target.name} besitzt diesen Raum bereits.`,
          created_at: formatChatTimestamp()
        });
        return;
      }

      const granted = grantPersistentRoomRights(roomId, target.userId, socket.data.user.id);
      if (!granted) {
        socket.emit("chat:message", {
          type: "system",
          content: `${target.name} hat in diesem Raum bereits Raumrechte.`,
          created_at: formatChatTimestamp()
        });
        return;
      }

      emitDirectSystemMessageToSocket(
        socket,
        `${target.name} hat nun Raumrechte für ${room.name}.`
      );
      emitDirectSystemMessageToUser(
        target.userId,
        `Du hast nun Raumrechte für ${room.name}.`
      );
      emitOnlineCharacters(roomId, serverId);
      emitRoomStateUpdate(roomId, serverId, getRoomWithCharacter(roomId));
      return;
    }

    const inviteMatch = content.match(/^\/i(?:\s+(.+))?$/i);
    if (inviteMatch) {
      if (!roomId || !room) {
        socket.emit("chat:message", {
          type: "system",
          content: "Du kannst nur aus einem offenen Raum heraus Einladungen senden.",
          created_at: formatChatTimestamp()
        });
        return;
      }

      if (!canManageRoomState) {
        socket.emit("chat:message", {
          type: "system",
          content: "Nur Personen mit Raumrechten können Einladungen in diesen Raum verschicken.",
          created_at: formatChatTimestamp()
        });
        return;
      }

      const requestedTargetName = parseInviteCommandArguments(inviteMatch[1] || "");
      if (requestedTargetName.length < 2) {
        socket.emit("chat:message", {
          type: "system",
          content: 'Bitte nutze /i Charaktername. Bei Namen mit Leerzeichen kannst du /i "Charaktername" schreiben.',
          created_at: formatChatTimestamp()
        });
        return;
      }

      const inviteTargets = findInviteTargetsByDisplayName(
        requestedTargetName,
        serverId,
        socket.data.user.id
      );

      if (!inviteTargets.length) {
        socket.emit("chat:message", {
          type: "system",
          content: `${requestedTargetName} ist gerade nicht online auf diesem Server.`,
          created_at: formatChatTimestamp()
        });
        return;
      }

      if (inviteTargets.length > 1) {
        socket.emit("chat:message", {
          type: "system",
          content: `Der Name ${requestedTargetName} ist nicht eindeutig. Bitte nutze den genauen Online-Namen.`,
          created_at: formatChatTimestamp()
        });
        return;
      }

      const inviteTarget = inviteTargets[0];
      if (Number(inviteTarget.roomId) === Number(roomId)) {
        socket.emit("chat:message", {
          type: "system",
          content: `${inviteTarget.name} ist bereits in diesem Raum.`,
          created_at: formatChatTimestamp()
        });
        return;
      }

      const inviteSenderProfile = getSocketDisplayProfile(socket, serverId);
      const inviteSenderName =
        inviteSenderProfile?.label || getUserDefaultDisplayName(socket.data.user);
      const invite = createPendingRoomInvite({
        roomId,
        serverId,
        senderUserId: socket.data.user.id,
        senderName: inviteSenderName,
        senderChatTextColor: inviteSenderProfile?.chat_text_color || "",
        targetUserId: inviteTarget.userId,
        targetName: inviteTarget.name,
        roomName: room.name,
        roomTeaser: room.description || ""
      });

      emitDirectSystemMessageToSocket(
        socket,
        `Einladung an ${inviteTarget.name} f\u00fcr den Raum ${room.name} gesendet.`
      );
      emitDirectSystemMessageToUser(
        inviteTarget.userId,
        `${inviteSenderName} l\u00e4dt dich in den Raum ${room.name} ein.`
      );
      getAllSocketsForUser(inviteTarget.userId).forEach((memberSocket) => {
        memberSocket.emit("chat:room-invite", {
          inviteId: invite.id,
          inviterName: inviteSenderName,
          inviterChatTextColor: inviteSenderProfile?.chat_text_color || "",
          roomName: room.name,
          roomTeaser: room.description || "",
          expiresAt: invite.expiresAt
        });
      });
      return;
    }

    const kickMatch = content.match(/^\/werfen(?:\s+(.+))?$/i);
    if (kickMatch) {
      if (!roomId || !room) {
        socket.emit("chat:message", {
          type: "system",
          content: "Du kannst nur in einem geöffneten Raum Personen werfen.",
          created_at: formatChatTimestamp()
        });
        return;
      }

      if (!canManageRoomState) {
        socket.emit("chat:message", {
          type: "system",
          content: "Nur der Raumbesitzer oder Personen mit Raumrechten können hier jemanden werfen.",
          created_at: formatChatTimestamp()
        });
        return;
      }

      const requestedTargetName = parseInviteCommandArguments(kickMatch[1] || "");
      if (requestedTargetName.length < 2) {
        socket.emit("chat:message", {
          type: "system",
          content:
            'Bitte nutze /werfen Charaktername. Bei Namen mit Leerzeichen geht auch /werfen "Charaktername".',
          created_at: formatChatTimestamp()
        });
        return;
      }

      const kickTargets = findInviteTargetsByDisplayName(
        requestedTargetName,
        serverId,
        socket.data.user.id
      );

      if (!kickTargets.length) {
        socket.emit("chat:message", {
          type: "system",
          content: `${requestedTargetName} ist gerade nicht online auf diesem Server.`,
          created_at: formatChatTimestamp()
        });
        return;
      }

      if (kickTargets.length > 1) {
        socket.emit("chat:message", {
          type: "system",
          content: `Der Name ${requestedTargetName} ist nicht eindeutig. Bitte nutze den genauen Online-Namen.`,
          created_at: formatChatTimestamp()
        });
        return;
      }

      const kickTarget = kickTargets[0];
      const targetRoomSockets = getUserSocketsInChannel(roomId, serverId, kickTarget.userId);
      if (!targetRoomSockets.length) {
        socket.emit("chat:message", {
          type: "system",
          content: `${kickTarget.name} ist nicht in diesem Raum.`,
          created_at: formatChatTimestamp()
        });
        return;
      }

      const kickerIsRoomOwner = isRoomOwner(socket.data.user, room);
      const targetIsRoomOwner = Number(kickTarget.userId) === Number(room.created_by_user_id);
      if (!kickerIsRoomOwner && targetIsRoomOwner) {
        socket.emit("chat:message", {
          type: "system",
          content: `${kickTarget.name} hat diesen Raum geöffnet und kann nicht von Raumrechten geworfen werden.`,
          created_at: formatChatTimestamp()
        });
        return;
      }

      if (Number(kickTarget.userId) === Number(socket.data.user.id)) {
        socket.emit("chat:message", {
          type: "system",
          content: "Du kannst dich nicht selbst aus dem Raum werfen.",
          created_at: formatChatTimestamp()
        });
        return;
      }

      const targetPreferredCharacter = getPreferredCharacterForUser(
        kickTarget.userId,
        serverId,
        getSocketPreferredCharacterId(targetRoomSockets[0], serverId)
      );
      const redirectSuffix = targetPreferredCharacter?.id
        ? `&character_id=${targetPreferredCharacter.id}`
        : "";
      const redirectUrl = `/chat?server=${encodeURIComponent(serverId)}${redirectSuffix}`;

      emitSystemChatMessage(
        roomId,
        serverId,
        `${kickTarget.name} wurde aus dem Raum geworfen.`
      );

      targetRoomSockets.forEach((memberSocket) => {
        memberSocket.data.skipDisconnectPresence = true;
        emitDirectSystemMessageToSocket(
          memberSocket,
          `Du wurdest aus dem Raum ${room.name} geworfen.`
        );
        memberSocket.emit("chat:redirect", {
          url: redirectUrl,
          delayMs: 650
        });
      });
      return;
    }

    const rollMatch = content.match(/^\/roll(?:\s+(.+))?$/i);
    const canRollInOpenTreffpunkt =
      !roomId && !room && (serverId === "free-rp" || serverId === "erp");
    if (rollMatch && canRollInOpenTreffpunkt) {
      const rollConfig = parseRollCommandArguments(rollMatch[1] || "");
      if (!rollConfig) {
        socket.emit("chat:message", {
          type: "system",
          content: "Bitte nutze /roll 1w20, /roll 1w10 oder /roll 2w6+3.",
          created_at: formatChatTimestamp()
        });
        return;
      }

      const rollResult = rollDiceExpression(rollConfig);
      if (!rollResult) {
        socket.emit("chat:message", {
          type: "system",
          content: "Der Wurf konnte gerade nicht ausgeführt werden.",
          created_at: formatChatTimestamp()
        });
        return;
      }

      const rollDisplayProfile = getSocketDisplayProfile(socket, serverId);
      const rollDisplayName =
        rollDisplayProfile?.label || getUserDefaultDisplayName(socket.data.user);

      emitSystemChatMessage(
        roomId,
        serverId,
        `hat mit ${rollConfig.notation} gewürfelt (${rollResult.resultLabel}).`,
        {
          system_kind: "dice-roll",
          presence_actor_name: rollDisplayName,
          presence_actor_chat_text_color: rollDisplayProfile?.chat_text_color || ""
        }
      );
      return;
    }

    const canRollInCurrentChannel =
      Boolean((roomId && room) || serverId === "free-rp" || serverId === "erp");
    if (rollMatch) {
      if (!canRollInCurrentChannel) {
        socket.emit("chat:message", {
          type: "system",
          content: "Du kannst nur in einem geöffneten Raum würfeln.",
          created_at: formatChatTimestamp()
        });
        return;
      }

      const rollConfig = parseRollCommandArguments(rollMatch[1] || "");
      if (!rollConfig) {
        socket.emit("chat:message", {
          type: "system",
          content: "Bitte nutze /roll 1w20, /roll 1w10 oder /roll 2w6+3.",
          created_at: formatChatTimestamp()
        });
        return;
      }

      const rollResult = rollDiceExpression(rollConfig);
      if (!rollResult) {
        socket.emit("chat:message", {
          type: "system",
          content: "Der Wurf konnte gerade nicht ausgeführt werden.",
          created_at: formatChatTimestamp()
        });
        return;
      }

      const rollDisplayProfile = getSocketDisplayProfile(socket, serverId);
      const rollDisplayName =
        rollDisplayProfile?.label || getUserDefaultDisplayName(socket.data.user);

      emitSystemChatMessage(
        roomId,
        serverId,
        `hat mit ${rollConfig.notation} gewürfelt (${rollResult.resultLabel}).`,
        {
          system_kind: "dice-roll",
          presence_actor_name: rollDisplayName,
          presence_actor_chat_text_color: rollDisplayProfile?.chat_text_color || ""
        }
      );
      return;
    }

    const roomRenameMatch = content.match(/^\/rb(?:\s+([\s\S]+))?$/i);
    if (roomRenameMatch) {
      if (!roomId || !room) {
        socket.emit("chat:message", {
          type: "system",
          content: "Du musst zuerst einen Raum betreten, um ihn mit /rb umzubenennen.",
          created_at: formatChatTimestamp()
        });
        return;
      }

      if (Number(room.is_festplay_chat) === 1) {
        socket.emit("chat:message", {
          type: "system",
          content: "Festspiel-Räume steuerst du über die eigene Festspiel-Raumseite, nicht direkt im Chat.",
          created_at: formatChatTimestamp()
        });
        return;
      }

      if (!isRoomOwner(socket.data.user, room)) {
        socket.emit("chat:message", {
          type: "system",
          content: "Nur der Besitzer darf diesen Raum mit /rb umbenennen.",
          created_at: formatChatTimestamp()
        });
        return;
      }

      const roomRenameArgs = parseRoomRenameCommandArguments(roomRenameMatch[1] || "");
      const currentRoomName = normalizeRoomName(room.name);
      const currentRoomDescription = normalizeRoomDescription(room.description);
      const requestedRoomName = roomRenameArgs.roomName || currentRoomName;
      const requestedRoomDescription = roomRenameArgs.hasDescription
        ? roomRenameArgs.roomDescription
        : "";

      if (requestedRoomName.length < 2) {
        socket.emit("chat:message", {
          type: "system",
          content: 'Bitte nutze /rb Raumname "Raumbeschreibung". Die Raumbeschreibung ist optional.',
          created_at: formatChatTimestamp()
        });
        return;
      }

      const nextRoomNameKey = toRoomNameKey(requestedRoomName);
      const currentRoomNameKey = toRoomNameKey(currentRoomName);
      let conflictingRoom = null;

      if (
        nextRoomNameKey !== currentRoomNameKey ||
        requestedRoomDescription !== currentRoomDescription
      ) {
        if (Number(room.festplay_id) > 0 && Number(room.is_festplay_side_chat) === 1) {
          conflictingRoom = findFestplaySideChatByNameKey(
            room.festplay_id,
            room.server_id,
            nextRoomNameKey,
            requestedRoomDescription
          );
        } else if (Number(room.is_public_room) === 1) {
          conflictingRoom = findPublicRoomByNameKey(
            room.server_id,
            nextRoomNameKey,
            requestedRoomDescription
          );
        } else {
          conflictingRoom = findOwnedRoomByNameKey(
            socket.data.user.id,
            room.server_id,
            nextRoomNameKey,
            requestedRoomDescription
          );
        }
      }

      if (conflictingRoom && Number(conflictingRoom.id) !== Number(roomId)) {
        socket.emit("chat:message", {
          type: "system",
          content: "Du hast bereits einen Raum mit diesem Namen.",
          created_at: formatChatTimestamp()
        });
        return;
      }

      db.prepare(
        `UPDATE chat_rooms
            SET name = ?,
                name_key = ?,
                description = ?
          WHERE id = ?`
      ).run(requestedRoomName, nextRoomNameKey, requestedRoomDescription, roomId);

      if (Number(room.festplay_id) > 0) {
        touchFestplayActivity(room.festplay_id);
      }

      const refreshedRoom = getRoomWithCharacter(roomId);
      emitRoomStateUpdate(roomId, room.server_id, refreshedRoom);
      emitRoomListRefresh(room.server_id);
      io.to(socketChannelForRoom(roomId, room.server_id)).emit("chat:room-state", {
        roomId,
        isLocked: Number(refreshedRoom?.is_locked) === 1,
        roomName: refreshedRoom?.name || requestedRoomName,
        roomDescription: refreshedRoom?.description || ""
      });

      socket.emit("chat:message", {
        type: "system",
        content: `Raum wurde in ${requestedRoomName} umbenannt.`,
        created_at: formatChatTimestamp()
      });
      return;
    }

    const roomSwitchMatch = content.match(/^\/rw(?:\s+(.+))?$/i);
    if (roomSwitchMatch) {
      const roomSwitchArgs = parseRoomSwitchCommandArguments(roomSwitchMatch[1] || "");
      const requestedRoomName = roomSwitchArgs.roomName;
        const requestedRoomDescription = roomSwitchArgs.roomDescription;
      if (requestedRoomName.length < 2) {
        socket.emit("chat:message", {
          type: "system",
          content: 'Bitte nutze /rw Raumname "Beschreibung". Die Beschreibung ist optional.',
          created_at: formatChatTimestamp()
        });
        return;
      }

      const festplayContextId = Number(room?.festplay_id);
      const preferredCharacter =
        Number.isInteger(festplayContextId) && festplayContextId > 0
          ? getPreferredFestplayChatCharacterForUser(
              socket.data.user.id,
              festplayContextId,
              getSocketPreferredCharacterId(socket, serverId)
            )
          : getPreferredCharacterForUser(
              socket.data.user.id,
              serverId,
              getSocketPreferredCharacterId(socket, serverId)
            );

      if (!preferredCharacter?.id) {
        socket.emit("chat:message", {
          type: "system",
          content:
            Number.isInteger(festplayContextId) && festplayContextId > 0
              ? "Du brauchst einen freigeschalteten Charakter, um in diesem Festspiel den Raum zu wechseln."
              : "Du brauchst einen eigenen Charakter, um mit /rw den Raum zu wechseln.",
          created_at: formatChatTimestamp()
        });
        return;
      }

      const targetRoom =
        Number.isInteger(festplayContextId) && festplayContextId > 0
          ? ensureFestplaySideChatRoom(
              socket.data.user.id,
              preferredCharacter,
              festplayContextId,
              requestedRoomName,
              requestedRoomDescription
            )
          : ensurePublicRoomForServer(
              socket.data.user.id,
              preferredCharacter,
              requestedRoomName,
              requestedRoomDescription
            );

      if (!targetRoom?.id) {
        socket.emit("chat:message", {
          type: "system",
          content: "Der Zielraum konnte nicht geöffnet werden.",
          created_at: formatChatTimestamp()
        });
        return;
      }

      if (roomId && Number(targetRoom.id) === Number(roomId)) {
        socket.emit("chat:message", {
          type: "system",
          content: `Du bist bereits im Raum ${targetRoom.name}.`,
          created_at: formatChatTimestamp()
        });
        return;
      }

      const switchDisplayProfile = getSocketDisplayProfile(socket, serverId);
      const switchDisplayName =
        switchDisplayProfile?.label || getUserDefaultDisplayName(socket.data.user);

      emitSystemChatMessage(
        roomId,
        serverId,
        `${switchDisplayName} hat in den Raum ${targetRoom.name} gewechselt.`,
        {
          chat_text_color: "#000000",
          system_kind: "room-switch",
          presence_actor_name: switchDisplayName,
          presence_actor_chat_text_color: switchDisplayProfile?.chat_text_color || "",
          room_switch_target_name: targetRoom.name
        }
      );
      socket.data.skipDisconnectPresence = true;
      socket.emit("chat:redirect", {
        url: `/chat?room_id=${targetRoom.id}&character_id=${preferredCharacter.id}`,
        delayMs: 550
      });
      return;
    }

    const displayProfile = getSocketDisplayProfile(socket, serverId);
    const createdAt = formatChatTimestamp();
    const messageTimeIso = new Date().toISOString();
    const showNameTime = socket.data.user?.show_own_chat_time === true;
    appendMessageToActiveRoomLog(roomId, serverId, {
      type: "chat",
      user_id: socket.data.user.id,
      username: displayProfile.label,
      role_style: displayProfile.role_style || "",
      chat_text_color: displayProfile.chat_text_color || "",
      content,
      created_at: createdAt,
      message_time_iso: messageTimeIso,
      show_name_time: showNameTime ? 1 : 0
    });

    io.to(socketChannelForRoom(roomId, serverId)).emit("chat:message", {
      user_id: socket.data.user.id,
      character_id: getSocketPreferredCharacterId(socket, serverId),
      username: displayProfile.label,
      role_style: displayProfile.role_style || "",
      chat_text_color: displayProfile.chat_text_color || "",
      content,
      created_at: createdAt,
      message_time_iso: messageTimeIso,
      show_name_time: showNameTime
    });
    maybeTriggerTavernInnkeeperReaction({
      room,
      roomId,
      serverId,
      content,
      actorName: displayProfile.label || getUserDefaultDisplayName(socket.data.user)
    });
  });

  socket.on("chat:whisper", (payload) => {
    if (!socket.data.user) return;
    if (!payload || typeof payload !== "object") return;

    const targetUserId = Number(payload.targetUserId);
    const content = String(payload.content || "").trim();
    if (!Number.isInteger(targetUserId) || targetUserId < 1 || !content) {
      return;
    }

    const roomId =
      Number.isInteger(socket.data.roomId) && socket.data.roomId > 0
        ? socket.data.roomId
        : null;
    let serverId = normalizeServer(socket.data.serverId);

    if (roomId) {
      const room = getRoomWithCharacter(roomId);
      if (!room) return;
      if (!canAccessRoom(socket.data.user, room)) {
        return;
      }
      serverId = normalizeServer(room.server_id || room.character_server_id);
    }

    markSocketChatActivity(socket);
    clearChatAfkState(
      socket.data.user.id,
      roomId,
      serverId,
      {},
      getSocketPreferredCharacterId(socket, serverId)
    );
    emitWhisperBetweenUsers(socket, targetUserId, content, serverId, roomId);
  });

  socket.on("chat:room-invite-response", (payload) => {
    if (!socket.data.user) return;
    if (!payload || typeof payload !== "object") return;

    const inviteId = String(payload.inviteId || "").trim();
    const accepted = Boolean(payload.accepted);
    const invite = getPendingRoomInvite(inviteId);
    if (!invite) {
      emitDirectSystemMessageToSocket(socket, "Diese Einladung ist nicht mehr aktuell.");
      return;
    }

    if (Number(invite.targetUserId) !== Number(socket.data.user.id)) {
      emitDirectSystemMessageToSocket(socket, "Diese Einladung ist nicht für dich bestimmt.");
      return;
    }

    pendingRoomInvites.delete(inviteId);

    const recipientProfile = getSocketDisplayProfile(socket, invite.serverId);
    const recipientName =
      String(invite.targetName || "").trim() ||
      recipientProfile?.label ||
      getUserDefaultDisplayName(socket.data.user);

    if (!accepted) {
      emitDirectSystemMessageToSocket(
        socket,
        `Du hast die Einladung in den Raum ${invite.roomName} abgelehnt.`
      );
      emitDirectSystemMessageToUser(
        invite.senderUserId,
        `${recipientName} hat die Einladung in den Raum ${invite.roomName} abgelehnt.`
      );
      return;
    }

    const invitedRoom = getRoomWithCharacter(invite.roomId);
    if (!invitedRoom) {
      emitDirectSystemMessageToSocket(
        socket,
        "Der eingeladene Raum existiert nicht mehr."
      );
      emitDirectSystemMessageToUser(
        invite.senderUserId,
        `${recipientName} konnte die Einladung nicht mehr annehmen, weil der Raum nicht mehr existiert.`
      );
      return;
    }

    grantRoomInviteAccess(socket.data.user.id, invite.roomId);
    emitDirectSystemMessageToSocket(
      socket,
      `Du nimmst die Einladung in den Raum ${invite.roomName} an.`
    );
    emitDirectSystemMessageToUser(
      invite.senderUserId,
      `${recipientName} hat die Einladung in den Raum ${invite.roomName} angenommen.`
    );

    const preferredCharacter = getPreferredCharacterForUser(
      socket.data.user.id,
      invite.serverId,
      getSocketPreferredCharacterId(socket, invite.serverId)
    );
    const redirectSuffix = preferredCharacter?.id
      ? `&character_id=${preferredCharacter.id}`
      : "";

    socket.emit("chat:redirect", {
      url: `/chat?room_id=${invite.roomId}${redirectSuffix}`,
      delayMs: 450
    });
  });

  socket.on("disconnect", () => {
    if (socket.data.immediateDisconnectHandled === true) {
      return;
    }

    const previousRoomId =
      Number.isInteger(socket.data.roomId) && socket.data.roomId > 0
        ? socket.data.roomId
        : null;
    const previousServerId = ALLOWED_SERVER_IDS.has(String(socket.data.serverId || "").trim().toLowerCase())
      ? normalizeServer(socket.data.serverId)
      : null;
    const previousRoom = previousRoomId ? getRoomWithCharacter(previousRoomId) : null;
    if (previousServerId && socket.data.hasJoinedChat === true) {
      const previousCharacterId = getSocketPreferredCharacterId(socket, previousServerId);
      if (socket.data.isTyping) {
        socket.data.isTyping = false;
        emitChatTypingState(socket, previousRoomId, previousServerId);
      }
      if (
        hasOtherSocketInChannel(
          socket.data.user.id,
          previousRoomId,
          previousServerId,
          socket.id,
          previousCharacterId
        )
      ) {
        return;
      }
      const disconnectDisplayProfile = getSocketDisplayProfile(socket, previousServerId);
      schedulePendingChatDisconnect({
        userId: socket.data.user.id,
        characterId: previousCharacterId,
        roomId: previousRoomId,
        serverId: previousServerId,
        displayName: disconnectDisplayProfile.label || `User ${socket.data.user?.id || "?"}`,
        chatTextColor: disconnectDisplayProfile?.chat_text_color || "",
        skipPresence: socket.data.skipDisconnectPresence
      });
      touchFestplayActivityForRoom(previousRoom);
      maybeRemoveEmptyRoom(previousRoomId);
      return;
    }

    if (socket.data.user?.id) {
      emitSocialStateUpdatesForRelatedUsers(socket.data.user.id);
      emitHomeStatsUpdate();
    }
  });
});

const port = Number(process.env.PORT) || 3000;
server.listen(port, () => {
  ensureCuratedPublicRooms();
  pruneEmptyRooms();
  const purgedSessionCount = purgeInactiveStoredSessions();
  if (purgedSessionCount > 0) {
    console.log(`Inaktive Sitzungen bereinigt: ${purgedSessionCount}`);
  }
  void purgeInactiveFestplays()
    .then((result) => {
      if (result.deletedCount > 0) {
        console.log(
          `Inaktive Festplays gelöscht: ${result.deletedCount}${result.emailedCount > 0 ? `, E-Mails: ${result.emailedCount}` : ""}`
        );
      }
    })
    .catch((error) => {
      console.error("Automatische Festplay-Bereinigung beim Start fehlgeschlagen:", error);
    });
  setInterval(() => {
    const deletedSessionCount = purgeInactiveStoredSessions();
    if (deletedSessionCount > 0) {
      emitHomeStatsUpdate();
    }
  }, SESSION_STORE_CLEANUP_INTERVAL_MS);
  setInterval(() => {
    void purgeInactiveFestplays()
      .then((result) => {
        if (result.deletedCount > 0) {
          console.log(
            `Inaktive Festplays gelöscht: ${result.deletedCount}${result.emailedCount > 0 ? `, E-Mails: ${result.emailedCount}` : ""}`
          );
        }
      })
      .catch((error) => {
        console.error("Automatische Festplay-Bereinigung fehlgeschlagen:", error);
      });
  }, FESTPLAY_INACTIVITY_CLEANUP_INTERVAL_MS);
  console.log(`Server läuft auf http://localhost:${port}`);
});


