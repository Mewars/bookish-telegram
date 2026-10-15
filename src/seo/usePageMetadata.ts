import { useEffect } from 'react';
import type { PageMetadata } from './metadata';

export function usePageMetadata({ title, description, canonical }: PageMetadata) {
  useEffect(() => {
    document.title = title;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!meta) { meta = document.createElement('meta'); meta.name = 'description'; document.head.append(meta); }
    meta.content = description;
    const links = document.querySelectorAll<HTMLLinkElement>('link[rel="canonical"]');
    // A beta must never emit production canonical URLs, including after SPA navigation.
    if (import.meta.env.VITE_BETA_EMAIL_ONLY === 'true') { links.forEach(link => link.remove()); return; }
    if (!canonical) links.forEach(link => link.remove());
    else {
      const link = links[0] ?? document.createElement('link');
      link.rel = 'canonical'; link.href = canonical;
      if (!link.isConnected) document.head.append(link);
      links.forEach(other => { if (other !== link) other.remove(); });
    }
  }, [title, description, canonical]);
}
