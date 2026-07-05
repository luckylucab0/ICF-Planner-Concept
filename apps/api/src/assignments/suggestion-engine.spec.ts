import { CandidateFacts, scoreCandidates } from './suggestion-engine';

const eventDate = new Date('2026-07-20T10:00:00Z');

function candidate(overrides: Partial<CandidateFacts>): CandidateFacts {
  return {
    personId: 'p',
    name: 'Person',
    skillLevel: 'SOLID',
    lastServedAt: null,
    assignmentsLast90Days: 0,
    isUnavailable: false,
    alreadyAssignedSameEvent: false,
    assignedAdjacentDay: false,
    ...overrides,
  };
}

describe('scoreCandidates (Vorschlags-Engine)', () => {
  it('filtert nicht verfügbare Personen komplett heraus', () => {
    const result = scoreCandidates(
      [
        candidate({ personId: 'a', name: 'Anna' }),
        candidate({ personId: 'b', name: 'Ben', isUnavailable: true }),
      ],
      eventDate,
    );
    expect(result.map((s) => s.personId)).toEqual(['a']);
  });

  it('filtert bereits am selben Event eingeteilte Personen heraus', () => {
    const result = scoreCandidates(
      [candidate({ personId: 'a', alreadyAssignedSameEvent: true })],
      eventDate,
    );
    expect(result).toHaveLength(0);
  });

  it('bevorzugt, wer länger nicht dran war (faire Verteilung)', () => {
    const result = scoreCandidates(
      [
        candidate({
          personId: 'recent',
          name: 'Kürzlich',
          lastServedAt: new Date('2026-07-13T10:00:00Z'), // vor 7 Tagen
        }),
        candidate({
          personId: 'longAgo',
          name: 'Lange her',
          lastServedAt: new Date('2026-06-01T10:00:00Z'), // vor 49 Tagen
        }),
      ],
      eventDate,
    );
    expect(result[0].personId).toBe('longAgo');
    expect(result[0].daysSinceLastService).toBe(49);
  });

  it('wer noch nie dran war, steht ganz oben', () => {
    const result = scoreCandidates(
      [
        candidate({ personId: 'never', name: 'Neu', lastServedAt: null }),
        candidate({ personId: 'old', name: 'Alt', lastServedAt: new Date('2026-01-01') }),
      ],
      eventDate,
    );
    expect(result[0].personId).toBe('never');
    expect(result[0].daysSinceLastService).toBeNull();
  });

  it('viele Einsätze in 90 Tagen wiegen schwerer als wenige Tage Abstand', () => {
    const result = scoreCandidates(
      [
        candidate({
          personId: 'busy',
          name: 'Fleißig',
          lastServedAt: new Date('2026-06-20T10:00:00Z'), // 30 Tage
          assignmentsLast90Days: 5, // -75 Punkte
        }),
        candidate({
          personId: 'rested',
          name: 'Ausgeruht',
          lastServedAt: new Date('2026-06-28T10:00:00Z'), // 22 Tage
          assignmentsLast90Days: 0,
        }),
      ],
      eventDate,
    );
    expect(result[0].personId).toBe('rested');
  });

  it('Skill-Level bricht Gleichstände', () => {
    const result = scoreCandidates(
      [
        candidate({ personId: 'beginner', name: 'B', skillLevel: 'BEGINNER' }),
        candidate({ personId: 'expert', name: 'E', skillLevel: 'EXPERT' }),
      ],
      eventDate,
    );
    expect(result[0].personId).toBe('expert');
  });

  it('Einsatz am Vortag ist Warnung, kein Ausschluss', () => {
    const result = scoreCandidates(
      [candidate({ personId: 'a', assignedAdjacentDay: true })],
      eventDate,
    );
    expect(result).toHaveLength(1);
    expect(result[0].warnings).toContain('assignedAdjacentDay');
  });
});
