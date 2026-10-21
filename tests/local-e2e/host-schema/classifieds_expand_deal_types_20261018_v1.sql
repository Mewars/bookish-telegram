-- Local integration fixture, copied from Production migration classifieds_expand_deal_types_20261018_v1.
-- Never apply this historical fixture to a hosted project.
ALTER TABLE public.classifieds DROP CONSTRAINT classifieds_deal_type_check;
ALTER TABLE public.classifieds ADD CONSTRAINT classifieds_deal_type_check CHECK(
deal_type IN (
'sell','buy','exchange','give_away','accept_free','rent_out','rent_in',
'vacancy','job_seek','resume','gig_offer','gig_seek',
'service_offer','service_seek','lost','found','help_offer','help_seek',
'ride_share','pet_give','pet_seek','other'
));
