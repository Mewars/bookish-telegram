"""Start the real PHP gateway locally. Never accepts a cloud Auth origin."""

import argparse
import json
from pathlib import Path
import subprocess

parser = argparse.ArgumentParser()
parser.add_argument("--workdir", type=Path, required=True)
args = parser.parse_args()
cfg = json.loads((args.workdir / "credentials.json").read_text())
directory = args.workdir / "host-data"
directory.mkdir(mode=0o700)
config = directory / "config.json"
config.write_text(
    json.dumps(
        {
            "enabled": True,
            "auth_origin": "http://127.0.0.1:4180",
            "public_key": cfg["anon_key"],
        }
    )
)
config.chmod(0o600)
root = Path(__file__).resolve().parents[2]
subprocess.run(
    [
        "docker",
        "run",
        "-d",
        "--network",
        "host",
        "--name",
        cfg["prefix"] + "-friends-php",
        "--label",
        "io.ryadom.local-e2e=" + cfg["instance"],
        "--mount",
        f"type=bind,src={root},dst=/app,readonly",
        "--mount",
        f"type=bind,src={directory.resolve()},dst=/data",
        "-e",
        "RYADOM_FRIENDS_LOCAL_E2E=1",
        "-e",
        "RYADOM_FRIENDS_DATA_DIR=/data",
        "-e",
        "RYADOM_FRIENDS_HTTP_MODULE=/app/server/friends-http.php",
        "php@sha256:8dbeb51c352cf1f70d5d50f3642c9fbed311e914475ea2382f5bc1525bef7bb3",
        "php",
        "-S",
        "127.0.0.1:8187",
        "-t",
        "/app/public",
    ],
    check=True,
    stdout=subprocess.DEVNULL,
)
print("Real PHP friends API started on loopback; Auth is local only.")
