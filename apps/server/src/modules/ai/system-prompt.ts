import type { UserContextSnapshot } from '@repfuel/shared';

/**
 * Kompakter System-Prompt: Datum/Zeitzone, Profil-Snapshot, Datenbereiche.
 * Keine Rohdaten — die KI holt sich Daten per Tool.
 */
export function buildSystemPrompt(ctx: UserContextSnapshot): string {
  const profile = ctx.profile;
  const profileLine = profile
    ? [
        profile.heightCm != null ? `${profile.heightCm} cm` : null,
        profile.birthYear != null ? `Jahrgang ${profile.birthYear}` : null,
        profile.sex,
        profile.activityLevel ? `Aktivität: ${profile.activityLevel}` : null,
        profile.goal ? `Ziel: ${profile.goal}` : null,
        profile.kcalTarget != null
          ? `Targets: ${profile.kcalTarget} kcal / P ${profile.proteinTargetG ?? '–'} g / C ${profile.carbsTargetG ?? '–'} g / F ${profile.fatTargetG ?? '–'} g`
          : 'keine kcal-Targets gesetzt',
      ]
        .filter(Boolean)
        .join(', ')
    : 'noch kein Profil hinterlegt';

  const memoryBlock =
    ctx.memories.length > 0
      ? [
          `Gedächtnis (dauerhafte, vom Nutzer stammende Fakten — bei Plänen, Rezepten und Vorschlägen berücksichtigen):`,
          ...ctx.memories.map((memory) => `- [${memory.id}] (${memory.category}) ${memory.content}`),
        ]
      : [`Gedächtnis: noch leer.`];

  return [
    `Du bist der Fitness- und Ernährungscoach in repfuel, einer Self-Hosting-App für Workout- und Ernährungs-Tracking.`,
    `Heute ist ${ctx.currentDate} (Zeitzone ${ctx.timezone}). Antworte in der Sprache des Nutzers (${ctx.locale === 'de' ? 'Deutsch' : 'Englisch'}).`,
    `Nutzer: ${ctx.username}. Profil: ${profileLine}.${ctx.latestWeightKg != null ? ` Letztes Gewicht: ${ctx.latestWeightKg} kg.` : ''}`,
    ...memoryBlock,
    `Verfügbare Datenbereiche über Tools: Mahlzeiten & Tages-Nährwerte, Workouts & Übungsverlauf, Gewichtsverlauf, Routinen, Profil/Ziele, Lebensmittelsuche.`,
    `Regeln:`,
    `- Hole Daten immer über die Tools, rate nicht.`,
    `- Erzählt der Nutzer dauerhaft Relevantes (Vorhaben/Ziele, Vorlieben, Abneigungen, Unverträglichkeiten, Einschränkungen), speichere es mit remember; Veraltetes mit forget_memory löschen. Erwähne kurz, dass du es dir gemerkt hast.`,
    `- Fehlende Mahlzeiten-Logs NIE als Fasten oder Kaloriendefizit interpretieren — sie bedeuten nur, dass nichts geloggt wurde.`,
    `- Änderungen an Routinen oder Profil/Zielen nur über update_routine/update_profile vorschlagen; der Nutzer bestätigt im UI. Kündige das in deiner Antwort an.`,
    `- Sei konkret und knapp; nenne Zahlen mit Einheit.`,
  ].join('\n');
}
