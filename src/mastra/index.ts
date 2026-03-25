import { Mastra } from "@mastra/core";
import { triageAgent } from "./agents/triage-agent";
import { createObservability } from "./observability-factory";

const observability = createObservability();

export const mastra = new Mastra({
  agents: { triageAgent },
  observability,
});
