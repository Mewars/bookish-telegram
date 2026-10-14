// Accept a normal public RUTUBE link, not arbitrary HTML or a pasted iframe.
// Private videos/access tokens and unknown hosts/parameters are intentionally
// unsupported until their authorization model is designed separately.
export interface RutubeVideo {
  id: string;
  watchUrl: string;
  embedUrl: string;
}

export function parseRutubeVideo(raw: string): RutubeVideo | null {
  const input = raw.trim();
  if (!input || input.length > 500) return null;
  try {
    const parsed = new URL(input);
    if (parsed.protocol !== 'https:' || !['rutube.ru', 'www.rutube.ru'].includes(parsed.hostname)
      || parsed.username || parsed.password || parsed.port || parsed.search || parsed.hash) return null;

    const match = /^\/(?:video|shorts)\/([a-f\d]{32})\/?$/i.exec(parsed.pathname)
      ?? /^\/play\/embed\/([a-f\d]{32})\/?$/i.exec(parsed.pathname);
    if (!match) return null;

    const id = match[1].toLowerCase();
    return {
      id,
      watchUrl: `https://rutube.ru/video/${id}/`,
      embedUrl: `https://rutube.ru/play/embed/${id}`,
    };
  } catch { return null; }
}
