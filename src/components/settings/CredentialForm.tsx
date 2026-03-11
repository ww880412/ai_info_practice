"use client";

import { useState } from "react";
import { AlertCircle } from "lucide-react";
import type { ApiCredential } from "@prisma/client";

interface CredentialFormData {
  provider: string;
  name: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  isDefault: boolean;
  validate: boolean;
}

interface CredentialFormProps {
  mode: "create" | "edit";
  credential?: ApiCredential;
  onSubmit: (data: CredentialFormData) => Promise<void>;
  onCancel: () => void;
}

export function CredentialForm({ mode, credential, onSubmit, onCancel }: CredentialFormProps) {
  const [formData, setFormData] = useState<CredentialFormData>({
    provider: credential?.provider || "gemini",
    name: credential?.name || "",
    apiKey: "",
    baseUrl: credential?.baseUrl || "",
    model: credential?.model || "",
    isDefault: credential?.isDefault || false,
    validate: true,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    } else if (!/^[a-zA-Z0-9\s\-]{1,50}$/.test(formData.name)) {
      newErrors.name = "Name must be 1-50 characters (alphanumeric, spaces, dashes only)";
    }

    if (mode === "create" && !formData.apiKey) {
      newErrors.apiKey = "API key is required";
    } else if (formData.apiKey && formData.apiKey.length < 8) {
      newErrors.apiKey = "API key must be at least 8 characters";
    }

    if (formData.baseUrl) {
      try {
        new URL(formData.baseUrl);
      } catch {
        newErrors.baseUrl = "Invalid URL format";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      await onSubmit(formData);
    } catch (error) {
      setErrors({ submit: error instanceof Error ? error.message : "Failed to save credential" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-card border border-border rounded-lg p-6">
      <h3 className="text-lg font-semibold mb-4">
        {mode === "create" ? "Add Provider" : "Edit Provider"}
      </h3>

      <div className="space-y-4">
        {/* Provider */}
        <div>
          <label htmlFor="provider" className="block text-sm font-medium mb-1">Provider</label>
          <select
            id="provider"
            value={formData.provider}
            onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
            disabled={mode === "edit"}
            className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
          >
            <option value="gemini">Gemini</option>
            <option value="crs">CRS</option>
            <option value="openai-compatible">OpenAI Compatible</option>
          </select>
        </div>

        {/* Name */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium mb-1">Name</label>
          <input
            id="name"
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Gemini Production"
            className={`w-full px-3 py-2 bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-primary ${
              errors.name ? "border-red-500" : "border-border"
            }`}
          />
          {errors.name && (
            <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
              <AlertCircle size={14} />
              {errors.name}
            </p>
          )}
        </div>

        {/* API Key */}
        <div>
          <label htmlFor="apiKey" className="block text-sm font-medium mb-1">
            API Key {mode === "edit" && "(leave blank to keep current)"}
          </label>
          <input
            id="apiKey"
            type="password"
            value={formData.apiKey}
            onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
            placeholder={mode === "edit" ? "Enter new API key" : "Enter API key"}
            className={`w-full px-3 py-2 bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-primary ${
              errors.apiKey ? "border-red-500" : "border-border"
            }`}
          />
          {errors.apiKey && (
            <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
              <AlertCircle size={14} />
              {errors.apiKey}
            </p>
          )}
        </div>

        {/* Base URL (for non-Gemini providers) */}
        {formData.provider !== "gemini" && (
          <div>
            <label htmlFor="baseUrl" className="block text-sm font-medium mb-1">Base URL</label>
            <input
              id="baseUrl"
              type="url"
              value={formData.baseUrl}
              onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
              placeholder="https://api.example.com"
              className={`w-full px-3 py-2 bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-primary ${
                errors.baseUrl ? "border-red-500" : "border-border"
              }`}
            />
            {errors.baseUrl && (
              <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                <AlertCircle size={14} />
                {errors.baseUrl}
              </p>
            )}
          </div>
        )}

        {/* Model */}
        <div>
          <label htmlFor="model" className="block text-sm font-medium mb-1">Model (optional)</label>
          <input
            id="model"
            type="text"
            value={formData.model}
            onChange={(e) => setFormData({ ...formData, model: e.target.value })}
            placeholder="e.g., gemini-2.0-flash"
            className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Checkboxes */}
        <div className="space-y-2">
          <label htmlFor="isDefault" className="flex items-center gap-2">
            <input
              id="isDefault"
              type="checkbox"
              checked={formData.isDefault}
              onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
              className="rounded"
            />
            <span className="text-sm">Set as default provider</span>
          </label>

          <label htmlFor="validate" className="flex items-center gap-2">
            <input
              id="validate"
              type="checkbox"
              checked={formData.validate}
              onChange={(e) => setFormData({ ...formData, validate: e.target.checked })}
              className="rounded"
            />
            <span className="text-sm">Validate credentials before saving</span>
          </label>
        </div>

        {/* Submit Error */}
        {errors.submit && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
            <span>{errors.submit}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-6">
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
        >
          {isSubmitting ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-border rounded-md hover:bg-accent"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
