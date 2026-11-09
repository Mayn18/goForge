# GoForge

A self-paced learning system for becoming a Go backend engineer who can design, build, debug, test and deploy a production service **independently**. It is an interactive skill tree with graded checks, standalone projects, a diagnostic assessment, and a capstone: the backend for your own Beep-Bot frontend, which **you** write.

No accounts, no server, no build step, no dependencies. Progress lives in your browser's `localStorage` (export/import from the dashboard).

## Run it

ES modules do not load from `file://`, so serve the folder:

```bash
python3 -m http.server 8080      # macOS / Linux
py -m http.server 8080           # Windows (Python launcher)
npx serve .                      # any OS with Node
```

Open <http://localhost:8080>. It also works on any static host (for GitHub Pages, publish the repository root).

## What is here, honestly

| | Count | State |
|---|---|---|
| Skills in the tree | 85 across 9 branches | all mapped, with prerequisites and levels 1-5 |
| **Full lessons** (10 sections, graded) | **10** | Modules, Slices & maps, Structs & pointers, Interfaces & generics, Errors, Goroutines & channels, sync & context, HTTP lifecycle, net/http, Testing |
| Outline skills | 75 | documentation links + self-attested progress; **cannot reach Mastered** |
| Diagnostic questions | 22 | with explanations |
| Standalone projects | 12 | requirements, constraints, milestones, acceptance checks |
| Beep-Bot capstone stages | 15 | goals and checks only, never implementations |

Outlines are a deliberate choice over padding the tree with hollow lessons. See [docs/EXPANSION.md](docs/EXPANSION.md) for how an outline becomes a lesson.

**Verification status.** Content targets Go 1.22+ (later features are flagged). Documentation URLs were written from knowledge of the official sites and have **not** been machine-verified from the authoring environment, which could not reach them. Run `npm run check-links` (or `node scripts/check-links.mjs --anchors`) on your machine and fix any that moved.

## How it works

- **Statuses** (Locked / Available / In progress / Practiced / Mastered) are *derived* from recorded work. Locked means an *essential* prerequisite is unmet and never blocks reading.
- **Mastery** requires all exercises, the engineering challenge, ≥80% self-graded knowledge check, every criterion, and a 40-word teach-back, then an explicit claim.
- **Lessons** are Markdown in `content/nodes/`, rendered by a small in-repo renderer (`js/md.js`). `scripts/validate.mjs` enforces the ten required sections.
- **Skill tree**: layered layout generated from the prerequisite graph, pan/zoom/pinch, branch focus, keyboard navigation, plus an accessible List view.

See [docs/CURRICULUM.md](docs/CURRICULUM.md) for architecture and `content/guide.md` (the in-app **Guide**) for how to study with it.

## Layout

```
index.html               app shell
css/style.css            dark/light themes
js/                      router, store, progress rules, tree, markdown, views/
data/                    nodes, branches, diagnostic, projects, capstone, refs
content/nodes/*.md       full lessons
content/guide.md         in-app guide
scripts/validate.mjs     curriculum integrity checks
scripts/check-links.mjs  documentation URL checker (needs network)
docs/                    architecture and expansion guides
```

## Develop

```bash
node scripts/validate.mjs     # must print OK before you commit
```

## License

MIT.
