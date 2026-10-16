# Closed beta host audit follow-up — 2026-10-16

PR #117 adds real CSS bundle protection probes and rejects two incorrect HTTP Basic Auth combinations (wrong username and wrong password).

The failing CI run 38856146387 used an overescaped regex literal: it searched for literal backslashes instead of HTML word boundaries and the CSS extension. The fixture already contained a valid stylesheet link. Corrected the regex without removing the mandatory same-origin CSS check.

Regression tests now assert the specific rejection reason for public CSS, accepted incorrect credentials, missing CSS, wrong CSS MIME type, production backend identifiers and synthetic secret markers. The successful path also asserts both denied and authorized CSS requests and both invalid credential probes. This prevents unrelated early failures from making negative tests pass.

Local validation: all 11 host audit tests, ESLint, the full npm test regression suite and npm run build (TypeScript + Vite) passed. Dependencies were installed from package-lock.json using npm ci.

These are synthetic HTTP tests, not a live-host or Supabase E2E. The HTTPS beta host remains unverified. Do not enable public beta routes until a real isolated host passes the manual audit and the other release gates.
