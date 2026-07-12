// Shared Prisma where-fragment for event queries that feed statistics.
//
// Opponent events (isOpponentEvent=true) exist for live scoring and opponent
// scouting only. They must NEVER be aggregated into our own team/match/player
// statistics — an opponent's kills are not our kills. Spread this fragment
// into every stats-feeding event query so the filter can't be forgotten:
//
//   prisma.event.findMany({ where: { matchId, ...ownEventsOnly }, ... })
//
// The opponent scouting endpoint is the one intentional exception — it queries
// isOpponentEvent: true explicitly.
export const ownEventsOnly = { isOpponentEvent: false } as const;
