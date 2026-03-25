import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verifies that an incoming request actually came from Slack
 * using the signing secret. Skipped if SLACK_SIGNING_SECRET is not set.
 * https://api.slack.com/authentication/verifying-requests-from-slack
 */
export function verifySlackRequest(
  signingSecret: string,
  body: string,
  timestamp: string | undefined,
  signature: string | undefined,
): boolean {
  if (!timestamp || !signature) return false;

  const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 60 * 5;
  if (parseInt(timestamp, 10) < fiveMinutesAgo) return false;

  const sigBasestring = `v0:${timestamp}:${body}`;
  const mySignature =
    "v0=" +
    createHmac("sha256", signingSecret).update(sigBasestring).digest("hex");

  return timingSafeEqual(
    Buffer.from(mySignature, "utf8"),
    Buffer.from(signature, "utf8"),
  );
}

export interface SlackMessageEvent {
  type: string;
  event?: {
    type: string;
    text?: string;
    user?: string;
    channel?: string;
    ts?: string;
    channel_type?: string;
    thread_ts?: string;
    bot_id?: string;
  };
  challenge?: string;
  event_id?: string;
  team_id?: string;
}
