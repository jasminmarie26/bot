const crypto = require("crypto");

const MIN_CHAT_AFK_NACHRICHTEN = 5000;

const CHAT_AFK_AUFTAKTE = Object.freeze([
  "ist kurz weg, um",
  "nimmt sich einen Moment, um",
  "ist für einen Augenblick verschwunden, um",
  "hat sich eben verabschiedet, um",
  "ist gerade unterwegs, um",
  "braucht kurz Zeit, um",
  "ist für einen Moment abgetaucht, um",
  "hat sich rasch davongemacht, um",
  "ist kurz aus dem Bild, um",
  "hat eben eine kleine Pause eingelegt, um",
  "ist kurz im Nebenplot verschwunden, um",
  "hat sich einen Augenblick freigenommen, um",
  "ist gerade auf leisen Sohlen unterwegs, um",
  "hat sich kurz zurückgezogen, um",
  "ist eben losgezogen, um",
  "ist für einen kleinen Abstecher verschwunden, um",
  "hat sich kurz aus dem Staub gemacht, um",
  "ist gerade in einer Zwischenquest, um",
  "hat sich rasch ausgeklinkt, um",
  "hat für einen Moment pausiert, um",
  "ist kurz zur Seite getreten, um",
  "hat sich für einen Augenblick abgemeldet, um",
  "ist eben auf einer kleinen Nebenmission, um",
  "braucht einen kurzen Augenblick, um",
  "ist für einen Moment außer Reichweite, um"
]);

const CHAT_AFK_AUFGABEN = Object.freeze([
  "einen verirrten Würfel einzusammeln",
  "eine überforderte Teetasse zu retten",
  "den störrischen Umhang zu bändigen",
  "das Sockenmysterium zu lösen",
  "eine verlegte Notiz wiederzufinden",
  "den Plot kurz zu sortieren",
  "den Kopf einmal durchzulüften",
  "einen beleidigten Stift wieder zum Schreiben zu überreden",
  "den Wasserkocher von heldenhaften Alleingängen abzuhalten",
  "eine rebellische Haarsträhne zu besänftigen",
  "eine zu neugierige Katze von der Tastatur wegzulocken",
  "den Würfelbeutel aus einem Paralleluniversum zurückzuholen",
  "die Konzentration wieder einzusammeln",
  "die To-do-Liste zu besänftigen",
  "ein kleines Alltagschaos aufzulösen",
  "einen widerspenstigen Reißverschluss zu bezwingen",
  "eine verirrte Tasse sicher an den Tisch zu bringen",
  "die Zimmerpflanze vor dramatischen Entscheidungen zu bewahren",
  "eine eskalierende Küchenszene zu beruhigen",
  "den inneren Dramabalken neu zu kalibrieren",
  "einer Brieftaube gedanklich den Weg zu erklären",
  "ein beleidigtes Schwert zu besänftigen",
  "die letzte Socke aus ihrem Versteck zu locken",
  "eine Pause mit Würde zu organisieren",
  "den Schreibtisch wieder mit der Realität zu versöhnen",
  "die Gedanken einmal sauber zu ordnen",
  "eine spontane Nebenquest abzuschließen",
  "den Tee rechtzeitig vor dem Kaltwerden zu retten",
  "ein verheddertes Kabel zu entwirren",
  "die Laune eines müden Löffels zu verbessern",
  "einen verlorenen Faden wieder aufzunehmen",
  "den Alltag kurz in geordnete Bahnen zu lenken",
  "eine störrische Decke neu zu sortieren",
  "dem Tag etwas Struktur zu verleihen",
  "einen übermotivierten Timer zum Schweigen zu bringen",
  "eine angefangene Aufgabe sauber zu Ende zu bringen",
  "den Fokus wieder an den richtigen Platz zu setzen",
  "eine flüchtige Idee schnell festzuhalten",
  "den Mondkalender mit dem echten Datum zu versöhnen",
  "den Raum kurz gegen das Chaos zu verteidigen",
  "eine zu laute Pfanne zu beschwichtigen",
  "die nächste Tasse sicher ans Ziel zu bringen",
  "einen ungeduldigen Gedanken zu Ende zu denken",
  "die Wirklichkeit kurz neu zu sortieren",
  "einen wichtigen Handgriff noch schnell zu erledigen",
  "eine verpeilte Minute wieder einzufangen",
  "den Flur mit würdevoller Entschlossenheit zu durchqueren",
  "einen kleinen Realitätscheck einzulegen",
  "eine heimliche Krümelkrise zu beenden",
  "die Ruhe im Hintergrund wiederherzustellen"
]);

const CHAT_AFK_ENDUNGEN = Object.freeze([
  "",
  ", bevor das nächste Chaos anklopft",
  ", ehe der nächste Handgriff wartet",
  ", damit später wieder alles rundläuft",
  ", bevor der Alltag wieder dazwischenfunkt",
  ", damit gleich wieder Ruhe einkehrt"
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
