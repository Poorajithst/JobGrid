import { useState, useCallback, useRef } from 'react';
import { usersApi, documentsApi, profilesApi } from '../api/client';
import type { Document } from '../api/types';

const AVATAR_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#a855f7', '#06b6d4'];

interface OnboardingWizardProps {
  onComplete: (user: { id: number; name: string; avatarColor: string }) => void;
}

interface WizardState {
  name: string;
  avatarColor: string;
  document: Document | null;
  skills: { name: string; enabled: boolean }[];
  certs: string[];
  tools: string[];
  titles: string[];
  locations: string[];
  remoteOk: boolean;
}

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [state, setState] = useState<WizardState>({
    name: '',
    avatarColor: AVATAR_COLORS[0],
    document: null,
    skills: [],
    certs: [],
    tools: [],
    titles: [],
    locations: [],
    remoteOk: false,
  });

  const [titleInput, setTitleInput] = useState('');
  const [locationInput, setLocationInput] = useState('');

  const totalSteps = 6;

  /* ── Step 1: Welcome ── */

  const handleStep1Continue = () => {
    if (!state.name.trim()) return;
    setStep(2);
  };

  /* ── Step 2: Upload Resume ── */

  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleUpload = useCallback(async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const doc = await documentsApi.upload(file, 'resume');
      setState((s) => ({
        ...s,
        document: doc,
        skills: parseJsonArray(doc.parsedSkills).map((sk) => ({ name: sk, enabled: true })),
        certs: parseJsonArray(doc.parsedCerts),
        tools: parseJsonArray(doc.parsedTools),
        titles: parseJsonArray(doc.parsedTitles),
        locations: parseJsonArray(doc.parsedLocations),
      }));
    } catch {
      setError('Failed to upload resume. Please try again.');
    } finally {
      setUploading(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file?.type === 'application/pdf') handleUpload(file);
    },
    [handleUpload],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleUpload(file);
      e.target.value = '';
    },
    [handleUpload],
  );

  /* ── Step 3: Review Skills ── */

  const toggleSkill = (idx: number) => {
    setState((s) => {
      const skills = [...s.skills];
      skills[idx] = { ...skills[idx], enabled: !skills[idx].enabled };
      return { ...s, skills };
    });
  };

  /* ── Step 4: Target Roles ── */

  const addTitle = () => {
    const t = titleInput.trim();
    if (!t || state.titles.includes(t)) return;
    setState((s) => ({ ...s, titles: [...s.titles, t] }));
    setTitleInput('');
  };

  const removeTitle = (title: string) => {
    setState((s) => ({ ...s, titles: s.titles.filter((t) => t !== title) }));
  };

  /* ── Step 5: Target Locations ── */

  const addLocation = () => {
    const l = locationInput.trim();
    if (!l || state.locations.includes(l)) return;
    setState((s) => ({ ...s, locations: [...s.locations, l] }));
    setLocationInput('');
  };

  const removeLocation = (loc: string) => {
    setState((s) => ({ ...s, locations: s.locations.filter((l) => l !== loc) }));
  };

  /* ── Step 6: Confirmation ── */

  const handleFinish = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Create user
      const user = await usersApi.create({ name: state.name, avatarColor: state.avatarColor });

      // Create profile
      const enabledSkills = state.skills.filter((s) => s.enabled).map((s) => s.name);
      const allLocations = state.remoteOk ? [...state.locations, 'Remote'] : state.locations;

      await profilesApi.create({
        name: `${state.name}'s Profile`,
        target_titles: state.titles.join(', '),
        target_skills: enabledSkills.join(', '),
        target_certs: state.certs.join(', '),
        target_locations: allLocations.join(', '),
        weight_title: 0.20,
        weight_skill: 0.25,
        weight_location: 0.10,
        weight_experience: 0.15,
        weight_education: 0.10,
        weight_cert: 0.10,
        weight_freshness: 0.10,
        ai_threshold: 60,
        is_active: true,
      });

      onComplete({ id: user.id, name: user.name, avatarColor: user.avatarColor || state.avatarColor });
    } catch {
      setError('Failed to create profile. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [state, onComplete]);

  /* ── Render ── */

  const enabledSkillsCount = state.skills.filter((s) => s.enabled).length;
  const doc = state.document;

  return (
    <div className="fixed inset-0 z-[100] bg-[#080b14] flex items-center justify-center">
      <div className="w-full max-w-xl mx-4">
        {/* Step indicator dots */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {Array.from({ length: totalSteps }, (_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i + 1 === step
                  ? 'w-8 bg-accent-indigo'
                  : i + 1 < step
                    ? 'w-1.5 bg-accent-indigo/50'
                    : 'w-1.5 bg-border-subtle'
              }`}
            />
          ))}
        </div>

        {/* Card */}
        <div className="bg-gradient-to-br from-[#0f172a]/90 to-[#0c1120] border border-border-subtle rounded-2xl p-8 shadow-[0_16px_64px_rgba(0,0,0,0.5)]">
          {error && (
            <div className="mb-5 px-4 py-2.5 rounded-lg text-xs font-medium bg-accent-red/10 text-accent-red-light border border-accent-red/20">
              {error}
            </div>
          )}

          {/* ── Step 1: Welcome ── */}
          {step === 1 && (
            <div>
              <h1 className="text-2xl font-extrabold text-[#f1f5f9] tracking-tight mb-1">
                Welcome to JobGrid
              </h1>
              <p className="text-xs text-text-muted mb-6">
                Let's set up your profile so we can find the best jobs for you.
              </p>

              <label className="block mb-5">
                <span className="text-[11px] text-text-secondary font-medium">Your Name</span>
                <input
                  type="text"
                  value={state.name}
                  onChange={(e) => setState((s) => ({ ...s, name: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && handleStep1Continue()}
                  className="mt-1.5 w-full bg-bg-primary/40 border border-border-subtle rounded-lg p-3 text-sm text-text-primary outline-none focus:border-accent-indigo/40 transition-colors"
                  placeholder="e.g. Alex Chen"
                  autoFocus
                />
              </label>

              <div className="mb-6">
                <span className="text-[11px] text-text-secondary font-medium">Pick a Color</span>
                <div className="flex gap-3 mt-2">
                  {AVATAR_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setState((s) => ({ ...s, avatarColor: c }))}
                      className={`w-9 h-9 rounded-full transition-all ${
                        state.avatarColor === c
                          ? 'ring-2 ring-white/30 ring-offset-2 ring-offset-[#0f172a] scale-110'
                          : 'hover:scale-105 opacity-70 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <button
                onClick={handleStep1Continue}
                disabled={!state.name.trim()}
                className="w-full py-3 rounded-xl text-sm font-semibold bg-gradient-to-br from-accent-indigo to-[#4f46e5] text-white shadow-[0_2px_12px_rgba(99,102,241,0.3)] hover:shadow-[0_4px_20px_rgba(99,102,241,0.4)] hover:-translate-y-0.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              >
                Continue
              </button>
            </div>
          )}

          {/* ── Step 2: Upload Resume ── */}
          {step === 2 && (
            <div>
              <h2 className="text-xl font-extrabold text-[#f1f5f9] tracking-tight mb-1">
                Upload Your Resume
              </h2>
              <p className="text-xs text-text-muted mb-6">
                We'll extract your skills, titles, and certifications automatically.
              </p>

              {!doc ? (
                <>
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => fileRef.current?.click()}
                    className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-14 cursor-pointer transition-all mb-4
                      ${dragOver
                        ? 'border-accent-indigo/60 bg-accent-indigo/[0.06]'
                        : 'border-border-subtle hover:border-accent-indigo/30 hover:bg-accent-indigo/[0.03]'
                      }
                      ${uploading ? 'opacity-60 pointer-events-none' : ''}
                    `}
                  >
                    <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={handleFileChange} />
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-dim mb-3">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
                      <polyline points="17 8 12 3 7 8" strokeLinecap="round" strokeLinejoin="round" />
                      <line x1="12" y1="3" x2="12" y2="15" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {uploading ? (
                      <span className="text-sm text-accent-indigo-light font-semibold">Uploading & parsing...</span>
                    ) : (
                      <>
                        <span className="text-sm text-text-muted">Drop your resume PDF here</span>
                        <span className="text-[10px] text-text-dim mt-1">or click to browse</span>
                      </>
                    )}
                  </div>

                  <button
                    onClick={() => setStep(3)}
                    className="w-full text-center text-xs text-text-dim hover:text-text-muted transition-colors py-2"
                  >
                    Skip for now
                  </button>
                </>
              ) : (
                <>
                  <div className="bg-accent-indigo/[0.06] border border-accent-indigo/20 rounded-xl p-5 mb-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-accent-indigo/20 flex items-center justify-center">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent-indigo-light">
                          <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-text-primary">{doc.filename}</div>
                        <div className="text-[10px] text-text-dim">Parsed successfully</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <ExtractedCount label="Skills" count={state.skills.length} color="indigo" />
                      <ExtractedCount label="Titles" count={state.titles.length} color="cyan" />
                      <ExtractedCount label="Certs" count={state.certs.length} color="amber" />
                    </div>
                  </div>

                  <button
                    onClick={() => setStep(3)}
                    className="w-full py-3 rounded-xl text-sm font-semibold bg-gradient-to-br from-accent-indigo to-[#4f46e5] text-white shadow-[0_2px_12px_rgba(99,102,241,0.3)] hover:shadow-[0_4px_20px_rgba(99,102,241,0.4)] hover:-translate-y-0.5 transition-all"
                  >
                    Continue
                  </button>
                </>
              )}
            </div>
          )}

          {/* ── Step 3: Review Skills ── */}
          {step === 3 && (
            <div>
              <h2 className="text-xl font-extrabold text-[#f1f5f9] tracking-tight mb-1">
                Review Your Skills
              </h2>
              <p className="text-xs text-text-muted mb-5">
                Toggle off any skills that aren't relevant to your job search.
              </p>

              {state.skills.length > 0 && (
                <div className="mb-4">
                  <div className="text-[9px] font-bold uppercase tracking-[1.2px] text-text-dim mb-2">
                    Skills ({enabledSkillsCount} selected)
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto scrollbar-thin scrollbar-thumb-bg-card pr-1">
                    {state.skills.map((sk, i) => (
                      <button
                        key={sk.name}
                        onClick={() => toggleSkill(i)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all ${
                          sk.enabled
                            ? 'bg-accent-indigo/15 text-accent-indigo-light border-accent-indigo/25 hover:bg-accent-indigo/25'
                            : 'bg-bg-card/20 text-text-dim border-border-subtle hover:text-text-muted'
                        }`}
                      >
                        {sk.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {state.certs.length > 0 && (
                <div className="mb-4">
                  <div className="text-[9px] font-bold uppercase tracking-[1.2px] text-text-dim mb-2">Certifications</div>
                  <div className="flex flex-wrap gap-1.5">
                    {state.certs.map((c) => (
                      <span key={c} className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-accent-amber/10 text-accent-amber-light border border-accent-amber/20">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {state.tools.length > 0 && (
                <div className="mb-5">
                  <div className="text-[9px] font-bold uppercase tracking-[1.2px] text-text-dim mb-2">Tools</div>
                  <div className="flex flex-wrap gap-1.5">
                    {state.tools.map((t) => (
                      <span key={t} className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-accent-green/10 text-accent-green-light border border-accent-green/20">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {state.skills.length === 0 && state.certs.length === 0 && state.tools.length === 0 && (
                <div className="text-center text-text-dim text-xs py-8 mb-4">
                  No skills extracted. You can add them later in your profile.
                </div>
              )}

              <button
                onClick={() => setStep(4)}
                className="w-full py-3 rounded-xl text-sm font-semibold bg-gradient-to-br from-accent-indigo to-[#4f46e5] text-white shadow-[0_2px_12px_rgba(99,102,241,0.3)] hover:shadow-[0_4px_20px_rgba(99,102,241,0.4)] hover:-translate-y-0.5 transition-all"
              >
                Continue
              </button>
            </div>
          )}

          {/* ── Step 4: Target Roles ── */}
          {step === 4 && (
            <div>
              <h2 className="text-xl font-extrabold text-[#f1f5f9] tracking-tight mb-1">
                Target Roles
              </h2>
              <p className="text-xs text-text-muted mb-5">
                What job titles are you looking for?
              </p>

              <div className="flex flex-wrap gap-1.5 mb-3 min-h-[32px]">
                {state.titles.map((t) => (
                  <span
                    key={t}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-accent-cyan/10 text-accent-cyan-light border border-accent-cyan/20 flex items-center gap-1.5"
                  >
                    {t}
                    <button
                      onClick={() => removeTitle(t)}
                      className="text-accent-cyan hover:text-accent-red-light transition-colors"
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>

              <div className="flex gap-2 mb-6">
                <input
                  type="text"
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTitle(); } }}
                  className="flex-1 bg-bg-primary/40 border border-border-subtle rounded-lg p-2.5 text-xs text-text-primary outline-none focus:border-accent-indigo/40 transition-colors"
                  placeholder="Type a title and press Enter"
                />
                <button
                  onClick={addTitle}
                  className="px-4 py-2.5 rounded-lg text-xs font-semibold bg-bg-card/50 text-text-secondary border border-border-subtle hover:text-text-primary hover:border-border transition-all"
                >
                  Add
                </button>
              </div>

              <button
                onClick={() => setStep(5)}
                className="w-full py-3 rounded-xl text-sm font-semibold bg-gradient-to-br from-accent-indigo to-[#4f46e5] text-white shadow-[0_2px_12px_rgba(99,102,241,0.3)] hover:shadow-[0_4px_20px_rgba(99,102,241,0.4)] hover:-translate-y-0.5 transition-all"
              >
                Continue
              </button>
            </div>
          )}

          {/* ── Step 5: Target Locations ── */}
          {step === 5 && (
            <div>
              <h2 className="text-xl font-extrabold text-[#f1f5f9] tracking-tight mb-1">
                Target Locations
              </h2>
              <p className="text-xs text-text-muted mb-5">
                Where do you want to work?
              </p>

              <div className="flex flex-wrap gap-1.5 mb-3 min-h-[32px]">
                {state.locations.map((l) => (
                  <span
                    key={l}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-accent-green/10 text-accent-green-light border border-accent-green/20 flex items-center gap-1.5"
                  >
                    {l}
                    <button
                      onClick={() => removeLocation(l)}
                      className="text-accent-green hover:text-accent-red-light transition-colors"
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>

              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={locationInput}
                  onChange={(e) => setLocationInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLocation(); } }}
                  className="flex-1 bg-bg-primary/40 border border-border-subtle rounded-lg p-2.5 text-xs text-text-primary outline-none focus:border-accent-indigo/40 transition-colors"
                  placeholder="Type a location and press Enter"
                />
                <button
                  onClick={addLocation}
                  className="px-4 py-2.5 rounded-lg text-xs font-semibold bg-bg-card/50 text-text-secondary border border-border-subtle hover:text-text-primary hover:border-border transition-all"
                >
                  Add
                </button>
              </div>

              {/* Remote toggle */}
              <div className="flex items-center gap-3 mb-6 px-1">
                <button
                  onClick={() => setState((s) => ({ ...s, remoteOk: !s.remoteOk }))}
                  className={`w-9 h-5 rounded-full relative transition-colors ${state.remoteOk ? 'bg-accent-green/40' : 'bg-bg-card/60'}`}
                >
                  <div
                    className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${
                      state.remoteOk ? 'left-[18px] bg-accent-green-light shadow-[0_0_6px_rgba(16,185,129,0.5)]' : 'left-0.5 bg-text-dim'
                    }`}
                  />
                </button>
                <span className="text-xs text-text-secondary font-medium">Open to remote</span>
              </div>

              <button
                onClick={() => setStep(6)}
                className="w-full py-3 rounded-xl text-sm font-semibold bg-gradient-to-br from-accent-indigo to-[#4f46e5] text-white shadow-[0_2px_12px_rgba(99,102,241,0.3)] hover:shadow-[0_4px_20px_rgba(99,102,241,0.4)] hover:-translate-y-0.5 transition-all"
              >
                Continue
              </button>
            </div>
          )}

          {/* ── Step 6: Confirmation ── */}
          {step === 6 && (
            <div>
              <h2 className="text-xl font-extrabold text-[#f1f5f9] tracking-tight mb-1">
                You're All Set
              </h2>
              <p className="text-xs text-text-muted mb-6">
                Here's a summary of your job search profile.
              </p>

              <div className="bg-bg-primary/30 border border-border-subtle rounded-xl p-5 mb-6 space-y-3">
                <SummaryRow label="Name" value={state.name} />
                {state.titles.length > 0 && (
                  <SummaryRow label="Looking for" value={state.titles.join(', ')} />
                )}
                {(state.locations.length > 0 || state.remoteOk) && (
                  <SummaryRow
                    label="In"
                    value={[...state.locations, ...(state.remoteOk ? ['Remote'] : [])].join(', ')}
                  />
                )}
                <SummaryRow label="Skills" value={`${enabledSkillsCount} selected`} />
                {state.certs.length > 0 && (
                  <SummaryRow label="Certifications" value={state.certs.join(', ')} />
                )}
              </div>

              <button
                onClick={handleFinish}
                disabled={loading}
                className="w-full py-3 rounded-xl text-sm font-semibold bg-gradient-to-br from-accent-indigo to-[#4f46e5] text-white shadow-[0_2px_12px_rgba(99,102,241,0.3)] hover:shadow-[0_4px_20px_rgba(99,102,241,0.4)] hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              >
                {loading ? 'Setting up...' : 'Start Finding Jobs'}
              </button>
            </div>
          )}

          {/* Back button (steps 2-6) */}
          {step > 1 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="w-full text-center text-xs text-text-dim hover:text-text-muted transition-colors py-2 mt-3"
            >
              Back
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Helpers ── */

function parseJsonArray(val: string | null): string[] {
  if (!val) return [];
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function ExtractedCount({ label, count, color }: { label: string; count: number; color: string }) {
  const colorMap: Record<string, string> = {
    indigo: 'text-accent-indigo-light',
    cyan: 'text-accent-cyan-light',
    amber: 'text-accent-amber-light',
  };
  return (
    <div className="text-center">
      <div className={`text-lg font-extrabold ${colorMap[color]}`}>{count}</div>
      <div className="text-[9px] font-semibold uppercase tracking-widest text-text-dim">{label}</div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="text-[10px] font-bold uppercase tracking-widest text-text-dim w-28 shrink-0">{label}</span>
      <span className="text-xs text-text-secondary">{value}</span>
    </div>
  );
}
