import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(request: NextRequest) {
  try {
    const { apiKey, model } = await request.json();

    if (!apiKey) {
      return NextResponse.json(
        { error: "API key is required" },
        { status: 400 }
      );
    }

    // Validate API key by making a simple request
    const genAI = new GoogleGenerativeAI(apiKey);
    const testModel = genAI.getGenerativeModel({ model: model || "gemini-2.0-flash-exp" });

    await testModel.generateContent("Hi");

    return NextResponse.json({ valid: true });
  } catch (error) {
    console.error("Config validation error:", error);
    return NextResponse.json(
      { error: "Invalid API key or model" },
      { status: 400 }
    );
  }
}
