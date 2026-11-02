/**
 * versionbump types.
 *
 * versionbump recommends the next semantic version from the
 * evidence supplied by the caller — the commits since the
 * current version and the public API surface changes since
 * the current version — as pure local computation:
 *
 *   - a commit marked breaking, or an API entry removed or
 *     changed incompatibly, is a BREAKING signal
 *   - a `feat` commit, or an API entry added, is a FEATURE
 *     signal
 *   - every other commit is a patch-level signal
 *
 * The first matching rule decides the bump: any breaking
 * signal -> major, else any feature signal -> minor, else
 * any commits at all -> patch, else -> none. The result
 * lists every breaking and feature signal as a reason, in a
 * fixed order, so the recommendation is evidence, not
 * guesswork. Nothing is fetched or read: the recommendation
 * comes only from the inputs supplied.
 */

/** Level of the recommended bump. */
export type BumpLevel = "major" | "minor" | "patch" | "none";

/** One commit since the current version, as supplied. */
export interface VersionBumpCommit {
  /** Conventional-commit type, e.g. "feat", "fix", "chore". */
  type: string;
  /** True when the commit is marked breaking. Defaults to false. */
  breaking: boolean;
}

/** The kind of a public API surface change. */
export type ApiChangeKind = "removed" | "changed" | "added";

/** One public API surface change since the current version. */
export interface VersionBumpApiChange {
  /** "removed" or "changed" are breaking; "added" is a feature. */
  kind: ApiChangeKind;
  /** Name of the API entry that changed. */
  name: string;
}

/** The full arguments object for a recommendation. */
export interface VersionBumpInput {
  /** Current version, strict MAJOR.MINOR.PATCH semver. */
  current_version: string;
  /** Commits since the current version (may be empty). */
  commits: VersionBumpCommit[];
  /** API surface changes since the current version. Defaults to []. */
  api_changes: VersionBumpApiChange[];
}

/** The recommended next version and the evidence for it. */
export interface VersionBumpResult {
  /** The current version, as supplied. */
  current_version: string;
  /** The recommended next version (unchanged when bump is "none"). */
  next_version: string;
  /** The bump level chosen. */
  bump: BumpLevel;
  /** The evidence for the bump, as strings, in the spec's fixed order. */
  reasons: string[];
}
