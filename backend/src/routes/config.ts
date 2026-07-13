import { Router } from 'express';
import { defaultTeamIsPublic } from '../lib/teamVisibility';

const router = Router();

// Public client config — lets the frontend pre-fill env-driven defaults
// (e.g. the create-team visibility toggle) without hardcoding them.
router.get('/', (_req, res) => {
  res.json({
    defaultTeamVisibility: defaultTeamIsPublic() ? 'public' : 'private',
  });
});

export default router;
