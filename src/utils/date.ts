export function eventDate(offset = 0, full = false) {
  const date = new Date(); date.setDate(date.getDate() + offset);
  if (!full && offset === 0) return 'Сегодня';
  if (!full && offset === 1) return 'Завтра';
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: full ? 'long' : 'short', ...(full ? { weekday: 'long' as const } : {}) }).format(date);
}
