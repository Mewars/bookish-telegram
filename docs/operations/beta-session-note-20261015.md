# Session privacy (classifieds beta)

The classifieds beta is gated to Ryadom-Test and is not publicly exposed.

The React child `ClassifiedsSession` is keyed by `[city, userId]`. Switching cities, signing out, or switching accounts must unmount private UI state, including conversations, messages, moderation reports, block lists and unsent drafts.

Server-side RLS is the authoritative security boundary. A React remount is a defence against stale UI state, not a replacement for RLS.

Before merging: run the full CI suite and the two dedicated session tests. A real two-account switch test has not been performed. Do not deploy beta to production.
