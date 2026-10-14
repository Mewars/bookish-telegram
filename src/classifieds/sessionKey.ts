/** A React key must change whenever private beta ownership context changes. */
export function classifiedsSessionKey(city: string, userId: string | null): string {
  // JSON encoding avoids collisions between values containing delimiters.
  return JSON.stringify([city, userId]);
}
