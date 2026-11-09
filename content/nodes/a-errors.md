---
title: Error handling
go: 1.22+
time: 4-6 h
---

## Overview

In Go an error is a value, and handling it is ordinary control flow. That sounds trivial and is the source of most operational pain in backend services: swallowed errors, errors that lose their cause, errors that leak internals to users, retries applied to errors that can never succeed. This lesson is about making error handling a *design* of its own: which errors callers can inspect, how context is attached, and who decides what to do.

## Prerequisites

**Essential:** *Interfaces & generics* (the `error` interface, type assertions); *Structs, methods & pointers*.

**Recommended:** basic `fmt` usage.

## How it works

### The error interface

```go
type error interface{ Error() string }
```

Anything with that method is an error. Functions return errors as their last result. `nil` means success. Callers decide what to do; the *callee never decides to exit*.

### Wrapping preserves the cause

`fmt.Errorf("load config: %w", err)` produces an error that has a message **and** remembers `err`. The `%w` verb is what makes the chain inspectable; `%v` flattens it to text and loses the cause.

```go
var ErrNotFound = errors.New("not found") // a sentinel

func GetUser(id int) (*User, error) {
	u, err := db.Lookup(id)
	if err != nil {
		return nil, fmt.Errorf("get user %d: %w", id, err)
	}
	return u, nil
}
```

### Inspecting: Is, As, Unwrap

- `errors.Is(err, ErrNotFound)` walks the chain looking for a match (by `==` or an `Is` method).
- `errors.As(err, &target)` finds the first error in the chain assignable to the type of `target` and sets it. `target` must be a non-nil *pointer* to a type implementing `error` or to any interface.
- `errors.Unwrap(err)` returns the next error. `errors.Join(a, b)` (Go 1.20+) combines several; `Is`/`As` look through all of them. Types may implement `Unwrap() []error` too.

Never compare with `==` or use string matching on `err.Error()`: wrapping breaks both.

### Three ways to expose an error to callers

| Technique | Use when | Cost |
|---|---|---|
| Sentinel values (`ErrNotFound`) | A small, stable set of conditions callers branch on | Becomes public API; callers depend on identity |
| Custom error types (`*ValidationError`) | Callers need data (which field, which code) | More code; the type becomes API |
| Opaque (just a message) | Callers can only log or abort | None, and that is the point |

The decision is an **API decision**: anything you let callers inspect, you must keep stable. Start opaque and open up deliberately.

### Panics are not exceptions

`panic` is for programmer errors and unrecoverable states (broken invariants at startup, index out of range). `recover` is for containing a crash at a boundary (one HTTP request must not kill the server) and for converting panics inside a package into errors at its API. Do **not** use panic for ordinary control flow or expected failures.

### Translating at boundaries

Inside the application errors carry causes and details. At the edge (an HTTP handler) you **translate** them: a not-found becomes a 404, a validation failure a 422/400 with field messages, anything unrecognized a 500 with a generic message and a request ID, while the full error is logged. Never send an internal error string to a client.

> [!GO] `defer` runs even during panics, which is how `recover` works, and it lets you annotate errors on the way out using named results: `defer func() { if err != nil { err = fmt.Errorf("process: %w", err) } }()`. Use sparingly; explicit wrapping at the failing line is clearer.

## Official documentation

- [official] [Error handling and Go (Go Blog)](https://go.dev/blog/error-handling-and-go) — The foundations; short.
- [official] [Working with Errors in Go 1.13](https://go.dev/blog/go1.13-errors) — `%w`, `Is`, `As`, and the design guidance on when to wrap. Required.
- [official] [Package errors](https://pkg.go.dev/errors) — Read the documentation of `Is`, `As`, `Join` and the `Unwrap` conventions.
- [official] [Spec: Handling panics](https://go.dev/ref/spec#Handling_panics) — Exactly when `recover` returns non-nil.
- [official] [Effective Go: Errors](https://go.dev/doc/effective_go#errors) — Idioms, including custom error types.
- [official] [Go Code Review Comments: Error Strings](https://go.dev/wiki/CodeReviewComments#error-strings) — Lowercase, no trailing punctuation.
- [official] [Go FAQ: Why does Go not have exceptions?](https://go.dev/doc/faq#exceptions) — The design rationale.
- [supplementary] [Errors are values (Go Blog)](https://go.dev/blog/errors-are-values) — Patterns to reduce repetitive `if err != nil`.

## Practical examples

### A typed error with data, inspected with errors.As

```go
type ValidationError struct {
	Field  string
	Reason string
}

func (e *ValidationError) Error() string { return e.Field + ": " + e.Reason }

func validate(name string) error {
	if name == "" {
		return &ValidationError{Field: "name", Reason: "required"}
	}
	return nil
}

func handle(err error) int {
	var ve *ValidationError
	switch {
	case err == nil:
		return 200
	case errors.As(err, &ve):
		return 422
	case errors.Is(err, ErrNotFound):
		return 404
	default:
		return 500
	}
}
```

### Collecting multiple errors

```go
func closeAll(cs ...io.Closer) error {
	var errs []error
	for _, c := range cs {
		if err := c.Close(); err != nil {
			errs = append(errs, err)
		}
	}
	return errors.Join(errs...) // nil if errs is empty
}
```

### Recovering at a boundary

```go
func recoverer(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if v := recover(); v != nil {
				slog.Error("panic", "value", v, "stack", string(debug.Stack()))
				http.Error(w, "internal error", http.StatusInternalServerError)
			}
		}()
		next.ServeHTTP(w, r)
	})
}
```

### Common mistakes

> [!PITFALL] **Handling an error twice.** Logging an error and then returning it means the same failure is logged at every layer. Handle it once: either return it (with context) or log it and stop propagating.

> [!PITFALL] **Using `%v` where you meant `%w`.** The message looks identical, but `errors.Is` stops working, and the bug appears far away from the cause.

> [!PITFALL] **Ignoring errors from `Close`, `Flush`, `Rows.Err()`, and `Write`.** For writers, `Close` is where buffered data fails to hit the disk. Check it.

> [!PITFALL] **String matching on messages.** `strings.Contains(err.Error(), "not found")` breaks on rewording, wrapping, and localization. Use `Is`/`As`.

> [!PITFALL] **Leaking internals to clients.** Returning `err.Error()` in an HTTP body exposes SQL, file paths, and library details. Map to a safe message.

## Hands-on exercises

### 1. Build a chain and inspect it

Create three layers (`repo`, `service`, `handler`). The repo returns a sentinel; the service wraps it with context; the handler wraps again. Print the message, then use `errors.Is`, `errors.Unwrap` in a loop and `errors.As` to inspect each link.

You are done when you can show that replacing `%w` with `%v` in the middle layer breaks `Is`, and you can explain why.

### 2. Design the error vocabulary

For a small user service (create, get, update), list every failure mode. Decide which become sentinels, which become typed errors with fields, and which stay opaque. Write the code and a table mapping each to an HTTP status and a client-safe message.

You are done when no handler contains a string comparison and every decision has a one-line justification.

### 3. Join and Is/As over joined errors

Write a function that runs three independent validations and returns all failures at once with `errors.Join`. Write tests that check `errors.Is` finds a sentinel in any position and `errors.As` finds a typed error, and that a nil result really is nil.

You are done when the output message for three failures is readable and your tests do not depend on message text.

### 4. Panic containment

Write HTTP middleware that recovers panics, logs the stack, returns a generic 500, and still works if the handler already wrote part of the response. Test with a handler that panics before and after writing. Also decide how it must treat `http.ErrAbortHandler`.

You are done when you can explain what the client sees in each case and why re-panicking with `http.ErrAbortHandler` is a documented exception.

## Engineering challenge

**Make a failing pipeline debuggable.** Build a three-stage import pipeline (parse CSV rows, validate, write to a fake store that fails randomly 20% of the time). Requirements:

- Errors identify *which row* and *which stage* failed, and the original cause is preserved for `errors.Is`/`As`.
- Transient store errors are distinguishable from permanent ones (design how), and only transient ones are retried, with a cap and backoff.
- The pipeline reports *all* row errors at the end (not just the first), bounded so a million-row bad file does not produce a gigabyte of messages.
- A panic in one row's parser is converted to an error for that row and does not stop the run.
- The final summary is stable (deterministic) for the same input and the same seed.

Edge cases to decide and defend: an error while reporting an error; a cancellation mid-run; a failure in `Close` after all writes succeeded. Write down which errors are part of your package's public contract.

## Knowledge check

### 1. %w versus %v

What is the observable difference in behavior between `fmt.Errorf("x: %w", err)` and `fmt.Errorf("x: %v", err)`?

>>>
The text is identical. With `%w` the returned error implements `Unwrap` and keeps `err` in the chain, so `errors.Is` and `errors.As` can find it. With `%v` the cause is flattened into a string and lost for programmatic inspection. Since Go 1.20 a single call may use several `%w` verbs.

### 2. Sentinel or type?

When would you create a typed error instead of a sentinel?

>>>
When callers need *data*, not just identity: which field failed validation, a retry-after duration, a status code from upstream. A sentinel conveys only "which condition". Types are inspected with `errors.As`. Either choice becomes part of your public API, so introduce it deliberately.

### 3. Who handles it

A repository logs "failed to insert" and returns the error; the service logs "failed to create user" and returns it; the handler logs again. What is wrong and what is the rule?

>>>
The same failure is logged three times with no additional information, flooding logs and confusing counts. The rule: handle an error exactly once. Lower layers add context and return; the layer that decides the outcome (usually the boundary, such as the HTTP handler) logs it once and translates it into a response.

### 4. recover's scope

Where does `recover` work, and why does a panic in a goroutine you started not get caught by your handler's `recover`?

>>>
`recover` only returns a non-nil value when called directly by a deferred function while the *same goroutine* is panicking. A panic in another goroutine unwinds only that goroutine and, if unrecovered, terminates the entire program. Any goroutine you start needs its own deferred recover (or must be written so it cannot panic).

### 5. Safe to retry?

Why is `if errors.Is(err, context.DeadlineExceeded) { retry() }` sometimes wrong?

>>>
A deadline error may mean the *whole operation's* budget is gone (the caller's context expired), so retrying cannot succeed and only adds load. A retry decision needs to know whether the failure is transient *and* whether time remains. Retrying a non-idempotent operation after a timeout may also duplicate side effects, because the first attempt might have succeeded.

### 6. The loss of cause

Why is returning `errors.New(err.Error())` an anti-pattern?

>>>
It discards the original error's type and chain, so `Is`/`As` cannot see the cause, and any structured data is gone. If you need to hide details from callers, wrap deliberately in your own typed error, or log the original and return a sanitized one, but do not accidentally destroy information you may need.

## Mastery criteria

- I wrap errors with `%w` and inspect them with `errors.Is` and `errors.As`, never by string.
- I can choose between sentinels, typed errors and opaque errors and defend the choice as API design.
- I handle each error once and translate errors at boundaries into safe responses.
- I know exactly when panic and recover are appropriate and when they are not.
- I check errors from `Close`, `Flush`, `Rows.Err` and similar calls.
- I can design retry decisions that distinguish transient, permanent and caller-canceled failures.

## Further exploration

- Read how `net/http` and `database/sql` expose errors; list their sentinels and typed errors.
- Study `errors.Join` and the multi-error `Unwrap() []error` method in the package documentation.
- Look at `log/slog` and decide how to attach error details as structured fields.
- Next skills: *HTTP request lifecycle*, *Structured logging*, *Resilience patterns*.
