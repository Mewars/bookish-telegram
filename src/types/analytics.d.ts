interface MetrikaInitOptions {
  defer: boolean;
  webvisor: boolean;
  clickmap: boolean;
  trackLinks: boolean;
  accurateTrackBounce: boolean;
}
interface MetrikaPageViewOptions { title: string; referer: string }
interface YandexMetrika {
  (counterId: number, method: 'init', options: MetrikaInitOptions): void;
  (counterId: number, method: 'hit', url: string, options: MetrikaPageViewOptions): void;
  (counterId: number, method: 'reachGoal', event: 'music_play' | 'music_pause' | 'music_error'): void;
  (counterId: number, method: 'destruct'): void;
  a?: unknown[][];
  l?: number;
}
interface Window { ym?: YandexMetrika }
