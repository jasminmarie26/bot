const bcrypt = require("bcryptjs");
const db = require("./db");

const username = String(process.argv[2] || "").trim().slice(0, 24);
const password = String(process.argv[3] || "");
const email = String(process.argv[4] || "")
  .trim()
  .toLowerCase()
  .slice(0, 255);

if (!username || !password) {
  console.error("Usage: npm run create-admin -- <username> <password> [email]");
  process.exit(1);
}

if (!/^[a-zA-Z0-9_.+\- ]{3,24}$/.test(username)) {
  console.error(
    "Username darf nur Buchstaben, Zahlen, Leerzeichen und . _ + - enthalten (3-24 Zeichen)."
  );
  process.exit(1);
}

if (password.length < 6) {
  console.error("Passwort muss mindestens 6 Zeichen haben.");
  process.exit(1);
}

if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("Optionales E-Mail-Format ist ungueltig.");
  process.exit(1);
}

const existingByUsername = db
  .prepare("SELECT id, username, email FROM users WHERE username = ?")
  .get(username);

if (email) {
  const existingByEmail = db
    .prepare("SELECT id FROM users WHERE email = ?")
    .get(email);
  if (existingByEmail && (!existingByUsername || existingByEmail.id !== existingByUsername.id)) {
    console.error("Diese E-Mail-Adresse wird bereits von einem anderen Account verwendet.");
    process.exit(1);
  }
}

const passwordHash = bcrypt.hashSync(password, 10);

if (existingByUsername) {
  db.prepare(
    `UPDATE users
     SET password_hash = ?,
         is_admin = 1,
         email = CASE WHEN ? != '' THEN ? ELSE email END,
         email_verified = CASE WHEN ? != '' THEN 1 ELSE email_verified END,
         email_verification_token = CASE WHEN ? != '' THEN '' ELSE email_verification_token END
     WHERE id = ?`
  ).run(passwordHash, email, email, email, email, existingByUsername.id);

  console.log(`Admin-Account '${username}' wurde aktualisiert.`);
  process.exit(0);
}

db.prepare(
  `INSERT INTO users
   (username, password_hash, is_admin, is_moderator, theme, email, email_verified, email_verification_token)
   VALUES (?, ?, 1, 0, 'glass-aurora', ?, ?, '')`
).run(username, passwordHash, email, 1);

console.log(`Admin-Account '${username}' wurde erstellt.`);
