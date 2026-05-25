import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const chatRouteSource = readFileSync("app/(chat)/api/chat/route.ts", "utf8");

test("chat route enables artifact tools when the model supports tools", () => {
  expect(chatRouteSource).toContain('tools: supportsTools ? ["weather", "artifacts"] : []');
  expect(chatRouteSource).toContain('"getWeather"');
  expect(chatRouteSource).toContain('"createDocument"');
  expect(chatRouteSource).toContain('"updateDocument"');
  expect(chatRouteSource).toContain('"requestSuggestions"');
});