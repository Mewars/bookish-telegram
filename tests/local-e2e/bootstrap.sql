-- Foundation for disposable local containers only; never a cloud migration.
CREATE SCHEMA auth;
CREATE SCHEMA storage;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE ROLE authenticator NOINHERIT LOGIN PASSWORD '__LOCAL_DB_PASSWORD__';
GRANT anon,authenticated,service_role TO authenticator;
CREATE ROLE supabase_auth_admin LOGIN PASSWORD '__LOCAL_DB_PASSWORD__';
ALTER SCHEMA auth OWNER TO supabase_auth_admin;
ALTER ROLE supabase_auth_admin SET search_path TO auth;
CREATE ROLE supabase_storage_admin LOGIN BYPASSRLS PASSWORD '__LOCAL_DB_PASSWORD__';
ALTER SCHEMA storage OWNER TO supabase_storage_admin;
ALTER ROLE supabase_storage_admin SET search_path TO storage;
GRANT anon,authenticated,service_role TO supabase_storage_admin;
GRANT USAGE ON SCHEMA public,auth,storage TO anon,authenticated,service_role;
GRANT ALL ON SCHEMA public TO supabase_storage_admin;
