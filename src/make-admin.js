const db = require("./db");

const username = (process.argv[2] || "").trim();

if (!username) {
  console.error("Usage: npm run make-admin -- <username>");
  process.exit(1);
}

const user = db
  .prepare("SELECT id, username, is_admin FROM users WHERE username = ?")
  .get(username);

if (!user) {
  console.error(`User '${username}' wurde nicht gefunden.`);
  process.exit(1);
}

db.prepare("UPDATE users SET is_admin = 1 WHERE id = ?").run(user.id);
console.log(`User '${user.username}' ist jetzt Admin.`);
