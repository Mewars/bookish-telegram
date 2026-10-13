const encoder = new TextEncoder();
export function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function randomSecret(): string { return base64url(crypto.getRandomValues(new Uint8Array(32))); }
export async function digest(value: string): Promise<string> {
  return base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))));
}
export async function equalSecret(a: string, b: string): Promise<boolean> {
  const first = await digest(a), second = await digest(b);
  let difference = 0;
  for (let i=0; i<first.length; i++) difference |= first.charCodeAt(i) ^ second.charCodeAt(i);
  return difference === 0;
}
function decode(value: string): Uint8Array<ArrayBuffer> {
  const raw = atob(value.replace(/-/g,'+').replace(/_/g,'/'));
  return Uint8Array.from(raw, char => char.charCodeAt(0));
}
export async function cipher(keyString: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(keyString)) throw new Error('Invalid encryption key');
  const key = await crypto.subtle.importKey('raw', decode(keyString), 'AES-GCM', false, ['encrypt','decrypt']);
  return {
    async seal(value: unknown, context: string): Promise<string> {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode(context)}, key, encoder.encode(JSON.stringify(value)));
      return base64url(iv)+'.'+base64url(new Uint8Array(encrypted));
    },
    async open<T>(value: string, context: string): Promise<T> {
      const parts=value.split('.');
      if (parts.length!==2) throw new Error('Invalid encrypted record');
      const plaintext=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(parts[0]),additionalData:encoder.encode(context)},key,decode(parts[1]));
      return JSON.parse(new TextDecoder().decode(plaintext)) as T;
    },
  };
}
