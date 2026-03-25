import type { TracingOptions } from "@mastra/core/observability";
import { RequestContext } from "@mastra/core/di";

export interface TriageTraceInput {
  source: string;
  sender?: string;
  channel?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Per-request trace context for Langfuse (via @mastra/langfuse):
 * - metadata.userId / metadata.sessionId are promoted to Langfuse user/session
 * - tags enable filtering (feature, source)
 * - requestContext keys are copied onto spans per observability config
 */
export function createTriageTraceContext(
  input: TriageTraceInput,
  runId: string,
): { requestContext: RequestContext; tracingOptions: TracingOptions } {
  const requestContext = new RequestContext();
  requestContext.set("triage.runId", runId);
  requestContext.set("triage.source", input.source);
  if (input.channel) {
    requestContext.set("triage.channel", input.channel);
  }
  const teamId = input.metadata?.team_id;
  if (typeof teamId === "string") {
    requestContext.set("triage.slackTeamId", teamId);
  }
  const eventId = input.metadata?.event_id;
  if (typeof eventId === "string") {
    requestContext.set("triage.slackEventId", eventId);
  }

  const userId = resolveUserId(input);
  const sessionId = resolveSessionId(input, runId);
  const maskContent = process.env.LANGFUSE_MASK_MESSAGE_CONTENT === "true";

  const tracingOptions: TracingOptions = {
    tags: ["feature:triage", `source:${input.source}`],
    metadata: {
      userId,
      sessionId,
      runId,
    },
    ...(maskContent ? { hideInput: true, hideOutput: true } : {}),
  };

  return { requestContext, tracingOptions };
}

function resolveUserId(input: TriageTraceInput): string {
  if (input.source === "slack") {
    return input.sender ? `slack:${input.sender}` : "slack:unknown";
  }
  const s = input.sender?.trim();
  return s ? `manual:${s}` : "manual:anonymous";
}

function resolveSessionId(input: TriageTraceInput, runId: string): string {
  if (input.source !== "slack") {
    return `manual:${runId}`;
  }
  const m = input.metadata ?? {};
  const team = typeof m.team_id === "string" ? m.team_id : "unknown";
  const channel = input.channel ?? "unknown";
  const threadKey =
    typeof m.thread_ts === "string" && m.thread_ts
      ? m.thread_ts
      : typeof m.ts === "string"
        ? m.ts
        : typeof m.event_id === "string"
          ? m.event_id
          : runId;
  return `slack:${team}:${channel}:${threadKey}`;
}
