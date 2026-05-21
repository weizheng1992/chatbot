import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { customProvider } from "ai";
import { isTestEnvironment } from "../constants";
import { getModelById, titleModel } from "./models";

const companyProvider = createOpenAICompatible({
  name: "company",
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
