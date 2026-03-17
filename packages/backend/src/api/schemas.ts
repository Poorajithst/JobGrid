import { z } from 'zod';

export const UpdateStatusSchema = z.object({
  status: z.enum(['discovered', 'applied', 'interview', 'offer', 'rejected']),
  appliedAt: z.string().optional(),
  interviewAt: z.string().optional(),
  offerAt: z.string().optional(),
});

export const UpdateNotesSchema = z.object({
  notes: z.string().optional(),
  nextAction: z.string().optional(),
});

export const OutreachRequestSchema = z.object({
  type: z.enum(['connection', 'email', 'inmail']),
});

export const AddCompanySchema = z.object({
  name: z.string().min(1),
  greenhouseSlug: z.string().nullable().optional(),
  leverSlug: z.string().nullable().optional(),
});

export const UpdateCompanySchema = z.object({
  name: z.string().min(1).optional(),
  greenhouseSlug: z.string().nullable().optional(),
  leverSlug: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

export const CreateProfileSchema = z.object({
  name: z.string().min(1),
  targetTitles: z.array(z.string()).min(1),
  targetSkills: z.array(z.string()).min(1),
  targetCerts: z.array(z.string()).optional(),
  targetLocations: z.array(z.string()).optional(),
  minExperienceYears: z.number().optional(),
  maxExperienceYears: z.number().optional(),
  searchQueries: z.array(z.string()).optional(),
  titleSynonyms: z.record(z.array(z.string())).optional(),
});

export const UpdateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  targetTitles: z.array(z.string()).min(1).optional(),
  targetSkills: z.array(z.string()).min(1).optional(),
  targetCerts: z.array(z.string()).optional(),
  targetLocations: z.array(z.string()).optional(),
  searchQueries: z.array(z.string()).optional(),
  titleSynonyms: z.record(z.array(z.string())).optional(),
  freshnessWeight: z.number().min(0).max(1).optional(),
  skillWeight: z.number().min(0).max(1).optional(),
  titleWeight: z.number().min(0).max(1).optional(),
  certWeight: z.number().min(0).max(1).optional(),
  competitionWeight: z.number().min(0).max(1).optional(),
  locationWeight: z.number().min(0).max(1).optional(),
  experienceWeight: z.number().min(0).max(1).optional(),
  aiThreshold: z.number().min(0).max(100).optional(),
  isActive: z.boolean().optional(),
}).refine(data => {
  const weights = [data.freshnessWeight, data.skillWeight, data.titleWeight,
    data.certWeight, data.competitionWeight, data.locationWeight, data.experienceWeight]
    .filter(w => w !== undefined);
  if (weights.length === 7) {
    const sum = weights.reduce((a, b) => a + b!, 0);
    return Math.abs(sum - 1.0) < 0.01;
  }
  return true; // Partial updates don't need to sum to 1.0
}, { message: 'Weights must sum to 1.0 when all 7 are provided' });
