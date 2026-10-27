-- Requested 2026-10-27: stories are for signed-in residents only.
-- No user posts, media, profiles or publication dates are changed.
BEGIN;
-- Keep table SELECT for Storage policy planning; restrictive RLS returns zero guest rows.
REVOKE EXECUTE ON FUNCTION public.list_city_stories(text) FROM anon;
CREATE POLICY stories_authenticated_guard ON public.city_stories AS RESTRICTIVE
 FOR SELECT TO anon,authenticated USING((SELECT auth.uid()) IS NOT NULL);

-- Profile data exposed here is limited to the avatar and public display name of
-- a visible story author (or the caller's own profile). Never expose the table.
CREATE FUNCTION public.city_story_profiles(p_ids uuid[])
 RETURNS TABLE(id uuid,display_name text,avatar_url text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT p.id,p.display_name,p.avatar_url FROM public.profiles p
 WHERE auth.uid() IS NOT NULL AND cardinality(p_ids)<=64 AND p.id=ANY(p_ids)
 AND (p.id=auth.uid() OR EXISTS(SELECT 1 FROM public.city_stories s WHERE s.author_id=p.id
 AND s.status='published' AND s.expires_at>now())) LIMIT 64;
$$;
REVOKE ALL ON FUNCTION public.city_story_profiles(uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.city_story_profiles(uuid[]) TO authenticated;

-- Metadata lookup is part of the private media download path. Keep exact object
-- matching and story RLS; continue forbidding listing, signing and public URLs.
DROP POLICY stories_read_guard ON storage.objects;
DROP POLICY stories_download ON storage.objects;
CREATE POLICY stories_read_guard ON storage.objects AS RESTRICTIVE FOR SELECT TO anon,authenticated USING(
 bucket_id<>'ryadom-stories' OR ((SELECT auth.uid()) IS NOT NULL AND EXISTS(
 SELECT 1 FROM public.city_stories s WHERE
 (CASE s.mime_type WHEN 'video/mp4' THEN regexp_replace(s.object_path,'\.webp$','.mp4')
 WHEN 'video/webm' THEN regexp_replace(s.object_path,'\.webp$','.webm') ELSE s.object_path END)=storage.objects.name
 AND (storage.allow_only_operation('object.get_authenticated') OR storage.allow_only_operation('object.get_authenticated_info')
 OR ((storage.allow_only_operation('object.delete') OR storage.allow_only_operation('object.delete_many'))
 AND s.author_id=(SELECT auth.uid()) AND s.status IN ('draft','rejected','removed'))))));
CREATE POLICY stories_download ON storage.objects FOR SELECT TO authenticated USING(
 bucket_id='ryadom-stories' AND (SELECT auth.uid()) IS NOT NULL AND EXISTS(
 SELECT 1 FROM public.city_stories s WHERE
 (CASE s.mime_type WHEN 'video/mp4' THEN regexp_replace(s.object_path,'\.webp$','.mp4')
 WHEN 'video/webm' THEN regexp_replace(s.object_path,'\.webp$','.webm') ELSE s.object_path END)=storage.objects.name
 AND (storage.allow_only_operation('object.get_authenticated') OR storage.allow_only_operation('object.get_authenticated_info')
 OR ((storage.allow_only_operation('object.delete') OR storage.allow_only_operation('object.delete_many'))
 AND s.author_id=(SELECT auth.uid()) AND s.status IN ('draft','rejected','removed')))));
NOTIFY pgrst,'reload schema';
COMMIT;
