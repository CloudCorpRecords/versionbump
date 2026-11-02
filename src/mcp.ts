/**
 * versionbump MCP server. Tools: recommend_version_bump.
 *
 * Why the low-level Server instead of McpServer: the high-level
 * helper converts zod schemas to JSON Schema and injects keys
 * not in this tool's defined spec ("$schema" and
 * "additionalProperties"), which breaks exact tool-list/schema
 * parity with the spec. This file serves tools/list with the
 * spec's exact input schema as an explicit literal, and every
 * tools/call is validated by the core, which names the
 * offending path on invalid input.
 *
 * The recommendation is pure local computation: no upstream
 * API, no authentication, no configuration.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { formatPayload, recommendVersionBump, VERSION } from "./versionbump.js";

const TOOLS = [
  {
    name: "recommend_version_bump",
    description:
      "Recommend the next semantic version from commit types and API surface changes, listing the evidence for the bump level chosen.",
    inputSchema: {
      type: "object" as const,
      properties: {
        current_version: {
          type: "string",
          description:
            'Current version, strict MAJOR.MINOR.PATCH semver (e.g. "1.4.2")',
        },
        commits: {
          type: "array",
          description: "Commits since the current version (may be empty)",
          items: {
            type: "object",
            properties: {
              type: {
                type: "string",
                description: "Conventional-commit type, e.g. feat, fix, chore",
              },
              breaking: {
                type: "boolean",
                description:
                  "True when the commit is marked breaking (optional, default false)",
              },
            },
            required: ["type"],
          },
        },
        api_changes: {
          type: "array",
          description:
            "Public API surface changes since the current version (optional, default [])",
          items: {
            type: "object",
            properties: {
              kind: {
                type: "string",
                enum: ["removed", "changed", "added"],
                description: "removed or changed are breaking; added is a feature",
              },
              name: {
                type: "string",
                description: "Name of the API entry that changed",
              },
            },
            required: ["kind", "name"],
          },
        },
      },
      required: ["current_version", "commits"],
    },
  },
];

function textResult(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof value === "string" ? value : JSON.stringify(value, null, 2),
      },
    ],
  };
}

function errorResult(err: unknown) {
  return {
    content: [
      { type: "text" as const, text: err instanceof Error ? err.message : String(err) },
    ],
    isError: true,
  };
}

const server = new Server(
  { name: "versionbump", version: VERSION },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let out: unknown;
    if (name === "recommend_version_bump") {
      out = recommendVersionBump(args ?? {});
    } else {
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
    return textResult(formatPayload(out));
  } catch (err) {
    if (err instanceof McpError) throw err;
    return errorResult(err);
  }
});

async function main(): Promise<void> {
  await server.connect(new StdioServerTransport());
}

void main();
