import { useState, useCallback, useRef, useEffect } from 'react';
import { setupApi, setActiveUserId } from '../api/client';

interface SetupProps {
  onComplete: (user: { id: number; name: string; avatarColor: string }) => void;
}

const ARCHETYPES = [
  { id: 'pm-tpm', label: 'Project / Program / Product Manager', icon: '📋' },
  { id: 'software-engineer', label: 'Software Engineer', icon: '💻' },
  { id: 'data-scientist', label: 'Data Scientist / ML Engineer', icon: '📊' },
  { id: 'default', label: 'Custom / Other', icon: '⚙️' },
];

const AVATAR_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
];

const TOTAL_STEPS = 8;

function parseJsonArray(val: string | null | undefined): string[] {
  if (!val) return [];
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function Setup({ onComplete }: SetupProps) {
  const [step, setStep] = useState(1);
  const [userId, setUserId] = useState<number | null>(null);

  // Step 1: Name + Avatar
  const [name, setName] = useState('');
  const [avatarColor, setAvatarColor] = useState('#6366f1');

  // Step 2: Archetype
  const [archetype, setArchetype] = useState('pm-tpm');

  // Step 3: Resume upload
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [extracted, setExtracted] = useState<{
    filename: string;
    skills: string[];
    titles: string[];
    certs: string[];
    locations: string[];
  } | null>(null);

  // Step 4: Skills review
  const [skillItems, setSkillItems] = useState<{ term: string; enabled: boolean; category: string }[]>([]);

  // Step 5: Titles + Synonyms + Excludes
  const [titles, setTitles] = useState<string[]>([]);
  const [titleInput, setTitleInput] = useState('');
  const [synonymInput, setSynonymInput] = useState('');
  const [selectedTitleForSynonym, setSelectedTitleForSynonym] = useState('');
  const [synonyms, setSynonyms] = useState<Record<string, string[]>>({});
  const [excludeInput, setExcludeInput] = useState('');
  const [excludes, setExcludes] = useState<string[]>([]);

  // Step 6: Locations + Remote
  const [locations, setLocations] = useState<string[]>([]);
  const [locationInput, setLocationInput] = useState('');
  const [remote, setRemote] = useState(false);

  // Step 7: Company loading
  const [companiesLoaded, setCompaniesLoaded] = useState<number | null>(null);
  const [companiesLoading, setCompaniesLoading] = useState(false);

  // Shared
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  /* ── Step 1: Create user ── */
  const handleStep1 = useCallback(async () => {
    if (!name.trim()) return;
    setLoading(true);
    setError('');
    try {
      const user = await setupApi.createUser({ name: name.trim(), avatarColor });
      setUserId(user.id);
      setActiveUserId(user.id);
      setStep(2);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to create user. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [name, avatarColor]);

  /* ── Step 2: Set archetype ── */
  const handleStep2 = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError('');
    try {
      await setupApi.setArchetype({ archetype, userId });
      setStep(3);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to set archetype. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [archetype, userId]);

  /* ── Step 3: Upload resume ── */
  const handleUpload = useCallback(async (file: File) => {
    if (!userId) return;
    setUploading(true);
    setError('');
    try {
      const doc = await setupApi.uploadDocument(file, 'resume', userId);
      const rawSkills = parseJsonArray(doc.parsedSkills);
      const rawTitles = parseJsonArray(doc.parsedTitles);
      const rawCerts = parseJsonArray(doc.parsedCerts);
      const rawLocations = parseJsonArray(doc.parsedLocations);

      setExtracted({
        filename: doc.filename,
        skills: rawSkills,
        titles: rawTitles,
        certs: rawCerts,
        locations: rawLocations,
      });

      // Seed skill items
      setSkillItems(rawSkills.map(s => ({ term: s, enabled: true, category: 'skill' })));
      // Pre-fill titles and locations
      if (rawTitles.length > 0) setTitles(rawTitles);
      if (rawLocations.length > 0) setLocations(rawLocations);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to upload resume. Please try again.');
    } finally {
      setUploading(false);
    }
  }, [userId]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file?.type === 'application/pdf') handleUpload(file);
  }, [handleUpload]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    e.target.value = '';
  }, [handleUpload]);

  const handleStep3Skip = () => setStep(4);

  const handleStep3Continue = () => setStep(4);

  /* ── Step 4: Confirm / update skills ── */
  const toggleSkill = (idx: number) => {
    setSkillItems(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], enabled: !next[idx].enabled };
      return next;
    });
  };

  const handleStep4 = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError('');
    try {
      const add = skillItems.filter(s => s.enabled).map(s => ({ category: s.category, term: s.term }));
      const remove = skillItems.filter(s => !s.enabled).map(s => ({ category: s.category, term: s.term }));
      await setupApi.updateSkills({ userId, add, remove });
      setStep(5);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to update skills. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [userId, skillItems]);

  /* ── Step 5: Titles + Synonyms + Excludes ── */
  const addTitle = () => {
    const t = titleInput.trim();
    if (!t || titles.includes(t)) return;
    setTitles(prev => [...prev, t]);
    setTitleInput('');
  };
  const removeTitle = (t: string) => setTitles(prev => prev.filter(x => x !== t));

  const addSynonym = () => {
    const s = synonymInput.trim();
    if (!s || !selectedTitleForSynonym) return;
    setSynonyms(prev => ({
      ...prev,
      [selectedTitleForSynonym]: [...(prev[selectedTitleForSynonym] || []), s],
    }));
    setSynonymInput('');
  };

  const addExclude = () => {
    const e = excludeInput.trim();
    if (!e || excludes.includes(e)) return;
    setExcludes(prev => [...prev, e]);
    setExcludeInput('');
  };
  const removeExclude = (e: string) => setExcludes(prev => prev.filter(x => x !== e));

  const handleStep5 = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError('');
    try {
      await setupApi.updateProfile({
        userId,
        targetTitles: titles,
        titleSynonyms: synonyms,
        excludedTitles: excludes,
      });
      setStep(6);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to save titles. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [userId, titles, synonyms, excludes]);

  /* ── Step 6: Locations + Remote ── */
  const addLocation = () => {
    const l = locationInput.trim();
    if (!l || locations.includes(l)) return;
    setLocations(prev => [...prev, l]);
    setLocationInput('');
  };
  const removeLocation = (l: string) => setLocations(prev => prev.filter(x => x !== l));

  const handleStep6 = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError('');
    try {
      const allLocations = remote ? [...locations, 'Remote'] : locations;
      await setupApi.updateProfile({ userId, targetLocations: allLocations, remoteOk: remote });
      setStep(7);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to save locations. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [userId, locations, remote]);

  /* ── Step 7: Load Companies (auto-triggered) ── */
  useEffect(() => {
    if (step !== 7 || companiesLoaded !== null || companiesLoading) return;
    setCompaniesLoading(true);
    setupApi.loadCompanies()
      .then((res: any) => {
        setCompaniesLoaded(res?.count ?? res?.inserted ?? 0);
      })
      .catch((e: any) => {
        setError(e?.response?.data?.error || 'Failed to load companies.');
        setCompaniesLoaded(0);
      })
      .finally(() => setCompaniesLoading(false));
  }, [step, companiesLoaded, companiesLoading]);

  /* ── Step 8: Complete ── */
  const handleComplete = useCallback(async (triggerScrape: boolean) => {
    if (!userId) return;
    setLoading(true);
    setError('');
    try {
      await setupApi.complete(triggerScrape);
      onComplete({ id: userId, name, avatarColor });
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to complete setup. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [userId, name, avatarColor, onComplete]);

  /* ── Shared button styles ── */
  const primaryBtn = 'w-full py-3 rounded-xl text-sm font-semibold bg-gradient-to-br from-accent-indigo to-[#4f46e5] text-white shadow-[0_2px_12px_rgba(99,102,241,0.3)] hover:shadow-[0_4px_20px_rgba(99,102,241,0.4)] hover:-translate-y-0.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0';

  return (
    <div className="fixed inset-0 z-[100] bg-bg-primary flex items-center justify-center overflow-y-auto py-8">
      <div className="w-full max-w-xl mx-4">

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
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
        <div className="bg-gradient-to-br from-bg-tertiary/90 to-bg-overlay border border-border-subtle rounded-2xl p-8 shadow-[0_16px_64px_rgba(0,0,0,0.5)]">

          {error && (
            <div className="mb-5 px-4 py-2.5 rounded-lg text-xs font-medium bg-accent-red/10 text-accent-red-light border border-accent-red/20">
              {error}
            </div>
          )}

          {/* ── Step 1: Name + Avatar ── */}
          {step === 1 && (
            <div>
              <h1 className="text-2xl font-extrabold text-text-primary tracking-tight mb-1">
                Welcome to JobGrid
              </h1>
              <p className="text-xs text-text-muted mb-6">
                Let's get you set up. First, tell us your name and pick an avatar color.
              </p>

              <label className="block mb-5">
                <span className="text-[11px] text-text-secondary font-medium">Your Name</span>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleStep1()}
                  className="mt-1.5 w-full bg-bg-primary/40 border border-border-subtle rounded-lg p-3 text-sm text-text-primary outline-none focus:border-accent-indigo/40 transition-colors"
                  placeholder="e.g. Alex Chen"
                  autoFocus
                />
              </label>

              <div className="mb-6">
                <span className="text-[11px] text-text-secondary font-medium">Avatar Color</span>
                <div className="flex flex-wrap gap-3 mt-2">
                  {AVATAR_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setAvatarColor(c)}
                      className={`w-8 h-8 rounded-full transition-all ${
                        avatarColor === c
                          ? 'ring-2 ring-white/30 ring-offset-2 ring-offset-bg-tertiary scale-110'
                          : 'hover:scale-105 opacity-70 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              {/* Preview */}
              {name.trim() && (
                <div className="flex items-center gap-3 mb-5 p-3 bg-bg-primary/30 rounded-xl border border-border-subtle">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                    style={{ backgroundColor: avatarColor }}
                  >
                    {name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-semibold text-text-primary">{name}</span>
                </div>
              )}

              <button
                onClick={handleStep1}
                disabled={!name.trim() || loading}
                className={primaryBtn}
              >
                {loading ? 'Creating account...' : 'Continue'}
              </button>
            </div>
          )}

          {/* ── Step 2: Archetype ── */}
          {step === 2 && (
            <div>
              <h2 className="text-xl font-extrabold text-text-primary tracking-tight mb-1">
                What best describes you?
              </h2>
              <p className="text-xs text-text-muted mb-6">
                We'll pre-configure your scoring weights and keyword templates based on your role.
              </p>

              <div className="space-y-2 mb-6">
                {ARCHETYPES.map(a => (
                  <button
                    key={a.id}
                    onClick={() => setArchetype(a.id)}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all ${
                      archetype === a.id
                        ? 'bg-accent-indigo/10 border-accent-indigo/40 text-text-primary'
                        : 'bg-bg-primary/20 border-border-subtle text-text-secondary hover:border-border hover:bg-bg-primary/30'
                    }`}
                  >
                    <span className="text-xl">{a.icon}</span>
                    <span className="text-sm font-medium">{a.label}</span>
                    {archetype === a.id && (
                      <div className="ml-auto w-4 h-4 rounded-full bg-accent-indigo flex items-center justify-center">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>

              <button
                onClick={handleStep2}
                disabled={loading}
                className={primaryBtn}
              >
                {loading ? 'Saving...' : 'Continue'}
              </button>
            </div>
          )}

          {/* ── Step 3: Resume Upload ── */}
          {step === 3 && (
            <div>
              <h2 className="text-xl font-extrabold text-text-primary tracking-tight mb-1">
                Upload Your Resume
              </h2>
              <p className="text-xs text-text-muted mb-6">
                We'll extract skills, titles, and locations automatically from your PDF.
              </p>

              {!extracted ? (
                <>
                  <div
                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
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
                    onClick={handleStep3Skip}
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
                        <div className="text-sm font-semibold text-text-primary">{extracted.filename}</div>
                        <div className="text-[10px] text-text-dim">Parsed successfully</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                      <ExtractedCount label="Skills" count={extracted.skills.length} color="indigo" />
                      <ExtractedCount label="Titles" count={extracted.titles.length} color="cyan" />
                      <ExtractedCount label="Certs" count={extracted.certs.length} color="amber" />
                      <ExtractedCount label="Locations" count={extracted.locations.length} color="green" />
                    </div>
                  </div>

                  <button onClick={handleStep3Continue} className={primaryBtn}>
                    Continue
                  </button>
                </>
              )}
            </div>
          )}

          {/* ── Step 4: Skills Review ── */}
          {step === 4 && (
            <div>
              <h2 className="text-xl font-extrabold text-text-primary tracking-tight mb-1">
                Review Your Skills
              </h2>
              <p className="text-xs text-text-muted mb-5">
                Toggle off skills that are not relevant to your job search.
              </p>

              {skillItems.length > 0 ? (
                <div className="mb-4">
                  <div className="text-[9px] font-bold uppercase tracking-[1.2px] text-text-dim mb-2">
                    Skills ({skillItems.filter(s => s.enabled).length} of {skillItems.length} selected)
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-52 overflow-y-auto scrollbar-thin scrollbar-thumb-bg-card pr-1">
                    {skillItems.map((sk, i) => (
                      <button
                        key={sk.term}
                        onClick={() => toggleSkill(i)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all ${
                          sk.enabled
                            ? 'bg-accent-indigo/15 text-accent-indigo-light border-accent-indigo/25 hover:bg-accent-indigo/25'
                            : 'bg-bg-card/20 text-text-dim border-border-subtle hover:text-text-muted'
                        }`}
                      >
                        {sk.term}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center text-text-dim text-xs py-8 mb-4">
                  No skills extracted. You can add them later in your profile.
                </div>
              )}

              <button
                onClick={handleStep4}
                disabled={loading}
                className={primaryBtn}
              >
                {loading ? 'Saving skills...' : 'Continue'}
              </button>
            </div>
          )}

          {/* ── Step 5: Titles + Synonyms + Excludes ── */}
          {step === 5 && (
            <div>
              <h2 className="text-xl font-extrabold text-text-primary tracking-tight mb-1">
                Target Roles
              </h2>
              <p className="text-xs text-text-muted mb-5">
                What job titles are you targeting? Add synonyms and titles to exclude.
              </p>

              {/* Titles */}
              <div className="mb-4">
                <div className="text-[9px] font-bold uppercase tracking-[1.2px] text-text-dim mb-2">Target Titles</div>
                <div className="flex flex-wrap gap-1.5 mb-2 min-h-[28px]">
                  {titles.map(t => (
                    <span
                      key={t}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border flex items-center gap-1.5 cursor-pointer transition-all ${
                        selectedTitleForSynonym === t
                          ? 'bg-accent-cyan/20 text-accent-cyan-light border-accent-cyan/40'
                          : 'bg-accent-cyan/10 text-accent-cyan-light border-accent-cyan/20 hover:bg-accent-cyan/15'
                      }`}
                      onClick={() => setSelectedTitleForSynonym(prev => prev === t ? '' : t)}
                    >
                      {t}
                      <button
                        onClick={e => { e.stopPropagation(); removeTitle(t); }}
                        className="text-accent-cyan hover:text-accent-red-light transition-colors"
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={titleInput}
                    onChange={e => setTitleInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTitle(); } }}
                    className="flex-1 bg-bg-primary/40 border border-border-subtle rounded-lg p-2.5 text-xs text-text-primary outline-none focus:border-accent-indigo/40 transition-colors"
                    placeholder="Add a title (Enter to add)"
                  />
                  <button
                    onClick={addTitle}
                    className="px-4 py-2.5 rounded-lg text-xs font-semibold bg-bg-card/50 text-text-secondary border border-border-subtle hover:text-text-primary hover:border-border transition-all"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Synonyms */}
              {titles.length > 0 && (
                <div className="mb-4">
                  <div className="text-[9px] font-bold uppercase tracking-[1.2px] text-text-dim mb-2">
                    Synonyms {selectedTitleForSynonym ? `for "${selectedTitleForSynonym}"` : '(click a title above)'}
                  </div>
                  {selectedTitleForSynonym && (
                    <>
                      <div className="flex flex-wrap gap-1.5 mb-2 min-h-[24px]">
                        {(synonyms[selectedTitleForSynonym] || []).map(s => (
                          <span key={s} className="px-2 py-0.5 rounded-md text-[10px] bg-accent-indigo/10 text-accent-indigo-light border border-accent-indigo/20 flex items-center gap-1">
                            {s}
                            <button
                              onClick={() => setSynonyms(prev => ({
                                ...prev,
                                [selectedTitleForSynonym]: prev[selectedTitleForSynonym].filter(x => x !== s),
                              }))}
                              className="text-accent-indigo hover:text-accent-red-light"
                            >
                              &times;
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={synonymInput}
                          onChange={e => setSynonymInput(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSynonym(); } }}
                          className="flex-1 bg-bg-primary/40 border border-border-subtle rounded-lg p-2 text-xs text-text-primary outline-none focus:border-accent-indigo/40 transition-colors"
                          placeholder="Add synonym (Enter)"
                        />
                        <button onClick={addSynonym} className="px-3 py-2 rounded-lg text-xs font-semibold bg-bg-card/50 text-text-secondary border border-border-subtle hover:text-text-primary transition-all">
                          Add
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Excludes */}
              <div className="mb-6">
                <div className="text-[9px] font-bold uppercase tracking-[1.2px] text-text-dim mb-2">Excluded Titles</div>
                <div className="flex flex-wrap gap-1.5 mb-2 min-h-[24px]">
                  {excludes.map(e => (
                    <span key={e} className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-accent-red/10 text-accent-red-light border border-accent-red/20 flex items-center gap-1.5">
                      {e}
                      <button onClick={() => removeExclude(e)} className="text-accent-red hover:text-accent-red-light">&times;</button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={excludeInput}
                    onChange={e => setExcludeInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addExclude(); } }}
                    className="flex-1 bg-bg-primary/40 border border-border-subtle rounded-lg p-2.5 text-xs text-text-primary outline-none focus:border-accent-indigo/40 transition-colors"
                    placeholder="Titles to exclude (e.g. Senior, Intern)"
                  />
                  <button onClick={addExclude} className="px-4 py-2.5 rounded-lg text-xs font-semibold bg-bg-card/50 text-text-secondary border border-border-subtle hover:text-text-primary hover:border-border transition-all">
                    Add
                  </button>
                </div>
              </div>

              <button
                onClick={handleStep5}
                disabled={loading}
                className={primaryBtn}
              >
                {loading ? 'Saving...' : 'Continue'}
              </button>
            </div>
          )}

          {/* ── Step 6: Locations + Remote ── */}
          {step === 6 && (
            <div>
              <h2 className="text-xl font-extrabold text-text-primary tracking-tight mb-1">
                Target Locations
              </h2>
              <p className="text-xs text-text-muted mb-5">
                Where do you want to work? Add cities, states, or regions.
              </p>

              <div className="flex flex-wrap gap-1.5 mb-3 min-h-[32px]">
                {locations.map(l => (
                  <span
                    key={l}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-accent-green/10 text-accent-green-light border border-accent-green/20 flex items-center gap-1.5"
                  >
                    {l}
                    <button onClick={() => removeLocation(l)} className="text-accent-green hover:text-accent-red-light transition-colors">&times;</button>
                  </span>
                ))}
              </div>

              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={locationInput}
                  onChange={e => setLocationInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addLocation(); } }}
                  className="flex-1 bg-bg-primary/40 border border-border-subtle rounded-lg p-2.5 text-xs text-text-primary outline-none focus:border-accent-indigo/40 transition-colors"
                  placeholder="e.g. San Francisco, New York, Austin"
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
                  onClick={() => setRemote(r => !r)}
                  className={`w-9 h-5 rounded-full relative transition-colors ${remote ? 'bg-accent-green/40' : 'bg-bg-card/60'}`}
                >
                  <div
                    className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${
                      remote ? 'left-[18px] bg-accent-green-light shadow-[0_0_6px_rgba(16,185,129,0.5)]' : 'left-0.5 bg-text-dim'
                    }`}
                  />
                </button>
                <span className="text-xs text-text-secondary font-medium">Open to remote</span>
              </div>

              <button
                onClick={handleStep6}
                disabled={loading}
                className={primaryBtn}
              >
                {loading ? 'Saving...' : 'Continue'}
              </button>
            </div>
          )}

          {/* ── Step 7: Load Companies ── */}
          {step === 7 && (
            <div>
              <h2 className="text-xl font-extrabold text-text-primary tracking-tight mb-1">
                Loading Companies
              </h2>
              <p className="text-xs text-text-muted mb-6">
                We're loading the company list you'll track for job postings.
              </p>

              <div className="flex flex-col items-center justify-center py-10 mb-6">
                {companiesLoading ? (
                  <>
                    <div className="w-12 h-12 rounded-full border-2 border-accent-indigo/30 border-t-accent-indigo animate-spin mb-4" />
                    <span className="text-sm text-text-muted">Loading companies...</span>
                  </>
                ) : companiesLoaded !== null ? (
                  <>
                    <div className="w-12 h-12 rounded-full bg-accent-green/10 border border-accent-green/30 flex items-center justify-center mb-4">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent-green-light">
                        <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <span className="text-2xl font-extrabold text-text-primary mb-1">{companiesLoaded}</span>
                    <span className="text-xs text-text-dim">companies loaded</span>
                  </>
                ) : (
                  <span className="text-sm text-text-dim">Initializing...</span>
                )}
              </div>

              <button
                onClick={() => setStep(8)}
                disabled={companiesLoading}
                className={primaryBtn}
              >
                Continue
              </button>
            </div>
          )}

          {/* ── Step 8: Complete ── */}
          {step === 8 && (
            <div>
              <h2 className="text-xl font-extrabold text-text-primary tracking-tight mb-1">
                You're All Set!
              </h2>
              <p className="text-xs text-text-muted mb-6">
                Here's a summary of your setup. Ready to start finding jobs?
              </p>

              <div className="bg-bg-primary/30 border border-border-subtle rounded-xl p-5 mb-6 space-y-3">
                <SummaryRow label="Name" value={name} />
                <SummaryRow label="Role Type" value={ARCHETYPES.find(a => a.id === archetype)?.label ?? archetype} />
                {titles.length > 0 && (
                  <SummaryRow label="Target Titles" value={titles.slice(0, 3).join(', ') + (titles.length > 3 ? ` +${titles.length - 3} more` : '')} />
                )}
                {(locations.length > 0 || remote) && (
                  <SummaryRow
                    label="Locations"
                    value={[...locations, ...(remote ? ['Remote'] : [])].slice(0, 3).join(', ')}
                  />
                )}
                <SummaryRow
                  label="Skills"
                  value={`${skillItems.filter(s => s.enabled).length} selected`}
                />
                {companiesLoaded !== null && (
                  <SummaryRow label="Companies" value={`${companiesLoaded} tracked`} />
                )}
              </div>

              <button
                onClick={() => handleComplete(true)}
                disabled={loading}
                className={`${primaryBtn} mb-2`}
              >
                {loading ? 'Finishing setup...' : 'Start Scanning Jobs Now'}
              </button>

              <button
                onClick={() => handleComplete(false)}
                disabled={loading}
                className="w-full text-center text-xs text-text-dim hover:text-text-muted transition-colors py-2"
              >
                Skip initial scan — I'll do it manually
              </button>
            </div>
          )}

          {/* Back button (steps 2–8, not on step 1) */}
          {step > 1 && step < 8 && !loading && (
            <button
              onClick={() => setStep(s => s - 1)}
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

function ExtractedCount({ label, count, color }: { label: string; count: number; color: string }) {
  const colorMap: Record<string, string> = {
    indigo: 'text-accent-indigo-light',
    cyan: 'text-accent-cyan-light',
    amber: 'text-accent-amber-light',
    green: 'text-accent-green-light',
  };
  return (
    <div className="text-center">
      <div className={`text-lg font-extrabold ${colorMap[color] ?? 'text-text-primary'}`}>{count}</div>
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
