---
title: Interfaces & generics
go: 1.22+
time: 5-7 h
---

## Overview

Interfaces are the seam where Go programs are cut apart for testing, replaced for flexibility, and wired together at the edges. Generics (Go 1.18+) cover the other half: algorithms and containers that do not care about their element type. Good Go uses interfaces to describe **behavior a consumer needs**, and generics to remove duplication across types, and uses neither when a plain concrete type would do.

## Prerequisites

**Essential:** *Structs, methods & pointers* (method sets are required here).

**Recommended:** *Slices, arrays & maps*; *Errors* (the `error` interface is the most important interface in the language).

## How it works

### Interfaces are satisfied implicitly

A type implements an interface by having the right methods; there is no `implements` keyword. That inverts the usual dependency: **the consumer defines the interface it needs**, and any type with matching methods qualifies without importing anything.

```go
// In the package that USES the dependency, not the one that implements it.
type MessageStore interface {
	Save(ctx context.Context, m Message) error
}
```

Guideline: *accept interfaces, return concrete types.* Small interfaces (one to three methods) compose and fake easily; a thirteen-method interface is a concrete type in disguise.

### What an interface value is

An interface value is a pair: **(dynamic type, dynamic value)**. It is nil only when *both* are nil.

```go
var p *MyErr = nil
var err error = p      // err holds (type *MyErr, value nil)
fmt.Println(err == nil) // false!
```

This is the most notorious Go gotcha: returning a typed nil pointer as an `error` yields a non-nil error. Return the literal `nil` on success.

### Type assertions and switches

`v, ok := x.(T)` asserts the dynamic type; without `ok` it panics on failure. A type switch (`switch v := x.(type)`) selects on the dynamic type. Use them at boundaries (decoding, error inspection), not as a replacement for polymorphism.

### The empty interface and `any`

`any` is an alias for `interface{}`: it says nothing, so it gives up compile-time checking. Use it for genuinely heterogeneous data (like `json.Unmarshal` into unknown shapes), and narrow quickly.

### Generics: type parameters and constraints

```go
func Map[T, U any](xs []T, f func(T) U) []U {
	out := make([]U, 0, len(xs))
	for _, x := range xs {
		out = append(out, f(x))
	}
	return out
}

type Number interface{ ~int | ~int64 | ~float64 }

func Sum[T Number](xs []T) T {
	var s T
	for _, x := range xs {
		s += x
	}
	return s
}
```

Key ideas:

- A **constraint** is an interface that may list a *type set* (`~int | ~string`), where `~T` means "any type whose underlying type is T".
- `comparable` permits `==` and map keys; `cmp.Ordered` permits `<`.
- Type arguments are usually **inferred**; you write them only when inference cannot.
- Methods cannot have their own type parameters; only the type or function can.
- Generics are implemented with GC-shape stenciling, so they are not free; a generic function is not guaranteed to be as fast as a hand-written one.

### When not to use generics

Do not reach for generics when an interface expresses the need (`io.Reader`), when you have only one concrete type, or when you are writing code to look clever. The usual signal for generics is *the same algorithm repeated for several types*, or a container.

> [!GO] The standard library already ships generic helpers: `slices`, `maps`, `cmp`, `sync.OnceValue`, `atomic.Pointer[T]`. Learn them before writing your own.

## Official documentation

- [official] [Tutorial: Getting started with generics](https://go.dev/doc/tutorial/generics) — Hands-on introduction.
- [official] [An Introduction To Generics (Go Blog)](https://go.dev/blog/intro-generics) — Concepts: type parameters, constraints, inference.
- [official] [When To Use Generics (Go Blog)](https://go.dev/blog/when-generics) — The guidance on when *not* to. Required reading.
- [official] [Spec: Interface types](https://go.dev/ref/spec#Interface_types) — Method sets, type sets, `comparable`.
- [official] [Spec: Type parameter declarations](https://go.dev/ref/spec#Type_parameter_declarations) — Syntax and constraint rules.
- [official] [Spec: Type assertions](https://go.dev/ref/spec#Type_assertions) — Exact semantics and panics.
- [official] [Effective Go: Interfaces and other types](https://go.dev/doc/effective_go#interfaces_and_types) — The idiom of small interfaces.
- [official] [Go Code Review Comments: Interfaces](https://go.dev/wiki/CodeReviewComments#interfaces) — "Don't define interfaces before they are used."
- [official] [Package cmp](https://pkg.go.dev/cmp) — `cmp.Ordered`, `cmp.Compare`.

## Practical examples

### Defining the interface at the consumer, faking it in a test

```go
type Clock interface{ Now() time.Time }

type Service struct{ clock Clock }

func (s *Service) Expired(t time.Time) bool { return s.clock.Now().After(t) }

type fakeClock struct{ now time.Time }

func (f fakeClock) Now() time.Time { return f.now }
```

A test constructs `Service{clock: fakeClock{...}}`; production passes a type wrapping `time.Now`. No mocking framework required.

### A generic, concurrency-safe set

```go
type Set[T comparable] struct {
	mu sync.RWMutex
	m  map[T]struct{}
}

func NewSet[T comparable]() *Set[T] { return &Set[T]{m: make(map[T]struct{})} }

func (s *Set[T]) Add(v T) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.m[v] = struct{}{}
}

func (s *Set[T]) Has(v T) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	_, ok := s.m[v]
	return ok
}
```

### Common mistakes

> [!PITFALL] **The typed nil.** `func find() error { var e *NotFound; if cond { e = &NotFound{} }; return e }` always returns a non-nil error. Return `nil` explicitly.

> [!PITFALL] **Interface pollution.** Defining an interface next to every struct "for mocking" yields dozens of single-implementation interfaces that obscure the code. Wait for a second implementation or a real test seam.

> [!PITFALL] **Returning interfaces from constructors.** `func NewStore() Store` hides the concrete type, blocks callers from using its extra methods, and often breaks inlining. Return the concrete type.

> [!PITFALL] **Overly clever constraints.** If the constraint list needs a comment to read, the abstraction is probably not paying for itself.

> [!PITFALL] **Comparing interfaces holding uncomparable types.** `a == b` panics at runtime if both hold slices or maps. Compare with care.

## Hands-on exercises

### 1. Define at the consumer

Write a small package that sends notifications. Start with a concrete email sender, then introduce the interface *in the notifier package* only when you write the test that needs a fake. Do not define the interface in the email package.

You are done when the test uses a hand-written fake, the interface has one or two methods, and you can explain why the interface lives where it does.

### 2. Reproduce and fix the typed nil

Write a function that returns `error` and reproduces the typed-nil bug. Write a test that fails because of it. Fix it three ways (explicit `return nil`, returning the interface from the start, and restructuring so the pointer is never assigned to the interface early).

You are done when you can draw the `(type, value)` pair for each variable in the buggy version.

### 3. Generic utilities you would actually use

Implement `Keys`, `GroupBy[T any, K comparable](xs []T, key func(T) K) map[K][]T`, `Reduce`, and a `Pair[A, B]` type with `Zip`. Write tests with several element types including a defined type with underlying `int` (to confirm that `~int` matters). Compare each with its standard library counterpart and note where yours is worse.

You are done when each function has a test for the empty input and a test showing type inference working without explicit type arguments.

### 4. Choose: interface, generics, or neither

Take three real functions from a program you have written. For each, decide whether to make it generic, depend on an interface, or leave it concrete, and write a short justification. Refactor *one* where you changed your mind.

You are done when the justification references a concrete cost (readability, performance, testability) rather than a style preference.

## Engineering challenge

**A pluggable storage layer with two backends and one conformance suite.** Define a `Store` interface for chat messages (append, list by conversation with pagination, delete conversation). Implement an in-memory backend and a file-based backend. Write a *single* reusable test suite function, `RunStoreTests(t *testing.T, factory func() Store)`, that both backends must pass.

Constraints:

- The interface is defined in the consuming package; backends do not import it.
- The suite must include concurrency tests run under `-race`.
- Behavior on edge cases is specified by the tests, not by either implementation: listing a nonexistent conversation, empty pages, a page size larger than the data, deleting twice.
- Add a generic `Cache[K, V]` decorator that wraps any `Store`-like lookup without knowing the concrete type, and explain where generics helped and where you needed an interface instead.

Think about: context cancellation in the interface, what errors the interface promises (and how callers distinguish "not found" from "failed"), and what happens to the contract when a third backend appears.

## Knowledge check

### 1. nil is not nil

Why can `err != nil` be true when the function "returned nil", and how do you prevent it?

>>>
An interface value is a (dynamic type, dynamic value) pair and is nil only if both are unset. Assigning a nil `*T` to an `error` variable gives a non-nil interface (type `*T`, value nil). Prevent it by returning the literal `nil` on success paths and by never storing a concrete-pointer variable into an interface return unless it is known non-nil.

### 2. Who owns the interface

Why does Go recommend defining interfaces in the package that uses them?

>>>
Implicit satisfaction means the implementer does not need to know about the interface, so the consumer can describe exactly the narrow behavior it needs. This keeps interfaces small, avoids import dependencies from implementations to consumers, makes faking trivial, and prevents premature abstraction. Interfaces defined next to implementations tend to grow to mirror the whole type.

### 3. any versus a type parameter

`func First(xs []any) any` versus `func First[T any](xs []T) (T, bool)`. What does the second give you?

>>>
Compile-time type safety and no boxing or assertion at the call site: callers get a `T` back and the compiler rejects wrong uses. The first requires `[]any` (so a `[]string` must be converted element by element) and forces a type assertion on the result. The generic form also lets you return the zero value plus an `ok` flag to signal an empty slice.

### 4. What does ~ do

In `interface{ ~int }`, what does the tilde permit that `int` alone does not?

>>>
`~int` includes every type whose *underlying* type is `int`, such as `type UserID int`. Plain `int` in a constraint allows only exactly `int`. Without `~`, generic numeric helpers would reject the defined types that real programs use for domain modeling.

### 5. When generics are wrong

Give two situations from this lesson where an interface or a concrete type beats generics.

>>>
When all that varies is *behavior* (for example, anything readable is an `io.Reader`), an interface expresses it directly with dynamic dispatch and clear semantics. When there is a single concrete type, or when the generic version needs a long constraint list and obscures simple logic, a concrete function is clearer. Generics shine for containers and algorithms repeated across element types.

### 6. Comparing interface values

Predict what happens: `var a, b any = []int{1}, []int{1}; fmt.Println(a == b)`. Why?

>>>
It panics at runtime: "comparing uncomparable type []int". Comparing two interface values compares dynamic types first and then dynamic values; if the dynamic type is not comparable, the comparison panics. This is why `any` map keys can panic on insertion with slices, and why you should use `reflect.DeepEqual` or `slices.Equal` deliberately.

## Mastery criteria

- I can explain an interface value as a (type, value) pair and avoid the typed-nil bug.
- I define small interfaces at the consumer and can justify each one.
- I use type assertions and switches only at boundaries.
- I write generic functions and types with sensible constraints and rely on inference.
- I can say when generics, an interface, or a concrete type is the right tool.
- I can write one test suite that several implementations of an interface share.

## Further exploration

- Read the Go proposal for type parameters and the discussion of GC-shape stenciling to understand what generic code costs.
- Study how `io.Reader`, `io.Writer` and `http.Handler` demonstrate the "small interface" idea; build a middleware chain from `http.Handler`.
- Experiment with range-over-func iterators (`iter.Seq`, Go 1.23+) and decide how they interact with generics.
- Next skills: *Testing*, *Dependency injection & wiring*, *Clean architecture*.
