# Multi-Provider JSON Config Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move provider/model definitions into a root-level JSON file so the UI can show company and Ollama models without hardcoding model lists in TypeScript.

**Architecture:** A project-root `ai-models.json` file defines providers, default model, and models. `lib/ai/models.ts` imports that JSON, exposes typed model helpers, and keeps the existing app-facing exports. `lib/ai/providers.ts` reads provider config by model provider and creates OpenAI-compatible provider instances; chat route enables `getWeather` only for models whose JSON capability says `tools: true`.

**Tech Stack:** Next.js 16, TypeScript with `resolveJsonModule`, AI SDK 6, `@ai-sdk/openai-compatible`, pnpm, `ultracite check`, `tsc --noEmit`.

---

## File Structure

- Create `ai-models.json`: root-level dynamic provider/model configuration.
- Modify `lib/ai/models.ts`: import root JSON config, type it, expose `chatModels`, `getModelById`, `getProviderById`, capabilities, default/title model.
- Modify `lib/ai/providers.ts`: create provider instances from JSON provider config and route selected model to provider `rawModelId`.
- Modify `app/(chat)/api/chat/route.ts`: enable `getWeather` only when selected model capabilities include `tools: true`.
- Modify `.env.example`: document company and Ollama env vars plus public default model.
- Modify `.env.local`: add missing company/Ollama env vars while keeping existing secrets.

## Task 1: Root JSON Model Config

**Files:**
- Create: `ai-models.json`

- [ ] **Step 1: Write failing config existence check**

Run:

```bash
python3 - <<'PY'
from pathlib import Path
import json
path = Path('ai-models.json')
assert path.exists(), 'root ai-models.json does not exist yet'
data = json.loads(path.read_text())
assert data['defaultModel'] == 'company/gemini-3.1-pro-preview:latest'
assert 'company' in data['providers']
assert 'ollama' in data['providers']
assert any(model['id'] == 'ollama/qwen2.5:7b' for model in data['models'])
PY
```

Expected: FAIL with `AssertionError: root ai-models.json does not exist yet`.

- [ ] **Step 2: Create `ai-models.json` at the project root**

Create `ai-models.json` with:

```json
{
  "defaultModel": "company/gemini-3.1-pro-preview:latest",
  "providers": {
    "company": {
      "name": "Company",
      "baseURLEnv": "COMPANY_AI_BASE_URL",
      "defaultBaseURL": "http://localhost:11211/api/openai/v1",
      "apiKeyEnv": "COMPANY_AI_API_KEY",
      "defaultApiKey": "dummy"
    },
    "ollama": {
      "name": "Ollama",
      "baseURLEnv": "OLLAMA_BASE_URL",
      "defaultBaseURL": "http://localhost:11434/v1",
      "apiKeyEnv": "OLLAMA_API_KEY",
      "defaultApiKey": "ollama"
    }
  },
  "models": [
    {
      "id": "company/gemini-3.1-pro-preview:latest",
      "provider": "company",
      "rawModelId": "gemini-3.1-pro-preview:latest",
      "name": "Gemini 3.1 Pro Preview",
      "description": "Company OpenAI-compatible model",
      "capabilities": {
        "tools": true,
        "vision": false,
        "reasoning": false
      }
    },
    {
      "id": "ollama/qwen2.5:7b",
      "provider": "ollama",
      "rawModelId": "qwen2.5:7b",
      "name": "Qwen 2.5 7B",
      "description": "Local Ollama model",
      "capabilities": {
        "tools": false,
        "vision": false,
        "reasoning": false
      }
    }
  ]
}
```

- [ ] **Step 3: Verify JSON config**

Run:

```bash
python3 - <<'PY'
from pathlib import Path
import json
path = Path('ai-models.json')
assert path.exists()
data = json.loads(path.read_text())
assert data['defaultModel'] == 'company/gemini-3.1-pro-preview:latest'
assert data['providers']['company']['defaultBaseURL'] == 'http://localhost:11211/api/openai/v1'
assert data['providers']['ollama']['defaultBaseURL'] == 'http://localhost:11434/v1'
assert any(model['id'] == 'company/gemini-3.1-pro-preview:latest' and model['capabilities']['tools'] is True for model in data['models'])
assert any(model['id'] == 'ollama/qwen2.5:7b' and model['capabilities']['tools'] is False for model in data['models'])
print('root ai-models.json configured')
PY
```

Expected: PASS and print `root ai-models.json configured`.

## Task 2: Read Models From JSON

**Files:**
- Modify: `lib/ai/models.ts`

- [ ] **Step 1: Verify models are still hardcoded**

Run:

```bash
python3 - <<'PY'
from pathlib import Path
text = Path('lib/ai/models.ts').read_text()
assert 'from "@/ai-models.json"' in text or 'from "../../ai-models.json"' in text, 'models.ts does not import root JSON config yet'
PY
```

Expected: FAIL with `AssertionError: models.ts does not import root JSON config yet`.

- [ ] **Step 2: Replace `lib/ai/models.ts` with JSON-backed exports**

Set `lib/ai/models.ts` to:

```ts
import modelConfig from "@/ai-models.json";

export type ModelCapabilities = {
  tools: boolean;
  vision: boolean;
  reasoning: boolean;
};

export type ProviderConfig = {
  name: string;
  baseURLEnv: string;
  defaultBaseURL: string;
  apiKeyEnv: string;
  defaultApiKey: string;
};

export type ModelProvider = keyof typeof modelConfig.providers;

export type ChatModel = {
  id: string;
  rawModelId: string;
  name: string;
  provider: ModelProvider;
  description: string;
  capabilities: ModelCapabilities;
  reasoningEffort?: "none" | "minimal" | "low" | "medium" | "high";
};

export type ModelConfig = {
  defaultModel: string;
  providers: Record<ModelProvider, ProviderConfig>;
  models: ChatModel[];
};

const config = modelConfig as ModelConfig;

export const DEFAULT_CHAT_MODEL =
  process.env.NEXT_PUBLIC_AI_MODEL || process.env.AI_MODEL || config.defaultModel;

export const chatModels = config.models;

const fallbackModel = chatModels[0];
const defaultModel =
  chatModels.find((model) => model.id === DEFAULT_CHAT_MODEL) ?? fallbackModel;

export const titleModel = defaultModel;

export async function getCapabilities(): Promise<
  Record<string, ModelCapabilities>
> {
  return await Promise.resolve(
    Object.fromEntries(chatModels.map((model) => [model.id, model.capabilities]))
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

export function getProviderById(providerId: ModelProvider): ProviderConfig {
  return config.providers[providerId];
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

- [ ] **Step 3: Verify JSON-backed model exports**

Run:

```bash
python3 - <<'PY'
from pathlib import Path
text = Path('lib/ai/models.ts').read_text()
assert 'import modelConfig from "@/ai-models.json";' in text
assert 'export const chatModels = config.models;' in text
assert 'getProviderById' in text
assert 'getModelById' in text
assert 'config.defaultModel' in text
print('models.ts reads root JSON config')
PY
```

Expected: PASS and print `models.ts reads root JSON config`.

## Task 3: Provider Routing From JSON Provider Config

**Files:**
- Modify: `lib/ai/providers.ts`

- [ ] **Step 1: Verify provider routing is not JSON-backed yet**

Run:

```bash
python3 - <<'PY'
from pathlib import Path
text = Path('lib/ai/providers.ts').read_text()
assert 'getProviderById' in text and 'createProviderFor' in text, 'providers.ts is not using JSON provider config yet'
PY
```

Expected: FAIL with `AssertionError: providers.ts is not using JSON provider config yet`.

- [ ] **Step 2: Replace `lib/ai/providers.ts` with JSON-backed provider routing**

Set `lib/ai/providers.ts` to:

```ts
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { customProvider } from "ai";
import { isTestEnvironment } from "../constants";
import {
  getModelById,
  getProviderById,
  titleModel,
  type ModelProvider,
  type ProviderConfig,
} from "./models";

function getEnvValue(name: string): string | undefined {
  return process.env[name];
}

function createProviderFor(providerId: ModelProvider) {
  const providerConfig: ProviderConfig = getProviderById(providerId);

  return createOpenAICompatible({
    name: providerId,
    baseURL:
      getEnvValue(providerConfig.baseURLEnv) || providerConfig.defaultBaseURL,
    apiKey: getEnvValue(providerConfig.apiKeyEnv) || providerConfig.defaultApiKey,
  });
}

const providerInstances = new Map<ModelProvider, ReturnType<typeof createProviderFor>>();

function getProviderInstance(providerId: ModelProvider) {
  const existing = providerInstances.get(providerId);
  if (existing) {
    return existing;
  }

  const provider = createProviderFor(providerId);
  providerInstances.set(providerId, provider);
  return provider;
}

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
  return getProviderInstance(model.provider).languageModel(model.rawModelId);
}

export function getTitleModel() {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel("title-model");
  }
  return getLanguageModel(titleModel.id);
}
```

- [ ] **Step 3: Verify JSON-backed provider routing**

Run:

```bash
python3 - <<'PY'
from pathlib import Path
text = Path('lib/ai/providers.ts').read_text()
assert 'getProviderById' in text
assert 'function createProviderFor(providerId: ModelProvider)' in text
assert 'providerConfig.baseURLEnv' in text
assert 'providerConfig.defaultBaseURL' in text
assert 'providerConfig.apiKeyEnv' in text
assert 'providerConfig.defaultApiKey' in text
assert 'languageModel(model.rawModelId)' in text
print('providers.ts reads JSON provider config')
PY
```

Expected: PASS and print `providers.ts reads JSON provider config`.

## Task 4: Route Tools by Selected Model Capability

**Files:**
- Modify: `app/(chat)/api/chat/route.ts`

- [ ] **Step 1: Verify tools are not capability-driven yet**

Run:

```bash
python3 - <<'PY'
from pathlib import Path
text = Path('app/(chat)/api/chat/route.ts').read_text()
assert 'systemPrompt({ requestHints, supportsTools })' in text and 'experimental_activeTools: supportsTools ? ["getWeather"] : []' in text, 'tools are not capability-driven yet'
PY
```

Expected: FAIL with `AssertionError: tools are not capability-driven yet`.

- [ ] **Step 2: Make tool registration conditional**

In `app/(chat)/api/chat/route.ts`, after:

```ts
const isReasoningModel = capabilities?.reasoning === true;
```

add:

```ts
const supportsTools = capabilities?.tools === true;
```

Then replace:

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

## Task 5: Environment Defaults

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

# Default UI-selected model from ai-models.json
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

## Task 6: Validation

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

- Spec coverage: The plan creates root `ai-models.json`, reads models/providers from JSON, routes providers from JSON env/default values, enables tools by model capability, updates env defaults, and validates company/Ollama endpoints.
- Placeholder scan: No TBD/TODO/fill-in placeholders remain.
- Type consistency: `ModelProvider`, `ProviderConfig`, `ChatModel.rawModelId`, `getProviderById`, `getModelById`, and `ai-models.json` fields are consistent across tasks.
