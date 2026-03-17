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
