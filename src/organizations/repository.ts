import type { SupabaseClient } from '@supabase/supabase-js';
import { APPLICATION_CONSENT_VERSION, normalizeDraft, validateDraft } from './model';
import type { ApplicationDraft, ApplicationRow, OrganizationRow } from './model';
import {prepareAdminImage,adminImageExtension} from '../photos/adminImage';

export const ORGANIZATION_COLUMNS = 'id,kind,city,title,category,description,address,phone,hours,website,vk_url,latitude,longitude,source_type,source_url,verified_at,status,created_at,updated_at,image_url';
const PUBLIC_ORGANIZATION_COLUMNS = 'id,kind,city,title,category,description,address,phone,hours,latitude,longitude,source_type,source_url,verified_at,status,created_at,updated_at,image_url';
export const APPLICATION_COLUMNS = 'id,applicant_id,client_request_id,title,city,category,address,phone,hours,description,website,vk_url,source_note,status,created_at,review_message,organization_id,photo_path';
export const CONNECTION_MESSAGE = 'Не удалось соединиться с сервисом организаций. Попробуйте позже.';
function clientOrThrow(client: SupabaseClient | null): SupabaseClient {
  if (!client) throw new Error('Приём заявок пока не настроен. Попробуйте позже.');
  return client;
}
// A slow backend must not block rendering. Abort PostgREST and ignore late Auth responses.
export async function withDeadline<T>(operation: (signal: AbortSignal) => PromiseLike<T>, timeout = 8000): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(operation(controller.signal)),
      new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error(CONNECTION_MESSAGE)); }, timeout); }),
    ]);
  } finally { clearTimeout(timer); }
}
export async function readPublished(client: SupabaseClient | null): Promise<OrganizationRow[]> {
  const db = clientOrThrow(client);
  const rows: OrganizationRow[] = [];
  // PostgREST defaults to 1000 rows. Fetch bounded pages, rather than silently losing records.
  for (let offset = 0; offset < 10000; offset += 500) {
    const { data, error } = await withDeadline(signal => db.from('organizations').select(PUBLIC_ORGANIZATION_COLUMNS).eq('status', 'published').order('id').range(offset, offset + 499).abortSignal(signal));
    if (error || !Array.isArray(data)) throw new Error(CONNECTION_MESSAGE);
    rows.push(...data as OrganizationRow[]);
    if (data.length < 500) return rows;
  }
  throw new Error(CONNECTION_MESSAGE); // Never present an incomplete catalog as complete.
}
async function requireUser(client: SupabaseClient, userId: string): Promise<void> {
  const { data, error } = await withDeadline(() => client.auth.getUser());
  if (error || data.user?.id !== userId) throw new Error('Сессия истекла. Войдите в аккаунт ещё раз.');
}
/** Show the profile shortcut only when the current account has submitted an application.
 * Query no application details, and rely on the existing server RLS owner policy.
 */
export async function hasOwnApplications(client: SupabaseClient | null, userId: string): Promise<boolean> {
  const db = clientOrThrow(client);
  await requireUser(db, userId);
  const { data, error } = await withDeadline(signal => db.from('organization_applications')
    .select('id').eq('applicant_id', userId).limit(1).abortSignal(signal));
  if (error || !Array.isArray(data)) throw new Error(CONNECTION_MESSAGE);
  return data.length > 0;
}

export async function readApplications(client: SupabaseClient | null, userId: string): Promise<ApplicationRow[]> {
  const db = clientOrThrow(client);
  await requireUser(db, userId);
  const rows: ApplicationRow[] = [];
  for (let offset = 0; offset < 10000; offset += 100) {
    const { data, error } = await withDeadline(signal => db.from('organization_applications').select(APPLICATION_COLUMNS).eq('applicant_id', userId).order('created_at', { ascending: false }).order('id').range(offset, offset + 99).abortSignal(signal));
    if (error || !Array.isArray(data)) throw new Error(CONNECTION_MESSAGE);
    rows.push(...data as ApplicationRow[]);
    if (data.length < 100) return rows.filter(row => row.applicant_id === userId);
  }
  throw new Error(CONNECTION_MESSAGE);
}
export async function submitApplication(client: SupabaseClient | null, userId: string, draft: ApplicationDraft, consent: boolean, requestId: string): Promise<ApplicationRow> {
  if (Object.keys(validateDraft(draft, consent)).length) throw new Error('Проверьте поля и согласие перед отправкой.');
  const db = clientOrThrow(client);
  await requireUser(db, userId);
  const normalized = normalizeDraft(draft);
  // Column permissions and RLS, not the frontend, enforce pending and ownership.
  const { data, error } = await withDeadline(signal => db.from('organization_applications').insert({
    ...normalized, applicant_id: userId, client_request_id: requestId,
    consent_accepted: true, consent_version: APPLICATION_CONSENT_VERSION,
  }).select(APPLICATION_COLUMNS).abortSignal(signal).single());
  if (error?.code === '23505') {
    // Retrying after an ambiguous network timeout must not create a second application.
    const prior = await withDeadline(signal => db.from('organization_applications').select(APPLICATION_COLUMNS).eq('applicant_id', userId).eq('client_request_id', requestId).abortSignal(signal).single());
    if (!prior.error && prior.data && Object.entries(normalized).every(([key, value]) => prior.data[key as keyof ApplicationDraft] === value)) return prior.data as ApplicationRow;
    throw new Error('Предыдущая отправка могла быть принята. Проверьте «Мои заявки» перед созданием новой.');
  }
  if (error || !data) throw new Error('Не удалось подтвердить отправку. Проверьте «Мои заявки» и повторите попытку с теми же данными.');
  return data as ApplicationRow;
}

/** Photo belongs to an existing pending request; never public before review.
 * Submission succeeded even if the image fails: report the photo failure explicitly.
 */
export async function attachApplicationPhoto(client:SupabaseClient|null,userId:string,applicationId:string,file:File):Promise<string>{
 const db=clientOrThrow(client);
 await requireUser(db,userId);
 const img=await prepareAdminImage(file,'gallery');
 const ext=adminImageExtension(img);
 const path=`${userId}/${applicationId}/${crypto.randomUUID()}.${ext}`;
 const {error:uploadError}=await db.storage.from('ryadom-org-requests')
  .upload(path,img,{contentType:img.type,upsert:false});
 if(uploadError)throw Error('Заявка сохранена, но фотография не прикрепилась. Сообщите об этом при обращении к администратору.');
 const {data,error}=await withDeadline(signal=>db.from('organization_applications')
  .update({photo_path:path}).eq('id',applicationId).eq('applicant_id',userId).eq('status','pending')
  .is('photo_path',null).select('id').abortSignal(signal).single());
 if(error||!data){
   await db.storage.from('ryadom-org-requests').remove([path]).catch(()=>{});
   throw Error('Заявка сохранена, но не удалось закрепить фотографию.');
 }
 return path;
}
