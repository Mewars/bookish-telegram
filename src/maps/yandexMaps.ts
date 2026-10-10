interface YandexMap { geoObjects: { add(marker: unknown): void }; destroy(): void }
interface YandexMapsApi {
  ready(callback: () => void, errorCallback?: () => void): void;
  Map: new (container: HTMLElement, state: { center: number[]; zoom: number; controls: string[] }) => YandexMap;
  Placemark: new (coordinates: number[]) => unknown;
}
declare global { interface Window { ymaps?: YandexMapsApi } }
let apiPromise: Promise<YandexMapsApi> | undefined;

// Called only after the user explicitly asks to show a map. Shared by all cards.
export function loadYandexMaps(): Promise<YandexMapsApi> {
  const key = import.meta.env.VITE_YANDEX_MAPS_API_KEY?.trim();
  if (!key) return Promise.reject(new Error('Maps unavailable'));
  if (apiPromise) return apiPromise;
  // Defer setup so even synchronous setup/ready failures cannot leave a cached rejection.
  const attempt = Promise.resolve().then(() => new Promise<YandexMapsApi>((resolve, reject) => {
    let script: HTMLScriptElement | undefined;
    let created = false;
    let settled = false;
    let waitingReady = false;
    const timeout = window.setTimeout(() => failed(), 20000);
    const cleanup = () => {
      clearTimeout(timeout);
      script?.removeEventListener('load', ready);
      script?.removeEventListener('error', failed);
    };
    const failed = () => {
      if (settled) return;
      settled = true;
      cleanup();
      if (created) script?.remove();
      reject(new Error('Maps unavailable'));
    };
    const ready = () => {
      if (settled || waitingReady) return;
      try {
        const api = window.ymaps;
        if (!api) { failed(); return; }
        waitingReady = true;
        api.ready(() => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve(api);
        }, failed);
      } catch { failed(); }
    };
    try {
      if (window.ymaps) { ready(); return; }
      const existing = document.getElementById('ryadom-yandex-maps');
      if (existing) {
        if (!(existing instanceof HTMLScriptElement)) { failed(); return; }
        script = existing;
      } else {
        script = document.createElement('script');
        created = true;
        script.id = 'ryadom-yandex-maps';
        script.async = true;
        const source = new URL('https://api-maps.yandex.ru/2.1/');
        source.searchParams.set('apikey', key);
        source.searchParams.set('lang', 'ru_RU');
        script.src = source.href;
      }
      script.addEventListener('load', ready);
      script.addEventListener('error', failed);
      if (created) document.head.append(script);
    } catch { failed(); }
  }));
  apiPromise = attempt;
  void attempt.catch(() => { if (apiPromise === attempt) apiPromise = undefined; });
  return attempt;
}
