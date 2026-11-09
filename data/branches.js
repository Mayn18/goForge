// The nine branches of the skill tree. `color` references CSS variables in css/style.css.
export const BRANCHES = [
  { id: 'A', name: 'Go Language Mastery', color: 'var(--b-a)', blurb: 'The language, its runtime, and the concurrency model. Everything else stands on this.' },
  { id: 'B', name: 'CS & Engineering Foundations', color: 'var(--b-b)', blurb: 'Processes, networks, DNS, TLS, data structures, serialization. Taught as backend knowledge, not a CS degree.' },
  { id: 'C', name: 'Backend Fundamentals', color: 'var(--b-c)', blurb: 'What happens when a request arrives, and everything a production HTTP service needs around it.' },
  { id: 'D', name: 'Databases & Data', color: 'var(--b-d)', blurb: 'SQL, PostgreSQL, schema design, indexes, transactions, and caching, with the reasons behind each choice.' },
  { id: 'E', name: 'Architecture & Design', color: 'var(--b-e)', blurb: 'Structure, boundaries, and distributed-system thinking, including when a pattern is unnecessary.' },
  { id: 'F', name: 'Security', color: 'var(--b-f)', blurb: 'Taught alongside the features it protects. Threat-model first, then defend.' },
  { id: 'G', name: 'Testing & Reliability', color: 'var(--b-g)', blurb: 'Tests you can trust, observability you can debug with, and load you have actually measured.' },
  { id: 'H', name: 'DevOps & Deployment', color: 'var(--b-h)', blurb: 'Git, containers, CI/CD, reverse proxies, and running software somewhere other than your laptop.' },
  { id: 'I', name: 'Advanced Backend', color: 'var(--b-i)', blurb: 'Scale, resilience, consistency, performance engineering, and incident response. Builds on everything above.' },
];
export const LEVELS = [
  { n: 1, name: 'Foundational', desc: 'Understand the concept and its vocabulary.' },
  { n: 2, name: 'Independent implementation', desc: 'Build it yourself from requirements, using documentation.' },
  { n: 3, name: 'Integration & problem-solving', desc: 'Combine it with other concepts; diagnose when it misbehaves.' },
  { n: 4, name: 'Engineering-level', desc: 'Handle edge cases, failure, performance, and trade-offs in realistic systems.' },
  { n: 5, name: 'Advanced systems thinking', desc: 'Design and defend architecture under ambiguity and scale.' },
];
export const STATUSES = {
  locked: 'Locked', available: 'Available', in_progress: 'In progress', practiced: 'Practiced', mastered: 'Mastered',
};
