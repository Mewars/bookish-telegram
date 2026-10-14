import { useEffect, useId, useRef, useState } from 'react';
import type { Item, Kind, Section } from '../types';
import { Icon } from './Icon';
import { Card, type CardActions } from './Card';

type Props = CardActions & {
  title: string; subtitle: string; index: string; kind: Kind;
  items: Item[]; navigate: (section: Section) => void; featured?: boolean;
};

export function HomeCarousel({ title, subtitle, index, kind, items, navigate, featured = false, ...actions }: Props) {
  const id = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const [limits, setLimits] = useState({ start: true, end: true });
  const itemKeys = items.map(item => item.id).join('|');
  const updateLimits = () => {
    const node = listRef.current;
    if (!node) return;
    setLimits({
      start: node.scrollLeft <= 3,
      end: node.scrollLeft + node.clientWidth >= node.scrollWidth - 3,
    });
  };

  useEffect(() => {
    const node = listRef.current;
    if (!node) return;
    const sync = () => updateLimits();
    node.scrollLeft = 0;
    sync();
    node.addEventListener('scroll', sync, { passive: true });
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(sync) : null;
    observer?.observe(node);
    window.addEventListener('resize', sync);
    return () => { node.removeEventListener('scroll', sync); observer?.disconnect(); window.removeEventListener('resize', sync); };
  }, [itemKeys]);

  const move = (direction: -1 | 1) => {
    const node = listRef.current;
    if (!node) return;
    const sample = node.querySelector<HTMLElement>('.card');
    const gap = parseFloat(getComputedStyle(node).columnGap) || 0;
    const step = sample ? sample.getBoundingClientRect().width + gap : node.clientWidth;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      document.documentElement.dataset.a11yMotion === 'reduce';
    node.scrollBy({ left: direction * step, behavior: prefersReduced ? 'auto' : 'smooth' });
  };

  return <section className="city-section home-carousel" data-selection={index} aria-labelledby={id}>
    <div className="section-heading">
      <div><span className="section-index">{index} / РЯДОМ</span><h2 id={id}>{title}</h2><p>{subtitle}</p></div>
      <div className="home-section-controls">
        {items.length > 0 && <>
          <button type="button" className="home-carousel-arrow" onClick={() => move(-1)}
            disabled={limits.start} aria-controls={id + '-cards'} aria-label={`Назад: ${title}`}>
            <Icon name="back" size={20}/>
          </button>
          <button type="button" className="home-carousel-arrow home-carousel-arrow--next" onClick={() => move(1)}
            disabled={limits.end} aria-controls={id + '-cards'} aria-label={`Дальше: ${title}`}>
            <Icon name="back" size={20}/>
          </button>
        </>}
        <button type="button" className="text-action" onClick={() => navigate(kind)}
          aria-label={`Смотреть каталог: ${title}`}>Смотреть все <Icon name="arrow" size={18}/></button>
      </div>
    </div>
    {items.length > 0
      ? <div id={id + '-cards'} className="card-grid discovery-grid home-carousel-track" ref={listRef}
          role="region" aria-label={`Карточки: ${title}`} tabIndex={0}>
          {items.map(item => <Card key={item.id} item={item} featured={featured} {...actions}/>)}
        </div>
      : <p className="city-section-coming-soon">Здесь пока нет подтверждённых организаций или событий. Добавим их после проверки.</p>}
  </section>;
}
