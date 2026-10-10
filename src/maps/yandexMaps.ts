interface YandexMap { geoObjects: { add(marker: unknown): void }; destroy(): void }
interface YandexMapsApi {
  ready(callback: () => void): void;
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
  apiPromise = new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error('Maps unavailable')), 20000);
    const failed = () => { clearTimeout(timeout); reject(new Error('Maps unavailable')); };
    const ready = () => {
      try {
        const api = window.ymaps;
        if (!api) { failed(); return; }
        api.ready(() => { clearTimeout(timeout); resolve(api); });
      } catch { failed(); }
    };
    if (window.ymaps) { ready(); return; }
    const script = document.createElement('script');
    script.id = 'ryadom-yandex-maps';
    script.async = true;
    const source = new URL('https://api-maps.yandex.ru/2.1/');
    source.searchParams.set('apikey', key);
    source.searchParams.set('lang', 'ru_RU');
    script.src = source.href;
    script.onload = ready;
    script.onerror = failed;
    document.head.append(script);
  });
  return apiPromise;
}
