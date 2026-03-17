export const PM_PROFILE = {
  role: 'Project Manager at Worcester Polytechnic Institute (WPI)',
  experience: [
    'Managing multi-million dollar infrastructure and security portfolio',
    'AI camera systems: Milestone VMS, AI Argus',
    'Emergency phone systems, parking gates, electronic access control',
    'MGHPCC data center coordination',
    'Executive-level status reporting',
    'Coordination with campus police, facilities, vendors, grad students',
  ],
  certifications: ['CAPM', 'PMI-ACP', 'SAFe'],
  skills: ['Python', 'SQL', 'Power BI', 'Power Platform', 'Agile', 'Scrum'],
  previous: 'RELI Group — PM Analyst, cybersecurity, ISO 27001',
  location: 'Worcester MA, open to remote',
};

export function profileToString(): string {
  return `
ROLE: ${PM_PROFILE.role}
EXPERIENCE:
${PM_PROFILE.experience.map(e => `  - ${e}`).join('\n')}
CERTIFICATIONS: ${PM_PROFILE.certifications.join(', ')}
SKILLS: ${PM_PROFILE.skills.join(', ')}
PREVIOUS: ${PM_PROFILE.previous}
LOCATION: ${PM_PROFILE.location}
  `.trim();
}
