import { NextRequest, NextResponse } from "next/server";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";
import { prisma } from "@/lib/prisma";
import { encryptApiKey, getKeyHint } from "@/lib/crypto";
import { createCRSLanguageModel, validateCRSUrl, type CRSConfig } from "@/lib/ai/providers/crs";

export async function POST(request: NextRequest) {
  try {
    const { apiKey, model, credentialId, provider, baseUrl } = await request.json();

    const normalizedProvider =
      provider === "crs" || provider === "local-proxy" || provider === "openai-compatible"
        ? provider
        : "gemini";

    if (!apiKey) {
      return NextResponse.json(
        { error: "API key is required" },
        { status: 400 }
      );
    }

    if (normalizedProvider === "crs") {
      const crsBaseUrl = baseUrl || process.env.CRS_BASE_URL || "https://ls.xingchentech.asia/openai";
      validateCRSUrl(crsBaseUrl);

      const crsConfig: CRSConfig = {
        enabled: true,
        baseUrl: crsBaseUrl,
        apiKey,
        model: model || process.env.CRS_MODEL || "gpt-5.3-codex",
        reasoningEffort: "low",
      };

      await generateText({
        model: createCRSLanguageModel(crsConfig),
        prompt: "Hi",
      });
    } else if (normalizedProvider === "local-proxy" || normalizedProvider === "openai-compatible") {
      const proxyBaseUrl = baseUrl || process.env.LOCAL_PROXY_URL || "http://127.0.0.1:8045/v1";
      const proxyModel = model || process.env.LOCAL_PROXY_MODEL || "gemini-3.1-pro-high";
      const proxy = createOpenAICompatible({
        name: normalizedProvider,
        baseURL: proxyBaseUrl,
        apiKey,
      });

      await generateText({
        model: proxy.chatModel(proxyModel),
        prompt: "Hi",
      });
    } else {
      const validationModel = model?.includes("preview") || model?.includes("exp")
        ? "gemini-2.0-flash"
        : (model || "gemini-2.0-flash");

      const google = createGoogleGenerativeAI({ apiKey });
      await generateText({
        model: google(validationModel),
        prompt: "Hi",
      });
    }

    // Store encrypted credential in database
    const encryptedKey = encryptApiKey(apiKey);
    const keyHint = getKeyHint(apiKey);

    const defaultModel = normalizedProvider === "crs"
      ? "gpt-5.3-codex"
      : (normalizedProvider === "local-proxy" || normalizedProvider === "openai-compatible")
        ? "gemini-3.1-pro-high"
        : "gemini-2.5-flash";

    const storedBaseUrl = normalizedProvider === "gemini"
      ? null
      : (baseUrl || null);

    let credential;
    if (credentialId) {
      // Update existing credential
      credential = await prisma.apiCredential.update({
        where: { id: credentialId },
        data: {
          encryptedKey,
          keyHint,
          provider: normalizedProvider,
          baseUrl: storedBaseUrl,
          model: model || defaultModel,
          isValid: true,
          lastValidatedAt: new Date(),
        },
      });
    } else {
      // Create new credential
      credential = await prisma.apiCredential.create({
        data: {
          encryptedKey,
          keyHint,
          provider: normalizedProvider,
          baseUrl: storedBaseUrl,
          model: model || defaultModel,
          isValid: true,
          lastValidatedAt: new Date(),
        },
      });
    }

    return NextResponse.json({
      valid: true,
      credentialId: credential.id,
      keyHint: credential.keyHint,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);

    // Distinguish between API key errors and internal errors
    if (message.includes("KEY_ENCRYPTION_SECRET") || message.includes("Prisma") || message.includes("database")) {
      console.error("Config validation internal error:", message);
      return NextResponse.json(
        { error: "Server configuration error. Please contact support." },
        { status: 500 }
      );
    }

    // Log sanitized error for debugging
    console.error("Config validation error:", message.replace(/AIza[a-zA-Z0-9_-]+/g, "[API_KEY_REDACTED]"));

    const errorMessage = message.includes("model")
      ? "Invalid model name"
      : "Invalid API key or provider configuration";
    return NextResponse.json(
      { error: errorMessage },
      { status: 400 }
    );
  }
}
