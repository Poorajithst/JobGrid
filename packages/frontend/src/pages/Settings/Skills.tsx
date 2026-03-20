import { useState, useEffect, useCallback } from 'react';
import { setupApi } from '../../api/client';

const CATEGORIES = [
  { key: 'methodologies', label: 'Methodologies' },
  { key: 'tools', label: 'Tools' },
  { key: 'technical', label: 'Technical Skills' },
  { key: 'certifications', label: 'Certifications' },
  { key: 'domains', label: 'Domains' },
  { key: 'soft_skills', label: 'Soft Skills' },
];

const SOURCE_COLORS: Record<string, string> = {
  template: 'bg-gray-700 text-gray-300',
  resume: 'bg-blue-900/50 text-blue-300',
  manual: 'bg-green-900/50 text-green-300',
  'ai-discovered': 'bg-purple-900/50 text-purple-300',
};

const SOURCE_LABELS: Record<string, string> = {
  template: 'template',
  resume: 'resume',
  manual: 'manual',
  'ai-discovered': 'ai',
};

interface DictTerm {
  id: number;
  category: string;
  term: string;
  source: string;
}

export function Skills({ userId }: { userId: number }) {
  const [terms, setTerms] = useState<DictTerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [addInputs, setAddInputs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTerms = useCallback(async () => {
    try {
      setLoading(true);
      const data = await setupApi.getSkills(userId);
      setTerms(data.terms || []);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load skills');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchTerms();
  }, [fetchTerms]);

  const handleRemove = useCallback(async (category: string, term: string) => {
    setSaving(true);
    try {
      await setupApi.updateSkills({ userId, remove: [{ category, term }] });
      setTerms(prev => prev.filter(t => !(t.category === category && t.term === term)));
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to remove term');
    } finally {
      setSaving(false);
    }
  }, [userId]);

  const handleAdd = useCallback(async (category: string) => {
    const raw = addInputs[category]?.trim();
    if (!raw) return;
    setSaving(true);
    try {
      await setupApi.updateSkills({ userId, add: [{ category, term: raw }] });
      setTerms(prev => [...prev, { id: Date.now(), category, term: raw, source: 'manual' }]);
      setAddInputs(prev => ({ ...prev, [category]: '' }));
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to add term');
    } finally {
      setSaving(false);
    }
  }, [userId, addInputs]);

  const handleResetToTemplate = useCallback(async () => {
    if (!confirm('This will remove all manual and AI-discovered terms and reload the template. Continue?')) return;
    setSaving(true);
    try {
      // Remove all non-template terms
      const toRemove = terms
        .filter(t => t.source !== 'template')
        .map(t => ({ category: t.category, term: t.term }));
      if (toRemove.length > 0) {
        await setupApi.updateSkills({ userId, remove: toRemove });
      }
      await fetchTerms();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to reset');
    } finally {
      setSaving(false);
    }
  }, [userId, terms, fetchTerms]);

  const termsByCategory = useCallback((category: string) => {
    return terms.filter(t => t.category === category);
  }, [terms]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="text-text-dim text-sm">Loading skills...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-base font-semibold text-text-primary">My Skills Dictionary</h3>
          <p className="text-[11px] text-text-dim mt-0.5">
            These terms are used to match and score job postings.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Source legend */}
          <div className="flex items-center gap-2">
            {Object.entries(SOURCE_LABELS).map(([key, label]) => (
              <span
                key={key}
                className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${SOURCE_COLORS[key] || 'bg-gray-700 text-gray-300'}`}
              >
                {label}
              </span>
            ))}
          </div>
          <button
            onClick={handleResetToTemplate}
            disabled={saving}
            className="text-[10px] font-semibold text-text-dim hover:text-text-muted border border-border-subtle rounded-lg px-3 py-1.5 transition-colors hover:border-border-muted disabled:opacity-50"
          >
            Reset to Template
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-800/40 rounded-lg p-3 text-[11px] text-red-400">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">dismiss</button>
        </div>
      )}

      {/* Category blocks */}
      {CATEGORIES.map(({ key, label }) => {
        const catTerms = termsByCategory(key);
        return (
          <div
            key={key}
            className="bg-gradient-to-br from-bg-tertiary/70 to-bg-tertiary/30 border border-border-subtle rounded-xl p-4 px-5"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="text-[9px] font-bold uppercase tracking-[1.2px] text-text-dim">
                {label}
                <span className="ml-1.5 text-text-dim/60 normal-case">({catTerms.length})</span>
              </div>
            </div>

            {/* Terms */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {catTerms.length === 0 && (
                <span className="text-[11px] text-text-dim/50 italic">No terms yet</span>
              )}
              {catTerms.map((t) => (
                <div
                  key={`${t.category}-${t.term}`}
                  className="flex items-center gap-1 bg-bg-primary/40 border border-border-subtle rounded-lg pl-2 pr-1 py-0.5"
                >
                  <span className="text-[11px] text-text-secondary">{t.term}</span>
                  <span
                    className={`text-[8px] font-bold px-1 py-0.5 rounded ${SOURCE_COLORS[t.source] || 'bg-gray-700 text-gray-300'}`}
                  >
                    {SOURCE_LABELS[t.source] || t.source}
                  </span>
                  <button
                    onClick={() => handleRemove(t.category, t.term)}
                    disabled={saving}
                    className="w-4 h-4 flex items-center justify-center text-text-dim hover:text-red-400 transition-colors rounded disabled:opacity-50 ml-0.5"
                    title={`Remove "${t.term}"`}
                  >
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M1 1L7 7M7 1L1 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            {/* Add input */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={addInputs[key] || ''}
                onChange={(e) => setAddInputs(prev => ({ ...prev, [key]: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd(key)}
                placeholder={`Add ${label.toLowerCase()}...`}
                className="flex-1 bg-bg-primary/40 border border-border-subtle rounded-lg px-2.5 py-1.5 text-[11px] text-text-primary placeholder:text-text-dim/50 outline-none focus:border-accent-indigo/40 transition-colors"
              />
              <button
                onClick={() => handleAdd(key)}
                disabled={saving || !addInputs[key]?.trim()}
                className="text-[10px] font-semibold text-accent-indigo hover:text-accent-indigo-light disabled:opacity-40 disabled:cursor-not-allowed transition-colors px-2 py-1.5"
              >
                Add
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
