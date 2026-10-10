import { useEffect, useRef, useState } from 'react';
import type { Item } from '../../types';
import { Icon } from '../Icon';
import { loadYandexMaps } from '../../maps/yandexMaps';
import { placeMapLinks, validCoordinates } from '../../maps/placeMapLinks';
import './placeMap.css';

export function PlaceMap({ item, desktop }: { item: Item; desktop: boolean }) {
  const container = useRef<HTMLDivElement>(null);
  const [attempt, setAttempt] = useState(0);
  const requested = attempt > 0;
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const coordinates = validCoordinates(item.coordinates) ? item.coordinates : undefined;
  const { mapsUrl, routeUrl } = placeMapLinks(item);
  const configured = !!import.meta.env.VITE_YANDEX_MAPS_API_KEY?.trim();
  useEffect(() => {
    if (!requested || !coordinates) return;
    let cancelled = false;
    let map: { destroy(): void } | undefined;
    void loadYandexMaps().then(api => {
      if (cancelled || !container.current) return;
      const point = [coordinates.lat, coordinates.lon];
      const instance = new api.Map(container.current, { center: point, zoom: 16, controls: ['zoomControl'] });
      map = instance;
      instance.geoObjects.add(new api.Placemark(point));
      setStatus('ready');
    }).catch(() => {
      if (cancelled) return;
      try { map?.destroy(); } catch { /* A failed map must not break the card. */ }
      map = undefined;
      setStatus('error');
    });
    return () => { cancelled = true; try { map?.destroy(); } catch { /* Safe teardown. */ } };
  }, [requested, attempt, coordinates]);
  if (!coordinates && !mapsUrl) return null;
  return <section className={`place-map-section ${desktop ? 'place-map-desktop' : ''}`} aria-label="Карта места">
    {coordinates && <h2>Место на карте</h2>}
    {coordinates && configured && <div className="place-map-frame">
      {requested && <div ref={container} className="place-map-canvas" role="region" aria-label={`Карта: ${item.title}`}/>}
      {status !== 'ready' && <div className="place-map-placeholder">{status === 'idle' ? <button onClick={() => { setStatus('loading'); setAttempt(value => value + 1); }}><Icon name="pin" size={20}/>Показать карту</button> : <div><p role="status">{status === 'error' ? 'Не удалось загрузить карту. Воспользуйтесь ссылкой на Яндекс Карты.' : 'Загружаем карту…'}</p>{status === 'error' && <button onClick={() => { setStatus('loading'); setAttempt(value => value + 1); }}>Повторить</button>}</div>}</div>}
    </div>}
    {coordinates && !configured && <p className="place-map-unavailable">Встроенная карта пока недоступна.</p>}
    <div className="place-map-links">{mapsUrl && <a href={mapsUrl} target="_blank" rel="noopener noreferrer">Открыть в Яндекс Картах</a>}{routeUrl && <a href={routeUrl} target="_blank" rel="noopener noreferrer">Маршрут</a>}</div>
  </section>;
}
