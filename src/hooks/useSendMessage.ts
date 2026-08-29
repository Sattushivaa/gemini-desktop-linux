import { useCallback, useRef } from "react";
import { useConversationStore } from "@/stores/conversations";
import { useSettingsStore } from "@/stores/settings";
import { useGenerationStore } from "@/stores/generation";
import { generateStream } from "@/services/gemini/streaming";
import { classifyError } from "@/services/gemini/errors";
import { getModel } from "@/services/gemini/models";
import type { PromptAttachment } from "@/services/gemini/files";
import type { Attachment, Message } from "@/types";
import { uid } from "@/lib/utils";

let activeController: AbortController | null = null;

/** Aborts the in-flight generation. */
export function stopGeneration() {
  activeController?.abort();
  activeController = null;
}

export interface PendingAttachment {
  attachment: Attachment;
  file: File | null;
}

interface RunTurnOptions {
  text: string;
  promptAttachments: PendingAttachment[];
  modelId?: string;
  /** Set once a conversation exists so message writes target it. */
  preferredConversationId?: string;
  /** True for re-sending the last user message (message is already persisted). */
  isRetry?: boolean;
}

async function runTurn(opts: RunTurnOptions, busyRef: { current: boolean }) {
  const { text, promptAttachments, modelId, preferredConversationId, isRetry } = opts;
  const conversations = useConversationStore.getState();
  const settings = useSettingsStore.getState().settings;

  if (busyRef.current) return;
  const trimmed = text.trim();
  if (!trimmed && promptAttachments.length === 0) return;
  busyRef.current = true;

  const model = modelId ?? conversations.activeConversation?.model ?? settings.defaultModel;
  const modelDef = getModel(model);

  // Start generation state pessimistically so UI shows "generating" fast.
  useGenerationStore.getState().start();

  let conversationId = preferredConversationId ?? conversations.activeConversationId;
  try {
    // Ensure we have a conversation to talk into.
    if (!conversationId) {
      conversationId = await useConversationStore.getState().newChat(model);
    }

    if (!isRetry) {
      const userMessage: Message = {
        id: uid("msg"),
        conversationId,
        role: "user",
        content: trimmed,
        createdAt: new Date().toISOString(),
        sequence: 0,
        attachments: promptAttachments.map((p) => p.attachment),
      };
      await useConversationStore.getState().addMessage(userMessage);
      void useConversationStore.getState().maybeAutoTitle(userMessage);
    }

    // Stream the response.
    const controller = new AbortController();
    activeController = controller;

    const promptForStream: PromptAttachment[] = promptAttachments.map((p) => ({
      attachment: p.attachment,
      file: p.file ?? undefined,
    }));

    const history = useConversationStore.getState().messages.filter(
      (m) => m.conversationId === conversationId,
    );

    try {
      const result = await generateStream({
        model,
        modelDef,
        history,
        prompt: trimmed,
        promptAttachments: promptForStream,
        temperature: settings.temperature,
        maxOutputTokens: settings.maxOutputTokens,
        signal: controller.signal,
        onDelta: (delta) => useGenerationStore.getState().append(delta),
      });

      useGenerationStore.getState().finish();

      const finalText = result.text.trim();
      if (finalText) {
        const modelMessage: Message = {
          id: uid("msg"),
          conversationId,
          role: "model",
          content: finalText,
          createdAt: new Date().toISOString(),
          sequence: 0,
          attachments: [],
        };
        await useConversationStore.getState().addMessage(modelMessage);
      }
    } catch (raw) {
      if (activeController === controller) activeController = null;
      useGenerationStore.getState().setError(classifyError(raw, true));
    } finally {
      if (activeController === controller) activeController = null;
    }
    busyRef.current = false;
  } catch (raw) {
    // Errors during conversation/db setup or key resolution.
    useGenerationStore.getState().setError(classifyError(raw, false));
    busyRef.current = false;
  }
}

/**
 * Owns the full "send a user turn" pipeline: creating the conversation when
 * needed, persisting the user message, streaming the Gemini response into the
 * generation store and committing the finished model message.
 */
export function useSendMessage() {
  const busyRef = useRef(false);

  const send = useCallback(
    (opts: { text: string; pendingAttachments?: PendingAttachment[]; model?: string }) => {
      return runTurn(
        {
          text: opts.text,
          promptAttachments: opts.pendingAttachments ?? [],
          modelId: opts.model,
        },
        busyRef,
      );
    },
    [],
  );

  /** Re-sends the most recent user message of the active conversation. */
  const retryLast = useCallback(() => {
    const conv = useConversationStore.getState();
    const lastUser = [...conv.messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return Promise.resolve();
    return runTurn(
      {
        text: lastUser.content,
        promptAttachments: lastUser.attachments.map((a) => ({ attachment: a, file: null })),
        modelId: conv.activeConversation?.model,
        preferredConversationId: lastUser.conversationId,
        isRetry: true,
      },
      busyRef,
    );
  }, []);

  return { send, retryLast };
}