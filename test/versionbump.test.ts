import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { recommendVersionBump } from "../src/versionbump.js";

/**
 * All tests are pure local computation over inline inputs:
 * no filesystem, no network. Each behaviour in the spec is
 * pinned by its own case, including the four decision
 * rules, the reasons ordering and exact strings, the
 * patch/none reason singletons, and every validation path.
 */

const rec = (args: unknown) => recommendVersionBump(args);

describe("recommendVersionBump — major decisions", () => {
  it("bumps major for a breaking commit, resetting minor and patch", () => {
    const out = rec({
      current_version: "1.4.2",
      commits: [{ type: "fix", breaking: true }],
    });
    assert.deepEqual(out, {
      current_version: "1.4.2",
      next_version: "2.0.0",
      bump: "major",
      reasons: ['commit[0] of type "fix" is marked breaking'],
    });
  });

  it("bumps major for a removed API entry", () => {
    const out = rec({
      current_version: "0.9.9",
      commits: [],
      api_changes: [{ kind: "removed", name: "oldThing" }],
    });
    assert.equal(out.bump, "major");
    assert.equal(out.next_version, "1.0.0");
    assert.deepEqual(out.reasons, ['API entry "oldThing" was removed']);
  });

  it("bumps major for a changed API entry, with the incompatibly wording", () => {
    const out = rec({
      current_version: "2.3.4",
      commits: [{ type: "fix" }],
      api_changes: [{ kind: "changed", name: "parse" }],
    });
    assert.equal(out.bump, "major");
    assert.equal(out.next_version, "3.0.0");
    assert.deepEqual(out.reasons, ['API entry "parse" changed incompatibly']);
  });

  it("lets breaking win over feature signals present at the same time", () => {
    const out = rec({
      current_version: "1.0.0",
      commits: [{ type: "feat" }],
      api_changes: [
        { kind: "added", name: "newThing" },
        { kind: "removed", name: "oldThing" },
      ],
    });
    assert.equal(out.bump, "major");
    assert.equal(out.next_version, "2.0.0");
  });
});

describe("recommendVersionBump — minor decisions", () => {
  it("bumps minor for a feat commit, resetting patch", () => {
    const out = rec({
      current_version: "1.4.2",
      commits: [{ type: "feat" }],
    });
    assert.deepEqual(out, {
      current_version: "1.4.2",
      next_version: "1.5.0",
      bump: "minor",
      reasons: ['commit[0] is a feature ("feat")'],
    });
  });

  it("bumps minor for an added API entry, even with no commits", () => {
    const out = rec({
      current_version: "1.4.2",
      commits: [],
      api_changes: [{ kind: "added", name: "extra" }],
    });
    assert.equal(out.bump, "minor");
    assert.equal(out.next_version, "1.5.0");
    assert.deepEqual(out.reasons, ['API entry "extra" was added']);
  });

  it("treats an explicit breaking:false feat commit as a plain feature", () => {
    const out = rec({
      current_version: "3.0.1",
      commits: [{ type: "feat", breaking: false }],
    });
    assert.equal(out.bump, "minor");
    assert.equal(out.next_version, "3.1.0");
  });
});

describe("recommendVersionBump — patch and none decisions", () => {
  it("bumps patch when only patch-level commits are present", () => {
    const out = rec({
      current_version: "1.4.2",
      commits: [{ type: "fix" }, { type: "chore" }, { type: "docs" }],
    });
    assert.deepEqual(out, {
      current_version: "1.4.2",
      next_version: "1.4.3",
      bump: "patch",
      reasons: ["no breaking or feature signals; 3 commit(s) present"],
    });
  });

  it("uses the exact commit count in the patch singleton reason", () => {
    const out = rec({
      current_version: "0.0.0",
      commits: [{ type: "fix" }],
    });
    assert.equal(out.bump, "patch");
    assert.equal(out.next_version, "0.0.1");
    assert.deepEqual(out.reasons, [
      "no breaking or feature signals; 1 commit(s) present",
    ]);
  });

  it("bumps none when commits is empty and api_changes is absent", () => {
    const out = rec({ current_version: "2.0.5", commits: [] });
    assert.deepEqual(out, {
      current_version: "2.0.5",
      next_version: "2.0.5",
      bump: "none",
      reasons: ["no commits and no API changes supplied"],
    });
  });

  it("bumps none when commits and api_changes are both empty", () => {
    const out = rec({ current_version: "2.0.5", commits: [], api_changes: [] });
    assert.equal(out.bump, "none");
    assert.equal(out.next_version, "2.0.5");
    assert.deepEqual(out.reasons, ["no commits and no API changes supplied"]);
  });

  it("treats an absent api_changes exactly like an empty one", () => {
    const absent = rec({ current_version: "1.2.3", commits: [{ type: "fix" }] });
    const empty = rec({
      current_version: "1.2.3",
      commits: [{ type: "fix" }],
      api_changes: [],
    });
    assert.deepEqual(absent, empty);
  });
});

describe("recommendVersionBump — reasons ordering and completeness", () => {
  it("orders reasons: breaking commits, breaking api, feature commits, feature api — each in input order", () => {
    const out = rec({
      current_version: "1.0.0",
      commits: [
        { type: "feat" },
        { type: "refactor", breaking: true },
        { type: "feat", breaking: false },
        { type: "fix", breaking: true },
      ],
      api_changes: [
        { kind: "added", name: "addedFirst" },
        { kind: "changed", name: "changedThing" },
        { kind: "removed", name: "removedThing" },
        { kind: "added", name: "addedSecond" },
      ],
    });
    assert.equal(out.bump, "major");
    assert.deepEqual(out.reasons, [
      'commit[1] of type "refactor" is marked breaking',
      'commit[3] of type "fix" is marked breaking',
      'API entry "changedThing" changed incompatibly',
      'API entry "removedThing" was removed',
      'commit[0] is a feature ("feat")',
      'commit[2] is a feature ("feat")',
      'API entry "addedFirst" was added',
      'API entry "addedSecond" was added',
    ]);
  });

  it("lists feature signals even when a breaking signal decided a major bump", () => {
    const out = rec({
      current_version: "4.5.6",
      commits: [{ type: "feat" }],
      api_changes: [{ kind: "removed", name: "gone" }],
    });
    assert.equal(out.bump, "major");
    assert.deepEqual(out.reasons, [
      'API entry "gone" was removed',
      'commit[0] is a feature ("feat")',
    ]);
  });

  it("gives patch-level commits no individual reasons alongside real signals", () => {
    const out = rec({
      current_version: "1.0.0",
      commits: [{ type: "fix" }, { type: "feat" }, { type: "chore" }],
    });
    assert.equal(out.bump, "minor");
    assert.deepEqual(out.reasons, ['commit[1] is a feature ("feat")']);
  });

  it("pins the judgement call: a breaking feat commit is listed in both the breaking and feature groups", () => {
    // The spec defines BREAKING (breaking:true) and FEATURE
    // (type exactly "feat") independently, so one commit can
    // carry both signals; the evidence list is complete, so
    // it appears once in each group, in group order.
    const out = rec({
      current_version: "1.2.3",
      commits: [{ type: "feat", breaking: true }],
    });
    assert.equal(out.bump, "major");
    assert.equal(out.next_version, "2.0.0");
    assert.deepEqual(out.reasons, [
      'commit[0] of type "feat" is marked breaking',
      'commit[0] is a feature ("feat")',
    ]);
  });

  it("pins the judgement call: feature matching is case-sensitive, so Feat and FEAT are patch-level", () => {
    for (const type of ["Feat", "FEAT", "feat ", "feature"]) {
      const out = rec({ current_version: "1.0.0", commits: [{ type }] });
      assert.equal(out.bump, "patch", type);
    }
  });

  it("computes the next version per component: major from 0.x, minor carry, patch carry", () => {
    assert.equal(
      rec({ current_version: "0.0.0", commits: [{ type: "x", breaking: true }] })
        .next_version,
      "1.0.0",
    );
    assert.equal(
      rec({ current_version: "9.9.9", commits: [{ type: "feat" }] }).next_version,
      "9.10.0",
    );
    assert.equal(
      rec({ current_version: "9.9.9", commits: [{ type: "fix" }] }).next_version,
      "9.9.10",
    );
    assert.equal(
      rec({ current_version: "10.20.30", commits: [{ type: "feat" }] })
        .next_version,
      "10.21.0",
    );
  });
});

describe("recommendVersionBump — validation: current_version", () => {
  const msg = /current_version must be a valid semver "MAJOR\.MINOR\.PATCH" string/;

  it("rejects a missing, non-string, or empty current_version with the fixed message", () => {
    assert.throws(() => rec({ commits: [] }), msg);
    assert.throws(() => rec({ current_version: 142, commits: [] }), msg);
    assert.throws(() => rec({ current_version: "", commits: [] }), msg);
    assert.throws(() => rec(null), msg);
    assert.throws(() => rec("1.2.3"), msg);
  });

  it("rejects versions outside the strict grammar", () => {
    for (const v of [
      "1.4",
      "1.4.2.3",
      "v1.4.2",
      "1.4.2-alpha",
      "1.4.2+build",
      "01.4.2",
      "1.04.2",
      "1.4.02",
      "1..2",
      "a.b.c",
      "1.4.x",
      " 1.4.2",
      "1.4.2 ",
    ]) {
      assert.throws(
        () => rec({ current_version: v, commits: [] }),
        msg,
        v,
      );
    }
  });

  it("accepts zero components and multi-digit components", () => {
    assert.doesNotThrow(() => rec({ current_version: "0.0.0", commits: [] }));
    assert.doesNotThrow(() =>
      rec({ current_version: "123.456.789", commits: [] }),
    );
  });
});

describe("recommendVersionBump — validation: commits", () => {
  it("rejects missing or non-array commits, naming the path", () => {
    assert.throws(
      () => rec({ current_version: "1.0.0" }),
      /commits is required/,
    );
    assert.throws(
      () => rec({ current_version: "1.0.0", commits: "feat" }),
      /commits must be an array/,
    );
  });

  it("rejects a commit entry that is not an object, naming the path", () => {
    assert.throws(
      () => rec({ current_version: "1.0.0", commits: [42] }),
      /commits\[0\] must be an object/,
    );
    assert.throws(
      () => rec({ current_version: "1.0.0", commits: [{ type: "fix" }, null] }),
      /commits\[1\] must be an object/,
    );
    assert.throws(
      () => rec({ current_version: "1.0.0", commits: [["feat"]] }),
      /commits\[0\] must be an object/,
    );
  });

  it("rejects a missing, empty, or non-string commit type, naming the path", () => {
    assert.throws(
      () => rec({ current_version: "1.0.0", commits: [{}] }),
      /commits\[0\]\.type must be a non-empty string/,
    );
    assert.throws(
      () => rec({ current_version: "1.0.0", commits: [{ type: "fix" }, { type: "" }] }),
      /commits\[1\]\.type must be a non-empty string/,
    );
    assert.throws(
      () => rec({ current_version: "1.0.0", commits: [{ type: 7 }] }),
      /commits\[0\]\.type must be a non-empty string/,
    );
  });

  it("rejects a non-boolean breaking flag, naming the path", () => {
    assert.throws(
      () =>
        rec({
          current_version: "1.0.0",
          commits: [{ type: "fix", breaking: "yes" }],
        }),
      /commits\[0\]\.breaking must be a boolean/,
    );
    assert.throws(
      () =>
        rec({
          current_version: "1.0.0",
          commits: [{ type: "fix" }, { type: "fix", breaking: 1 }],
        }),
      /commits\[1\]\.breaking must be a boolean/,
    );
  });
});

describe("recommendVersionBump — validation: api_changes", () => {
  it("rejects a non-array api_changes, naming the path", () => {
    assert.throws(
      () => rec({ current_version: "1.0.0", commits: [], api_changes: "added" }),
      /api_changes must be an array/,
    );
  });

  it("rejects an api_change entry that is not an object, naming the path", () => {
    assert.throws(
      () => rec({ current_version: "1.0.0", commits: [], api_changes: ["x"] }),
      /api_changes\[0\] must be an object/,
    );
  });

  it("rejects a missing or unknown api_change kind, naming the path", () => {
    assert.throws(
      () => rec({ current_version: "1.0.0", commits: [], api_changes: [{ name: "x" }] }),
      /api_changes\[0\]\.kind must be one of "removed", "changed", "added"/,
    );
    assert.throws(
      () =>
        rec({
          current_version: "1.0.0",
          commits: [],
          api_changes: [
            { kind: "added", name: "ok" },
            { kind: "renamed", name: "x" },
          ],
        }),
      /api_changes\[1\]\.kind must be one of "removed", "changed", "added"/,
    );
    assert.throws(
      () =>
        rec({
          current_version: "1.0.0",
          commits: [],
          api_changes: [{ kind: "Added", name: "x" }],
        }),
      /api_changes\[0\]\.kind must be one of/,
    );
  });

  it("rejects a missing, empty, or non-string api_change name, naming the path", () => {
    assert.throws(
      () => rec({ current_version: "1.0.0", commits: [], api_changes: [{ kind: "added" }] }),
      /api_changes\[0\]\.name must be a non-empty string/,
    );
    assert.throws(
      () =>
        rec({
          current_version: "1.0.0",
          commits: [],
          api_changes: [{ kind: "removed", name: "" }],
        }),
      /api_changes\[0\]\.name must be a non-empty string/,
    );
    assert.throws(
      () =>
        rec({
          current_version: "1.0.0",
          commits: [],
          api_changes: [{ kind: "changed", name: 9 }],
        }),
      /api_changes\[0\]\.name must be a non-empty string/,
    );
  });

  it("produces no partial result when a later entry is invalid", () => {
    assert.throws(() =>
      rec({
        current_version: "1.0.0",
        commits: [{ type: "feat", breaking: true }],
        api_changes: [{ kind: "bogus", name: "x" }],
      }),
    );
  });
});
