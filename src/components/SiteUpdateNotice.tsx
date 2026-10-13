import { useEffect, useState } from 'react';
import './siteUpdateNotice.css';

const VERSION_ENDPOINT = `${import.meta.env.BASE_URL}version.json`;
const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8000;

function currentBuildVersion(): string | null {
  return document.querySelector('meta[name="ryadom-build-version"]')?.getAttribute('content') ?? null;
}

export function SiteUpdateNotice() {
  const [availableVersion, setAvailableVersion] = useState<string | null>(null);
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null);

  useEffect(() => {
    const currentVersion = currentBuildVersion();
    if (!currentVersion) return;

    let active = true;
    let inFlight = false;

    const check = async () => {
      if (!active || inFlight || document.visibilityState === 'hidden') return;
      inFlight = true;
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      try {
        const response = await fetch(`${VERSION_ENDPOINT}?t=${Date.now()}`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) return;
        const data: unknown = await response.json();
        if (typeof data !== 'object' || data === null || !('version' in data)) return;
        const version = data.version;
        if (typeof version !== 'string' || !/^[\w.-]{6,80}$/.test(version)) return;
        if (active && version !== currentVersion) setAvailableVersion(version);
      } catch {
        // Network outages must never interrupt the visitor's current session.
      } finally {
        window.clearTimeout(timeoutId);
        inFlight = false;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void check();
    };
    const onFocus = () => { void check(); };
    const timer = window.setInterval(() => { void check(); }, CHECK_INTERVAL_MS);
    window.addEventListener('focus', onFocus);
    window.addEventListener('pageshow', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    void check();

    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('pageshow', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  if (!availableVersion || availableVersion === dismissedVersion) return null;

  const loadNewestRelease = () => {
    // Query-busting refresh works even if nginx skips Apache .htaccess cache headers.
    const target = new URL(window.location.href);
    target.searchParams.set('ryadom_release', availableVersion);
    window.location.replace(target.toString());
  };

  return (
    <aside className="site-update-notice" role="status" aria-label="Доступно обновление сайта">
      <div className="site-update-notice__text">
        <strong>«Рядом» обновился</strong>
        <span>Есть свежая версия сайта.</span>
      </div>
      <button className="site-update-notice__refresh" type="button" onClick={loadNewestRelease}>
        Обновить
      </button>
      <button className="site-update-notice__dismiss" type="button" aria-label="Напомнить позже" onClick={() => setDismissedVersion(availableVersion)}>
        Позже
      </button>
    </aside>
  );
}
