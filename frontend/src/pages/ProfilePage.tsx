import { useState, useEffect } from 'react';
import { useProfile, useUpdateProfile, usePlayerBests } from '../hooks';
import type { PlayerBestEntry } from '../types';

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin', COACH: 'Coach', PLAYER: 'Player', VIEWER: 'Viewer',
};

function BestStatCard({ label, entry, format }: { label: string; entry: PlayerBestEntry | null; format?: (v: number) => string }) {
  if (!entry) return null;
  return (
    <div className="bg-court-800/60 rounded-lg p-3 text-center">
      <div className="font-mono font-bold text-xl text-spike-400">
        {format ? format(entry.value) : entry.value}
      </div>
      <div className="text-xs text-chalk-400 mt-0.5">{label}</div>
      <div className="text-xs text-chalk-600 mt-1 truncate" title={`vs ${entry.opponent}`}>
        vs {entry.opponent}
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { data: profile, isLoading } = useProfile();
  const { data: bests } = usePlayerBests();
  const updateProfile = useUpdateProfile();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    bio: '',
    phoneNumber: '',
    city: '',
    country: '',
    profileImage: '',
    dateOfBirth: '',
    heightCm: '',
    weightKg: '',
  });
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (profile) {
      setForm({
        firstName: profile.firstName ?? '',
        lastName: profile.lastName ?? '',
        bio: profile.bio ?? '',
        phoneNumber: profile.phoneNumber ?? '',
        city: profile.city ?? '',
        country: profile.country ?? '',
        profileImage: profile.profileImage ?? '',
        dateOfBirth: profile.dateOfBirth ? profile.dateOfBirth.split('T')[0] : '',
        heightCm: profile.heightCm != null ? String(profile.heightCm) : '',
        weightKg: profile.weightKg != null ? String(profile.weightKg) : '',
      });
    }
  }, [profile]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaveError('');
    setSaveSuccess(false);
    try {
      await updateProfile.mutateAsync({
        firstName: form.firstName || undefined,
        lastName: form.lastName || undefined,
        bio: form.bio || undefined,
        phoneNumber: form.phoneNumber || undefined,
        city: form.city || undefined,
        country: form.country || undefined,
        profileImage: form.profileImage || undefined,
        dateOfBirth: form.dateOfBirth || null,
        heightCm: form.heightCm === '' ? null : Number(form.heightCm),
        weightKg: form.weightKg === '' ? null : Number(form.weightKg),
      } as any);
      setEditing(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setSaveError(err?.response?.data?.error ?? "Couldn't save your profile. Check your connection and try again.");
    }
  }

  if (isLoading) return <p className="text-chalk-400">Loading profile…</p>;
  if (!profile) return <p className="text-error-dark">Couldn't load profile.</p>;

  const initials = `${profile.firstName[0] ?? ''}${profile.lastName[0] ?? ''}`;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-chalk-100">Profile</h1>
        <p className="text-chalk-400 text-sm mt-0.5">Manage your personal information</p>
      </div>

      {saveSuccess && (
        <div className="bg-success/30 border border-success rounded-xl px-4 py-3 text-success-dark text-sm">
          Profile updated successfully.
        </div>
      )}

      {/* Identity card */}
      <div className="card p-6">
        <div className="flex items-center gap-5">
          {profile.profileImage ? (
            <img
              src={profile.profileImage}
              alt={`${profile.firstName} ${profile.lastName}`}
              className="w-16 h-16 rounded-full object-cover ring-2 ring-court-700"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-spike-600 flex items-center justify-center text-xl font-bold text-white">
              {initials}
            </div>
          )}
          <div>
            <h2 className="text-xl font-bold text-chalk-100">
              {profile.firstName} {profile.lastName}
            </h2>
            <p className="text-chalk-400 text-sm">{profile.email}</p>
            <span className="badge bg-court-700 text-chalk-400 text-xs mt-1 inline-block">
              {ROLE_LABELS[profile.role] ?? profile.role}
            </span>
          </div>
        </div>

        {/* Bio */}
        {profile.bio && (
          <p className="mt-4 text-chalk-300 text-sm border-t border-court-800 pt-4">{profile.bio}</p>
        )}

        {/* Details grid */}
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm border-t border-court-800 pt-4">
          {profile.phoneNumber && (
            <>
              <span className="text-chalk-500">Phone</span>
              <span className="text-chalk-200">{profile.phoneNumber}</span>
            </>
          )}
          {(profile.city || profile.country) && (
            <>
              <span className="text-chalk-500">Location</span>
              <span className="text-chalk-200">
                {[profile.city, profile.country].filter(Boolean).join(', ')}
              </span>
            </>
          )}
          {profile.dateOfBirth && (
            <>
              <span className="text-chalk-500">Date of Birth</span>
              <span className="text-chalk-200">
                {new Date(profile.dateOfBirth).toLocaleDateString()}
              </span>
            </>
          )}
          {profile.heightCm != null && (
            <>
              <span className="text-chalk-500">Height</span>
              <span className="text-chalk-200">{profile.heightCm} cm</span>
            </>
          )}
          {profile.weightKg != null && (
            <>
              <span className="text-chalk-500">Weight</span>
              <span className="text-chalk-200">{profile.weightKg} kg</span>
            </>
          )}
          <span className="text-chalk-500">Member since</span>
          <span className="text-chalk-200">{new Date(profile.createdAt).toLocaleDateString()}</span>
        </div>

        <button
          className="btn-secondary text-sm mt-4"
          onClick={() => setEditing(!editing)}
        >
          {editing ? 'Cancel' : 'Edit Profile'}
        </button>
      </div>

      {/* Top game stats — only for users with linked player records that have data */}
      {bests && (bests.kills || bests.aces || bests.blocks || bests.digs || bests.hittingPercentage) && (
        <div className="card p-6">
          <h2 className="font-semibold text-chalk-100 mb-1">Top game stats</h2>
          <p className="text-chalk-500 text-xs mb-4">Career-best single-match performances</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <BestStatCard label="Kills" entry={bests.kills} />
            <BestStatCard label="Aces" entry={bests.aces} />
            <BestStatCard label="Blocks" entry={bests.blocks} format={(v) => v.toFixed(1)} />
            <BestStatCard label="Digs" entry={bests.digs} />
            <BestStatCard label="Hitting %" entry={bests.hittingPercentage} format={(v) => v.toFixed(3)} />
          </div>
        </div>
      )}

      {/* Edit form */}
      {editing && (
        <div className="card p-6">
          <h2 className="font-semibold text-chalk-100 mb-4">Edit Profile</h2>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-chalk-400 mb-1">First Name</label>
                <input
                  className="input"
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs text-chalk-400 mb-1">Last Name</label>
                <input
                  className="input"
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-chalk-400 mb-1">Bio</label>
              <textarea
                className="input min-h-[80px] resize-y"
                value={form.bio}
                placeholder="Tell your team about yourself…"
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-chalk-400 mb-1">Phone Number</label>
                <input
                  className="input"
                  type="tel"
                  value={form.phoneNumber}
                  onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs text-chalk-400 mb-1">Date of Birth</label>
                <input
                  className="input"
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs text-chalk-400 mb-1">City</label>
                <input
                  className="input"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs text-chalk-400 mb-1">Country</label>
                <input
                  className="input"
                  value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs text-chalk-400 mb-1">Height (cm)</label>
                <input
                  className="input"
                  type="number"
                  min={100}
                  max={250}
                  placeholder="e.g. 185"
                  value={form.heightCm}
                  onChange={(e) => setForm({ ...form, heightCm: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs text-chalk-400 mb-1">Weight (kg)</label>
                <input
                  className="input"
                  type="number"
                  min={30}
                  max={200}
                  placeholder="e.g. 78"
                  value={form.weightKg}
                  onChange={(e) => setForm({ ...form, weightKg: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-chalk-400 mb-1">Profile Image URL</label>
              <input
                className="input"
                type="url"
                placeholder="https://…"
                value={form.profileImage}
                onChange={(e) => setForm({ ...form, profileImage: e.target.value })}
              />
            </div>

            {saveError && <p className="text-error-dark text-sm">{saveError}</p>}

            <button type="submit" className="btn-primary" disabled={updateProfile.isPending}>
              {updateProfile.isPending ? 'Saving…' : 'Save Changes'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
