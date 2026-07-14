import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import { usePlayerDashboard, useLinkPlayer, useUnlinkPlayer, useTeams, useTeam } from '../hooks';
import { useAuth } from '../context/AuthContext';
import { StatsCards, type StatTrends } from '../components/analytics/StatsOverview';
import PlayerRadarChart from '../components/charts/PlayerRadarChart';
import TeamTrendChart from '../components/charts/TeamTrendChart';
import { CHART_SERIES } from '../lib/chartColors';
import { POSITION_LABELS } from '../types';
import type {
  PlayerRecord, MatchSummaryItem, DevelopmentPoint, TeamStatsBreakdown,
  UpcomingMatchItem, CareerStats,
} from '../types';
import UpcomingGamesCard from '../components/ui/UpcomingGamesCard';

/** Volleyball convention: 0.410 -> .410, 1.000 -> 1.000, -0.125 -> -.125 */
function percentage(value: number | null | undefined) {
  if (value === null || value === undefined) return '-';
  if (Math.abs(value) >= 1) return value.toFixed(3);
  const sign = value < 0 ? '-' : '';
  return `${sign}.${Math.abs(value).toFixed(3).split('.')[1]}`;
}

function won(match: MatchSummaryItem) {
  return match.homeSetsWon > match.awaySetsWon;
}

// ─────────────────────────────── Row A ───────────────────────────────

function ProfileHero({ player, teamNames, matchesRecorded }: {
  player: PlayerRecord;
  teamNames: string;
  matchesRecorded: number;
}) {
  // The mockup's Height / Age / Spike-reach chips have no equivalent on
  // PlayerRecord, so this shows facts the API actually returns instead.
  const chips = [
    { label: 'Jersey', value: `#${player.jerseyNumber}` },
    { label: 'Position', value: POSITION_LABELS[player.position] },
    { label: 'Matches recorded', value: matchesRecorded },
  ];

  return (
    <div className="card p-6 flex items-center gap-6">
      <div className="relative shrink-0 w-[88px] h-[88px] rounded-[20px] bg-grey-200 border border-navy-500 grid place-items-center">
        <span className="font-display font-bold text-[34px] text-grey-900">
          {player.firstName[0]}{player.lastName[0]}
        </span>
        <span className="absolute -right-1 -bottom-1 px-2 py-0.5 rounded-[9px] border-2 border-white
                         bg-gold-500 text-navy-900 font-display font-bold text-xs tabular-nums">
          #{player.jerseyNumber}
        </span>
      </div>

      <div className="min-w-0">
        <h2 className="font-display font-bold text-[27px] leading-tight tracking-tight text-grey-900 truncate">
          {player.firstName} {player.lastName}
        </h2>
        <p className="text-sm text-grey-600 mt-0.5 truncate">
          {POSITION_LABELS[player.position]} · {teamNames}
        </p>

        <div className="flex flex-wrap gap-x-7 gap-y-3 mt-4">
          {chips.map((chip) => (
            <div key={chip.label}>
              <p className="text-[11px] text-grey-600">{chip.label}</p>
              <p className="text-[15px] font-semibold text-grey-900 tabular-nums mt-0.5">{chip.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function KillEfficiencyHero({ careerStats, series }: {
  careerStats: CareerStats;
  series: { opponent: string; hittingPercentage: number | null }[];
}) {
  const points = series.filter((p) => p.hittingPercentage !== null);
  const first = points[0]?.hittingPercentage ?? null;
  const latest = points[points.length - 1]?.hittingPercentage ?? null;

  // Only claim a trend when there are at least two real match data points to
  // compare, and the baseline is positive (a % change off <= 0 is meaningless).
  const change =
    points.length >= 2 && first !== null && latest !== null && first > 0
      ? (latest - first) / first
      : null;

  return (
    <div className="card p-6 flex flex-col justify-between gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.06em] text-grey-600">
          Kill efficiency
        </p>
        {change !== null && (
          <span
            title="Latest recorded match vs. first recorded match"
            className={`badge ${change >= 0 ? 'bg-success/15 text-success' : 'bg-error/15 text-error'}`}
          >
            {change >= 0 ? '▲' : '▼'} {Math.abs(Math.round(change * 100))}%
          </span>
        )}
      </div>

      <div className="flex items-end gap-4">
        <span className="font-bold text-[42px] leading-none tabular-nums text-grey-900">
          {percentage(careerStats.hittingPercentage)}
        </span>

        {points.length >= 2 && (
          <div className="w-[120px] h-[46px] mb-1.5">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={points} margin={{ top: 4, right: 2, bottom: 2, left: 2 }}>
                <defs>
                  <linearGradient id="hero-kill-eff" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_SERIES[0]} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={CHART_SERIES[0]} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="hittingPercentage"
                  stroke={CHART_SERIES[0]}
                  strokeWidth={2.6}
                  fill="url(#hero-kill-eff)"
                  dot={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {change !== null ? (
        <p className="text-xs text-grey-600">
          {change >= 0 ? 'Up' : 'Down'} from {percentage(first)} in your first recorded match —
          across {points.length} matches.
        </p>
      ) : (
        <p className="text-xs text-grey-600">
          Career hitting percentage across {careerStats.attackAttempts} attack attempts.
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────── Row D ───────────────────────────────

type MatchRow = MatchSummaryItem & { kills?: number; digs?: number; aces?: number };

function RecentMatchesPanel({ rows }: { rows: MatchRow[] }) {
  // The mockup has a "Rating" column; this app has no player-rating metric, so
  // it's dropped rather than faked. K/D/A come from developmentMetrics, which
  // only exists for matches that had events recorded — hence the em dashes.
  return (
    <div className="card p-5 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-semibold text-[17px] text-grey-900">Recent matches</h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-sm">
          <thead>
            <tr className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-grey-600 border-b border-grey-200">
              <th className="text-left pb-2 font-semibold">Opponent</th>
              <th className="text-left pb-2 font-semibold">Result</th>
              <th className="text-right pb-2 font-semibold">K</th>
              <th className="text-right pb-2 font-semibold">D</th>
              <th className="text-right pb-2 font-semibold">A</th>
              <th className="pb-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-grey-200">
            {rows.map((match) => (
              <tr key={match.id} className="tabular-nums text-grey-900">
                <td className="py-3 pr-3 font-medium max-w-[180px] truncate">vs {match.opponent}</td>
                <td className="py-3 pr-3 font-semibold whitespace-nowrap">
                  {match.status === 'COMPLETED' ? (
                    <span className={won(match) ? 'text-success' : 'text-error'}>
                      {won(match) ? 'W' : 'L'} {match.homeSetsWon}–{match.awaySetsWon}
                    </span>
                  ) : (
                    <span className="text-grey-400 font-medium">{match.status.replace('_', ' ')}</span>
                  )}
                </td>
                <td className="py-3 text-right">{match.kills ?? '—'}</td>
                <td className="py-3 text-right">{match.digs ?? '—'}</td>
                <td className="py-3 text-right">{match.aces ?? '—'}</td>
                <td className="py-3 pl-3 text-right">
                  <Link
                    to={`/matches/${match.id}/dashboard`}
                    className="text-xs text-grey-400 hover:text-navy-700 transition-colors"
                  >
                    View →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NextMatchPanel({ next, form }: { next?: UpcomingMatchItem; form: MatchSummaryItem[] }) {
  return (
    <div className="card p-5 sm:p-6 flex flex-col gap-5">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-grey-600">Next match</p>
        {next ? (
          <div className="mt-3">
            <p className="font-display font-bold text-[22px] tracking-tight text-grey-900 truncate">
              {next.opponent}
            </p>
            <p className="text-[13px] text-grey-600 mt-1">
              {new Date(next.matchDate).toLocaleString([], {
                weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
              })}
              {next.venue && ` · ${next.venue}`}
              {next.competition && ` · ${next.competition}`}
            </p>
            <p className="text-xs text-grey-400 mt-1">{next.team.name}</p>
          </div>
        ) : (
          <p className="text-sm text-grey-600 mt-3">No upcoming matches scheduled.</p>
        )}
      </div>

      {form.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-grey-600">Recent form</p>
          <div className="flex gap-1.5 mt-2">
            {form.map((match) => (
              <span
                key={match.id}
                title={`${won(match) ? 'W' : 'L'} ${match.homeSetsWon}–${match.awaySetsWon} vs ${match.opponent}`}
                className={`w-[26px] h-[26px] rounded-lg grid place-items-center text-xs font-bold ${
                  won(match) ? 'bg-success/[0.18] text-success' : 'bg-error/[0.18] text-error'
                }`}
              >
                {won(match) ? 'W' : 'L'}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────── Existing panels (kept) ───────────────────────

function TeamStatsSection({ entry }: { entry: TeamStatsBreakdown }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-grey-50 transition-colors"
      >
        <div>
          <span className="text-grey-900 font-medium text-sm">{entry.team.name}</span>
          <span className="text-grey-600 text-xs ml-2">Season {entry.team.season}</span>
        </div>
        <span className="text-grey-600 text-xs tabular-nums">
          {entry.stats.totalEvents} events {open ? '▾' : '▸'}
        </span>
      </button>
      {open && (
        <div className="p-4 border-t border-grey-200">
          {entry.stats.totalEvents > 0 ? (
            <StatsCards stats={entry.stats} />
          ) : (
            <p className="text-grey-600 text-sm">No recorded events for this team yet.</p>
          )}
        </div>
      )}
    </div>
  );
}

function LinkedPlayerCard({ player, onUnlink }: { player: PlayerRecord; onUnlink: () => void }) {
  return (
    <div className="card p-4 flex items-center gap-4">
      <div className="w-10 h-10 bg-grey-50 border border-grey-200 rounded-lg flex items-center justify-center
                      font-semibold tabular-nums text-navy-700 shrink-0">
        {player.jerseyNumber}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-grey-900 text-sm">
          {player.firstName} {player.lastName}
        </p>
        <p className="text-grey-600 text-xs">{player.team.name} · {player.position.replace(/_/g, ' ')}</p>
      </div>
      <div className="flex gap-2 shrink-0">
        <Link to={`/players/${player.id}/dashboard`} className="btn-secondary text-xs px-3 py-1.5">
          Analytics
        </Link>
        <button
          className="text-grey-400 hover:text-error text-xs transition-colors"
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
      setError(err?.response?.data?.error ?? "Couldn't link that player. Try again.");
    }
  }

  return (
    <div className="card p-5 space-y-4 border-dashed">
      <div>
        <p className="font-semibold text-grey-900 text-sm">Link a Player Record</p>
        <p className="text-grey-600 text-xs mt-0.5">
          Connect your account to a player roster entry to unlock career statistics and development tracking.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-grey-600 mb-1">Select Team</label>
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
          <label className="block text-xs text-grey-600 mb-1">Select Player</label>
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

      {error && <p className="text-error text-xs">{error}</p>}

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

// ─────────────────────────────── Page ───────────────────────────────

export default function PlayerPortalPage() {
  const { user } = useAuth();
  const { data, isLoading } = usePlayerDashboard();
  const unlinkPlayer = useUnlinkPlayer();

  const { players, careerStats, recentMatches, developmentMetrics, upcomingMatches, statsByTeam } =
    data ?? ({} as Partial<NonNullable<typeof data>>);

  // Oldest → newest, so every trend series reads left-to-right chronologically.
  const timeline = useMemo(
    () =>
      [...(developmentMetrics ?? [])].sort(
        (a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime(),
      ),
    [developmentMetrics],
  );

  const trendData = useMemo(
    () =>
      timeline.map((d: DevelopmentPoint) => ({
        opponent: d.opponent.length > 10 ? `${d.opponent.slice(0, 10)}…` : d.opponent,
        kills: d.kills,
        aces: d.aces,
        digs: d.digs,
        blocks: d.totalBlocks,
        hittingPercentage: d.hittingPercentage,
      })),
    [timeline],
  );

  // Per-match history behind the KPI cards' sparklines and trend badges. Every
  // series is real recorded data — no synthetic baselines.
  const statTrends: StatTrends = useMemo(
    () => ({
      Kills: timeline.map((d) => d.kills),
      'Hitting %': timeline.map((d) => d.hittingPercentage),
      Aces: timeline.map((d) => d.aces),
      Passing: timeline.map((d) => d.passingRating),
      Blocks: timeline.map((d) => d.totalBlocks),
      Digs: timeline.map((d) => d.digs),
    }),
    [timeline],
  );

  // Newest → oldest for the table and the form chips.
  const matchesByRecency = useMemo(
    () =>
      [...(recentMatches ?? [])].sort(
        (a, b) => new Date(b.matchDate).getTime() - new Date(a.matchDate).getTime(),
      ),
    [recentMatches],
  );

  // K/D/A only exist on developmentMetrics, keyed by matchId — join them onto
  // the match list so the table can show them where events were recorded.
  const matchRows: MatchRow[] = useMemo(() => {
    const byMatchId = new Map(timeline.map((d) => [d.matchId, d]));
    return matchesByRecency.slice(0, 5).map((match) => {
      const stats = byMatchId.get(match.id);
      return stats
        ? { ...match, kills: stats.kills, digs: stats.digs, aces: stats.aces }
        : match;
    });
  }, [matchesByRecency, timeline]);

  const recentForm = useMemo(
    () => matchesByRecency.filter((m) => m.status === 'COMPLETED').slice(0, 5),
    [matchesByRecency],
  );

  if (isLoading) return <p className="text-grey-600">Loading player dashboard…</p>;
  if (!data) return <p className="text-error">Couldn't load player dashboard.</p>;

  const primaryPlayer = players?.[0];
  const teamNames = [...new Set((players ?? []).map((p) => p.team.name))].join(' · ');
  const hasStats = !!careerStats && careerStats.totalEvents > 0;

  return (
    <div className="space-y-5">
      {/* Row A — profile + kill efficiency */}
      {primaryPlayer ? (
        <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <ProfileHero
            player={primaryPlayer}
            teamNames={teamNames}
            matchesRecorded={timeline.length}
          />
          {hasStats && careerStats && (
            <KillEfficiencyHero careerStats={careerStats} series={trendData} />
          )}
        </div>
      ) : (
        <div className="card p-6">
          <h1 className="font-display font-bold text-xl text-grey-900">
            Welcome, {user?.firstName}
          </h1>
          <p className="text-grey-600 text-sm mt-1">
            Link a player record below to see your career statistics and development.
          </p>
        </div>
      )}

      {hasStats && careerStats ? (
        <>
          {/* Row B — KPIs */}
          <StatsCards stats={careerStats} trends={statTrends} />

          {/* Row C — kill efficiency over time + skill profile */}
          <div className="grid gap-4 lg:grid-cols-[1.75fr_1fr]">
            {trendData.length >= 2 ? (
              <TeamTrendChart title="Kill efficiency" data={trendData} dataKey="hittingPercentage" />
            ) : (
              <div className="card p-6 grid place-items-center text-sm text-grey-600">
                Record events across at least two matches to see your kill-efficiency trend.
              </div>
            )}
            <PlayerRadarChart stats={careerStats} />
          </div>

          {/* Row D — recent matches + next match */}
          <div className="grid gap-4 lg:grid-cols-[1.75fr_1fr]">
            {matchRows.length > 0 ? (
              <RecentMatchesPanel rows={matchRows} />
            ) : (
              <div className="card p-6 grid place-items-center text-sm text-grey-600">
                No matches played yet.
              </div>
            )}
            <NextMatchPanel next={upcomingMatches?.[0]} form={recentForm} />
          </div>
        </>
      ) : (
        primaryPlayer && (
          <div className="card p-8 text-center">
            <p className="text-grey-900 font-medium">No match data yet</p>
            <p className="text-grey-600 text-sm mt-1">
              Career statistics will appear once match events are recorded.
            </p>
          </div>
        )
      )}

      {/* Linked player records */}
      <section className="space-y-3 pt-3">
        <h2 className="text-sm font-semibold text-grey-600">My Player Records</h2>
        {(players ?? []).length === 0 ? (
          <LinkPlayerPanel />
        ) : (
          <>
            <div className="space-y-2">
              {players?.map((player: PlayerRecord) => (
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

      {/* Per-team breakdown */}
      {hasStats && (statsByTeam ?? []).length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-grey-600">Stats by team</h2>
          <div className="space-y-2">
            {statsByTeam?.map((entry: TeamStatsBreakdown) => (
              <TeamStatsSection key={entry.playerId} entry={entry} />
            ))}
          </div>
        </section>
      )}

      {/* Development trends */}
      {trendData.length >= 2 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-grey-600">Development Trends</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <TeamTrendChart title="Kills per Match" data={trendData} dataKey="kills" />
            <TeamTrendChart title="Aces per Match" data={trendData} dataKey="aces" />
            <TeamTrendChart title="Digs per Match" data={trendData} dataKey="digs" />
            <TeamTrendChart title="Blocks per Match" data={trendData} dataKey="blocks" />
          </div>
        </section>
      )}

      {/* Upcoming games */}
      {(upcomingMatches ?? []).length > 0 && (
        <section>
          <UpcomingGamesCard matches={upcomingMatches!} />
        </section>
      )}
    </div>
  );
}
