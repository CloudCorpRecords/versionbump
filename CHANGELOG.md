# Changelog

## 0.1.0 (2026-10-27)

- Initial release: `recommend_version_bump` MCP tool and
  `recommend` CLI command recommending the next semantic
  version from commit types and API surface changes.
- Decision in first-match order: any breaking commit or
  breaking API change (`removed` / `changed`) forces a major
  bump; any feature commit (`feat`) or added API entry forces
  a minor bump; any other commits force a patch bump; and no
  commits and no API changes means no bump.
- Every recommendation carries its evidence: `reasons` lists
  every breaking and feature signal in a fixed order, with
  singleton reasons for the patch and none outcomes.
- Path-naming validation errors for a malformed current
  version, commit list, or API change list, with no partial
  result on invalid input.
