## Troubleshooting Log: API Server Crash & Socket.IO Worker Errors

### The Problem
When starting the local development server (`npm run dev`), the worker instantly threw a continuous loop of `Socket.IO connection error` logs. 

This was a symptom of a silent API server crash. Looking deeper into the logs, the API was failing to boot due to the following core error:
`TypeError [ERR_INVALID_ARG_TYPE]: The "original" argument must be of type function. Received undefined at promisify ... at zstdDecompressCallback`

### What We Tried (And Where We Went Wrong)
We initially misinterpreted the `undefined` function as a missing or blocked third-party C++ compression package. This led us down a few false paths:

1. **The Corrupt Lockfile Theory:** We wiped `node_modules`, `bun.lock`, and `.turbo` to force a clean dependency tree. *Result: Failed.*
2. **The Blocked Post-Install Theory:** Bun blocks package post-install scripts by default. Assuming the native bindings for a C++ `zstd` library weren't compiling, we ran `bun pm trust --all`. *Result: Failed. This triggered a broken `prepare` script in `@modelcontextprotocol/sdk`, causing a secondary build failure.*
3. **The Non-Existent CLI Command:** We attempted to fix the secondary failure by running `bun pm untrust` to isolate the broken SDK. *Result: Failed. This command does not exist in Bun's CLI.*

### The Breakthrough
We ran `bun pm untrusted` to manually inspect the blocked scripts. The output revealed that **no native C++ compression libraries were being blocked**. 

This proved the `zstdDecompressCallback` was not coming from a third-party package. It was coming from Node.js's built-in native `node:zlib` module.

### The True Root Cause
Activepieces recently updated their codebase to use native `zstd` compression via Node's internal `zlib`. 

Our local machine was running **Node v22.3.0**. While this is technically Node 22, it is an *early* minor release. Node.js did not officially implement the `zstdDecompress` function into `zlib` until a later patch. Because the function didn't exist in v22.3.0, Node returned `undefined`, causing `promisify` to crash the API server. 

*(Note: The Activepieces `setup-dev.js` script gave us a false positive. It only checks if the version starts with `v22` and completely ignores the minor patch version, incorrectly validating an incompatible Node environment.)*

### The Final Solution
To fix this, we bypassed the false positive by updating NVM to the latest Long Term Support (LTS) version of Node 22, which contains the fully implemented `zlib` functions.

```bash
# 1. Install the latest Node 22 LTS (e.g., v22.11+)
nvm install 22 --lts

# 2. Set it as the active version
nvm use 22

# 3. Clean install dependencies
rm -rf node_modules bun.lock
bun install

# 4. Start the server safely
npm run dev