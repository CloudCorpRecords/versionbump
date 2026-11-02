/**
 * versionbump core: recommend the next semantic version from
 * commit types and API surface changes.
 *
 *   recommendVersionBump(args) -> {current_version,
 *     next_version, bump, reasons}
 *
 * Signals:
 * - A commit is BREAKING when `breaking` is true. An
 *   api_change is BREAKING when its kind is "removed" or
 *   "changed", and a FEATURE when its kind is "added".
 * - A commit is a FEATURE when its type is exactly "feat"
 *   (case-sensitive). All other commits are patch-level
 *   signals. A commit can carry both signals at once (a
 *   `feat` commit marked breaking is both breaking and a
 *   feature, and is listed in both reason groups).
 *
 * Decision, first match wins:
 * 1. Any breaking commit or breaking api_change -> "major",
 *    next = (X+1).0.0.
 * 2. Else any feature commit or feature api_change ->
 *    "minor", next = X.(Y+1).0.
 * 3. Else, when commits is non-empty -> "patch",
 *    next = X.Y.(Z+1).
 * 4. Else (commits empty and api_changes empty or absent)
 *    -> "none", next = current_version, unchanged.
 *
 * Reasons list every signal, even when a stronger signal
 * decided the bump, in this fixed order: every
 * breaking-commit reason in input order, then every
 * breaking-api reason in input order, then every
 * feature-commit reason in input order, then every
 * feature-api reason in input order. When the bump is
 * "patch", reasons is exactly
 * [`no breaking or feature signals; <n> commit(s) present`];
 * when it is "none", reasons is exactly
 * [`no commits and no API changes supplied`].
 *
 * Validation is strict and path-naming: any malformed input
 * throws an Error naming the offending path (for example
 * "commits[1].type must be a non-empty string"; a bad
 * current version throws the spec's fixed message) and no
 * partial result is produced. Pure local computation: no
 * network, no file reads.
 */
import type {
  ApiChangeKind,
  VersionBumpApiChange,
  VersionBumpCommit,
  VersionBumpInput,
  VersionBumpResult,
} from "./types.js";

export const VERSION = "0.1.0";

const SEMVER_RE = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;

const API_KINDS: readonly string[] = ["removed", "changed", "added"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateCurrentVersion(value: unknown): string {
  if (typeof value !== "string" || !SEMVER_RE.test(value)) {
    throw new Error(
      'current_version must be a valid semver "MAJOR.MINOR.PATCH" string',
    );
  }
  return value;
}

function validateCommits(value: unknown): VersionBumpCommit[] {
  if (value === undefined) throw new Error("commits is required");
  if (!Array.isArray(value)) throw new Error("commits must be an array");
  return value.map((raw, i) => {
    const path = `commits[${i}]`;
    if (!isRecord(raw)) throw new Error(`${path} must be an object`);
    if (typeof raw.type !== "string" || raw.type.length === 0) {
      throw new Error(`${path}.type must be a non-empty string`);
    }
    if (raw.breaking !== undefined && typeof raw.breaking !== "boolean") {
      throw new Error(`${path}.breaking must be a boolean`);
    }
    return { type: raw.type, breaking: raw.breaking === true };
  });
}

function validateApiChanges(value: unknown): VersionBumpApiChange[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error("api_changes must be an array");
  return value.map((raw, i) => {
    const path = `api_changes[${i}]`;
    if (!isRecord(raw)) throw new Error(`${path} must be an object`);
    if (typeof raw.kind !== "string" || !API_KINDS.includes(raw.kind)) {
      throw new Error(
        `${path}.kind must be one of "removed", "changed", "added"`,
      );
    }
    if (typeof raw.name !== "string" || raw.name.length === 0) {
      throw new Error(`${path}.name must be a non-empty string`);
    }
    return { kind: raw.kind as ApiChangeKind, name: raw.name };
  });
}

function validateInput(args: unknown): VersionBumpInput {
  const raw: Record<string, unknown> = isRecord(args) ? args : {};
  return {
    current_version: validateCurrentVersion(raw.current_version),
    commits: validateCommits(raw.commits),
    api_changes: validateApiChanges(raw.api_changes),
  };
}

/** Recommend the next semantic version from the supplied evidence. */
export function recommendVersionBump(args: unknown): VersionBumpResult {
  const input = validateInput(args);
  const { current_version, commits, api_changes } = input;

  const match = SEMVER_RE.exec(current_version) as RegExpExecArray;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);

  const breakingCommitReasons: string[] = [];
  const breakingApiReasons: string[] = [];
  const featureCommitReasons: string[] = [];
  const featureApiReasons: string[] = [];

  commits.forEach((commit, i) => {
    if (commit.breaking) {
      breakingCommitReasons.push(
        `commit[${i}] of type "${commit.type}" is marked breaking`,
      );
    }
    if (commit.type === "feat") {
      featureCommitReasons.push(`commit[${i}] is a feature ("feat")`);
    }
  });
  api_changes.forEach((change, i) => {
    void i;
    if (change.kind === "removed") {
      breakingApiReasons.push(`API entry "${change.name}" was removed`);
    } else if (change.kind === "changed") {
      breakingApiReasons.push(
        `API entry "${change.name}" changed incompatibly`,
      );
    } else {
      featureApiReasons.push(`API entry "${change.name}" was added`);
    }
  });

  const hasBreaking = breakingCommitReasons.length + breakingApiReasons.length > 0;
  const hasFeature = featureCommitReasons.length + featureApiReasons.length > 0;

  if (hasBreaking) {
    return {
      current_version,
      next_version: `${major + 1}.0.0`,
      bump: "major",
      reasons: [
        ...breakingCommitReasons,
        ...breakingApiReasons,
        ...featureCommitReasons,
        ...featureApiReasons,
      ],
    };
  }
  if (hasFeature) {
    return {
      current_version,
      next_version: `${major}.${minor + 1}.0`,
      bump: "minor",
      reasons: [
        ...breakingCommitReasons,
        ...breakingApiReasons,
        ...featureCommitReasons,
        ...featureApiReasons,
      ],
    };
  }
  if (commits.length > 0) {
    return {
      current_version,
      next_version: `${major}.${minor}.${patch + 1}`,
      bump: "patch",
      reasons: [
        `no breaking or feature signals; ${commits.length} commit(s) present`,
      ],
    };
  }
  return {
    current_version,
    next_version: current_version,
    bump: "none",
    reasons: ["no commits and no API changes supplied"],
  };
}

/** Render a payload as the JSON text block MCP clients show. */
export function formatPayload(payload: unknown): string {
  return typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
}
