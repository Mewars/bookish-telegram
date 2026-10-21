-- Local integration fixture, copied from Production migration wall_raster_formats_and_video_v1.
-- Never apply this historical fixture to a hosted project.
ALTER TABLE public.community_post_photos DROP CONSTRAINT community_post_photos_format_check;
ALTER TABLE public.community_post_photos ADD CONSTRAINT community_post_photos_format_check
 CHECK (format IN ('jpg','webp','png','gif','avif','bmp','heic','heif','tif'));
UPDATE storage.buckets SET
 file_size_limit=10485760,
 allowed_mime_types=ARRAY['image/jpeg','image/png','image/webp','image/gif','image/avif','image/bmp','image/heic','image/heif','image/tiff']::text[]
 WHERE id='ryadom-wall-photos';
CREATE TABLE public.community_post_videos(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 post_id uuid NOT NULL UNIQUE REFERENCES public.community_posts(id) ON DELETE CASCADE,
 uploaded_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
 format text NOT NULL CHECK(format IN ('mp4','webm','mov')),
 object_path text GENERATED ALWAYS AS (post_id::text||'/'||id::text||'.'||format) STORED,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.community_post_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_post_videos FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.community_post_videos FROM PUBLIC,anon,authenticated;
GRANT SELECT(id,post_id,uploaded_by,format,object_path,created_at) ON public.community_post_videos TO anon,authenticated;
GRANT INSERT(id,post_id,format) ON public.community_post_videos TO authenticated;
GRANT DELETE ON public.community_post_videos TO authenticated;
CREATE POLICY community_video_public_read ON public.community_post_videos FOR SELECT TO anon,authenticated
 USING(EXISTS(SELECT 1 FROM public.community_posts p WHERE p.id=post_id AND p.status='published'));
CREATE POLICY community_video_author_read ON public.community_post_videos FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.community_posts p WHERE p.id=post_id AND p.author_id=(SELECT auth.uid())));
CREATE POLICY community_video_staff_read ON public.community_post_videos FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.community_posts p JOIN public.city_admin_access a
 ON a.user_id=(SELECT auth.uid()) AND a.active
 AND (a.city=p.city OR(a.city='*' AND a.role='owner'))
 WHERE p.id=post_id AND p.status='pending'));
CREATE POLICY community_video_author_insert ON public.community_post_videos FOR INSERT TO authenticated
 WITH CHECK(uploaded_by=(SELECT auth.uid()) AND EXISTS(SELECT 1 FROM public.community_posts p
 WHERE p.id=post_id AND p.author_id=(SELECT auth.uid()) AND p.status IN ('draft','rejected')));
CREATE POLICY community_video_author_delete ON public.community_post_videos FOR DELETE TO authenticated
 USING(uploaded_by=(SELECT auth.uid()) AND EXISTS(SELECT 1 FROM public.community_posts p
 WHERE p.id=post_id AND p.author_id=(SELECT auth.uid()) AND p.status IN ('draft','rejected')));
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('ryadom-wall-videos','ryadom-wall-videos',false,52428800,
 ARRAY['video/mp4','video/webm','video/quicktime']::text[])
ON CONFLICT(id) DO NOTHING;
CREATE POLICY ryadom_wall_video_public_read ON storage.objects FOR SELECT TO anon,authenticated
 USING(bucket_id='ryadom-wall-videos' AND EXISTS(
 SELECT 1 FROM public.community_post_videos v JOIN public.community_posts p ON p.id=v.post_id
 WHERE v.object_path=storage.objects.name AND p.status='published'));
CREATE POLICY ryadom_wall_video_author_read ON storage.objects FOR SELECT TO authenticated
 USING(bucket_id='ryadom-wall-videos' AND EXISTS(
 SELECT 1 FROM public.community_post_videos v JOIN public.community_posts p ON p.id=v.post_id
 WHERE v.object_path=storage.objects.name AND p.author_id=(SELECT auth.uid())));
CREATE POLICY ryadom_wall_video_staff_read ON storage.objects FOR SELECT TO authenticated
 USING(bucket_id='ryadom-wall-videos' AND EXISTS(
 SELECT 1 FROM public.community_post_videos v JOIN public.community_posts p ON p.id=v.post_id
 JOIN public.city_admin_access a ON a.user_id=(SELECT auth.uid()) AND a.active
 AND (a.city=p.city OR (a.city='*' AND a.role='owner'))
 WHERE v.object_path=storage.objects.name AND p.status='pending'));
CREATE POLICY ryadom_wall_video_author_upload ON storage.objects FOR INSERT TO authenticated
 WITH CHECK(bucket_id='ryadom-wall-videos' AND EXISTS(
 SELECT 1 FROM public.community_post_videos v JOIN public.community_posts p ON p.id=v.post_id
 WHERE v.object_path=storage.objects.name AND v.uploaded_by=(SELECT auth.uid())
 AND p.author_id=(SELECT auth.uid()) AND p.status IN ('draft','rejected')));
CREATE POLICY ryadom_wall_video_author_delete ON storage.objects FOR DELETE TO authenticated
 USING(bucket_id='ryadom-wall-videos' AND EXISTS(
 SELECT 1 FROM public.community_post_videos v JOIN public.community_posts p ON p.id=v.post_id
 WHERE v.object_path=storage.objects.name AND v.uploaded_by=(SELECT auth.uid())
 AND p.author_id=(SELECT auth.uid()) AND p.status IN ('draft','rejected')));
