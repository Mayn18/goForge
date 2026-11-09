# Architecture and curriculum design

## Principles
1. **Documentation first.** Every lesson links exact sections of official docs, labelled *official* or *supplementary*.
2. **Demonstrated, not declared.** Status is derived from activity; mastery has gates.
3. **No solutions.** Exercises state what must be true; challenges leave design to the learner.
4. **Honest scope.** Full lessons and outlines are distinguished everywhere in the UI.
5. **No infrastructure.** Static files plus `localStorage` (key `goforge:v1`).

## Data model
- `data/nodes.js`: `N(id, branch, title, level, essential[], recommended[], summary, docs[], full?)`. `full: {ex, q, cr}` must equal the counts in the lesson file (the validator enforces this).
- `data/projects.js`, `data/capstone.js`, `data/diagnostic.js`, `data/refs.js`.
- Learner state (`js/store.js`): per node `{opened, ex{n}, ch, quiz{n:'ok'|'miss'}, cr{n}, notes, teach, mastered, selfCovered, started, seed}`; per project/stage checklists; diagnostic result; history.

## Progress rules (`js/progress.js`)
- *Practiced*: all exercises done (full lessons), self-attested (outlines), or credited by the diagnostic (`seed`).
- *Mastered*: full lessons only, after every gate passes and the learner claims it.
- *Locked*: an essential prerequisite is not Practiced/Mastered and nothing is recorded here.

## Lesson file format
Front matter (`title`, `go`, `time`), then exactly ten `##` sections in order: Overview, Prerequisites, How it works, Official documentation, Practical examples, Hands-on exercises, Engineering challenge, Knowledge check, Mastery criteria, Further exploration.
- Doc lines: `- [official|supplementary] [Title](https://…) — why`.
- Exercises and questions are `###` items. A question's answer follows a line containing only `>>>`.
- Criteria are a bullet list. Callouts: `> [!PITFALL|TIP|NOTE|GO] text`. Diagrams: fenced blocks tagged `diagram`.

## Difficulty
1 Foundational · 2 Independent implementation · 3 Integration · 4 Engineering-level · 5 Advanced systems thinking.
