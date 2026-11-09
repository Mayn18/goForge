// The Beep-Bot capstone: a staged progression for building the backend yourself.
// This file describes WHAT to achieve and HOW TO KNOW you achieved it, never the implementation.
export const BEEPBOT = {
  repo: 'https://github.com/Mayn18/Beep-Bot',
  intro: 'Beep-Bot is your existing pixel-art chat frontend (HTML, CSS, vanilla JS). It has a chat UI, saved conversations, themes, and settings, and it talks to a mock reply function behind one adapter file. You will build the backend it deserves, in the order the prerequisites dictate. Every stage ends with a working, demonstrable system.',
  rules: [
    'You write the backend. GoForge only specifies the destination and the way to check you arrived.',
    'Keep the capstone in its own repository (for example `beep-bot-api`). Do not rely on GoForge for code.',
    'Until Stage 14, no AI model is involved. The bot is deterministic, so every behavior is testable.',
    'Work in small commits. Each stage should leave `main` green: build, vet, and tests passing.',
    'Write a decision record (a short markdown note: context, options, choice, consequences) whenever a stage lists a decision.',
  ],
  contract: {
    title: 'What the frontend already expects',
    body: 'The UI calls a single function, `sendMessage({ conversationId, messages, playerName, signal })`, in `js/api/chatApi.js`, where `messages` is `[{ role: "user" | "bot", text }]` (oldest first, including the new message) and the return value must be `{ text }`. If it throws, the UI shows an in-world error with a retry. Conversations currently live in the browser: `{ id, title, createdAt, updatedAt, messages: [{ id, role, text, ts, error? }] }`. Read the repository yourself and verify these details against the current code before you design anything; treat what you find there, not this summary, as the source of truth.',
  },
};

export const STAGES = [
  {
    id: 's0', n: 0, title: 'Orientation: discover the contract', level: 1, nodes: ['c-http-lifecycle'],
    goal: 'Understand what API the existing frontend implies before you write a line of Go.',
    tasks: ['Read the frontend\'s adapter, store, and actions modules. List every piece of state the UI keeps (conversations, messages, settings, theme, stats).', 'Decide, per piece of state, whether it belongs on a server, stays in the browser, or both. Write down why.', 'Draft the API surface as a table: method, path, request, response, error cases. Keep it small.'],
    decisions: ['Which state is server-owned? (Theme is a good test case.)', 'Who generates IDs: client or server?'],
    acceptance: ['A one-page API draft exists and every endpoint maps to a frontend need.', 'You can explain what happens, step by step, when the user presses Send, from keypress to rendered reply.'],
  },
  {
    id: 's1', n: 1, title: 'A first server: health and a deterministic reply', level: 2, nodes: ['c-net-http', 'c-json', 'a-errors'],
    goal: 'A Go HTTP server that the frontend can actually call.',
    tasks: ['`GET /healthz` returns 200 and a tiny JSON body.', '`POST /api/chat` accepts the contract above and returns `{ text }` from a deterministic function (a keyword table or a hash of the input; no randomness).', 'Make the frontend\'s adapter call your server instead of the mock. The browser will block you at first. Work out why and solve it properly (two legitimate approaches exist: understand both and pick one).'],
    decisions: ['Serve the frontend from the Go server (same origin) or run them separately with CORS?', 'What status codes and error body shape do you return, and why?'],
    acceptance: ['`curl` against `/api/chat` returns identical output for identical input, every time.', 'Sending a message from the real UI shows your server\'s reply.', 'Malformed JSON, an empty `messages` array, and a 1 MB body each produce a clear 4xx, never a 500 or a hang.', 'The server has explicit read-header, read, write, and idle timeouts.'],
  },
  {
    id: 's2', n: 2, title: 'Structure, configuration, and lifecycle', level: 3, nodes: ['e-structure', 'c-config-logging', 'c-shutdown', 'c-middleware'],
    goal: 'Turn the first server into something you could hand to a teammate.',
    tasks: ['Put the responder behind an interface so the deterministic bot is one implementation among future ones.', 'Configuration from environment variables, validated at startup with a helpful failure message.', 'Structured logging with a request ID on every line; request logging as middleware; panics recovered into 500s without crashing the process.', 'Graceful shutdown on SIGINT/SIGTERM.'],
    decisions: ['Package layout: what are your boundaries and why? Which tempting abstractions are you deliberately not creating yet?'],
    acceptance: ['Starting with a missing/invalid required config value fails fast with a clear message and non-zero exit.', 'Every log line for one request shares a request ID; secrets never appear.', 'A request that takes 3 s completes after SIGTERM is sent; new connections are refused during the drain.', 'A deliberately panicking handler returns 500 and the server keeps serving.'],
  },
  {
    id: 's3', n: 3, title: 'Persistence: conversations in PostgreSQL', level: 3, nodes: ['d-schema', 'd-postgres', 'd-go-sql', 'd-migrations', 'e-di-repo'],
    goal: 'Conversations and messages survive restarts, with a schema you designed.',
    tasks: ['Design the schema: conversations, messages, constraints, indexes you can justify. Draw it before you create it.', 'Migrations as versioned files, applied by a documented command.', 'A repository layer behind interfaces; a service layer holding the rules.', 'Endpoints: list, create, get (with messages), rename, delete conversations; posting a message stores both the user message and the bot reply.', 'Run Postgres locally via a container or native install (document both paths).'],
    decisions: ['Message ordering: timestamps, sequence numbers, or both? What breaks with clock skew or concurrent inserts?', 'Soft delete vs hard delete.', 'How do you store the "title" and when does it get computed?'],
    acceptance: ['Restarting the server loses nothing.', 'Two simultaneous messages in one conversation both persist with a deterministic, documented order.', 'Deleting a conversation removes its messages (enforced by the database, not just your code).', 'Pool settings are explicit and you can state why you chose the numbers.', 'Every query uses parameters; you can explain what would go wrong otherwise.'],
  },
  {
    id: 's4', n: 4, title: 'Connect the frontend', level: 3, nodes: ['c-rest', 'c-validation-errors', 'c-versioning'],
    goal: 'The UI works end to end against your API instead of browser storage.',
    tasks: ['Modify your copy of the frontend (the adapter and actions) to load and mutate conversations through the API. Keep changes minimal and deliberate.', 'Handle loading, failure, and retry states you didn\'t need when everything was local.', 'Version the API (`/v1`) and write the error contract down.'],
    decisions: ['Optimistic UI or wait for the server? What does a failed optimistic update look like to the user?', 'What happens if the same message is sent twice because of a retry? (You will solve this properly in Stage 11.)'],
    acceptance: ['Create, rename, delete, and switch conversations in the UI with a server restart in the middle: state is intact.', 'Killing the API shows a friendly error in the UI and recovery when it returns.', 'Every endpoint has a handler-level test, including at least one validation failure.'],
  },
  {
    id: 's5', n: 5, title: 'Users and authentication', level: 4, nodes: ['c-authn', 'c-authz', 'f-passwords', 'f-sessions-csrf'],
    goal: 'Conversations belong to people; strangers cannot read them.',
    tasks: ['Threat-model first: assets, trust boundaries, top threats. One page.', 'Registration and login with correct password storage.', 'Sessions or tokens (your decision, documented) with working logout.', 'Scope every conversation query to the authenticated user; write the tests that try to cross the boundary.'],
    decisions: ['Sessions vs JWT.', 'Where cookies are used, which attributes, and how CSRF is handled.', 'How account-enumeration is prevented.'],
    acceptance: ['User A requesting user B\'s conversation ID gets a response indistinguishable from "not found".', 'After logout, the old credential no longer works.', 'Passwords and tokens never appear in logs (tested).', 'You can explain your CSRF defense and demonstrate that it blocks a cross-site request.'],
  },
  {
    id: 's6', n: 6, title: 'Hardening', level: 4, nodes: ['c-ratelimit', 'f-owasp-api', 'f-input-injection', 'f-tls-secrets'],
    goal: 'Make abuse expensive and mistakes survivable.',
    tasks: ['Rate limiting for login (strict) and chat (generous), with correct 429 behavior and a way to test it without sleeping.', 'Input limits everywhere: body size, message length, conversations per user, titles.', 'Security headers and CORS policy that match your deployment; secrets only from configuration.', 'Walk the OWASP API Security Top 10 against your service and write down, item by item, how you are or are not exposed.'],
    decisions: ['What exactly counts as "the client" for rate limiting when you are behind a proxy?', 'What do you do when the limiter store is unavailable?'],
    acceptance: ['A scripted attack (written by you) of 1,000 login attempts is throttled and logged without taking the service down.', 'Oversized and malformed inputs are rejected before reaching the database.', 'The OWASP walkthrough document exists and contains at least one finding you fixed.'],
  },
  {
    id: 's7', n: 7, title: 'Testing and CI', level: 4, nodes: ['g-testing', 'g-http-db-tests', 'g-race-fuzz-bench', 'h-git', 'h-ci'],
    goal: 'Confidence you can change things without fear.',
    tasks: ['Unit tests for the service layer with fakes; integration tests against a real PostgreSQL; handler tests with `httptest`.', 'Run everything with `-race`. Add one fuzz test where it is genuinely useful (for example on input parsing).', 'A GitHub Actions workflow: build, vet, test (with a Postgres service), and lint.', 'Use coverage as a flashlight, not a target: find an untested important path and test it.'],
    decisions: ['What is a fake and what is a real dependency in each test layer, and why?', 'How do you isolate database tests from each other?'],
    acceptance: ['A fresh clone runs the full suite with one documented command.', 'The CI pipeline fails when you intentionally introduce a data race.', 'You can point to a bug the tests caught while you were writing them.'],
  },
  {
    id: 's8', n: 8, title: 'Containers and deployment', level: 4, nodes: ['h-docker', 'h-compose', 'h-proxy', 'h-deploy'],
    goal: 'Run it somewhere that is not your laptop, repeatably.',
    tasks: ['A multi-stage Dockerfile producing a small image that runs as a non-root user.', 'A Compose file for API + Postgres (+ your reverse proxy) with healthchecks and proper start ordering.', 'Reverse proxy with TLS termination; correct forwarded-header handling in your app.', 'Deploy to a real host (a small VPS or a managed container platform) and document the procedure so it is repeatable.'],
    decisions: ['How are migrations applied during a deploy, and what happens if the new code is rolled back?', 'Where do secrets live in each environment?'],
    acceptance: ['`docker compose up` from a clean machine produces a working system.', 'Stopping the database container makes readiness fail and the API degrade clearly, then recover when it returns.', 'A deploy of a new version causes no failed requests in a simple load loop (or you can state exactly what fails and why).'],
  },
  {
    id: 's9', n: 9, title: 'Concurrency and background work', level: 4, nodes: ['a-sync-context', 'c-jobs', 'c-realtime'],
    goal: 'Replies take time now; the system must stay responsive and correct.',
    tasks: ['Make the responder deliberately slow and sometimes failing (a configurable fake). Observe what that does to your server.', 'Enforce request timeouts via context all the way to the database and the responder.', 'Stream replies to the UI using server-sent events or similar, with cancellation when the user navigates away.', 'Move at least one non-interactive task into a background worker (examples: title generation, retention cleanup) with retries.'],
    decisions: ['What do you do with a reply that finishes after the client has gone?', 'In-process worker vs separate process vs queue table: what are you buying and paying?'],
    acceptance: ['With a 5 s responder, 200 concurrent chats do not exhaust the DB pool or goroutines (show numbers).', 'Cancelling a streaming reply stops the work server-side (test it).', 'A goroutine count graph or log line shows no leak after 10,000 requests.', '`-race` is clean.'],
  },
  {
    id: 's10', n: 10, title: 'Observability and failure', level: 5, nodes: ['g-observability', 'g-debug', 'e-fault-tolerance'],
    goal: 'You can tell what the system is doing and why it is failing.',
    tasks: ['Metrics: request rate, errors, latency histograms, pool stats, queue depth. Expose them and look at them.', 'Traces or at least correlation across API, database, and responder.', 'Inject failures: database down, slow queries, responder timeouts, full disk. Predict the behavior first, then compare.', 'Add timeouts and sensible retries, plus a circuit-breaker-like protection for the responder, only where your experiments justify them.'],
    decisions: ['Which three alerts would you actually want to be woken for, and what are their thresholds?'],
    acceptance: ['For each injected failure, a written prediction exists next to the observed outcome.', 'You can diagnose an "it is slow" report using only your metrics and logs.', 'Retries never amplify an outage (explain how you know).'],
  },
  {
    id: 's11', n: 11, title: 'Correctness under retries: idempotency', level: 4, nodes: ['e-idempotency', 'd-transactions'],
    goal: 'Double-clicks, flaky networks, and impatient clients do not corrupt conversations.',
    tasks: ['Reproduce the duplicate-message problem from Stage 4 on purpose.', 'Design and implement an idempotency mechanism for message creation.', 'Examine your transaction boundaries: which operations must be atomic (user message + reply?) and at what isolation level?'],
    decisions: ['Client-generated message IDs vs idempotency keys.', 'What do you return for a repeated request: the original response or an error?'],
    acceptance: ['Sending the same request 50 times concurrently yields exactly one stored message and the same response each time.', 'A crash between storing the user message and the reply leaves the system in a state you can describe and recover from.'],
  },
  {
    id: 's12', n: 12, title: 'Performance and caching, only where justified', level: 5, nodes: ['a-profiling', 'g-load', 'd-indexes', 'd-nplus1', 'd-redis', 'i-perf'],
    goal: 'Find the real bottleneck with measurements, then fix that.',
    tasks: ['Create a realistic dataset (hundreds of thousands of conversations) and a load test with a realistic mix of operations.', 'Profile CPU, allocations, and database. Write down the top three bottlenecks with evidence.', 'Fix them one at a time, re-measuring after each. Eliminate any N+1 patterns; examine your query plans.', 'Introduce caching only if the data demands it. If you do, write the invalidation story first.'],
    decisions: ['Keyset vs offset pagination for the conversation list, with numbers.', 'What is your latency target and where did it come from?'],
    acceptance: ['A before/after table of p50/p95/p99 and throughput for each change.', 'You can demonstrate that one of your intuitions about performance was wrong.', 'Any cache has a measured hit rate and a defined behavior when it is down or stale.'],
  },
  {
    id: 's13', n: 13, title: 'Scaling architecture on paper', level: 5, nodes: ['e-monolith-micro', 'i-scaling-lb', 'i-replication-partitioning', 'i-brokers-consistency', 'i-system-design'],
    goal: 'Design, and defend, how Beep-Bot would serve 100x its current load.',
    tasks: ['Write a design document: requirements, estimates (QPS, storage, bandwidth), data model, API, architecture, bottlenecks, failure modes.', 'Include at least three alternatives you rejected and why.', 'Identify what you would change first and what you would deliberately leave alone.', 'Present it (to a person, or as a recorded explanation) and answer hard questions.'],
    decisions: ['Does Beep-Bot need microservices? Argue both sides, then decide.', 'Which consistency guarantees do users actually need?'],
    acceptance: ['The document\'s estimates are checkable arithmetic, not vibes.', 'A reader can find the single point of failure in your design (and you already listed it).', 'You can defend the design under at least five adversarial questions.'],
  },
  {
    id: 's14', n: 14, title: 'Finally: the AI model', level: 5, nodes: ['c-jobs', 'i-resilience', 'f-threat-model'],
    goal: 'Replace the deterministic responder with a model behind the interface you built in Stage 2.',
    tasks: ['Choose a model provider by reading its API documentation, pricing, rate limits, and data policy.', 'Implement the new responder behind the existing interface; keep the deterministic one as a fallback and as the test double.', 'Handle streaming, timeouts, cancellation, retries with backoff, and provider outages.', 'Threat-model what is new: prompt injection, cost abuse, data leakage between users, logging of sensitive content.'],
    decisions: ['What conversation context do you send, how much, and what does it cost?', 'What do users see when the provider is down?'],
    acceptance: ['A provider outage degrades gracefully and recovers without a restart.', 'Per-user cost limits exist and are tested.', 'Switching back to the deterministic responder is a configuration change.', 'Your threat model includes at least three AI-specific threats with mitigations.'],
  },
];
export const STAGE_MAP = Object.fromEntries(STAGES.map((s) => [s.id, s]));
