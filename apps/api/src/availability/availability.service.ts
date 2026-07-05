import { Injectable } from '@nestjs/common';
import { RRule } from 'rrule';
import { PrismaService } from '../prisma/prisma.service';

// Verfügbarkeitsprüfung für die Einteilung: kombiniert einmalige
// Abwesenheiten (Ferien) und wiederkehrende Nichtverfügbarkeit
// (RRULE, z. B. "jeden 1. Sonntag im Monat nicht").
// Batch-API, weil die Vorschlags-Engine viele Personen auf einmal prüft.
@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async getUnavailablePersonIds(personIds: string[], date: Date): Promise<Set<string>> {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const unavailable = new Set<string>();

    // Einmalige Abwesenheiten: Datumsbereich überlappt den Tag
    const absences = await this.prisma.absence.findMany({
      where: {
        personId: { in: personIds },
        fromDate: { lte: dayEnd },
        toDate: { gte: dayStart },
      },
      select: { personId: true },
    });
    for (const absence of absences) unavailable.add(absence.personId);

    // Wiederkehrende Regeln: trifft eine Occurrence auf den Tag?
    const recurring = await this.prisma.recurringUnavailability.findMany({
      where: { personId: { in: personIds } },
      select: { personId: true, rrule: true },
    });
    for (const rule of recurring) {
      if (unavailable.has(rule.personId)) continue;
      try {
        const parsed = RRule.fromString(rule.rrule);
        // dtstart weit genug in der Vergangenheit, damit BYDAY-Muster
        // wie "1SU" unabhängig vom Anlagedatum korrekt auswerten
        const withStart = new RRule({
          ...parsed.origOptions,
          dtstart: new Date(dayStart.getTime() - 366 * 86_400_000),
        });
        if (withStart.between(dayStart, dayEnd, true).length > 0) {
          unavailable.add(rule.personId);
        }
      } catch {
        // Kaputte RRULE blockiert niemanden – sie wird bei der Eingabe
        // validiert (Modul 7), hier nur defensive Absicherung
      }
    }

    return unavailable;
  }

  async isUnavailable(personId: string, date: Date): Promise<boolean> {
    const set = await this.getUnavailablePersonIds([personId], date);
    return set.has(personId);
  }
}
