// Curated core references. kind: 'official' = maintained by the project/standards body itself;
// 'supp' = supplementary (well-regarded, but not the source of truth). The Reference page also
// auto-collects every link used in lessons and outline nodes.
const O = 'official', S = 'supp';
export const CORE_REFS = [
  // Go
  ['Go documentation', 'https://go.dev/doc/', O, 'Go', 'Start here: tutorials, guides, FAQs'],
  ['The Go Programming Language Specification', 'https://go.dev/ref/spec', O, 'Go', 'The language definition; the final word on semantics'],
  ['Effective Go', 'https://go.dev/doc/effective_go', O, 'Go', 'Idioms. Older (pre-generics) but still sound; read with Go 1.22+ in mind'],
  ['Go standard library (pkg.go.dev/std)', 'https://pkg.go.dev/std', O, 'Go', 'API reference for every standard package'],
  ['Go Blog', 'https://go.dev/blog/', O, 'Go', 'Design explanations by the Go team'],
  ['Accessing relational databases', 'https://go.dev/doc/database/', O, 'Go', 'database/sql guides'],
  ['The Go Memory Model', 'https://go.dev/ref/mem', O, 'Go', 'What concurrent programs may rely on'],
  ['A Guide to the Go Garbage Collector', 'https://go.dev/doc/gc-guide', O, 'Go', 'GOGC, memory limit, tuning'],
  ['Diagnostics', 'https://go.dev/doc/diagnostics', O, 'Go', 'pprof, tracing, debugging overview'],
  ['Data Race Detector', 'https://go.dev/doc/articles/race_detector', O, 'Go', 'How to use and interpret -race'],
  ['Go Fuzzing', 'https://go.dev/doc/fuzz/', O, 'Go', 'Native fuzz testing'],
  ['Organizing a Go module', 'https://go.dev/doc/modules/layout', O, 'Go', 'Official guidance on repository layout'],
  ['Go Modules Reference', 'https://go.dev/ref/mod', O, 'Go', 'The complete modules reference'],
  ['go.mod file reference', 'https://go.dev/doc/modules/gomod-ref', O, 'Go', 'Each go.mod directive explained'],
  ['Go Code Review Comments', 'https://go.dev/wiki/CodeReviewComments', O, 'Go', 'Style conventions reviewers expect'],
  ['Go release history', 'https://go.dev/doc/devel/release', O, 'Go', 'What changed in each version'],
  // HTTP & web
  ['HTTP specifications (httpwg)', 'https://httpwg.org/specs/', O, 'HTTP', 'RFC index for HTTP semantics, messaging, caching, HTTP/2, HTTP/3'],
  ['RFC 9110: HTTP Semantics', 'https://httpwg.org/specs/rfc9110.html', O, 'HTTP', 'Methods, status codes, headers: the meaning of HTTP'],
  ['RFC 9112: HTTP/1.1', 'https://httpwg.org/specs/rfc9112.html', O, 'HTTP', 'Message syntax and connection management'],
  ['RFC 9111: HTTP Caching', 'https://httpwg.org/specs/rfc9111.html', O, 'HTTP', 'Cache-Control and friends'],
  ['MDN Web Docs: HTTP', 'https://developer.mozilla.org/en-US/docs/Web/HTTP', O, 'HTTP', 'Browser-side behavior and readable explanations'],
  // Databases
  ['PostgreSQL documentation', 'https://www.postgresql.org/docs/current/', O, 'PostgreSQL', 'Always read the manual for the version you run'],
  ['PostgreSQL: SQL commands', 'https://www.postgresql.org/docs/current/sql-commands.html', O, 'PostgreSQL', 'Syntax reference for every statement'],
  ['PostgreSQL: Concurrency Control', 'https://www.postgresql.org/docs/current/mvcc.html', O, 'PostgreSQL', 'MVCC, isolation, locking'],
  ['PostgreSQL: Performance Tips', 'https://www.postgresql.org/docs/current/performance-tips.html', O, 'PostgreSQL', 'EXPLAIN and planner statistics'],
  ['Redis documentation', 'https://redis.io/docs/latest/', O, 'Redis', 'Data types, commands, persistence'],
  // Tools
  ['Docker documentation', 'https://docs.docker.com/', O, 'Docker', 'Engine, build, Compose'],
  ['Git documentation', 'https://git-scm.com/doc', O, 'Git', 'Reference manual and the Pro Git book'],
  ['GitHub Actions documentation', 'https://docs.github.com/en/actions', O, 'CI/CD', 'Workflows, runners, security hardening'],
  ['Nginx documentation', 'https://nginx.org/en/docs/', O, 'Nginx', 'Directive reference and guides'],
  // Security
  ['OWASP', 'https://owasp.org/', O, 'Security', 'The community hub'],
  ['OWASP Top 10', 'https://owasp.org/www-project-top-ten/', O, 'Security', 'Most critical web application risks'],
  ['OWASP API Security Top 10', 'https://owasp.org/API-Security/', O, 'Security', 'API-specific risks'],
  ['OWASP Cheat Sheet Series', 'https://cheatsheetseries.owasp.org/', O, 'Security', 'Concise, practical defenses by topic'],
  // Operations
  ['Google SRE Book', 'https://sre.google/sre-book/table-of-contents/', S, 'Reliability', 'Free book: SLOs, monitoring, incidents, overload'],
  ['OpenTelemetry documentation', 'https://opentelemetry.io/docs/', O, 'Observability', 'Vendor-neutral traces, metrics, logs'],
  ['Prometheus documentation', 'https://prometheus.io/docs/introduction/overview/', O, 'Observability', 'Metrics model and querying'],
  ['The Twelve-Factor App', 'https://12factor.net/', S, 'Operations', 'Config, logs, and processes for cloud services'],
  ['Linux man-pages online', 'https://man7.org/linux/man-pages/', O, 'Systems', 'Authoritative Linux syscall and command reference'],
  ['Beej\'s Guide to Network Programming', 'https://beej.us/guide/bgnet/', S, 'Systems', 'Sockets explained clearly (C, but the concepts transfer)'],
];
