import { Observability, SamplingStrategyType } from "@mastra/observability";
import { LangfuseExporter } from "@mastra/langfuse";

/**
 * Mastra observability wired to Langfuse. LangfuseExporter disables itself when
 * LANGFUSE_* keys are missing (no crash in local dev without Langfuse).
 */
export function createObservability(): Observability {
  return new Observability({
    configs: {
      langfuse: {
        serviceName: "messages-to-actions",
        sampling: { type: SamplingStrategyType.ALWAYS },
        requestContextKeys: [
          "triage.runId",
          "triage.source",
          "triage.channel",
          "triage.slackTeamId",
          "triage.slackEventId",
        ],
        serializationOptions: {
          maxStringLength: 12_000,
          maxDepth: 10,
          maxArrayLength: 64,
          maxObjectKeys: 48,
        },
        exporters: [
          new LangfuseExporter({
            publicKey: process.env.LANGFUSE_PUBLIC_KEY,
            secretKey: process.env.LANGFUSE_SECRET_KEY,
            baseUrl: process.env.LANGFUSE_BASE_URL,
            realtime: process.env.NODE_ENV !== "production",
            options: {
              environment: process.env.NODE_ENV ?? "development",
              release: process.env.LANGFUSE_RELEASE,
            },
          }),
        ],
      },
    },
  });
}
