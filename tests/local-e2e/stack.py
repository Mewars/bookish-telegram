"""Disposable localhost-only Auth/PostgREST/Storage fixture. Never targets a cloud project."""

import argparse
import base64
import hashlib
import hmac
import json
import os
from pathlib import Path
import secrets
import subprocess
import time
import urllib.error
import urllib.request

REPO = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument("action", choices=["start", "stop"])
parser.add_argument("--workdir", required=True, type=Path)
args = parser.parse_args()
if args.workdir.resolve().is_relative_to(REPO):
    raise RuntimeError("Test credentials/workdir must be outside the Git repository")
args.workdir.mkdir(parents=True, exist_ok=True)
credential_file = args.workdir / "credentials.json"


def command(*parts, **kwargs):
    return subprocess.run(parts, check=True, **kwargs)


def inspect(name):
    result = subprocess.run(["docker", "inspect", name], capture_output=True, text=True)
    return json.loads(result.stdout)[0] if result.returncode == 0 else None


def require_owned(name, config):
    container = inspect(name)
    if (
        container
        and (container["Config"].get("Labels") or {}).get("io.ryadom.local-e2e")
        != config["instance"]
    ):
        raise RuntimeError(
            "Refusing to touch a container not owned by this test instance"
        )
    return container


if args.action == "stop":
    if credential_file.exists():
        config = json.loads(credential_file.read_text())
        for service in ["friends-php", "storage", "rest", "auth", "db"]:
            name = config["prefix"] + "-" + service
            if require_owned(name, config):
                command("docker", "rm", "-f", name, stdout=subprocess.DEVNULL)
        network = inspect(config["network"])
        if network:
            if (
                network.get("Labels", {}).get("io.ryadom.local-e2e")
                != config["instance"]
            ):
                raise RuntimeError("Refusing to remove an unowned network")
            command(
                "docker", "network", "rm", config["network"], stdout=subprocess.DEVNULL
            )
        # Credential files remain private for diagnosis; this fixture is one-shot.
    print("Removed only containers/network owned by the specified local test instance.")
    raise SystemExit(0)

if credential_file.exists():
    raise RuntimeError(
        "Use a fresh workdir for each test run; refusing to reuse credentials or data"
    )
instance = secrets.token_hex(6)
secret = secrets.token_urlsafe(48)
password = secrets.token_hex(24)


def jwt(role):
    encode = (
        lambda value: base64.urlsafe_b64encode(
            json.dumps(value, separators=(",", ":")).encode()
        )
        .rstrip(b"=")
        .decode()
    )
    message = (
        encode({"alg": "HS256", "typ": "JWT"})
        + "."
        + encode(
            {
                "role": role,
                "iss": "local-ryadom-test",
                "iat": int(time.time()),
                "exp": int(time.time()) + 86400,
            }
        )
    )
    signature = (
        base64.urlsafe_b64encode(
            hmac.new(secret.encode(), message.encode(), hashlib.sha256).digest()
        )
        .rstrip(b"=")
        .decode()
    )
    return message + "." + signature


config = {
    "instance": instance,
    "prefix": "ryadom-e2e-" + instance,
    "network": "ryadom-e2e-" + instance,
    "jwt_secret": secret,
    "db_password": password,
    "anon_key": jwt("anon"),
    "service_key": jwt("service_role"),
}
credential_file.write_text(json.dumps(config))
credential_file.chmod(0o600)
images = json.loads((Path(__file__).parent / "images.json").read_text())
command(
    "docker",
    "network",
    "create",
    "--label",
    "io.ryadom.local-e2e=" + instance,
    "-o",
    "com.docker.network.bridge.host_binding_ipv4=127.0.0.1",
    config["network"],
    stdout=subprocess.DEVNULL,
)


def container(service, port, environment):
    name = config["prefix"] + "-" + service
    require_owned(name, config)
    envfile = args.workdir / (service + ".env")
    envfile.write_text(
        "\n".join(f"{key}={value}" for key, value in environment.items())
    )
    envfile.chmod(0o600)
    command(
        "docker",
        "run",
        "-d",
        "--label",
        "io.ryadom.local-e2e=" + instance,
        "--name",
        name,
        "--network",
        config["network"],
        "--env-file",
        str(envfile),
        "-p",
        "127.0.0.1:" + port,
        images[service],
        stdout=subprocess.DEVNULL,
    )


def sql(text):
    command(
        "docker",
        "exec",
        "-i",
        config["prefix"] + "-db",
        "psql",
        "-U",
        "postgres",
        "-v",
        "ON_ERROR_STOP=1",
        input=text.encode(),
        stdout=subprocess.DEVNULL,
    )


def health(port, path):
    for _ in range(60):
        try:
            with urllib.request.urlopen(
                f"http://127.0.0.1:{port}{path}", timeout=2
            ) as response:
                if response.status == 200:
                    return
        except (urllib.error.URLError, TimeoutError, ConnectionError):
            pass
        time.sleep(1)
    raise RuntimeError(
        f"Local service on port {port} did not become healthy; inspect private container logs"
    )


container("db", "15432:5432", {"POSTGRES_PASSWORD": password})
for _ in range(60):
    if (
        subprocess.run(
            [
                "docker",
                "exec",
                config["prefix"] + "-db",
                "pg_isready",
                # The image's init server accepts Unix sockets only and then
                # shuts down. TCP readiness waits for the final server instead.
                "-h",
                "127.0.0.1",
                "-U",
                "postgres",
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        ).returncode
        == 0
    ):
        break
    time.sleep(1)
else:
    raise RuntimeError("Local database failed to start")
sql(
    (Path(__file__).parent / "bootstrap.sql")
    .read_text()
    .replace("__LOCAL_DB_PASSWORD__", password)
)
connection = "postgres://{}:" + password + "@" + config["prefix"] + "-db:5432/postgres"
container(
    "auth",
    "19999:9999",
    {
        "GOTRUE_API_HOST": "0.0.0.0",
        "GOTRUE_API_PORT": "9999",
        "API_EXTERNAL_URL": "http://127.0.0.1:4180/auth/v1",
        "GOTRUE_DB_DRIVER": "postgres",
        "GOTRUE_DB_DATABASE_URL": connection.format("supabase_auth_admin"),
        "GOTRUE_SITE_URL": "http://127.0.0.1:4180",
        "GOTRUE_URI_ALLOW_LIST": "http://127.0.0.1:4180/**",
        "GOTRUE_JWT_SECRET": secret,
        "GOTRUE_JWT_EXP": "3600",
        "GOTRUE_JWT_AUD": "authenticated",
        "GOTRUE_JWT_DEFAULT_GROUP_NAME": "authenticated",
        "GOTRUE_JWT_ADMIN_ROLES": "service_role",
        "GOTRUE_EXTERNAL_EMAIL_ENABLED": "true",
        "GOTRUE_MAILER_AUTOCONFIRM": "true",
        "GOTRUE_DISABLE_SIGNUP": "false",
    },
)
container(
    "rest",
    "13000:3000",
    {
        "PGRST_DB_URI": connection.format("authenticator"),
        "PGRST_DB_SCHEMAS": "public",
        "PGRST_DB_ANON_ROLE": "anon",
        "PGRST_JWT_SECRET": secret,
        "PGRST_DB_EXTRA_SEARCH_PATH": "public",
    },
)
container(
    "storage",
    "15000:5000",
    {
        "ANON_KEY": config["anon_key"],
        "SERVICE_KEY": config["service_key"],
        "AUTH_JWT_SECRET": secret,
        "POSTGREST_URL": "http://" + config["prefix"] + "-rest:3000",
        "DATABASE_URL": connection.format("supabase_storage_admin"),
        "STORAGE_BACKEND": "file",
        "FILE_STORAGE_BACKEND_PATH": "/var/lib/storage",
        "FILE_SIZE_LIMIT": "52428800",
        "TENANT_ID": "local-ryadom-test",
        "GLOBAL_S3_BUCKET": "local-ryadom-test",
        "REGION": "local",
        "ENABLE_IMAGE_TRANSFORMATION": "false",
        "REQUEST_ALLOW_X_FORWARDED_PATH": "true",
        "NO_PROXY": os.environ.get("NO_PROXY", "")
        + ",127.0.0.1,localhost,"
        + config["prefix"]
        + "-rest,"
        + config["prefix"]
        + "-db",
    },
)
health(19999, "/health")
health(15000, "/status")
health(13000, "/")
sql((Path(__file__).parent / "app-foundation.sql").read_text())
for filename in [
    "supabase/schema.sql",
    "docs/sql/city-directory-multicity.sql",
    "docs/sql/classifieds-private-messaging-v1.sql",
    "docs/sql/classifieds-editor-privacy-v2.sql",
    "docs/sql/classified-photos-private-v1.sql",
    "docs/sql/classified-unread-receipts-v1.sql",
    "docs/sql/classified-reports-review-v1.sql",
    "docs/sql/classified-owner-archive-v1.sql",
    "docs/sql/classified-rejection-reasons-v1.sql",
    "docs/sql/classified-revision-v1.sql",
    "tests/local-e2e/host-schema/classifieds_expand_deal_types_20261018_v1.sql",
    "docs/sql/community-feed-v1.sql",
    "docs/sql/community-post-archive-v1.sql",
    "tests/local-e2e/host-schema/community_wall_city_pin_settings_v1.sql",
    "tests/local-e2e/host-schema/community_wall_photos_likes_v1.sql",
    "tests/local-e2e/host-schema/wall_raster_formats_and_video_v1.sql",
    "tests/local-e2e/host-schema/wall_author_retract_pending_v1.sql",
    "docs/sql/community-review-reasons-v1.sql",
    "docs/sql/friends-nearby-private-v1.sql",
]:
    sql((REPO / filename).read_text())
config["users"] = {}
for role in ["seller", "buyer", "outsider", "editor", "foreign_editor", "owner"]:
    user = {
        "email": role + "@ryadom-e2e.invalid",
        "password": secrets.token_urlsafe(24),
    }
    request = urllib.request.Request(
        "http://127.0.0.1:19999/admin/users",
        data=json.dumps({**user, "email_confirm": True}).encode(),
        headers={
            "Authorization": "Bearer " + config["service_key"],
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=15) as response:
        user["id"] = json.load(response)["id"]
    config["users"][role] = user
values = ",".join(
    f"('{config['users'][role]['id']}','{city}','editor')"
    for role, city in [("editor", "Енисейск"), ("foreign_editor", "Лесосибирск")]
)
sql(
    "INSERT INTO public.city_admin_access(user_id,city,role) VALUES "
    + values + f",('{config['users']['owner']['id']}','*','owner')"
    + "; NOTIFY pgrst,'reload schema';"
)
credential_file.write_text(json.dumps(config))
print(
    "Local-only Auth/PostgREST/Storage ready; six synthetic users created via Auth API. No cloud project accessed."
)
