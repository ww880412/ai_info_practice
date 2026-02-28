"use client";

import { useState } from "react";
import { Eye, EyeOff, Check, AlertCircle, Shield } from "lucide-react";

const CONFIG_STORAGE_KEY = "ai-practice-config";
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

interface ConfigState {
  geminiApiKey: string;
  geminiModel: string;
  credentialId: string | null;
  keyHint: string | null;
  isValid: boolean;
  isChecking: boolean;
}

function getInitialConfig(): ConfigState {
  const defaultConfig: ConfigState = {
    geminiApiKey: "",
    geminiModel: DEFAULT_GEMINI_MODEL,
    credentialId: null,
    keyHint: null,
    isValid: false,
    isChecking: false,
  };

  if (typeof window === "undefined") return defaultConfig;

  const saved = localStorage.getItem(CONFIG_STORAGE_KEY);
  if (!saved) return defaultConfig;

  try {
    const parsed = JSON.parse(saved);
    return {
      ...defaultConfig,
      geminiApiKey: "", // Never load raw key from localStorage
      geminiModel:
        typeof parsed?.geminiModel === "string" && parsed.geminiModel
          ? parsed.geminiModel
          : DEFAULT_GEMINI_MODEL,
      credentialId: parsed?.credentialId || null,
      keyHint: parsed?.keyHint || null,
      isValid: !!parsed?.credentialId,
    };
  } catch {
    return defaultConfig;
  }
}

export default function SettingsPage() {
  const [config, setConfig] = useState<ConfigState>(() => getInitialConfig());
  const [showKey, setShowKey] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const handleSave = async () => {
    setSaveStatus("saving");
    try {
      // Validate and store credential on server
      const res = await fetch("/api/config/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: config.geminiApiKey,
          model: config.geminiModel,
          credentialId: config.credentialId,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        // Only store credentialId and model locally (not the raw key)
        localStorage.setItem(
          CONFIG_STORAGE_KEY,
          JSON.stringify({
            credentialId: data.credentialId,
            keyHint: data.keyHint,
            geminiModel: config.geminiModel,
          })
        );
        setConfig((prev) => ({
          ...prev,
          geminiApiKey: "", // Clear raw key from memory
          credentialId: data.credentialId,
          keyHint: data.keyHint,
          isValid: true,
        }));
        setSaveStatus("saved");
      } else {
        setSaveStatus("error");
      }
    } catch {
      setSaveStatus("error");
    }

    setTimeout(() => setSaveStatus("idle"), 2000);
  };

  const handleReset = () => {
    localStorage.removeItem(CONFIG_STORAGE_KEY);
    setConfig({
      geminiApiKey: "",
      geminiModel: DEFAULT_GEMINI_MODEL,
      credentialId: null,
      keyHint: null,
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
              {config.credentialId ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                  <Shield size={16} className="text-green-600" />
                  <span className="text-sm text-green-700 dark:text-green-300">
                    Securely stored (Key: {config.keyHint})
                  </span>
                  <button
                    type="button"
                    onClick={() => setConfig((prev) => ({ ...prev, credentialId: null, keyHint: null, isValid: false }))}
                    className="ml-auto text-xs text-green-600 hover:underline"
                  >
                    Change Key
                  </button>
                </div>
              ) : (
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
              )}
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
                . Keys are encrypted and stored securely on the server.
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
