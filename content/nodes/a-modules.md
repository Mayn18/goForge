---
title: Modules, packages & project layout
go: 1.22+
time: 3-5 h
---

## Overview

Every Go backend you will ever ship is a **module** containing **packages**. Get this wrong and you fight the toolchain for years: import cycles, "cannot find package", a `go.mod` that drifts, a repository nobody else can navigate. Get it right and the compiler does most of your dependency management for you.

By the end you should be able to start a module from nothing, split it into packages with deliberate boundaries, add and upgrade a dependency while understanding *which version you actually get and why*, and lay out a service repository the way the Go team recommends rather than the way a blog once did.

## Prerequisites

**Essential:** Go installed and `go version` working; you can compile and run a single-file program.

**Recommended:** basic command-line navigation; having used Git at least once.

If `go run main.go` is new to you, spend twenty minutes on the Go tutorial first, then return.

## How it works

### Packages are the unit of compilation and encapsulation

A **package** is a directory of `.go` files that all start with the same `package name` clause. Packages are the only encapsulation boundary Go has: an identifier is visible to other packages **only if it starts with an upper-case letter** (it is *exported*). There is no `protected`, no friend, no per-file privacy. A package name is *not* its import path; the name is whatever the `package` clause says, the import path is where the directory lives.

`package main` is special: it produces an executable and must contain `func main()`. Everything else is a library.

### A module is a tree of packages versioned together

A **module** is a collection of packages released together, rooted at a directory containing a `go.mod` file. The `module` line declares the **module path**, which is the prefix of every import path inside it:

```go
// go.mod
module github.com/you/beepbot-api

go 1.22

require github.com/google/uuid v1.6.0
```

A package at `./internal/store` is imported as `github.com/you/beepbot-api/internal/store`. The module path need not be a real URL for code you never publish, but it must be unique and, for anything others will `go get`, it must be where the code can be fetched from.

### Resolving which dependency version you get: MVS

Go uses **Minimal Version Selection**. Your `go.mod` lists *minimum* required versions. When the build needs a module that several dependencies require at different versions, Go picks the **highest of the stated minimums**, never "latest available". Consequences worth internalizing:

- Builds are reproducible without a lock file: `go.mod` plus `go.sum` is the lock.
- A new release of a dependency never reaches you until *you* ask (`go get -u`, or a specific version).
- Upgrading one module can raise the version of others; `go mod tidy` and `go list -m all` show the result.

`go.sum` is not a lock file. It records **cryptographic hashes** of module contents so that a tampered or re-tagged module is detected. Commit it.

### Visibility tools: `internal` and layout

Any package under a directory named `internal` can only be imported by code rooted at the parent of that `internal` directory. The compiler enforces it. That makes `internal/` the right default home for application code: you cannot accidentally promise an API to the world.

```diagram
beepbot-api/
├── go.mod
├── cmd/
│   └── api/
│       └── main.go        package main: wiring only, small
├── internal/
│   ├── chat/              business logic
│   ├── httpapi/           handlers, routing
│   └── store/             persistence
└── README.md
```

### Import cycles are a design error, not a tooling error

Go forbids import cycles at compile time. If package `a` imports `b` and `b` needs something from `a`, the cycle is telling you a concept is in the wrong place. Typical fixes: move the shared type to a third package, or invert the dependency by defining a small interface in the *consumer*.

> [!GO] The `go` directive in `go.mod` sets the **minimum language version** for the module. Since Go 1.21 it is enforced as a requirement, and since 1.21 the toolchain may download a newer toolchain automatically when `go.mod` demands one (the `toolchain` directive). Loop-variable semantics changed in Go 1.22 and depend on this directive: a module declaring `go 1.21` still gets the old per-loop variable behavior.

## Official documentation

- [official] [Tutorial: Create a Go module](https://go.dev/doc/tutorial/create-module) — Do this first if `go mod init` is new. 15 minutes.
- [official] [Managing dependencies](https://go.dev/doc/modules/managing-dependencies) — Read "Adding a dependency", "Getting a specific dependency version", "Upgrading or downgrading", and "Synchronizing your code's dependencies". Vocabulary: *direct* vs *indirect*, `go mod tidy`.
- [official] [go.mod file reference](https://go.dev/doc/modules/gomod-ref) — Read every directive: `module`, `go`, `toolchain`, `require`, `replace`, `exclude`, `retract`. Know what each is for.
- [official] [Organizing a Go module](https://go.dev/doc/modules/layout) — The Go team's own layout advice. Note what it says about `internal/` and about not needing a `pkg/` directory.
- [official] [Go Modules Reference: Minimal version selection](https://go.dev/ref/mod#minimal-version-selection) — The exact algorithm. Read the "graph pruning" note after you understand the basic idea.
- [official] [Go Modules Reference: Vendoring](https://go.dev/ref/mod#vendoring) — When and why you would vendor; what `go mod vendor` produces.
- [supplementary] [Using Go Modules (Go Blog)](https://go.dev/blog/using-go-modules) — A walk-through from the Go team. Older, but the commands still apply.

## Practical examples

### Starting a module and adding a dependency

```bash
mkdir beepbot-api && cd beepbot-api
go mod init github.com/you/beepbot-api
go get github.com/google/uuid@v1.6.0
go mod tidy
go list -m all
```

Windows PowerShell and `cmd.exe` accept the same commands. Use `mkdir beepbot-api; cd beepbot-api` in older PowerShell if `&&` is rejected.

### A package with a deliberately small surface

```go
// internal/chat/chat.go
package chat

import "strings"

// Reply is the only thing callers need. Everything else stays unexported.
func Reply(text string) string {
	return respond(normalize(text))
}

func normalize(s string) string { return strings.ToLower(strings.TrimSpace(s)) }

func respond(s string) string {
	switch s {
	case "":
		return "Say something!"
	case "hello":
		return "Hello!"
	default:
		return "I heard: " + s
	}
}
```

```go
// cmd/api/main.go
package main

import (
	"fmt"

	"github.com/you/beepbot-api/internal/chat"
)

func main() { fmt.Println(chat.Reply("  Hello ")) }
```

### Common mistakes

> [!PITFALL] **Naming the directory `utils`, `common` or `helpers`.** A package named for *what it contains* rather than *what it provides* collects unrelated code and eventually imports half the project. Name packages for a concept (`chat`, `auth`, `store`).

> [!PITFALL] **Committing without `go.sum`, or editing it by hand.** `go.sum` is generated. Missing it breaks other people's builds with "missing go.sum entry"; hand edits defeat its purpose.

> [!PITFALL] **Using `replace` with a local path and committing it.** `replace example.com/x => ../x` works on your machine only. Use a `go.work` workspace for local multi-module development and do not commit it unless the repository really is a workspace.

> [!PITFALL] **Assuming `go get -u` is safe.** It upgrades dependencies and their transitive dependencies to the latest minor/patch versions. Do it deliberately, then run the tests.

## Hands-on exercises

### 1. Build the skeleton from memory

Create a new module (any path you like) containing two packages: a library package `greeter` with one exported function and one unexported helper, and a `cmd/hello` executable that imports it. Prove with `go build ./...` and `go run ./cmd/hello` that it works.

You are done when: `go vet ./...` is clean, removing the `greeter` import breaks the build with a message you can explain, and calling the unexported helper from `main` fails with a compiler error you can quote.

### 2. Dependency archaeology

Add `github.com/google/uuid` at a specific older version. Then, using only `go` commands and the documentation (no web search for "how to"), find out: which version is selected now, which packages in your module import it, and what would change if you ran `go get -u`. Run the upgrade, then *downgrade back* to the original version.

You are done when you can state the exact commands you used for each question and what `go.mod` and `go.sum` looked like before and after.

### 3. Break and fix an import cycle

Create packages `a` and `b` where each needs something from the other, so that the build fails with an import cycle. Fix it **two different ways**: once by extracting a third package, once by introducing an interface defined in the consuming package.

You are done when both fixes compile, and you can explain which one you would keep in a real codebase and which dependency direction you chose.

### 4. Enforce a boundary

Make a module with `internal/secret` and a second, separate module in a sibling directory that tries to import it (use a `replace` directive or a `go.work` file to connect them locally). Observe the error. Then restructure so a legitimate caller *inside* the first module can use it.

You are done when you can explain, in your own words, exactly which importers `internal` permits and why the second module is excluded.

## Engineering challenge

**Reproduce a build somebody else broke.** Create a module that depends on two libraries `lib1` and `lib2` (write them yourself as tiny local modules at several tagged versions, or use two real ones that share a transitive dependency). Arrange that:

- `lib1` requires `shared v1.1.0` and `lib2` requires `shared v1.3.0`.
- Your module also directly requires `lib1` only.

Predict, *before running anything*, which version of `shared` is selected, then verify with `go list -m all`. Next, make a breaking change in `shared v1.3.0` that `lib1` cannot tolerate. Decide how you would resolve this using only `go.mod` directives, and demonstrate two options.

Constraints: no vendoring tricks, no copying code. Edge cases to address: what changes when `lib1` later bumps its requirement to `shared v1.3.0`? What does `exclude` do and why is it rarely the right answer? Write down your conclusion in five sentences.

## Knowledge check

### 1. Name versus path

A file under `internal/store/` begins with `package storage`. How do you import it, and what do you call it in code?

>>>
You import it by its **directory-based path**, `github.com/you/app/internal/store`, and refer to it by the **package clause name**, `storage`. The compiler uses the path to find the code and the declared name for identifiers. This mismatch is legal but confusing, so convention says make them match (and avoid underscores and plurals).

### 2. What MVS refuses to do

A dependency you use publishes v1.9.0 today. Your `go.mod` says `v1.4.0`. You run `go build`. Which version is compiled and why?

>>>
v1.4.0. Minimal Version Selection chooses the *minimum* version that satisfies all stated requirements, never the newest published. Only an explicit `go get` (or an upgrade command) changes the requirement. This is what makes builds reproducible without a separate lock file.

### 3. Why commit go.sum

Someone says "go.sum is generated, so don't commit it". What is wrong with that?

>>>
`go.sum` records expected cryptographic hashes of module contents. Committing it means every machine verifies it downloaded identical bytes (also checked against the public checksum database by default). Without it, a re-tagged or tampered module could slip in unnoticed. It is generated, but it is part of the build's integrity story, not a cache.

### 4. Design a boundary

You have `package orders` and `package customers`. `orders` needs a customer's email; `customers` wants to list a customer's orders. The compiler reports an import cycle. Give two structural fixes and a reason to prefer one.

>>>
(a) Extract the shared concept (e.g. a `customer.ID` or the data both need) into a third package both import. (b) Make the *consumer* define a small interface it needs (for example `orders` declares `EmailFinder`) and let the other side satisfy it implicitly, so only wiring code imports both. Prefer (b) when the dependency is behavior and (a) when it is plain data; either way, the cycle usually shows a boundary drawn through one concept.

### 5. What `internal` really does

A teammate puts shared helpers in `github.com/you/app/internal/util` and a separate repository `github.com/you/other` tries to import it. What happens, and what is the rule?

>>>
The build fails: "use of internal package ... not allowed". The rule: a package whose path contains an `internal` element may be imported only by code in the tree rooted at the *parent* of that `internal` directory. `other` is a different module outside that tree. If it genuinely needs the code, publish it as an exported package, deliberately accepting the API commitment.

### 6. The `go` directive

Your `go.mod` says `go 1.21`, but you run Go 1.23. A `for` loop captures its loop variable in a goroutine. Which semantics apply and where is that decided?

>>>
The Go 1.21 (per-loop variable) semantics apply, because the language version for a module is set by the `go` directive in its `go.mod`, not by the installed toolchain. The per-iteration loop-variable behavior arrived in Go 1.22 and is enabled only for modules declaring `go 1.22` or later. Upgrading the directive is a deliberate, reviewable change.

## Mastery criteria

- I can create a module, add packages and an executable, and explain every line of the resulting `go.mod`.
- I can predict which version Minimal Version Selection will choose and verify it with `go list -m all`.
- I can explain what `go.sum` protects against and what `go mod tidy` changes.
- I can fix an import cycle by redrawing a boundary, not by hacking around the compiler.
- I can justify a repository layout (`cmd/`, `internal/`) and say when a flat layout is better.
- I can use `replace` or a workspace for local development without committing something that breaks other machines.

## Further exploration

- Read the Go Modules Reference section on **private modules** (`GOPRIVATE`, `GOPROXY`, `GONOSUMDB`) and work out how a company would host internal libraries.
- Learn `go work` for developing several modules at once.
- Read about `retract` and think about what a library maintainer owes consumers after publishing a bad release.
- Study semantic import versioning: why does a `v2` module change its import path?
- Later skills that build on this: *Testing*, *Dependency injection & wiring*, and *CI/CD*.
