"""Resource screening must fail closed without claiming legal or restore readiness."""
import importlib.util
from pathlib import Path
import subprocess
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location(
    "preflight", Path(__file__).resolve().parents[1] / "scripts/ru-migration-preflight.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class PreflightTest(unittest.TestCase):
    def test_resource_boundaries_and_unverified_gates(self):
        for cpu, memory, disk, docker, compose in [
                (1, 8, 80, True, True), (4, 2, 80, True, True),
                (4, 8, 20, True, True), (4, 8, 80, False, True),
                (4, 8, 80, True, False)]:
            with self.subTest(cpu=cpu, memory=memory, disk=disk, docker=docker, compose=compose):
                report = module.assess("Linux", cpu, memory * module.GIB,
                                       disk * module.GIB, docker, compose)
                self.assertFalse(report["resource_screen_passed"])
        report = module.assess("Linux", 4, 7.7 * module.GIB, 80 * module.GIB, True, True)
        self.assertTrue(report["resource_screen_passed"])
        for gate in ["migration_authorized", "location_verified", "legal_review_completed", "restore_test_passed"]:
            self.assertFalse(report[gate])
        self.assertFalse(module.assess("Windows", 4, 8 * module.GIB, 80 * module.GIB,
                                      True, True)["resource_screen_passed"])
        small = module.assess("Linux", 2, 3.8 * module.GIB, 40 * module.GIB, True, True)
        self.assertTrue(small["resource_screen_passed"])
        self.assertTrue(small["warnings"])

    def test_missing_or_stalled_docker_does_not_pass(self):
        for failure in [FileNotFoundError(), subprocess.TimeoutExpired("docker", 15)]:
            with self.subTest(failure=type(failure).__name__), patch.object(
                    module.subprocess, "run", side_effect=failure):
                self.assertFalse(module.succeeds(["docker", "info"]))


if __name__ == "__main__":
    unittest.main()
