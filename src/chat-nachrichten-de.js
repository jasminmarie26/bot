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

const RAUM_EINTRITT_NACHRICHTEN = buildPresenceSuffixPool(
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

const RAUM_AUSTRITT_NACHRICHTEN = buildPresenceSuffixPool(
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

function buildRaumPraesenzNachricht(kind, displayName) {
  const safeName = String(displayName || "").trim() || "Jemand";
  const suffixes = kind === "leave" ? RAUM_AUSTRITT_NACHRICHTEN : RAUM_EINTRITT_NACHRICHTEN;
  const suffix = suffixes[Math.floor(Math.random() * suffixes.length)] || suffixes[0] || "ist da.";

  return {
    text: `${safeName} ${suffix}`.trim(),
    actorName: safeName,
    suffix,
    kind: kind === "leave" ? "leave" : "enter"
  };
}

module.exports = {
  buildRaumPraesenzNachricht,
  RAUM_EINTRITT_NACHRICHTEN,
  RAUM_AUSTRITT_NACHRICHTEN
};
