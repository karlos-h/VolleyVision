-- Mark the score-affecting action that completed a set.
--
-- checkSetCompletion runs synchronously inside the same request as the write
-- that triggered it, and its completion effects are destructive to the undo
-- baseline: it zeroes home_score/away_score, banks a set_scores entry, and
-- increments the winner's sets-won.
--
-- Undo reverses an action against the match's CURRENT score. For the point that
-- closed a set, that score has already been zeroed, so `0 - delta` just clamps
-- back to 0 and the banked set stays — the set-winning tap silently no-ops.
--
-- The completing action cannot be identified after the fact (a heuristic like
-- "the reversal wanted to go negative" is wrong whenever a score is legitimately
-- already 0), so it is recorded at the moment it happens instead. When the flag
-- is set, undo pops the banked set_scores entry and uses it as the baseline
-- rather than the zeroed running score. See lib/undo.ts.
--
-- Both default to false:
--   - score_adjustments: needed on every manual score tap.
--   - events:            only consulted while a match is under
--                        manual_score_override, where undo cannot replay the
--                        timeline and reverses the event directly.
--
-- Existing rows keep false, so historical actions undo exactly as they do today
-- (plain delta reversal). We can't retroactively know which of them closed a
-- set, and guessing would corrupt real set history.

ALTER TABLE "score_adjustments"
  ADD COLUMN "completed_set" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "events"
  ADD COLUMN "completed_set" BOOLEAN NOT NULL DEFAULT false;
