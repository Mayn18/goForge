# How GoForge works

GoForge is a self-paced curriculum for becoming a Go backend engineer who can design, build, debug, test and deploy a service **without a tutorial in hand**. It is built around one belief: you learn engineering by reading primary sources, making decisions, and being wrong in a place where it is cheap.

> [!NOTE] Everything runs in your browser. Progress, notes and answers live in `localStorage` under the key `goforge:v1`. There are no accounts. Use **Export** on the dashboard to back up or move your progress.

## The loop

1. **Diagnostic.** Take it once. Skills you answer fully correctly start as *Practiced*; everything else is queued under *Revisit*. Retake it any time.
2. **Pick a skill** from the tree. Locked skills are not forbidden: *locked* means an essential prerequisite is not yet practiced. You can explore ahead, and the page tells you what you are missing.
3. **Work the lesson top to bottom.** Read the overview, try to predict before you read the explanation, read the *exact* documentation sections linked, then do the exercises.
4. **Write the code yourself.** Exercises never include full solutions. They say what must be true, never how to type it.
5. **Check yourself honestly.** The knowledge check asks you to write an answer *before* revealing ours, then self-grade. Missed questions come back on the dashboard.
6. **Claim mastery** only when every gate passes (see below).
7. **Apply it** in a standalone project or a Beep-Bot stage. A skill is not real until you have used it somewhere it can fail.

## Statuses

| Status | Meaning |
|---|---|
| Locked | An essential prerequisite is not yet practiced. Still readable. |
| Available | Prerequisites met, nothing recorded yet. |
| In progress | You have recorded anything: an exercise, a note, an answer. |
| Practiced | Every exercise done (or credited by the diagnostic, or self-attested for outlines). |
| Mastered | You claimed it after passing every gate. |

Status is **derived from what you did**, not toggled. The one self-attested path is outline nodes, which have no graded material yet.

## Mastery gates (full lessons)

- Every exercise completed.
- The engineering challenge completed.
- Every knowledge-check question answered, and at least 80% self-graded as correct.
- Every mastery criterion confirmed.
- A teach-back of 40+ words in your own words.

No gate can be satisfied by reading alone. The teach-back is the one that matters most: if you cannot explain it, you do not own it.

## Full lessons versus outlines

Some skills have a full ten-section lesson. The rest are **outlines**: they are in the tree so you can see the whole map and the prerequisite structure, and they carry official documentation to start from, but they do not yet have graded exercises. The dashboard shows exactly how many of each exist. Outlines never reach Mastered.

## The ten sections of a lesson

1. **Overview**: why this matters in a backend.
2. **Prerequisites**: what to know first, split into essential and recommended.
3. **How it works**: the mechanism, not just the syntax.
4. **Official documentation**: exact sections to read, what to look for, and terminology.
5. **Practical examples**: worked code, with the mistakes people actually make.
6. **Hands-on exercises**: at least three, in increasing difficulty.
7. **Engineering challenge**: constraints and edge cases, no recipe.
8. **Knowledge check**: reasoning questions, not trivia.
9. **Mastery criteria**: observable abilities.
10. **Further exploration**: where to go next.

## Difficulty levels

1 Foundational · 2 Independent implementation · 3 Integration and problem-solving · 4 Engineering-level · 5 Advanced systems thinking.

## Projects and the capstone

**Projects** are small standalone systems with requirements, constraints, milestones and testable acceptance criteria. Some are guided, some are open-ended.

**Beep-Bot** is the capstone: the pixel-art chat frontend you already have, waiting for a backend you build in stages. GoForge gives you the destination and the checks, never the implementation. The bot stays deterministic until the final stage, so every behavior is testable.

## Documentation first

Every lesson links exact sections of official documentation and marks each link as **official** or **supplementary**. Go version assumed: **1.22 or newer**, noted where a feature needs a later release. When documentation and a blog post disagree, the documentation wins; when the documentation is silent, run an experiment and write down what you saw.

## Windows, macOS and Linux

Commands are shown for a POSIX shell. Where Windows differs, the lesson says so. In PowerShell, set an environment variable for one command with `$env:GOOS="linux"; go build ./...`; in `cmd.exe` use `set GOOS=linux && go build ./...`.

## Keyboard

`/` or `Ctrl/⌘+K` opens search. The skill tree is fully keyboard-navigable, and a plain **List** view of every skill is available from the tree page.

## Running it

Serve the folder over HTTP (ES modules do not load from `file://`): `python3 -m http.server 8080` or `npx serve`, then open `http://localhost:8080`.
