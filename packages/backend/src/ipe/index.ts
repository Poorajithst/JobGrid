import { scoreFreshness } from './freshness.js';
import { scoreSkillMatch } from './skill-match.js';
import { scoreTitleAlignment } from './title-align.js';
import { scoreCertMatch } from './cert-match.js';
import { scoreCompetition } from './competition.js';
import { scoreLocationMatch } from './location-match.js';
import { scoreExperience } from './experience.js';

export interface ProfileConfig {
  targetTitles: string[];
  targetSkills: string[];
  targetCerts: string[];
  targetLocations: string[];
  experienceYears: number;
  titleSynonyms: Record<string, string[]>;
  excludeTitles?: string[];
  weights: {
    freshness: number;
    skill: number;
    title: number;
    cert: number;
    competition: number;
    location: number;
    experience: number;
  };
}

export interface JobData {
  title: string;
  description: string | null;
  location: string | null;
  postedAt: string | null;
  applicants: number | null;
}

export interface IpeResult {
  ipeScore: number;
  dimensions: {
    freshnessScore: number;
    skillMatchScore: number;
    titleAlignmentScore: number;
    certMatchScore: number;
    competitionScore: number;
    locationMatchScore: number;
    experienceAlignScore: number;
  };
  matchedSkills: string[];
}

export function calculateIpeScore(profile: ProfileConfig, job: JobData): IpeResult {
  const freshnessScore = scoreFreshness(job.postedAt);
  const { score: skillMatchScore, matchedSkills } = scoreSkillMatch(
    profile.targetSkills, job.description || ''
  );
  const titleAlignmentScore = scoreTitleAlignment(
    profile.targetTitles, job.title, profile.titleSynonyms, profile.excludeTitles || []
  );
  const certMatchScore = scoreCertMatch(profile.targetCerts, job.description || '');
  const competitionScore = scoreCompetition(job.applicants);
  const locationMatchScore = scoreLocationMatch(profile.targetLocations, job.location);
  const experienceAlignScore = scoreExperience(profile.experienceYears, job.description || '');

  const { weights } = profile;
  const ipeScore = Math.round(
    freshnessScore * weights.freshness +
    skillMatchScore * weights.skill +
    titleAlignmentScore * weights.title +
    certMatchScore * weights.cert +
    competitionScore * weights.competition +
    locationMatchScore * weights.location +
    experienceAlignScore * weights.experience
  );

  return {
    ipeScore: Math.max(0, Math.min(100, ipeScore)),
    dimensions: {
      freshnessScore,
      skillMatchScore,
      titleAlignmentScore,
      certMatchScore,
      competitionScore,
      locationMatchScore,
      experienceAlignScore,
    },
    matchedSkills,
  };
}
