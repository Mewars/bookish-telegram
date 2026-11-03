#!/usr/bin/env python3
"""Read-only resource screen on a candidate Linux host; never authorizes migration."""
import argparse
import json
import os
from pathlib import Path
import platform
import shutil
import subprocess

GIB = 1024 ** 3


def assess(system, cpu, memory, free_disk, docker, compose):
    # Allow Linux's reported memory to be below the advertised 4/8 GB tier.
    checks = {
        "linux": system == "Linux",
        "cpu_minimum": cpu >= 2,
        "memory_minimum": memory >= 3.5 * GIB,
        "disk_free_minimum": free_disk >= 35 * GIB,
        "docker_daemon_reachable": docker,
        "docker_compose_available": compose,
    }
    warnings = []
    if cpu < 4 or memory < 7 * GIB or free_disk < 70 * GIB:
        warnings.append("Below the preferred 4 CPU / advertised 8 GB RAM / 70 GiB free disk screen.")
    return {
        "checks": checks,
        "resource_screen_passed": all(checks.values()),
        "warnings": warnings,
        "location_verified": False,
        "legal_review_completed": False,
        "restore_test_passed": False,
        "migration_authorized": False,
    }


def succeeds(args):
    try:
        result = subprocess.run(args, stdin=subprocess.DEVNULL,
                                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                                timeout=15, check=False)
        return result.returncode == 0
    except (OSError, subprocess.TimeoutExpired):
        return False


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--path", default="/opt", help="Existing directory on the intended data filesystem")
    args = parser.parse_args()
    try:
        path = Path(args.path).resolve(strict=True)
        if not path.is_dir():
            raise ValueError("--path must be an existing directory")
        memory = int(next(line.split()[1] for line in
                          Path("/proc/meminfo").read_text().splitlines()
                          if line.startswith("MemTotal:"))) * 1024
        cpu = os.cpu_count() or 0
        disk = shutil.disk_usage(path)
    except (OSError, ValueError, StopIteration) as error:
        print(json.dumps({"resource_screen_passed": False,
                          "migration_authorized": False,
                          "error": str(error)}, ensure_ascii=False))
        return 2
    report = assess(platform.system(), cpu, memory, disk.free,
                    succeeds(["docker", "info", "--format", "{{.ServerVersion}}"]),
                    succeeds(["docker", "compose", "version"]))
    report["resources"] = {"cpu": cpu, "memory_gib": round(memory / GIB, 2),
                           "free_disk_gib": round(disk.free / GIB, 2)}
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["resource_screen_passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
