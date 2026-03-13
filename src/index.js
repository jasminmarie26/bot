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
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const FacebookStrategy = require("passport-facebook").Strategy;
const Database = require("better-sqlite3");
const { Server } = require("socket.io");
const db = require("./db");

const THEME_OPTIONS = [
  { id: "glass-aurora", label: "Glass Aurora" },
  { id: "glass-noir", label: "Glass Noir" },
  { id: "glass-sunset", label: "Glass Sunset" },
  { id: "paper-ink", label: "Paper Ink" },
  { id: "windows-xp", label: "Windows XP" },
  { id: "atari", label: "Atari" },
  { id: "sith", label: "Sith" },
  { id: "jedi", label: "Jedi" }
];
const SERVER_OPTIONS = [
  { id: "free-rp", label: "FREE-RP" },
  { id: "erp", label: "ERP" }
];
const GUESTBOOK_PAGE_SIZE = 12;
const GUESTBOOK_CENSOR_OPTIONS = new Set(["none", "ab18", "sexual"]);
const GUESTBOOK_PAGE_STYLE_OPTIONS = new Set(["scroll", "book"]);
const GUESTBOOK_THEME_STYLE_OPTIONS = new Set(["blumen", "nacht", "minimal"]);
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
  "Alle Neuigkeiten laufen hier auf der Startseite im Live-Update-Bereich. Admins und Moderatoren können sie direkt hier veröffentlichen und bearbeiten.";
const DEFAULT_UPDATES_TITLE = "Live Updates";
const ROOM_EMPTY_DELETE_DELAY_MS = 8000;
const APP_BASE_URL = String(process.env.APP_BASE_URL || "")
  .trim()
  .replace(/\/+$/, "");
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

function getServerLabel(serverId) {
  const normalized = normalizeServer(serverId);
  const found = SERVER_OPTIONS.find((server) => server.id === normalized);
  return found?.label || "FREE-RP";
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

const sessionMiddleware = session({
  store: new SQLiteStore({
    db: "sessions.sqlite",
    dir: dataDir
  }),
  secret: process.env.SESSION_SECRET || "change-me-in-production",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 * 14,
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

function getLoggedInUsersCount(activeUserIds = null) {
  if (Array.isArray(activeUserIds)) {
    return activeUserIds.length;
  }
  return getActiveSessionUserIds().length;
}

function getOnlineStaffStats(activeUserIds = null) {
  const sessionUserIds = Array.isArray(activeUserIds)
    ? activeUserIds
    : getActiveSessionUserIds();
  if (!sessionUserIds.length) {
    return {
      adminOnlineCount: 0,
      adminOnlineNames: [],
      moderatorOnlineCount: 0,
      moderatorOnlineNames: []
    };
  }

  const placeholders = sessionUserIds.map(() => "?").join(", ");
  const staffUsers = db
    .prepare(
      `SELECT username, is_admin, is_moderator
       FROM users
       WHERE id IN (${placeholders})`
    )
    .all(...sessionUserIds);

  const adminOnlineNames = [];
  const moderatorOnlineNames = [];

  for (const user of staffUsers) {
    if (user.is_admin === 1) {
      adminOnlineNames.push(user.username);
      continue;
    }
    if (user.is_moderator === 1) {
      moderatorOnlineNames.push(user.username);
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

function getOnlineUserCountForServers(serverIds) {
  const requestedServerIds = Array.isArray(serverIds) ? serverIds : [serverIds];
  const normalizedServerIds = new Set(
    requestedServerIds
      .map((serverId) => String(serverId || "").trim().toLowerCase())
      .filter((serverId) => serverId.length > 0)
  );

  if (!normalizedServerIds.size) {
    return 0;
  }

  const sockets = io?.of("/")?.sockets;
  if (!sockets || typeof sockets.values !== "function") {
    return 0;
  }

  const userIds = new Set();
  for (const socket of sockets.values()) {
    const userId = Number(socket?.data?.user?.id);
    const rawPresenceServerId = String(socket?.data?.presenceServerId || "").trim().toLowerCase();
    if (
      !Number.isInteger(userId) ||
      userId < 1 ||
      !ALLOWED_SERVER_IDS.has(rawPresenceServerId) ||
      !normalizedServerIds.has(rawPresenceServerId)
    ) {
      continue;
    }
    userIds.add(userId);
  }

  return userIds.size;
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
  const staffStats = getOnlineStaffStats(activeUserIds);
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

function renderLoginPage(req, res, options = {}) {
  return renderAuthPage(req, res, {
    ...options,
    mode: "login"
  });
}

function renderForgotUsernamePage(req, res, options = {}) {
  return renderAuthPage(req, res, {
    ...options,
    mode: "forgot-username"
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
  const user = db
    .prepare("SELECT id, created_at FROM users WHERE id = ?")
    .get(userId);
  if (!user) return null;

  const rank = db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM users
       WHERE created_at < ?
          OR (created_at = ? AND id <= ?)`
    )
    .get(user.created_at, user.created_at, user.id);

  return Number(rank?.count) || null;
}

function toSessionUser(user) {
  return {
    id: user.id,
    username: user.username,
    is_admin: user.is_admin === 1,
    is_moderator: user.is_moderator === 1,
    theme: normalizeTheme(user.theme),
    account_number: getAccountNumberByUserId(user.id)
  };
}

function getUserForSessionById(userId) {
  return db
    .prepare(
      "SELECT id, username, is_admin, is_moderator, theme FROM users WHERE id = ?"
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
      `SELECT id, username, is_admin, is_moderator, theme
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
        `SELECT id, username, is_admin, is_moderator, theme, ${providerColumn} AS provider_value
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
       (username, password_hash, is_admin, is_moderator, theme, email, google_id, facebook_id)
       VALUES (?, ?, ?, 0, ?, ?, ?, ?)`
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
      `SELECT c.*, u.username AS owner_name, f.name AS festplay_name
       FROM characters c
       JOIN users u ON u.id = c.user_id
       LEFT JOIN festplays f ON f.id = c.festplay_id
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

function festplayExists(festplayId) {
  if (!Number.isInteger(festplayId) || festplayId < 1) return false;
  const row = db
    .prepare("SELECT id FROM festplays WHERE id = ?")
    .get(festplayId);
  return Boolean(row);
}

function normalizeRoomName(input) {
  return String(input || "").trim().replace(/\s+/g, " ").slice(0, 80);
}

function toRoomNameKey(roomName) {
  return normalizeRoomName(roomName).toLowerCase();
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

function normalizeRoomTeaser(rawValue) {
  return String(rawValue || "").trim().slice(0, 160);
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
  const value = String(rawUrl || "").trim();
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

function sanitizeBbcodeImageUrl(rawUrl) {
  const value = String(rawUrl || "").trim();
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

function renderGuestbookBbcode(rawContent) {
  let html = escapeHtml(String(rawContent || "").slice(0, 12000)).replace(/\r\n?/g, "\n");

  const inlineTags = [
    ["b", "strong"],
    ["i", "em"],
    ["u", "u"],
    ["s", "s"]
  ];

  html = html.replace(/\[hr\]/gi, "<hr class=\"bb-hr\">");

  html = html.replace(/\[h1\]([\s\S]*?)\[\/h1\]/gi, "<h1>$1</h1>");
  html = html.replace(/\[h2\]([\s\S]*?)\[\/h2\]/gi, "<h2>$1</h2>");
  html = html.replace(/\[h3\]([\s\S]*?)\[\/h3\]/gi, "<h3>$1</h3>");

  html = html.replace(/\[left\]([\s\S]*?)\[\/left\]/gi, "<div class=\"bb-left\">$1</div>");
  html = html.replace(/\[center\]([\s\S]*?)\[\/center\]/gi, "<div class=\"bb-center\">$1</div>");
  html = html.replace(/\[right\]([\s\S]*?)\[\/right\]/gi, "<div class=\"bb-right\">$1</div>");
  html = html.replace(/\[block\]([\s\S]*?)\[\/block\]/gi, "<div class=\"bb-block\">$1</div>");

  html = html.replace(/\[table\]([\s\S]*?)\[\/table\]/gi, "<table class=\"bb-table\">$1</table>");
  html = html.replace(/\[tr\]([\s\S]*?)\[\/tr\]/gi, "<tr>$1</tr>");
  html = html.replace(/\[td\]([\s\S]*?)\[\/td\]/gi, "<td>$1</td>");

  html = html.replace(/\[spoiler=([^\]\n]+)\]([\s\S]*?)\[\/spoiler\]/gi, (full, title, inner) => (
    `<details class="bb-spoiler"><summary>${title}</summary><div class="bb-spoiler-content">${inner}</div></details>`
  ));
  html = html.replace(
    /\[ab18\]([\s\S]*?)\[\/ab18\]/gi,
    "<details class=\"bb-spoiler bb-spoiler-ab18\"><summary>Ab 18 Inhalt</summary><div class=\"bb-spoiler-content\">$1</div></details>"
  );

  html = html.replace(/\[img([^\]]*)\]([\s\S]*?)\[\/img\]/gi, (full, rawAttributes, rawUrl) => {
    const safeUrl = sanitizeBbcodeImageUrl(rawUrl);
    if (!safeUrl) return "";

    const attributeText = String(rawAttributes || "");
    const floatMatch = attributeText.match(/\bfloat\s*=\s*["']?\s*(left|right)\s*["']?/i);
    const floatValue = floatMatch ? floatMatch[1].toLowerCase() : "";
    const floatClass = floatValue ? ` bb-image-${floatValue}` : "";
    return `<img class="bb-image${floatClass}" src="${escapeHtml(toGuestbookImageSrc(safeUrl))}" alt="Bild" />`;
  });

  inlineTags.forEach(([bbTag, htmlTag]) => {
    const re = new RegExp(`\\[${bbTag}\\]([\\s\\S]*?)\\[\\/${bbTag}\\]`, "gi");
    html = html.replace(re, `<${htmlTag}>$1</${htmlTag}>`);
  });

  html = html.replace(/\[quote\]([\s\S]*?)\[\/quote\]/gi, "<blockquote>$1</blockquote>");
  html = html.replace(/\[code\]([\s\S]*?)\[\/code\]/gi, "<code>$1</code>");

  html = html.replace(/\[url=([^\]\s]+)\]([\s\S]*?)\[\/url\]/gi, (full, rawUrl, label) => {
    const safeUrl = sanitizeBbcodeUrl(rawUrl);
    if (!safeUrl) return label;
    return `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });

  html = html.replace(/\[url\]([^\[]+)\[\/url\]/gi, (full, rawUrl) => {
    const safeUrl = sanitizeBbcodeUrl(rawUrl);
    if (!safeUrl) return escapeHtml(rawUrl);
    const safeLabel = escapeHtml(safeUrl);
    return `<a href="${safeLabel}" target="_blank" rel="noopener noreferrer">${safeLabel}</a>`;
  });

  html = html.replace(/\[color=([^\]\n]+)\]([\s\S]*?)\[\/color\]/gi, (full, rawColor, inner) => {
    const safeColor = sanitizeBbcodeColor(rawColor);
    if (!safeColor) return inner;
    return `<span style="color:${safeColor}">${inner}</span>`;
  });

  html = html.replace(/\[gradient=([^\]\n]+)\]([\s\S]*?)\[\/gradient\]/gi, (full, rawSpec, inner) => {
    const gradient = parseGradientSpec(rawSpec);
    if (!gradient) return inner;
    return `<span class="bb-gradient" style="background-image:linear-gradient(${gradient.angle}deg, ${gradient.colors.join(", ")})">${inner}</span>`;
  });

  html = html.replace(/\[([^\]\n]*,[^\]\n]+)\]([\s\S]*?)\[\/gradient\]/gi, (full, rawSpec, inner) => {
    const gradient = parseGradientSpec(rawSpec);
    if (!gradient) return inner;
    return `<span class="bb-gradient" style="background-image:linear-gradient(${gradient.angle}deg, ${gradient.colors.join(", ")})">${inner}</span>`;
  });

  return html.replace(/\n/g, "<br>");
}

function normalizeGuestbookColor(rawColor) {
  const prepared = String(rawColor || "").trim();
  if (/^#[0-9a-f]{6}$/i.test(prepared)) {
    return prepared.toUpperCase();
  }
  return "#AEE7B7";
}

function normalizeGuestbookOption(input, allowedValues, fallback) {
  const value = String(input || "").trim().toLowerCase();
  return allowedValues.has(value) ? value : fallback;
}

function getGuestbookEditorPayload(body) {
  const pageContent = (body.page_content || "").trim().slice(0, 12000);
  const imageUrl = (body.image_url || "").trim().slice(0, 500);
  const sanitizedImageUrl = /^https?:\/\/.+/i.test(imageUrl) ? imageUrl : "";
  const censorLevel = normalizeGuestbookOption(
    body.censor_level,
    GUESTBOOK_CENSOR_OPTIONS,
    "none"
  );
  const chatTextColor = normalizeGuestbookColor(body.chat_text_color);
  const pageStyle = normalizeGuestbookOption(
    body.page_style,
    GUESTBOOK_PAGE_STYLE_OPTIONS,
    "scroll"
  );
  const themeStyle = normalizeGuestbookOption(
    body.theme_style,
    GUESTBOOK_THEME_STYLE_OPTIONS,
    "blumen"
  );
  const fontStyle = normalizeGuestbookOption(
    body.font_style,
    GUESTBOOK_FONT_STYLE_OPTIONS,
    "default"
  );
  const tags = (body.tags || "").trim().slice(0, 500);

  return {
    pageContent,
    settings: {
      image_url: sanitizedImageUrl,
      censor_level: censorLevel,
      chat_text_color: chatTextColor,
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
      `SELECT character_id, image_url, censor_level, chat_text_color, page_style, theme_style, font_style, tags
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
        `SELECT character_id, image_url, censor_level, chat_text_color, page_style, theme_style, font_style, tags
         FROM guestbook_settings
         WHERE character_id = ?`
      )
      .get(characterId);
  }

  return settings;
}

function getRoomWithCharacter(roomId) {
  if (!Number.isInteger(roomId) || roomId < 1) return null;
  return db
    .prepare(
      `SELECT r.id, r.name, r.character_id, r.created_by_user_id, r.created_at, r.teaser, r.server_id,
              c.user_id AS character_owner_id, c.is_public AS character_is_public, c.name AS character_name, c.server_id AS character_server_id,
               u.username AS room_owner_name
       FROM chat_rooms r
       JOIN characters c ON c.id = r.character_id
       JOIN users u ON u.id = r.created_by_user_id
       WHERE r.id = ?`
    )
    .get(roomId);
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

function decorateSiteUpdate(siteUpdate) {
  if (!siteUpdate) {
    return null;
  }

  return {
    ...siteUpdate,
    content_html: renderGuestbookBbcode(siteUpdate.content || "")
  };
}

function getSiteUpdateById(updateId) {
  const siteUpdate = db
    .prepare(
      `SELECT id, author_name, content, created_at
       FROM site_updates
       WHERE id = ?`
    )
    .get(updateId);

  return decorateSiteUpdate(siteUpdate);
}

function getRecentSiteUpdates(limit = 10) {
  return db
    .prepare(
      `SELECT id, author_name, content, created_at
       FROM site_updates
       ORDER BY id DESC
       LIMIT ?`
    )
    .all(limit)
    .map((siteUpdate) => decorateSiteUpdate(siteUpdate));
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

app.use((req, res, next) => {
  const cookieTheme = getThemeCookie(req);

  if (req.session.guest_theme) {
    req.session.guest_theme = normalizeTheme(req.session.guest_theme);
  }

  if (req.session.user) {
    const user = getUserForSessionById(req.session.user.id);

    if (user) {
      req.session.user = toSessionUser(user);
    } else {
      req.session.user = null;
    }
  }

  res.locals.currentUser = req.session.user || null;
  res.locals.oauthEnabled = {
    google: GOOGLE_AUTH_ENABLED,
    facebook: FACEBOOK_AUTH_ENABLED
  };
  res.locals.oauthProviders = OAUTH_PROVIDERS;
  res.locals.availableThemes = THEME_OPTIONS;
  res.locals.serverOptions = SERVER_OPTIONS;
  res.locals.guestbookFontOptions = GUESTBOOK_FONT_OPTIONS;
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

app.get("/", (req, res) => {
  const homeContent = getHomeContent();
  return res.render("home", {
    title: homeContent.hero_title || DEFAULT_HOME_HERO_TITLE,
    stats: getLoginStats(),
    siteUpdates: getRecentSiteUpdates(12),
    homeContent
  });
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

  try {
    const info = db
      .prepare(
        `INSERT INTO users
         (username, password_hash, is_admin, theme, email, birth_date, email_verified, email_verification_token, last_login_ip, last_login_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, CURRENT_TIMESTAMP)`
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

    await sendVerificationEmail(req, {
      username,
      email,
      verificationToken
    });
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
  return renderLoginPage(req, res);
});

app.post("/login", (req, res) => {
  const username = (req.body.username || "").trim().slice(0, 24);
  const password = req.body.password || "";

  const user = db
    .prepare(
      `SELECT id, username, password_hash, is_admin, is_moderator, theme, email_verified
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
        touchUserLoginMetadata(req.session.user.id, req);
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
        touchUserLoginMetadata(req.session.user.id, req);
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

app.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
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

app.post("/updates", requireAuth, requireSiteUpdateEditor, (req, res) => {
  const content = normalizeSiteUpdateContent(req.body.content);
  if (!content) {
    setFlash(req, "error", "Update darf nicht leer sein.");
    return res.redirect(req.get("referer") || "/");
  }

  const info = db
    .prepare(
      `INSERT INTO site_updates (author_id, author_name, content)
       VALUES (?, ?, ?)`
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

  db.prepare("UPDATE site_updates SET content = ? WHERE id = ?").run(content, updateId);

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

app.get("/dashboard", requireAuth, (req, res) => {
  const ownCharacters = db
    .prepare(
      `SELECT c.id, c.name, c.server_id, c.is_public, c.updated_at, f.name AS festplay_name
       FROM characters c
       LEFT JOIN festplays f ON f.id = c.festplay_id
       WHERE c.user_id = ?
       ORDER BY c.updated_at DESC`
    )
    .all(req.session.user.id);

  const serverSections = SERVER_OPTIONS.map((server) => ({
    ...server,
    dashboard_label: server.id === "free-rp" ? "Free - RP" : server.label,
    dashboard_caption:
      server.id === "free-rp"
        ? "Für offene Geschichten, entspannte Begegnungen und neue Charakterideen."
        : "Für intensivere Szenen, klare Dynamik und laufende Verbindungen.",
    characters: ownCharacters.filter(
      (character) => normalizeServer(character.server_id) === server.id
    )
  }));

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

app.get("/characters/new", requireAuth, (req, res) => {
  const festplays = getFestplays();
  const requestedServer = normalizeServer(req.query.server);
  res.render("character-form", {
    title: "Neuer Charakter",
    mode: "create",
    error: null,
    festplays,
    serverOptions: SERVER_OPTIONS,
    character: {
      server_id: requestedServer,
      festplay_id: festplays[0]?.id || null,
      name: "",
      species: "",
      age: "",
      faceclaim: "",
      description: "",
      avatar_url: "",
      is_public: 1
    }
  });
});

app.post("/characters", requireAuth, (req, res) => {
  const payload = normalizeCharacterInput(req.body);
  const festplays = getFestplays();

  if (!payload.name) {
    return res.status(400).render("character-form", {
      title: "Neuer Charakter",
      mode: "create",
      error: "Name ist erforderlich.",
      festplays,
      serverOptions: SERVER_OPTIONS,
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
      character: payload
    });
  }

  if (!payload.festplay_id || !festplayExists(payload.festplay_id)) {
    return res.status(400).render("character-form", {
      title: "Neuer Charakter",
      mode: "create",
      error: "Bitte ein gültiges Festplay auswählen.",
      festplays,
      serverOptions: SERVER_OPTIONS,
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
      `SELECT r.id, r.name, r.teaser, r.server_id, r.created_at, r.created_by_user_id,
              u.username AS creator_name,
               CASE WHEN r.created_by_user_id = ? THEN 1 ELSE 0 END AS has_room_rights
       FROM chat_rooms r
        JOIN users u ON u.id = r.created_by_user_id
        WHERE r.server_id = ?
        ORDER BY r.created_at ASC, r.id ASC`
    )
    .all(req.session.user.id, normalizeServer(character.server_id));
  const standardRooms = getStandardRoomsForServer(character.server_id);
  const standardRoomUsers = Object.fromEntries(
    standardRooms.map((room) => [room.id, getOnlineCharactersForChannel(null, character.server_id)])
  );
  const roomUsers = Object.fromEntries(
    rooms.map((room) => [room.id, getOnlineCharactersForChannel(room.id, character.server_id)])
  );

  const guestbookPages = ensureGuestbookPages(id);
  const requestedPageId = Number(req.query.page_id);
  const activeGuestbookPage =
    guestbookPages.find((page) => page.id === requestedPageId) || guestbookPages[0];
  const guestbookSettings = getOrCreateGuestbookSettings(id);

  const guestbookEntries = db
    .prepare(
      `SELECT id, author_name, content, created_at
       FROM guestbook_entries
       WHERE character_id = ? AND guestbook_page_id = ?
       ORDER BY created_at DESC, id DESC
       LIMIT ?`
    )
    .all(id, activeGuestbookPage.id, GUESTBOOK_PAGE_SIZE)
    .map((entry) => ({
      ...entry,
      content_html: renderGuestbookBbcode(entry.content)
    }));

  return res.render("character-view", {
    title: character.name,
    character,
    isOwner,
    standardRooms,
    standardRoomUsers,
    roomUsers,
    rooms,
    guestbookEntries,
    guestbookPages,
    activeGuestbookPage: {
      ...activeGuestbookPage,
      content_html: renderGuestbookBbcode(activeGuestbookPage.content || "")
    },
    guestbookSettings
  });
});

app.get("/characters/:id/edit", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(404).render("404", { title: "Nicht gefunden" });
  }

  return res.redirect(`/characters/${id}/guestbook/edit`);
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

  const payload = normalizeCharacterInput(req.body);

  if (!payload.name) {
    return res.status(400).render("character-form", {
      title: `Bearbeiten: ${character.name}`,
      mode: "edit",
      error: "Name ist erforderlich.",
      festplays,
      serverOptions: SERVER_OPTIONS,
      character: { ...character, ...payload }
    });
  }

  if (!isAvatarUrlValid(payload.avatar_url)) {
    return res.status(400).render("character-form", {
      title: `Bearbeiten: ${character.name}`,
      mode: "edit",
      error: "Avatar-URL muss mit http:// oder https:// starten.",
      festplays,
      serverOptions: SERVER_OPTIONS,
      character: { ...character, ...payload }
    });
  }

  if (!payload.festplay_id || !festplayExists(payload.festplay_id)) {
    return res.status(400).render("character-form", {
      title: `Bearbeiten: ${character.name}`,
      mode: "edit",
      error: "Bitte ein gültiges Festplay auswählen.",
      festplays,
      serverOptions: SERVER_OPTIONS,
      character: { ...character, ...payload }
    });
  }

  if (findCharacterWithSameName(payload.name, id)) {
    return res.status(400).render("character-form", {
      title: `Bearbeiten: ${character.name}`,
      mode: "edit",
      error: "Dieser Charaktername ist bereits vergeben.",
      festplays,
      serverOptions: SERVER_OPTIONS,
      character: { ...character, ...payload }
    });
  }

  db.prepare(
    `UPDATE characters
     SET server_id = ?, festplay_id = ?, name = ?, species = ?, age = ?, faceclaim = ?, description = ?, avatar_url = ?, is_public = ?, updated_at = CURRENT_TIMESTAMP
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
    id
  );

  emitHomeStatsUpdate();
  setFlash(req, "success", "Charakter aktualisiert.");
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

  db.prepare("DELETE FROM characters WHERE id = ?").run(id);
  emitHomeStatsUpdate();
  setFlash(req, "success", "Charakter gelöscht.");
  return res.redirect("/dashboard");
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

  const roomName = normalizeRoomName(req.body.room_name);
  const roomTeaser = normalizeRoomTeaser(req.body.room_teaser);
  if (roomName.length < 2) {
    setFlash(req, "error", "Bitte einen gültigen Raumnamen eingeben.");
    return res.redirect(`/characters/${id}#roomlist`);
  }

  const roomNameKey = toRoomNameKey(roomName);
  const existingRoom = db
    .prepare(
      `SELECT id, name
       FROM chat_rooms
       WHERE server_id = ? AND created_by_user_id = ? AND name_key = ?`
    )
    .get(normalizeServer(character.server_id), req.session.user.id, roomNameKey);

  if (existingRoom) {
    return res.redirect(`/chat?room_id=${existingRoom.id}`);
  }

  const info = db.prepare(
    `INSERT INTO chat_rooms (character_id, created_by_user_id, name, name_key, teaser, server_id)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    character.id,
    req.session.user.id,
    roomName,
    roomNameKey,
    roomTeaser,
    normalizeServer(character.server_id)
  );

  return res.redirect(`/chat?room_id=${info.lastInsertRowid}`);
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

  const isOwner = req.session.user.id === character.user_id;
  const isAdmin = req.session.user.is_admin === true;
  if (!canAccessCharacter(req.session.user.id, character.user_id, character.is_public, isAdmin)) {
    return res.status(403).render("error", {
      title: "Kein Zugriff",
      message: "Dieser Charakter ist privat."
    });
  }

  const guestbookPages = ensureGuestbookPages(id);
  const requestedPageId = Number(req.query.page_id);
  const activeGuestbookPage =
    guestbookPages.find((page) => page.id === requestedPageId) || guestbookPages[0];
  const guestbookSettings = getOrCreateGuestbookSettings(id);

  const guestbookEntries = db
    .prepare(
      `SELECT id, author_name, content, created_at
       FROM guestbook_entries
       WHERE character_id = ? AND guestbook_page_id = ?
       ORDER BY created_at DESC, id DESC
       LIMIT ?`
    )
    .all(id, activeGuestbookPage.id, GUESTBOOK_PAGE_SIZE)
    .map((entry) => ({
      ...entry,
      content_html: renderGuestbookBbcode(entry.content)
    }));

  return res.render("guestbook-view", {
    title: `Gästebuch: ${character.name}`,
    character,
    isOwner,
    guestbookEntries,
    guestbookPages,
    activeGuestbookPage: {
      ...activeGuestbookPage,
      content_html: renderGuestbookBbcode(activeGuestbookPage.content || "")
    },
    guestbookSettings
  });
});

app.post("/characters/:id/guestbook", requireAuth, (req, res) => {
  const id = Number(req.params.id);
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

  const content = (req.body.content || "").trim().slice(0, 4000);
  if (!content) {
    setFlash(req, "error", "Gästebucheintrag darf nicht leer sein.");
    return res.redirect(`/characters/${id}/guestbook`);
  }

  const pages = ensureGuestbookPages(id);
  const requestedPageId = Number(req.body.page_id);
  const activePage =
    pages.find((page) => page.id === requestedPageId) || pages[0];

  db.prepare(
    `INSERT INTO guestbook_entries (character_id, author_id, author_name, content, guestbook_page_id)
     VALUES (?, ?, ?, ?, ?)`
  ).run(id, req.session.user.id, req.session.user.username, content, activePage.id);

  setFlash(req, "success", "Eintrag gespeichert.");
  return res.redirect(`/characters/${id}/guestbook?page_id=${activePage.id}`);
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

  return res.render("guestbook-preview", {
    title: `Vorschau: ${character.name}`,
    character,
    pageId: previewPage.id,
    pageNumber: previewPage.page_number,
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
  const payload = getGuestbookEditorPayload(req.body);

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
    payload.settings.page_style,
    payload.settings.theme_style,
    payload.settings.font_style,
    payload.settings.tags,
    id
  );

  if (req.session.guestbookPreview && Number(req.session.guestbookPreview.character_id) === id) {
    delete req.session.guestbookPreview;
  }

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
  const payload = getGuestbookEditorPayload(req.body);

  req.session.guestbookPreview = {
    character_id: id,
    page_id: activePage.id,
    page_number: activePage.page_number,
    settings: payload.settings,
    page_content: payload.pageContent,
    saved_at: Date.now()
  };

  return res.render("guestbook-preview", {
    title: `Vorschau: ${character.name}`,
    character,
    pageId: activePage.id,
    pageNumber: activePage.page_number,
    guestbookSettings: payload.settings,
    previewHtml: renderGuestbookBbcode(payload.pageContent || ""),
    previewBackUrl: `/characters/${id}/guestbook/edit?page_id=${activePage.id}`
  });
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
  const roomId = Number(req.query.room_id);
  let activeServerId = requestedServerId;
  let activeRoom = null;
  let activeCharacter = null;
  let standardRoom = null;

  if (Number.isInteger(roomId) && roomId > 0) {
    const room = getRoomWithCharacter(roomId);
    if (!room) {
      setFlash(req, "error", "Raum wurde nicht gefunden.");
      return res.redirect("/dashboard");
    }

    if (
      !canAccessCharacter(
        req.session.user.id,
        room.character_owner_id,
        room.character_is_public,
        req.session.user.is_admin
      )
    ) {
      return res.status(403).render("error", {
        title: "Kein Zugriff",
        message: "Dieser Raum ist nicht für dich sichtbar."
      });
    }

    activeRoom = {
      id: room.id,
      name: room.name,
      teaser: room.teaser,
      category: "Offplay",
      has_room_rights: room.created_by_user_id === req.session.user.id,
      owner_name: room.room_owner_name
    };
    activeServerId = normalizeServer(room.server_id || room.character_server_id);
  }

  if (!activeCharacter) {
    const preferredCharacter = db
      .prepare(
        `SELECT id, name, server_id
         FROM characters
         WHERE user_id = ? AND server_id = ?
         ORDER BY lower(name) ASC, id ASC
         LIMIT 1`
      )
      .get(req.session.user.id, activeServerId);

    if (preferredCharacter) {
      activeCharacter = {
        id: preferredCharacter.id,
        name: preferredCharacter.name,
        is_owner: true,
        server_id: normalizeServer(preferredCharacter.server_id)
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
  const loginIpExpr = userColumns.has("last_login_ip")
    ? "u.last_login_ip"
    : "'' AS last_login_ip";
  const loginAtExpr = userColumns.has("last_login_at")
    ? "u.last_login_at"
    : "'' AS last_login_at";

  return db
    .prepare(
      `SELECT u.id, u.username, ${emailExpr}, ${birthDateExpr}, ${loginIpExpr}, ${loginAtExpr},
              u.is_admin, u.is_moderator, u.created_at,
              (
                SELECT COUNT(*)
                FROM users ux
                WHERE ux.created_at < u.created_at
                   OR (ux.created_at = u.created_at AND ux.id <= u.id)
              ) AS account_number,
              COUNT(c.id) AS character_count
       FROM users u
       LEFT JOIN characters c ON c.user_id = u.id
       GROUP BY u.id
       ORDER BY lower(u.username) ASC, u.id ASC`
    )
    .all();
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

app.get("/admin", requireAuth, requireAdmin, (req, res) => {
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
    title: "Adminbereich",
    users,
    suspiciousUsers,
    accountCount,
    adminCount,
    moderatorCount
  });
});

app.get("/admin/users/:id", requireAuth, requireAdmin, (req, res) => {
  const targetId = Number(req.params.id);
  if (!Number.isInteger(targetId) || targetId < 1) {
    setFlash(req, "error", "User-ID ist ungültig.");
    return res.redirect("/admin");
  }

  const users = decorateAdminUsers(getAdminUsersOverview());
  const targetUser = users.find((user) => Number(user.id) === targetId);
  if (!targetUser) {
    setFlash(req, "error", "User wurde nicht gefunden.");
    return res.redirect("/admin");
  }

  const userCharacters = getAdminUserCharacters(targetId);

  return res.render("admin-user", {
    title: `Admin: ${targetUser.username}`,
    targetUser,
    userCharacters
  });
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
    `INSERT INTO festplays (name, created_by_user_id)
     VALUES (?, ?)`
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

  const clearCharacters = db.prepare(
    "UPDATE characters SET festplay_id = NULL WHERE festplay_id = ?"
  );
  const deleteFestplay = db.prepare("DELETE FROM festplays WHERE id = ?");
  const tx = db.transaction(() => {
    clearCharacters.run(festplayId);
    deleteFestplay.run(festplayId);
  });
  tx();

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
    .prepare("SELECT id, username, email, birth_date FROM users WHERE id = ?")
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

  db.prepare("UPDATE users SET username = ?, email = ?, birth_date = ? WHERE id = ?").run(
    username,
    email,
    birthDate,
    targetId
  );

  if (targetId === Number(req.session.user?.id)) {
    const refreshed = getUserForSessionById(targetId);
    if (refreshed) {
      req.session.user = toSessionUser(refreshed);
    }
  }

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
    next();
  });
});

function socketChannelForRoom(roomId, serverId = DEFAULT_SERVER_ID) {
  if (Number.isInteger(roomId) && roomId > 0) {
    return `room:${roomId}`;
  }
  return `lobby:${normalizeServer(serverId)}`;
}

function getPreferredCharacterForUser(userId, serverId = DEFAULT_SERVER_ID) {
  const parsedUserId = Number(userId);
  if (!Number.isInteger(parsedUserId) || parsedUserId < 1) return null;

  const normalizedServerId = normalizeServer(serverId);
  return (
    db
      .prepare(
        `SELECT id, name
         FROM characters
         WHERE user_id = ? AND server_id = ?
         ORDER BY lower(name) ASC, id ASC
         LIMIT 1`
      )
      .get(parsedUserId, normalizedServerId) ||
    db
      .prepare(
        `SELECT id, name
         FROM characters
         WHERE user_id = ?
         ORDER BY lower(name) ASC, id ASC
         LIMIT 1`
      )
      .get(parsedUserId)
  );
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

function getUserSocketsInChannel(roomId, serverId = DEFAULT_SERVER_ID, userId) {
  const parsedUserId = Number(userId);
  if (!Number.isInteger(parsedUserId) || parsedUserId < 1) {
    return [];
  }
  return getSocketsInChannel(roomId, serverId).filter(
    (memberSocket) => Number(memberSocket?.data?.user?.id) === parsedUserId
  );
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

function getOnlineCharactersForChannel(roomId, serverId = DEFAULT_SERVER_ID) {
  const sockets = getSocketsInChannel(roomId, serverId);
  if (!sockets.length) {
    return [];
  }

  const onlineCharacters = [];
  const seenUserIds = new Set();
  for (const memberSocket of sockets) {
    const user = memberSocket?.data?.user;
    const userId = Number(user?.id);

    if (!Number.isInteger(userId) || userId < 1 || seenUserIds.has(userId)) {
      continue;
    }

    seenUserIds.add(userId);
    const chosenCharacter = getPreferredCharacterForUser(userId, serverId);
    const displayName = String(chosenCharacter?.name || user.username || "").trim();

    onlineCharacters.push({
      user_id: userId,
      name: displayName || `User ${userId}`,
      character_id: chosenCharacter?.id || null
    });
  }

  return onlineCharacters.sort((a, b) =>
    a.name.localeCompare(b.name, "de", { sensitivity: "base" })
  );
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

const pendingRoomDeletionTimers = new Map();

function clearPendingRoomDeletion(roomId) {
  if (!Number.isInteger(roomId) || roomId < 1) return;
  const timer = pendingRoomDeletionTimers.get(roomId);
  if (!timer) return;
  clearTimeout(timer);
  pendingRoomDeletionTimers.delete(roomId);
}

function scheduleRoomDeletion(roomId) {
  if (!Number.isInteger(roomId) || roomId < 1) return;
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

  const roomExists = db
    .prepare("SELECT id FROM chat_rooms WHERE id = ?")
    .get(roomId);
  if (!roomExists) return false;

  const activeMembers = io.sockets.adapter.rooms.get(socketChannelForRoom(roomId));
  if (activeMembers && activeMembers.size > 0) {
    clearPendingRoomDeletion(roomId);
    return false;
  }

  clearPendingRoomDeletion(roomId);
  deleteRoomData(roomId);
  io.emit("chat:room-removed", { room_id: roomId });
  return true;
}

function pruneEmptyRooms() {
  const rooms = db.prepare("SELECT id FROM chat_rooms").all();
  rooms.forEach((room) => {
    maybeRemoveEmptyRoom(room.id);
  });
}

io.on("connection", (socket) => {
  socket.data.roomId = null;
  socket.data.serverId = null;
  socket.data.presenceServerId = null;
  socket.data.roomWatchChannels = new Set();

  socket.on("presence:set", (payload) => {
    if (!socket.data.user) return;

    const nextPresenceServerId = String(payload?.serverId || "").trim().toLowerCase();
    if (!ALLOWED_SERVER_IDS.has(nextPresenceServerId)) {
      return;
    }

    if (socket.data.presenceServerId === nextPresenceServerId) {
      return;
    }

    socket.data.presenceServerId = nextPresenceServerId;
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
  });

  socket.on("chat:join", (payload) => {
    if (!socket.data.user) return;

    const rawRoomId =
      payload && typeof payload === "object" ? payload.roomId : payload;
    const rawServerId =
      payload && typeof payload === "object" ? payload.serverId : DEFAULT_SERVER_ID;

    const parsedRoomId = Number(rawRoomId);
    const nextRoomId =
      Number.isInteger(parsedRoomId) && parsedRoomId > 0 ? parsedRoomId : null;
    let nextServerId = normalizeServer(rawServerId);

    if (nextRoomId) {
      const room = getRoomWithCharacter(nextRoomId);
      if (!room) return;
      if (
        !canAccessCharacter(
          socket.data.user.id,
          room.character_owner_id,
          room.character_is_public,
          socket.data.user.is_admin
        )
      ) {
        return;
      }
      nextServerId = normalizeServer(room.server_id || room.character_server_id);
    }

    const previousRoomId =
      Number.isInteger(socket.data.roomId) && socket.data.roomId > 0
        ? socket.data.roomId
        : null;
    const previousServerId = ALLOWED_SERVER_IDS.has(String(socket.data.serverId || "").trim().toLowerCase())
      ? normalizeServer(socket.data.serverId)
      : null;
    if (previousServerId) {
      socket.leave(socketChannelForRoom(previousRoomId, previousServerId));
    }

    socket.data.roomId = nextRoomId;
    socket.data.serverId = nextServerId;
    const previousPresenceServerId = socket.data.presenceServerId;
    socket.data.presenceServerId = nextServerId;
    socket.join(socketChannelForRoom(nextRoomId, nextServerId));
    clearPendingRoomDeletion(nextRoomId);

    const previousRoomWasRemoved = previousServerId
      ? maybeRemoveEmptyRoom(previousRoomId)
      : false;
    if (previousServerId && !previousRoomWasRemoved) {
      emitOnlineCharacters(previousRoomId, previousServerId);
    }
    emitOnlineCharacters(nextRoomId, nextServerId);
    if (previousPresenceServerId !== nextServerId) {
      emitHomeStatsUpdate();
    }
  });

  socket.on("chat:message", (rawMessage) => {
    if (!socket.data.user) return;
    if (typeof rawMessage !== "string") return;

    const roomId =
      Number.isInteger(socket.data.roomId) && socket.data.roomId > 0
        ? socket.data.roomId
        : null;
    let serverId = normalizeServer(socket.data.serverId);

    if (roomId) {
      const room = getRoomWithCharacter(roomId);
      if (!room) return;
      if (
        !canAccessCharacter(
          socket.data.user.id,
          room.character_owner_id,
          room.character_is_public,
          socket.data.user.is_admin
        )
      ) {
        return;
      }
      serverId = normalizeServer(room.server_id || room.character_server_id);
    }

    const content = rawMessage.trim().slice(0, 500);
    if (!content) return;

    io.to(socketChannelForRoom(roomId, serverId)).emit("chat:message", {
      username: socket.data.user.username,
      content,
      created_at: formatChatTimestamp()
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
    if (targetUserId === Number(socket.data.user.id)) {
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
      if (
        !canAccessCharacter(
          socket.data.user.id,
          room.character_owner_id,
          room.character_is_public,
          socket.data.user.is_admin
        )
      ) {
        return;
      }
      serverId = normalizeServer(room.server_id || room.character_server_id);
    }

    const recipientSockets = getUserSocketsInChannel(roomId, serverId, targetUserId);
    if (!recipientSockets.length) {
      return;
    }

    const senderSockets = getUserSocketsInChannel(roomId, serverId, socket.data.user.id);
    const senderCharacter = getPreferredCharacterForUser(socket.data.user.id, serverId);
    const recipientCharacter = getPreferredCharacterForUser(targetUserId, serverId);
    const senderName = String(senderCharacter?.name || socket.data.user.username || "").trim() ||
      `User ${socket.data.user.id}`;
    const recipientName = String(recipientCharacter?.name || "").trim() || `User ${targetUserId}`;
    const createdAt = formatChatTimestamp();

    const senderPayload = {
      outgoing: true,
      from_name: senderName,
      to_name: recipientName,
      content,
      created_at: createdAt
    };
    const recipientPayload = {
      outgoing: false,
      from_name: senderName,
      to_name: recipientName,
      content,
      created_at: createdAt
    };

    senderSockets.forEach((memberSocket) => {
      memberSocket.emit("chat:whisper", senderPayload);
    });
    recipientSockets.forEach((memberSocket) => {
      memberSocket.emit("chat:whisper", recipientPayload);
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
      emitOnlineCharacters(previousRoomId, previousServerId);
      scheduleRoomDeletion(previousRoomId);
    }
    if (socket.data.presenceServerId) {
      emitHomeStatsUpdate();
    }
  });
});

const port = Number(process.env.PORT) || 3000;
server.listen(port, () => {
  pruneEmptyRooms();
  console.log(`Server läuft auf http://localhost:${port}`);
});
