import { useState } from 'react';
import type { Item } from '../../types';
import { Icon } from '../Icon';
import { openStreetMapUrls } from '../../maps/openStreetMapUrls';
import { placeMapLinks } from '../../maps/placeMapLinks';
import './placeMap.css';

export function PlaceMap({ item, desktop }: { item: Item; desktop: boolean }) {
  const [showMap, setShowMap] = useState(false);
  const osm = openStreetMapUrls(item.coordinates);
  // Opening links remain ordinary public map links, not paid API calls.
  const { mapsUrl } = placeMapLinks(item);

  if (!osm && !mapsUrl) return null;

  return (
    <section className={`place-map-section ${desktop ? 'place-map-desktop' : ''}`} aria-label="Карта места">
      {osm && (
        <>
          <h2>Место на карте</h2>
          <div className="place-map-frame">
            {showMap ? (
              <iframe
                className="place-map-canvas"
                title={`OpenStreetMap: ${item.title}`}
                src={osm.embedUrl}
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
              />
            ) : (
              <div className="place-map-placeholder">
                <button type="button" onClick={() => setShowMap(true)}>
                  <Icon name="pin" size={20} /> Показать карту
                </button>
              </div>
            )}
          </div>
          <div className="place-map-credit">
            Данные карты: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© участники OpenStreetMap</a>
          </div>
        </>
      )}
      <div className="place-map-links">
        {osm && <a href={osm.pageUrl} target="_blank" rel="noopener noreferrer">Открыть в OpenStreetMap</a>}
        {mapsUrl && <a href={mapsUrl} target="_blank" rel="noopener noreferrer">Открыть в Яндекс Картах</a>}
      </div>
    </section>
  );
}
