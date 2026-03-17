import { describe, it, expect, vi } from 'vitest';
import { extractTextFromPdf } from '../parser.js';

// Mock pdf-parse
vi.mock('pdf-parse', () => ({
  default: vi.fn().mockResolvedValue({
    text: 'John Doe\nProject Manager\nExperience\nWPI - Project Manager\nJan 2020 - Present\nSkills: Agile, Scrum, Python, SQL\nCertifications: CAPM, PMI-ACP',
  }),
}));

describe('PDF Parser', () => {
  it('extracts text from a PDF buffer', async () => {
    const buffer = Buffer.from('fake pdf content');
    const text = await extractTextFromPdf(buffer);
    expect(text).toContain('Project Manager');
    expect(text).toContain('Agile');
    expect(text).toContain('CAPM');
  });
});
