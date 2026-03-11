# RP Chat Plattform (Web)

Web-App mit zentralem Chat, unendlich vielen Charakteren pro Account und Gaestebuechern auf Charakterseiten.

## Features

- Registrierung, Login, Logout (Session-basiert)
- Globaler Live-Chat (Socket.IO)
- Unbegrenzte Charaktererstellung pro User
- Festplay-Auswahl beim Charakter-Anlegen
- Charakterprofile mit Beschreibung, Avatar und Festplay
- Sichtbarkeit pro Charakter: oeffentlich oder privat
- Gaestebuch pro Charakter mit Eintraegen anderer User
- Admin-Rolle mit Adminbereich fuer Benutzerverwaltung
- Admin-Verwaltung fuer Festplays (anlegen/loeschen)
- Mehrere waehlbare Designs pro User (inkl. Glass-Themes)
- Optionaler Social Login mit Google (Gmail) und Facebook
- Live-Updates auf der Startseite (Admins koennen sie direkt per UI veroeffentlichen)

## Installation

1. Abhaengigkeiten installieren:

```bash
npm install
```

2. `.env.example` nach `.env` kopieren:

```env
PORT=3000
SESSION_SECRET=bitte-langes-zufaelliges-geheimnis-eintragen
APP_BASE_URL=http://localhost:3000
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=
```

3. Starten:

```bash
npm run dev
```

oder fuer normal:

```bash
npm start
```

4. Im Browser oeffnen:

`http://localhost:3000`

## Social Login Setup

Google (Gmail):
- In der Google Cloud Console OAuth-Client erstellen.
- Als Redirect URL setzen: `https://heldenhaftereisen.net/auth/google/callback`
- Lokal zum Testen kannst du stattdessen `http://localhost:3000/auth/google/callback` verwenden.
- `APP_BASE_URL`, `GOOGLE_CLIENT_ID` und `GOOGLE_CLIENT_SECRET` in `.env` eintragen.
- `GOOGLE_CALLBACK_URL` kann leer bleiben, wenn `APP_BASE_URL` gesetzt ist.

Facebook:
- In Meta for Developers eine App erstellen.
- Facebook Login Produkt aktivieren.
- Als Redirect URL setzen: `https://heldenhaftereisen.net/auth/facebook/callback`
- Lokal zum Testen kannst du stattdessen `http://localhost:3000/auth/facebook/callback` verwenden.
- `APP_BASE_URL`, `FACEBOOK_APP_ID` und `FACEBOOK_APP_SECRET` in `.env` eintragen.
- `FACEBOOK_CALLBACK_URL` kann leer bleiben, wenn `APP_BASE_URL` gesetzt ist.

Hinweis:
- Wenn Client ID oder Secret fehlen, bleibt der jeweilige Login deaktiviert.

## Admin

- Der erste registrierte Account wird automatisch Admin.
- Admins sehen den Bereich unter `/admin`.
- Bestehenden Account nachtraeglich zum Admin machen:

```bash
npm run make-admin -- <username>
```

## Projektstruktur

- `src/index.js`: Express-App, Routen, Auth, Socket.IO
- `src/db.js`: SQLite-Setup und Tabellen
- `views/`: EJS-Templates
- `public/`: CSS + Chat-Client-Skript
- `data/`: SQLite-Datenbanken (`app.db`, `sessions.sqlite`)

## Hinweis

Das ist eine funktionsfaehige Basis fuer ein RP-Portal im Stil von Foren-/Charakterseiten mit Chat. Fuer produktiven Betrieb solltest du zusaetzlich Rate-Limits, CSRF-Schutz, Backups und ein Rollen-/Moderationssystem ergaenzen.


