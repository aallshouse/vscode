# Removing Copilot and AI features from this fork

This fork removes GitHub Copilot and every built-in AI capability from VS Code. The work is split into phases so each pull request stays reviewable and the fork can keep merging from upstream.

| Phase | Branch | What it does | Status |
|---|---|---|---|
| 1 | `remove-ai/phase-1-unwire` | Delete the bundled Copilot extension and its build/CI wiring. Unregister every AI user-facing contribution. Disable the Agents window and agent host. Default AI off. | Done |
| 2 | `remove-ai/phase-2-delete` | Delete the now-dead AI source trees, decouple core code from AI services, and remove the AI dependencies and build steps. | Done (this PR) |
| 3 | not started | Remove the remaining inert AI plumbing (`isSessionsWindow`, `defaultChatAgent`, Copilot account code, agent sandbox, Rust CLI agent commands). | Planned below |

Decisions taken up front:

- **Phased.** Phase 1 unwires and strips. Phase 2 deletes the dead source once phase 1 is merged and building.
- **Extension APIs stay, but inert.** `vscode.lm`, chat participants, language-model tools and MCP providers keep their API shape, so marketplace extensions that touch them still activate. No models, chat UI or agents are registered behind them.

---

## Phase 1 — unwire and strip

One commit per area, so the PR can be reviewed commit by commit.

### 1. Remove the built-in Copilot extension and its build/CI wiring

- Delete `extensions/copilot` (about 62 MB, roughly 4,200 files) and `extensions/prompt-basics`, which was language support for Copilot prompt files.
- **`package.json`:** drop the `compile-copilot`, `watch-copilot*` and `copilot:*` scripts.
- **gulp:** drop `compileCopilotExtensionBuildTask` and the Copilot ripgrep-shim packaging step from the desktop and server builds. That step would throw once the extension is gone.
- **hygiene:** drop the Copilot `engines.vscode` check.
- **ESLint:** drop the Copilot plugin import and config blocks, plus the Copilot entries in `.eslint-ignore`, the bracket-notation and JS allowlists, and CodeQL paths.
- **GitHub workflows:** drop the Copilot jobs and steps, and delete `chat-perf.yml`, `chat-lib-package.yml` and `copilot-setup-steps.yml`.
- **Azure pipelines:** drop the Copilot stage, the Copilot VSIX download, the Copilot test IDs and the `build/azure-pipelines/copilot/` templates.

### 2. Neutralize Copilot service endpoints in `product.json`

- Blank the Copilot entitlement, token, MCP registry/connectors and managed-settings URLs. The default-account service skips empty URLs, so nothing calls `api.github.com/copilot_internal/*`.
- Drop Copilot Chat from `trustedExtensionAuthAccess` and `builtInExtensionsEnabledWithAutoUpdates`, and remove the voice realtime endpoint.
- `defaultChatAgent` itself stays. About 20 non-AI services read it as a required field; making it optional is phase 2.
- **Extension marketplace: Open VSX.** Upstream's open-source `product.json` has no `extensionsGallery`; Microsoft adds one only in its closed VS Code build. So builds of this repo had no extension search even before any AI changes. This fork now points at [Open VSX](https://open-vsx.org), the open registry VSCodium uses, with the same endpoints. The Visual Studio Marketplace's terms limit its extensions to Microsoft's own VS Code products, so it isn't configured here.

### 3. Unwire AI UI contributions from the workbench

**Entry points no longer load:**
- the chat view
- agent-host and remote agent-host session contributions
- chat sessions and chat context contributions
- Copilot voice
- the MCP view
- the agent-sessions welcome page
- the model-picker tryout
- remote coding agents
- the electron chat and tunnel-host contributions
- notebook chat

**Files that mix services with UI** keep their `registerSingleton()` calls and lose everything user-facing. Each edited file carries an `// AI removed:` comment saying what went and why the rest stays.

| File | Removed | Kept |
|---|---|---|
| `chat.shared.contribution.ts` | setup/sign-in, status-bar entries, promos and notifications, telemetry, built-in agent tools, URL handlers, agent-plugin discovery/recommendations/auto-update, chat editors and serializers, accessibility help, paste providers, all chat actions and keybindings | services, the three extension-point handlers, settings schema |
| `chat.contribution.ts` | fork-conversation, continue-in-Copilot and export-logs actions | 2 services |
| `inlineChat.contribution.ts` | inline chat controller (Ctrl+I), actions, contributions | 2 session services |
| `agentHost.contribution.ts` | all agent-host workbench contributions | BYOK handler service |
| `mcp/*/mcp.contribution.ts` | discovery (so no MCP server autostart), chat tool bridge, gateway tool broker, commands, server editor, quick access | services, `mcp.json` schema, settings migration |
| `terminal.chat.contribution.ts` | terminal inline chat controller, accessibility views | 2 services |
| `terminal.chatAgentTools.contribution.ts` | run-in-terminal agent tool, sandbox forwarder, add-selection-to-chat | sandbox service, settings migrations |

**Why services stay in phase 1.** 36 AI services are injected by core features, so unregistering them would crash those features at runtime:
- tasks, terminal, notebooks, SCM, search, accessibility, debug, markers
- authentication, the issue reporter, the browser view, update
- the extension API (`mainThread*` customers are created eagerly with every extension host)

With no chat agent or model provider installed, these services are inert. Phase 2 removes the injections and then the services.

### 4. Disable the Agents window and agent host; default AI off

- **Agents window.** `windowsMainService.openAgentsWindow` opens a regular window instead, so `--agents`, agent protocol links and commands never leave the app windowless. The former Agents workspace is skipped on restore, and `isSessionsWindow` is always `false`, so the Agents workbench never loads.
- **Agent host.** `AgentHostEnablementService.enabled` is constant `false`. Every path that starts or prewarms the agent-host process is gated on it: the desktop prewarmer and the remote editor client. The main and server processes only spawn the host lazily, on a renderer request.
- **`chat.disableAIFeatures` defaults to `true`.** This is upstream's own kill switch. It hides the AI affordances still owned by core code: the Getting Started Copilot steps, the help menu and editor watermark entries, the SCM sparkle actions, the extension-page AI actions and AI settings search.

### Verification done for phase 1

| Check | Result |
|---|---|
| Build scripts type-check (`build/`, with its own deps) | Same 20 environmental errors as `main`; nothing new |
| Workbench, extension host, main process and server type-check (`scripts/remove-ai/typecheck-diff.sh main`) | Identical error set to `main` (263 environmental errors, e.g. Electron typings unavailable without a full postinstall); **0 new** |
| DI safety (`scripts/remove-ai/di_check.py . main <entries>`) | For desktop, web and electron-main: no loaded file injects a service that lost its registration. Desktop: 5,078 → 4,755 files loaded, 433 → 419 services. |
| `build/next/build-fast` unit tests (Copilot lane removed) | 18/18 pass |
| ESLint config loads; all workflow YAML parses | OK |

**Not yet verified, so do this before merging:** a real build and launch. I couldn't run Electron in the environment that produced this branch. Run `npm install`, then `npm run compile`, then `./scripts/code.sh`, and smoke-test:
- open a folder, edit, run a task, use the terminal, a notebook and SCM, and install an extension
- confirm no Chat view, no Copilot status-bar item, no Ctrl+I inline chat, no title-bar chat button and no Copilot walkthrough
- `code --agents` opens a normal window

The upstream unit and integration tests for the chat, inline-chat and MCP UI will fail or be irrelevant now; phase 2 deletes them along with the code.

---

## Phase 2 — delete the dead source (branch `remove-ai/phase-2-delete`)

Phase 2 was done as one branch, committed by area so it can be reviewed commit by commit.

### Extension API: inert namespaces instead of null main-thread services

The plan was to keep the ext-host AI code and back it with null `mainThread*` services. In practice it was simpler and smaller to delete the ext-host side too. `src/vs/workbench/api/common/extHostInertAiApi.ts` now implements `vscode.ai`, `vscode.chat`, `vscode.lm` and `vscode.speech` locally:

- proposed-API checks are kept, so extensions see the same errors for unenabled proposals
- registrations return a no-op disposable, queries resolve to empty results, and events never fire
- requests that need a model (`getModelProxy`, `computeEmbeddings`, `invokeTool`) reject with "AI features are not available in this build."
- `window.createChatStatusItem`, `createAgentEditorComments` and `interactive.transferActiveChat` return inert objects

All AI `mainThread*`/`extHost*` files, their RPC identifiers in `extHost.protocol.ts` and their converters in `extHostTypeConverters.ts` were removed.

### Deleted

- **workbench/contrib:** `chat`, `inlineChat`, `mcp`, `agentsVoice`, `speech`, `remoteCodingAgents`, `welcomeAgentSessions`, `welcomeOnboarding` (the Copilot sign-in overlay), `canvases`, `terminalContrib/{chat,chatAgentTools,voice}`, `codeEditor/browser/dictation`, the notebook chat/cell-diagnostics code, and the chat/AI pieces of search, debug, markers, SCM, testing, extensions and browser view
- **workbench/services:** `agentHost`, `agentEditorComments`, `aiEmbeddingVector`, `aiRelatedInformation`, `aiSettingsSearch`, `chat`, `mcp`, `localTranscription`, the AI managed-settings update banner, and the agent Playwright service
- **platform:** `agentHost`, `agentPlugins`, `chat`, `copilotConnectors`, `mcp`, `customizationMarketplace`, `localTranscription`, and the Playwright agent browser channel
- **Agents window:** `src/vs/sessions`, `agentsWindow.ts`, the `openAgentsWindow` plumbing, and the tryout handoff
- **CLI:** `code chat`, `code agent`, `--agents`, `--add-mcp`, `--agent-plugins-dir`, `--agents-user-data-dir`, `--agents-extensions-dir`, `--inspect-agenthost`, and the server's `agent-host-*` flags
- **Core decoupling:** tasks, terminal, notebooks, editor hints, SCM, quick access, accessibility, preferences (AI settings search), issue reporter (AI title generation), update title bar, Getting Started (Copilot steps), assignment filters, policies and extension enablement no longer reference AI services
- **Tests:** all tests for the above, the chat/sessions component fixtures, the Agents and chat smoke tests, and `test/integration/agentHost`

### Dependencies, build and CI

- Removed from `package.json`/`remote/package.json`: `@github/copilot-sdk`, `@vscode/copilot-api`, `@anthropic-ai/sdk`, `@anthropic-ai/claude-agent-sdk`, `@openai/codex`, `foundry-local-sdk`, `@devcontainers/cli`, `@vscode/sandbox-runtime`, `libsodium-wrappers`, `@hpke/core`, `ssh2`, `copilotRuntimeVersion` and the `codex:*`/`agent-host:*` scripts. `playwright-core` moved to `devDependencies` (only the smoke-test automation uses it now). Lockfiles refreshed.
- Removed `build/lib/copilot.ts` (the ripgrep filter moved to `build/lib/ripgrep.ts`), `build/agent-sdk`, `build/agentHost`, `build/codex`, `build/dictation-runtime`, the dev-tunnels web bundle, the Agents bundle entries and resources, the Copilot/Foundry packaging and universal-app handling, and the Copilot `.moduleignore` entries.
- CI: removed the SDK canary, `mixin-vscode-capi`, agent-SDK and dictation-runtime producers, the packaged agent-host smoke test, the native-optional-deps check, the Codex protocol check, agent-host E2E detection, the Claude musl workaround, the Agents PAC-proxy and WSL Dev Container smoke lanes, and the Copilot test-checkpoint IDs.
- AI contributor docs for deleted features (agent host, sessions, chat, chat perf) were removed from `.github/`.

### Verification done for phase 2

- `typecheck-diff.sh`: no new errors from the desktop, web, extension-host, main-process and server entry points; a full non-test `src` type-check and a chunked type-check of all unit tests also show no new errors against phase 1
- `di_check.py`: no missing service registrations for the desktop, web and main entry points
- node unit tests pass; build script tests pass except one environment-dependent Cloud Sandbox test that also fails on phase 1
- eslint is clean on the changed files

---

## Phase 3 — remaining AI plumbing (not done yet)

These were left in place to keep phase 2 reviewable. None of them are reachable as AI features in the UI.

- **`isSessionsWindow` and the Agents profile.** About 50 files still check `isSessionsWindow`, which is always false. Remove the flag, the `agentsWindow` configuration-schema overrides, `AGENTS_WINDOW_PROFILE_ID`, `agentPluginsHome`, `resources/win32/sessions.ico` and `IsSessionsWindowContext`.
- **`product.defaultChatAgent`.** Still read by extension enablement, the gallery, accounts and policies. Make it optional, remove the readers, then drop it from `product.json`.
- **Copilot account plumbing.** `copilotManagedSettings`, the account policy gate, `defaultAccount` Copilot token/entitlement fields, `copilotVersions`, `agentSdks` and `dictationRuntime` in `IProductConfiguration`.
- **Agent sandbox and network filter.** `platform/sandbox` and `platform/networkFilter` still exist; the browser view registers the network filter, which is disabled because its settings are no longer registered.
- **MCP leftovers.** MCP account-access services, the MCP profile resource and MCP settings sync.
- **Telemetry and misc.** AI edit telemetry, `genAi` OTel attributes, survey questions, `chatHeight` in the notebook cell layout, `TaskRunSource.ChatAgent`, chat menu contribution points in `menusExtensionPoint.ts`, and leftover `chat.*` command IDs and context keys.
- **Rust CLI.** `cli/src/commands/agent*.rs` and the agent-host tunnel code.
- **Config files.** Dead `eslint.config.js` import rules, `.eslint-plugin-local` agent-host rules, stylelint known variables and `build/lib/policies/policyData.jsonc` AI policies.
- **Tests that exercise AI settings.** A few browser unit tests still assert on `chat.agent.sandbox.*` settings and Copilot account tiers; see the phase 2 PR description.

---

## Verification tools (`scripts/remove-ai/`)

- **`typecheck-diff.sh [ref]`** — type-checks everything reachable from the desktop, web, extension-host, main-process and server entry points with native TypeScript 7 (fits in about 7 GB). Prints only errors absent from `ref`.
- **`di_check.py <repo> <ref> <entry.ts>…`** — compares the import closure of each entry point with `ref`. Reports any still-loaded file that injects (`@IFoo` or `accessor.get(IFoo)`) a service whose `registerSingleton` is no longer loaded.
- **`prune_imports.py <files>`** — removes the unused imports that `tsc` reports after unregistering contributions. Pipe `tsc` output into it.

Delete this file and `scripts/remove-ai/` once phase 3 is merged.
