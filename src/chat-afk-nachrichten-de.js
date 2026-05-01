const crypto = require("crypto");

const CHAT_AFK_NACHRICHTEN = Object.freeze([
  "Ist kurz weg, Respawn läuft",
  "Hat das Spiel kurz verlassen",
  "Ist kurz verschwunden, Snack-Quest aktiv",
  "Lädt gerade neu",
  "Ist kurz raus, Ping im echten Leben",
  "Hat AFK... äh Pause aktiviert",
  "Ist kurz off, kommt gleich wieder",
  "Regeneriert gerade HP",
  "Ist auf einer Real-Life Sidequest",
  "Hat kurz das Menü geöffnet",
  "Ist kurz weg, Inventory wird geplündert (Kühlschrank)",
  "Hat kurz Disconnect im echten Leben",
  "Ist gerade nicht am Controller",
  "Hat den Fokus verloren, sucht ihn wieder",
  "Ist kurz raus, Energie wird nachgeladen",
  "Befindet sich im Ladebildschirm",
  "Hat kurz Pause gedrückt",
  "Ist temporär nicht steuerbar",
  "Hat das Spiel minimiert",
  "Ist kurz nicht im Match",
  "Ist kurz weg, Sofa hat gewonnen",
  "Wurde kurz vom echten Leben abgeholt",
  "Ist verschwunden, Motivation wird gesucht",
  "Hat sich kurz verabschiedet (freiwillig?)",
  "Ist kurz raus, Chaos bleibt bestehen",
  "Hat kurz den Kopf neu gestartet",
  "Ist nicht da, kommt aber wieder",
  "Wurde kurz von Snacks entführt",
  "Ist kurz nicht verfügbar, bitte warten",
  "Hat sich kurz aus der Realität entfernt",
  "Ist kurz weg, nichts eskaliert hoffentlich",
  "Hat den Überblick abgegeben",
  "Ist verschwunden, Verantwortung auch",
  "Ist kurz raus, viel Glück allen Beteiligten",
  "Hat sich entfernt, Probleme bleiben",
  "Ist nicht da, aber das merkt man eh",
  "Hat kurz aufgegeben, kommt gleich zurück",
  "Ist weg, das endet bestimmt gut",
  "Hat sich kurz verdrückt",
  "Ist kurz nicht da, das wird schon schiefgehen",
  "Ist kurz weg",
  "Kommt gleich wieder",
  "Ist kurz nicht da",
  "Hat Pause",
  "Ist eben raus",
  "Kommt gleich zurück",
  "Ist kurz verschwunden",
  "Ist nicht verfügbar",
  "Macht kurz Pause",
  "Ist gleich wieder da",
  "Ist kurz weg, Respawn wird vorbereitet",
  "Hat das System kurz verlassen",
  "Lädt gerade neu, bitte warten",
  "Ist auf einer Nebenquest im echten Leben",
  "Hat kurz Pause gedrückt",
  "Ist temporär nicht verfügbar",
  "Befindet sich im Ladebildschirm",
  "Hat das Spiel minimiert",
  "Ist kurz außerhalb der Map",
  "Wird gleich wieder gespawnt",
  "Wurde kurz vom echten Leben abgeholt",
  "Ist verschwunden, Snacks werden beschafft",
  "Hat sich kurz selbst pausiert",
  "Ist gerade nicht auffindbar",
  "Wurde kurz entführt (vom Alltag)",
  "Hat kurz den Kopf ausgeschaltet",
  "Ist kurz weg, Chaos bleibt bestehen",
  "Hat sich diskret entfernt",
  "Ist kurz nicht im System auffindbar",
  "Wurde temporär deaktiviert",
  "Ist kurz weg, alles bleibt wie es ist (hoffentlich)",
  "Hat die Verantwortung kurz abgegeben",
  "Ist verschwunden, Probleme bleiben bestehen",
  "Wurde kurz aus dem Betrieb genommen",
  "Ist nicht da, das merkt man vermutlich",
  "Hat sich kurz entzogen",
  "Ist außer Betrieb, Ursache unbekannt",
  "Hat sich für einen Moment verabschiedet",
  "Ist aktuell nicht verfügbar, Geduld optional",
  "Wurde kurz aus dem Verkehr gezogen",
  "Status: kurzzeitig nicht verfügbar",
  "Hinweis: Rückkehr in Kürze geplant",
  "Meldung: Benutzer nicht am Platz",
  "Systeminfo: Pause aktiv",
  "Update: Abwesenheit erkannt",
  "Hinweis: Aktivität pausiert",
  "Statusmeldung: kurz offline",
  "System: Benutzer reagiert gerade nicht",
  "Info: temporär abgemeldet",
  "Hinweis: Rückkehr wahrscheinlich",
  "Status: abwesend",
  "Pause aktiv",
  "Kurz nicht da",
  "Rückkehr folgt",
  "Offline (kurz)",
  "Nicht verfügbar",
  "Kurz verschwunden",
  "Pause läuft",
  "Gleich zurück",
  "Aktivität pausiert"
]);

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
    return "Kurz nicht da";
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
