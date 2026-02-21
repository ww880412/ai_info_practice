"use client";

import { useState, useEffect } from "react";
import { Eye, EyeOff, Check, AlertCircle } from "lucide-react";

interface ConfigState {
  geminiApiKey: string;
  geminiModel: string;
  isValid: boolean;
  isChecking: boolean;
}

export default function SettingsPage() {
  const [config, setConfig] = useState<ConfigState>({
    geminiApiKey: "",
    geminiModel: "gemini-2.5-flash",
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
                <option value="gemini-2.0-flash">Gemini 2.0 Flash (Stable)</option>
                <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro Preview</option>
                <option value="gemini-3.0-flash-preview">Gemini 3.0 Flash Preview</option>
                <option value="gemini-1.5-flash-8b">Gemini 1.5 Flash 8B</option>
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
