-- Add a marker for manually-overridden match score state.
--
-- Score state (home_score/away_score/home_sets_won/away_sets_won/set_scores)
-- is normally DERIVED: recalculateMatchState replays the Event +
-- ScoreAdjustment timeline from scratch after every undo/delete. That works
-- because the automatic set completion in lib/scoring.ts is a pure function of
-- that same timeline, so a replay always reproduces it.
--
-- The manual set operations (End Set / Undo Set / Reset Match) break that
-- assumption: they declare a set boundary the timeline has no record of — a
-- set force-ended at 18-12 is not something a replay could ever derive. Left
-- unguarded, the next Undo Event would replay the raw events and silently
-- erase the override along with the set history.
--
-- This flag marks a match whose set state is authored rather than derived.
-- While true, recalculateMatchState preserves set state instead of rebuilding
-- it, and event removal falls back to a targeted single-point decrement.
--
-- Defaults to false, so every existing match keeps the fully-derived
-- behaviour it has today.

ALTER TABLE "matches"
  ADD COLUMN "manual_score_override" BOOLEAN NOT NULL DEFAULT false;
