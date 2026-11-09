---
title: Structs, methods & pointers
go: 1.22+
time: 4-6 h
---

## Overview

Structs are how Go models data and pointers are how Go models identity and shared mutation. Nearly every design decision in a backend (is this a value or an entity, can this be copied safely, can this be nil, who owns this memory) reduces to understanding them well. This lesson also covers methods, embedding, and the rule that quietly decides whether your type is safe to share between goroutines: **do you copy it or point at it?**

## Prerequisites

**Essential:** modules and packages; basic types, functions, control flow.

**Recommended:** *Slices, arrays & maps* (slice headers make value-versus-reference semantics concrete).

## How it works

### Everything is passed by value

Go has no reference parameters. Passing a struct copies it; passing a pointer copies the *pointer* (one word) and both copies refer to the same struct. Slices, maps, channels, functions and interfaces are small headers that contain pointers, so copying them copies a handle to shared state. That is why `func f(m map[string]int)` can mutate the caller's map but `func f(s MyStruct)` cannot mutate the caller's struct.

### Value or pointer receivers

```go
type Counter struct{ n int }

func (c Counter) Value() int { return c.n } // value receiver: operates on a copy
func (c *Counter) Inc()      { c.n++ }      // pointer receiver: mutates the original
```

Rules of thumb, in order of importance:

1. If any method needs to **mutate** the receiver, use pointer receivers for **all** methods of that type.
2. If the type contains something that **must not be copied** (a `sync.Mutex`, a `sync.WaitGroup`, a `strings.Builder` after first use), use pointer receivers. `go vet` flags copying a lock.
3. Large structs are cheaper to pass by pointer, but measure before optimizing; small structs are often faster by value.
4. Do not mix receiver kinds on one type. It confuses method sets (below) and readers.

### Method sets decide interface satisfaction

The method set of `T` includes only value-receiver methods; the method set of `*T` includes both. So if `Inc` has a pointer receiver, then `Counter` does **not** implement an interface requiring `Inc`, but `*Counter` does. The compiler error "method has pointer receiver" is this rule speaking.

### Zero values and construction

Every type has a usable **zero value**: `0`, `""`, `nil`, or a struct of zero fields. Idiomatic Go designs types so the zero value works (`var mu sync.Mutex`, `var b bytes.Buffer`). When a type needs invariants, offer a constructor `NewThing(...) (*Thing, error)` and document that the zero value is not valid.

### Embedding is composition, not inheritance

```go
type Logger struct{ prefix string }
func (l *Logger) Logf(format string, args ...any) { /* ... */ }

type Server struct {
	*Logger          // embedded: Server gets Logf promoted
	addr string
}
```

Promoted methods forward to the embedded value. There is no virtual dispatch: if `Logger` calls its own method, it cannot see an override defined on `Server`. Embedding an interface in a struct is a common way to implement a partial interface for tests, and to wrap behavior (decorators).

### Struct tags and comparison

Tags like `` `json:"id,omitempty"` `` are metadata read by reflection (`encoding/json`, `database/sql` mappers). A struct is comparable with `==` if all its fields are, which makes it usable as a map key; one with a slice or map field is not.

### nil pointers and what they cost

Dereferencing a nil pointer panics. A nil *pointer* stored in an interface is **not** a nil interface (see *Interfaces*). Calling a method on a nil pointer receiver is legal and sometimes useful, if the method handles it.

> [!GO] `new(T)` and `&T{}` are equivalent for structs. Escape analysis, not your syntax, decides whether a value lives on the stack or heap; use `go build -gcflags=-m` to see its decisions.

## Official documentation

- [official] [A Tour of Go: Pointers, Structs, Methods](https://go.dev/tour/moretypes/1) — The quickest orientation; skip if already comfortable.
- [official] [Spec: Struct types](https://go.dev/ref/spec#Struct_types) — Embedded fields, promotion, tags, and comparability.
- [official] [Spec: Method sets](https://go.dev/ref/spec#Method_sets) — The precise rule behind "does T implement I".
- [official] [Spec: Method declarations](https://go.dev/ref/spec#Method_declarations) — Receiver rules.
- [official] [Effective Go: Pointers vs. Values](https://go.dev/doc/effective_go#pointers_vs_values) — The original guidance; read it with this lesson's rules alongside.
- [official] [Effective Go: Embedding](https://go.dev/doc/effective_go#embedding) — Composition by embedding, with examples.
- [official] [Go Code Review Comments: Receiver Type](https://go.dev/wiki/CodeReviewComments#receiver-type) — The checklist reviewers apply.
- [official] [Go FAQ: Should I define methods on values or pointers?](https://go.dev/doc/faq#methods_on_values_or_pointers) — The FAQ version, concise.

## Practical examples

### A type whose zero value is useful

```go
// SafeCounter is ready to use as `var c SafeCounter`.
type SafeCounter struct {
	mu sync.Mutex
	m  map[string]int
}

func (c *SafeCounter) Inc(key string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.m == nil {
		c.m = make(map[string]int) // lazy init keeps the zero value valid
	}
	c.m[key]++
}
```

### A constructor that enforces invariants

```go
type Config struct {
	addr    string
	timeout time.Duration
}

func NewConfig(addr string, timeout time.Duration) (Config, error) {
	if addr == "" {
		return Config{}, errors.New("config: addr is required")
	}
	if timeout <= 0 {
		return Config{}, fmt.Errorf("config: timeout must be positive, got %v", timeout)
	}
	return Config{addr: addr, timeout: timeout}, nil
}
```

### Functional options for optional configuration

```go
type Option func(*Server)

func WithTimeout(d time.Duration) Option { return func(s *Server) { s.timeout = d } }

func NewServer(addr string, opts ...Option) *Server {
	s := &Server{addr: addr, timeout: 30 * time.Second}
	for _, o := range opts {
		o(s)
	}
	return s
}
```

### Common mistakes

> [!PITFALL] **Copying a mutex.** Passing a struct that contains a `sync.Mutex` by value copies its lock state; the copy and original no longer exclude each other. `go vet` reports "passes lock by value". Use a pointer.

> [!PITFALL] **Value receiver that "mutates".** `func (c Counter) Inc() { c.n++ }` increments a copy and is a silent no-op. If the compiler is silent, the tests must not be.

> [!PITFALL] **Mixed receivers.** A type with both kinds leaves you wondering which values satisfy which interface. Pick pointers once any method needs them.

> [!PITFALL] **Exposing internal slices and maps from getters.** Returning `s.items` hands out your backing array; callers can mutate your state without your methods. Return a copy, or an iterator.

> [!PITFALL] **Taking the address of a map element.** `&m["k"]` does not compile because map entries can move. Store pointers in the map if you need stable identity.

## Hands-on exercises

### 1. Value versus pointer experiment

Write a struct with an `int` field and a method of each receiver kind that attempts to modify it. Call both on a variable, on a map element (`m[k].Inc()`), and on a slice element. Record which compile, which mutate the original, and why the map case fails for the pointer method.

You are done when you can explain every compiler error you hit using the words "addressable" and "method set".

### 2. Fix the interface that "does not implement"

Define an interface `Incrementer { Inc() }` and a type whose `Inc` has a pointer receiver. Make three attempts to assign a value to the interface: a value, a pointer, and an element of a slice of values. Observe which fail, then restructure the code so it compiles in the way you would choose in production.

You are done when you can state, without looking, which of the three should compile and why, and what you changed.

### 3. A type with invariants

Design a `Money` type (an integer count of the smallest currency unit plus a currency code) with `Add`, `Sub`, `Mul(int)` and `String`. Make invalid states unrepresentable or rejected: negative results from `Sub` may be an error, mixing currencies is an error, overflow must not silently wrap. Write table-driven tests that include the overflow edges.

You are done when the zero value's behavior is deliberate and documented, the type is comparable, and the tests cover the overflow boundaries.

### 4. Embedding and its limits

Create a `Base` with methods `Name()` and `Describe()`, where `Describe` calls `Name`. Embed it in `Child` and override `Name`. Predict what `Child{}.Describe()` returns before running it. Then write the version that gives the "override" behavior using an interface and explain what you traded off.

You are done when you can explain, with a diagram, why Go has no virtual dispatch through embedding and what pattern replaces it.

## Engineering challenge

**An in-memory account ledger that cannot lose money.** Model `Account` entities and a `Ledger` that supports `Transfer(from, to, amount)`. Constraints:

- Transfers are atomic: no observer ever sees money removed from one account but not yet added to another.
- The sum of all balances is invariant across any number of concurrent transfers; verify with a test that runs thousands of random transfers from many goroutines and checks the total and non-negativity at the end.
- Two concurrent transfers `A→B` and `B→A` must not deadlock.
- Balances never go negative; a rejected transfer must have no effect.
- Callers must not be able to mutate an account's balance except through the ledger.

Decide: pointer or value for `Account`? One global lock or per-account locks (and how do you order them to avoid deadlock)? What does `Snapshot()` return so callers cannot break invariants? Edge cases: transfer to self, zero and negative amounts, unknown accounts, overflow. Run everything with `-race`.

## Knowledge check

### 1. The silent no-op

A method `func (u User) SetName(n string) { u.Name = n }` compiles and does nothing. Explain precisely why, and give two fixes.

>>>
The receiver `u` is a copy of the caller's `User`; the assignment changes the copy, which is discarded. Fixes: use a pointer receiver (`func (u *User) SetName`) so the method mutates the original, or return the modified value (`func (u User) WithName(n string) User`) and make immutability the design. The pointer version is typical for entities; the value version suits small immutable value objects.

### 2. Method sets

`type T struct{}` has `func (t *T) M()`. Does `var i interface{ M() } = T{}` compile? What about `&T{}`? Why?

>>>
`T{}` does not compile; `&T{}` does. The method set of `T` contains only value-receiver methods, while the method set of `*T` contains both. An interface conversion never takes an address implicitly: the interface would hold a `T`, and `T`'s method set lacks `M`. (A *method call* `t.M()` on an addressable variable works because the compiler inserts `(&t).M()`; that convenience does not extend to interface satisfaction.)

### 3. When copying is a bug

Name three kinds of values that must not be copied after first use, and how the toolchain helps you notice.

>>>
Types that contain a `sync.Mutex`/`RWMutex`, a `sync.WaitGroup`, a `sync.Once`, a `sync/atomic` typed value, or a `strings.Builder`/`bytes.Buffer` already in use. `go vet`'s `copylocks` check flags many of these; the race detector can reveal the consequences at runtime. The design response is pointer receivers and returning pointers from constructors.

### 4. Embedding versus inheritance

`type Dog struct{ Animal }`, with `Animal.Speak()` calling `a.Sound()`, and `Dog` defining its own `Sound()`. What does `Dog{}.Speak()` call, and why is that different from Java or Python?

>>>
It calls `Animal.Sound`, because inside `Speak` the receiver is an `Animal` and has no knowledge of the embedding `Dog`. Embedding forwards promoted methods; it does not provide dynamic dispatch back to the outer type. To get polymorphic behavior, program to an interface: `Speak` should accept (or hold) a `Sounder` and call through it.

### 5. Exposing internals

Why is `func (c *Cart) Items() []Item { return c.items }` risky, and what is the cost of the safe alternative?

>>>
It hands callers the backing array, so they can modify elements (and, through the shared array, even affect later appends), bypassing invariants like "total is recomputed". The safe alternative copies (`slices.Clone`) at O(n) cost per call, or exposes an iterator/visitor (`All() iter.Seq[Item]` in Go 1.23+) or specific query methods. Choose based on how hot the call is and how much you trust callers.

### 6. Zero value design

Why do `sync.Mutex` and `bytes.Buffer` work without constructors, and what does that suggest for your own types?

>>>
Their zero values are valid, ready-to-use states, which removes an entire class of "forgot to initialize" bugs and makes embedding trivial. For your own types, prefer designs where `var x T` is usable (lazy-initialize internal maps, treat nil slices as empty). Where invariants really require configuration, provide a constructor, validate there, and document that the zero value is not valid.

## Mastery criteria

- I can predict whether a method call mutates the original and explain it in terms of copies and addressability.
- I can state a type's method set and tell whether it satisfies an interface.
- I choose receiver kinds deliberately and apply the "all or none" rule.
- I design types with useful zero values or enforce invariants through constructors.
- I use embedding for composition and know it is not inheritance.
- I can prevent callers from corrupting internal state through returned slices, maps or pointers.

## Further exploration

- Run `go build -gcflags=-m` on small programs and learn to read escape-analysis output.
- Read about struct memory layout and padding (`unsafe.Sizeof`, field ordering) and measure a struct before and after reordering.
- Study the functional options pattern's trade-offs against a plain config struct.
- Next skills: *Interfaces*, *Concurrency primitives*, *Testing*.
