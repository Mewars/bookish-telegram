import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';

test('footer: franchise messages, application form and no paid services link',async()=>{
 const footer=await readFile('src/components/FooterBrand.tsx','utf8');
 assert.match(footer,/href="https:\/\/vk\.me\/ryadomcity"/);
 assert.match(footer,/Франшиза/);
 assert.match(footer,/href="#\/add-organization"/);
 assert.match(footer,/Добавление организации/);
 assert.match(footer,/<span title="Раздел готовится">Платные услуги<\/span>/);
 assert.doesNotMatch(footer,/<a[^>]+>Платные услуги<\/a>/);
});
test('admin: requests instead of redundant photos menu, editable draft and source cover',async()=>{
 const [admin,inbox]=await Promise.all([
   readFile('src/admin/AdminPage.tsx','utf8'),
   readFile('src/admin/AdminApplicationsPanel.tsx','utf8'),
 ]);
 assert.doesNotMatch(admin, /<span>Фотографии<\/span>/);
 assert.match(admin, /<span>Заявки<\/span>/);
 assert.match(admin, /<AdminApplicationsPanel/);
 assert.match(admin, /decideOrganizationApplication\(supabase,userId,access,applicationOrigin,'approved'/);
 assert.match(admin, /downloadApplicantPhoto\(supabase,userId,access,app\)/);
 assert.match(admin, /uploadAdminPhoto\(supabase, userId, access, draft.city, selectedFile\)/);
 assert.match(inbox, /readPendingAdminApplications/);
 assert.match(inbox, /Проверить и редактировать/);
 assert.match(inbox, /Подтвердить отклонение/);
});
test('resident photo is private and cannot be published without admin review',async()=>{
 const [form,repo,sql]=await Promise.all([
   readFile('src/organizations/OrganizationsPage.tsx','utf8'),
   readFile('src/organizations/repository.ts','utf8'),
   readFile('docs/sql/organization-request-review-photos-v1.sql','utf8'),
 ]);
 assert.match(form, /attachApplicationPhoto\(supabase,userId,saved\.id,photoFile\)/);
 assert.match(repo, /storage\.from\('ryadom-org-requests'\)/);
 assert.match(sql,/false,2097152/);
 assert.match(sql,/CREATE POLICY applications_city_staff_read/);
 assert.match(sql,/CREATE POLICY ryadom_org_requests_review_photo/);
 assert.match(sql,/SECURITY DEFINER/);
 assert.match(sql,/app\.applicant_id=actor OR NOT EXISTS/);
 assert.doesNotMatch(sql,/GRANT EXECUTE ON FUNCTION public\.review_organization_request\(uuid,text,jsonb,text\) TO anon/);
});
