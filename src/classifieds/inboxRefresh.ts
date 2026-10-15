/**
 * Detect newly arrived incoming messages per private conversation. Pure helper:
 * used only with server-calculated unread counts, never with cached message text.
 */
export function hasNewUnreadMessages(
  previous:Record<string,number>,next:Record<string,number>,
):boolean {
  return Object.keys(next).some(id=>{
    const updated=next[id];
    return Number.isSafeInteger(updated)&&updated>0&&updated>(previous[id]??0);
  });
}

export const INBOX_REFRESH_INTERVAL_MS=60_000;
