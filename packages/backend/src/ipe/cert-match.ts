export function scoreCertMatch(profileCerts: string[], jobDescription: string): number {
  const jobLower = jobDescription.toLowerCase();

  // Find which certs are mentioned in the job description
  const allKnownCerts = [
    'pmp', 'capm', 'pmi-acp', 'safe', 'csm', 'psm', 'itil',
    'prince2', 'six sigma', 'cissp', 'cism', 'comptia',
  ];

  const jobCerts = allKnownCerts.filter(cert => jobLower.includes(cert));

  // If job mentions no certs, neutral score
  if (jobCerts.length === 0) return 70;

  // Check how many job-required certs you have
  const profileCertsLower = profileCerts.map(c => c.toLowerCase());
  const matched = jobCerts.filter(jc => profileCertsLower.some(pc => pc.includes(jc) || jc.includes(pc)));

  if (matched.length === jobCerts.length) return 100;
  if (matched.length > 0) return 50 + Math.round((matched.length / jobCerts.length) * 40);
  return 20; // Job requires certs you don't have
}
