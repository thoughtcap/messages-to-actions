# messages-to-actions

AI agent that triages incoming messages (from Slack or manual paste) and creates actionable items in a Notion database. All interactions are traced via Langfuse.

## Stack

- **[Mastra](https://mastra.ai)** — TypeScript AI agent framework
- **OpenAI GPT-4o** — LLM for message analysis
- **[Langfuse](https://langfuse.com)** — Observability & tracing
- **[Notion API](https://developers.notion.com)** — Action item storage
- **Hono** — HTTP server (Slack webhook + UI)

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in your keys:

| Variable | Where to get it |
|---|---|
| `OPENAI_API_KEY` | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| `LANGFUSE_PUBLIC_KEY` | Langfuse project → Settings → API Keys |
| `LANGFUSE_SECRET_KEY` | Same as above |
| `LANGFUSE_BASE_URL` | `https://cloud.langfuse.com` (EU) or `https://us.cloud.langfuse.com` (US) |
| `NOTION_API_KEY` | [notion.so/my-integrations](https://www.notion.so/my-integrations) |
| `NOTION_DATABASE_ID` | ID from your Notion database URL |
| `SLACK_SIGNING_SECRET` | Slack app → Basic Information → Signing Secret |

### 3. Set up your Notion database

Create a Notion database with these properties:

| Property | Type |
|---|---|
| Title | Title |
| Description | Rich text |
| Priority | Select (`high`, `medium`, `low`) |
| Source | Select (`slack`, `manual`) |
| Status | Select (`To Do`, `In Progress`, `Done`) |
| Original Message | Rich text |
| Sender | Rich text |
| Channel | Rich text |
| Due Date | Date |

Then share the database with your Notion integration (click "..." → "Connections" → add your integration).

### 4. Run

```bash
npm run dev
```

Open [http://localhost:4111](http://localhost:4111) for the web UI.

## Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/` | GET | Web UI for pasting messages |
| `/webhooks/slack` | POST | Slack Events API webhook |
| `/api/triage` | POST | Manual message submission |
| `/health` | GET | Health check |
| `/mastra/api/agents` | GET | Mastra agent API |

## Slack Setup

1. Create a Slack app at [api.slack.com/apps](https://api.slack.com/apps)
2. Enable **Event Subscriptions** and set the Request URL to `https://your-domain/webhooks/slack`
3. Subscribe to `message.channels` and/or `message.im` bot events
4. Install the app to your workspace
5. Add the `SLACK_SIGNING_SECRET` to your `.env`

For local development, use [ngrok](https://ngrok.com) or [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) to expose your local server.

## Observability

All agent interactions are automatically traced in Langfuse. View traces at your [Langfuse dashboard](https://cloud.langfuse.com) to see:

- Full conversation traces with token usage
- Tool calls (Notion API interactions)
- Latency breakdown per step
- Cost tracking
