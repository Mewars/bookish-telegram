// Kept separate from public navigation: there is deliberately no menu entry.
export function isOrganizationImportRoute() {
  return /^#\/?admin\/import\/?$/.test(window.location.hash);
}
