import { Router } from 'express';
import { getTeams, getTeam, createTeam, updateTeam, deleteTeam } from '../controllers/teams';
import { myTeams, claimTeam, transferTeam, teamOwner } from '../controllers/teamOwnership';
import { listMembers, createMember, updateMember, deleteMember } from '../controllers/teamMembership';
import { createTeamInvitation, listTeamInvitations } from '../controllers/invitation';
import { requireAuth } from '../middleware/auth';
import { requireTeamPermission } from '../middleware/permissions';
import { Permission, getUserTeamRole, getPermissionsForRole } from '../services/permission.service';

const router = Router();

// Named routes first (must come before /:id to avoid conflict)
router.get('/my-teams', requireAuth, myTeams);

// Standard CRUD — reads are public, mutations require auth + permission
router.get('/', getTeams);
router.get('/:id', getTeam);
router.post('/', requireAuth, createTeam);
router.patch('/:id', requireAuth, requireTeamPermission(Permission.MANAGE_TEAM), updateTeam);
router.delete('/:id', requireAuth, requireTeamPermission(Permission.MANAGE_TEAM), deleteTeam);

// My role on this team — used by the frontend PermissionGuard
router.get('/:id/my-role', requireAuth, async (req, res, next) => {
  try {
    const { role, isOwner } = await getUserTeamRole(req.user!.userId, req.params.id);
    const permissions = role ? getPermissionsForRole(role) : [];
    res.json({ role, isOwner, permissions });
  } catch (err) {
    next(err);
  }
});

// Ownership actions
router.get('/:id/owner', teamOwner);
router.post('/:id/claim', requireAuth, claimTeam);
router.post('/:id/transfer', requireAuth, requireTeamPermission(Permission.TRANSFER_OWNERSHIP), transferTeam);

// Membership management
router.get('/:id/members', listMembers);
router.post('/:id/members',   requireAuth, requireTeamPermission(Permission.MANAGE_MEMBERS), createMember);
router.patch('/:id/members/:memberId', requireAuth, requireTeamPermission(Permission.MANAGE_MEMBERS), updateMember);
router.delete('/:id/members/:memberId', requireAuth, requireTeamPermission(Permission.MANAGE_MEMBERS), deleteMember);

// Invitation management
router.get('/:id/invitations',  requireAuth, listTeamInvitations);
router.post('/:id/invitations', requireAuth, requireTeamPermission(Permission.INVITE_USERS), createTeamInvitation);

export default router;
