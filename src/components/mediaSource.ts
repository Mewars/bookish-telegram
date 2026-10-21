export function isLegacyIllustration(src: string) {
  return /\/(?:city|beauty|cinema|coffee|concert|creative|food|sport)(?:-[\w-]+)?\.svg(?:[?#]|$)/i.test(src);
}
