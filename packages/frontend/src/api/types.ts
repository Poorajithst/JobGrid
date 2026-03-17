export interface Job {
  id: number;
  title: string;
  company: string;
  location: string | null;
  applicants: number | null;
  description: string | null;
  link: string;
  source: string;
  ats_id: string | null;
  posted_at: string | null;
  scraped_at: string;
  fit_score: number | null;
  competition: string | null;
  recommendation: string | null;
  pitch: string | null;
  score_reason: string | null;
  status: string;
  notes: string | null;
  next_action: string | null;
  applied_at: string | null;
  interview_at: string | null;
  offer_at: string | null;
}

export interface JobWithOutreach extends Job {
  outreach: OutreachDraft[];
}

export interface OutreachDraft {
  id: number;
  job_id: number;
  type: string;
  content: string;
  created_at: string;
}

export interface JobsResponse {
  jobs: Job[];
  total: number;
  page: number;
  totalPages: number;
  hasMore: boolean;
}

export interface Stats {
  total: number;
  avg_fit: number;
  low_competition: number;
  by_source: Record<string, number>;
  by_status: Record<string, number>;
  last_scraped: string | null;
  new_today: number;
}

export interface ScrapeRun {
  id: number;
  started_at: string;
  finished_at: string | null;
  jobs_found: number;
  jobs_new: number;
  sources_run: string | null;
  status: string;
  error: string | null;
}

export interface Company {
  id: number;
  name: string;
  greenhouse_slug: string | null;
  lever_slug: string | null;
  active: boolean;
  last_checked: string | null;
  created_at: string;
}

export interface JobFilters {
  source?: string;
  status?: string;
  competition?: string;
  minScore?: number;
  search?: string;
  sort?: string;
  order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}
