import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { setServerConfig } from "@/lib/gemini";

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

    // Validate API key by making a simple request
    const genAI = new GoogleGenerativeAI(apiKey);
    const testModel = genAI.getGenerativeModel({ model: validationModel });

    await testModel.generateContent("Hi");

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
