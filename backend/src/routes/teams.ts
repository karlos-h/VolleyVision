import { Router } from 'express';
import { getTeams, getTeam, createTeam, updateTeam, deleteTeam } from '../controllers/teams';
import { myTeams, claimTeam, transferTeam, teamOwner } from '../controllers/teamOwnership';
import { listMembers, createMember, updateMember, deleteMember } from '../controllers/teamMembership';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Named routes first (must come before /:id to avoid conflict)
router.get('/my-teams', requireAuth, myTeams);

// Standard CRUD
router.get('/', getTeams);
router.get('/:id', getTeam);
router.post('/', createTeam);
router.patch('/:id', updateTeam);
router.delete('/:id', deleteTeam);

// Ownership actions
router.get('/:id/owner', teamOwner);
router.post('/:id/claim', requireAuth, claimTeam);
router.post('/:id/transfer', requireAuth, transferTeam);

// Membership management
router.get('/:id/members', listMembers);
router.post('/:id/members', requireAuth, createMember);
router.patch('/:id/members/:memberId', requireAuth, updateMember);
router.delete('/:id/members/:memberId', requireAuth, deleteMember);

export default router;
