import {
  Observability,
  SamplingStrategyType,
  DefaultExporter,
  CloudExporter,
  SensitiveDataFilter,
} from "@mastra/observability";
import { LangfuseExporter } from "@mastra/langfuse";

/**
 * Mastra observability: local Studio traces + optional Mastra Cloud + Langfuse.
 *
 * - Use the `default` config name so this instance is the registry default (see Mastra Observability).
 * - LangfuseExporter disables itself when LANGFUSE_* keys are missing (no crash in local dev).
 * - SensitiveDataFilter runs before export to redact secrets/tokens/password-like fields in spans.
 * - requestContextKeys align with createTriageTraceContext (src/lib/triage-tracing.ts) for span metadata.
 */
export function createObservability(): Observability {
  return new Observability({
    configs: {
      default: {
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
        spanOutputProcessors: [new SensitiveDataFilter()],
        exporters: [
          new DefaultExporter(),
          new CloudExporter(),
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
