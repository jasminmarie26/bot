const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const Database = require("better-sqlite3");

const dataDir = path.join(__dirname, "..", "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "app.db");
const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    is_admin INTEGER NOT NULL DEFAULT 0,
    is_moderator INTEGER NOT NULL DEFAULT 0,
    admin_display_name TEXT NOT NULL DEFAULT '',
    moderator_display_name TEXT NOT NULL DEFAULT '',
    admin_character_id INTEGER,
    moderator_character_id INTEGER,
    theme TEXT NOT NULL DEFAULT 'glass-aurora',
    email TEXT DEFAULT '',
    birth_date TEXT DEFAULT '',
    account_number TEXT NOT NULL DEFAULT '',
    email_verified INTEGER NOT NULL DEFAULT 1,
    email_verification_token TEXT DEFAULT '',
    password_reset_token TEXT DEFAULT '',
    password_reset_sent_at TEXT DEFAULT '',
    google_id TEXT DEFAULT '',
    facebook_id TEXT DEFAULT '',
    last_login_ip TEXT DEFAULT '',
    last_login_at TEXT DEFAULT '',
    registration_ip TEXT DEFAULT '',
    username_changed_at TEXT DEFAULT '',
    afk_timeout_minutes INTEGER NOT NULL DEFAULT 20,
    show_own_chat_time INTEGER NOT NULL DEFAULT 0,
    duplicate_accounts_allowed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS characters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    name_changed_at TEXT DEFAULT '',
    server_id TEXT NOT NULL DEFAULT 'free-rp',
    festplay_id INTEGER,
    festplay_dashboard_mode TEXT NOT NULL DEFAULT 'festplay',
    species TEXT DEFAULT '',
    age TEXT DEFAULT '',
    faceclaim TEXT DEFAULT '',
    description TEXT DEFAULT '',
    avatar_url TEXT DEFAULT '',
    is_public INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS festplays (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    is_public INTEGER NOT NULL DEFAULT 0,
    short_description TEXT NOT NULL DEFAULT '',
    long_description TEXT NOT NULL DEFAULT '',
    created_by_user_id INTEGER,
    creator_character_id INTEGER,
    server_id TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (creator_character_id) REFERENCES characters(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS festplay_permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    festplay_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    character_id INTEGER NOT NULL,
    granted_by_user_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (festplay_id) REFERENCES festplays(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
    FOREIGN KEY (granted_by_user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS festplay_applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    festplay_id INTEGER NOT NULL,
    applicant_user_id INTEGER NOT NULL,
    applicant_character_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    approved_by_user_id INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (festplay_id) REFERENCES festplays(id) ON DELETE CASCADE,
    FOREIGN KEY (applicant_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (applicant_character_id) REFERENCES characters(id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by_user_id) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS guestbook_pages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id INTEGER NOT NULL,
    page_number INTEGER NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    image_url TEXT NOT NULL DEFAULT '',
    inner_image_url TEXT NOT NULL DEFAULT '',
    outer_image_url TEXT NOT NULL DEFAULT '',
    inner_image_opacity INTEGER NOT NULL DEFAULT 100,
    outer_image_opacity INTEGER NOT NULL DEFAULT 100,
    inner_image_repeat INTEGER NOT NULL DEFAULT 0,
    outer_image_repeat INTEGER NOT NULL DEFAULT 0,
    frame_color TEXT NOT NULL DEFAULT '',
    background_color TEXT NOT NULL DEFAULT '',
    surround_color TEXT NOT NULL DEFAULT '',
    page_style TEXT NOT NULL DEFAULT 'scroll',
    theme_style TEXT NOT NULL DEFAULT 'pergament-gold',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS guestbook_settings (
    character_id INTEGER PRIMARY KEY,
    image_url TEXT NOT NULL DEFAULT '',
    inner_image_url TEXT NOT NULL DEFAULT '',
    outer_image_url TEXT NOT NULL DEFAULT '',
    inner_image_opacity INTEGER NOT NULL DEFAULT 100,
    outer_image_opacity INTEGER NOT NULL DEFAULT 100,
    inner_image_repeat INTEGER NOT NULL DEFAULT 0,
    outer_image_repeat INTEGER NOT NULL DEFAULT 0,
    censor_level TEXT NOT NULL DEFAULT 'none',
    chat_text_color TEXT NOT NULL DEFAULT '#AEE7B7',
    frame_color TEXT NOT NULL DEFAULT '',
    background_color TEXT NOT NULL DEFAULT '',
    surround_color TEXT NOT NULL DEFAULT '',
    page_style TEXT NOT NULL DEFAULT 'scroll',
    theme_style TEXT NOT NULL DEFAULT 'pergament-gold',
    font_style TEXT NOT NULL DEFAULT 'default',
    tags TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS guestbook_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id INTEGER NOT NULL,
    author_id INTEGER NOT NULL,
    author_character_id INTEGER,
    author_name TEXT NOT NULL,
    content TEXT NOT NULL,
    is_private INTEGER NOT NULL DEFAULT 0,
    guestbook_page_id INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (author_character_id) REFERENCES characters(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS guestbook_notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    character_id INTEGER NOT NULL,
    guestbook_entry_id INTEGER NOT NULL,
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
    FOREIGN KEY (guestbook_entry_id) REFERENCES guestbook_entries(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS festplay_application_notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    festplay_id INTEGER NOT NULL,
    festplay_application_id INTEGER NOT NULL,
    notification_kind TEXT NOT NULL DEFAULT 'application',
    actor_name TEXT NOT NULL DEFAULT '',
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (festplay_id) REFERENCES festplays(id) ON DELETE CASCADE,
    FOREIGN KEY (festplay_application_id) REFERENCES festplay_applications(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS rp_board_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id TEXT NOT NULL DEFAULT 'free-rp',
    festplay_id INTEGER NOT NULL DEFAULT 0,
    user_id INTEGER NOT NULL,
    character_id INTEGER NOT NULL,
    author_name TEXT NOT NULL DEFAULT '',
    author_chat_text_color TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS rp_board_reads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    server_id TEXT NOT NULL DEFAULT 'free-rp',
    festplay_id INTEGER NOT NULL DEFAULT 0,
    last_seen_entry_id INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS chat_rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id INTEGER NOT NULL,
      created_by_user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      name_key TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      teaser TEXT NOT NULL DEFAULT '',
      image_url TEXT NOT NULL DEFAULT '',
      email_log_enabled INTEGER NOT NULL DEFAULT 0,
      is_locked INTEGER NOT NULL DEFAULT 0,
      is_public_room INTEGER NOT NULL DEFAULT 0,
      is_saved_room INTEGER NOT NULL DEFAULT 0,
      is_festplay_chat INTEGER NOT NULL DEFAULT 0,
      is_manual_festplay_room INTEGER NOT NULL DEFAULT 0,
      is_festplay_side_chat INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      festplay_id INTEGER,
      server_id TEXT NOT NULL DEFAULT 'free-rp',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    username TEXT NOT NULL,
    content TEXT NOT NULL,
    server_id TEXT NOT NULL DEFAULT 'free-rp',
    room_id INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS chat_room_permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    granted_by_user_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (granted_by_user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS character_private_notes (
    character_id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS chat_reconnect_suppressions (
    presence_key TEXT NOT NULL,
    room_key TEXT NOT NULL DEFAULT 'lobby',
    server_id TEXT NOT NULL DEFAULT 'free-rp',
    expires_at INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (presence_key, room_key, server_id)
  );

  CREATE TABLE IF NOT EXISTS site_updates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    author_id INTEGER NOT NULL,
    author_name TEXT NOT NULL,
    content TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS site_home_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    hero_title TEXT NOT NULL DEFAULT 'Heldenhaft Reisen',
    hero_body TEXT NOT NULL DEFAULT 'Aktuelle Neuigkeiten findest du oben über den Live-Updates-Tab im Header. Dort können Admins und Moderatoren neue Meldungen direkt veröffentlichen und bearbeiten.',
    updates_title TEXT NOT NULL DEFAULT 'Live Updates',
    account_number_migration_version INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS registration_guard_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip TEXT NOT NULL,
    username TEXT DEFAULT '',
    email TEXT DEFAULT '',
    outcome TEXT NOT NULL,
    reason TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS character_backups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    original_character_id INTEGER NOT NULL,
    character_name TEXT NOT NULL DEFAULT '',
    server_id TEXT NOT NULL DEFAULT 'free-rp',
    deleted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    restored_at TEXT NOT NULL DEFAULT '',
    snapshot_json TEXT NOT NULL DEFAULT '',
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_characters_user_id ON characters(user_id);
  CREATE INDEX IF NOT EXISTS idx_character_backups_user_id
    ON character_backups(user_id, restored_at, deleted_at);
  CREATE INDEX IF NOT EXISTS idx_guestbook_character_id ON guestbook_entries(character_id);
  CREATE INDEX IF NOT EXISTS idx_chat_rooms_character_id ON chat_rooms(character_id);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_room_permissions_room_user
    ON chat_room_permissions(room_id, user_id);
  CREATE INDEX IF NOT EXISTS idx_chat_room_permissions_user_id
    ON chat_room_permissions(user_id);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_festplay_permissions_festplay_user
    ON festplay_permissions(festplay_id, user_id);
  CREATE INDEX IF NOT EXISTS idx_festplay_permissions_character_id
    ON festplay_permissions(character_id);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_festplay_applications_festplay_character
    ON festplay_applications(festplay_id, applicant_character_id);
  CREATE INDEX IF NOT EXISTS idx_festplay_applications_user_id
    ON festplay_applications(applicant_user_id);
  CREATE INDEX IF NOT EXISTS idx_chat_created_at ON chat_messages(created_at);
  CREATE INDEX IF NOT EXISTS idx_site_updates_created_at ON site_updates(created_at);
  CREATE INDEX IF NOT EXISTS idx_registration_guard_ip_created_at
    ON registration_guard_events(ip, created_at);
`);

const userColumns = db
  .prepare("PRAGMA table_info(users)")
  .all()
  .map((column) => column.name);

const characterColumns = db
  .prepare("PRAGMA table_info(characters)")
  .all()
  .map((column) => column.name);

const guestbookEntryColumns = db
  .prepare("PRAGMA table_info(guestbook_entries)")
  .all()
  .map((column) => column.name);

const guestbookPageColumns = db
  .prepare("PRAGMA table_info(guestbook_pages)")
  .all()
  .map((column) => column.name);

const guestbookSettingsColumns = db
  .prepare("PRAGMA table_info(guestbook_settings)")
  .all()
  .map((column) => column.name);

const guestbookPageDesignColumnsWereMissing =
  !guestbookPageColumns.includes("image_url") ||
  !guestbookPageColumns.includes("inner_image_url") ||
  !guestbookPageColumns.includes("outer_image_url") ||
  !guestbookPageColumns.includes("inner_image_opacity") ||
  !guestbookPageColumns.includes("outer_image_opacity") ||
  !guestbookPageColumns.includes("inner_image_repeat") ||
  !guestbookPageColumns.includes("outer_image_repeat") ||
  !guestbookPageColumns.includes("frame_color") ||
  !guestbookPageColumns.includes("background_color") ||
  !guestbookPageColumns.includes("surround_color") ||
  !guestbookPageColumns.includes("page_style") ||
  !guestbookPageColumns.includes("theme_style");

const chatRoomColumns = db
  .prepare("PRAGMA table_info(chat_rooms)")
  .all()
  .map((column) => column.name);

const chatMessageColumns = db
  .prepare("PRAGMA table_info(chat_messages)")
  .all()
  .map((column) => column.name);

const siteHomeSettingsColumns = db
  .prepare("PRAGMA table_info(site_home_settings)")
  .all()
  .map((column) => column.name);

const siteUpdateColumns = db
  .prepare("PRAGMA table_info(site_updates)")
  .all()
  .map((column) => column.name);

const festplayColumns = db
  .prepare("PRAGMA table_info(festplays)")
  .all()
  .map((column) => column.name);

const festplayPermissionColumns = db
  .prepare("PRAGMA table_info(festplay_permissions)")
  .all()
  .map((column) => column.name);

const festplayApplicationNotificationColumns = db
  .prepare("PRAGMA table_info(festplay_application_notifications)")
  .all()
  .map((column) => column.name);

if (!userColumns.includes("is_admin")) {
  db.exec("ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0");
}

if (!festplayColumns.includes("is_public")) {
  db.exec("ALTER TABLE festplays ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0");
}

if (!festplayColumns.includes("short_description")) {
  db.exec("ALTER TABLE festplays ADD COLUMN short_description TEXT NOT NULL DEFAULT ''");
}

if (!festplayColumns.includes("long_description")) {
  db.exec("ALTER TABLE festplays ADD COLUMN long_description TEXT NOT NULL DEFAULT ''");
}

if (!festplayColumns.includes("creator_character_id")) {
  db.exec("ALTER TABLE festplays ADD COLUMN creator_character_id INTEGER");
}

if (!festplayColumns.includes("server_id")) {
  db.exec("ALTER TABLE festplays ADD COLUMN server_id TEXT NOT NULL DEFAULT ''");
}

db.exec(`
  UPDATE festplays
     SET server_id = (
       SELECT c.server_id
         FROM characters c
        WHERE c.id = festplays.creator_character_id
     )
   WHERE trim(COALESCE(server_id, '')) = ''
     AND creator_character_id IS NOT NULL
`);

db.exec(`
  UPDATE festplays
     SET server_id = (
       SELECT c.server_id
         FROM festplay_permissions fp
         JOIN characters c ON c.id = fp.character_id
        WHERE fp.festplay_id = festplays.id
        ORDER BY fp.id ASC
        LIMIT 1
     )
   WHERE trim(COALESCE(server_id, '')) = ''
     AND COALESCE(created_by_user_id, 0) > 0
`);

if (!userColumns.includes("is_moderator")) {
  db.exec("ALTER TABLE users ADD COLUMN is_moderator INTEGER NOT NULL DEFAULT 0");
}

if (!userColumns.includes("theme")) {
  db.exec("ALTER TABLE users ADD COLUMN theme TEXT NOT NULL DEFAULT 'glass-aurora'");
}

if (!userColumns.includes("admin_display_name")) {
  db.exec("ALTER TABLE users ADD COLUMN admin_display_name TEXT NOT NULL DEFAULT ''");
}

if (!userColumns.includes("moderator_display_name")) {
  db.exec("ALTER TABLE users ADD COLUMN moderator_display_name TEXT NOT NULL DEFAULT ''");
}

if (!userColumns.includes("admin_character_id")) {
  db.exec("ALTER TABLE users ADD COLUMN admin_character_id INTEGER");
}

if (!userColumns.includes("moderator_character_id")) {
  db.exec("ALTER TABLE users ADD COLUMN moderator_character_id INTEGER");
}

if (!userColumns.includes("email")) {
  db.exec("ALTER TABLE users ADD COLUMN email TEXT DEFAULT ''");
}

if (!userColumns.includes("birth_date")) {
  db.exec("ALTER TABLE users ADD COLUMN birth_date TEXT DEFAULT ''");
}

if (!userColumns.includes("account_number")) {
  db.exec("ALTER TABLE users ADD COLUMN account_number TEXT NOT NULL DEFAULT ''");
}

if (!userColumns.includes("email_verified")) {
  db.exec("ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 1");
}

if (!userColumns.includes("email_verification_token")) {
  db.exec("ALTER TABLE users ADD COLUMN email_verification_token TEXT DEFAULT ''");
}

if (!userColumns.includes("password_reset_token")) {
  db.exec("ALTER TABLE users ADD COLUMN password_reset_token TEXT DEFAULT ''");
}

if (!userColumns.includes("password_reset_sent_at")) {
  db.exec("ALTER TABLE users ADD COLUMN password_reset_sent_at TEXT DEFAULT ''");
}

if (!userColumns.includes("google_id")) {
  db.exec("ALTER TABLE users ADD COLUMN google_id TEXT DEFAULT ''");
}

if (!userColumns.includes("facebook_id")) {
  db.exec("ALTER TABLE users ADD COLUMN facebook_id TEXT DEFAULT ''");
}

if (!userColumns.includes("last_login_ip")) {
  db.exec("ALTER TABLE users ADD COLUMN last_login_ip TEXT DEFAULT ''");
}

if (!userColumns.includes("last_login_at")) {
  db.exec("ALTER TABLE users ADD COLUMN last_login_at TEXT DEFAULT ''");
}

if (!userColumns.includes("registration_ip")) {
  db.exec("ALTER TABLE users ADD COLUMN registration_ip TEXT DEFAULT ''");
}

if (!userColumns.includes("username_changed_at")) {
  db.exec("ALTER TABLE users ADD COLUMN username_changed_at TEXT DEFAULT ''");
}

if (!userColumns.includes("afk_timeout_minutes")) {
  db.exec("ALTER TABLE users ADD COLUMN afk_timeout_minutes INTEGER NOT NULL DEFAULT 20");
}

if (!userColumns.includes("show_own_chat_time")) {
  db.exec("ALTER TABLE users ADD COLUMN show_own_chat_time INTEGER NOT NULL DEFAULT 0");
}

if (!userColumns.includes("duplicate_accounts_allowed")) {
  db.exec("ALTER TABLE users ADD COLUMN duplicate_accounts_allowed INTEGER NOT NULL DEFAULT 0");
}

if (!characterColumns.includes("festplay_id")) {
  db.exec("ALTER TABLE characters ADD COLUMN festplay_id INTEGER");
}

if (!characterColumns.includes("name_changed_at")) {
  db.exec("ALTER TABLE characters ADD COLUMN name_changed_at TEXT DEFAULT ''");
}

if (!characterColumns.includes("server_id")) {
  db.exec("ALTER TABLE characters ADD COLUMN server_id TEXT NOT NULL DEFAULT 'free-rp'");
}

if (!characterColumns.includes("festplay_dashboard_mode")) {
  db.exec("ALTER TABLE characters ADD COLUMN festplay_dashboard_mode TEXT NOT NULL DEFAULT 'festplay'");
}

if (!festplayPermissionColumns.includes("source")) {
  db.exec("ALTER TABLE festplay_permissions ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'");
  db.prepare(
    `UPDATE festplay_permissions
        SET source = 'application'
      WHERE EXISTS (
              SELECT 1
                FROM festplay_applications fa
               WHERE fa.festplay_id = festplay_permissions.festplay_id
                 AND fa.applicant_character_id = festplay_permissions.character_id
                 AND fa.status = 'approved'
            )`
  ).run();
}

if (!festplayApplicationNotificationColumns.includes("notification_kind")) {
  db.exec(
    "ALTER TABLE festplay_application_notifications ADD COLUMN notification_kind TEXT NOT NULL DEFAULT 'application'"
  );
}

if (!festplayApplicationNotificationColumns.includes("actor_name")) {
  db.exec("ALTER TABLE festplay_application_notifications ADD COLUMN actor_name TEXT NOT NULL DEFAULT ''");
}

if (!chatRoomColumns.includes("is_festplay_chat")) {
  db.exec("ALTER TABLE chat_rooms ADD COLUMN is_festplay_chat INTEGER NOT NULL DEFAULT 0");
}

if (!chatRoomColumns.includes("festplay_id")) {
  db.exec("ALTER TABLE chat_rooms ADD COLUMN festplay_id INTEGER");
}

db.exec("DROP INDEX IF EXISTS idx_chat_rooms_festplay_id");
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_chat_rooms_festplay_id
    ON chat_rooms(festplay_id)
`);

db.exec(`
  UPDATE characters
     SET festplay_dashboard_mode = 'festplay'
   WHERE trim(COALESCE(festplay_dashboard_mode, '')) = ''
`);

if (!guestbookSettingsColumns.includes("frame_color")) {
  db.exec("ALTER TABLE guestbook_settings ADD COLUMN frame_color TEXT NOT NULL DEFAULT ''");
}

if (!guestbookSettingsColumns.includes("background_color")) {
  db.exec("ALTER TABLE guestbook_settings ADD COLUMN background_color TEXT NOT NULL DEFAULT ''");
}

if (!guestbookSettingsColumns.includes("surround_color")) {
  db.exec("ALTER TABLE guestbook_settings ADD COLUMN surround_color TEXT NOT NULL DEFAULT ''");
}

if (!guestbookPageColumns.includes("image_url")) {
  db.exec("ALTER TABLE guestbook_pages ADD COLUMN image_url TEXT NOT NULL DEFAULT ''");
}

if (!guestbookPageColumns.includes("inner_image_url")) {
  db.exec("ALTER TABLE guestbook_pages ADD COLUMN inner_image_url TEXT NOT NULL DEFAULT ''");
}

if (!guestbookPageColumns.includes("outer_image_url")) {
  db.exec("ALTER TABLE guestbook_pages ADD COLUMN outer_image_url TEXT NOT NULL DEFAULT ''");
}

if (!guestbookPageColumns.includes("inner_image_opacity")) {
  db.exec("ALTER TABLE guestbook_pages ADD COLUMN inner_image_opacity INTEGER NOT NULL DEFAULT 100");
}

if (!guestbookPageColumns.includes("outer_image_opacity")) {
  db.exec("ALTER TABLE guestbook_pages ADD COLUMN outer_image_opacity INTEGER NOT NULL DEFAULT 100");
}

if (!guestbookPageColumns.includes("inner_image_repeat")) {
  db.exec("ALTER TABLE guestbook_pages ADD COLUMN inner_image_repeat INTEGER NOT NULL DEFAULT 0");
}

if (!guestbookPageColumns.includes("outer_image_repeat")) {
  db.exec("ALTER TABLE guestbook_pages ADD COLUMN outer_image_repeat INTEGER NOT NULL DEFAULT 0");
}

if (!guestbookPageColumns.includes("frame_color")) {
  db.exec("ALTER TABLE guestbook_pages ADD COLUMN frame_color TEXT NOT NULL DEFAULT ''");
}

if (!guestbookPageColumns.includes("background_color")) {
  db.exec("ALTER TABLE guestbook_pages ADD COLUMN background_color TEXT NOT NULL DEFAULT ''");
}

if (!guestbookPageColumns.includes("surround_color")) {
  db.exec("ALTER TABLE guestbook_pages ADD COLUMN surround_color TEXT NOT NULL DEFAULT ''");
}

if (!guestbookPageColumns.includes("page_style")) {
  db.exec("ALTER TABLE guestbook_pages ADD COLUMN page_style TEXT NOT NULL DEFAULT 'scroll'");
}

if (!guestbookPageColumns.includes("theme_style")) {
  db.exec("ALTER TABLE guestbook_pages ADD COLUMN theme_style TEXT NOT NULL DEFAULT 'pergament-gold'");
}

if (!guestbookSettingsColumns.includes("inner_image_url")) {
  db.exec("ALTER TABLE guestbook_settings ADD COLUMN inner_image_url TEXT NOT NULL DEFAULT ''");
}

if (!guestbookSettingsColumns.includes("outer_image_url")) {
  db.exec("ALTER TABLE guestbook_settings ADD COLUMN outer_image_url TEXT NOT NULL DEFAULT ''");
}

if (!guestbookSettingsColumns.includes("inner_image_opacity")) {
  db.exec("ALTER TABLE guestbook_settings ADD COLUMN inner_image_opacity INTEGER NOT NULL DEFAULT 100");
}

if (!guestbookSettingsColumns.includes("outer_image_opacity")) {
  db.exec("ALTER TABLE guestbook_settings ADD COLUMN outer_image_opacity INTEGER NOT NULL DEFAULT 100");
}

if (!guestbookSettingsColumns.includes("inner_image_repeat")) {
  db.exec("ALTER TABLE guestbook_settings ADD COLUMN inner_image_repeat INTEGER NOT NULL DEFAULT 0");
}

if (!guestbookSettingsColumns.includes("outer_image_repeat")) {
  db.exec("ALTER TABLE guestbook_settings ADD COLUMN outer_image_repeat INTEGER NOT NULL DEFAULT 0");
}

if (!chatRoomColumns.includes("server_id")) {
  db.exec("ALTER TABLE chat_rooms ADD COLUMN server_id TEXT NOT NULL DEFAULT 'free-rp'");
}

if (!chatRoomColumns.includes("teaser")) {
  db.exec("ALTER TABLE chat_rooms ADD COLUMN teaser TEXT NOT NULL DEFAULT ''");
}

if (!chatRoomColumns.includes("description")) {
  db.exec("ALTER TABLE chat_rooms ADD COLUMN description TEXT NOT NULL DEFAULT ''");
}

if (!chatRoomColumns.includes("image_url")) {
  db.exec("ALTER TABLE chat_rooms ADD COLUMN image_url TEXT NOT NULL DEFAULT ''");
}

if (!chatRoomColumns.includes("email_log_enabled")) {
  db.exec("ALTER TABLE chat_rooms ADD COLUMN email_log_enabled INTEGER NOT NULL DEFAULT 0");
}

if (!chatRoomColumns.includes("is_locked")) {
  db.exec("ALTER TABLE chat_rooms ADD COLUMN is_locked INTEGER NOT NULL DEFAULT 0");
}

if (!chatRoomColumns.includes("is_public_room")) {
  db.exec("ALTER TABLE chat_rooms ADD COLUMN is_public_room INTEGER NOT NULL DEFAULT 0");
}

if (!chatRoomColumns.includes("is_saved_room")) {
  db.exec("ALTER TABLE chat_rooms ADD COLUMN is_saved_room INTEGER NOT NULL DEFAULT 0");
  db.exec("UPDATE chat_rooms SET is_saved_room = 1 WHERE COALESCE(is_public_room, 0) = 0");
}

if (!chatRoomColumns.includes("is_manual_festplay_room")) {
  db.exec("ALTER TABLE chat_rooms ADD COLUMN is_manual_festplay_room INTEGER NOT NULL DEFAULT 0");
}

if (!chatRoomColumns.includes("is_festplay_side_chat")) {
  db.exec("ALTER TABLE chat_rooms ADD COLUMN is_festplay_side_chat INTEGER NOT NULL DEFAULT 0");
}

if (!chatRoomColumns.includes("sort_order")) {
  db.exec("ALTER TABLE chat_rooms ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0");
}

db.exec("DROP INDEX IF EXISTS idx_chat_rooms_server_user_name_key");
db.exec("DROP INDEX IF EXISTS idx_chat_rooms_server_user_visibility_name_key");
db.exec("DROP INDEX IF EXISTS idx_chat_rooms_public_server_name_key");
db.exec("DROP INDEX IF EXISTS idx_chat_rooms_saved_user_name_description_key");
db.exec(`CREATE INDEX IF NOT EXISTS idx_chat_rooms_public_server_name_key
  ON chat_rooms(server_id, name_key)
  WHERE COALESCE(is_public_room, 0) = 1`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_chat_rooms_saved_user_name_description_key
  ON chat_rooms(server_id, created_by_user_id, name_key, COALESCE(description, ''))
  WHERE COALESCE(is_saved_room, 0) = 1`);

if (!chatMessageColumns.includes("room_id")) {
  db.exec("ALTER TABLE chat_messages ADD COLUMN room_id INTEGER");
}

if (!chatMessageColumns.includes("server_id")) {
  db.exec("ALTER TABLE chat_messages ADD COLUMN server_id TEXT NOT NULL DEFAULT 'free-rp'");
}

if (!siteHomeSettingsColumns.includes("hero_title")) {
  db.exec("ALTER TABLE site_home_settings ADD COLUMN hero_title TEXT NOT NULL DEFAULT 'Heldenhaft Reisen'");
}

if (!siteHomeSettingsColumns.includes("hero_body")) {
  db.exec(
    "ALTER TABLE site_home_settings ADD COLUMN hero_body TEXT NOT NULL DEFAULT 'Aktuelle Neuigkeiten findest du oben über den Live-Updates-Tab im Header. Dort können Admins und Moderatoren neue Meldungen direkt veröffentlichen und bearbeiten.'"
  );
}

if (!siteHomeSettingsColumns.includes("updates_title")) {
  db.exec("ALTER TABLE site_home_settings ADD COLUMN updates_title TEXT NOT NULL DEFAULT 'Live Updates'");
}

if (!siteHomeSettingsColumns.includes("account_number_migration_version")) {
  db.exec(
    "ALTER TABLE site_home_settings ADD COLUMN account_number_migration_version INTEGER NOT NULL DEFAULT 0"
  );
}

if (!siteUpdateColumns.includes("updated_at")) {
  db.exec("ALTER TABLE site_updates ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''");
}

if (!guestbookEntryColumns.includes("guestbook_page_id")) {
  db.exec("ALTER TABLE guestbook_entries ADD COLUMN guestbook_page_id INTEGER");
}

if (!guestbookEntryColumns.includes("author_character_id")) {
  db.exec("ALTER TABLE guestbook_entries ADD COLUMN author_character_id INTEGER");
}

if (!guestbookEntryColumns.includes("is_private")) {
  db.exec("ALTER TABLE guestbook_entries ADD COLUMN is_private INTEGER NOT NULL DEFAULT 0");
}

if (!guestbookEntryColumns.includes("updated_at")) {
  db.exec("ALTER TABLE guestbook_entries ADD COLUMN updated_at TEXT");
}

db.exec("CREATE INDEX IF NOT EXISTS idx_characters_festplay_id ON characters(festplay_id)");
db.exec("CREATE INDEX IF NOT EXISTS idx_characters_server_id ON characters(server_id)");
db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_guestbook_pages_character_number ON guestbook_pages(character_id, page_number)");
db.exec("CREATE INDEX IF NOT EXISTS idx_guestbook_pages_character_id ON guestbook_pages(character_id)");
db.exec("CREATE INDEX IF NOT EXISTS idx_guestbook_entries_page_id ON guestbook_entries(guestbook_page_id)");
db.exec("CREATE INDEX IF NOT EXISTS idx_guestbook_author_character_id ON guestbook_entries(author_character_id)");
db.exec("CREATE INDEX IF NOT EXISTS idx_guestbook_notifications_user_read ON guestbook_notifications(user_id, is_read, created_at)");
db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_guestbook_notifications_user_entry ON guestbook_notifications(user_id, guestbook_entry_id)");
db.exec(
  "CREATE INDEX IF NOT EXISTS idx_festplay_application_notifications_user_read ON festplay_application_notifications(user_id, is_read, created_at)"
);
db.exec(
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_festplay_application_notifications_user_application ON festplay_application_notifications(user_id, festplay_application_id)"
);
db.exec("CREATE INDEX IF NOT EXISTS idx_chat_room_id ON chat_messages(room_id)");
db.exec("CREATE INDEX IF NOT EXISTS idx_chat_rooms_server_id ON chat_rooms(server_id)");
db.exec("CREATE INDEX IF NOT EXISTS idx_chat_messages_server_id ON chat_messages(server_id)");
db.exec("CREATE INDEX IF NOT EXISTS idx_character_private_notes_user_id ON character_private_notes(user_id)");
db.exec("CREATE INDEX IF NOT EXISTS idx_chat_reconnect_suppressions_expires_at ON chat_reconnect_suppressions(expires_at)");
db.exec("CREATE INDEX IF NOT EXISTS idx_rp_board_entries_context_created ON rp_board_entries(server_id, festplay_id, created_at, id)");
db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_rp_board_reads_user_context ON rp_board_reads(user_id, server_id, festplay_id)");
db.exec(
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_room_permissions_room_user ON chat_room_permissions(room_id, user_id)"
);
db.exec("CREATE INDEX IF NOT EXISTS idx_chat_room_permissions_user_id ON chat_room_permissions(user_id)");
db.exec("DROP INDEX IF EXISTS idx_chat_rooms_character_name_key");
db.exec("CREATE INDEX IF NOT EXISTS idx_chat_rooms_character_id ON chat_rooms(character_id)");

db.prepare("UPDATE users SET theme = 'glass-aurora' WHERE theme IS NULL OR theme = ''").run();
db.prepare("UPDATE users SET is_moderator = 0 WHERE is_moderator IS NULL").run();
db.prepare("UPDATE users SET admin_display_name = '' WHERE admin_display_name IS NULL").run();
db.prepare("UPDATE users SET moderator_display_name = '' WHERE moderator_display_name IS NULL").run();
db.prepare("UPDATE users SET admin_character_id = NULL WHERE admin_character_id IS NOT NULL AND admin_character_id < 1").run();
db.prepare("UPDATE users SET moderator_character_id = NULL WHERE moderator_character_id IS NOT NULL AND moderator_character_id < 1").run();
db.prepare("UPDATE users SET email = '' WHERE email IS NULL").run();
db.prepare("UPDATE users SET birth_date = '' WHERE birth_date IS NULL").run();
db.prepare("UPDATE festplay_permissions SET source = 'manual' WHERE source IS NULL OR trim(source) = ''").run();
db.prepare("UPDATE guestbook_settings SET frame_color = '' WHERE frame_color IS NULL").run();
db.prepare("UPDATE guestbook_settings SET background_color = '' WHERE background_color IS NULL").run();
db.prepare("UPDATE guestbook_settings SET surround_color = '' WHERE surround_color IS NULL").run();
db.prepare("UPDATE guestbook_settings SET inner_image_url = '' WHERE inner_image_url IS NULL").run();
db.prepare("UPDATE guestbook_settings SET outer_image_url = '' WHERE outer_image_url IS NULL").run();
db.prepare("UPDATE guestbook_settings SET inner_image_opacity = 100 WHERE inner_image_opacity IS NULL").run();
db.prepare("UPDATE guestbook_settings SET outer_image_opacity = 100 WHERE outer_image_opacity IS NULL").run();
db.prepare("UPDATE guestbook_settings SET inner_image_repeat = 0 WHERE inner_image_repeat IS NULL").run();
db.prepare("UPDATE guestbook_settings SET outer_image_repeat = 0 WHERE outer_image_repeat IS NULL").run();
db.prepare("UPDATE guestbook_pages SET image_url = '' WHERE image_url IS NULL").run();
db.prepare("UPDATE guestbook_pages SET inner_image_url = '' WHERE inner_image_url IS NULL").run();
db.prepare("UPDATE guestbook_pages SET outer_image_url = '' WHERE outer_image_url IS NULL").run();
db.prepare("UPDATE guestbook_pages SET inner_image_opacity = 100 WHERE inner_image_opacity IS NULL").run();
db.prepare("UPDATE guestbook_pages SET outer_image_opacity = 100 WHERE outer_image_opacity IS NULL").run();
db.prepare("UPDATE guestbook_pages SET inner_image_repeat = 0 WHERE inner_image_repeat IS NULL").run();
db.prepare("UPDATE guestbook_pages SET outer_image_repeat = 0 WHERE outer_image_repeat IS NULL").run();
db.prepare("UPDATE guestbook_pages SET frame_color = '' WHERE frame_color IS NULL").run();
db.prepare("UPDATE guestbook_pages SET background_color = '' WHERE background_color IS NULL").run();
db.prepare("UPDATE guestbook_pages SET surround_color = '' WHERE surround_color IS NULL").run();
db.prepare("UPDATE guestbook_pages SET page_style = 'scroll' WHERE page_style IS NULL OR trim(page_style) = ''").run();
db.prepare("UPDATE guestbook_pages SET theme_style = 'pergament-gold' WHERE theme_style IS NULL OR trim(theme_style) = ''").run();
db.prepare("UPDATE guestbook_settings SET theme_style = 'pergament-gold' WHERE theme_style IS NULL OR trim(theme_style) = ''").run();
db.prepare(`
  UPDATE guestbook_settings
  SET theme_style = CASE theme_style
    WHEN 'blumen' THEN 'rosenlack'
    WHEN 'nacht' THEN 'sternsamt'
    WHEN 'minimal' THEN 'mondsilber'
    WHEN 'neutral-weiss' THEN 'winterglas'
    WHEN 'tiefschwarz' THEN 'obsidian-ornament'
    ELSE theme_style
  END
  WHERE theme_style IN ('blumen', 'nacht', 'minimal', 'neutral-weiss', 'tiefschwarz')
`).run();
db.prepare(`
  UPDATE guestbook_pages
  SET theme_style = CASE theme_style
    WHEN 'blumen' THEN 'rosenlack'
    WHEN 'nacht' THEN 'sternsamt'
    WHEN 'minimal' THEN 'mondsilber'
    WHEN 'neutral-weiss' THEN 'winterglas'
    WHEN 'tiefschwarz' THEN 'obsidian-ornament'
    ELSE theme_style
  END
  WHERE theme_style IN ('blumen', 'nacht', 'minimal', 'neutral-weiss', 'tiefschwarz')
`).run();
if (guestbookPageDesignColumnsWereMissing) {
  db.prepare(`
    UPDATE guestbook_pages
    SET image_url = gs.image_url,
        inner_image_url = gs.inner_image_url,
        outer_image_url = gs.outer_image_url,
        inner_image_opacity = gs.inner_image_opacity,
        outer_image_opacity = gs.outer_image_opacity,
        inner_image_repeat = gs.inner_image_repeat,
        outer_image_repeat = gs.outer_image_repeat,
        frame_color = gs.frame_color,
        background_color = gs.background_color,
        surround_color = gs.surround_color,
        page_style = gs.page_style,
        theme_style = CASE gs.theme_style
          WHEN 'blumen' THEN 'rosenlack'
          WHEN 'nacht' THEN 'sternsamt'
          WHEN 'minimal' THEN 'mondsilber'
          WHEN 'neutral-weiss' THEN 'winterglas'
          WHEN 'tiefschwarz' THEN 'obsidian-ornament'
          ELSE gs.theme_style
        END
    FROM guestbook_settings gs
    WHERE gs.character_id = guestbook_pages.character_id
  `).run();
}
db.prepare("UPDATE users SET email_verified = 1 WHERE email_verified IS NULL").run();
db.prepare("UPDATE users SET email_verification_token = '' WHERE email_verification_token IS NULL").run();
db.prepare("UPDATE users SET password_reset_token = '' WHERE password_reset_token IS NULL").run();
db.prepare("UPDATE users SET password_reset_sent_at = '' WHERE password_reset_sent_at IS NULL").run();
db.prepare("UPDATE users SET google_id = '' WHERE google_id IS NULL").run();
db.prepare("UPDATE users SET facebook_id = '' WHERE facebook_id IS NULL").run();
db.prepare("UPDATE users SET last_login_ip = '' WHERE last_login_ip IS NULL").run();
db.prepare("UPDATE users SET last_login_at = '' WHERE last_login_at IS NULL").run();
db.prepare(
  "UPDATE users SET registration_ip = COALESCE(NULLIF(last_login_ip, ''), '') WHERE registration_ip IS NULL OR registration_ip = ''"
).run();
db.prepare("UPDATE users SET duplicate_accounts_allowed = 0 WHERE duplicate_accounts_allowed IS NULL").run();
db.prepare(
  "UPDATE guestbook_entries SET updated_at = COALESCE(NULLIF(updated_at, ''), created_at, CURRENT_TIMESTAMP) WHERE updated_at IS NULL OR updated_at = ''"
).run();
db.prepare(
  "UPDATE characters SET server_id = 'free-rp' WHERE server_id IS NULL OR trim(server_id) = '' OR lower(server_id) NOT IN ('free-rp', 'erp')"
).run();
db.prepare("UPDATE characters SET name_changed_at = '' WHERE name_changed_at IS NULL").run();
db.prepare(
  `UPDATE chat_rooms
   SET server_id = COALESCE(
     (SELECT c.server_id FROM characters c WHERE c.id = chat_rooms.character_id),
     'free-rp'
   )`
).run();
db.prepare(
  "UPDATE chat_rooms SET server_id = 'free-rp' WHERE server_id IS NULL OR trim(server_id) = '' OR lower(server_id) NOT IN ('free-rp', 'erp')"
).run();
db.prepare("UPDATE chat_rooms SET description = '' WHERE description IS NULL").run();
db.prepare("UPDATE chat_rooms SET description = teaser WHERE description = '' AND teaser != ''").run();
db.prepare("UPDATE chat_rooms SET teaser = '' WHERE teaser IS NULL").run();
db.prepare("UPDATE chat_rooms SET image_url = '' WHERE image_url IS NULL").run();
db.prepare("UPDATE chat_rooms SET email_log_enabled = 0 WHERE email_log_enabled IS NULL").run();
db.prepare("UPDATE chat_rooms SET is_locked = 0 WHERE is_locked IS NULL").run();
db.prepare(
  `UPDATE chat_rooms
      SET is_festplay_side_chat = 1
    WHERE COALESCE(festplay_id, 0) > 0
      AND COALESCE(is_festplay_chat, 0) = 0`
).run();
db.exec("CREATE INDEX IF NOT EXISTS idx_users_registration_ip ON users(registration_ip)");
db.prepare(
  `UPDATE chat_rooms
      SET is_festplay_chat = 0,
          is_manual_festplay_room = 0
    WHERE COALESCE(is_festplay_chat, 0) = 1
      AND COALESCE(is_manual_festplay_room, 0) = 1
      AND EXISTS (
        SELECT 1
          FROM festplays f
         WHERE f.id = chat_rooms.festplay_id
           AND COALESCE(chat_rooms.created_by_user_id, 0) != COALESCE(f.created_by_user_id, 0)
      )`
).run();
db.prepare(
  `UPDATE chat_rooms
      SET is_public_room = 1,
          is_saved_room = 0
    WHERE COALESCE(is_festplay_side_chat, 0) = 1
      AND COALESCE(is_festplay_chat, 0) = 0`
).run();
db.prepare(
  `UPDATE chat_messages
   SET server_id = COALESCE(
     (
       SELECT c.server_id
       FROM chat_rooms r
       JOIN characters c ON c.id = r.character_id
       WHERE r.id = chat_messages.room_id
     ),
     server_id,
     'free-rp'
   )`
).run();
db.prepare(
  "UPDATE chat_messages SET server_id = 'free-rp' WHERE server_id IS NULL OR trim(server_id) = '' OR lower(server_id) NOT IN ('free-rp', 'erp')"
).run();
db.prepare(
  `INSERT INTO guestbook_pages (character_id, page_number, title, content)
   SELECT c.id, 1, '1', ''
   FROM characters c
   WHERE NOT EXISTS (
     SELECT 1
     FROM guestbook_pages gp
     WHERE gp.character_id = c.id
   )`
).run();
db.prepare(
  `UPDATE guestbook_entries
   SET guestbook_page_id = (
     SELECT gp.id
     FROM guestbook_pages gp
     WHERE gp.character_id = guestbook_entries.character_id
     ORDER BY gp.page_number ASC, gp.id ASC
     LIMIT 1
   )
   WHERE guestbook_page_id IS NULL`
).run();
db.prepare("UPDATE guestbook_entries SET is_private = 0 WHERE is_private IS NULL").run();
db.prepare(
  "UPDATE guestbook_entries SET updated_at = created_at WHERE updated_at IS NULL OR trim(updated_at) = ''"
).run();
db.prepare(
  `INSERT INTO guestbook_settings (character_id)
   SELECT c.id
   FROM characters c
   WHERE NOT EXISTS (
     SELECT 1
     FROM guestbook_settings gs
      WHERE gs.character_id = c.id
    )`
).run();
db.prepare(
  `INSERT INTO site_home_settings (id)
   SELECT 1
   WHERE NOT EXISTS (
     SELECT 1
     FROM site_home_settings shs
     WHERE shs.id = 1
   )`
).run();
db.prepare(
  "UPDATE site_home_settings SET hero_title = 'Heldenhaft Reisen' WHERE hero_title IS NULL OR trim(hero_title) = ''"
).run();
db.prepare(
  "UPDATE site_home_settings SET hero_body = 'Aktuelle Neuigkeiten findest du oben über den Live-Updates-Tab im Header. Dort können Admins und Moderatoren neue Meldungen direkt veröffentlichen und bearbeiten.' WHERE hero_body IS NULL OR trim(hero_body) = ''"
).run();
db.prepare(
  "UPDATE site_home_settings SET hero_body = 'Aktuelle Neuigkeiten findest du oben über den Live-Updates-Tab im Header. Dort können Admins und Moderatoren neue Meldungen direkt veröffentlichen und bearbeiten.' WHERE hero_body = 'Alle Neuigkeiten laufen hier auf der Startseite im Live-Update-Bereich. Admins und Moderatoren koennen sie direkt hier veroeffentlichen und bearbeiten.'"
).run();
db.prepare(
  "UPDATE site_home_settings SET hero_body = 'Aktuelle Neuigkeiten findest du oben über den Live-Updates-Tab im Header. Dort können Admins und Moderatoren neue Meldungen direkt veröffentlichen und bearbeiten.' WHERE hero_body = 'Alle Neuigkeiten laufen hier auf der Startseite im Live-Update-Bereich. Admins und Moderatoren können sie direkt hier veröffentlichen und bearbeiten.'"
).run();
db.prepare(
  "UPDATE site_home_settings SET hero_body = 'Aktuelle Neuigkeiten findest du oben über den Live-Updates-Tab im Header. Dort können Admins und Moderatoren neue Meldungen direkt veröffentlichen und bearbeiten.' WHERE hero_body IS NULL OR trim(hero_body) = ''"
).run();
db.prepare(
  "UPDATE site_home_settings SET hero_body = 'Aktuelle Neuigkeiten findest du oben über den Live-Updates-Tab im Header. Dort können Admins und Moderatoren neue Meldungen direkt veröffentlichen und bearbeiten.' WHERE hero_body = 'Aktuelle Neuigkeiten findest du oben Ã¼ber den Live-Updates-Tab im Header. Dort kÃ¶nnen Admins und Moderatoren neue Meldungen direkt verÃ¶ffentlichen und bearbeiten.'"
).run();
db.prepare(
  "UPDATE site_home_settings SET hero_body = 'Aktuelle Neuigkeiten findest du oben über den Live-Updates-Tab im Header. Dort können Admins und Moderatoren neue Meldungen direkt veröffentlichen und bearbeiten.' WHERE hero_body = 'Alle Neuigkeiten laufen hier auf der Startseite im Live-Update-Bereich. Admins und Moderatoren koennen sie direkt hier veroeffentlichen und bearbeiten.'"
).run();
db.prepare(
  "UPDATE site_home_settings SET hero_body = 'Aktuelle Neuigkeiten findest du oben über den Live-Updates-Tab im Header. Dort können Admins und Moderatoren neue Meldungen direkt veröffentlichen und bearbeiten.' WHERE hero_body = 'Alle Neuigkeiten laufen hier auf der Startseite im Live-Update-Bereich. Admins und Moderatoren können sie direkt hier veröffentlichen und bearbeiten.'"
).run();
db.prepare(
  "UPDATE site_home_settings SET hero_body = 'Aktuelle Neuigkeiten findest du oben über den Live-Updates-Tab im Header. Dort können Admins und Moderatoren neue Meldungen direkt veröffentlichen und bearbeiten.' WHERE hero_body = 'Alle Neuigkeiten laufen hier auf der Startseite im Live-Update-Bereich. Admins und Moderatoren kÃ¶nnen sie direkt hier verÃ¶ffentlichen und bearbeiten.'"
).run();
db.prepare(
  "UPDATE site_home_settings SET updates_title = 'Live Updates' WHERE updates_title IS NULL OR trim(updates_title) = ''"
).run();
db.prepare(
  "UPDATE site_updates SET updated_at = created_at WHERE updated_at IS NULL OR trim(updated_at) = ''"
).run();

function generateUniqueAccountNumber() {
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

  let candidate = 1;
  while (usedAccountNumbers.has(candidate)) {
    candidate += 1;
  }

  return String(candidate);
}

const usersMissingAccountNumbers = db
  .prepare(
    `SELECT id
       FROM users
      WHERE account_number IS NULL OR trim(account_number) = ''
      ORDER BY CASE
        WHEN is_admin = 1 THEN 0
        WHEN is_moderator = 1 AND email_verified = 1 THEN 1
        WHEN is_moderator = 1 THEN 2
        ELSE 3
      END,
      id ASC`
  )
  .all();

if (usersMissingAccountNumbers.length > 0) {
  const assignAccountNumber = db.prepare("UPDATE users SET account_number = ? WHERE id = ?");
  const fillMissingAccountNumbers = db.transaction((rows) => {
    rows.forEach((row) => {
      assignAccountNumber.run(generateUniqueAccountNumber(), row.id);
    });
  });

  fillMissingAccountNumbers(usersMissingAccountNumbers);
}

function normalizeLegacyAccountNumbers() {
  const migrationState = db
    .prepare(
      `SELECT account_number_migration_version
         FROM site_home_settings
        WHERE id = 1`
    )
    .get();

  if (Number(migrationState?.account_number_migration_version || 0) >= 1) {
    return;
  }

  const users = db
    .prepare(
      `SELECT id
         FROM users
        ORDER BY CASE
          WHEN is_admin = 1 THEN 0
          WHEN is_moderator = 1 AND email_verified = 1 THEN 1
          WHEN is_moderator = 1 THEN 2
          ELSE 3
        END,
        id ASC`
    )
    .all();

  const updateAccountNumber = db.prepare("UPDATE users SET account_number = ? WHERE id = ?");
  const markMigrationDone = db.prepare(
    `UPDATE site_home_settings
        SET account_number_migration_version = 1
      WHERE id = 1`
  );

  const applyMigration = db.transaction((rows) => {
    rows.forEach((row, index) => {
      updateAccountNumber.run(String(index + 1), row.id);
    });
    markMigrationDone.run();
  });

  applyMigration(users);
}

normalizeLegacyAccountNumbers();

db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_users_account_number_unique
  ON users(account_number)
  WHERE account_number IS NOT NULL AND account_number != '';

  CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique
  ON users(email)
  WHERE email IS NOT NULL AND email != '';

  CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_verification_token_unique
  ON users(email_verification_token)
  WHERE email_verification_token IS NOT NULL AND email_verification_token != '';

  CREATE UNIQUE INDEX IF NOT EXISTS idx_users_password_reset_token_unique
  ON users(password_reset_token)
  WHERE password_reset_token IS NOT NULL AND password_reset_token != '';

  CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id_unique
  ON users(google_id)
  WHERE google_id IS NOT NULL AND google_id != '';

  CREATE UNIQUE INDEX IF NOT EXISTS idx_users_facebook_id_unique
  ON users(facebook_id)
  WHERE facebook_id IS NOT NULL AND facebook_id != '';
`);

const festplayCount = db
  .prepare("SELECT COUNT(*) AS count FROM festplays")
  .get().count;
if (festplayCount === 0) {
  db.prepare("INSERT INTO festplays (name) VALUES (?)").run("Freeplay");
}

module.exports = db;
