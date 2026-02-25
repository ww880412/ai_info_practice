# Phase 1 Implementation Plan: Basic Flow + Settings

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Run the basic flow (ingest → parse → AI process → view in library) and add Settings page for API key configuration.

**Architecture:**
- Settings stored in localStorage for simplicity (vs. database table)
- Settings API route to validate and return config status
- Navbar button to access Settings page
- Tailwind CSS v4 for styling

**Tech Stack:** Next.js 16, React 19, Prisma 5.22.0, Tailwind CSS v4, Gemini API

---

## Pre-requisites Check

### Task 0: Environment Verification

**Step 1: Check if Docker is running**

Run:
```bash
docker ps | grep ai-practice-postgres
```

Expected: Should show running postgres container OR not found.

If not running:
```bash
cd /Users/ww/Desktop/mycode/ai_info_practice
docker-compose up -d
```

**Step 2: Generate Prisma Client**

Run:
```bash
cd /Users/ww/Desktop/mycode/ai_info_practice
npx prisma generate
```

Expected: Success message with "Generated Prisma Client".

**Step 3: Run database migration**

Run:
```bash
npx prisma db push
```

Expected: "Your database is in sync with your Prisma schema."

---

## Task 1: Add Settings Page

### 1.1 Create Settings Page

**Files:**
- Create: `src/app/settings/page.tsx`
- Modify: `src/components/common/Navbar.tsx`

**Step 1: Create Settings Page**

Create `src/app/settings/page.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import { Settings as SettingsIcon, Eye, EyeOff, Check, AlertCircle } from "lucide-react";

interface ConfigState {
  geminiApiKey: string;
  geminiModel: string;
  isValid: boolean;
  isChecking: boolean;
}

export default function SettingsPage() {
  const [config, setConfig] = useState<ConfigState>({
    geminiApiKey: "",
    geminiModel: "gemini-2.0-flash-exp",
    isValid: false,
    isChecking: false,
  });
  const [showKey, setShowKey] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  // Load config from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("ai-practice-config");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setConfig((prev) => ({
          ...prev,
          geminiApiKey: parsed.geminiApiKey || "",
          geminiModel: parsed.geminiModel || "gemini-2.0-flash-exp",
        }));
      } catch {
        // Ignore parse errors
      }
    }
  }, []);

  const handleSave = async () => {
    setSaveStatus("saving");
    try {
      // Save to localStorage
      localStorage.setItem(
        "ai-practice-config",
        JSON.stringify({
          geminiApiKey: config.geminiApiKey,
          geminiModel: config.geminiModel,
        })
      );

      // Validate by calling API
      const res = await fetch("/api/config/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: config.geminiApiKey,
          model: config.geminiModel,
        }),
      });

      if (res.ok) {
        setSaveStatus("saved");
        setConfig((prev) => ({ ...prev, isValid: true }));
      } else {
        setSaveStatus("error");
      }
    } catch {
      setSaveStatus("error");
    }

    setTimeout(() => setSaveStatus("idle"), 2000);
  };

  const handleReset = () => {
    localStorage.removeItem("ai-practice-config");
    setConfig({
      geminiApiKey: "",
      geminiModel: "gemini-2.0-flash-exp",
      isValid: false,
      isChecking: false,
    });
    setSaveStatus("idle");
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-secondary mt-1">Configure your API keys and preferences</p>
      </div>

      <div className="space-y-6">
        {/* API Configuration */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">API Configuration</h2>

          <div className="space-y-4">
            {/* Gemini API Key */}
            <div>
              <label className="block text-sm font-medium mb-1">Gemini API Key</label>
              <div className="relative">
                <input
                  type={showKey ? "text" : "password"}
                  value={config.geminiApiKey}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, geminiApiKey: e.target.value }))
                  }
                  placeholder="Enter your Gemini API key"
                  className="w-full px-3 py-2 pr-10 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-secondary hover:text-foreground"
                >
                  {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <p className="text-xs text-secondary mt-1">
                Get your API key from{" "}
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Google AI Studio
                </a>
              </p>
            </div>

            {/* Gemini Model */}
            <div>
              <label className="block text-sm font-medium mb-1">Gemini Model</label>
              <select
                value={config.geminiModel}
                onChange={(e) => setConfig((prev) => ({ ...prev, geminiModel: e.target.value }))}
                className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="gemini-2.0-flash-exp">Gemini 2.0 Flash (Experimental)</option>
                <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
              </select>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saveStatus === "saving"}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            {saveStatus === "saving" ? (
              <>Saving...</>
            ) : saveStatus === "saved" ? (
              <>
                <Check size={18} /> Saved
              </>
            ) : saveStatus === "error" ? (
              <>
                <AlertCircle size={18} /> Error
              </>
            ) : (
              "Save"
            )}
          </button>
          <button
            onClick={handleReset}
            className="px-4 py-2 border border-border rounded-md hover:bg-accent"
          >
            Reset to Default
          </button>
        </div>

        {/* Status */}
        {config.geminiApiKey && (
          <div className="bg-muted rounded-md p-4">
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${config.isValid ? "bg-green-500" : "bg-yellow-500"}`}
              />
              <span className="text-sm">
                {config.isValid
                  ? "API key is valid"
                  : "API key not validated yet - save to verify"}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Add Settings button to Navbar**

Modify `src/components/common/Navbar.tsx`:

Add SettingsIcon import:
```tsx
import { BookOpen, Zap, Settings } from "lucide-react";
```

Add to navItems array:
```tsx
const navItems = [
  { href: "/library", label: "Knowledge Base", icon: BookOpen },
  { href: "/practice", label: "Practice", icon: Zap },
  { href: "/settings", label: "Settings", icon: Settings },
];
```

### 1.2 Create Config Validate API

**Files:**
- Create: `src/app/api/config/validate/route.ts`

**Step 1: Create API route**

Create `src/app/api/config/validate/route.ts`:

```ts
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
```

### 1.3 Update Gemini Module to Use Runtime Config

**Files:**
- Modify: `src/lib/gemini.ts`

**Step 1: Update Gemini to check localStorage config first**

Modify `src/lib/gemini.ts`:

Replace the top of the file:

```ts
import { GoogleGenerativeAI } from "@google/generative-ai";

function getApiKey(): string {
  // First check localStorage (user configured)
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("ai-practice-config");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.geminiApiKey) {
          return parsed.geminiApiKey;
        }
      } catch {
        // Ignore
      }
    }
  }
  // Fallback to environment variable
  return process.env.GEMINI_API_KEY || "";
}

function getModel(): string {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("ai-practice-config");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.geminiModel) {
          return parsed.geminiModel;
        }
      } catch {
        // Ignore
      }
    }
  }
  return process.env.GEMINI_MODEL || "gemini-2.0-flash-exp";
}

let genAI: GoogleGenerativeAI | null = null;
let currentModel: string = "";

function getGenAI(): GoogleGenerativeAI {
  const apiKey = getApiKey();
  if (!genAI || apiKey !== process.env.GEMINI_API_KEY) {
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

export function getGeminiModel() {
  const model = getModel();
  if (currentModel !== model || !genAI) {
    genAI = getGenAI();
    currentModel = model;
  }
  return genAI.getGenerativeModel({ model });
}
```

---

## Task 2: Verify Basic Flow

### 2.1 Start Development Server

**Step 1: Run dev server**

Run:
```bash
cd /Users/ww/Desktop/mycode/ai_info_practice
npm run dev
```

Expected: "Ready on http://localhost:3001"

**Step 2: Verify Settings page**

Open browser: http://localhost:3001/settings

Expected: Settings page renders with API key input

**Step 3: Configure API key**

1. Enter your Gemini API key in the input field
2. Click Save
3. Should show "Saved" and "API key is valid"

### 2.2 Test Ingest Flow

**Step 1: Go to Knowledge Base**

Open: http://localhost:3001/library

Expected: Library page loads (may be empty)

**Step 2: Click Add Entry**

Click the "+" or "Add" button to open ingest dialog

**Step 3: Submit a test entry**

Try submitting:
- Input type: LINK or TEXT
- For TEXT: Paste a short AI-related article or note

**Step 4: Verify processing**

- Entry should appear in library with status "Processing..."
- After AI processing, status should update to "Done"
- Should see extracted tags, summary, etc.

---

## Task 3: UI Polish (Optional)

If time permits, consider these improvements:

### 3.1 EntryCard Improvements

- Add content type badge
- Show processing status more clearly
- Add hover effects

### 3.2 Filter Improvements

- Make filters more compact
- Add "Clear all" button

### 3.3 Loading States

- Add skeleton loaders for cards
- Show progress during AI processing

---

## Summary

After completing Phase 1, you should have:

1. ✅ Working dev environment with database
2. ✅ Settings page accessible from navbar
3. ✅ API key configurable via UI
4. ✅ End-to-end flow: ingest → parse → AI process → view
5. ✅ UI that shows entry cards with filtering

**Next Phase (V2):**
- Deduplication detection
- Smart summary generation
- Association discovery
