import { useState, useCallback, useEffect } from 'react';
import { profilesApi } from '../api/client';
import type { Profile } from '../api/types';

interface ProfileManagerProps {
  onProfileActivated?: (profileId: number) => void;
}

const WEIGHT_KEYS = [
  { key: 'weight_title', label: 'Title' },
  { key: 'weight_skill', label: 'Skills' },
  { key: 'weight_location', label: 'Location' },
  { key: 'weight_experience', label: 'Experience' },
  { key: 'weight_education', label: 'Education' },
  { key: 'weight_cert', label: 'Certifications' },
  { key: 'weight_freshness', label: 'Freshness' },
] as const;

const DEFAULT_WEIGHTS: Record<string, number> = {
  weight_title: 0.20,
  weight_skill: 0.25,
  weight_location: 0.10,
  weight_experience: 0.15,
  weight_education: 0.10,
  weight_cert: 0.10,
  weight_freshness: 0.10,
};

export function ProfileManager({ onProfileActivated }: ProfileManagerProps) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [editing, setEditing] = useState<Partial<Profile> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfiles = useCallback(async () => {
    try {
      const list = await profilesApi.list();
      setProfiles(list);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  const startCreate = () => {
    setEditing({
      name: '',
      target_titles: '',
      target_skills: '',
      target_certs: '',
      target_locations: '',
      ai_threshold: 60,
      is_active: true,
      ...DEFAULT_WEIGHTS,
    });
  };

  const handleSave = async () => {
    if (!editing?.name) return;
    setLoading(true);
    setError(null);
    try {
      if (editing.id) {
        const { id, ...data } = editing;
        await profilesApi.update(id, data);
      } else {
        await profilesApi.create(editing as Profile);
      }
      await fetchProfiles();
      setEditing(null);
    } catch {
      setError('Failed to save profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await profilesApi.remove(id);
      await fetchProfiles();
    } catch {
      setError('Failed to delete profile.');
    }
  };

  const handleToggleActive = async (profile: Profile) => {
    try {
      const updated = await profilesApi.update(profile.id, { is_active: !profile.is_active });
      await fetchProfiles();
      if (updated.is_active && onProfileActivated) onProfileActivated(updated.id);
    } catch {
      setError('Failed to toggle profile.');
    }
  };

  const handleAutoPopulate = async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      await profilesApi.autoPopulate(id);
      await fetchProfiles();
    } catch {
      setError('Failed to auto-populate. Upload documents first.');
    } finally {
      setLoading(false);
    }
  };

  const normalizeWeights = (weights: Record<string, number>, changedKey: string, newVal: number) => {
    const result = { ...weights, [changedKey]: newVal };
    const otherKeys = WEIGHT_KEYS.map((w) => w.key).filter((k) => k !== changedKey);
    const otherSum = otherKeys.reduce((s, k) => s + (result[k] ?? 0), 0);
    const remaining = Math.max(0, 1 - newVal);
    if (otherSum > 0) {
      for (const k of otherKeys) {
        result[k] = Number(((result[k] / otherSum) * remaining).toFixed(4));
      }
    } else {
      const share = remaining / otherKeys.length;
      for (const k of otherKeys) result[k] = Number(share.toFixed(4));
    }
    return result;
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-[22px] font-bold text-[#f1f5f9] tracking-tight mb-1">Scoring Profiles</h2>
          <p className="text-xs text-text-muted">Configure how jobs are scored against your qualifications.</p>
        </div>
        {!editing && (
          <button
            onClick={startCreate}
            className="bg-gradient-to-br from-accent-indigo to-[#4f46e5] text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-[0_2px_8px_rgba(99,102,241,0.3)] hover:shadow-[0_4px_16px_rgba(99,102,241,0.4)] hover:-translate-y-0.5 transition-all"
          >
            New Profile
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 px-4 py-2.5 rounded-lg text-xs font-medium bg-accent-red/10 text-accent-red-light border border-accent-red/20">
          {error}
        </div>
      )}

      {/* Profile list */}
      {!editing && (
        <div className="space-y-2">
          {profiles.map((p) => (
            <div
              key={p.id}
              className="bg-gradient-to-br from-[#0f172a]/70 to-[#0f172a]/30 border border-border-subtle rounded-xl p-4 px-[18px] flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleToggleActive(p)}
                  className={`w-9 h-5 rounded-full relative transition-colors ${p.is_active ? 'bg-accent-green/40' : 'bg-bg-card/60'}`}
                >
                  <div
                    className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${
                      p.is_active ? 'left-[18px] bg-accent-green-light shadow-[0_0_6px_rgba(16,185,129,0.5)]' : 'left-0.5 bg-text-dim'
                    }`}
                  />
                </button>
                <div>
                  <div className="text-sm font-semibold text-text-primary">{p.name}</div>
                  <div className="text-[10px] text-text-dim mt-0.5">
                    AI threshold: {p.ai_threshold} | Titles: {p.target_titles ? p.target_titles.split(',').length : 0}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleAutoPopulate(p.id)}
                  disabled={loading}
                  className="px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-accent-cyan/10 text-accent-cyan-light border border-accent-cyan/20 hover:bg-accent-cyan/20 transition-all disabled:opacity-50"
                >
                  Auto-populate
                </button>
                <button
                  onClick={() => setEditing({ ...p })}
                  className="px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-bg-card/50 text-text-secondary border border-border-subtle hover:text-text-primary hover:border-border transition-all"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(p.id)}
                  className="px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-accent-red/10 text-accent-red-light border border-accent-red/20 hover:bg-accent-red/20 transition-all"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
          {profiles.length === 0 && (
            <div className="text-text-dim text-xs text-center py-12">No profiles yet. Create one to start scoring.</div>
          )}
        </div>
      )}

      {/* Edit / Create form */}
      {editing && (
        <div className="bg-gradient-to-br from-[#0f172a]/70 to-[#0f172a]/30 border border-border-subtle rounded-xl p-5 px-6">
          <div className="text-[9px] font-bold uppercase tracking-[1.2px] text-text-dim mb-4">
            {editing.id ? 'Edit Profile' : 'New Profile'}
          </div>

          {/* Name */}
          <label className="block mb-3">
            <span className="text-[11px] text-text-secondary font-medium">Name</span>
            <input
              type="text"
              value={editing.name ?? ''}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              className="mt-1 w-full bg-bg-primary/40 border border-border-subtle rounded-lg p-2.5 text-xs text-text-primary outline-none focus:border-accent-indigo/40"
              placeholder="e.g. Senior Frontend Engineer"
            />
          </label>

          {/* Tag inputs */}
          <TagInput
            label="Target Titles"
            value={editing.target_titles ?? ''}
            onChange={(v) => setEditing({ ...editing, target_titles: v })}
            placeholder="Type a title and press Enter"
          />
          <TagInput
            label="Target Skills"
            value={editing.target_skills ?? ''}
            onChange={(v) => setEditing({ ...editing, target_skills: v })}
            placeholder="Type a skill and press Enter"
          />
          <TagInput
            label="Target Certifications"
            value={editing.target_certs ?? ''}
            onChange={(v) => setEditing({ ...editing, target_certs: v })}
            placeholder="Type a cert and press Enter"
          />
          <TagInput
            label="Target Locations"
            value={editing.target_locations ?? ''}
            onChange={(v) => setEditing({ ...editing, target_locations: v })}
            placeholder="Type a location and press Enter"
          />

          {/* AI Threshold */}
          <label className="block mb-4">
            <span className="text-[11px] text-text-secondary font-medium">AI Threshold</span>
            <input
              type="number"
              min={0}
              max={100}
              value={editing.ai_threshold ?? 60}
              onChange={(e) => setEditing({ ...editing, ai_threshold: Number(e.target.value) })}
              className="mt-1 w-20 bg-bg-primary/40 border border-border-subtle rounded-lg p-2.5 text-xs text-text-primary outline-none focus:border-accent-indigo/40"
            />
          </label>

          {/* Weight sliders */}
          <div className="mb-4">
            <div className="text-[9px] font-bold uppercase tracking-[1.2px] text-text-dim mb-3">
              Dimension Weights <span className="text-text-muted">(auto-normalized to 100%)</span>
            </div>
            <div className="space-y-2.5">
              {WEIGHT_KEYS.map(({ key, label }) => {
                const val = (editing as Record<string, number>)[key] ?? DEFAULT_WEIGHTS[key];
                return (
                  <div key={key} className="flex items-center gap-3">
                    <span className="text-[11px] text-text-secondary font-medium w-24">{label}</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={Math.round(val * 100)}
                      onChange={(e) => {
                        const newVal = Number(e.target.value) / 100;
                        const normalized = normalizeWeights(
                          Object.fromEntries(WEIGHT_KEYS.map((w) => [w.key, (editing as Record<string, number>)[w.key] ?? DEFAULT_WEIGHTS[w.key]])),
                          key,
                          newVal,
                        );
                        setEditing({ ...editing, ...normalized });
                      }}
                      className="flex-1 accent-accent-indigo h-1.5"
                    />
                    <span className="text-[11px] font-bold text-text-primary w-10 text-right">
                      {Math.round(val * 100)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={loading || !editing.name}
              className="bg-gradient-to-br from-accent-indigo to-[#4f46e5] text-white px-5 py-2 rounded-lg text-xs font-semibold shadow-[0_2px_8px_rgba(99,102,241,0.3)] hover:shadow-[0_4px_16px_rgba(99,102,241,0.4)] transition-all disabled:opacity-50"
            >
              {loading ? 'Saving...' : editing.id ? 'Update' : 'Create'}
            </button>
            <button
              onClick={() => setEditing(null)}
              className="px-5 py-2 rounded-lg text-xs font-semibold bg-bg-card/50 text-text-secondary border border-border-subtle hover:text-text-primary transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Tag Input ── */

function TagInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const [input, setInput] = useState('');
  const tags = value ? value.split(',').map((t) => t.trim()).filter(Boolean) : [];

  const addTag = () => {
    const trimmed = input.trim();
    if (!trimmed || tags.includes(trimmed)) return;
    onChange([...tags, trimmed].join(', '));
    setInput('');
  };

  const removeTag = (tag: string) => {
    onChange(tags.filter((t) => t !== tag).join(', '));
  };

  return (
    <div className="mb-3">
      <span className="text-[11px] text-text-secondary font-medium">{label}</span>
      <div className="flex flex-wrap gap-1.5 mt-1 mb-1.5">
        {tags.map((t) => (
          <span
            key={t}
            className="px-2 py-0.5 rounded text-[10px] font-medium bg-accent-indigo/10 text-accent-indigo-light border border-accent-indigo/20 flex items-center gap-1"
          >
            {t}
            <button onClick={() => removeTag(t)} className="text-accent-indigo hover:text-accent-red-light ml-0.5">&times;</button>
          </span>
        ))}
      </div>
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            addTag();
          }
        }}
        className="w-full bg-bg-primary/40 border border-border-subtle rounded-lg p-2.5 text-xs text-text-primary outline-none focus:border-accent-indigo/40"
        placeholder={placeholder}
      />
    </div>
  );
}
