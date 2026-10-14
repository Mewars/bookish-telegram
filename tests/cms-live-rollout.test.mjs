import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('production builds enable only the three verified CMS switches, with a kill switch', async () => {
  for (const workflow of [
    '.github/workflows/sprinthost-deploy.yml',
    '.github/workflows/github-pages.yml',
    '.github/workflows/sprinthost-build.yml',
  ]) {
    const source = await readFile(workflow, 'utf8');
    for (const flag of [
      'VITE_ADMIN_PANEL_ENABLED',
      'VITE_ORGANIZATIONS_ENABLED',
      'VITE_CITY_DIRECTORY_ENABLED',
    ]) {
      assert.match(source, new RegExp(flag + ": .*vars\\.RYADOM_CMS_SAFETY_OFF == 'true' && 'false' \\|\\| 'true'"), workflow);
    }
    assert.match(source, /VITE_SUPABASE_PUBLISHABLE_KEY/);
    assert.match(source, /VITE_VK_ID_ENABLED: 'true'/);
    assert.doesNotMatch(source, /sb_secret_|service_role/);
  }
});

test('live CMS still enforces role membership and never exposes demo-only saves', async () => {
  const [app, admin, preview] = await Promise.all([
    readFile('src/App.tsx', 'utf8'),
    readFile('src/admin/AdminPage.tsx', 'utf8'),
    readFile('src/admin/AdminPreviewPage.tsx', 'utf8'),
  ]);
  assert.match(app, /VITE_ADMIN_PANEL_ENABLED/);
  assert.match(app, /VITE_ORGANIZATIONS_ENABLED/);
  assert.match(app, /VITE_CITY_DIRECTORY_ENABLED/);
  assert.match(admin, /readCityAccess/);
  assert.match(admin, /readAdminOrganizations/);
  assert.match(admin, /saveAdminOrganization/);
  assert.match(admin, /uploadAdminPhoto/);
  assert.match(preview, /localStorage\.setItem\(PREVIEW_STORAGE_KEY/);
});
