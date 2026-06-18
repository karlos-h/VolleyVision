import { useState } from 'react';
import { Link } from 'react-router-dom';
import { usePlayerDashboard, useLinkPlayer, useUnlinkPlayer, useTeams, useTeam } from '../hooks';
import { useAuth } from '../context/AuthContext';
import { StatsCards } from '../components/analytics/StatsOverview';
import PlayerRadarChart from '../components/charts/PlayerRadarChart';
import TeamTrendChart from '../components/charts/TeamTrendChart';
import type { PlayerRecord, MatchSummaryItem, DevelopmentPoint } from '../types';

function MatchRow({ match }: { match: MatchSummaryItem }) {
  const won = match.homeSetsWon > match.awaySetsWon;
  const isCompleted = match.status === 'COMPLETED';
  return (
    <div className="flex items-center gap-4 px-5 py-3">
      <div className="flex-1 min-w-0">
        <p className="text-chalk-100 text-sm font-medium truncate">vs {match.opponent}</p>
        <p className="text-chalk-500 text-xs">
          {match.team.name} · {new Date(match.matchDate).toLocaleDateString()}
        </p>
      </div>
      {isCompleted ? (
        <span className={`badge text-xs ${won ? 'bg-emerald-800/30 text-emerald-300' : 'bg-red-900/30 text-red-400'}`}>
          {match.homeSetsWon}–{match.awaySetsWon} {won ? 'W' : 'L'}
        </span>
      ) : (
        <span className="badge bg-amber-800/30 text-amber-300 text-xs">{match.status.replace('_', ' ')}</span>
      )}
      <Link to={`/matches/${match.id}/dashboard`} className="text-chalk-600 hover:text-chalk-200 text-xs transition-colors">
        View →
      </Link>
    </div>
  );
}

function LinkedPlayerCard({ player, onUnlink }: { player: PlayerRecord; onUnlink: () => void }) {
  return (
    <div className="card p-4 flex items-center gap-4">
      <div className="w-10 h-10 bg-court-800 rounded-lg flex items-center justify-center font-mono font-bold text-spike-400 shrink-0">
        {player.jerseyNumber}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-chalk-100 text-sm">
          {player.firstName} {player.lastName}
        </p>
        <p className="text-chalk-500 text-xs">{player.team.name} · {player.position.replace(/_/g, ' ')}</p>
      </div>
      <div className="flex gap-2 shrink-0">
        <Link
          to={`/players/${player.id}/dashboard`}
          className="btn-secondary text-xs px-3 py-1.5"
        >
          Analytics
        </Link>
        <button
          className="text-chalk-600 hover:text-red-400 text-xs transition-colors"
          onClick={onUnlink}
        >
          Unlink
        </button>
      </div>
    </div>
  );
}

function LinkPlayerPanel() {
  const { data: teams } = useTeams();
  const linkPlayer = useLinkPlayer();
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [error, setError] = useState('');

  const { data: selectedTeam } = useTeam(selectedTeamId);

  async function handleLink() {
    setError('');
    if (!selectedPlayerId) { setError('Select a player first.'); return; }
    try {
      await linkPlayer.mutateAsync(selectedPlayerId);
      setSelectedTeamId('');
      setSelectedPlayerId('');
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Failed to link player.');
    }
  }

  return (
    <div className="card p-5 space-y-4 border border-dashed border-court-700">
      <div>
        <p className="font-semibold text-chalk-200 text-sm">Link a Player Record</p>
        <p className="text-chalk-500 text-xs mt-0.5">
          Connect your account to a player roster entry to unlock career statistics and development tracking.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-chalk-400 mb-1">Select Team</label>
          <select
            className="input text-sm"
            value={selectedTeamId}
            onChange={(e) => { setSelectedTeamId(e.target.value); setSelectedPlayerId(''); }}
          >
            <option value="">Choose a team…</option>
            {teams?.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-chalk-400 mb-1">Select Player</label>
          <select
            className="input text-sm"
            value={selectedPlayerId}
            onChange={(e) => setSelectedPlayerId(e.target.value)}
            disabled={!selectedTeamId}
          >
            <option value="">Choose a player…</option>
            {selectedTeam?.players?.map((p) => (
              <option key={p.id} value={p.id}>
                #{p.jerseyNumber} {p.firstName} {p.lastName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}

      <button
        className="btn-primary text-sm"
        onClick={handleLink}
        disabled={linkPlayer.isPending || !selectedPlayerId}
      >
        {linkPlayer.isPending ? 'Linking…' : 'Link Player Record'}
      </button>
    </div>
  );
}

export default function PlayerPortalPage() {
  const { user } = useAuth();
  const { data, isLoading } = usePlayerDashboard();
  const unlinkPlayer = useUnlinkPlayer();

  if (isLoading) return <p className="text-chalk-400">Loading player dashboard…</p>;
  if (!data) return <p className="text-red-400">Unable to load player dashboard.</p>;

  const { players, careerStats, recentMatches, developmentMetrics } = data;

  const trendData = developmentMetrics.map((d: DevelopmentPoint) => ({
    name: d.opponent.length > 10 ? d.opponent.slice(0, 10) + '…' : d.opponent,
    kills: d.kills,
    aces: d.aces,
    digs: d.digs,
    blocks: d.totalBlocks,
  }));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-chalk-100">Welcome, {user?.firstName}</h1>
          <p className="text-chalk-400 text-sm mt-0.5">Player Dashboard</p>
        </div>
        <Link to="/profile" className="btn-secondary text-sm shrink-0">Profile</Link>
      </div>

      {/* Linked player records */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-chalk-400 uppercase tracking-wide">My Player Records</h2>
        {players.length === 0 ? (
          <LinkPlayerPanel />
        ) : (
          <>
            <div className="space-y-2">
              {players.map((player: PlayerRecord) => (
                <LinkedPlayerCard
                  key={player.id}
                  player={player}
                  onUnlink={() => {
                    if (confirm(`Unlink ${player.firstName} ${player.lastName} from your account?`)) {
                      unlinkPlayer.mutate(player.id);
                    }
                  }}
                />
              ))}
            </div>
            <LinkPlayerPanel />
          </>
        )}
      </section>

      {/* Career stats */}
      {careerStats && careerStats.totalEvents > 0 ? (
        <>
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-chalk-400 uppercase tracking-wide">Career Statistics</h2>
            <StatsCards stats={careerStats} />
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-chalk-400 uppercase tracking-wide">Skill Profile</h2>
            <PlayerRadarChart stats={careerStats} />
          </section>
        </>
      ) : (
        players.length > 0 && (
          <div className="card p-8 text-center">
            <p className="text-chalk-300 font-medium">No match data yet</p>
            <p className="text-chalk-500 text-sm mt-1">Career statistics will appear once match events are recorded.</p>
          </div>
        )
      )}

      {/* Development trends */}
      {trendData.length >= 2 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-chalk-400 uppercase tracking-wide">Development Trends</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <TeamTrendChart title="Kills per Match" data={trendData} dataKey="kills" />
            <TeamTrendChart title="Aces per Match" data={trendData} dataKey="aces" />
            <TeamTrendChart title="Digs per Match" data={trendData} dataKey="digs" />
            <TeamTrendChart title="Blocks per Match" data={trendData} dataKey="blocks" />
          </div>
        </section>
      )}

      {/* Recent matches */}
      {recentMatches.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-chalk-400 uppercase tracking-wide mb-3">Recent Matches</h2>
          <div className="card overflow-hidden divide-y divide-court-800">
            {recentMatches.map((match: MatchSummaryItem) => (
              <MatchRow key={match.id} match={match} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
