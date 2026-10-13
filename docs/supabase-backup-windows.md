# Supabase Ryadom: free local backup procedure

STATUS: PREPARED, NOT EXECUTED. The project is on the Free plan; Database > Backups says scheduled backups are unavailable. Do not migrate the production database before obtaining a tested recovery option.

Windows machine already has PostgreSQL 17 Command Line Tools (confirmed with pg_dump --version).

## When the site owner returns

1. Open the Ryadom Supabase Dashboard, click Connect, choose Session pooler (usually port 5432). Read the host and user values. Do not paste the database password into chat or GitHub.
2. Download or clone the trusted repository file scripts/backup-ryadom-supabase.ps1 to the owner's Windows PC.
3. In local Windows PowerShell, run the script and follow the prompts. The script asks for Session pooler host, username and hidden database password; the host/user must match the Ryadom project reference cptbmepnbzogqkfhflsg.
4. The script creates a date-stamped PostgreSQL custom-format archive and SHA256 checksum under the owner's Documents/Ryadom-Private-Backups folder.
5. Only consider the step finished after the script prints "Backup completed and checked!". The archive contains private user data; store an additional ENCRYPTED copy offline, never in public GitHub, site public_html, Discord/Telegram, issue comments, etc.
6. Confirm the ability to restore on an isolated testing environment before relying on this as a recovery method. pg_restore --list proves archive readability, not successful recovery.

Note that the raw pg_dump archive may contain Supabase-specific internal schemas; restoring it is more complex than a normal app database. Supabase's official guidance favors their CLI supabase db dump for migration/export:
https://supabase.com/docs/guides/self-hosting/restore-from-platform

If the owner does not know the database password, stop: never reset production credentials without checking consequences for existing connections.

## What has already been checked (read-only, 2026-10-14)

- Project Ryadom is active in eu-west-1, PostgreSQL 17, Free tier.
- Public app tables currently are profiles, user_identities, and user_favorites; these have RLS.
- organizations, organization_applications, city_admin_access, and the image bucket do not exist yet.
- The admin interface was merged in PR #41 but is OFF by default.
- SQL for the new tables already exists in docs/sql; NO production SQL has been executed.

## Release prerequisites

1. Obtain and verify private encrypted backup and recovery plan.
2. Review and apply organizations.sql, organizations-seed.sql, city-admin-mvp.sql in order, with a pre-production validation step.
3. Assign an owner role only after the real account has been identified by the site owner, never infer identity from stored profile records.
4. Verify policies as anon, normal authenticated user, editor, and owner; repeat security advisor checks.
5. Only then set the production build flag VITE_ADMIN_PANEL_ENABLED=true and deploy through the reviewed workflow. The separate SSH deployment is still disabled pending Sprinthost server fingerprint confirmation.
