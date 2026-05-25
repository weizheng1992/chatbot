# Enable All Chat Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable every tool in `lib/ai/tools` in the `/api/chat` workflow and make the frontend render their tool parts consistently.

**Architecture:** The chat route will keep using AI SDK `streamText` and `createUIMessageStream`; the change is to register the full tool map when the selected model supports tools. Type definitions will describe all tool UI parts, and the message renderer will add the missing `tool-editDocument` branch so streamed tool output has a visible UI.

**Tech Stack:** Next.js App Router, AI SDK v6, React 19, TypeScript, SWR, Playwright, Ultracite.

---

## File Structure

- Modify `app/(chat)/api/chat/route.ts`: import document tools, build a complete `chatTools` map inside `execute`, enable both `weather` and `artifacts` prompt sections, and expose all active tool names to `streamText`.
- Modify `lib/types.ts`: add `editDocument` to the `ChatTools` type so UI message parts include `tool-editDocument`.
- Modify `components/chat/message.tsx`: render `tool-editDocument` using the same document-preview pattern as update/create document tools, including error output.
- Verify with `pnpm exec tsc --noEmit` and `pnpm check`.

---

### Task 1: Add `editDocument` to chat tool types

**Files:**
- Modify: `lib/types.ts:3-27`

- [ ] **Step 1: Add the missing type import**

Edit the import block in `lib/types.ts` so it includes `editDocument`:

```ts
import type { createDocument } from "./ai/tools/create-document";
import type { editDocument } from "./ai/tools/edit-document";
import type { getWeather } from "./ai/tools/get-weather";
import type { requestSuggestions } from "./ai/tools/request-suggestions";
import type { updateDocument } from "./ai/tools/update-document";
```

- [ ] **Step 2: Add the inferred UI tool type**

Add this next to the existing document tool inferred types:

```ts
type editDocumentTool = InferUITool<ReturnType<typeof editDocument>>;
```

The tool type section should become:

```ts
type weatherTool = InferUITool<typeof getWeather>;
type createDocumentTool = InferUITool<ReturnType<typeof createDocument>>;
type editDocumentTool = InferUITool<ReturnType<typeof editDocument>>;
type updateDocumentTool = InferUITool<ReturnType<typeof updateDocument>>;
type requestSuggestionsTool = InferUITool<
  ReturnType<typeof requestSuggestions>
>;
```

- [ ] **Step 3: Add `editDocument` to `ChatTools`**

Update `ChatTools` to include all five tools:

```ts
export type ChatTools = {
  getWeather: weatherTool;
  createDocument: createDocumentTool;
  editDocument: editDocumentTool;
  updateDocument: updateDocumentTool;
  requestSuggestions: requestSuggestionsTool;
};
```

- [ ] **Step 4: Run typecheck for the type-only change**

Run:

```bash
pnpm exec tsc --noEmit
```

Expected: it may still pass or may reveal route/message renderer errors that later tasks fix. Do not suppress errors.

---

### Task 2: Register all tools in `/api/chat`

**Files:**
- Modify: `app/(chat)/api/chat/route.ts:19-22`
- Modify: `app/(chat)/api/chat/route.ts:187-198`

- [ ] **Step 1: Import all tool factories**

Replace the current single tool import area with these imports:

```ts
import { createDocument } from "@/lib/ai/tools/create-document";
import { editDocument } from "@/lib/ai/tools/edit-document";
import { getWeather } from "@/lib/ai/tools/get-weather";
import { requestSuggestions } from "@/lib/ai/tools/request-suggestions";
import { updateDocument } from "@/lib/ai/tools/update-document";
```

- [ ] **Step 2: Build the complete tool map inside `execute`**

Inside `createUIMessageStream({ execute: async ({ writer: dataStream }) => { ... } })`, before `const result = streamText({`, add:

```ts
        const chatTools = supportsTools
          ? {
              getWeather,
              createDocument: createDocument({
                session,
                dataStream,
                modelId: chatModel,
              }),
              editDocument: editDocument({ session, dataStream }),
              updateDocument: updateDocument({
                session,
                dataStream,
                modelId: chatModel,
              }),
              requestSuggestions: requestSuggestions({
                session,
                dataStream,
                modelId: chatModel,
              }),
            }
          : undefined;
```

- [ ] **Step 3: Enable both weather and artifact prompt sections**

Change the `systemPrompt` call from:

```ts
          system: systemPrompt({
            requestHints,
            supportsTools,
            tools: supportsTools ? ["weather"] : [],
          }),
```

to:

```ts
          system: systemPrompt({
            requestHints,
            supportsTools,
            tools: supportsTools ? ["weather", "artifacts"] : [],
          }),
```

- [ ] **Step 4: Enable all active tools in `streamText`**

Change the current tool options from:

```ts
          experimental_activeTools: supportsTools ? ["getWeather"] : [],
          ...(supportsTools && { tools: { getWeather } }),
```

to:

```ts
          experimental_activeTools: supportsTools
            ? [
                "getWeather",
                "createDocument",
                "editDocument",
                "updateDocument",
                "requestSuggestions",
              ]
            : [],
          ...(chatTools && { tools: chatTools }),
```

- [ ] **Step 5: Run typecheck for route integration**

Run:

```bash
pnpm exec tsc --noEmit
```

Expected: no TypeScript errors from `app/(chat)/api/chat/route.ts`. If AI SDK tool map inference complains, keep the same runtime behavior and satisfy the compiler with the narrowest local type annotation; do not use `any` unless the existing SDK types force it.

---

### Task 3: Render `tool-editDocument` messages

**Files:**
- Modify: `components/chat/message.tsx:244-268`

- [ ] **Step 1: Insert the `tool-editDocument` branch after `tool-createDocument`**

In `components/chat/message.tsx`, add this branch between the existing `tool-createDocument` and `tool-updateDocument` branches:

```tsx
    if (type === "tool-editDocument") {
      const { toolCallId } = part;

      if (part.output && "error" in part.output) {
        return (
          <div
            className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-500 dark:bg-red-950/50"
            key={toolCallId}
          >
            Error editing document: {String(part.output.error)}
          </div>
        );
      }

      return (
        <div className="relative" key={toolCallId}>
          <DocumentPreview
            args={{ ...part.output, isUpdate: true }}
            isReadonly={isReadonly}
            result={part.output}
          />
        </div>
      );
    }
```

- [ ] **Step 2: Run typecheck for the renderer**

Run:

```bash
pnpm exec tsc --noEmit
```

Expected: no TypeScript errors from `components/chat/message.tsx`. If TypeScript warns about spreading possibly undefined output, mirror the existing `tool-updateDocument` behavior rather than adding a different UI path.

---

### Task 4: Run project checks

**Files:**
- Verify only; no planned source edits.

- [ ] **Step 1: Run TypeScript check**

Run:

```bash
pnpm exec tsc --noEmit
```

Expected: command exits 0.

- [ ] **Step 2: Run repository check**

Run:

```bash
pnpm check
```

Expected: command exits 0. If Ultracite reports formatting or lint errors in the touched files, fix those files only and rerun `pnpm check`.

- [ ] **Step 3: Run relevant Playwright chat tools test**

Run:

```bash
pnpm exec playwright test tests/e2e/chat-tools.test.ts
```

Expected: command exits 0. If the test environment lacks required services, capture the exact failure and do not claim e2e passed.

---

### Task 5: Manual workflow verification

**Files:**
- Verify only; no planned source edits.

- [ ] **Step 1: Start the dev server**

Run:

```bash
pnpm dev
```

Expected: Next.js starts successfully and serves the app locally.

- [ ] **Step 2: Verify weather tool still works**

In the browser, send:

```txt
What's the weather in San Francisco?
```

Expected: the assistant streams a `tool-getWeather` part and the weather UI renders in the chat message.

- [ ] **Step 3: Verify artifact creation works**

In the browser, send:

```txt
Create a short Python script that prints the first five Fibonacci numbers.
```

Expected: the assistant calls `createDocument`, the artifact panel opens or updates, and the chat message shows the created document preview rather than dumping the full script into chat.

- [ ] **Step 4: Verify artifact edit works**

After the script exists, send:

```txt
Edit the script to print the first seven Fibonacci numbers instead.
```

Expected: the assistant calls `editDocument` for a targeted replacement or `updateDocument` for a full rewrite; the artifact content updates and the chat message renders the edit/update tool result.

- [ ] **Step 5: Verify suggestions workflow works for text artifacts**

Create a text artifact, then send:

```txt
Give me suggestions to improve this document.
```

Expected: the assistant calls `requestSuggestions`, suggestions stream into the artifact UI, and the chat message renders the request-suggestions tool result.

---

## Self-Review

- Spec coverage: The plan covers backend tool registration, prompt activation, type definitions, missing frontend rendering for `editDocument`, and verification.
- Placeholder scan: No placeholder tasks remain; every source-edit step includes exact code.
- Type consistency: Tool names match AI SDK UI part names already used by the app: `tool-getWeather`, `tool-createDocument`, `tool-editDocument`, `tool-updateDocument`, and `tool-requestSuggestions`.
