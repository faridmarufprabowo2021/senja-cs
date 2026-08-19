import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.string().default("development"),
  API_PORT: z.coerce.number().default(4000),
  DATABASE_URL: z
    .string()
    .default("postgresql://cs:cs_secret@localhost:5432/customer_service"),
  JWT_SECRET: z.string().min(16).default("dev-jwt-secret-change-me-32chars"),
  CORS_ORIGIN: z.string().default("http://localhost:3001"),
  WEB_URL: z.string().default("http://localhost:3001"),
  WA_AUTH_DIR: z.string().default("./.wa-auth"),
  LLM_API_KEY: z.string().optional(),
  LLM_BASE_URL: z.string().default("https://openagentic.id/api/v1"),
  LLM_CHAT_MODEL: z.string().default("claude-sonnet-4.5"),
  /** Empty = always use local hash embeddings (Claude gateways often have no /embeddings). */
  LLM_EMBED_MODEL: z.string().optional().default(""),
  STORAGE_LOCAL_PATH: z.string().default("./uploads"),
  MIDTRANS_SERVER_KEY: z.string().default("SB-Mid-server-placeholder"),
  MIDTRANS_CLIENT_KEY: z.string().default("SB-Mid-client-placeholder"),
  MIDTRANS_IS_PRODUCTION: z.coerce.boolean().default(false),
  SHIPPING_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  KAGIRO_API_KEY: z.string().optional().default("sk-28d3cbf62fd8fb00-xz8f3p-a59cd92d"),
  KAGIRO_BASE_URL: z.string().default("https://api.kagiro.net/v1"),
  KAGIRO_CHAT_MODEL: z.string().default("kagiro/qwen3-8max"),
});

export const env = schema.parse({
  NODE_ENV: process.env.NODE_ENV,
  API_PORT: process.env.API_PORT,
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET ?? process.env.BETTER_AUTH_SECRET,
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? process.env.WEB_URL,
  WEB_URL: process.env.WEB_URL,
  WA_AUTH_DIR: process.env.WA_AUTH_DIR ?? process.env.WA_AUTH_ROOT,
  LLM_API_KEY: process.env.LLM_API_KEY || undefined,
  LLM_BASE_URL: process.env.LLM_BASE_URL,
  LLM_CHAT_MODEL: process.env.LLM_CHAT_MODEL,
  LLM_EMBED_MODEL: process.env.LLM_EMBED_MODEL ?? "",
  STORAGE_LOCAL_PATH: process.env.STORAGE_LOCAL_PATH,
  MIDTRANS_SERVER_KEY: process.env.MIDTRANS_SERVER_KEY,
  MIDTRANS_CLIENT_KEY: process.env.MIDTRANS_CLIENT_KEY,
  MIDTRANS_IS_PRODUCTION: process.env.MIDTRANS_IS_PRODUCTION,
  SHIPPING_API_KEY: process.env.SHIPPING_API_KEY || process.env.BINDERBYTE_API_KEY,
  GROQ_API_KEY: process.env.GROQ_API_KEY || undefined,
  KAGIRO_API_KEY: process.env.KAGIRO_API_KEY || "sk-28d3cbf62fd8fb00-xz8f3p-a59cd92d",
  KAGIRO_BASE_URL: process.env.KAGIRO_BASE_URL || "https://api.kagiro.net/v1",
  KAGIRO_CHAT_MODEL: process.env.KAGIRO_CHAT_MODEL || "kagiro/qwen3-8max",
});

export const hasLlm = Boolean(env.LLM_API_KEY);
export const hasRemoteEmbed = Boolean(env.LLM_API_KEY && env.LLM_EMBED_MODEL);
