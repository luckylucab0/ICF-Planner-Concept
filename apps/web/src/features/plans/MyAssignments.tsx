import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';

interface MyAssignment {
  id: string;
  status: 'REQUESTED' | 'ACCEPTED' | 'DECLINED';
  eventTitle: string;
  startsAt: string;
  location?: string | null;
  position: string;
}

// "Meine Dienste" auf dem Dashboard: anstehende Einteilungen mit
// direkter Zusage/Absage (eingeloggt, ohne Mail-Link).
export default function MyAssignments() {
  const { t, i18n } = useTranslation();
  const [assignments, setAssignments] = useState<MyAssignment[]>([]);

  const reload = useCallback(() => {
    void api.get<MyAssignment[]>('/me/assignments').then(setAssignments);
  }, []);

  useEffect(reload, [reload]);

  async function respond(id: string, action: 'ACCEPTED' | 'DECLINED') {
    await api.post(`/me/assignments/${id}/respond`, { action });
    reload();
  }

  return (
    <section className="space-y-2">
      <h2 className="font-semibold">{t('assignments.myAssignments')}</h2>
      {assignments.length === 0 && (
        <p className="text-sm text-gray-500">{t('assignments.noneUpcoming')}</p>
      )}
      <ul className="space-y-2">
        {assignments.map((assignment) => (
          <li key={assignment.id} className="rounded-xl bg-white p-3 shadow">
            <p className="text-sm font-medium">
              {assignment.eventTitle} · {assignment.position}
            </p>
            <p className="text-xs text-gray-500">
              {new Date(assignment.startsAt).toLocaleString(i18n.language, {
                weekday: 'short',
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
            <div className="mt-2 flex items-center gap-2">
              {assignment.status !== 'ACCEPTED' && (
                <button
                  onClick={() => void respond(assignment.id, 'ACCEPTED')}
                  className="rounded bg-green-600 px-3 py-1 text-xs font-medium text-white"
                >
                  ✓ {t('assignments.accept')}
                </button>
              )}
              {assignment.status !== 'DECLINED' && (
                <button
                  onClick={() => void respond(assignment.id, 'DECLINED')}
                  className="rounded border border-red-300 px-3 py-1 text-xs font-medium text-red-600"
                >
                  ✕ {t('assignments.decline')}
                </button>
              )}
              <span className="ml-auto text-xs text-gray-500">
                {t(`assignments.${assignment.status.toLowerCase()}`)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
