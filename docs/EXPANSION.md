# Expanding the curriculum

## Turn an outline into a full lesson
1. Copy `content/nodes/a-errors.md` to `content/nodes/<node-id>.md` as a template.
2. Write all ten sections: at least 4 exercises, 6 knowledge questions, 6 criteria, and an engineering challenge with real constraints and edge cases.
3. In `data/nodes.js` pass `{ ex, q, cr }` as the node's last argument.
4. `node scripts/validate.mjs` must print OK, then run `node scripts/check-links.mjs --anchors`.
5. Do the exercises yourself before publishing.

## Add a new skill
Add an `N(...)` entry with a unique id prefixed by its branch letter, real prerequisites (essential vs recommended), and at least two official doc links. The tree layout is automatic.

## Suggested next lessons
`a-toolchain`, `a-types`, `c-json`, `d-sql-basics`, `d-go-sql`, `d-transactions`, `f-authn`, `c-middleware`, `g-observability`, `h-docker`.

## Quality bar
Technical accuracy first; cite the exact doc section; state the Go version; check any claim you would hesitate to defend against the source.
