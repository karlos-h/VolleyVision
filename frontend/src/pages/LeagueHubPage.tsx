import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useMyLeagueSeasons, useLeagues, useCreateLeague, useCreateSeason } from '../hooks';
import LeagueOverviewCards from '../components/league/LeagueOverviewCards';

function CreateLeagueForm({ onDone }: { onDone: () => void }) {
  const create = useCreateLeague();
  const [name, setName] = useState('');
  const [division, setDivision] = useState('');
  const [err, setErr] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    try {
      await create.mutateAsync({ name, division: division || undefined });
      onDone();
    } catch {
      setErr("Couldn't create the league. Try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card p-5 space-y-3 mt-4">
      <h3 className="font-semibold text-chalk-200 text-sm">New League</h3>
      {err && <p className="text-error-dark text-xs">{err}</p>}
      <input className="input w-full" placeholder="League name *" value={name} onChange={(e) => setName(e.target.value)} required />
      <input className="input w-full" placeholder="Division (optional)" value={division} onChange={(e) => setDivision(e.target.value)} />
      <div className="flex gap-2">
        <button type="submit" disabled={create.isPending} className="btn-primary text-sm py-1.5">
          {create.isPending ? 'Creating…' : 'Create'}
        </button>
        <button type="button" onClick={onDone} className="btn-secondary text-sm py-1.5">Cancel</button>
      </div>
    </form>
  );
}

function CreateSeasonForm({ onDone }: { onDone: () => void }) {
  const { data: leagues = [] } = useLeagues();
  const create = useCreateSeason();
  const [leagueId, setLeagueId] = useState('');
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [err, setErr] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!leagueId) { setErr('Select a league.'); return; }
    setErr('');
    try {
      await create.mutateAsync({ leagueId, name, startDate, endDate: endDate || undefined });
      onDone();
    } catch {
      setErr("Couldn't create the season. Try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card p-5 space-y-3 mt-4">
      <h3 className="font-semibold text-chalk-200 text-sm">New Season</h3>
      {err && <p className="text-error-dark text-xs">{err}</p>}
      <select className="input w-full" value={leagueId} onChange={(e) => setLeagueId(e.target.value)} required>
        <option value="">Select league *</option>
        {leagues.map((l) => (
          <option key={l.id} value={l.id}>{l.name}{l.division ? ` (${l.division})` : ''}</option>
        ))}
      </select>
      <input className="input w-full" placeholder="Season name *" value={name} onChange={(e) => setName(e.target.value)} required />
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="text-xs text-chalk-500 mb-1 block">Start date *</label>
          <input className="input w-full" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
        </div>
        <div className="flex-1">
          <label className="text-xs text-chalk-500 mb-1 block">End date</label>
          <input className="input w-full" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={create.isPending} className="btn-primary text-sm py-1.5">
          {create.isPending ? 'Creating…' : 'Create'}
        </button>
        <button type="button" onClick={onDone} className="btn-secondary text-sm py-1.5">Cancel</button>
      </div>
    </form>
  );
}

export default function LeagueHubPage() {
  const { user } = useAuth();
  const { data: mySeasons = [], isLoading } = useMyLeagueSeasons();
  const isAdmin = user?.role === 'ADMIN';

  const [showCreateLeague, setShowCreateLeague] = useState(false);
  const [showCreateSeason, setShowCreateSeason] = useState(false);

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-chalk-100">League Hub</h1>
          <p className="text-chalk-400 text-sm mt-0.5">Seasons and fixtures for your teams</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <button
              className="btn-secondary text-sm"
              onClick={() => { setShowCreateSeason(false); setShowCreateLeague((v) => !v); }}
            >
              + League
            </button>
            <button
              className="btn-secondary text-sm"
              onClick={() => { setShowCreateLeague(false); setShowCreateSeason((v) => !v); }}
            >
              + Season
            </button>
          </div>
        )}
      </div>

      {showCreateLeague && <CreateLeagueForm onDone={() => setShowCreateLeague(false)} />}
      {showCreateSeason && <CreateSeasonForm onDone={() => setShowCreateSeason(false)} />}

      {isLoading ? (
        <p className="text-chalk-400 text-sm">Loading…</p>
      ) : (
        <LeagueOverviewCards seasons={mySeasons} />
      )}
    </div>
  );
}
