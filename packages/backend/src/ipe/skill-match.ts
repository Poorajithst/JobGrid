import { PorterStemmer, WordTokenizer } from 'natural';

const tokenizer = new WordTokenizer();
const stopwords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'and', 'but', 'or', 'not', 'no', 'nor', 'so', 'yet', 'both', 'either', 'neither', 'each', 'every', 'all', 'any', 'few', 'more', 'most', 'other', 'some', 'such', 'than', 'too', 'very', 'just', 'because', 'if', 'when', 'where', 'how', 'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'it', 'its']);

export function scoreSkillMatch(
  profileSkills: string[],
  jobDescription: string
): { score: number; matchedSkills: string[] } {
  if (profileSkills.length === 0) return { score: 0, matchedSkills: [] };

  const jobLower = jobDescription.toLowerCase();
  const jobTokens = tokenizer.tokenize(jobLower) || [];
  const jobStemmed = new Set(jobTokens.filter(t => !stopwords.has(t)).map(t => PorterStemmer.stem(t)));
  const jobText = jobLower; // Keep original for exact multi-word matches

  const matchedSkills: string[] = [];

  for (const skill of profileSkills) {
    const skillLower = skill.toLowerCase();
    // Try exact multi-word match first (e.g., "power bi", "ms project")
    if (jobText.includes(skillLower)) {
      matchedSkills.push(skill);
      continue;
    }
    // Try stemmed single-word match
    const skillStemmed = PorterStemmer.stem(skillLower);
    if (jobStemmed.has(skillStemmed)) {
      matchedSkills.push(skill);
    }
  }

  // Base score: Jaccard-style ratio
  let score = Math.round((matchedSkills.length / profileSkills.length) * 100);

  // Bonus for exact tool matches (tools are more specific than general skills)
  const toolBonus = matchedSkills.filter(s =>
    jobText.includes(s.toLowerCase()) && s.includes(' ') // multi-word = likely a specific tool
  ).length * 5;

  score = Math.min(100, score + toolBonus);

  return { score, matchedSkills };
}
