---
title: Testing Go code
go: 1.22+
time: 6-8 h
---

## Overview

Tests are how you change a running system without fear. In Go the tooling is built in (`go test`, benchmarks, fuzzing, coverage, the race detector) and the culture favors plain code over frameworks. This lesson is about writing tests that **fail for the right reasons**: table-driven unit tests, HTTP handler tests, fakes instead of mocks, deterministic time and concurrency, benchmarks that measure what you think they measure, and fuzzing for inputs you did not imagine.

## Prerequisites

**Essential:** *Modules & packages*; *Interfaces & generics* (fakes are interface implementations); *Error handling*.

**Recommended:** *net/http servers & handlers*; *Goroutines & channels*.

## How it works

### The testing package in five facts

1. Test files end in `_test.go`; test functions are `func TestXxx(t *testing.T)`. They run with `go test ./...`.
2. A test fails with `t.Error`/`t.Errorf` (continue) or `t.Fatal`/`t.Fatalf` (stop this test). A test that returns without failing passes.
3. `t.Run(name, func(t *testing.T){...})` creates subtests, which can be selected with `-run 'TestX/case_name'` and run in parallel with `t.Parallel()`.
4. `t.Helper()` marks a function as a helper so failures point at the caller's line. `t.Cleanup(fn)` registers teardown; `t.TempDir()` gives a per-test directory; `t.Setenv` sets an environment variable for the test.
5. Tests in `package foo` can see unexported identifiers; tests in `package foo_test` see only the public API, which is usually what you want to protect.

### Table-driven tests

```go
func TestParseSize(t *testing.T) {
	tests := []struct {
		name    string
		in      string
		want    int64
		wantErr bool
	}{
		{"bytes", "10", 10, false},
		{"kilo", "2K", 2048, false},
		{"empty", "", 0, true},
		{"negative", "-1K", 0, true},
		{"overflow", "99999999999999999999", 0, true},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, err := ParseSize(tc.in)
			if (err != nil) != tc.wantErr {
				t.Fatalf("ParseSize(%q) error = %v, wantErr %v", tc.in, err, tc.wantErr)
			}
			if got != tc.want {
				t.Errorf("ParseSize(%q) = %d, want %d", tc.in, got, tc.want)
			}
		})
	}
}
```

A good failure message names the function, the input, the actual value and the expected value. Since Go 1.22 each iteration has its own `tc`, so parallel subtests that capture it are safe in a module declaring `go 1.22` or later.

### Test doubles: prefer fakes

A **fake** is a working lightweight implementation (an in-memory store). A **stub** returns canned answers. A **mock** verifies that specific calls happened. Hand-written fakes behind small consumer-defined interfaces keep tests tied to *behavior*, whereas heavy mocks tie them to *implementation* and break on every refactor.

### Testing HTTP

`net/http/httptest` provides `NewRecorder` (a `ResponseWriter` that records) and `NewServer` (a real server on a loopback port for client testing). You call `handler.ServeHTTP(rec, req)` directly: no ports, no flakiness.

### Determinism: time, randomness, concurrency

A test that depends on the wall clock, random values or goroutine scheduling will eventually flake. Inject a clock interface, seed or inject randomness, and synchronize on events (channels, `WaitGroup`) rather than sleeping. Go 1.24 added the experimental `testing/synctest` package, which runs code in a "bubble" with a fake clock (check the release notes for its status in your version).

### Coverage, race, and what they tell you

`go test -cover` reports statements executed, not behavior verified. 100% coverage with weak assertions proves nothing; low coverage on error paths proves something. `go test -race` finds data races that *execute* during the run. Use `-count=N` to repeat tests and surface flakiness, and `-shuffle=on` to catch order dependence.

### Benchmarks

```go
func BenchmarkParseSize(b *testing.B) {
	for b.Loop() { // Go 1.24+
		ParseSize("2K")
	}
}
// Before 1.24:  for i := 0; i < b.N; i++ { ParseSize("2K") }
```

Run with `go test -bench=. -benchmem`. Report allocations. Beware: the compiler may optimize away work whose result is unused (assign results to a package-level sink in pre-1.24 benchmarks), and a single run is not a measurement: compare runs with `benchstat`.

### Fuzzing

```go
func FuzzParseSize(f *testing.F) {
	f.Add("10")
	f.Add("2K")
	f.Fuzz(func(t *testing.T, s string) {
		n, err := ParseSize(s)
		if err == nil && n < 0 {
			t.Fatalf("ParseSize(%q) = %d, negative with nil error", s, n)
		}
	})
}
```

`go test -fuzz=FuzzParseSize -fuzztime=30s` mutates inputs and saves failing cases in `testdata/fuzz/`, which then run as regular tests. Fuzzing asserts **properties** (never panics; round-trips; output valid), not exact outputs.

### Integration tests and TestMain

Tests that need a database or network are slower and flakier; separate them with build tags (`//go:build integration`) or `testing.Short()`, and run them in CI. `TestMain(m *testing.M)` runs setup/teardown once per package.

> [!GO] Go 1.24 added `t.Context()` (a context cancelled just before cleanup functions run), `b.Loop()`, and the `testing/synctest` experiment. Go 1.20 added `go build -cover` for coverage of integration runs. Check `go version` before using them.

## Official documentation

- [official] [Tutorial: Add a test](https://go.dev/doc/tutorial/add-a-test) — The shortest path to a first test.
- [official] [Package testing](https://pkg.go.dev/testing) — Read the package overview in full (tests, benchmarks, fuzzing, subtests, `TestMain`, skipping) and the `T` and `B` method lists.
- [official] [Go Fuzzing](https://go.dev/doc/fuzz/) — The tutorial and the "Fuzz target" and corpus sections. Vocabulary: *seed corpus*, *fuzz target*, *minimization*.
- [official] [Using Subtests and Sub-benchmarks (Go Blog)](https://go.dev/blog/subtests) — Table tests, `-run` patterns, and parallel subtests.
- [official] [Package net/http/httptest](https://pkg.go.dev/net/http/httptest) — Recorder and test server.
- [official] [Data Race Detector](https://go.dev/doc/articles/race_detector) — How to run and read reports in tests.
- [official] [Code coverage for Go integration tests (Go Blog)](https://go.dev/blog/integration-test-coverage) — Coverage beyond unit tests.
- [official] [Go Code Review Comments: Useful Test Failures](https://go.dev/wiki/CodeReviewComments#useful-test-failures) — What a good failure message contains.
- [official] [Package testing/iotest and testing/fstest](https://pkg.go.dev/testing/iotest) — Readers that fail on demand, for testing error paths.
- [supplementary] [Go Wiki: TableDrivenTests](https://go.dev/wiki/TableDrivenTests) — Patterns and the reasoning behind them.

## Practical examples

### A fake store and a service test

```go
type fakeStore struct {
	mu   sync.Mutex
	msgs []Message
	err  error // set to inject failure
}

func (f *fakeStore) Save(ctx context.Context, m Message) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.err != nil {
		return f.err
	}
	f.msgs = append(f.msgs, m)
	return nil
}

func TestSend_StoreFails(t *testing.T) {
	st := &fakeStore{err: errors.New("disk full")}
	svc := NewService(st, fixedClock{t0})

	_, err := svc.Send(context.Background(), "hi")

	if err == nil {
		t.Fatal("Send() error = nil, want store failure")
	}
	if len(st.msgs) != 0 {
		t.Errorf("stored %d messages after a failed save, want 0", len(st.msgs))
	}
}
```

### Golden files for large outputs

```go
want, _ := os.ReadFile("testdata/render.golden")
if !bytes.Equal(got, want) {
	t.Errorf("output differs from testdata/render.golden; rerun with -update to accept")
}
```

Add an `-update` flag (defined with the `flag` package) to rewrite golden files deliberately, and review the diff like code.

### Common mistakes

> [!PITFALL] **Asserting on implementation.** A test that checks "method X was called twice" fails when you refactor correctly. Assert on observable outcomes.

> [!PITFALL] **`time.Sleep` for synchronization.** It is both slow and flaky. Wait on a channel, a `WaitGroup`, or poll with a deadline.

> [!PITFALL] **Shared state between tests.** Package-level variables and a shared database make results depend on order. Use `-shuffle=on` to expose it.

> [!PITFALL] **Ignoring the error path.** Most production incidents happen in branches the happy-path tests never executed. Use fakes to inject failures.

> [!PITFALL] **`t.Fatal` in a goroutine.** `FailNow` must be called from the test goroutine; calling it from another goroutine does not stop the test properly. Send errors back over a channel and fail in the test goroutine.

> [!PITFALL] **Chasing coverage numbers.** Coverage is a map of what you have not run, not a measure of quality.

## Hands-on exercises

### 1. Table-driven from scratch

Write `Slugify(title string) string` (lowercase, ASCII letters and digits, hyphens between words, no leading/trailing hyphens, collapse runs). Write the table of tests *before* the implementation, including Unicode input, empty string, and punctuation-only input. Then implement until green.

You are done when the table has at least fifteen cases, each named, and a deliberately introduced bug in your implementation is caught by exactly the case that should catch it.

### 2. Test an HTTP handler through the full stack of middleware

Take a handler that depends on a store interface. Write a hand-made fake with error injection and test: success, validation failure, store failure, malformed JSON, body too large, wrong method. Test the routes through the actual `ServeMux`, not by calling the handler function directly.

You are done when each documented status code in the handler is exercised, and no test opens a network port.

### 3. Fuzz something with an invariant

Write a small parser or encoder with its inverse (for example, a custom key-value format). Fuzz the property `Decode(Encode(x)) == x` and a second property that `Decode` never panics on arbitrary bytes. Let the fuzzer find at least one real bug (write your first version quickly, with a flaw). Commit the minimized failing input and fix the bug.

You are done when the failing input lives in `testdata/fuzz/` and runs as an ordinary test.

### 4. Benchmark, then lie to yourself and catch it

Benchmark two implementations of the same function (for example, string concatenation versus `strings.Builder`) across three input sizes with `-benchmem`. Then deliberately write a flawed benchmark whose result gets optimized away or whose setup is counted in the loop, show the misleading numbers, and fix it. Compare runs with `benchstat`.

You are done when you can explain, with the numbers, which implementation wins at which size and why a single run is not enough.

## Engineering challenge

**Make a flaky, time-dependent component fully deterministic.** Write a `TokenBucket` rate limiter with a clock, then a test suite that does **not** use `time.Sleep` and passes 1,000 consecutive runs (`-count=1000`) under `-race` and `-shuffle=on`. Requirements:

- Inject a clock; build a fake clock with `Advance(d)` that also fires timers deterministically if your implementation uses them.
- Cover: burst behavior, refill at fractional rates, long idle periods (no overflow past capacity), clock moving backwards, a zero rate, and concurrent callers hammering `Allow()` from 100 goroutines with an exact total-grant assertion.
- Add a fuzz test asserting that, for any sequence of (advance, request) operations, grants never exceed `capacity + rate * elapsed`.
- Add a benchmark and a parallel benchmark (`b.RunParallel`) showing contention, and report the numbers.

Edge cases to decide and document: what a request for more tokens than capacity does; the behavior at the instant of exact refill; whether `Allow` and `Wait` agree. Explain in writing how you would test the *real* clock integration with minimal flakiness.

## Knowledge check

### 1. Why subtests

Give three benefits of `t.Run` over a plain loop with `t.Errorf`.

>>>
(1) Each case has a name, so failures identify themselves and appear separately. (2) You can run one case with `-run 'TestX/name'`. (3) Subtests can call `t.Parallel()` and use `t.Fatal` to stop only that case, while others continue; setup and cleanup can be scoped per case with `t.Cleanup`.

### 2. Coverage and confidence

A package has 95% statement coverage. What does that tell you and what does it not?

>>>
It tells you 95% of statements executed at least once during the tests. It does not tell you the results were asserted, that edge cases or error paths with the same statements were examined, that concurrent behavior is correct, or that any property holds across inputs. Treat it as a way to find untested code, not as proof of quality.

### 3. Fake or mock

You must test code that calls an email provider. Compare a hand-written fake, a generated mock with expectations, and a real sandbox account.

>>>
A fake (in-memory sender recording messages, with error injection) is fast, deterministic and survives refactors because assertions are about outcomes. A mock with call-order expectations is quick to generate but couples tests to implementation. A sandbox account validates the real integration (formats, auth, rate limits) but is slow, flaky and needs credentials, so it belongs in a small, separate integration suite. Use fakes for most tests and a few integration tests for contract confidence.

### 4. Sleep versus synchronization

A test starts a goroutine and uses `time.Sleep(100 * time.Millisecond)` before checking its effect. Describe two failure modes and a better approach.

>>>
On a slow or loaded CI machine 100 ms may not suffice (spurious failure), while on a fast machine you waste time on every run; either way the test encodes timing assumptions. Better: have the goroutine signal completion through a channel or `WaitGroup` that the test waits on (with a generous timeout as a safety net), or inject a fake clock and advance it explicitly.

### 5. What fuzzing asserts

Why can't a fuzz test assert `Parse(s) == "expected value"`?

>>>
The fuzzer generates inputs you do not control, so you cannot know the expected exact output ahead of time. Fuzz tests assert *properties* that must hold for every input: no panic, round-trip identity, output is valid, result is consistent with a simple reference implementation, or invariants like "never negative". Known exact cases belong in table tests and the seed corpus.

### 6. Benchmarks lie

List three ways a benchmark can mislead you, and what you do about each.

>>>
(1) The compiler eliminates the work because the result is unused: consume results via a sink or use `b.Loop` (1.24+). (2) Setup cost is included in the timed loop: move it outside or use `b.ResetTimer`/`b.StopTimer` carefully. (3) Noise and a single sample: run multiple times (`-count`), compare with `benchstat`, and control the environment (power, background load). Also remember a microbenchmark rarely predicts production behavior; profile real workloads.

## Mastery criteria

- I write table-driven tests with named cases and failure messages that show input, got and want.
- I use fakes behind small interfaces and inject failures to test error paths.
- I test HTTP handlers and routes with `httptest` and no real network.
- I eliminate time, randomness and scheduling dependence from tests.
- I use `-race`, `-count`, `-shuffle` and coverage, and I know what each does and does not prove.
- I write benchmarks that measure the right thing, and fuzz tests that assert properties.

## Further exploration

- Study property-based testing and compare it with fuzzing for your own domain.
- Read how the standard library tests itself (look at `net/http` tests and `testdata` directories).
- Explore `testing/synctest` once stable in your Go version, and rewrite the challenge using it.
- Learn test containers or ephemeral databases for integration testing, and when they are worth their cost.
- Next skills: *Observability*, *Load testing*, *CI/CD pipelines*.
