import { createChatStream } from "@/lib/ai/orchestrator";
import type { ChatMessage } from "@/lib/ai/orchestrator";
import {
  checkRateLimit,
  getClientIdentifier,
  rateLimitExceededResponse,
} from "@/lib/security/rate-limit";

export const maxDuration = 60;

export async function POST(req: Request) {
  const rl = checkRateLimit({
    key: `chat:${getClientIdentifier(req)}`,
    limit: 20,
    windowMs: 60_000,
  });
  if (!rl.allowed) {
    return rateLimitExceededResponse(rl);
  }

  try {
    const body = await req.json().catch(() => null);
    const messages = body?.messages;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Invalid messages array" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (messages.length > 50) {
      return new Response(
        JSON.stringify({ error: "Conversation history limit exceeded (max 50 messages)" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return await createChatStream(messages as ChatMessage[]);
  } catch (err) {
    console.error("[/api/chat] error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
