import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../../api/client';

interface RespondInfo {
  firstName: string;
  eventTitle: string;
  startsAt: string;
  location?: string | null;
  position: string;
  status: 'REQUESTED' | 'ACCEPTED' | 'DECLINED';
}

// Öffentliche Zusage/Absage-Seite: erreichbar über den Token-Link aus
// der Einteilungs-Mail, ohne Login. Zeigt bewusst nur Vorname + Termin
// (siehe Threat Model). Die Aktion ist ein expliziter POST-Klick –
// kein GET-Side-Effect, damit Mail-Scanner nichts auslösen.
export default function RespondPage() {
  const { t, i18n } = useTranslation();
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const intent = searchParams.get('action'); // preselektiert den Button
  const [info, setInfo] = useState<RespondInfo | null>(null);
  const [result, setResult] = useState<'ACCEPTED' | 'DECLINED' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [showReason, setShowReason] = useState(false);

  useEffect(() => {
    if (!token) return;
    api
      .get<RespondInfo>(`/respond/${token}`)
      .then(setInfo)
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 410) {
          const message = (err.body as { message?: string })?.message;
          setError(
            message === 'respond.expired' ? t('respond.expired') : t('respond.alreadyAnswered'),
          );
        } else {
          setError(t('respond.invalid'));
        }
      });
  }, [token, t]);

  async function respond(action: 'accept' | 'decline') {
    try {
      await api.post(`/respond/${token}/${action}`, action === 'decline' ? { reason } : undefined);
      setResult(action === 'accept' ? 'ACCEPTED' : 'DECLINED');
    } catch {
      setError(t('respond.alreadyAnswered'));
    }
  }

  const card = 'w-full max-w-md rounded-xl bg-white p-6 shadow text-center space-y-4';

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className={card}>
          <p className="text-gray-700">{error}</p>
        </div>
      </main>
    );
  }

  if (result) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className={card}>
          <p className="text-lg">
            {result === 'ACCEPTED' ? t('respond.accepted') : t('respond.declined')}
          </p>
        </div>
      </main>
    );
  }

  if (!info) {
    return <p className="p-4 text-gray-500">{t('common.loading')}</p>;
  }

  const date = new Date(info.startsAt).toLocaleString(i18n.language, {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className={card}>
        <h1 className="text-xl font-bold">{t('respond.heading', { firstName: info.firstName })}</h1>
        <p className="text-gray-700">
          {t('respond.question', {
            date,
            position: info.position,
            eventTitle: info.eventTitle,
          })}
        </p>
        {info.location && <p className="text-sm text-gray-500">📍 {info.location}</p>}

        <div className="flex flex-col gap-2">
          <button
            onClick={() => void respond('accept')}
            className={`rounded-lg p-3 font-medium text-white ${
              intent === 'decline' ? 'bg-green-500' : 'bg-green-600'
            }`}
          >
            ✓ {t('assignments.accept')}
          </button>
          {!showReason ? (
            <button
              onClick={() => setShowReason(true)}
              className="rounded-lg border border-red-300 p-3 font-medium text-red-600"
            >
              ✕ {t('assignments.decline')}
            </button>
          ) : (
            <div className="space-y-2">
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t('assignments.declineReason')}
                className="w-full rounded-lg border border-gray-300 p-2"
              />
              <button
                onClick={() => void respond('decline')}
                className="w-full rounded-lg bg-red-600 p-3 font-medium text-white"
              >
                ✕ {t('assignments.decline')}
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
