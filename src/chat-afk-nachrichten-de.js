const crypto = require("crypto");

const MIN_CHAT_AFK_NACHRICHTEN = 5000;

const CHAT_AFK_AUFTAKTE = Object.freeze([
  "ist kurz weg, um",
  "taucht kurz ab, um",
  "muss kurz raus, um",
  "ist eben fort, um",
  "verschwindet kurz, um",
  "macht Pause, um",
  "zieht kurz los, um",
  "tritt kurz ab, um",
  "flieht kurz, um",
  "schleicht raus, um",
  "ist im Off, um",
  "geht kurz, um",
  "pausiert, um",
  "duckt sich weg, um",
  "ist kurz stumm, um",
  "holt Luft, um",
  "nimmt Abstand, um",
  "ist kurz raus, um",
  "verzieht sich, um",
  "macht sich rar, um",
  "ist kurz abwesend, um",
  "bleibt kurz fern, um",
  "ist kurz still, um",
  "zieht sich weg, um",
  "muss kurz los, um"
]);

const CHAT_AFK_AUFGABEN = Object.freeze([
  "Tee zu retten",
  "Wasser zu holen",
  "Luft zu schnappen",
  "den Kopf zu resetten",
  "den Plot zu ordnen",
  "Drama zu löschen",
  "Chaos zu treten",
  "Böses zu planen",
  "Unheil zu sortieren",
  "finster zu grinsen",
  "harmlos zu wirken",
  "die Welt zu retten",
  "Realität zu ertragen",
  "kurz zu existieren",
  "den Fokus zu finden",
  "den Akku zu schonen",
  "die Tastatur zu retten",
  "Würfel zu suchen",
  "einen Plan zu schmieden",
  "Ruhe zu erzwingen",
  "Geduld zu heucheln",
  "den Alltag zu boxen",
  "die Nerven zu zählen",
  "kurz nicht zu fluchen",
  "sehr zu leiden",
  "professionell zu seufzen",
  "dumm zu gucken",
  "smart zu wirken",
  "den Kaffee zu ehren",
  "den Tee zu befragen",
  "ein Wunder zu versuchen",
  "die Lage zu verfluchen",
  "das Chaos zu segnen",
  "den Bildschirm anzustarren",
  "kurz offline zu sein",
  "das Leben zu verhandeln",
  "die Moral zu ignorieren",
  "den Frieden zu bedrohen",
  "eine Idee zu fangen",
  "einen Fehler zu jagen",
  "die Pause zu verdienen",
  "den Raum zu meiden",
  "kurz ernst zu sein",
  "kurz gemein zu sein",
  "nett zu scheitern",
  "leise zu triumphieren",
  "den Tag zu überleben",
  "das Timing zu hassen",
  "innerlich zu lachen",
  "kurz nicht da zu sein"
]);

const CHAT_AFK_ENDUNGEN = Object.freeze([
  "",
  ", gleich zurück",
  ", keine Panik",
  ", leider nötig",
  ", sehr dramatisch",
  ", wie man halt muss"
]);

function buildChatAfkNachrichten() {
  const nachrichten = new Set();

  CHAT_AFK_AUFTAKTE.forEach((auftakt) => {
    CHAT_AFK_AUFGABEN.forEach((aufgabe) => {
      CHAT_AFK_ENDUNGEN.forEach((endung) => {
        const nachricht = `${auftakt} ${aufgabe}${endung}`.replace(/\s+/g, " ").trim();
        if (nachricht) {
          nachrichten.add(nachricht);
        }
      });
    });
  });

  return Array.from(nachrichten);
}

const CHAT_AFK_NACHRICHTEN = Object.freeze(buildChatAfkNachrichten());

if (CHAT_AFK_NACHRICHTEN.length < MIN_CHAT_AFK_NACHRICHTEN) {
  throw new Error(
    `Zu wenige AFK-Nachrichten erzeugt: ${CHAT_AFK_NACHRICHTEN.length} statt mindestens ${MIN_CHAT_AFK_NACHRICHTEN}.`
  );
}

let verbleibendeChatAfkNachrichten = [];

function shuffleStrings(values) {
  const copy = values.slice();

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = crypto.randomInt(index + 1);
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
}

function getNaechsteAutomatischeAfkNachricht() {
  if (!CHAT_AFK_NACHRICHTEN.length) {
    return "kurz in einem mysteriösen Nebenplot verschwunden";
  }

  if (!verbleibendeChatAfkNachrichten.length) {
    verbleibendeChatAfkNachrichten = shuffleStrings(CHAT_AFK_NACHRICHTEN);
  }

  return verbleibendeChatAfkNachrichten.pop() || CHAT_AFK_NACHRICHTEN[0];
}

module.exports = {
  CHAT_AFK_NACHRICHTEN_ANZAHL: CHAT_AFK_NACHRICHTEN.length,
  getNaechsteAutomatischeAfkNachricht
};
