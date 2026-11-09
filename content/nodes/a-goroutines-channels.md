---
title: Goroutines & channels
go: 1.22+
time: 6-8 h
---

## Overview

Concurrency is why many teams choose Go for backends, and also where the most expensive bugs live: leaked goroutines that slowly eat memory, deadlocks that only appear under load, data races that corrupt state once a month. This lesson builds the mental model (what a goroutine is, what a channel guarantees, what *happens-before* means) so you can design concurrent code on purpose instead of by trial and error.

## Prerequisites

**Essential:** *Interfaces & generics*; *Structs, methods & pointers*; *Slices, arrays & maps* (maps are not concurrency-safe).

**Recommended:** *Error handling*.

## How it works

### Goroutines are cheap, scheduled threads of control

`go f(x)` starts `f` concurrently. A goroutine starts with a small stack that grows as needed (a few kilobytes), and the Go runtime multiplexes many goroutines over a smaller number of OS threads (the scheduler's `GOMAXPROCS` setting defaults to the number of CPUs). Cheap does not mean free: each goroutine holds its stack and everything it references until it returns. **A goroutine that never returns is a leak.**

The arguments to `go f(args)` are evaluated immediately in the calling goroutine; `f` runs later. And when `main` returns, the program exits, whatever other goroutines are doing.

### Channels are typed, synchronized queues

```go
ch := make(chan int)      // unbuffered: send and receive rendezvous
buf := make(chan int, 8)  // buffered: send blocks only when full
```

Semantics you must know cold:

| Operation | nil channel | open | closed |
|---|---|---|---|
| send | blocks forever | blocks until receiver (or buffer space) | **panics** |
| receive | blocks forever | blocks until sender (or data) | returns buffered values, then zero value with `ok == false` |
| close | **panics** | closes | **panics** |

- Only the **sender** side should close a channel, and only to signal "no more values". You do not need to close a channel to free it; the garbage collector handles that.
- `for v := range ch` receives until the channel is closed and drained.
- Channel direction types (`chan<- T`, `<-chan T`) in signatures document and enforce who sends and who receives.

### select multiplexes

```go
select {
case v := <-in:
	handle(v)
case out <- result:
case <-ctx.Done():
	return ctx.Err()
case <-time.After(time.Second):
	// timeout
}
```

`select` chooses uniformly at random among ready cases; with a `default` case it never blocks. A `nil` channel is never ready, which is useful for *disabling* a case dynamically.

### The memory model in one paragraph

Two goroutines accessing the same variable, at least one writing, without synchronization is a **data race**, and the result is undefined: not "stale", *undefined*. Synchronization creates **happens-before** edges: a send happens before the corresponding receive completes; closing a channel happens before a receive that observes the close; `Unlock` happens before a later `Lock`; `wg.Done` before `wg.Wait` returns. If you cannot name the edge that orders two accesses, you have a race. The race detector (`go test -race`, `go run -race`) finds races that actually execute; it cannot prove their absence.

### Patterns worth knowing

- **Worker pool:** N goroutines receive jobs from one channel; results go to another.
- **Fan-out / fan-in:** distribute work, merge results.
- **Pipeline:** stages connected by channels, each owning its output channel and closing it when done.
- **Done channel / context:** a way to say "stop", which every goroutine you start must honor (see *sync & context*).
- **Ownership:** the goroutine that creates a channel is responsible for closing it.

### Share memory by communicating

The proverb means: prefer passing *ownership* of data over channels to guarding shared data with locks. It is a design preference, not a law. A mutex around a counter is simpler and faster than a goroutine with a channel to protect it; pick the clearest correct tool.

> [!GO] Go 1.22 made loop variables per-iteration, removing the classic closure bug for modules declaring `go 1.22`+. Go 1.25 added `sync.WaitGroup.Go`, which starts a goroutine and does the `Add`/`Done` bookkeeping. Check your toolchain and `go` directive before relying on either.

## Official documentation

- [official] [A Tour of Go: Concurrency](https://go.dev/tour/concurrency/1) — Quick hands-on orientation.
- [official] [Effective Go: Concurrency](https://go.dev/doc/effective_go#concurrency) — "Share by communicating", goroutines, channels of channels, the leaky buffer.
- [official] [Spec: Go statements](https://go.dev/ref/spec#Go_statements) — Exactly when arguments are evaluated.
- [official] [Spec: Channel types](https://go.dev/ref/spec#Channel_types) and [Send statements](https://go.dev/ref/spec#Send_statements) — Direction and blocking rules.
- [official] [Spec: Select statements](https://go.dev/ref/spec#Select_statements) — Precisely which case is chosen and when expressions are evaluated.
- [official] [The Go Memory Model](https://go.dev/ref/mem) — Read the *Synchronization* section carefully. Vocabulary: *happens before*, *data race*, *synchronized before*.
- [official] [Data Race Detector](https://go.dev/doc/articles/race_detector) — How to run it, how to read a report, its costs.
- [official] [Go Concurrency Patterns: Pipelines and cancellation](https://go.dev/blog/pipelines) — The canonical pipeline article.
- [official] [Go Concurrency Patterns: Context](https://go.dev/blog/context) — Why cancellation is a first-class concern.
- [supplementary] [Go Concurrency Patterns (Rob Pike talk)](https://go.dev/talks/2012/concurrency.slide) — The original motivation, with slides.

## Practical examples

### A bounded worker pool that shuts down cleanly

```go
func process(ctx context.Context, jobs []string, workers int) []Result {
	in := make(chan string)
	out := make(chan Result)

	var wg sync.WaitGroup
	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := range in {
				select {
				case out <- work(j):
				case <-ctx.Done():
					return
				}
			}
		}()
	}

	go func() { // producer owns `in`
		defer close(in)
		for _, j := range jobs {
			select {
			case in <- j:
			case <-ctx.Done():
				return
			}
		}
	}()

	go func() { wg.Wait(); close(out) }() // someone must close `out` after all senders finish

	var results []Result
	for r := range out {
		results = append(results, r)
	}
	return results
}
```

Notice who closes what: the producer closes `in`; a dedicated goroutine closes `out` after the *last sender* (the workers) is done. Closing from a worker would panic on the second one.

### Deadlock the runtime catches

```go
func main() {
	ch := make(chan int)
	ch <- 1 // no receiver: "fatal error: all goroutines are asleep - deadlock!"
}
```

The runtime only detects *total* deadlock. A server with one stuck goroutine and a live listener will not report anything: it simply leaks.

### Common mistakes

> [!PITFALL] **Goroutine leak on early return.** A goroutine blocked on a send that nobody will ever receive lives forever. Every blocking channel operation in a goroutine needs an escape (context, done channel, or guaranteed counterpart).

> [!PITFALL] **Closing from the receiver or from multiple senders.** Closing a closed channel and sending on a closed channel both panic. Designate one closer; use a `sync.WaitGroup` to know when all senders are done.

> [!PITFALL] **Using `time.After` in a loop.** Each call allocates a timer that lives until it fires, which accumulates under high load on older versions. Prefer `time.NewTimer` with `Stop`/`Reset` in hot loops, or a context deadline.

> [!PITFALL] **Unbounded goroutines.** `for _, r := range requests { go handle(r) }` with a million requests is a million stacks and a million sockets. Bound concurrency with a worker pool or a semaphore (a buffered channel works).

> [!PITFALL] **Assuming ordering.** Goroutines run in any order. A `time.Sleep` is not synchronization; it is a race with better manners.

## Hands-on exercises

### 1. See the scheduler

Write a program that starts 10,000 goroutines, each sleeping briefly and then incrementing a shared counter. First do it incorrectly (no synchronization) and run it with `-race` to see the report. Then fix it in two ways: a mutex and `sync/atomic`. Print `runtime.NumGoroutine()` before, during, and after.

You are done when you can read every line of the race report, and you can state which fix you prefer here and why.

### 2. Channel semantics table, proven

Write tests (or small programs) that demonstrate each cell of the nil/open/closed table: send on closed (recover the panic), receive from closed, close of nil, range over a closed buffered channel with items left. Also show that a nil channel in a `select` is never chosen.

You are done when each claim in the table has a test that proves it on your machine, and you can explain each panic message.

### 3. A pipeline with cancellation

Build a three-stage pipeline: generate integers, square them, filter evens. Each stage runs in its own goroutine, communicates by channel, and stops when a `done` channel (then, a `context.Context`) is closed. Write a test that cancels midway and verifies, via `runtime.NumGoroutine()` or a goroutine-leak helper, that nothing is left running.

You are done when cancelling at any point leaves zero goroutines behind, and you can describe what would leak if a stage forgot its `select` on `done`.

### 4. Ordered results from unordered work

Process 1,000 items with a worker pool where each item takes a random duration, yet emit the results in the **original input order** without waiting for everything to finish (stream them as soon as the next-in-order result is ready). Explain your buffering strategy.

You are done when memory use is bounded by a constant you can state and a test with randomized delays always produces correct order under `-race`.

## Engineering challenge

**A rate-limited fan-out client with graceful shutdown.** Write a function `FetchAll(ctx, urls []string, maxInFlight int, perSecond int) ([]Outcome, error)` using `net/http/httptest` servers for testing. Requirements:

- No more than `maxInFlight` requests at once and no more than `perSecond` started per second.
- Each URL's outcome (status, body size, or error) is returned in input order.
- Cancelling `ctx` stops new requests promptly, aborts in-flight ones, and returns what completed; the function returns only after all its goroutines have exited.
- One failing URL does not cancel the others unless the caller opts in via an option.
- No goroutine leaks and a clean `-race` run, including under a test that cancels at a random moment, repeated many times.

Edge cases: zero URLs; `maxInFlight` larger than the number of URLs; a server that never responds; a server that responds after the context was cancelled; `perSecond <= 0`. Decide and document every one of them.

## Knowledge check

### 1. Who closes?

Three workers send results into one channel. Where should `close(results)` happen, and why not in a worker?

>>>
In a separate goroutine (or the coordinator) after a `sync.WaitGroup` confirms *all* senders have finished. A worker cannot know whether others are done; closing early makes another worker's send panic, and two workers closing causes a double-close panic. The rule: the party that knows there will be no more sends closes.

### 2. Leak or not?

`func f() int { ch := make(chan int); go func() { ch <- compute() }(); select { case v := <-ch: return v; case <-time.After(time.Second): return -1 } }`. What leaks and what is the fix?

>>>
On timeout the function returns, but the goroutine is still blocked on `ch <- compute()` with no receiver, forever. Fix: make the channel buffered with capacity 1 so the late send completes and the goroutine exits, or pass a context so `compute` can stop and the send can be abandoned via `select`.

### 3. Unbuffered versus buffered

What does an unbuffered channel guarantee that a buffered one does not?

>>>
A send on an unbuffered channel completes only when a receiver has taken the value, so the send *synchronizes* the two goroutines: everything before the send happens before the receive completes (and the receive happens before the send completes, for unbuffered). A buffered channel decouples them; a send may return before anyone has received. Buffers hide backpressure and should be sized for a reason, not "to make the deadlock go away".

### 4. Detecting the race

Why does `go test -race` pass, yet production data still corrupts?

>>>
The race detector only reports races that *execute* during that run and are detected within its history window. If the test never exercises the concurrent path with the right interleaving (or never writes concurrently at all), nothing is reported. Absence of a report is not proof of correctness. Write tests that stress concurrent paths, run them repeatedly (`-count`) and with `-race` in CI.

### 5. select fairness

If two cases in a `select` are ready, which one runs? Why does it matter for a loop that wants to prioritize shutdown?

>>>
One is chosen uniformly at random among the ready cases. A loop that selects on `work` and `done` may therefore process several more work items after shutdown is signaled. To prioritize shutdown, check `done` in a first non-blocking `select` before the main one, or check `ctx.Err()` at the loop top.

### 6. What does main returning do

A program starts a goroutine that writes a file, then `main` returns. What happens to the write?

>>>
The program exits immediately and the goroutine is terminated, possibly mid-write or before starting. Goroutines are not waited for. Use a `WaitGroup`, a channel, or `errgroup` to wait for them, and in servers perform a graceful shutdown that stops accepting work, waits for in-flight goroutines up to a deadline, and then exits.

## Mastery criteria

- I can start goroutines safely: every one has a defined end and an owner that waits for it.
- I can state the behavior of send, receive and close on nil, open and closed channels.
- I can identify the happens-before edge that makes a given concurrent access safe, or I name the race.
- I use `select` with cancellation and understand its randomness.
- I build bounded worker pools and pipelines that shut down cleanly with no leaks.
- I use `-race` routinely and understand what it cannot prove.

## Further exploration

- Read the Go scheduler design notes and learn the meaning of G, M and P.
- Use `runtime/trace` and `go tool trace` on your pool to see scheduling and blocking.
- Study `golang.org/x/sync/errgroup` and `semaphore` and compare them with hand-rolled versions.
- Read about structured concurrency in other languages and what Go's approach lacks.
- Next skills: *sync primitives & context*, *HTTP server internals*, *Resilience patterns*.
