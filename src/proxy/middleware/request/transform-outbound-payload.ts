import { z } from "zod";
import type { ExpressHttpProxyReqCallback } from ".";

// https://console.anthropic.com/docs/api/reference#-v1-complete
const AnthropicV1CompleteSchema = z.object({
  model: z.string().regex(/^claude-/),
  prompt: z.string(),
  max_tokens_to_sample: z.number(),
  stop_sequences: z.array(z.string()).optional(),
  stream: z.boolean().optional().default(false),
  temperature: z.number().optional().default(1),
  top_k: z.number().optional().default(-1),
  top_p: z.number().optional().default(-1),
  metadata: z.any().optional(),
});

// https://platform.openai.com/docs/api-reference/chat/create
const OpenAIV1ChatCompletionSchema = z.object({
  model: z.string().regex(/^gpt/),
  messages: z.array(
    z.object({
      role: z.enum(["system", "user", "assistant"]),
      content: z.string(),
      name: z.string().optional(),
    })
  ),
  temperature: z.number().optional().default(1),
  top_p: z.number().optional().default(1),
  n: z.literal(1).optional(),
  stream: z.boolean().optional().default(false),
  stop: z.union([z.string(), z.array(z.string())]).optional(),
  max_tokens: z.number().optional(),
  frequency_penalty: z.number().optional().default(0),
  presence_penalty: z.number().optional().default(0),
  logit_bias: z.any().optional(),
  user: z.string().optional(),
});

/** Transforms an incoming request body to one that matches the target API. */
export const transformOutboundPayload: ExpressHttpProxyReqCallback = (
  _proxyReq,
  req
) => {
  const inboundService = req.api;
  const outboundService = req.key!.service;

  if (inboundService === outboundService) {
    return;
  }

  // Not supported yet and unnecessary as everything supports OpenAI.
  if (inboundService === "anthropic" && outboundService === "openai") {
    throw new Error(
      "Anthropic -> OpenAI request transformation not supported. Provide an OpenAI-compatible payload, or use the /claude endpoint."
    );
  }

  if (inboundService === "openai" && outboundService === "anthropic") {
    req.body = openaiToAnthropic(req.body);
    return;
  }

  throw new Error(
    `Unsupported transformation: ${inboundService} -> ${outboundService}`
  );
};

function openaiToAnthropic(body: any) {
  const { messages, ...rest } = OpenAIV1ChatCompletionSchema.parse(body);
  const prompt = messages
    .map((m) => {
      let role: string = m.role;
      if (role === "assistant") {
        role = "Assistant";
      } else if (role === "system") {
        role = "System";
      } else if (role === "user") {
        role = "Human";
      }
      // https://console.anthropic.com/docs/prompt-design
      // `name` isn't supported by Anthropic but we can still try to use it.
      return `\n\n${role}: ${m.name?.trim() ? `(as ${m.name}) ` : ""}${
        m.content
      }`;
    })
    .join("");
  return {
    ...rest,
    prompt,
    max_tokens_to_sample: rest.max_tokens,
    stop_sequences: rest.stop,
  };
}
