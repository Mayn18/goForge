---
title: Slices, arrays & maps
go: 1.22+
time: 4-6 h
---

## Overview

Slices and maps carry almost all the data in a Go backend: request batches, query results, JSON arrays, caches, indexes. They are also where experienced programmers from other languages get bitten, because a slice is **not** a list; it is a small *view* onto an array, and copying it copies the view, not the data.

After this lesson you should predict, without running the code, whether two slices share memory, what `append` does to the original, why a map iteration order changes between runs, and why a map is not safe to touch from two goroutines.

## Prerequisites

**Essential:** Go modules (you can build and run a program); basic types, functions and loops.

**Recommended:** familiarity with pointers (see *Structs & pointers*), because slice behavior makes much more sense once you see a slice header as a struct of a pointer, a length, and a capacity.

## How it works

### An array is a value; a slice is a window

`[4]int` is an array: fixed length, part of its type, **copied on assignment**. A slice `[]int` is a three-word header:

```diagram
slice header          backing array
┌──────────┐         ┌───┬───┬───┬───┬───┬───┐
│ ptr   ───┼────────▶│ 0 │ 1 │ 2 │ 3 │ 4 │ 5 │
│ len   4  │         └───┴───┴───┴───┴───┴───┘
│ cap   6  │          ◀── len ──▶
└──────────┘          ◀────────── cap ───────▶
```

`len` is how many elements you can index; `cap` is how many exist in the backing array from the slice's start. Passing a slice to a function copies the header (three words) but **shares the array**. So writing `s[0] = x` inside a function is visible to the caller; but `s = append(s, x)` changes only the callee's copy of the header, unless it returns the new slice.

### append and the aliasing trap

`append` writes into the existing array if `len < cap`; otherwise it allocates a bigger array, copies, and returns a header pointing at the new one. Whether two slices still share memory *depends on capacity*, which is why this is a classic bug:

```go
a := make([]int, 3, 10)
b := append(a, 1)   // fits: writes into a's array
c := append(a, 2)   // fits: overwrites the same slot b used
fmt.Println(b[3], c[3]) // both print 2
```

The three-index slice `a[low:high:max]` limits capacity so a later `append` must copy. Use it when you hand out a sub-slice that must not be able to overwrite what follows it.

### Slicing does not copy, and can pin memory

`big[100:110]` keeps the whole `big` array alive for as long as the sub-slice lives. A parser that keeps a 10-byte token out of a 10 MB buffer retains 10 MB. Copy what you keep: `slices.Clone(tok)` (Go 1.21+) or `append([]byte(nil), tok...)`.

### nil versus empty

A nil slice has a nil pointer, length 0, capacity 0. It is **valid to append to, range over and take `len` of**. An empty non-nil slice behaves the same in all of those. They differ in `== nil` and, importantly, in **JSON**: `encoding/json` marshals a nil slice as `null` and an empty one as `[]`. APIs that promise an array should return an empty slice.

### Maps

A map is a hash table, passed by reference (the variable holds a pointer to runtime state). Key properties:

- Keys must be **comparable** (`==` defined): strings, numbers, bools, pointers, channels, arrays, structs of those. Not slices, maps or functions.
- The zero value is a **nil map**: reads work, **writes panic**. Always `make(map[K]V)` or use a literal.
- **Iteration order is unspecified and deliberately randomized.** Never depend on it. To produce stable output, collect and sort the keys (`slices.Sorted(maps.Keys(m))` in Go 1.23+, or `slices.Sort` on a collected slice).
- `v, ok := m[k]` distinguishes "missing" from "present with the zero value".
- **Maps are not safe for concurrent use.** A write concurrent with any other access is a data race, and the runtime may detect it and abort the program with "fatal error: concurrent map writes". Guard with a `sync.Mutex`/`RWMutex` or use a purpose-built structure.
- Deleting during iteration is allowed; entries added during iteration may or may not be visited.

> [!GO] Since Go 1.21 the standard library has `slices` and `maps` packages (`slices.Sort`, `slices.Contains`, `slices.Index`, `slices.BinarySearch`, `maps.Clone`, `maps.Keys`...). Prefer them to hand-written loops. `min`, `max` and `clear` became built-ins in 1.21.

## Official documentation

- [official] [Go Slices: usage and internals](https://go.dev/blog/slices-intro) — The canonical explanation of the slice header, `append` and `copy`. Read all of it.
- [official] [Arrays, slices (and strings): The mechanics of 'append'](https://go.dev/blog/slices) — Rob Pike's deeper walk through headers and growth. Read after the previous post.
- [official] [Spec: Slice types](https://go.dev/ref/spec#Slice_types) — Terminology: *length*, *capacity*, *underlying array*.
- [official] [Spec: Slice expressions](https://go.dev/ref/spec#Slice_expressions) — Note the full `a[low:high:max]` form and its constraints.
- [official] [Spec: Appending to and copying slices](https://go.dev/ref/spec#Appending_and_copying_slices) — The exact semantics of `append` and `copy`.
- [official] [Spec: Map types](https://go.dev/ref/spec#Map_types) — Which key types are allowed, and why.
- [official] [Go maps in action](https://go.dev/blog/maps) — Idioms: comma-ok, deleting, iteration, concurrency.
- [official] [Package slices](https://pkg.go.dev/slices) — Skim every function name; read `Clone`, `Sort`, `SortFunc`, `BinarySearch`, `Compact`.
- [official] [Package maps](https://pkg.go.dev/maps) — `Clone`, `Copy`, `Keys`, `Values`.

## Practical examples

### Filtering in place without allocating

```go
// Removes empty strings, reusing the same backing array.
func dropEmpty(in []string) []string {
	out := in[:0]
	for _, s := range in {
		if s != "" {
			out = append(out, s)
		}
	}
	// Clear the tail so the GC can free strings no longer referenced.
	clear(in[len(out):])
	return out
}
```

This *destroys* the caller's original contents, which is acceptable only when documented. Go 1.21 added `slices.DeleteFunc`, which does exactly this.

### A word-frequency map with deterministic output

```go
func topWords(text string) []string {
	counts := map[string]int{}
	for _, w := range strings.Fields(strings.ToLower(text)) {
		counts[w]++ // missing key reads as 0, so no existence check needed
	}
	words := make([]string, 0, len(counts))
	for w := range counts {
		words = append(words, w)
	}
	slices.SortFunc(words, func(a, b string) int {
		if c := cmp.Compare(counts[b], counts[a]); c != 0 {
			return c // higher count first
		}
		return cmp.Compare(a, b) // tie-break so output is stable
	})
	return words
}
```

### Common mistakes

> [!PITFALL] **Appending to a sub-slice and overwriting the parent.** `head := all[:2]; head = append(head, x)` overwrites `all[2]` if `cap(head) > 2`. Use `all[:2:2]` or copy.

> [!PITFALL] **Ranging with `&v`.** Before Go 1.22 `for _, v := range xs { ptrs = append(ptrs, &v) }` stored the same address every time. In modules declaring `go 1.22` or later each iteration has its own `v`, but the habit is still worth distrusting: be explicit, and know which semantics your `go.mod` selects.

> [!PITFALL] **Assuming map order.** A test that passes five times and fails once usually has a map-order dependency. Sort before comparing or printing.

> [!PITFALL] **Writing to a nil map.** `var m map[string]int; m["a"] = 1` panics. Declaring is not initializing.

> [!PITFALL] **Sharing a map between handlers.** Every HTTP request runs on its own goroutine. A package-level map mutated by handlers needs synchronization, and `go test -race` will find the missing one.

## Hands-on exercises

### 1. Predict, then run

Write five small snippets of your own that exercise: (a) `append` within capacity on two slices sharing an array, (b) `append` beyond capacity, (c) `copy` with overlapping ranges, (d) a three-index slice, (e) a function that appends to its slice parameter. For each, write down the exact printed output *before* running it. Then run and reconcile every difference.

You are done when you have zero unexplained surprises, and you can draw the header and backing array for each case.

### 2. A growth probe

Write a program that appends one element at a time to a nil `[]int` and prints each time the capacity changes. Run it for 2,000 elements and look at the sequence. Compare with the same for `[]byte` and for a struct of 24 bytes.

You are done when you can describe the growth pattern you observed, state what the language specification promises about it (look it up), and explain why you must never rely on the specific numbers.

### 3. Implement the generic helpers yourself

Without using the `slices` package, write `Filter`, `Map`, `Unique` (preserving first-seen order) and `Chunk` (split into sub-slices of size n) as generic functions. Then write tests that include the empty slice, nil, a single element, and `n` larger than the input. Decide for each function whether it may share memory with its input, and document the decision.

You are done when each function's doc comment states its aliasing behavior and a test proves it.

### 4. A thread-safe counter map

Build a `Counter` type that records string occurrences and supports `Inc(key)`, `Get(key)`, and `Snapshot()` returning a copy sorted by key. Write a test that hammers it from many goroutines and run it with `go test -race`. First write the *unsafe* version and confirm that the race detector or the runtime catches it.

You are done when the race detector is clean, `Snapshot` cannot be used to mutate internal state, and you can say why a `RWMutex` may or may not be faster here.

## Engineering challenge

**Build a bounded LRU cache with exact semantics.** Implement `Cache[K comparable, V any]` with `Get`, `Put`, `Len`, and a fixed capacity, evicting the least recently used entry. Requirements:

- `Get` and `Put` run in O(1) time; prove it by reasoning about your data structure and then show it with a benchmark across several sizes.
- Safe for concurrent use; the race detector must be clean under a stress test mixing gets and puts.
- A `Put` of an existing key updates the value and marks it most recently used without changing `Len`.
- Capacity of zero or negative must be rejected deliberately, not silently misbehave.
- Zero values of `V` must be distinguishable from a miss.

Constraints: standard library only; you may use `container/list` but must be able to explain why a slice or a plain map alone would not meet the O(1) requirement. Edge cases to think through: eviction while another goroutine holds a value it got earlier, a `K` whose equality is surprising (floats and NaN), and whether `Get` needs a write lock, and what that does to contention.

## Knowledge check

### 1. Shared or not?

`a := []int{1,2,3,4}; b := a[1:3]; b[0] = 99; b = append(b, 100)`. What is `a` afterwards, and why?

>>>
`a` is `[1 99 3 100]`. `b` shares `a`'s array starting at index 1, with length 2 and capacity 3. `b[0] = 99` writes `a[1]`. The append fits within capacity, so it writes the next slot of the shared array, which is `a[3]`, replacing the 4. Work these out from `len` and `cap`, not from intuition: the append reused `a`'s array and silently overwrote an element `a` still owns.

### 2. Why does the callee's append vanish?

`func add(s []int) { s = append(s, 1) }`. After calling `add(xs)` with `len(xs) == cap(xs)`, what does the caller see? What if `len < cap`?

>>>
In the first case the callee's append allocates a new array; the caller's header is unchanged, so the caller sees nothing. In the second case the append writes into the shared array *beyond the caller's length*, so the caller's `len` is unchanged and the new element is invisible through the caller's slice, though the memory was written. In both cases the caller's header does not change, because headers are passed by value. Return the slice or take a pointer.

### 3. nil versus empty over the wire

A handler returns a `[]Item` that has no items. Clients receive `null` sometimes and `[]` other times. What is happening and how do you make it deterministic?

>>>
`encoding/json` encodes a nil slice as `null` and an empty, non-nil slice as `[]`. Code paths differ: one returns `nil` (e.g. an early `var items []Item`), another returns `make([]Item, 0)` or a filtered result. Make the contract explicit by always initializing (`items := []Item{}` or `make`), or normalize at the boundary. In tests, assert on the serialized JSON, not just `len`.

### 4. Map safety

Two goroutines read the same map and one occasionally writes. Everything works in testing. Why is that still a bug, and what are the options?

>>>
Concurrent writes with any other access are a data race; it works in testing only by luck, and the runtime can also crash with `fatal error: concurrent map read and map write`. Options: a `sync.RWMutex` around all access; confine the map to one goroutine and communicate via channels; use `sync.Map` for its narrow use cases (mostly-read keys with disjoint writers); or copy-on-write by swapping an immutable map behind an `atomic.Pointer`. The right choice depends on read/write ratio and invariants spanning multiple keys.

### 5. Pinned memory

A function reads a 50 MB file and returns `data[:16]` as the header. The service's memory keeps growing. Why?

>>>
The returned slice keeps the whole 50 MB backing array reachable, so the garbage collector cannot free it. Fix by copying the part you keep (`slices.Clone(data[:16])`). The same trap appears with substrings of large strings in older Go versions and with sub-slices stored in caches.

### 6. Choosing a key type

You want a map keyed by a pair `(userID, roomID)`. Which key types work, which do not, and what would you choose?

>>>
A struct of two comparable fields (`struct{ User, Room int64 }`) is comparable and the idiomatic choice; an array `[2]int64` also works. A slice cannot be a key (not comparable) and a concatenated string key works but allocates, invites separator bugs, and loses type safety. Choose the struct: it is allocation-free, hashes well, and documents intent.

## Mastery criteria

- I can draw a slice header and backing array and predict the effect of `append`, `copy` and re-slicing, including capacity.
- I can explain nil versus empty slices and the JSON consequence.
- I know when a sub-slice pins memory and how to avoid it.
- I never depend on map order, and I handle the nil-map and missing-key cases correctly.
- I can make a map safe for concurrent use and confirm it with the race detector.
- I can use the `slices` and `maps` packages fluently and say when a hand-written loop is better.

## Further exploration

- Read the Go runtime source for map implementation notes (the Swiss-table map arrived in Go 1.24; read the release notes to see what changed and what stayed the same).
- Study `sync.Map` and decide for which workloads it beats a mutex-guarded map.
- Write benchmarks comparing a map of small structs with a sorted slice and binary search; where is the crossover?
- Next skills: *Interfaces*, *Concurrency primitives*, and *JSON & serialization*.
