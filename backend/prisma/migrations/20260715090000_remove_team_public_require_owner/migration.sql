-- Retire the public/private team model and make ownership mandatory.
--
-- Teams are now always private to the people who belong to them (owner,
-- accepted members, or a global ADMIN), so `is_public` has no meaning.
--
-- `owner_id` becomes NOT NULL. Ownerless teams were leftover dev/test data and
-- are removed by scripts/cleanup-orphaned-teams.ts, which MUST have been run
-- before this migration — it fails otherwise.
--
-- The owner FK was ON DELETE SET NULL (valid for a nullable column). With a
-- NOT NULL column that would raise a constraint violation when a user is
-- deleted, so it is recreated as ON DELETE RESTRICT: a user who still owns a
-- team cannot be deleted until the team is transferred or removed.

-- Guard: refuse to run while any ownerless team remains.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "teams" WHERE "owner_id" IS NULL) THEN
    RAISE EXCEPTION 'Ownerless teams still exist — run scripts/cleanup-orphaned-teams.ts first.';
  END IF;
END $$;

ALTER TABLE "teams" DROP CONSTRAINT "teams_owner_id_fkey";

ALTER TABLE "teams" DROP COLUMN "is_public";

ALTER TABLE "teams" ALTER COLUMN "owner_id" SET NOT NULL;

ALTER TABLE "teams" ADD CONSTRAINT "teams_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
