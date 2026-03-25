import "dotenv/config";

import { randomUUID } from "node:crypto";

import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { cors } from "hono/cors";
import {
  MastraServer,
  type HonoBindings,
  type HonoVariables,
} from "@mastra/hono";
import { mastra } from "./mastra/index";
import { createTriageTraceContext } from "./lib/triage-tracing";
import { verifySlackRequest, type SlackMessageEvent } from "./lib/slack";

const app = new Hono<{ Bindings: HonoBindings; Variables: HonoVariables }>();

app.use("/*", cors());

// ──────────────────────────────────────────────
// Health check
// ──────────────────────────────────────────────
app.get("/health", (c) =>
  c.json({ status: "ok", timestamp: new Date().toISOString() }),
);

// ──────────────────────────────────────────────
// Slack webhook endpoint
// ──────────────────────────────────────────────
app.post("/webhooks/slack", async (c) => {
  const rawBody = await c.req.text();
  const payload: SlackMessageEvent = JSON.parse(rawBody);

  // Slack URL verification challenge
  if (payload.type === "url_verification" && payload.challenge) {
    return c.json({ challenge: payload.challenge });
  }

  // Verify signature if signing secret is configured
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (signingSecret) {
    const timestamp = c.req.header("x-slack-request-timestamp");
    const signature = c.req.header("x-slack-signature");
    if (!verifySlackRequest(signingSecret, rawBody, timestamp, signature)) {
      return c.json({ error: "Invalid signature" }, 401);
    }
  }

  // Only process message events (skip bot messages to avoid loops)
  if (
    payload.type !== "event_callback" ||
    payload.event?.type !== "message" ||
    payload.event?.bot_id
  ) {
    return c.json({ ok: true, skipped: true });
  }

  const event = payload.event;

  // Fire-and-forget: process asynchronously so Slack gets a fast 200
  processMessage({
    text: event.text ?? "",
    source: "slack",
    sender: event.user,
    channel: event.channel,
    metadata: {
      ts: event.ts,
      thread_ts: event.thread_ts,
      team_id: payload.team_id,
      event_id: payload.event_id,
    },
  }).catch((err) => console.error("Error processing Slack message:", err));

  return c.json({ ok: true });
});

// ──────────────────────────────────────────────
// Manual message submission (from the UI)
// ──────────────────────────────────────────────
app.post("/api/triage", async (c) => {
  const body = await c.req.json<{
    text: string;
    sender?: string;
    channel?: string;
  }>();

  if (!body.text?.trim()) {
    return c.json({ error: "Message text is required" }, 400);
  }

  const result = await processMessage({
    text: body.text,
    source: "manual",
    sender: body.sender,
    channel: body.channel,
  });

  return c.json(result);
});

// ──────────────────────────────────────────────
// Core processing function
// ──────────────────────────────────────────────
interface MessageInput {
  text: string;
  source: string;
  sender?: string;
  channel?: string;
  metadata?: Record<string, unknown>;
}

async function processMessage(input: MessageInput) {
  const runId = randomUUID();
  const agent = mastra.getAgentById("triage-agent");
  const prompt = buildPrompt(input);
  const { requestContext, tracingOptions } = createTriageTraceContext(
    {
      source: input.source,
      sender: input.sender,
      channel: input.channel,
      metadata: input.metadata,
    },
    runId,
  );

  const response = await agent.generate(prompt, {
    requestContext,
    tracingOptions,
  });

  return {
    runId,
    analysis: response.text,
    toolCalls: response.toolCalls,
    toolResults: response.toolResults,
    usage: response.usage,
  };
}

function buildPrompt(input: MessageInput): string {
  const parts = [`**Message:**\n${input.text}`];

  if (input.source) parts.push(`**Source:** ${input.source}`);
  if (input.sender) parts.push(`**Sender:** ${input.sender}`);
  if (input.channel) parts.push(`**Channel:** ${input.channel}`);

  return parts.join("\n\n");
}

// ──────────────────────────────────────────────
// Static files (UI)
// ──────────────────────────────────────────────
app.use("/*", serveStatic({ root: "./public" }));

// ──────────────────────────────────────────────
// Mastra server adapter (agent API, studio support)
// ──────────────────────────────────────────────
const server = new MastraServer({ app, mastra, prefix: "/mastra" });
await server.init();

// ──────────────────────────────────────────────
// Start
// ──────────────────────────────────────────────
const port = parseInt(process.env.PORT || "4111", 10);

async function shutdown(signal: string) {
  console.log(`\n${signal} received, flushing observability…`);
  try {
    await mastra.shutdown();
  } catch (err) {
    console.error("Shutdown error:", err);
  }
  process.exit(0);
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

serve({ fetch: app.fetch, port }, () => {
  console.log(`\n  messages-to-actions running on http://localhost:${port}`);
  console.log(`  UI:              http://localhost:${port}/`);
  console.log(`  Slack webhook:   http://localhost:${port}/webhooks/slack`);
  console.log(`  Manual triage:   POST http://localhost:${port}/api/triage`);
  console.log(`  Health:          http://localhost:${port}/health`);
  console.log(`  Mastra API:      http://localhost:${port}/mastra/api/agents\n`);
});
