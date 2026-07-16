-- Iteration 3 — Manager role + per-member access tiers.
--
-- MANAGER is added to TeamRole but not referenced elsewhere in this migration,
-- so the "unsafe use of new enum value in same transaction" rule (PG) doesn't
-- apply. The backfill below only references pre-existing role values.

ALTER TYPE "TeamRole" ADD VALUE 'MANAGER';

-- Per-member access tier for the three tiered mutation categories.
CREATE TYPE "AccessTier" AS ENUM ('VIEW_ONLY', 'APPROVAL_REQUIRED', 'FULL_ACCESS');

-- New columns default to APPROVAL_REQUIRED (today's behaviour for non-head-coaches).
ALTER TABLE "team_memberships"
  ADD COLUMN "roster_access"     "AccessTier" NOT NULL DEFAULT 'APPROVAL_REQUIRED',
  ADD COLUMN "invitation_access" "AccessTier" NOT NULL DEFAULT 'APPROVAL_REQUIRED',
  ADD COLUMN "match_access"      "AccessTier" NOT NULL DEFAULT 'APPROVAL_REQUIRED';

-- Backfill role-appropriate defaults for existing memberships.
--   HEAD_COACH        → FULL_ACCESS on all three (matches prior immediate-apply behaviour)
--   PLAYER / VIEWER   → VIEW_ONLY (they never had these permissions)
--   ASSISTANT / STAT  → keep the APPROVAL_REQUIRED default (matches prior queue behaviour)
UPDATE "team_memberships"
  SET "roster_access" = 'FULL_ACCESS', "invitation_access" = 'FULL_ACCESS', "match_access" = 'FULL_ACCESS'
  WHERE "role" = 'HEAD_COACH';

UPDATE "team_memberships"
  SET "roster_access" = 'VIEW_ONLY', "invitation_access" = 'VIEW_ONLY', "match_access" = 'VIEW_ONLY'
  WHERE "role" IN ('PLAYER', 'VIEWER');
