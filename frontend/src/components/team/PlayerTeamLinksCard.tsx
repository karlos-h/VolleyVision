import { useState } from 'react';
import { usePlayerTeams, useAddPlayerTeamLink, useRemovePlayerTeamLink } from '../../hooks';
import { useTeams } from '../../hooks';

interface Props {
  playerId:      string;
  homeTeamId:    string;
  playerName:    string;
}

export default function PlayerTeamLinksCard({ playerId, homeTeamId, playerName }: Props) {
  const { data, isLoading } = usePlayerTeams(playerId);
  const { data: allTeams } = useTeams();
  const addLink    = useAddPlayerTeamLink(playerId);
  const removeLink = useRemovePlayerTeamLink(playerId);

  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [error, setError] = useState('');

  // Teams the coach can link to: exclude home team and already-linked teams
  const linkedIds = new Set([homeTeamId, ...(data?.linkedTeams.map((l) => l.team.id) ?? [])]);
  const availableTeams = (allTeams ?? []).filter((t) => !linkedIds.has(t.id));

  async function handleAdd() {
    if (!selectedTeamId) return;
    setError('');
    try {
      await addLink.mutateAsync(selectedTeamId);
      setSelectedTeamId('');
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Couldn't link that team. Try again.");
    }
  }

  if (isLoading) return <p className="text-xs text-chalk-500 py-1">Loading linked teams…</p>;

  return (
    <div className="mt-2 pt-2 border-t border-court-800 space-y-2">
      <p className="text-[10px]r text-chalk-500 font-semibold">
        {playerName}'s teams
      </p>

      {/* Home team badge */}
      <div className="flex flex-wrap gap-2">
        <span className="text-xs px-2 py-0.5 rounded-full bg-spike-600/20 text-spike-400 border border-spike-600/30">
          {data?.homeTeam.name} (home)
        </span>
        {data?.linkedTeams.map((l) => (
          <span
            key={l.linkId}
            className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full bg-chalk-500/10 border border-chalk-600/30 text-chalk-300"
          >
            {l.team.name}
            <button
              className="text-chalk-600 hover:text-error-dark transition-colors leading-none"
              onClick={() => removeLink.mutate(l.team.id)}
              title={`Remove link to ${l.team.name}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>

      {/* Add link */}
      {availableTeams.length > 0 && (
        <div className="flex gap-2 items-center">
          <select
            className="input text-xs py-1 flex-1"
            value={selectedTeamId}
            onChange={(e) => setSelectedTeamId(e.target.value)}
          >
            <option value="">Link to another team…</option>
            {availableTeams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <button
            className="btn-secondary text-xs px-3 py-1 shrink-0"
            disabled={!selectedTeamId || addLink.isPending}
            onClick={handleAdd}
          >
            {addLink.isPending ? 'Linking…' : 'Link'}
          </button>
        </div>
      )}
      {error && <p className="text-error-dark text-xs">{error}</p>}
    </div>
  );
}
