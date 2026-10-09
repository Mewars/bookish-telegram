function clearMetrikaStorage(getStorage: () => Storage): void {
  try {
    const storage = getStorage();
    const keys: string[] = [];
    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index);
      if (key?.startsWith('_ym_')) keys.push(key);
    }
    for (const key of keys) {
      try { storage.removeItem(key); } catch { /* Continue cleaning other identifiers. */ }
    }
  } catch { /* Storage can be unavailable in a WebView or private browser. */ }
}

export function clearMetrikaClientIdentifiers(): void {
  clearMetrikaStorage(() => window.localStorage);
  clearMetrikaStorage(() => window.sessionStorage);
  try {
    const names = new Set(document.cookie.split(';').map(cookie => cookie.trim().split('=')[0])
      .filter(name => name.startsWith('_ym_') && [...name].every(char => char.charCodeAt(0) > 32 && char.charCodeAt(0) < 127 && !'=;'.includes(char))));
    const paths = new Set(['/']);
    const pathname = window.location.pathname;
    // Cookie paths are not exposed by document.cookie; try all visible path prefixes.
    for (let index = 1; index <= pathname.length; index++) {
      if (index === pathname.length || pathname[index] === '/') {
        const prefix = pathname.slice(0, index);
        if (!/[;\r\n]/.test(prefix)) { paths.add(prefix); paths.add(`${prefix}/`); }
      }
    }
    const hostname = window.location.hostname;
    const domains = new Set(['', hostname, `.${hostname}`]);
    if (!hostname.includes(':') && !/^\d+(\.\d+){3}$/.test(hostname)) {
      const parts = hostname.split('.');
      // Only current-host suffixes, never unrelated domains. Public suffixes are
      // rejected by the browser; no cookies outside this site's scope are touched.
      for (let index = 1; index < parts.length - 1; index++) {
        const parent = parts.slice(index).join('.');
        domains.add(parent); domains.add(`.${parent}`);
      }
    }
    for (const name of names) for (const path of paths) for (const domain of domains) {
      try {
        document.cookie = `${name}=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=${path}${domain ? `; Domain=${domain}` : ''}${location.protocol === 'https:' ? '; Secure' : ''}`;
      } catch { /* Cookie restrictions must not interrupt the application. */ }
    }
  } catch { /* Inaccessible/HttpOnly/third-party cookies cannot be cleared here. */ }
}
