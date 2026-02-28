import { NextRequest, NextResponse } from "next/server";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";
import { setServerConfig } from "@/lib/ai/client";

export async function POST(request: NextRequest) {
  try {
    const { apiKey, model } = await request.json();

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

    // Set server config after successful validation
    setServerConfig({ apiKey, model });

    return NextResponse.json({ valid: true });
  } catch (error: unknown) {
    console.error("Config validation error:", error);
    const message = error instanceof Error ? error.message : String(error);
    // Return more detailed error
    const errorMessage = message.includes("model")
      ? "Invalid model name"
      : "Invalid API key";
    return NextResponse.json(
      { error: errorMessage },
      { status: 400 }
    );
  }
}
