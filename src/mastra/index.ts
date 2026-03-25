import { Mastra } from "@mastra/core";
import { Observability } from "@mastra/observability";
import { LangfuseExporter } from "@mastra/langfuse";
import { triageAgent } from "./agents/triage-agent";

const observability = new Observability({
  configs: {
    langfuse: {
      serviceName: "messages-to-actions",
      exporters: [
        new LangfuseExporter({
          publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
          secretKey: process.env.LANGFUSE_SECRET_KEY!,
          baseUrl: process.env.LANGFUSE_BASE_URL,
          realtime: process.env.NODE_ENV !== "production",
          options: {
            environment: process.env.NODE_ENV ?? "development",
          },
        }),
      ],
    },
  },
});

export const mastra = new Mastra({
  agents: { triageAgent },
  observability,
});
