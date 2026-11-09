---
title: sync primitives & context
go: 1.22+
time: 5-7 h
---

## Overview

Channels are one tool for coordination; the `sync` and `sync/atomic` packages are the others, and `context` is the standard way a request tells everything it started to *stop*. In a backend, `context.Context` flows through every function that does I/O. Misusing it causes goroutine leaks, requests that keep working after the client left, and queries that outlive their deadline. This lesson connects locking, atomics and cancellation into one coherent practice.

## Prerequisites

**Essential:** *Goroutines & channels*; *Error handling*.

**Recommended:** *Structs, methods & pointers* (never copy a lock).

## How it works

### Mutexes protect invariants, not variables

A `sync.Mutex` guards a *group of fields that must change together*. The discipline:

```go
type Inventory struct {
	mu    sync.Mutex // guards the fields below
	stock map[string]int
	total int
}

func (i *Inventory) Add(sku string, n int) {
	i.mu.Lock()
	defer i.mu.Unlock()
	i.stock[sku] += n
	i.total += n // invariant: total == sum(stock)
}
```

- Hold a lock for the **shortest** possible time and **never** across blocking I/O or calls into unknown code (callbacks, channel operations).
- `sync.RWMutex` allows many readers or one writer; it helps only when reads dominate *and* hold the lock long enough to matter. Measure; it is often slower than a plain mutex.
- Locks are not re-entrant. Locking twice in one goroutine deadlocks.
- Always acquire multiple locks in a consistent order.

### Other primitives

| Primitive | Use |
|---|---|
| `sync.WaitGroup` | Wait for a group of goroutines to finish. `Add` before `go`, `Done` in the goroutine, `Wait` in the owner. |
| `sync.Once` / `OnceFunc`/`OnceValue` | Run initialization exactly once, safely. |
| `sync.Pool` | Reuse short-lived allocations; contents may vanish at any GC. A performance tool, not a cache. |
| `sync.Cond` | Wait for a condition on shared state. Rare; channels usually read better. |
| `sync.Map` | Narrow cases: keys written once and read many times, or disjoint key sets per goroutine. |
| `sync/atomic` | Lock-free counters and flags: `atomic.Int64`, `atomic.Bool`, `atomic.Pointer[T]`. |

Atomics give ordering for a *single* variable. They do not make a *group* of operations atomic. If two fields must change together, use a mutex.

### Context: cancellation, deadlines, request-scoped values

A `context.Context` carries three things down a call tree: a **cancellation signal** (`ctx.Done()` closes), an optional **deadline**, and a small set of **request-scoped values**.

```go
ctx, cancel := context.WithTimeout(parent, 2*time.Second)
defer cancel() // ALWAYS: releases the timer and child contexts

row := db.QueryRowContext(ctx, query, id)
```

Rules (from the package documentation):

1. Pass the context as the **first parameter**, named `ctx`.
2. Do **not** store a context in a struct; pass it along the call.
3. Never pass a nil context; use `context.TODO()` if unsure.
4. Contexts form a tree: cancelling a parent cancels all its children. A child cancelling does not affect the parent.
5. Use context *values* only for request-scoped data crossing API boundaries (a request ID, an authenticated principal), never for optional parameters. Use unexported key types to avoid collisions.
6. `cancel` must be called to release resources, even if the deadline fires.

`ctx.Err()` is `context.Canceled` or `context.DeadlineExceeded` after `Done` closes. Since Go 1.20 `context.WithCancelCause` and `context.Cause` let you record *why* something was canceled; Go 1.21 added `context.AfterFunc` and `WithoutCancel`.

### How cancellation actually works

Cancellation is **cooperative**. Nothing kills a goroutine. A function honors a context by checking `ctx.Done()` in a `select`, or by calling APIs that do (`http.NewRequestWithContext`, `db.QueryContext`, `net.Dialer.DialContext`). Code that loops without ever looking at `ctx` ignores cancellation.

### errgroup

`golang.org/x/sync/errgroup` (maintained by the Go project, outside the standard library) runs goroutines, collects the **first error**, and cancels a derived context so siblings stop. `g.SetLimit(n)` bounds concurrency. It is the usual answer to "run these N things concurrently and stop if one fails".

> [!GO] Go 1.25 added `sync.WaitGroup.Go(func())`. In 1.24 and earlier you write `wg.Add(1); go func(){ defer wg.Done(); ... }()`. Go 1.23+ no longer leaks unstopped `time.Timer`s as it used to; check your version's release notes before copying older advice about `time.After`.

## Official documentation

- [official] [Package sync](https://pkg.go.dev/sync) — Read the package overview and each type's documentation; note each "must not be copied after first use" warning.
- [official] [Package sync/atomic](https://pkg.go.dev/sync/atomic) — The typed atomics and the documentation's cautions.
- [official] [Package context](https://pkg.go.dev/context) — The package comment contains the rules above verbatim; read all of it.
- [official] [Go Concurrency Patterns: Context](https://go.dev/blog/context) — The design rationale and a worked search example.
- [official] [Contexts and structs](https://go.dev/blog/context-and-structs) — Why contexts do not belong in struct fields, and the narrow exceptions.
- [official] [The Go Memory Model](https://go.dev/ref/mem) — The sections on locks, once, and atomics define what each guarantees.
- [official] [Data Race Detector](https://go.dev/doc/articles/race_detector) — Examples of common races and their reports.
- [supplementary] [errgroup package](https://pkg.go.dev/golang.org/x/sync/errgroup) — Official sub-repository documentation for the first-error-wins pattern.

## Practical examples

### Honoring cancellation in a long loop

```go
func scan(ctx context.Context, items []Item) error {
	for i, it := range items {
		if i%256 == 0 { // checking every iteration is wasteful; check periodically
			if err := ctx.Err(); err != nil {
				return err
			}
		}
		if err := inspect(it); err != nil {
			return err
		}
	}
	return nil
}
```

### Concurrent work with a shared deadline and first-error cancellation

```go
func fetchAll(ctx context.Context, urls []string) ([]string, error) {
	g, ctx := errgroup.WithContext(ctx)
	g.SetLimit(8)
	out := make([]string, len(urls))
	for i, u := range urls {
		g.Go(func() error {
			body, err := get(ctx, u)
			if err != nil {
				return fmt.Errorf("fetch %s: %w", u, err)
			}
			out[i] = body // distinct index per goroutine: no race
			return nil
		})
	}
	return out, g.Wait()
}
```

### Typed context keys

```go
type ctxKey struct{} // unexported: no other package can collide

func WithRequestID(ctx context.Context, id string) context.Context {
	return context.WithValue(ctx, ctxKey{}, id)
}

func RequestID(ctx context.Context) (string, bool) {
	id, ok := ctx.Value(ctxKey{}).(string)
	return id, ok
}
```

### Common mistakes

> [!PITFALL] **Forgetting `defer cancel()`.** The derived context keeps its timer and its place in the parent's child list until the parent finishes. `go vet` (the `lostcancel` check) catches many cases.

> [!PITFALL] **Holding a lock while sending on a channel or calling out.** If the receiver also needs that lock you have a deadlock the runtime cannot detect.

> [!PITFALL] **Copying a `sync.Mutex` or `WaitGroup`.** Always pass by pointer; `go vet` warns.

> [!PITFALL] **Calling `wg.Add` inside the goroutine.** `Wait` may run before `Add`, returning early. `Add` belongs before the `go` statement.

> [!PITFALL] **Using `context.Background()` deep in a call chain.** It silently disconnects the work from the request: client disconnects and deadlines no longer reach it. Only `main`, tests, and top-level background jobs create root contexts.

> [!PITFALL] **Using context values as a parameter bag.** If the function cannot work without it, it is a parameter; hiding it in the context defeats type checking and readability.

## Hands-on exercises

### 1. Break it, then protect it

Write a bank-account-style struct with `Deposit`, `Withdraw`, `Balance`. Hammer it from 100 goroutines and confirm `go test -race` reports races. Add a `sync.Mutex`, then reimplement `Balance` with `atomic.Int64` and explain why the mutex remains necessary for `Withdraw` if it must refuse to overdraw.

You are done when you can show a sequence of two atomic operations that is *not* atomic together and explain the gap.

### 2. Context tree experiment

Build a tree of contexts: a root with cancel, two children with timeouts of different lengths, and a grandchild with a value. Spawn goroutines that print when each context's `Done` fires and what `Err()` and `Cause()` report. Cancel at different nodes and predict the output first.

You are done when your predictions match for four different cancellation orders and you can explain why cancelling a child does not touch its parent.

### 3. Make a blocking function cancellable

You are given a function `slowLookup(key string) (string, error)` that blocks for several seconds and has no context support. Wrap it as `Lookup(ctx, key)` that returns promptly when `ctx` ends. Decide what happens to the abandoned call, and prove it does not leak goroutines beyond the call's natural end. Then write the version where `slowLookup` itself can be made to accept a context, and note which is better.

You are done when you can state exactly what resource is still held after cancellation in the wrapper version, and the tradeoff.

### 4. Singleflight by hand

Implement a "load once per key" cache: if many goroutines ask for the same missing key concurrently, only one runs the loader while the others wait for its result; failures must not be cached forever. Use only `sync` primitives, then compare with `golang.org/x/sync/singleflight`.

You are done when a test with 1,000 concurrent requests for one key shows exactly one loader call, and one for 100 different keys shows 100 independent calls running concurrently.

## Engineering challenge

**A graceful-shutdown job runner.** Build a `Runner` that executes background jobs submitted via `Submit(job)` and `Shutdown(ctx)`. Requirements:

- Jobs run concurrently up to a configurable limit; excess submissions block until a slot frees or the submitter's context ends.
- Each job receives a context that is cancelled when its own timeout expires *or* when the runner is shut down forcibly.
- `Shutdown(ctx)` stops accepting new jobs, waits for running jobs to finish until `ctx` expires, then cancels the rest and waits for them to return; it reports how many were abandoned or failed.
- Safe to call `Submit` and `Shutdown` concurrently from many goroutines; a `Submit` after `Shutdown` returns a specific error, never panics, never blocks.
- A panicking job is recovered, reported, and does not take the runner down.
- `go test -race -count=100` is clean, with randomized timing.

Edge cases: `Shutdown` called twice; `Submit` racing with `Shutdown`; a job that ignores its context (what do you promise?); a negative limit; a job submitted from inside another job.

## Knowledge check

### 1. Why defer cancel

You write `ctx, cancel := context.WithTimeout(ctx, time.Second)` and never call `cancel` because the timeout will fire anyway. What goes wrong?

>>>
Until the timeout fires, the context holds a timer and remains registered with its parent. In a request-per-goroutine server that returns early, many such contexts accumulate. If the parent never ends (a long-lived background context), it is a leak. Calling `cancel` promptly releases resources and propagates cancellation to children; `defer cancel()` is the idiom.

### 2. Atomic is not atomic

Two fields, `hits` and `bytes`, are each `atomic.Int64`. A reader computes `bytes/hits`. Can the result be wrong, and why?

>>>
Yes. Each field's update is atomic individually, but the pair is not updated atomically, so a reader may observe `hits` incremented and `bytes` not yet (or vice versa), producing a transient wrong ratio, or division by zero. If two values must be consistent, update and read them under one mutex, or store an immutable struct behind an `atomic.Pointer`.

### 3. What cancellation does

Does cancelling a context stop a goroutine? What must the goroutine do?

>>>
No. Cancellation is cooperative: it only closes `ctx.Done()` and sets `ctx.Err()`. The goroutine must observe it, by selecting on `Done`, polling `Err` in loops, or calling context-aware APIs that return early. Code that ignores the context keeps running to completion.

### 4. RWMutex surprise

When can an `RWMutex` perform worse than a `Mutex`, and what rule makes recursive read locking dangerous?

>>>
It has more bookkeeping, so with short critical sections or few readers it can lose to a plain mutex, and writers may be starved or delayed by readers depending on load. Recursive read-locking is dangerous because a blocked pending writer causes new `RLock` calls to wait, so a goroutine holding a read lock that tries to take another read lock can deadlock if a writer queued in between.

### 5. Context values

Which of these belongs in `context.Value`: a database handle, a request ID, a page size, an authenticated user ID? Defend each.

>>>
Request ID and authenticated user identity are request-scoped metadata that cross API boundaries and are reasonable (the latter needs care). The database handle is a dependency and should be passed explicitly or held by the receiver. Page size is an ordinary parameter that determines behavior; hiding it in a context makes the function's contract invisible. A good test: would the function still be correct to call without it? If not, it is a parameter.

### 6. WaitGroup ordering

Why does `go func() { wg.Add(1); defer wg.Done(); ... }()` have a bug?

>>>
The `Add` may execute after the owner has already called `Wait`, in which case `Wait` sees a zero counter and returns early (or the race detector reports misuse). `Add` must happen before the goroutine is started, in the goroutine that will later call `Wait`. (Go 1.25's `wg.Go` removes the hazard by doing both in one call.)

## Mastery criteria

- I protect invariants with a mutex, choosing the smallest correct critical section and avoiding blocking calls while holding it.
- I know what atomics guarantee and what they do not.
- I propagate `context.Context` correctly: first parameter, derived with a deferred cancel, never stored.
- I make long-running and blocking work honor cancellation and deadlines.
- I can use errgroup (or an equivalent) for first-error-wins concurrent work with bounded parallelism.
- I can design shutdown so in-flight work completes or is abandoned deliberately, never accidentally.

## Further exploration

- Read the `context` package's source; it is short and illuminating.
- Compare `sync.Pool` behavior across GC cycles with a benchmark that shows its allocation savings.
- Study the memory model sections on atomics and `sync.Once`; try to explain why double-checked locking without them is broken.
- Read about `sync.OnceValue` and lazily initialized singletons.
- Next skills: *HTTP server lifecycle*, *Database access*, *Resilience patterns*.
