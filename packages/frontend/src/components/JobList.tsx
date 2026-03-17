import { JobCard } from './JobCard';
import type { Job, JobFilters } from '../api/types';

interface JobListProps {
  jobs: Job[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  filters: JobFilters;
  onFiltersChange: (filters: JobFilters) => void;
}

const SOURCES = ['All', 'Greenhouse', 'Lever', 'Indeed', 'Google', 'ZipRecruiter'];
const SOURCE_VALUES: Record<string, string | undefined> = {
  All: undefined, Greenhouse: 'greenhouse', Lever: 'lever',
  Indeed: 'indeed', Google: 'google-jobs', ZipRecruiter: 'ziprecruiter',
};
const STATUSES = ['All', 'Discovered', 'Applied', 'Interview', 'Offer', 'Rejected'];
const COMPETITIONS = ['All', 'Low', 'Medium', 'High'];

export function JobList({ jobs, selectedId, onSelect, filters, onFiltersChange }: JobListProps) {
  const activeSource = SOURCES.find(s => SOURCE_VALUES[s] === filters.source) || 'All';
  const activeStatus = filters.status ? filters.status.charAt(0).toUpperCase() + filters.status.slice(1) : 'All';
  const activeComp = filters.competition ? filters.competition.charAt(0).toUpperCase() + filters.competition.slice(1) : 'All';

  return (
    <div className="w-[380px] min-w-[380px] bg-bg-secondary border-r border-border-subtle flex flex-col">
      {/* Filters */}
      <div className="p-3 px-4 border-b border-border-subtle">
        <FilterRow label="Source" items={SOURCES} active={activeSource} onSelect={(v) =>
          onFiltersChange({ ...filters, source: SOURCE_VALUES[v], page: 1 })
        } />
        <FilterRow label="Pipeline" items={STATUSES} active={activeStatus} onSelect={(v) =>
          onFiltersChange({ ...filters, status: v === 'All' ? undefined : v.toLowerCase(), page: 1 })
        } />
        <FilterRow label="Competition" items={COMPETITIONS} active={activeComp} onSelect={(v) =>
          onFiltersChange({ ...filters, competition: v === 'All' ? undefined : v.toLowerCase(), page: 1 })
        } />
      </div>

      {/* Search */}
      <div className="p-2 px-4 border-b border-border-subtle">
        <input
          type="text"
          placeholder="Search jobs, companies..."
          value={filters.search || ''}
          onChange={(e) => onFiltersChange({ ...filters, search: e.target.value || undefined, page: 1 })}
          className="w-full bg-[#0f172a]/80 border border-border-subtle rounded-lg py-2 px-3 pl-8 text-text-primary text-xs outline-none focus:border-accent-indigo/40 transition-colors placeholder:text-[#334155]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23475569' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='11' cy='11' r='8'%3E%3C/circle%3E%3Cpath d='m21 21-4.3-4.3'%3E%3C/path%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: '10px center',
          }}
        />
      </div>

      {/* Job Cards */}
      <div className="flex-1 overflow-y-auto p-2 px-2.5 scrollbar-thin scrollbar-thumb-bg-card">
        {jobs.map((job) => (
          <JobCard key={job.id} job={job} isActive={job.id === selectedId} onClick={() => onSelect(job.id)} />
        ))}
        {jobs.length === 0 && (
          <div className="text-text-dim text-xs text-center py-8">No jobs found</div>
        )}
      </div>
    </div>
  );
}

function FilterRow({ label, items, active, onSelect }: {
  label: string;
  items: string[];
  active: string;
  onSelect: (value: string) => void;
}) {
  return (
    <div className="mb-2.5 last:mb-0">
      <div className="text-[9px] font-semibold uppercase tracking-widest text-text-dim mb-1.5">{label}</div>
      <div className="flex gap-[5px] flex-wrap">
        {items.map(item => (
          <button
            key={item}
            onClick={() => onSelect(item)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all border
              ${item === active
                ? 'bg-accent-indigo/15 text-accent-indigo-light border-accent-indigo/30'
                : 'bg-bg-card/60 text-text-muted border-border-subtle hover:text-text-secondary hover:border-border'
              }`}
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}
