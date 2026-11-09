---
title: net/http servers & handlers
go: 1.22+
time: 6-8 h
---

## Overview

The standard library's `net/http` is a production-grade server and client, and most Go backends use it directly or through a thin router. Learning it deeply is the highest-leverage skill in this track: frameworks come and go, but the `http.Handler` interface, the request lifecycle, and the knobs that prevent resource exhaustion remain. This lesson takes you from a hello-world to a server with routing, middleware, bounded request bodies, timeouts and graceful shutdown, using Go 1.22's enhanced `ServeMux`.

## Prerequisites

**Essential:** *HTTP & the request lifecycle*; *Interfaces & generics* (`http.Handler` is an interface); *Error handling*; *Goroutines & channels*.

**Recommended:** *sync primitives & context* (request contexts, shutdown).

## How it works

### The handler is the unit

```go
type Handler interface {
	ServeHTTP(ResponseWriter, *Request)
}
```

Everything is a `Handler`: your routes, your router (`*http.ServeMux` implements it), and your middleware (a function that takes a handler and returns a handler). `http.HandlerFunc` adapts an ordinary function.

The server accepts connections and runs a goroutine **per connection** (HTTP/1) or per stream (HTTP/2). So **your handlers run concurrently, and any shared state they touch needs synchronization**.

### ServeMux in Go 1.22

Patterns can include a method, host, and path wildcards:

```go
mux := http.NewServeMux()
mux.HandleFunc("GET /messages/{id}", getMessage)   // r.PathValue("id")
mux.HandleFunc("POST /messages", createMessage)
mux.HandleFunc("GET /files/{path...}", serveFile) // remainder wildcard
mux.HandleFunc("GET /{$}", index)                  // exactly "/"
```

- More specific patterns win over general ones; conflicting patterns panic at registration.
- A matching path with a disallowed method gets an automatic **405** with an `Allow` header; unknown paths get **404**.
- `GET` patterns also match `HEAD`.
- `r.PathValue("id")` reads wildcards. Values are strings: parse and validate them.

### The request and the body

`*http.Request` carries method, URL, headers, `Body` (an `io.ReadCloser` stream), and a `Context()` that is **cancelled when the client disconnects or the handler returns**. Pass `r.Context()` to everything downstream. Rules:

- **Bound the body**: `r.Body = http.MaxBytesReader(w, r.Body, 1<<20)` before decoding. Without a limit a client can stream gigabytes at you.
- The server closes the body for you, but you should read it to completion or the connection may not be reused for HTTP/1.1.
- `r.ParseForm`, `r.FormValue` and multipart parsing have their own memory limits; know them.

### Writing the response

`http.ResponseWriter` has three steps and **order matters**: set headers, call `WriteHeader(status)`, write the body. Header changes after the first `Write` or `WriteHeader` are ignored. Calling `Write` without `WriteHeader` implies 200. A second `WriteHeader` logs "superfluous response.WriteHeader call" and is ignored.

```go
func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		slog.Error("write response", "err", err) // status is already sent; you can only log
	}
}
```

Once bytes have been sent you cannot change the status. Encode to a buffer first if you must be able to return a clean 500 on encoding failure.

### Middleware

```go
func logging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := &statusRecorder{ResponseWriter: w, status: 200}
		next.ServeHTTP(rec, r)
		slog.Info("request", "method", r.Method, "path", r.URL.Path, "status", rec.status, "dur", time.Since(start))
	})
}
```

Middleware wraps the writer to observe status codes. Be careful that a wrapper hides optional interfaces (`http.Flusher`, `http.Hijacker`); use `http.NewResponseController(w)` (Go 1.20+), which unwraps via an `Unwrap() http.ResponseWriter` method.

### A server you can run in production

`http.ListenAndServe` uses defaults with **no timeouts**. Use an explicit `http.Server`:

```go
srv := &http.Server{
	Addr:              ":8080",
	Handler:           handler,
	ReadHeaderTimeout: 5 * time.Second,
	ReadTimeout:       15 * time.Second,
	WriteTimeout:      30 * time.Second,
	IdleTimeout:       60 * time.Second,
	MaxHeaderBytes:    1 << 20,
}
```

### Graceful shutdown

```go
ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
defer stop()

go func() {
	if err := srv.ListenAndServe(); !errors.Is(err, http.ErrServerClosed) {
		log.Fatal(err)
	}
}()

<-ctx.Done()
shutdownCtx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
defer cancel()
if err := srv.Shutdown(shutdownCtx); err != nil {
	slog.Error("shutdown", "err", err)
}
```

`Shutdown` stops accepting, closes idle connections, and waits for active requests until the context expires. `ErrServerClosed` after `Shutdown` is expected, not a failure. On Windows, `syscall.SIGTERM` exists in the package but processes are not sent it by the OS; `os.Interrupt` (Ctrl-C) is the portable signal.

### The client has pitfalls too

`http.DefaultClient` has **no timeout**. Build your own `http.Client{Timeout: ...}`, reuse it (it pools connections), and always `defer resp.Body.Close()` and drain the body for connection reuse. Use `http.NewRequestWithContext`.

> [!GO] The Go 1.22 mux patterns require the `go` directive in `go.mod` to be 1.22 or later; with an older directive the new syntax is parsed with the old rules (set `GODEBUG=httpmuxgo121=1` to force the old behavior deliberately).

## Official documentation

- [official] [Tutorial: Developing a RESTful API with Go and Gin](https://go.dev/doc/tutorial/web-service-gin) — Optional; shows a third-party framework. The lesson itself uses only the standard library.
- [official] [Package net/http](https://pkg.go.dev/net/http) — Read the package overview, then `Handler`, `ServeMux` (the pattern syntax section, in full), `Server` fields, `ResponseWriter`, `Request`, `MaxBytesReader`, `NewResponseController`.
- [official] [Routing Enhancements for Go 1.22 (Go Blog)](https://go.dev/blog/routing-enhancements) — The design and examples of the new patterns.
- [official] [Package net/http/httptest](https://pkg.go.dev/net/http/httptest) — `NewRecorder`, `NewRequest`, `NewServer`; how you test handlers without a network.
- [official] [Package log/slog](https://pkg.go.dev/log/slog) — Structured logging in the standard library (Go 1.21+).
- [official] [Package encoding/json](https://pkg.go.dev/encoding/json) — `Decoder.DisallowUnknownFields`, `Decoder.Decode`, struct tags.
- [official] [Server.Shutdown documentation](https://pkg.go.dev/net/http#Server.Shutdown) — Exactly what it does and does not wait for.
- [official] [Package os/signal](https://pkg.go.dev/os/signal) — `NotifyContext` and platform notes.
- [supplementary] [The complete guide to Go net/http timeouts (Cloudflare)](https://blog.cloudflare.com/the-complete-guide-to-golang-net-http-timeouts/) — Still the clearest diagram of what each timeout covers. Note it predates some newer features.

## Practical examples

### A handler with validation, a body limit, and honest status codes

```go
type createReq struct {
	Text string `json:"text"`
}

func (s *Server) createMessage(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, 64<<10)
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()

	var req createReq
	if err := dec.Decode(&req); err != nil {
		var tooBig *http.MaxBytesError
		switch {
		case errors.As(err, &tooBig):
			writeJSON(w, http.StatusRequestEntityTooLarge, apiError{"body too large"})
		default:
			writeJSON(w, http.StatusBadRequest, apiError{"malformed JSON"})
		}
		return
	}
	if strings.TrimSpace(req.Text) == "" {
		writeJSON(w, http.StatusUnprocessableEntity, apiError{"text is required"})
		return
	}
	m, err := s.store.Save(r.Context(), req.Text)
	if err != nil {
		s.log.Error("save", "err", err)
		writeJSON(w, http.StatusInternalServerError, apiError{"internal error"})
		return
	}
	w.Header().Set("Location", "/messages/"+m.ID)
	writeJSON(w, http.StatusCreated, m)
}
```

### Testing the handler with no network

```go
func TestCreateMessage_Empty(t *testing.T) {
	srv := NewServer(newFakeStore())
	req := httptest.NewRequest("POST", "/messages", strings.NewReader(`{"text":"  "}`))
	rec := httptest.NewRecorder()

	srv.Routes().ServeHTTP(rec, req)

	if rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d, want 422", rec.Code)
	}
}
```

### Composing middleware

```go
handler := chain(mux, recoverer, requestID, logging) // outermost first or last: choose and document it
```

### Common mistakes

> [!PITFALL] **No timeouts.** `http.ListenAndServe(":8080", nil)` is fine for a demo and an outage in production.

> [!PITFALL] **Writing the header twice or too late.** Setting `Content-Type` after `Write` silently does nothing, and the `WriteHeader` after `Write` is ignored. Set headers first.

> [!PITFALL] **Ignoring `r.Context()`.** A handler that keeps computing after the client left burns CPU for no one. Pass the context into every database call and outbound request.

> [!PITFALL] **Decoding without limits.** `json.NewDecoder(r.Body).Decode(&x)` on an unbounded body is a memory exhaustion bug.

> [!PITFALL] **Shared mutable state in handler structs.** Handlers run concurrently. A map on your `Server` struct written by handlers needs a lock.

> [!PITFALL] **Leaking error details.** Do not write `err.Error()` into responses. Log the error with a request ID; return a generic message.

> [!PITFALL] **Goroutines spawned from handlers using `r.Context()`.** The context is cancelled when the handler returns, so background work that outlives the request must use its own context (use `context.WithoutCancel` to keep values).

## Hands-on exercises

### 1. Hello, with intent

Build a server with `GET /healthz` (200 and a small JSON body), `GET /hello/{name}` and `POST /hello`. Confirm with `curl -i` that `DELETE /hello` yields 405 with an `Allow` header and an unknown path yields 404, *without writing code for either*.

You are done when you can explain from the documentation which part of `ServeMux` produced each response.

### 2. Middleware chain

Write three middlewares: request ID (generate, store in context, set `X-Request-ID`), access logging with status and duration, and a panic recoverer. Compose them and prove ordering matters: show a case where wrong order loses the request ID in the panic log.

You are done when a test demonstrates each middleware and the ordering bug, and the status recorder still supports `Flush`.

### 3. A hardened JSON endpoint

Implement `POST /messages` with body size limit, `Content-Type` check, unknown-field rejection, trailing-garbage rejection (a second JSON value after the first), field validation, and distinct statuses for each failure. Table-drive the tests via `httptest`.

You are done when at least twelve cases pass, including a body one byte over the limit and an empty body.

### 4. Graceful shutdown you can see

Add a `GET /slow` handler that takes 10 seconds. Start a request, send SIGINT (Ctrl-C), and observe: the in-flight request completes, new connections are refused, and the process exits. Then set the shutdown timeout below 10 s and observe the difference. Explain what happens to the in-flight request in each case.

You are done when you can state exactly which connections `Shutdown` closes, and which timeout stops a slow client.

## Engineering challenge

**A small HTTP service that survives hostile and unlucky clients.** Using only the standard library, build a service with a handful of endpoints and verify with your own test client programs that it behaves under:

- A client that sends headers one byte per second.
- A client that declares `Content-Length: 1000000` but sends 10 bytes, then stalls.
- A client that sends a 100 MB body to a JSON endpoint.
- 2,000 concurrent slow readers of a large response.
- A client that disconnects mid-request while your handler is running a slow operation.
- A deploy: `SIGTERM` during a burst of traffic, with the requirement that **no request that was already accepted gets a connection reset**.

For each, write down the timeout or limit that protects you (and the field name), the observable behavior, and how you tested it. Constraints: a single process, no external proxy. Edge cases: what is the interplay between `WriteTimeout` and long streaming responses (how would you stream for 10 minutes?), and between `ReadTimeout` and a handler that needs a long upload.

## Knowledge check

### 1. Concurrency of handlers

Your handler appends to a package-level slice. It passes tests and fails in production with lost entries. Why?

>>>
`net/http` serves each connection (or stream) on its own goroutine, so handlers run concurrently. Unsynchronized appends to the same slice are a data race and lose or corrupt entries. Guard with a mutex, confine state to a single goroutine, or use a concurrency-safe structure. Tests with a single sequential client never exercise the race; use parallel tests and `-race`.

### 2. Header order

`w.Write([]byte("ok")); w.Header().Set("X-Foo", "1"); w.WriteHeader(201)` sends what?

>>>
The first `Write` implicitly sends status 200 and the headers as they were at that moment. The later `Header().Set` has no effect (the headers were already sent) and `WriteHeader(201)` is ignored, logging "superfluous response.WriteHeader call". The client sees `200 OK` with body `ok`. Set headers, then status, then write.

### 3. What does Shutdown wait for

After calling `srv.Shutdown(ctx)`, what happens to (a) idle keep-alive connections, (b) a request in progress, (c) a hijacked connection such as a WebSocket?

>>>
(a) Closed immediately. (b) Allowed to finish, up to the context's deadline; if the deadline passes `Shutdown` returns the context's error and active connections remain (you may then call `Close`). (c) Hijacked connections are not tracked by `Shutdown`: your code must close and wait for them itself, for example with `RegisterOnShutdown`.

### 4. Which timeout

A client uploads a large file on a slow link and your server returns a timeout. Which `http.Server` fields might be responsible, and how would you allow long uploads for one route only?

>>>
`ReadTimeout` covers reading the entire request including the body, and `ReadHeaderTimeout` covers reading headers; either may be exceeded by a slow upload. You can extend the deadline per request with `http.NewResponseController(w).SetReadDeadline(...)` (Go 1.20+) for that route, keeping strict defaults elsewhere, and still enforce a body size limit.

### 5. Context lifetime

A handler starts `go sendEmail(r.Context(), ...)` and returns 202. The email is sometimes not sent. Why?

>>>
The request context is cancelled when the handler returns (and the server finishes with the request). The goroutine's context is therefore cancelled and the send aborts. Use a context detached from the request's cancellation (`context.WithoutCancel(r.Context())` preserves values) with its own timeout, or hand the work to a queue with a worker whose lifecycle you manage.

### 6. 404 versus 405

A client calls `PUT /messages/7` and the server has only `GET /messages/{id}`. What does Go 1.22's mux return, and what extra header does it set?

>>>
`405 Method Not Allowed` with an `Allow` header listing the methods registered for that path (here `GET, HEAD`). A path that matches no pattern at all gets `404 Not Found`. This automatic distinction is part of the enhanced `ServeMux`.

## Mastery criteria

- I can build a routed server with the standard library alone, using Go 1.22 patterns and `PathValue`.
- I set explicit server timeouts and body limits and can explain what each protects against.
- I write middleware that composes and does not break optional interfaces such as `Flusher`.
- I order headers, status and body correctly and choose accurate status codes.
- I propagate the request context and avoid using it for work that must outlive the request.
- I implement and test graceful shutdown, and I test handlers with `httptest`.

## Further exploration

- Read the `net/http` server source to follow a request from `Serve` to your handler.
- Compare `ServeMux` with a third-party router and list exactly what you would gain.
- Implement `http.Flusher` streaming (Server-Sent Events) and handle slow consumers.
- Study HTTP/2 server push removal and what `Server.Protocols` (Go 1.24) enables.
- Next skills: *REST API design*, *Authentication*, *Observability*, *Rate limiting*.
