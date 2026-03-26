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
const GUESTBOOK_CENSOR_OPTIONS = new Set(["none", "ab18", "sexual"]);
const GUESTBOOK_PAGE_STYLE_OPTIONS = new Set(["scroll", "book"]);
const GUESTBOOK_THEME_STYLE_OPTIONS = new Set(["blumen", "nacht", "minimal", "neutral-weiss", "tiefschwarz"]);
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
let verificationMailer = null;
const USERNAME_PATTERN = /^[a-zA-Z0-9_.+\- ]{3,24}$/;
const USERNAME_CHANGE_COOLDOWN_DAYS = 182;
const USERNAME_CHANGE_COOLDOWN_MS = USERNAME_CHANGE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
const CHARACTER_RENAME_COOLDOWN_MONTHS = 3;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REGISTRATION_FORM_MIN_AGE_MS = 3500;
const REGISTRATION_FORM_MAX_AGE_MS = 1000 * 60 * 60 * 6;
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
const SESSION_MAX_AGE_MS = 1000 * 60 * 31;
const STAFF_SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30;

const sessionMiddleware = session({
  store: new SQLiteStore({
    db: "sessions.sqlite",
    dir: dataDir
  }),
  secret: process.env.SESSION_SECRET || "change-me-in-production",
  resave: false,
  rolling: false,
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
app.use(passport.initialize());

function setFlash(req, type, text) {
  req.session.flash = { type, text };
}

function getActiveSessionUserIds() {
  let sessionsDb;
  try {
    sessionsDb = new Database(sessionsDbPath, { fileMustExist: true, readonly: true });
  } catch (error) {
    return [];
  }

  try {
    const rows = sessionsDb
      .prepare("SELECT sess FROM sessions WHERE expired > ?")
      .all(Date.now());

    const uniqueUserIds = new Set();
    for (const row of rows) {
      try {
        const parsed = JSON.parse(row.sess);
        const userId = Number(parsed?.user?.id);
        if (Number.isInteger(userId) && userId > 0) {
          uniqueUserIds.add(userId);
        }
      } catch (error) {
        // Ignore malformed session rows.
      }
    }

    const candidateUserIds = Array.from(uniqueUserIds);
    if (!candidateUserIds.length) {
      return [];
    }

    const placeholders = candidateUserIds.map(() => "?").join(", ");
    const existingUsers = db
      .prepare(`SELECT id FROM users WHERE id IN (${placeholders})`)
      .all(...candidateUserIds);

    return existingUsers.map((row) => Number(row.id)).filter((id) => Number.isInteger(id) && id > 0);
  } catch (error) {
    return [];
  } finally {
    sessionsDb.close();
  }
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

function getLoginStats() {
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
    available_at_text: formatGermanDate(availableAt)
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

function getCharacterRenameAvailability(character) {
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
    resetToken: options.resetToken || ""
  };

  if (mode === "register") {
    const guard = issueRegistrationGuard(req);
    viewData.registrationGuardToken = guard.token;
  }

  return res.status(options.status || 200).render("auth", viewData);
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

  return res.status(options.status || 200).render("oauth-birth-date", {
    title: "Geburtsdatum ergänzen",
    provider,
    providerLabel,
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
  if (user?.is_admin || user?.is_moderator) {
    return STAFF_SESSION_MAX_AGE_MS;
  }

  return SESSION_MAX_AGE_MS;
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
      birth_date: options.values?.birth_date ?? accountUser.birth_date ?? ""
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

  if (honeypotValue) {
    return { ip, reason: "honeypot-filled" };
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

  const existingAccountRow = db.prepare("SELECT id FROM users WHERE account_number = ?");
  let nextAccountNumber = "";
  do {
    nextAccountNumber = String(10000000 + crypto.randomInt(90000000));
  } while (existingAccountRow.get(nextAccountNumber));

  db.prepare("UPDATE users SET account_number = ? WHERE id = ?").run(nextAccountNumber, parsedUserId);
  return nextAccountNumber;
}

function normalizeStaffDisplayName(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
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
        label: `${activeCharacterName} (M)`,
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
      label: `${String(moderatorCharacter.name).trim()} (M)`,
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
    account_number: getAccountNumberByUserId(user.id)
  };
}

function getUserForSessionById(userId) {
  return db
    .prepare(
      `SELECT id, username, is_admin, is_moderator, admin_display_name, moderator_display_name, theme
       , admin_character_id, moderator_character_id
       FROM users
       WHERE id = ?`
    )
    .get(userId);
}

function getAccountUserById(userId) {
  return db
    .prepare(
      `SELECT id, username, email, birth_date, is_admin, created_at, username_changed_at
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

function findOrCreateOAuthUser(provider, profile) {
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
    return toSessionUser(userByProvider);
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
      return toSessionUser(refreshed);
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

  const info = db
    .prepare(
      `INSERT INTO users
       (username, password_hash, is_admin, is_moderator, theme, email, google_id, facebook_id, username_changed_at)
       VALUES (?, ?, ?, 0, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
    )
    .run(
      username,
      passwordHash,
      isAdmin,
      DEFAULT_THEME,
      email,
      googleId,
      facebookId
    );

  getAccountNumberByUserId(info.lastInsertRowid);
  const created = getUserForSessionById(info.lastInsertRowid);
  return toSessionUser(created);
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
           AND (? = '' OR lower(trim(COALESCE(f.server_id, ''))) = ?)
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
             AND (? = '' OR lower(trim(COALESCE(f.server_id, ''))) = ?)
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
      `SELECT DISTINCT c.id, c.user_id, c.name, u.username AS owner_name
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
    .all(parsedFestplayId, normalizedServerId, parsedFestplayId);

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

function toRoomNameKey(roomName) {
  return normalizeRoomName(roomName).toLowerCase();
}

function findOwnedRoomByNameKey(userId, serverId, roomNameKey, roomDescription = "") {
  const parsedUserId = Number(userId);
  const normalizedServerId = normalizeServer(serverId);
  const normalizedRoomNameKey = String(roomNameKey || "").trim().toLowerCase();
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

function getSavedNonFestplayRoomsForUser(userId, serverId) {
  const parsedUserId = Number(userId);
  const normalizedServerId = normalizeServer(serverId);
  if (!Number.isInteger(parsedUserId) || parsedUserId < 1) {
    return [];
  }

  return db
    .prepare(
      `SELECT id, name, description, teaser, image_url, email_log_enabled, is_locked, is_public_room
       FROM chat_rooms
       WHERE server_id = ?
         AND created_by_user_id = ?
         AND COALESCE(festplay_id, 0) = 0
         AND COALESCE(is_saved_room, 0) = 1
         AND COALESCE(is_festplay_chat, 0) = 0
         AND COALESCE(is_manual_festplay_room, 0) = 0
         AND COALESCE(is_festplay_side_chat, 0) = 0
        ORDER BY created_at ASC, id ASC`
    )
    .all(normalizedServerId, parsedUserId)
    .map((room) => ({
      ...room,
      email_log_enabled: Number(room.email_log_enabled) === 1,
      is_locked: Number(room.is_locked) === 1,
      is_public_room: Number(room.is_public_room) === 1
    }));
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

    const info = db.prepare(
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
      message: String(quotedMatch[2] || "").trim().slice(0, 500)
    };
  }

  const singleQuotedMatch = value.match(/^'([^']+)'\s+([\s\S]+)$/);
  if (singleQuotedMatch) {
    return {
      targetName: normalizeInviteTargetName(singleQuotedMatch[1]),
      message: String(singleQuotedMatch[2] || "").trim().slice(0, 500)
    };
  }

  const plainMatch = value.match(/^(\S+)\s+([\s\S]+)$/);
  if (plainMatch) {
    return {
      targetName: normalizeInviteTargetName(plainMatch[1]),
      message: String(plainMatch[2] || "").trim().slice(0, 500)
    };
  }

  return {
    targetName: normalizeInviteTargetName(value),
    message: ""
  };
}

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

function getStandardRoomsForServer(serverId) {
  const normalizedServerId = normalizeServer(serverId);
  return Array.isArray(STANDARD_ROOM_DEFINITIONS[normalizedServerId])
    ? STANDARD_ROOM_DEFINITIONS[normalizedServerId]
    : [];
}

function getStandardRoomForServer(serverId, roomId) {
  const normalizedRoomId = String(roomId || "").trim().toLowerCase();
  if (!normalizedRoomId) return null;
  return (
    getStandardRoomsForServer(serverId).find((room) => room.id === normalizedRoomId) ||
    null
  );
}

function normalizeRoomDescription(rawValue) {
  return String(rawValue || "").trim().slice(0, 160);
}

function normalizeRoomTeaser(rawValue) {
  return String(rawValue || "").trim().slice(0, 160);
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
    .replace(/[［【]/g, "[")
    .replace(/[］】]/g, "]")
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

function getGuestbookEditorPayload(body, existingSettings = null) {
  const pageContent = normalizeBbcodeInput(body.page_content, 12000);
  const safeBody = body || {};
  const existingImageUrl = String(existingSettings?.image_url || "").trim().slice(0, 500);
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
  const existingFrameColor = normalizeOptionalGuestbookColor(existingSettings?.frame_color);
  const existingBackgroundColor = normalizeOptionalGuestbookColor(existingSettings?.background_color);
  const existingSurroundColor = normalizeOptionalGuestbookColor(existingSettings?.surround_color);
  const hasImageUrlField = Object.prototype.hasOwnProperty.call(safeBody, "image_url");
  const hasCensorLevelField = Object.prototype.hasOwnProperty.call(safeBody, "censor_level");
  const hasChatTextColorField = Object.prototype.hasOwnProperty.call(safeBody, "chat_text_color");
  const hasFrameColorField = Object.prototype.hasOwnProperty.call(safeBody, "frame_color");
  const hasBackgroundColorField = Object.prototype.hasOwnProperty.call(safeBody, "background_color");
  const hasSurroundColorField = Object.prototype.hasOwnProperty.call(safeBody, "surround_color");
  const hasPageStyleField = Object.prototype.hasOwnProperty.call(safeBody, "page_style");
  const imageUrl = hasImageUrlField
    ? String(safeBody.image_url || "").trim().slice(0, 500)
    : existingImageUrl;
  const sanitizedImageUrl = /^https?:\/\/.+/i.test(imageUrl) ? imageUrl : "";
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
  const pageStyle = hasPageStyleField
    ? normalizeGuestbookOption(safeBody.page_style, GUESTBOOK_PAGE_STYLE_OPTIONS, existingPageStyle)
    : existingPageStyle;
  const themeStyle = normalizeGuestbookOption(
    safeBody.theme_style,
    GUESTBOOK_THEME_STYLE_OPTIONS,
    "blumen"
  );
  const fontStyle = normalizeGuestbookOption(
    safeBody.font_style,
    GUESTBOOK_FONT_STYLE_OPTIONS,
    "default"
  );
  const tags = (safeBody.tags || "").trim().slice(0, 500);

  return {
    pageContent,
    settings: {
      image_url: sanitizedImageUrl,
      censor_level: censorLevel,
      chat_text_color: chatTextColor,
      frame_color: frameColor,
      background_color: backgroundColor,
      surround_color: surroundColor,
      page_style: pageStyle,
      theme_style: themeStyle,
      font_style: fontStyle,
      tags
    }
  };
}

function ensureGuestbookPages(characterId) {
  const existingPages = db
    .prepare(
      `SELECT id, character_id, page_number, title, content, created_at, updated_at
       FROM guestbook_pages
       WHERE character_id = ?
       ORDER BY page_number ASC, id ASC`
    )
    .all(characterId);

  if (existingPages.length) {
    return existingPages;
  }

  db.prepare(
    `INSERT INTO guestbook_pages (character_id, page_number, title, content)
     VALUES (?, 1, '1', '')`
  ).run(characterId);

  return db
    .prepare(
      `SELECT id, character_id, page_number, title, content, created_at, updated_at
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
      `SELECT character_id, image_url, censor_level, chat_text_color, frame_color, background_color, surround_color, page_style, theme_style, font_style, tags
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
        `SELECT character_id, image_url, censor_level, chat_text_color, frame_color, background_color, surround_color, page_style, theme_style, font_style, tags
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

function createFestplayApplicationNotification(userId, festplayId, festplayApplicationId) {
  const parsedUserId = Number(userId);
  const parsedFestplayId = Number(festplayId);
  const parsedApplicationId = Number(festplayApplicationId);
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
    `INSERT INTO festplay_application_notifications (user_id, festplay_id, festplay_application_id, is_read, created_at)
     VALUES (?, ?, ?, 0, CURRENT_TIMESTAMP)
     ON CONFLICT(user_id, festplay_application_id) DO UPDATE SET
       festplay_id = excluded.festplay_id,
       is_read = 0,
       created_at = CURRENT_TIMESTAMP`
  ).run(parsedUserId, parsedFestplayId, parsedApplicationId);

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

  return guestbookCount + getUnreadFestplayApplicationNotificationCountForUser(parsedUserId);
}

function getLatestFestplayApplicationNotificationForUser(userId, unreadOnly = true) {
  const parsedUserId = Number(userId);
  if (!Number.isInteger(parsedUserId) || parsedUserId < 1) {
    return null;
  }

  return db
    .prepare(
      `SELECT fan.id,
              'festplay_application' AS notification_type,
              fan.user_id,
              fan.festplay_id,
              fan.festplay_application_id,
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

  if (!guestbookNotification) {
    return festplayNotification;
  }

  if (!festplayNotification) {
    return guestbookNotification;
  }

  const guestbookCreatedAt = String(guestbookNotification.created_at || "");
  const festplayCreatedAt = String(festplayNotification.created_at || "");
  if (festplayCreatedAt > guestbookCreatedAt) {
    return festplayNotification;
  }
  if (guestbookCreatedAt > festplayCreatedAt) {
    return guestbookNotification;
  }

  return Number(festplayNotification.id) > Number(guestbookNotification.id)
    ? festplayNotification
    : guestbookNotification;
}

function socketChannelForGuestbookNotifications(userId) {
  const parsedUserId = Number(userId);
  return Number.isInteger(parsedUserId) && parsedUserId > 0
    ? `guestbook-notifications:${parsedUserId}`
    : "guestbook-notifications:unknown";
}

function buildGuestbookNotificationPayloadForUser(userId) {
  const parsedUserId = Number(userId);
  if (!Number.isInteger(parsedUserId) || parsedUserId < 1) {
    return {
      count: 0,
      latest: null
    };
  }

  const count = getUnreadGuestbookNotificationCountForUser(parsedUserId);
  const latestNotification = count > 0 ? getLatestGuestbookNotificationForUser(parsedUserId, true) : null;

  return {
    count,
    latest: latestNotification
      ? String(latestNotification.notification_type || "").trim() === "festplay_application"
        ? {
            id: Number(latestNotification.id),
            type: "festplay_application",
            festplay_id: Number(latestNotification.festplay_id),
            festplay_application_id: Number(latestNotification.festplay_application_id),
            festplay_name: String(latestNotification.festplay_name || "").trim(),
            applicant_character_name: String(latestNotification.applicant_character_name || "").trim(),
            festplay_server_id: normalizeServer(latestNotification.festplay_server_id)
          }
        : {
            id: Number(latestNotification.id),
            type: "guestbook_entry",
            character_id: Number(latestNotification.character_id),
            guestbook_entry_id: Number(latestNotification.guestbook_entry_id),
            guestbook_page_id: Number(latestNotification.guestbook_page_id),
            author_name: String(latestNotification.author_name || "").trim(),
            character_name: String(latestNotification.character_name || "").trim()
          }
      : null
  };
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
    display_timestamp: normalizeSiteUpdateDisplayTimestamp(revisionBase),
    revision_token: revisionToken,
    content_html: renderGuestbookBbcode(siteUpdate.content || "")
  };
}

function getSiteUpdateById(updateId) {
  const siteUpdate = db
    .prepare(
      `SELECT id, author_name, content, created_at, updated_at
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
      `SELECT id, author_name, content, created_at, updated_at
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
      `SELECT id, author_name, content, created_at, updated_at
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

function isOAuthBirthDateCompletionRequired(req) {
  if (!req.session?.user || !req.session?.oauth_birth_date_required) {
    return false;
  }

  const accountUser = getAccountUserById(req.session.user.id);
  if (!accountUser) {
    req.session.user = null;
    delete req.session.oauth_birth_date_required;
    delete req.session.oauth_birth_date_provider;
    delete req.session.oauth_birth_date_redirect;
    return false;
  }

  if (normalizeBirthDate(accountUser.birth_date)) {
    delete req.session.oauth_birth_date_required;
    delete req.session.oauth_birth_date_provider;
    delete req.session.oauth_birth_date_redirect;
    return false;
  }

  return true;
}

app.use((req, res, next) => {
  const cookieTheme = getThemeCookie(req);

  if (req.session.guest_theme) {
    req.session.guest_theme = normalizeTheme(req.session.guest_theme);
  }

  req.session.preferred_character_ids = normalizePreferredCharacterMap(
    req.session.preferred_character_ids
  );

  if (req.session.user) {
    const user = getUserForSessionById(req.session.user.id);

    if (user) {
      req.session.user = toSessionUser(user);
    } else {
      req.session.user = null;
    }
  }

  if (isOAuthBirthDateCompletionRequired(req)) {
    const normalizedPath = String(req.path || "").trim();
    const isAllowedPath =
      normalizedPath === "/auth/complete-profile" ||
      normalizedPath === "/logout" ||
      normalizedPath === "/logout-idle";

    if (!isAllowedPath) {
      return res.redirect("/auth/complete-profile");
    }
  }

  if (req.session.user && req.method === "GET" && req.accepts("html")) {
    res.setHeader("Cache-Control", "private, no-store, max-age=0, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }

  res.locals.currentUser = req.session.user || null;
  res.locals.currentUserAccountName = req.session.user?.username || "";
  res.locals.currentUserDisplayName = req.session.user?.display_name || req.session.user?.username || "";
  res.locals.currentUserDisplayRoleStyle = req.session.user?.display_role_style || "";
  res.locals.guestbookNotificationCount = req.session.user
    ? getUnreadGuestbookNotificationCountForUser(req.session.user.id)
    : 0;
  res.locals.latestGuestbookNotification = req.session.user
    ? getLatestGuestbookNotificationForUser(req.session.user.id, true)
    : null;
  res.locals.oauthEnabled = {
    google: GOOGLE_AUTH_ENABLED,
    facebook: FACEBOOK_AUTH_ENABLED
  };
  res.locals.oauthProviders = OAUTH_PROVIDERS;
  res.locals.availableThemes = THEME_OPTIONS;
  res.locals.serverOptions = SERVER_OPTIONS;
  res.locals.guestbookFontOptions = GUESTBOOK_FONT_OPTIONS;
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
  const submittedToken = String(req.body.form_token || "").trim();
  const honeypotValue = String(req.body.website || "").trim();
  const values = { username, email, birth_date: rawBirthDate };
  const blockReason = getRegistrationBlockReason(req, {
    username,
    email,
    honeypotValue,
    submittedToken
  });

  if (blockReason) {
    logRegistrationGuardEvent({
      ip: blockReason.ip,
      username,
      email,
      outcome: "blocked",
      reason: blockReason.reason
    });
    return renderRegisterPage(req, res, {
      status: 429,
      error: "Registrierung im Moment nicht möglich. Bitte versuche es in ein paar Minuten erneut.",
      values
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
      ip: getRequestIp(req),
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

  if (!EMAIL_VERIFICATION_MAIL_ENABLED) {
    return renderRegisterPage(req, res, {
      status: 503,
      error:
        "Registrierung ist derzeit nicht verfügbar, weil der E-Mail-Versand noch nicht konfiguriert ist.",
      values
    });
  }

  logRegistrationGuardEvent({
    ip: getRequestIp(req),
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
         (username, password_hash, is_admin, theme, email, birth_date, email_verified, email_verification_token, last_login_ip, last_login_at, username_changed_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      )
      .run(
        username,
        passwordHash,
        isAdmin,
        DEFAULT_THEME,
        email,
        birthDate,
        verificationToken,
        getRequestIp(req)
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
  const logoutReason = String(req.query.reason || "").trim().toLowerCase();
  const success =
    logoutReason === "idle"
      ? "Du wurdest wegen zu langer Inaktivität automatisch ausgeloggt."
      : null;

  return renderLoginPage(req, res, {
    success
  });
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
  setFlash(req, "success", "Erfolgreich eingeloggt.");
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

app.get("/auth/google", (req, res, next) => {
  if (!GOOGLE_AUTH_ENABLED) {
    setFlash(req, "error", getOAuthDisabledMessage(OAUTH_PROVIDERS.google));
    return res.redirect("/login");
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
        req.session.user = findOrCreateOAuthUser("google", profile);
        req.session.cookie.maxAge = getSessionMaxAgeForUser(req.session.user);
        touchUserLoginMetadata(req.session.user.id, req);
        const accountUser = getAccountUserById(req.session.user.id);
        if (!normalizeBirthDate(accountUser?.birth_date)) {
          req.session.oauth_birth_date_required = true;
          req.session.oauth_birth_date_provider = "google";
          req.session.oauth_birth_date_redirect = "/dashboard";
          return res.redirect("/auth/complete-profile");
        }
        delete req.session.oauth_birth_date_required;
        delete req.session.oauth_birth_date_provider;
        delete req.session.oauth_birth_date_redirect;
        setFlash(req, "success", "Mit Google eingeloggt.");
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
        req.session.user = findOrCreateOAuthUser("facebook", profile);
        req.session.cookie.maxAge = getSessionMaxAgeForUser(req.session.user);
        touchUserLoginMetadata(req.session.user.id, req);
        const accountUser = getAccountUserById(req.session.user.id);
        if (!normalizeBirthDate(accountUser?.birth_date)) {
          req.session.oauth_birth_date_required = true;
          req.session.oauth_birth_date_provider = "facebook";
          req.session.oauth_birth_date_redirect = "/dashboard";
          return res.redirect("/auth/complete-profile");
        }
        delete req.session.oauth_birth_date_required;
        delete req.session.oauth_birth_date_provider;
        delete req.session.oauth_birth_date_redirect;
        setFlash(req, "success", "Mit Facebook eingeloggt.");
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
        } else {
          setFlash(req, "error", "Facebook Login konnte nicht verarbeitet werden.");
        }
        return res.redirect("/login");
      }
    }
  )(req, res, next);
});

app.get("/auth/complete-profile", requireAuth, (req, res) => {
  if (!isOAuthBirthDateCompletionRequired(req)) {
    return res.redirect("/dashboard");
  }

  return renderOAuthBirthDatePage(req, res);
});

app.post("/auth/complete-profile", requireAuth, (req, res) => {
  if (!isOAuthBirthDateCompletionRequired(req)) {
    return res.redirect("/dashboard");
  }

  const rawBirthDate = String(req.body.birth_date || "").trim().slice(0, 10);
  const birthDate = normalizeBirthDate(rawBirthDate);

  if (!birthDate) {
    return renderOAuthBirthDatePage(req, res, {
      status: 400,
      error: "Bitte trage ein gültiges Geburtsdatum ein, bevor du weitermachen kannst.",
      values: {
        birth_date: rawBirthDate
      }
    });
  }

  db.prepare("UPDATE users SET birth_date = ? WHERE id = ?").run(birthDate, req.session.user.id);

  const refreshedUser = getUserForSessionById(req.session.user.id);
  if (refreshedUser) {
    req.session.user = toSessionUser(refreshedUser);
  }

  delete req.session.oauth_birth_date_required;
  delete req.session.oauth_birth_date_provider;
  const nextUrl = String(req.session.oauth_birth_date_redirect || "/dashboard").trim() || "/dashboard";
  delete req.session.oauth_birth_date_redirect;
  setFlash(req, "success", "Geburtsdatum gespeichert. Du kannst jetzt weitermachen.");
  return res.redirect(nextUrl);
});

app.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

app.post("/session/touch", requireAuth, (req, res) => {
  req.session.cookie.maxAge = getSessionMaxAgeForUser(req.session.user);
  req.session.last_activity_at = Date.now();
  return res.status(204).end();
});

app.get("/logout-idle", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login?reason=idle");
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
  const rawBirthDate = String(req.body.birth_date || "").trim().slice(0, 10);
  const birthDate = rawBirthDate ? normalizeBirthDate(rawBirthDate) : "";
  const usernameChanged = username !== accountUser.username;
  const usernameChangeInfo = getUsernameChangeAvailability(accountUser);

  const renderWithError = (errorMessage) =>
    renderAccountPage(req, res, {
      error: errorMessage,
      accountUser,
      values: {
        username,
        email,
        birth_date: rawBirthDate
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

  if (rawBirthDate && !birthDate) {
    return renderWithError("Bitte ein gültiges Geburtsdatum verwenden.");
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
         username_changed_at = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE username_changed_at END
     WHERE id = ?`
  ).run(username, email, birthDate, usernameChanged ? 1 : 0, currentUserId);

  const refreshedUser = getUserForSessionById(currentUserId);
  if (refreshedUser) {
    req.session.user = toSessionUser(refreshedUser);
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

app.get("/guestbook/notifications/open", requireAuth, (req, res) => {
  const latestNotification = getLatestGuestbookNotificationForUser(req.session.user.id, true);

  if (!latestNotification) {
    setFlash(req, "error", "Du hast gerade keine neuen Benachrichtigungen.");
    return res.redirect("/dashboard");
  }

  if (String(latestNotification.notification_type || "").trim() === "festplay_application") {
    markFestplayApplicationNotificationAsRead(latestNotification.id, req.session.user.id);

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
    .run(req.session.user.id, req.session.user.username, content);

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
      ? "Hier liegen deine Charaktere und Festspiele fuer Free RP."
      : "Hier liegen deine Charaktere und Festspiele fuer den Erotik-Bereich.",
    dashboard_card_caption: isFreeRp
      ? "Charaktere und Festspiele fuer offene Geschichten und lockere Begegnungen."
      : "Charaktere und Festspiele fuer intensivere Szenen und feste Dynamiken.",
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

function reorderOwnedFestplayRooms(userId, festplayId, orderedRoomIds = []) {
  const parsedUserId = Number(userId);
  const parsedFestplayId = Number(festplayId);
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
    !normalizedRoomIds.length
  ) {
    return false;
  }

  const availableRoomIds = db
    .prepare(
      `SELECT r.id
         FROM chat_rooms r
         JOIN festplays f ON f.id = r.festplay_id
        WHERE r.festplay_id = ?
          AND COALESCE(r.is_festplay_chat, 0) = 1
          AND COALESCE(r.is_manual_festplay_room, 0) = 1
          AND COALESCE(r.created_by_user_id, 0) = ?
          AND COALESCE(r.created_by_user_id, 0) = COALESCE(f.created_by_user_id, 0)
        ORDER BY COALESCE(r.sort_order, 0) ASC, r.created_at ASC, r.id ASC`
    )
    .all(parsedFestplayId, parsedUserId)
    .map((room) => Number(room.id))
    .filter((roomId) => Number.isInteger(roomId) && roomId > 0);

  if (!availableRoomIds.length || availableRoomIds.length !== normalizedRoomIds.length) {
    return false;
  }

  const availableSet = new Set(availableRoomIds);
  const normalizedSet = new Set(normalizedRoomIds);
  if (availableSet.size !== normalizedSet.size || normalizedSet.size !== normalizedRoomIds.length) {
    return false;
  }

  for (const roomId of normalizedRoomIds) {
    if (!availableSet.has(roomId)) {
      return false;
    }
  }

  const updateSortOrder = db.prepare(
    `UPDATE chat_rooms
        SET sort_order = ?
      WHERE id = ?
        AND festplay_id = ?
        AND COALESCE(is_festplay_chat, 0) = 1
        AND COALESCE(is_manual_festplay_room, 0) = 1
        AND created_by_user_id = ?`
  );

  db.transaction((roomIds) => {
    roomIds.forEach((roomId, index) => {
      updateSortOrder.run(index + 1, roomId, parsedFestplayId, parsedUserId);
    });
  })(normalizedRoomIds);

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

function getDashboardLarpSection() {
  return {
    title: "LARP Bereich",
    description:
      "Hier entsteht spaeter dein Bereich fuer LARP-Gruppen, Termine, Lagerideen und gemeinsame Abenteuer abseits der RP-Server.",
    note: "Noch nicht freigeschaltet."
  };
}

app.get("/dashboard", requireAuth, (req, res) => {
  const serverSections = getDashboardServerSections(req.session.user.id);
  const larpSection = getDashboardLarpSection();

  return res.render("dashboard", {
    title: "Dashboard",
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
    title: "Dashboard",
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
        role_label: "Moderator (M)",
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
  { slug: "charakter-anlegen", title: "Charakter anlegen" },
  { slug: "festspiele-anlegen", title: "Festspiele anlegen" },
  { slug: "eigene-raeume", title: "Eigene Räume" },
  { slug: "raumliste-raeume", title: "Raumliste & Räume" },
  { slug: "gaestebuch-design-bbcode", title: "Gästebuch Design & BBCode" },
  { slug: "auto-logoff", title: "Auto-Logoff" },
  { slug: "admin-moderatorname", title: "Admin- und Moderatorname" },
  { slug: "chat-fluestern", title: "Chat & Flüstern" },
  { slug: "chat-formatierung", title: "Chat-Formatierung" }
];

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
  {
    title: "Tag als Text",
    code: "\\[center\\]Das bleibt normaler Text\\[/center\\]"
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
    preview_html: renderGuestbookBbcode(entry.code)
  }));
}

app.get("/help", (req, res) => {
  return res.render("help", {
    title: "Hilfe",
    helpTopics: HELP_TOPICS,
    helpTopic: null,
    helpBbcodeExamples: decorateHelpBbcodeExamples()
  });
});

app.get("/help/:slug", (req, res) => {
  const helpTopic = HELP_TOPICS.find((topic) => topic.slug === String(req.params.slug || "").trim().toLowerCase());
  if (!helpTopic) {
    return res.status(404).render("404", { title: "Nicht gefunden" });
  }

  return res.render("help", {
    title: `Hilfe: ${helpTopic.title}`,
    helpTopics: HELP_TOPICS,
    helpTopic,
    helpBbcodeExamples: decorateHelpBbcodeExamples()
  });
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

  const rooms = db
    .prepare(
        `SELECT r.id, r.name, r.description, r.teaser, r.is_locked, r.is_public_room, r.is_saved_room, r.server_id, r.created_at, r.created_by_user_id,
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
    }));
  const publicRooms = rooms.filter(
    (room) => room.is_public_room
  );
  const ownedRooms = isOwner
    ? rooms.filter(
        (room) =>
          room.is_saved_room &&
          !room.is_public_room &&
          Number(room.created_by_user_id) === Number(req.session.user.id)
      )
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
    publicRooms,
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
      message: "Dieser Charakter ist nicht fuer dieses Festspiel freigeschaltet."
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
      title: `Festspiel-Raume: ${festplay.name}`,
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
      message: "Dieser Charakter ist nicht fuer dieses Festspiel freigeschaltet."
    });
  }

  if (festplay.server_id && normalizeServer(character.server_id) !== festplay.server_id) {
    setFlash(req, "error", buildFestplayServerLockMessage(festplay));
    return res.redirect(getSafeReturnTarget(req, fallbackReturnTarget));
  }

  const roomName = normalizeRoomName(req.body.room_name);
  const roomDescription = normalizeRoomDescription(req.body.room_description || req.body.room_teaser);
  if (roomName.length < 2) {
    setFlash(req, "error", "Bitte einen gueltigen Chatnamen eingeben.");
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
      message: "Nur der Besitzer darf mit diesem Charakter Festspiel-Raeume anlegen."
    });
  }

  if (!canManageFestplayRooms) {
    return res.status(403).render("error", {
      title: "Kein Zugriff",
      message: "Mit diesem Charakter duerfen fuer dieses Festspiel keine eigenen Raeume angelegt werden."
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
    setFlash(req, "error", "Bitte einen gueltigen Raumnamen eingeben.");
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
    const updated = reorderOwnedFestplayRooms(req.session.user.id, festplayId, orderedRoomIds);
    if (!updated) {
      if (isFetchRequest) {
        return res.status(400).json({ error: "Raumreihenfolge konnte nicht gespeichert werden." });
      }
      setFlash(req, "error", "Die Raumreihenfolge konnte nicht gespeichert werden.");
      return res.redirect(getSafeReturnTarget(req, fallbackReturnTarget));
    }
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
      message: "Mit diesem Charakter duerfen fuer dieses Festspiel keine eigenen Raeume bearbeitet werden."
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
      setFlash(req, "error", "Der Raum kann erst geloescht werden, wenn niemand mehr darin ist.");
      return res.redirect(getSafeReturnTarget(req, editorReturnTarget));
    }

    clearPendingRoomDeletion(roomId);
    await finalizeRoomLog(roomId, room.server_id, { reason: "manual" });
    deleteRoomData(roomId);
    io.emit("chat:room-removed", { room_id: roomId });
    setFlash(req, "success", "Festspiel-Raum geloescht.");
    return res.redirect(getSafeReturnTarget(req, editorBaseTarget));
  }

  if (roomName.length < 2) {
    setFlash(req, "error", "Bitte einen gueltigen Raumnamen eingeben.");
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
      message: "Nur der Besitzer darf eigene Festspiel-Raeume loeschen."
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
      message: "Mit diesem Charakter duerfen fuer dieses Festspiel keine eigenen Raeume geloescht werden."
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
    setFlash(req, "error", "Der Raum kann erst geloescht werden, wenn niemand mehr darin ist.");
    return res.redirect(getSafeReturnTarget(req, editorBaseTarget));
  }

  clearPendingRoomDeletion(roomId);
  await finalizeRoomLog(roomId, room.server_id, { reason: "manual" });
  deleteRoomData(roomId);
  io.emit("chat:room-removed", { room_id: roomId });
  setFlash(req, "success", "Festspiel-Raum geloescht.");
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
  const isPublic = true;
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
      `INSERT INTO festplays (name, created_by_user_id, creator_character_id, server_id)
       VALUES (?, ?, ?, ?)`
    ).run(festplayName, req.session.user.id, id, normalizeServer(character.server_id));
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
              c.server_id
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
  const isPublic = true;
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
    setFlash(req, "error", "Das Festspiel konnte nicht geloescht werden.");
    return res.redirect(`/characters/${id}/festplays`);
  }

  setFlash(
    req,
    "success",
    `Festspiel ${festplay.name} wurde geloescht. Zugeordnete Charaktere wurden wieder in den normalen Bereich gesetzt.`
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

  const renameAvailability = getCharacterRenameAvailability(character);

  return res.render("character-form", {
    title: `Bearbeiten: ${character.name}`,
    mode: "edit",
    error: null,
    festplays: getFestplays(),
    serverOptions: SERVER_OPTIONS,
    guestbookEditorUrl: `/characters/${id}/guestbook/edit`,
    renameAvailability,
    character
  });
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

  const renameAvailability = getCharacterRenameAvailability(character);
  const payload = normalizeCharacterInput(req.body);
  if (!Object.prototype.hasOwnProperty.call(req.body || {}, "avatar_url")) {
    payload.avatar_url = String(character.avatar_url || "").trim().slice(0, 500);
  }
  const characterFormValues = renameAvailability.can_change
    ? { ...character, ...payload }
    : { ...character, ...payload, name: character.name };

  if (!payload.name) {
    return res.status(400).render("character-form", {
      title: `Bearbeiten: ${character.name}`,
      mode: "edit",
      error: "Name ist erforderlich.",
      festplays,
      serverOptions: SERVER_OPTIONS,
      guestbookEditorUrl: `/characters/${id}/guestbook/edit`,
      renameAvailability,
      character: characterFormValues
    });
  }

  if (!isAvatarUrlValid(payload.avatar_url)) {
    return res.status(400).render("character-form", {
      title: `Bearbeiten: ${character.name}`,
      mode: "edit",
      error: "Avatar-URL muss mit http:// oder https:// starten.",
      festplays,
      serverOptions: SERVER_OPTIONS,
      guestbookEditorUrl: `/characters/${id}/guestbook/edit`,
      renameAvailability,
      character: characterFormValues
    });
  }

  if (!payload.festplay_id || !festplayExists(payload.festplay_id)) {
    return res.status(400).render("character-form", {
      title: `Bearbeiten: ${character.name}`,
      mode: "edit",
      error: "Bitte ein gültiges Festplay auswählen.",
      festplays,
      serverOptions: SERVER_OPTIONS,
      guestbookEditorUrl: `/characters/${id}/guestbook/edit`,
      renameAvailability,
      character: characterFormValues
    });
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
    return res.status(400).render("character-form", {
      title: `Bearbeiten: ${character.name}`,
      mode: "edit",
      error: buildFestplayServerLockMessage(selectedFestplayServer, payload.server_id),
      festplays,
      serverOptions: SERVER_OPTIONS,
      guestbookEditorUrl: `/characters/${id}/guestbook/edit`,
      renameAvailability,
      character: characterFormValues
    });
  }

  const nameChanged = payload.name !== character.name;
  if (nameChanged && !renameAvailability.can_change) {
    return res.status(400).render("character-form", {
      title: `Bearbeiten: ${character.name}`,
      mode: "edit",
      error: `Der Charaktername kann erst wieder ab ${renameAvailability.available_at_text} geändert werden.`,
      festplays,
      serverOptions: SERVER_OPTIONS,
      guestbookEditorUrl: `/characters/${id}/guestbook/edit`,
      renameAvailability,
      character: characterFormValues
    });
  }

  if (findCharacterWithSameName(payload.name, id)) {
    return res.status(400).render("character-form", {
      title: `Bearbeiten: ${character.name}`,
      mode: "edit",
      error: "Dieser Charaktername ist bereits vergeben.",
      festplays,
      serverOptions: SERVER_OPTIONS,
      guestbookEditorUrl: `/characters/${id}/guestbook/edit`,
      renameAvailability,
      character: characterFormValues
    });
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
  return res.redirect(`/characters/${id}`);
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

  db.prepare("UPDATE users SET admin_character_id = NULL WHERE admin_character_id = ?").run(id);
  db.prepare("UPDATE users SET moderator_character_id = NULL WHERE moderator_character_id = ?").run(id);
  db.prepare("UPDATE festplays SET creator_character_id = NULL WHERE creator_character_id = ?").run(id);
  deleteGuestbookNotificationsForCharacter(id);
  db.prepare("DELETE FROM characters WHERE id = ?").run(id);
  const refreshedUser = getUserForSessionById(req.session.user.id);
  if (refreshedUser) {
    req.session.user = toSessionUser(refreshedUser);
  }
  emitHomeStatsUpdate();
  setFlash(req, "success", "Charakter gelöscht.");
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
    setFlash(req, "error", "Bitte einen gueltigen Zielserver auswaehlen.");
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
    setFlash(req, "error", "ERP ist erst ab 18 Jahren verfuegbar.");
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
    successMessage = "Charakter wurde zurueck ins Festspiel gelegt.";
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

  const targetRoom = ensureOwnedRoomForCharacter(
    req.session.user.id,
    character,
    roomName,
    roomDescription
  );
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
      setFlash(req, "error", "Der Raum kann erst geloescht werden, wenn niemand mehr darin ist.");
      return res.redirect(`/characters/${id}/rooms/new?selected_room=${roomId}#room-selected-editor`);
    }

    clearPendingRoomDeletion(roomId);
    await finalizeRoomLog(roomId, room.server_id, { reason: "manual" });
    deleteRoomData(roomId);
    io.emit("chat:room-removed", { room_id: roomId });
    emitRoomListRefresh(room.server_id);
    setFlash(req, "success", "Raum geloescht.");
    return res.redirect(`/characters/${id}/rooms/new`);
  }

  if (roomName.length < 2) {
    setFlash(req, "error", "Bitte einen gültigen Raumnamen eingeben.");
    return res.redirect(`/characters/${id}/rooms/new?selected_room=${roomId}#room-selected-editor`);
  }

  const conflictingRoom = findOwnedRoomByNameKey(
    req.session.user.id,
    character.server_id,
    toRoomNameKey(roomName),
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
      toRoomNameKey(roomName),
      roomDescription,
      roomTeaser,
      roomImageUrl,
      emailLogEnabled,
    isLocked,
    roomId
  );

  const refreshedRoom = getRoomWithCharacter(roomId);
  if (emailLogEnabled === 1 && Number(room.email_log_enabled) !== 1) {
    maybeStartAutomaticRoomLog(roomId, room.server_id, refreshedRoom);
  } else if (emailLogEnabled !== 1 && Number(room.email_log_enabled) === 1 && getActiveRoomLog(roomId, room.server_id)) {
    emitSystemChatMessage(roomId, room.server_id, "Log wurde deaktiviert.");
    await finalizeRoomLog(roomId, room.server_id, { reason: "manual" });
  }

  emitRoomStateUpdate(roomId, room.server_id, refreshedRoom);
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
  const guestbookSettings = getOrCreateGuestbookSettings(id);
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

  const pages = ensureGuestbookPages(id);
  const requestedPageId = Number(req.query.page_id);
  const activePage = pages.find((page) => page.id === requestedPageId) || pages[0];
  const settings = getOrCreateGuestbookSettings(id);

  return res.render("guestbook-editor", {
    title: `Gästebuch bearbeiten: ${character.name}`,
    character,
    pages,
    activePage,
    settings
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

  const baseSettings = getOrCreateGuestbookSettings(id);
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
    previewBackUrl: `/characters/${id}/guestbook/edit?page_id=${previewPage.id}`
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
  const currentSettings = getOrCreateGuestbookSettings(id);
  const payload = getGuestbookEditorPayload(req.body, currentSettings);

  db.prepare(
    `UPDATE guestbook_pages
     SET content = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND character_id = ?`
  ).run(payload.pageContent, activePage.id, id);

  db.prepare(
    `UPDATE guestbook_settings
     SET image_url = ?,
         censor_level = ?,
         chat_text_color = ?,
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
    payload.settings.censor_level,
    payload.settings.chat_text_color,
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
  return res.redirect(`/characters/${id}/guestbook/edit?page_id=${activePage.id}`);
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
  const currentSettings = getOrCreateGuestbookSettings(id);
  const payload = getGuestbookEditorPayload(req.body, currentSettings);

  req.session.guestbookPreview = {
    character_id: id,
    page_id: activePage.id,
    page_number: activePage.page_number,
    settings: payload.settings,
    page_content: payload.pageContent,
    saved_at: Date.now()
  };

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
      `INSERT INTO guestbook_pages (character_id, page_number, title, content)
       VALUES (?, ?, ?, '')`
    )
    .run(id, nextPageNumber, String(nextPageNumber));

  if (req.session.guestbookPreview && Number(req.session.guestbookPreview.character_id) === id) {
    delete req.session.guestbookPreview;
  }

  setFlash(req, "success", `Seite ${nextPageNumber} erstellt.`);
  return res.redirect(`/characters/${id}/guestbook/edit?page_id=${info.lastInsertRowid}`);
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
    return res.redirect(`/characters/${id}/guestbook/edit?page_id=${pages[0].id}`);
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
  return res.redirect(`/characters/${id}/guestbook/edit?page_id=${redirectPage.id}`);
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

      if (
        Number(room.is_saved_room) === 1 &&
        Number(room.is_public_room) !== 1 &&
        Number(room.created_by_user_id) === Number(req.session.user.id)
      ) {
        setSavedRoomPublicState(room.id, true);
        room = getRoomWithCharacter(roomId);
        emitRoomListRefresh(room.server_id);
      }

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

  return db
    .prepare(
      `SELECT u.id, u.username, ${emailExpr}, ${birthDateExpr}, ${loginIpExpr}, ${loginAtExpr},
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

app.get("/staff", requireAuth, requireStaff, renderStaffOverview);

app.get("/admin/users/:id", requireAuth, requireAdmin, renderStaffUserDetails);
app.get("/staff/users/:id", requireAuth, requireStaff, renderStaffUserDetails);

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
    `INSERT INTO festplays (name, created_by_user_id, creator_character_id)
     VALUES (?, ?, NULL)`
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
      deleteGuestbookNotificationsForCharacter(id);
      db.prepare("DELETE FROM guestbook_entries WHERE character_id = ?").run(id);
      db.prepare("DELETE FROM guestbook_pages WHERE character_id = ?").run(id);
      db.prepare(
        `INSERT INTO guestbook_pages (character_id, page_number, title, content)
         VALUES (?, 1, '1', '')`
      ).run(id);
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
  return `lobby:${normalizeServer(serverId)}`;
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

function getSocketsInChannel(roomId, serverId = DEFAULT_SERVER_ID) {
  const members = io.sockets.adapter.rooms.get(socketChannelForRoom(roomId, serverId));
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

function getUserSocketsInChannel(roomId, serverId = DEFAULT_SERVER_ID, userId) {
  const parsedUserId = Number(userId);
  if (!Number.isInteger(parsedUserId) || parsedUserId < 1) {
    return [];
  }
  return getSocketsInChannel(roomId, serverId).filter(
    (memberSocket) => Number(memberSocket?.data?.user?.id) === parsedUserId
  );
}

function getUserSocketsOnServer(userId, serverId = DEFAULT_SERVER_ID) {
  const parsedUserId = Number(userId);
  const normalizedServerId = normalizeServer(serverId);
  if (!Number.isInteger(parsedUserId) || parsedUserId < 1) {
    return [];
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

function findInviteTargetsByDisplayName(displayName, serverId = DEFAULT_SERVER_ID, excludeUserId = null) {
  const normalizedLookupKey = normalizeInviteTargetLookupKey(displayName);
  const normalizedServerId = normalizeServer(serverId);
  const parsedExcludeUserId = Number(excludeUserId);
  if (!normalizedLookupKey) {
    return [];
  }

  const matches = [];
  const seenUserIds = new Set();

  for (const memberSocket of io.sockets.sockets.values()) {
    const userId = Number(memberSocket?.data?.user?.id);
    if (
      !Number.isInteger(userId) ||
      userId < 1 ||
      (Number.isInteger(parsedExcludeUserId) && userId === parsedExcludeUserId) ||
      seenUserIds.has(userId)
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
      roomId:
        Number.isInteger(Number(memberSocket?.data?.roomId)) && Number(memberSocket.data.roomId) > 0
          ? Number(memberSocket.data.roomId)
          : null,
      name: displayNameLabel,
      roleStyle: profile?.role_style || "",
      chatTextColor: profile?.chat_text_color || ""
    });
    seenUserIds.add(userId);
  }

  return matches;
}

function findWhisperTargetsByDisplayName(displayName, serverId = DEFAULT_SERVER_ID, excludeUserId = null) {
  const normalizedLookupKey = normalizeInviteTargetLookupKey(displayName);
  const normalizedServerId = normalizeServer(serverId);
  const parsedExcludeUserId = Number(excludeUserId);
  if (!normalizedLookupKey) {
    return [];
  }

  const matches = [];
  const seenUserIds = new Set();

  for (const memberSocket of io.sockets.sockets.values()) {
    const userId = Number(memberSocket?.data?.user?.id);
    if (
      !Number.isInteger(userId) ||
      userId < 1 ||
      (Number.isInteger(parsedExcludeUserId) && userId === parsedExcludeUserId) ||
      seenUserIds.has(userId)
    ) {
      continue;
    }

    const socketServerId = ALLOWED_SERVER_IDS.has(String(memberSocket?.data?.serverId || "").trim().toLowerCase())
      ? normalizeServer(memberSocket.data.serverId)
      : ALLOWED_SERVER_IDS.has(String(memberSocket?.data?.presenceServerId || "").trim().toLowerCase())
        ? normalizeServer(memberSocket.data.presenceServerId)
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
      name: displayNameLabel,
      roleStyle: profile?.role_style || "",
      chatTextColor: profile?.chat_text_color || ""
    });
    seenUserIds.add(userId);
  }

  return matches;
}

function emitWhisperBetweenUsers(senderSocket, targetUserId, content, serverId = DEFAULT_SERVER_ID) {
  const normalizedContent = String(content || "").trim().slice(0, 500);
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
  const recipientSockets = getUserSocketsOnServer(parsedTargetUserId, normalizedServerId);
  if (!recipientSockets.length) {
    return { ok: false, reason: "missing_target" };
  }

  const senderSockets = getUserSocketsOnServer(senderSocket.data.user.id, normalizedServerId);
  const senderProfile = getSocketDisplayProfile(senderSocket, normalizedServerId);
  const recipientProfile = recipientSockets[0]
    ? getSocketDisplayProfile(recipientSockets[0], normalizedServerId)
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

    const profile = getSocketHeaderDisplayProfile(memberSocket);
    memberSocket.emit("user:display-profile", {
      name: profile.label || sessionUser.display_name || sessionUser.username || "User",
      role_style: profile.role_style || "",
      chat_text_color: profile.chat_text_color || ""
    });

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

  return sessionUser;
}

function getCurrentChannelDisplayName(user, serverId = DEFAULT_SERVER_ID, preferredCharacterId = null) {
  return getCurrentChannelDisplayProfile(user, serverId, preferredCharacterId).label;
}

function socketChannelForRoomWatch(roomId, serverId = DEFAULT_SERVER_ID) {
  const normalizedServerId = normalizeServer(serverId);
  const roomKey = Number.isInteger(roomId) && roomId > 0 ? String(roomId) : "lobby";
  return `watch:${normalizedServerId}:${roomKey}`;
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
  const normalizedServerId = normalizeServer(serverId);
  const normalizedRoomId = Number.isInteger(roomId) && roomId > 0 ? String(roomId) : "lobby";
  return `${normalizedServerId}:${normalizedRoomId}`;
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
      `SELECT id, username, email
       FROM users
       WHERE id IN (${placeholders})`
    )
    .all(...parsedIds);
}

const activeRoomLogs = new Map();

function getActiveRoomLog(roomId, serverId = DEFAULT_SERVER_ID) {
  return activeRoomLogs.get(getRoomLogKey(roomId, serverId)) || null;
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

function rememberRoomLogParticipant(roomId, serverId, user, displayName = "") {
  const roomLog = getActiveRoomLog(roomId, serverId);
  if (!roomLog) return;

  const userId = Number(user?.id);
  if (!Number.isInteger(userId) || userId < 1) return;

  const safeDisplayName = String(displayName || user?.display_name || user?.username || `User ${userId}`).trim() ||
    `User ${userId}`;

  roomLog.participants.set(userId, safeDisplayName);
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
    roomLog.participants.set(userId, username || `User ${userId}`);
  }
}

function startRoomLog(roomId, serverId, room, startedBySocket) {
  const key = getRoomLogKey(roomId, serverId);
  if (activeRoomLogs.has(key)) {
    return null;
  }

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
    rememberRoomLogParticipant(
      roomId,
      serverId,
      memberSocket?.data?.user,
      getSocketDisplayProfile(memberSocket, serverId).label
    );
  });

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

  if (!getVerificationMailer() || getActiveRoomLog(normalizedRoomId, normalizedServerId)) {
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
  const roomLog = activeRoomLogs.get(key);
  if (!roomLog) {
    return {
      hadLog: false,
      deliveredCount: 0,
      missingEmailCount: 0,
      failedCount: 0,
      participantCount: 0
    };
  }

  activeRoomLogs.delete(key);

  const recipientRows = getRoomLogRecipients(Array.from(roomLog.participants.keys()));
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
  const participantNames = Array.from(new Set(Array.from(roomLog.participants.values()).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, "de", { sensitivity: "base" }));
  let deliveredCount = 0;
  let missingEmailCount = 0;
  let failedCount = 0;
  let fullAttachmentCount = 0;
  let pdfOnlyCount = 0;
  let plainOnlyCount = 0;
  let lastErrorSummary = "";

  for (const recipient of recipientRows) {
    const email = normalizeEmail(recipient?.email || "");
    if (!email) {
      missingEmailCount += 1;
      continue;
    }

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
      deliveredCount += 1;
      if (deliveryResult?.deliveryMode === "pdf-docx") {
        fullAttachmentCount += 1;
      } else if (deliveryResult?.deliveryMode === "pdf") {
        pdfOnlyCount += 1;
      } else {
        plainOnlyCount += 1;
      }
    } catch (error) {
      failedCount += 1;
      lastErrorSummary = summarizeMailError(error);
    console.error("Konnte Log nicht per E-Mail senden:", error);
    }
  }

  return {
    hadLog: true,
    deliveredCount,
    missingEmailCount,
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
    return false;
  }

  return finalizeRoomLog(roomId, serverId, { reason: "empty-room" });
}

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

  const chatTextColor = /^#[0-9a-f]{6}$/i.test(String(options?.chat_text_color || "").trim())
    ? normalizeGuestbookColor(options.chat_text_color)
    : "";

  return {
    type: "system",
    content: text,
    chat_text_color: chatTextColor,
    system_kind: String(options?.system_kind || "").trim(),
    presence_kind: String(options?.presence_kind || "").trim(),
    presence_actor_name: String(options?.presence_actor_name || "").trim(),
    presence_actor_chat_text_color: String(options?.presence_actor_chat_text_color || "").trim(),
    presence_suffix: String(options?.presence_suffix || "").trim(),
    room_switch_target_name: String(options?.room_switch_target_name || "").trim(),
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

  io.to(socketChannelForRoom(normalizedRoomId, normalizedServerId)).emit("chat:message", payload);
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
  const sockets = getSocketsInChannel(roomId, serverId);
  if (!sockets.length) {
    return [];
  }

  const room =
    Number.isInteger(roomId) && roomId > 0
      ? getRoomWithCharacter(Number(roomId))
      : null;
  const onlineCharacters = [];
  const seenUserIds = new Set();
  for (const memberSocket of sockets) {
    const user = memberSocket?.data?.user;
    const userId = Number(user?.id);

    if (!Number.isInteger(userId) || userId < 1 || seenUserIds.has(userId)) {
      continue;
    }

    seenUserIds.add(userId);
    const chosenCharacter = getPreferredCharacterForUser(
      userId,
      serverId,
      getSocketPreferredCharacterId(memberSocket, serverId)
    );
    const displayProfile = getSocketDisplayProfile(memberSocket, serverId);

    onlineCharacters.push({
      user_id: userId,
      name: displayProfile.label || `User ${userId}`,
      character_id: chosenCharacter?.id || null,
      role_style: displayProfile.role_style || "",
      chat_text_color: displayProfile.chat_text_color || "",
      has_room_rights: room ? canBypassRoomLock(user, room) : false
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
      user_id: Number(entry.user_id) || 0,
      name: String(entry.name || "").trim() || "Unbekannt",
      character_id: Number.isInteger(Number(entry.character_id)) && Number(entry.character_id) > 0
        ? Number(entry.character_id)
        : null,
      role_style: String(entry.role_style || "").trim(),
      chat_text_color: String(entry.chat_text_color || "").trim(),
      has_room_rights: entry.has_room_rights === true
    }))
    .filter((entry) => entry.user_id > 0 || entry.name);
}

function emitOnlineCharacters(roomId, serverId = DEFAULT_SERVER_ID) {
  const onlineCharacters = getOnlineCharactersForChannel(roomId, serverId);
  const normalizedServerId = normalizeServer(serverId);
  const normalizedRoomId = Number.isInteger(roomId) && roomId > 0 ? roomId : null;

  io.to(socketChannelForRoom(normalizedRoomId, normalizedServerId)).emit(
    "chat:online-characters",
    onlineCharacters
  );
  io.to(socketChannelForRoomWatch(normalizedRoomId, normalizedServerId)).emit(
    "room:watch:update",
    {
      roomId: normalizedRoomId,
      serverId: normalizedServerId,
      users: onlineCharacters
    }
  );
}

function emitChatTypingState(memberSocket, roomId, serverId = DEFAULT_SERVER_ID) {
  const userId = Number(memberSocket?.data?.user?.id);
  if (!Number.isInteger(userId) || userId < 1) {
    return;
  }

  const normalizedServerId = normalizeServer(serverId);
  const normalizedRoomId = Number.isInteger(roomId) && roomId > 0 ? roomId : null;
  const userSockets = getUserSocketsInChannel(normalizedRoomId, normalizedServerId, userId);
  const isTyping = userSockets.some((socketEntry) => Boolean(socketEntry?.data?.isTyping));
  const displayProfile = getSocketDisplayProfile(memberSocket, normalizedServerId);

  io.to(socketChannelForRoom(normalizedRoomId, normalizedServerId)).emit("chat:typing", {
    user_id: userId,
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

function shouldAutoDeleteRoom(roomId) {
  if (!Number.isInteger(roomId) || roomId < 1) return false;
  const room = db
    .prepare("SELECT is_public_room, is_saved_room FROM chat_rooms WHERE id = ?")
    .get(roomId);
  if (!room) return false;
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

io.on("connection", (socket) => {
  socket.data.roomId = null;
  socket.data.serverId = null;
  socket.data.presenceServerId = null;
  socket.data.roomWatchChannels = new Set();
  socket.data.isTyping = false;

  socket.emit("site:stats:update", getLoginStats());

  if (socket.data.user?.id) {
    socket.join(socketChannelForGuestbookNotifications(socket.data.user.id));
    socket.emit(
      "guestbook:notification:update",
      buildGuestbookNotificationPayloadForUser(socket.data.user.id)
    );
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
      const profile = getSocketHeaderDisplayProfile(socket);
      socket.emit("user:display-profile", {
        name: profile.label || socket.data.user?.display_name || socket.data.user?.username || "User",
        role_style: profile.role_style || "",
        chat_text_color: profile.chat_text_color || ""
      });
      return;
    }

    socket.data.presenceServerId = nextPresenceServerId;
    const profile = getSocketHeaderDisplayProfile(socket);
    socket.emit("user:display-profile", {
      name: profile.label || socket.data.user?.display_name || socket.data.user?.username || "User",
      role_style: profile.role_style || "",
      chat_text_color: profile.chat_text_color || ""
    });
    emitHomeStatsUpdate();
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

  socket.on("chat:join", (payload) => {
    if (!socket.data.user) return;

    const rawRoomId =
      payload && typeof payload === "object" ? payload.roomId : payload;
    const rawServerId =
      payload && typeof payload === "object" ? payload.serverId : DEFAULT_SERVER_ID;
    const rawCharacterId =
      payload && typeof payload === "object" ? payload.characterId : null;

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
      nextServerId = normalizeServer(nextRoom.server_id || nextRoom.character_server_id);
    }

    const previousRoomId =
      Number.isInteger(socket.data.roomId) && socket.data.roomId > 0
        ? socket.data.roomId
        : null;
    const previousServerId = ALLOWED_SERVER_IDS.has(String(socket.data.serverId || "").trim().toLowerCase())
      ? normalizeServer(socket.data.serverId)
      : null;
    const isSameChannel =
      previousServerId === nextServerId &&
      previousRoomId === nextRoomId;
    const previousDisplayProfile = previousServerId
      ? getSocketDisplayProfile(socket, previousServerId)
      : null;
    const previousDisplayName = previousDisplayProfile?.label || "";
    const preferredCharacterId =
      Number.isInteger(parsedCharacterId) && parsedCharacterId > 0
        ? parsedCharacterId
        : getSocketPreferredCharacterId(socket, nextServerId);
    const preferredCharacter = getPreferredCharacterForUser(
      socket.data.user.id,
      nextServerId,
      preferredCharacterId
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
      if (!isSameChannel) {
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
    const previousPresenceServerId = socket.data.presenceServerId;
    socket.data.presenceServerId = nextServerId;
    socket.join(socketChannelForRoom(nextRoomId, nextServerId));
    rememberRoomLogParticipant(nextRoomId, nextServerId, socket.data.user, nextDisplayName);
    if (!isSameChannel) {
      const nextPresenceMessage = buildRoomPresenceMessage("enter", nextDisplayName);
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
    }
    clearPendingRoomDeletion(nextRoomId);
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
    if (socket.data.isTyping === wantsTyping) {
      return;
    }

    socket.data.isTyping = wantsTyping;
    emitChatTypingState(socket, roomId, serverId);
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

    const content = rawMessage.trim().slice(0, 500);
    if (!content) return;
    const normalizedCommand = content.toLowerCase();
    const isFestplayChatRoom = Boolean(room) && Number(room.is_festplay_chat) === 1;
    const isManagedFestplayChatRoom =
      isFestplayChatRoom && Number(room.is_manual_festplay_room) === 1;
    const canUseRoomLog = canManageRoomLog(socket.data.user, room);
    const canManageRoomState = canBypassRoomLock(socket.data.user, room);
    const canGrantRoomRights = canGrantRoomPermissions(socket.data.user, room);

    if (isManagedFestplayChatRoom && /^\/(?:rrw?|i|werfen|s|log|logoff)\b/i.test(content)) {
      socket.emit("chat:message", {
        type: "system",
        content: "Festspiel-Raeume steuerst du ueber die eigene Festspiel-Raumseite, nicht direkt im Chat.",
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
        socket.data.user.id
      );
      if (!whisperTargets.length) {
        socket.emit("chat:message", {
          type: "system",
          content: `${whisperArgs.targetName} ist gerade nicht auf diesem Server online.`,
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
        serverId
      );
      if (!whisperResult.ok) {
        socket.emit("chat:message", {
          type: "system",
          content: whisperResult.reason === "self"
            ? "Du kannst dir nicht selbst flüstern."
            : `${whisperArgs.targetName} ist gerade nicht auf diesem Server online.`,
          created_at: formatChatTimestamp()
        });
      }
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

      if (!getVerificationMailer()) {
        socket.emit("chat:message", {
          type: "system",
          content: "Log kann nicht gestartet werden, weil der E-Mail-Versand nicht eingerichtet ist.",
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
      } else if (finalizeResult.deliveredCount > 0 && finalizeResult.failedCount === 0) {
        resultMessage = `Log wurde per E-Mail an ${finalizeResult.deliveredCount} Person(en) gesendet.`;
        if (finalizeResult.pdfOnlyCount > 0 || finalizeResult.plainOnlyCount > 0) {
          const fallbackParts = [];
          if (finalizeResult.pdfOnlyCount > 0) {
            fallbackParts.push(`${finalizeResult.pdfOnlyCount}x nur als PDF`);
          }
          if (finalizeResult.plainOnlyCount > 0) {
            fallbackParts.push(`${finalizeResult.plainOnlyCount}x ohne Anhang`);
          }
          resultMessage += ` Fallback aktiv: ${fallbackParts.join(", ")}.`;
        }
        if (finalizeResult.missingEmailCount > 0) {
          resultMessage += ` ${finalizeResult.missingEmailCount} Beteiligte hatten keine hinterlegte E-Mail-Adresse.`;
        }
      } else if (finalizeResult.deliveredCount > 0) {
        resultMessage =
          `Log wurde an ${finalizeResult.deliveredCount} Person(en) gesendet, ` +
          `${finalizeResult.failedCount} Versand(e) sind fehlgeschlagen.`;
        if (finalizeResult.pdfOnlyCount > 0 || finalizeResult.plainOnlyCount > 0) {
          const fallbackParts = [];
          if (finalizeResult.pdfOnlyCount > 0) {
            fallbackParts.push(`${finalizeResult.pdfOnlyCount}x nur als PDF`);
          }
          if (finalizeResult.plainOnlyCount > 0) {
            fallbackParts.push(`${finalizeResult.plainOnlyCount}x ohne Anhang`);
          }
          resultMessage += ` Fallback aktiv: ${fallbackParts.join(", ")}.`;
        }
        if (finalizeResult.missingEmailCount > 0) {
          resultMessage += ` ${finalizeResult.missingEmailCount} Beteiligte hatten keine hinterlegte E-Mail-Adresse.`;
        }
      } else if (finalizeResult.missingEmailCount > 0 && finalizeResult.failedCount === 0) {
        resultMessage =
          "Es wurde keine E-Mail verschickt, weil keine beteiligte Person eine hinterlegte E-Mail-Adresse hat.";
      } else if (finalizeResult.failedCount > 0) {
        resultMessage =
          "Der Log-Versand ist fehlgeschlagen. Bitte prüfe die Server-Logs und die Mail-Konfiguration.";
        if (finalizeResult.lastErrorSummary) {
          resultMessage += ` Ursache: ${finalizeResult.lastErrorSummary}`;
        }
      } else {
        resultMessage = "Es gab keine passenden Empfänger für den Log-Versand.";
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
    if (rollMatch) {
      if (!roomId || !room) {
        socket.emit("chat:message", {
          type: "system",
          content: "Du kannst nur in einem geoeffneten Raum wuerfeln.",
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
          content: "Der Wurf konnte gerade nicht ausgefuehrt werden.",
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
        `hat mit ${rollConfig.notation} gewuerfelt (${rollResult.resultLabel}).`,
        {
          system_kind: "dice-roll",
          presence_actor_name: rollDisplayName,
          presence_actor_chat_text_color: rollDisplayProfile?.chat_text_color || ""
        }
      );
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
          : ensureOwnedRoomForCharacter(
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
    appendMessageToActiveRoomLog(roomId, serverId, {
      type: "chat",
      user_id: socket.data.user.id,
      username: displayProfile.label,
      role_style: displayProfile.role_style || "",
      chat_text_color: displayProfile.chat_text_color || "",
      content,
      created_at: createdAt
    });

    io.to(socketChannelForRoom(roomId, serverId)).emit("chat:message", {
      username: displayProfile.label,
      role_style: displayProfile.role_style || "",
      chat_text_color: displayProfile.chat_text_color || "",
      content,
      created_at: createdAt
    });
  });

  socket.on("chat:whisper", (payload) => {
    if (!socket.data.user) return;
    if (!payload || typeof payload !== "object") return;

    const targetUserId = Number(payload.targetUserId);
    const content = String(payload.content || "").trim().slice(0, 500);
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

    emitWhisperBetweenUsers(socket, targetUserId, content, serverId);
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
    const previousRoomId =
      Number.isInteger(socket.data.roomId) && socket.data.roomId > 0
        ? socket.data.roomId
        : null;
    const previousServerId = ALLOWED_SERVER_IDS.has(String(socket.data.serverId || "").trim().toLowerCase())
      ? normalizeServer(socket.data.serverId)
      : null;
    if (previousServerId) {
      if (socket.data.isTyping) {
        socket.data.isTyping = false;
        emitChatTypingState(socket, previousRoomId, previousServerId);
      }
      if (!socket.data.skipDisconnectPresence) {
        const displayProfile = getSocketDisplayProfile(socket, previousServerId);
        const displayName = displayProfile.label || `User ${socket.data.user?.id || "?"}`;
        const disconnectPresenceMessage = buildRoomPresenceMessage("leave", displayName);
        emitSystemChatMessage(
          previousRoomId,
          previousServerId,
          disconnectPresenceMessage.text,
          {
            chat_text_color: "#000000",
            system_kind: "presence",
            presence_kind: disconnectPresenceMessage.kind,
            presence_actor_name: disconnectPresenceMessage.actorName,
            presence_actor_chat_text_color: displayProfile?.chat_text_color || "",
            presence_suffix: disconnectPresenceMessage.suffix
          }
        );
      }
      emitOnlineCharacters(previousRoomId, previousServerId);
      void finalizeRoomLogIfEmpty(previousRoomId, previousServerId);
      scheduleRoomDeletion(previousRoomId);
    }
    if (socket.data.user?.id) {
      emitHomeStatsUpdate();
    }
  });
});

const port = Number(process.env.PORT) || 3000;
server.listen(port, () => {
  pruneEmptyRooms();
  console.log(`Server läuft auf http://localhost:${port}`);
});
