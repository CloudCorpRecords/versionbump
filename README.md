# versionbump

Choosing the next version number is usually a judgement call
made from memory: "this feels like a minor". versionbump makes
it a computation instead. You give it the current version, the
commits since that version, and the public API surface changes
since that version, and it applies the semantic-versioning
rules mechanically — then lists the evidence for the level it
chose, so anyone can check its work:

- **Major** — a commit is marked breaking, or an API entry was
  removed or changed incompatibly. The next version is
  `(X+1).0.0`.
- **Minor** — no breaking signal, but a `feat` commit landed or
  an API entry was added. The next version is `X.(Y+1).0`.
- **Patch** — no breaking or feature signal, but there are
  commits. The next version is `X.Y.(Z+1)`.
- **None** — no commits and no API changes at all. The next
  version is the current version, unchanged.

The first matching rule wins, but the evidence is complete,
not just the winner: `reasons` lists every breaking commit,
every breaking API change, every feature commit, and every
added API entry, in that fixed order, each group in input
order. A patch bump carries the single reason
`no breaking or feature signals; <n> commit(s) present`, and
a none bump carries `no commits and no API changes supplied`.

Feature detection is exact: a commit is a feature only when
its type is precisely `feat` (case-sensitive); every other
commit type is patch-level unless it is marked breaking. The
current version must be strict `MAJOR.MINOR.PATCH` semver —
no prerelease or build suffix. Malformed input — a bad
version string, a commit without a type, an API change with
an unknown kind — is a validation error naming the offending
path (for example `commits[1].type must be a non-empty
string`), and no partial recommendation is produced. The
computation is pure and local: no network, no configuration,
no files read beyond the input you pass in.

## CLI

```bash
npx @reneturcios/versionbump recommend --input args.json
npx @reneturcios/versionbump --version
```

`args.json` contains the full arguments object:

```json
{
  "current_version": "1.4.2",
  "commits": [
    { "type": "feat" },
    { "type": "fix", "breaking": true }
  ],
  "api_changes": [
    { "kind": "added", "name": "exportReport" }
  ]
}
```

`breaking` defaults to `false` per commit and `api_changes`
defaults to `[]`. The recommendation is printed as JSON:

```json
{
  "current_version": "1.4.2",
  "next_version": "2.0.0",
  "bump": "major",
  "reasons": [
    "commit[1] of type \"fix\" is marked breaking",
    "commit[0] is a feature (\"feat\")",
    "API entry \"exportReport\" was added"
  ]
}
```

Exit codes: `0` on success, `1` on a runtime error (including
an unreadable or invalid input file, or invalid input), `2`
on a usage error.

## MCP server

```bash
npx -y @reneturcios/versionbump mcp
```

MCP client config:

```json
{
  "mcpServers": {
    "versionbump": {
      "command": "npx",
      "args": ["-y", "@reneturcios/versionbump", "mcp"]
    }
  }
}
```

### Tools

- `recommend_version_bump` — Recommend the next semantic
  version from commit types and API surface changes, listing
  the evidence for the bump level chosen.
  - `current_version` (string, required) — strict
    `MAJOR.MINOR.PATCH` semver, e.g. `"1.4.2"`
  - `commits` (array, required, may be empty) — commits as
    `{type, breaking?}` objects; `type` is the
    conventional-commit type and `breaking` defaults to
    `false`
  - `api_changes` (array, optional, default `[]`) — API
    changes as `{kind, name}` objects, where `kind` is one
    of `"removed"`, `"changed"`, `"added"`

  Returns `{current_version, next_version, bump, reasons}`.

## Docker

```bash
docker run -i ghcr.io/cloudcorprecords/versionbump
docker run --rm -v "$PWD:/w" ghcr.io/cloudcorprecords/versionbump recommend --input /w/args.json
```

## Development

```bash
npm install
npm run build   # tsc -> dist/
npm test        # tsx --test test/*.test.ts (pure local, no network)
npm run dev     # run the CLI from source
```

## License

MIT — Copyright (c) 2026 Rene Turcios
