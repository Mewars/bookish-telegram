import { useEffect, useRef } from 'react';
import { Icon } from '../components/Icon';
import { useMusic } from './useMusic';
import './music.css';

export function MusicButton() {
  const music = useMusic();
  return <button className="music-launch" onClick={music.openPlayer} aria-label="Открыть Музыку рядом" aria-controls="music-player" aria-expanded={music.isOpen}><Icon name="music" size={18}/><span>Музыка рядом</span>{music.isPlaying && <span className="music-live" aria-hidden="true"/>}</button>;
}
export function MusicPlayer() {
  const music = useMusic();
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!music.isOpen || !ref.current) return;
    const element = ref.current;
    const measure = () => document.documentElement.style.setProperty('--music-player-height', `${element.getBoundingClientRect().height + 20}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => { observer.disconnect(); document.documentElement.style.removeProperty('--music-player-height'); };
  }, [music.isOpen]);
  if (!music.isOpen) return null;
  const active = music.status === 'loading' || music.isPlaying;
  return <section ref={ref} id="music-player" className={`music-player ${music.isExpanded ? 'is-expanded' : ''}`} aria-label="Музыка рядом">
    <button className="music-info" onClick={music.toggleExpanded} aria-label={music.isExpanded ? 'Свернуть настройки музыки' : 'Раскрыть настройки музыки'} aria-expanded={music.isExpanded} aria-controls="music-settings"><span className="music-symbol"><Icon name="music"/></span><span><strong>Музыка рядом</strong><small>Эфир: {music.stationName}</small></span></button>
    <button className="music-play" onClick={music.toggle} aria-label={active ? 'Приостановить Музыку рядом' : 'Включить Музыку рядом'}><Icon name={active ? 'pause' : 'play'}/></button>
    <div className="music-settings" id="music-settings"><button onClick={music.toggleMute} aria-label={music.isMuted ? 'Включить звук' : 'Отключить звук'} aria-pressed={music.isMuted}><Icon name={music.isMuted ? 'muted' : 'volume'}/></button><label className="music-volume">Громкость<input type="range" min="0" max="100" value={Math.round(music.volume * 100)} aria-label="Громкость музыки" aria-valuetext={`${Math.round(music.volume * 100)}%`} onChange={event => music.setVolume(Number(event.target.value) / 100)}/></label><span className="music-percent">{Math.round(music.volume * 100)}%</span></div>
    <button className="music-close" onClick={music.closePlayer} aria-label="Скрыть плеер, сохранив воспроизведение"><Icon name="close" size={18}/></button>
    <div className="music-status" role="status" aria-live="polite">{music.status === 'loading' ? 'Подключаем эфир…' : music.error ? <>{music.error} <button onClick={() => void music.play()}>Повторить</button></> : music.isPlaying ? 'В прямом эфире' : 'Нажмите Play, чтобы включить эфир'}</div>
  </section>;
}
