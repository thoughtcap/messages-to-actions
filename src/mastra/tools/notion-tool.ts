import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const databaseId = process.env.NOTION_DATABASE_ID!;

export const addToNotionTool = createTool({
  id: "add-to-notion",
  description:
    "Adds an actionable item to the Notion database. Use when a message has been determined to be actionable.",
  inputSchema: z.object({
    title: z.string().describe("Short summary of the action item"),
    description: z
      .string()
      .describe("Full context and details about what needs to be done"),
    priority: z
      .enum(["high", "medium", "low"])
      .describe("Priority level based on urgency and importance"),
    source: z
      .string()
      .describe("Where the message came from (e.g. slack, manual)"),
    originalMessage: z.string().describe("The original message text"),
    sender: z
      .string()
      .optional()
      .describe("Who sent the message, if known"),
    channel: z
      .string()
      .optional()
      .describe("Slack channel or context where the message was sent"),
    dueDate: z
      .string()
      .optional()
      .describe("Suggested due date in ISO 8601 format, if mentioned or inferable"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    notionPageId: z.string().optional(),
    notionUrl: z.string().optional(),
    error: z.string().optional(),
  }),
  execute: async (input) => {
    try {
      const properties: Record<string, unknown> = {
        Title: {
          title: [{ text: { content: input.title } }],
        },
        Description: {
          rich_text: [{ text: { content: input.description } }],
        },
        Priority: {
          select: { name: input.priority },
        },
        Source: {
          select: { name: input.source },
        },
        Status: {
          select: { name: "To Do" },
        },
        "Original Message": {
          rich_text: [
            {
              text: {
                content: input.originalMessage.slice(0, 2000),
              },
            },
          ],
        },
      };

      if (input.sender) {
        properties["Sender"] = {
          rich_text: [{ text: { content: input.sender } }],
        };
      }

      if (input.channel) {
        properties["Channel"] = {
          rich_text: [{ text: { content: input.channel } }],
        };
      }

      if (input.dueDate) {
        properties["Due Date"] = {
          date: { start: input.dueDate },
        };
      }

      const page = await notion.pages.create({
        parent: { database_id: databaseId },
        properties: properties as any,
      });

      return {
        success: true,
        notionPageId: page.id,
        notionUrl: (page as any).url,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error creating Notion page";
      console.error("Notion tool error:", message);
      return { success: false, error: message };
    }
  },
});
