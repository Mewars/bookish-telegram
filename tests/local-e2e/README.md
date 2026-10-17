# Local multi-user classifieds E2E

This fixture exercises the **real application build, Auth, PostgreSQL/PostgREST
and Storage** with five generated synthetic accounts. It has no cloud-write mode.
The application SQL files are loaded without changes; the pre-existing city-access
and JWT-helper dependencies are explicitly provided in `app-foundation.sql`.
This is not a full copy of the hosted database or catalog admin module.

Prerequisites: Docker, Node/npm, Python 3.12+, `playwright==1.62.0` and Chromium.
Images are pinned by digest in `images.json`. Every service port binds 127.0.0.1;
only objects labeled with the generated test-instance ID can be removed by cleanup.
A fresh workdir **outside the repository** is required. Generated keys/passwords
are stored in mode-0600 files there and never injected as a service key into the browser.

1. Run `npm ci` and install the browser runner.
2. Start `python tests/local-e2e/stack.py start --workdir /tmp/ryadom-e2e-UNIQUE`.
3. Build `npm run build:beta` with the same guarded CI-only environment used in
   `.github/workflows/classified-local-e2e.yml`. Do not use cloud keys.
4. Start `python tests/local-e2e/gateway.py --workdir /tmp/ryadom-e2e-UNIQUE`.
5. Run `python tests/local-e2e/run.py --workdir /tmp/ryadom-e2e-UNIQUE`.
   For system Chromium, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium`.
6. Run `python tests/local-e2e/friends.py --workdir /tmp/ryadom-e2e-UNIQUE` for the separate friends flow.
7. Stop the gateway and run `python tests/local-e2e/stack.py stop --workdir /tmp/ryadom-e2e-UNIQUE`.

The guarded build retains its exact Ryadom-Test origin. Only the test's Playwright
router redirects that virtual API origin to the loopback gateway. All other
external browser requests are aborted. The gateway uses the local anonymous key;
real user JWTs are issued by the local Auth service. JWT/passwords are redacted
from Python failure reports. Upload only `report.json`, never the workdir/env files.

## Covered scenarios

- Actual UI email login in four independent mobile/desktop browser contexts;
  five distinct identities authenticate over HTTP.
- Draft creation/editing, private draft/photo reads, rejection, correction,
  resubmission and publication by the assigned city editor.
- Owner self-publication and foreign-city moderation denied for the actual
  authorization reason, not merely an arbitrary failed request.
- Real canvas encoding, private Storage upload/display/delete and a deliberately
  interrupted upload batch; retry saves only the remaining file.
- A real short-lived Storage URL succeeds before expiry and is denied afterward.
- Buyer/seller UI messages in both directions; outsider reads/sends, sender
  spoofing and messages after participant blocking denied over the HTTP APIs.

The local fixture automatically confirms synthetic emails. It does **not** test
external email delivery, production OAuth, family beta acceptance, real Russian
mobile networks, production deployment or legal compliance. The browser gallery
clock/lifecycle regression remains a separate workflow. No public beta is enabled.

## Friends privacy flow

`friends.py` uses real local Auth/PostgREST, two browser sessions and synthetic GPS.
It verifies reciprocal invitations, outsider/moderator denial, approximate points,
explicit map loading, immediate hide, one-shot consent tokens, cancellation of late
GPS callbacks, nickname XSS safety and blocking. `ALLOW_PUBLIC_MAP_TILES=1` permits
only public OpenStreetMap tiles after an explicit click; names and individual
markers are never sent to the tile provider. No cloud writes are performed.
Only `friends-report.json` and the cropped `friends-map.png` are safe artifacts.
