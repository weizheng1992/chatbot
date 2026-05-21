import modelConfig from "@/ai-models.json";

export type ModelCapabilities = {
  tools: boolean;
  vision: boolean;
  reasoning: boolean;
};

export type ProviderPublicConfig = {
  name: string;
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
  providers: Record<ModelProvider, ProviderPublicConfig>;
  models: ChatModel[];
};

const config = modelConfig as ModelConfig;
export const chatModels = config.models;

const fallbackModel = chatModels[0];
const requestedDefaultModel =
  process.env.NEXT_PUBLIC_AI_MODEL ||
  process.env.AI_MODEL ||
  config.defaultModel;
const defaultModel =
  chatModels.find((model) => model.id === requestedDefaultModel) ??
  fallbackModel;

export const DEFAULT_CHAT_MODEL = defaultModel.id;
export const titleModel = defaultModel;

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
