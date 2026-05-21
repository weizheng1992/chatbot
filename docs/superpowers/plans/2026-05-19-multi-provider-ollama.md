# Multi-Provider Ollama Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add UI-selectable multiple AI providers, starting with the current company OpenAI-compatible endpoint and an Ollama OpenAI-compatible endpoint.

**Architecture:** Model IDs shown to the UI will be prefixed (`company/...`, `ollama/...`) while each model keeps a `rawModelId` for the provider API call. `getLanguageModel(modelId)` will look up the model metadata and route to either the company provider or the Ollama provider. Tool calling stays enabled only for the company model in this first pass; Ollama is listed with tools disabled until separately verified.

**Tech Stack:** Next.js 16, AI SDK 6, `@ai-sdk/openai-compatible`, TypeScript, pnpm, existing `ultracite check` and `tsc --noEmit` validation.

---

## File Structure

- Modify `lib/ai/models.ts`: add provider-aware model metadata, prefixed model IDs, raw provider model IDs, per-model capabilities, and helper lookup.
- Modify `lib/ai/providers.ts`: create one OpenAI-compatible provider for company and one for Ollama; route by selected model metadata.
- Modify `app/(chat)/api/chat/route.ts`: enable `getWeather` only when the selected model capability has tools enabled.
- Modify `.env.example`: document company and Ollama provider environment variables plus public default model.
- Modify `.env.local`: add local company/Ollama provider variables if missing; keep existing auth/database values.

## Task 1: Model Metadata and Capabilities

**Files:**
- Modify: `lib/ai/models.ts`

- [ ] **Step 1: Verify the current single-provider behavior is insufficient**

Run:

```bash
python3 - <<'PY'
from pathlib import Path
text = Path('lib/ai/models.ts').read_text()
assert 'rawModelId' in text and 'ollama/' in text, 'multi-provider model metadata is not present yet'
PY
```

Expected: FAIL with `AssertionError: multi-provider model metadata is not present yet`.

- [ ] **Step 2: Replace `lib/ai/models.ts` with provider-aware metadata**

Set `lib/ai/models.ts` to:

```ts
export type ModelProvider = "company" | "ollama";

export type ModelCapabilities = {
  tools: boolean;
  vision: boolean;
  reasoning: boolean;
};

export type ChatModel = {
  id: string;
  rawModelId: string;
  name: string;
  provider: ModelProvider;
  description: string;
  capabilities: ModelCapabilities;
  reasoningEffort?: "none" | "minimal" | "low" | "medium" | "high";
};

export const DEFAULT_CHAT_MODEL =
  process.env.NEXT_PUBLIC_AI_MODEL ||
  process.env.AI_MODEL ||
  "company/gemini-3.1-pro-preview:latest";

export const chatModels: ChatModel[] = [
  {
    id: "company/gemini-3.1-pro-preview:latest",
    rawModelId: "gemini-3.1-pro-preview:latest",
    name: "Gemini 3.1 Pro Preview",
    provider: "company",
    description: "Company OpenAI-compatible model",
    capabilities: { tools: true, vision: false, reasoning: false },
  },
  {
    id: "ollama/qwen2.5:7b",
    rawModelId: "qwen2.5:7b",
    name: "Qwen 2.5 7B",
    provider: "ollama",
    description: "Local Ollama model",
    capabilities: { tools: false, vision: false, reasoning: false },
  },
];

const defaultModel = chatModels.find((model) => model.id === DEFAULT_CHAT_MODEL);

export const titleModel = defaultModel ?? chatModels[0];

export async function getCapabilities(): Promise<
  Record<string, ModelCapabilities>
> {
  return await Promise.resolve(
    Object.fromEntries(
      chatModels.map((model) => [model.id, model.capabilities])
    )
  );
}

export const isDemo = process.env.IS_DEMO === "1";

export type GatewayModelWithCapabilities = ChatModel & {
  capabilities: ModelCapabilities;
};

export async function getAllGatewayModels(): Promise<
  GatewayModelWithCapabilities[]
> {
  return await Promise.resolve(chatModels);
}

export function getActiveModels(): ChatModel[] {
  return chatModels;
}

export function getModelById(modelId: string): ChatModel {
  return chatModels.find((model) => model.id === modelId) ?? titleModel;
}

export const allowedModelIds = new Set(chatModels.map((m) => m.id));

export const modelsByProvider = chatModels.reduce(
  (acc, model) => {
    if (!acc[model.provider]) {
      acc[model.provider] = [];
    }
    acc[model.provider].push(model);
    return acc;
  },
  {} as Record<ModelProvider, ChatModel[]>
);
```

- [ ] **Step 3: Verify metadata now exists**

Run:

```bash
python3 - <<'PY'
from pathlib import Path
text = Path('lib/ai/models.ts').read_text()
assert 'rawModelId' in text
assert 'company/gemini-3.1-pro-preview:latest' in text
assert 'ollama/qwen2.5:7b' in text
assert 'capabilities: { tools: true' in text
assert 'capabilities: { tools: false' in text
print('multi-provider model metadata present')
PY
```

Expected: PASS and print `multi-provider model metadata present`.

## Task 2: Provider Routing

**Files:**
- Modify: `lib/ai/providers.ts`

- [ ] **Step 1: Verify current provider routing is missing Ollama**

Run:

```bash
python3 - <<'PY'
from pathlib import Path
text = Path('lib/ai/providers.ts').read_text()
assert 'ollamaProvider' in text and 'getModelById' in text, 'provider router does not support Ollama yet'
PY
```

Expected: FAIL with `AssertionError: provider router does not support Ollama yet`.

- [ ] **Step 2: Replace provider initialization and routing**

Set `lib/ai/providers.ts` to:

```ts
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { customProvider } from "ai";
import { isTestEnvironment } from "../constants";
import { getModelById, titleModel } from "./models";

const companyProvider = createOpenAICompatible({
  name: "company-openai-compatible",
  baseURL:
    process.env.COMPANY_AI_BASE_URL ||
    process.env.AI_BASE_URL ||
    "http://localhost:11211/api/openai/v1",
  apiKey: process.env.COMPANY_AI_API_KEY || process.env.AI_API_KEY || "dummy",
});

const ollamaProvider = createOpenAICompatible({
  name: "ollama",
  baseURL: process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1",
  apiKey: process.env.OLLAMA_API_KEY || "ollama",
});

export const myProvider = isTestEnvironment
  ? (() => {
      const { chatModel, titleModel } = require("./models.mock");
      return customProvider({
        languageModels: {
          "chat-model": chatModel,
          "title-model": titleModel,
        },
      });
    })()
  : null;

export function getLanguageModel(modelId: string) {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel(modelId);
  }

  const model = getModelById(modelId);

  if (model.provider === "ollama") {
    return ollamaProvider.languageModel(model.rawModelId);
  }

  return companyProvider.languageModel(model.rawModelId);
}

export function getTitleModel() {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel("title-model");
  }
  return getLanguageModel(titleModel.id);
}
```

- [ ] **Step 3: Verify provider router exists**

Run:

```bash
python3 - <<'PY'
from pathlib import Path
text = Path('lib/ai/providers.ts').read_text()
assert 'const companyProvider' in text
assert 'const ollamaProvider' in text
assert 'getModelById(modelId)' in text
assert 'ollamaProvider.languageModel(model.rawModelId)' in text
assert 'companyProvider.languageModel(model.rawModelId)' in text
print('provider router present')
PY
```

Expected: PASS and print `provider router present`.

## Task 3: Route Tools by Selected Model Capability

**Files:**
- Modify: `app/(chat)/api/chat/route.ts`

- [ ] **Step 1: Verify tools are currently always enabled**

Run:

```bash
python3 - <<'PY'
from pathlib import Path
text = Path('app/(chat)/api/chat/route.ts').read_text()
assert 'supportsTools: true' not in text, 'tools are still hard-coded on'
PY
```

Expected: FAIL with `AssertionError: tools are still hard-coded on`.

- [ ] **Step 2: Make tool registration conditional**

In `app/(chat)/api/chat/route.ts`, after:

```ts
const isReasoningModel = capabilities?.reasoning === true;
```

add:

```ts
const supportsTools = capabilities?.tools === true;
```

Then replace the `streamText` tool-related fields:

```ts
system: systemPrompt({ requestHints, supportsTools: true }),
messages: modelMessages,
stopWhen: stepCountIs(5),
experimental_activeTools: ["getWeather"],
tools: { getWeather },
```

with:

```ts
system: systemPrompt({ requestHints, supportsTools }),
messages: modelMessages,
stopWhen: stepCountIs(5),
experimental_activeTools: supportsTools ? ["getWeather"] : [],
...(supportsTools && { tools: { getWeather } }),
```

- [ ] **Step 3: Verify route is capability-driven**

Run:

```bash
python3 - <<'PY'
from pathlib import Path
text = Path('app/(chat)/api/chat/route.ts').read_text()
assert 'const supportsTools = capabilities?.tools === true;' in text
assert 'systemPrompt({ requestHints, supportsTools })' in text
assert 'experimental_activeTools: supportsTools ? ["getWeather"] : []' in text
assert '...(supportsTools && { tools: { getWeather } })' in text
print('tool routing is capability-driven')
PY
```

Expected: PASS and print `tool routing is capability-driven`.

## Task 4: Environment Defaults

**Files:**
- Modify: `.env.example`
- Modify: `.env.local`

- [ ] **Step 1: Verify multi-provider env vars are not fully documented yet**

Run:

```bash
python3 - <<'PY'
from pathlib import Path
text = Path('.env.example').read_text()
assert 'COMPANY_AI_BASE_URL' in text and 'OLLAMA_BASE_URL' in text, 'multi-provider env vars are not documented yet'
PY
```

Expected: FAIL with `AssertionError: multi-provider env vars are not documented yet`.

- [ ] **Step 2: Update `.env.example` AI section**

Replace the current OpenAI-compatible AI endpoint section with:

```env
# Company OpenAI-compatible AI endpoint
COMPANY_AI_BASE_URL=http://localhost:11211/api/openai/v1
COMPANY_AI_API_KEY=dummy

# Ollama OpenAI-compatible AI endpoint
OLLAMA_BASE_URL=http://localhost:11434/v1
OLLAMA_API_KEY=ollama

# Default UI-selected model
AI_MODEL=company/gemini-3.1-pro-preview:latest
NEXT_PUBLIC_AI_MODEL=company/gemini-3.1-pro-preview:latest
```

- [ ] **Step 3: Update `.env.local` without removing existing secrets**

Run this script to add missing keys while preserving existing values:

```bash
python3 - <<'PY'
from pathlib import Path
p = Path('.env.local')
text = p.read_text() if p.exists() else ''
entries = {
    'COMPANY_AI_BASE_URL': 'http://localhost:11211/api/openai/v1',
    'COMPANY_AI_API_KEY': 'dummy',
    'OLLAMA_BASE_URL': 'http://localhost:11434/v1',
    'OLLAMA_API_KEY': 'ollama',
    'AI_MODEL': 'company/gemini-3.1-pro-preview:latest',
    'NEXT_PUBLIC_AI_MODEL': 'company/gemini-3.1-pro-preview:latest',
}
for key, value in entries.items():
    if f'{key}=' not in text:
        text = text.rstrip('\n') + f'\n{key}={value}\n'
p.write_text(text.lstrip('\n'))
PY
```

- [ ] **Step 4: Verify env variable names safely**

Run:

```bash
grep -n "^[A-Za-z_][A-Za-z0-9_]*=" .env.local .env.example 2>/dev/null | sed -E 's/=.*/=<redacted>/'
```

Expected: output includes `COMPANY_AI_BASE_URL`, `COMPANY_AI_API_KEY`, `OLLAMA_BASE_URL`, `OLLAMA_API_KEY`, `AI_MODEL`, and `NEXT_PUBLIC_AI_MODEL`; values are redacted.

## Task 5: Validation

**Files:**
- Read-only validation.

- [ ] **Step 1: Run project checks**

Run:

```bash
pnpm check
pnpm exec tsc --noEmit
```

Expected: both commands pass.

- [ ] **Step 2: Verify company endpoint still supports chat**

Run:

```bash
curl -sS --max-time 20 "http://localhost:11211/api/openai/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dummy" \
  -d '{"model":"gemini-3.1-pro-preview:latest","messages":[{"role":"user","content":"Reply with only: ok"}],"stream":false}'
```

Expected: JSON response contains `ok` in `choices[0].message.content`.

- [ ] **Step 3: Verify Ollama endpoint availability**

Run:

```bash
curl -sS --max-time 10 "http://localhost:11434/v1/models" \
  -H "Authorization: Bearer ollama"
```

Expected if Ollama is running: JSON model list. If Ollama is not running or `qwen2.5:7b` is missing, report this as an environment setup note, not a code failure.

- [ ] **Step 4: Verify no Vercel Gateway runtime references returned**

Run:

```bash
grep -R "gateway\.languageModel\|ai-gateway.vercel.sh\|AI_GATEWAY_API_KEY\|gatewayOrder\|activate_gateway" -n --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git .
```

Expected: no runtime code matches. README-only matches are non-blocking documentation cleanup.

## Self-Review

- Spec coverage: The plan adds prefixed company/Ollama model IDs, provider routing by metadata, capability-driven tool enablement, env docs/defaults, and validation commands.
- Placeholder scan: No TBD/TODO/fill-in placeholders remain.
- Type consistency: `ModelProvider`, `ChatModel.rawModelId`, `getModelById`, `companyProvider`, and `ollamaProvider` names are consistent across tasks.
