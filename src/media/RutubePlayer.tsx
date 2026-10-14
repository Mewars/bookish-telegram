import { useState } from 'react';
import { parseRutubeVideo } from './rutube';
import './rutube.css';

// The iframe is mounted only after the visitor chooses to load external media.
// URL is always derived from a validated video ID; never render raw embed HTML.
export function RutubePlayer({ url, title = 'Видео на RUTUBE', show = true }: {
  url: string;
  title?: string;
  show?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  const video = parseRutubeVideo(url);
  if (!show || !video) return null;
  return <section className="ryadom-rutube" aria-label={title}>
    {loaded
      ? <iframe src={video.embedUrl} title={title} loading="lazy" allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen referrerPolicy="strict-origin-when-cross-origin"/>
      : <div className="ryadom-rutube-placeholder">
          <span>{title}</span>
          <button type="button" onClick={() => setLoaded(true)}>Смотреть видео на странице</button>
        </div>}
    <a href={video.watchUrl} target="_blank" rel="noopener noreferrer">Открыть на RUTUBE ↗</a>
  </section>;
}
