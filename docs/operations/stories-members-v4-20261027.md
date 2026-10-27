# Истории: закрытый просмотр и загрузка видео

Production migration `city_stories_members_media_info_and_profiles_v4` applied on 2026-10-27 after the owner's explicit request for authenticated-only stories. Source: `docs/sql/city-stories-members-v4.sql`. Do not apply twice.

Observed: a published MP4 and its Storage object both existed; Storage logs showed HTTP 400 / NoSuchKey for authenticated requests at `/object/info/...`. The upstream Storage route labels this request `object.get_authenticated_info`; the former restrictive policies only admitted `object.get_authenticated`. The migration admits the exact metadata operation for the same visible object while preserving authentication, expiry, owner archive rights, a private bucket, and denial of listing/signing/public paths. It does not modify posts, media or publication dates.

Avatar RPC exposes only id, public display name and avatar for active story authors or the caller. It does not grant public access to profiles. Guests get no story rows or media. Expired published stories remain in their author's private archive; removed stories are omitted from the normal UI and continue counting toward creation quotas.

UI: one plus, profile circles with accessible names and no captions, animated brand loader, sound icon, pause while holding the photo/video with a finger, mouse or keyboard. Author deletion no longer asks the user to type a word. Staff moderation controls are not shown in the story strip. Existing report/RLS capabilities remain.

Performance: no media downloads for avatars; bounded blob cache cleared on sign-out; lazy-loaded editor; reduced repeated auth/profile refresh; public organizations filtered by city at the API. This is not a Production load test and does not establish capacity for 100 concurrent people.

Paid gig promotion remains unconfigured. Existing owner pins are not a payment system. Before charging: owner-approved prices, duration and placement rules, legal/payment model, provider, server-confirmed payment and refunds. Never enable a pretend successful payment or trust a browser flag.
