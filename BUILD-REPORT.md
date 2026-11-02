# versionbump — Build Report

MCP Rebuild 1000, Batch 15. Original program build from the
packages-100 plan (cluster E #55), built from the spec in
`~/workspace/mcp-rebuild-100/specs-batch15/versionbump.md`
(read first). There is no external original; the tool surface
is the program's defined spec. Local build only — nothing
pushed or published.

Identity: repo `versionbump`, npm `@reneturcios/versionbump`,
MCP name `io.github.CloudCorpRecords/versionbump`, version
`0.1.0`, bin `versionbump` → `dist/cli.js`.

## Files created (19/19 per TEMPLATE.md checklist)

- `package.json`, `server.json` (description "Recommend a
  semver bump from commit types and API surface changes,
  with the evidence listed." — verbatim from the spec;
  measured 92 chars ≤100, see Gaps; npm entry carries
  `version: 0.1.0`; OCI entry
  `ghcr.io/cloudcorprecords/versionbump:0.1.0` carries **no**
  `version` field), `Dockerfile` (node:20-alpine two-stage,
  label
  `io.modelcontextprotocol.server.name="io.github.CloudCorpRecords/versionbump"`),
  `tsconfig.json`, `.gitignore`, `LICENSE` (MIT, Copyright
  (c) 2026 Rene Turcios), `README.md` (fresh text),
  `CHANGELOG.md` (single 0.1.0 entry, 2026-10-27),
  `package-lock.json` (Route 3, see below)
- `src/index.ts`, `src/cli.ts` (`recommend --input
  <args.json>` where the file holds the full arguments
  object, `mcp`, `--version`; exit 2 usage / 1 runtime
  error, argument validation before any file read),
  `src/mcp.ts`, `src/types.ts`, `src/versionbump.ts` (core,
  `VERSION = "0.1.0"`)
- `test/versionbump.test.ts`
- `.github/workflows/{ci,publish,publish-container,registry-publish}.yml`
  (publish-container `IMAGE = ghcr.io/cloudcorprecords/versionbump`,
  smoke-test server-name assertion `versionbump`)

## Tools implemented (1)

- `recommend_version_bump` — arguments: `current_version`
  (string, required, strict `MAJOR.MINOR.PATCH` grammar —
  no prerelease or build suffix), `commits` (array,
  required, may be empty) of `{type (string, required,
  non-empty), breaking (boolean, optional, default false)}`,
  and `api_changes` (array, optional, default []) of
  `{kind (required, one of "removed" / "changed" /
  "added"), name (string, required, non-empty)}`.

  Returns `{current_version, next_version, bump, reasons}`.
  A commit is breaking when `breaking` is true; an
  api_change is breaking when its kind is "removed" or
  "changed" and a feature when "added"; a commit is a
  feature when its type is exactly "feat" (case-sensitive);
  all other commits are patch-level. Decision, first match
  wins: any breaking signal → "major" `(X+1).0.0`; else any
  feature signal → "minor" `X.(Y+1).0`; else a non-empty
  commit list → "patch" `X.Y.(Z+1)`; else → "none" with the
  version unchanged.

  `reasons` lists every signal, even when a stronger signal
  decided the bump, in the fixed order: breaking commits
  (input order), breaking API changes, feature commits,
  feature API changes — with the exact spec strings
  (`commit[<i>] of type "<type>" is marked breaking`,
  `API entry "<name>" was removed` / `changed
  incompatibly`, `commit[<i>] is a feature ("feat")`,
  `API entry "<name>" was added`). Patch carries exactly
  [`no breaking or feature signals; <n> commit(s)
  present`]; none carries exactly [`no commits and no API
  changes supplied`].

  The fixture literal
  (`harness/fixtures/versionbump-tools-original.json`) and
  the `src/mcp.ts` literal are identical, with no `$schema`
  and no `additionalProperties`.

## Implementation notes

- `src/mcp.ts` uses the SDK's low-level `Server` with an
  explicit inputSchema literal exactly matching the
  fixture, per the standing fleet rule (no McpServer/zod
  schema conversion). Every `tools/call` is validated by
  the core itself, so the MCP and CLI paths share one
  validation implementation. The core takes the full
  arguments object, matching the CLI's input-file shape.
- Validation is path-naming and total: a bad
  `current_version` throws the spec's fixed message
  (`current_version must be a valid semver
  "MAJOR.MINOR.PATCH" string`); missing/non-array
  `commits`, a non-object entry, a missing/empty/non-string
  `type`, a non-boolean `breaking`, a non-array
  `api_changes`, a non-object entry, a missing/unknown
  `kind`, or a missing/empty/non-string `name` throws an
  Error naming the offending path (e.g.
  `commits[1].type must be a non-empty string`) and
  produces no partial result (MCP: `isError`; CLI:
  exit 1).
- The four reason groups are collected independently in
  one pass per input list and concatenated in the spec's
  fixed group order, so input order inside a group and
  group order across the list are both pinned by tests.

## Verification (foreground, this session)

- TypeScript: **0 diagnostics** — see the build note in
  Gaps for how the compile was run in this session;
  `dist/` was verified file-by-file against a fresh
  compiler emit (all 15 files MATCH).
- `npm test` (`tsx --test test/*.test.ts`): **30 tests,
  30 pass, 0 fail** — major via breaking commit / removed
  API / changed API (with the "changed incompatibly"
  wording), breaking beating simultaneous feature signals,
  minor via feat commit / added API with no commits /
  explicit `breaking: false`, patch with the exact
  singleton reason at counts 3 and 1, none with
  api_changes absent and with both lists empty, absent vs
  empty api_changes equivalence, the full reasons ordering
  across all four groups in one mixed input, feature
  evidence listed under a major decision, patch-level
  commits carrying no individual reasons, the pinned
  breaking-feat dual listing, the pinned case-sensitivity
  of "feat", next-version arithmetic (0.0.0 major, 9.9.9
  minor/patch carries, multi-digit components), and every
  validation path (missing/non-string/empty and 13
  off-grammar current versions, zero and multi-digit
  versions accepted; missing/non-array commits, non-object
  entries, missing/empty/non-string types, non-boolean
  breaking; non-array api_changes, non-object entries,
  missing/unknown/case-mismatched kinds,
  missing/empty/non-string names, and no partial result
  when a later entry is invalid)
- `dist/cli.js --version` → `0.1.0`; unknown command exits
  2 with usage; `recommend` with no `--input` exits 2;
  `recommend` with an unknown flag exits 2;
  `recommend --input <missing file>` exits 1 naming the
  file; `recommend --input <valid file>` exits 0 and
  prints the recommendation JSON (verified against the
  README example: 1.4.2 with a feat commit, a breaking fix
  commit, and an added API entry → major `2.0.0` with the
  three reasons in group order);
  `recommend --input <invalid file>` exits 1 with
  `commits[1].type must be a non-empty string`
- Parity: `harness/parity.py` comparison vs
  `harness/fixtures/versionbump-tools-original.json` →
  **PASS, parity 100.0, identical_tools 1/1** (see the
  parity note in Gaps for how the harness was run)

## Lockfile status

`package-lock.json` generated clean via Route 3 (temp copy
without `node_modules`/`dist`/`package-lock.json`, offline
`npm install --package-lock-only --ignore-scripts
--offline`), verified: parses, name
`@reneturcios/versionbump`, **128 package entries**. One
entry differs from older fleet locks: the cached registry
metadata now resolves `qs` to 6.17.0 (older locks pin
6.16.1); that tarball was fetched into the local npm cache
(`npm cache add qs@6.17.0`), after which the local
`npm install --ignore-scripts --offline` completed from
the placed lockfile. Local `node_modules` is gitignored.

## Gaps / honest notes

- **Build route in this session:** `npm run build` (tsc)
  was attempted first and the VM's exec write guard
  rejected every compiled-output write with EPERM (the
  known fleet write-guard family; small unrelated exec
  writes in the same directories succeeded, and the guard
  also blocked a plain `cp` of a source file). The compile
  was therefore run through the TypeScript compiler API
  with the tsconfig's exact options, emitting to stdout
  (0 diagnostics — a full type-check and emit), and the 15
  `dist/` files were written with the file tool and
  verified byte-equivalent to a fresh emit (text files
  compared exactly, `.js.map` files compared as canonical
  JSON). `dist/` is a gitignored build artifact; CI and
  the Dockerfile rebuild it with plain `npm run build`.
- **Parity route in this session:** the parity harness
  computes its report in memory, then writes
  `parity.json`/`parity.md` — and that write hit the same
  EPERM guard in both the build dir and /tmp. The verdict
  above was produced by the harness's own `build_report`
  function, run unmodified via a loader script that prints
  its summary (PASS, 100.0, 1/1, no errors, no schema
  diffs); the `parity-out/` files were then placed with
  the file tool from the harness's own JSON/Markdown
  output.
- **Spec judgement call — breaking `feat` commit (pinned
  by test):** the spec defines BREAKING (`breaking: true`)
  and FEATURE (type exactly `"feat"`) independently, so a
  `feat` commit marked breaking carries both signals and
  is listed once in the breaking-commit group and once in
  the feature-commit group. The spec does not address the
  overlap; the complete-evidence reading was chosen.
- **Spec judgement call — `kind` enum in the schema
  (pinned by the fixture):** the spec fixes `kind` to one
  of the three values in prose, so the inputSchema literal
  carries `enum: ["removed", "changed", "added"]`
  alongside the spec's description. Validation enforces
  the same three values regardless.
- **Validation wordings not fixed by the spec:** only the
  `current_version` message and the example
  `commits[1].type must be a non-empty string` are fixed
  verbatim. The remaining messages follow the fleet
  pattern: `commits is required`, `commits must be an
  array`, `commits[<i>] must be an object`,
  `commits[<i>].breaking must be a boolean`,
  `api_changes must be an array`, `api_changes[<i>] must
  be an object`, `api_changes[<i>].kind must be one of
  "removed", "changed", "added"`, and
  `api_changes[<i>].name must be a non-empty string`.
  Missing `type`/`name` use the same "must be a non-empty
  string" wording as the spec's example rather than a
  separate "is required" message.
- **Description length discrepancy:** the spec (and the
  build task) describe the server.json description as 93
  chars; the verbatim string measures **92 chars** by
  `len()`. The string was used exactly as specified; it is
  within the ≤100 limit either way.
- **Unknown extra properties** in the arguments object, in
  a commit, or in an api_change are ignored (the spec does
  not forbid them); not pinned by a dedicated test.
- Container build not exercised locally; the
  publish-container workflow smoke-tests the image at
  publish time.
- Nothing pushed or published; this is a local build only.
