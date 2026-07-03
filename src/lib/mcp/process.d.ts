// Ambient declaration so MCP tool files (bundled into a Deno edge function)
// type-check under Vite's browser tsconfig. At runtime `process.env` is
// provided by Deno's Node compat layer inside the emitted function.
declare const process: { env: Record<string, string | undefined> };
