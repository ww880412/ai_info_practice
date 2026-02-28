import { NextRequest, NextResponse } from "next/server";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";
import { prisma } from "@/lib/prisma";
import { encryptApiKey, getKeyHint } from "@/lib/crypto";

export async function POST(request: NextRequest) {
  try {
    const { apiKey, model, credentialId } = await request.json();

    if (!apiKey) {
      return NextResponse.json(
        { error: "API key is required" },
        { status: 400 }
      );
    }

    // Use a stable model for validation
    const validationModel = model?.includes("preview") || model?.includes("exp")
      ? "gemini-2.0-flash"
      : (model || "gemini-2.0-flash");

    // Validate API key by making a simple request using Vercel AI SDK
    const google = createGoogleGenerativeAI({ apiKey });
    await generateText({
      model: google(validationModel),
      prompt: "Hi",
    });

    // Store encrypted credential in database
    const encryptedKey = encryptApiKey(apiKey);
    const keyHint = getKeyHint(apiKey);

    let credential;
    if (credentialId) {
      // Update existing credential
      credential = await prisma.apiCredential.update({
        where: { id: credentialId },
        data: {
          encryptedKey,
          keyHint,
          model: model || "gemini-2.5-flash",
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
          provider: "gemini",
          model: model || "gemini-2.5-flash",
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
      : "Invalid API key";
    return NextResponse.json(
      { error: errorMessage },
      { status: 400 }
    );
  }
}
