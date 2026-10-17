import { isOrganizationImportRoute } from '../import/route';
export function isPrivateAnalyticsRoute():boolean {
  return isOrganizationImportRoute()||/^#\/?friends(?:[/?]|$)/.test(window.location.hash);
}
