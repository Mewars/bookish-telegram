# Classifieds beta: read-only security verification (2026-10-15)

Scope: `Ryadom-Test` only. No production schema, account, secret, or user content was changed.

## Verified against the test database

- The five classified RPCs (`complete_classified`, `open_classified_conversation`, `review_classified`, `review_classified_report`, `send_classified_message`) are SECURITY DEFINER functions.
- All five deny EXECUTE to the `anon` role and allow it to `authenticated`. All five have an explicit `search_path` setting.
- The six classifieds tables are present with RLS enabled; previous PostgreSQL regression tests cover owner, outsider, moderator and photo access.
- The Supabase security advisor still reports five warnings for authenticated SECURITY DEFINER functions. These are not automatically proof of an exploit. Authorization checks inside the functions remain security-critical.
- The production database has no classifieds beta tables.

## Release gate

Before exposing the beta publicly, add and run regression tests asserting anonymous RPC denial and FORCE RLS on all six tables, test account switching and message/photo privacy with two independent real test accounts, and verify current deployment plus both OAuth providers. Do not equate a passing CI build with real-account end-to-end verification.

This note records a read-only verification. It does not authorize a production database migration or public beta release.
