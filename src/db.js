const fs = require("fs");
const path = require("path");
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
    theme TEXT NOT NULL DEFAULT 'glass-aurora',
    email TEXT DEFAULT '',
    birth_date TEXT DEFAULT '',
    email_verified INTEGER NOT NULL DEFAULT 1,
    email_verification_token TEXT DEFAULT '',
    password_reset_token TEXT DEFAULT '',
    password_reset_sent_at TEXT DEFAULT '',
    google_id TEXT DEFAULT '',
    facebook_id TEXT DEFAULT '',
    last_login_ip TEXT DEFAULT '',
    last_login_at TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS characters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    server_id TEXT NOT NULL DEFAULT 'free-rp',
    festplay_id INTEGER,
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
    created_by_user_id INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS guestbook_pages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id INTEGER NOT NULL,
    page_number INTEGER NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS guestbook_settings (
    character_id INTEGER PRIMARY KEY,
    image_url TEXT NOT NULL DEFAULT '',
    censor_level TEXT NOT NULL DEFAULT 'none',
    chat_text_color TEXT NOT NULL DEFAULT '#AEE7B7',
    page_style TEXT NOT NULL DEFAULT 'scroll',
    theme_style TEXT NOT NULL DEFAULT 'blumen',
    font_style TEXT NOT NULL DEFAULT 'default',
    tags TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS guestbook_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id INTEGER NOT NULL,
    author_id INTEGER NOT NULL,
    author_name TEXT NOT NULL,
    content TEXT NOT NULL,
    guestbook_page_id INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS chat_rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id INTEGER NOT NULL,
    created_by_user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    name_key TEXT NOT NULL,
    teaser TEXT NOT NULL DEFAULT '',
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

  CREATE TABLE IF NOT EXISTS site_updates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    author_id INTEGER NOT NULL,
    author_name TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS site_home_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    hero_title TEXT NOT NULL DEFAULT 'Heldenhaft Reisen',
    hero_body TEXT NOT NULL DEFAULT 'Alle Neuigkeiten laufen hier auf der Startseite im Live-Update-Bereich. Admins und Moderatoren können sie direkt hier veröffentlichen und bearbeiten.',
    updates_title TEXT NOT NULL DEFAULT 'Live Updates'
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

  CREATE INDEX IF NOT EXISTS idx_characters_user_id ON characters(user_id);
  CREATE INDEX IF NOT EXISTS idx_guestbook_character_id ON guestbook_entries(character_id);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_rooms_character_name_key
    ON chat_rooms(character_id, name_key);
  CREATE INDEX IF NOT EXISTS idx_chat_rooms_character_id ON chat_rooms(character_id);
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

if (!userColumns.includes("is_admin")) {
  db.exec("ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0");
}

if (!userColumns.includes("is_moderator")) {
  db.exec("ALTER TABLE users ADD COLUMN is_moderator INTEGER NOT NULL DEFAULT 0");
}

if (!userColumns.includes("theme")) {
  db.exec("ALTER TABLE users ADD COLUMN theme TEXT NOT NULL DEFAULT 'glass-aurora'");
}

if (!userColumns.includes("email")) {
  db.exec("ALTER TABLE users ADD COLUMN email TEXT DEFAULT ''");
}

if (!userColumns.includes("birth_date")) {
  db.exec("ALTER TABLE users ADD COLUMN birth_date TEXT DEFAULT ''");
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

if (!characterColumns.includes("festplay_id")) {
  db.exec("ALTER TABLE characters ADD COLUMN festplay_id INTEGER");
}

if (!characterColumns.includes("server_id")) {
  db.exec("ALTER TABLE characters ADD COLUMN server_id TEXT NOT NULL DEFAULT 'free-rp'");
}

if (!chatRoomColumns.includes("server_id")) {
  db.exec("ALTER TABLE chat_rooms ADD COLUMN server_id TEXT NOT NULL DEFAULT 'free-rp'");
}

if (!chatRoomColumns.includes("teaser")) {
  db.exec("ALTER TABLE chat_rooms ADD COLUMN teaser TEXT NOT NULL DEFAULT ''");
}

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
    "ALTER TABLE site_home_settings ADD COLUMN hero_body TEXT NOT NULL DEFAULT 'Alle Neuigkeiten laufen hier auf der Startseite im Live-Update-Bereich. Admins und Moderatoren können sie direkt hier veröffentlichen und bearbeiten.'"
  );
}

if (!siteHomeSettingsColumns.includes("updates_title")) {
  db.exec("ALTER TABLE site_home_settings ADD COLUMN updates_title TEXT NOT NULL DEFAULT 'Live Updates'");
}

if (!guestbookEntryColumns.includes("guestbook_page_id")) {
  db.exec("ALTER TABLE guestbook_entries ADD COLUMN guestbook_page_id INTEGER");
}

db.exec("CREATE INDEX IF NOT EXISTS idx_characters_festplay_id ON characters(festplay_id)");
db.exec("CREATE INDEX IF NOT EXISTS idx_characters_server_id ON characters(server_id)");
db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_guestbook_pages_character_number ON guestbook_pages(character_id, page_number)");
db.exec("CREATE INDEX IF NOT EXISTS idx_guestbook_pages_character_id ON guestbook_pages(character_id)");
db.exec("CREATE INDEX IF NOT EXISTS idx_guestbook_entries_page_id ON guestbook_entries(guestbook_page_id)");
db.exec("CREATE INDEX IF NOT EXISTS idx_chat_room_id ON chat_messages(room_id)");
db.exec("CREATE INDEX IF NOT EXISTS idx_chat_rooms_server_id ON chat_rooms(server_id)");
db.exec("CREATE INDEX IF NOT EXISTS idx_chat_messages_server_id ON chat_messages(server_id)");
db.exec(
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_rooms_character_name_key ON chat_rooms(character_id, name_key)"
);
db.exec("CREATE INDEX IF NOT EXISTS idx_chat_rooms_character_id ON chat_rooms(character_id)");

db.prepare("UPDATE users SET theme = 'glass-aurora' WHERE theme IS NULL OR theme = ''").run();
db.prepare("UPDATE users SET is_moderator = 0 WHERE is_moderator IS NULL").run();
db.prepare("UPDATE users SET email = '' WHERE email IS NULL").run();
db.prepare("UPDATE users SET birth_date = '' WHERE birth_date IS NULL").run();
db.prepare("UPDATE users SET email_verified = 1 WHERE email_verified IS NULL").run();
db.prepare("UPDATE users SET email_verification_token = '' WHERE email_verification_token IS NULL").run();
db.prepare("UPDATE users SET password_reset_token = '' WHERE password_reset_token IS NULL").run();
db.prepare("UPDATE users SET password_reset_sent_at = '' WHERE password_reset_sent_at IS NULL").run();
db.prepare("UPDATE users SET google_id = '' WHERE google_id IS NULL").run();
db.prepare("UPDATE users SET facebook_id = '' WHERE facebook_id IS NULL").run();
db.prepare("UPDATE users SET last_login_ip = '' WHERE last_login_ip IS NULL").run();
db.prepare("UPDATE users SET last_login_at = '' WHERE last_login_at IS NULL").run();
db.prepare(
  "UPDATE characters SET server_id = 'free-rp' WHERE server_id IS NULL OR trim(server_id) = '' OR lower(server_id) NOT IN ('free-rp', 'erp')"
).run();
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
db.prepare("UPDATE chat_rooms SET teaser = '' WHERE teaser IS NULL").run();
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
  "UPDATE site_home_settings SET hero_body = 'Alle Neuigkeiten laufen hier auf der Startseite im Live-Update-Bereich. Admins und Moderatoren können sie direkt hier veröffentlichen und bearbeiten.' WHERE hero_body IS NULL OR trim(hero_body) = ''"
).run();
db.prepare(
  "UPDATE site_home_settings SET hero_body = 'Alle Neuigkeiten laufen hier auf der Startseite im Live-Update-Bereich. Admins und Moderatoren können sie direkt hier veröffentlichen und bearbeiten.' WHERE hero_body = 'Alle Neuigkeiten laufen hier auf der Startseite im Live-Update-Bereich. Admins und Moderatoren koennen sie direkt hier veroeffentlichen und bearbeiten.'"
).run();
db.prepare(
  "UPDATE site_home_settings SET updates_title = 'Live Updates' WHERE updates_title IS NULL OR trim(updates_title) = ''"
).run();

db.exec(`
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
