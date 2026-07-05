// ============================================================
// Vorschlags-Engine für die Diensteinteilung
// ============================================================
//
// Ziel: faire Verteilung der Dienste. Wer lange nicht dran war und in
// letzter Zeit wenig eingeteilt wurde, steht oben; Skill-Level bricht
// Gleichstände. Nicht verfügbare Personen fliegen ganz raus.
//
// Bewusst eine PURE Funktion ohne DB-Zugriff: der AssignmentsService
// sammelt die Fakten (Batch-Queries), die Engine sortiert. Dadurch ist
// die komplette Logik mit einfachen Unit-Tests abgedeckt.
//
// Beispiel:
//   Termin am 20.07. Kandidaten für "Gitarre":
//   - Anna:  zuletzt 01.06. (49 Tage), 1 Einsatz/90d, EXPERT  → Score hoch
//   - Ben:   zuletzt 13.07. (7 Tage),  4 Einsätze/90d, EXPERT → Score niedrig
//   - Clara: in den Ferien                                     → gefiltert
//   → Vorschlag: [Anna, Ben]; hat Ben am Vortag schon einen Dienst,
//     bekommt er zusätzlich die Warnung 'assignedAdjacentDay'.

export interface CandidateFacts {
  personId: string;
  name: string;
  skillLevel: 'BEGINNER' | 'SOLID' | 'EXPERT';
  // Letzter nicht abgesagter Einsatz vor dem Termin (null = noch nie)
  lastServedAt: Date | null;
  // Anzahl Einsätze in den 90 Tagen vor dem Termin
  assignmentsLast90Days: number;
  // Abwesend oder wiederkehrend nicht verfügbar am Termin
  isUnavailable: boolean;
  // Bereits in diesem Event eingeteilt (egal welche Position)
  alreadyAssignedSameEvent: boolean;
  // Einsatz am Vor- oder Folgetag (weiches Kriterium → nur Warnung)
  assignedAdjacentDay: boolean;
}

export interface Suggestion {
  personId: string;
  name: string;
  skillLevel: CandidateFacts['skillLevel'];
  score: number;
  daysSinceLastService: number | null;
  assignmentsLast90Days: number;
  warnings: string[];
}

const SKILL_BONUS: Record<CandidateFacts['skillLevel'], number> = {
  EXPERT: 2,
  SOLID: 1,
  BEGINNER: 0,
};

// Tage seit letztem Einsatz dominieren (Faktor 1 pro Tag, Deckel 365),
// jeder Einsatz der letzten 90 Tage kostet 15 Punkte – so wiegt "oft
// dran gewesen" schwerer als ein paar Tage Unterschied. Skill ist nur
// Tiebreaker.
export function scoreCandidates(candidates: CandidateFacts[], eventDate: Date): Suggestion[] {
  return candidates
    .filter((candidate) => !candidate.isUnavailable && !candidate.alreadyAssignedSameEvent)
    .map((candidate) => {
      const daysSince = candidate.lastServedAt
        ? Math.floor((eventDate.getTime() - candidate.lastServedAt.getTime()) / 86_400_000)
        : null;
      const score =
        Math.min(daysSince ?? 365, 365) -
        candidate.assignmentsLast90Days * 15 +
        SKILL_BONUS[candidate.skillLevel];

      const warnings: string[] = [];
      if (candidate.assignedAdjacentDay) warnings.push('assignedAdjacentDay');

      return {
        personId: candidate.personId,
        name: candidate.name,
        skillLevel: candidate.skillLevel,
        score,
        daysSinceLastService: daysSince,
        assignmentsLast90Days: candidate.assignmentsLast90Days,
        warnings,
      };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        // deterministische Reihenfolge bei Punktgleichheit
        a.name.localeCompare(b.name),
    );
}
