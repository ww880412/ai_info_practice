"use client";

import { Check, X, AlertTriangle, Shield, Star } from "lucide-react";
import type { ApiCredential } from "@prisma/client";

interface CredentialCardProps {
  credential: ApiCredential;
  onEdit: () => void;
  onDelete: () => void;
  onTest: () => void;
  onSetDefault: () => void;
}

export function CredentialCard({
  credential,
  onEdit,
  onDelete,
  onTest,
  onSetDefault,
}: CredentialCardProps) {
  const getStatusIcon = () => {
    if (credential.isValid === null) {
      return <AlertTriangle size={16} className="text-yellow-600" />;
    }
    return credential.isValid ? (
      <Check size={16} className="text-green-600" />
    ) : (
      <X size={16} className="text-red-600" />
    );
  };

  const getStatusText = () => {
    if (credential.isValid === null) {
      return "Not validated";
    }
    return credential.isValid ? "Valid" : "Invalid";
  };

  const getStatusColor = () => {
    if (credential.isValid === null) {
      return "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800";
    }
    return credential.isValid
      ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
      : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800";
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold">{credential.name}</h3>
            {credential.isDefault && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary text-xs rounded">
                <Star size={12} />
                Default
              </span>
            )}
          </div>
          <p className="text-sm text-secondary">
            {credential.provider.toUpperCase()}
            {credential.model && ` • ${credential.model}`}
          </p>
        </div>
        <div className={`flex items-center gap-1 px-2 py-1 border rounded text-sm ${getStatusColor()}`}>
          {getStatusIcon()}
          <span>{getStatusText()}</span>
        </div>
      </div>

      {credential.baseUrl && (
        <div className="mb-3 text-sm text-secondary">
          <span className="font-medium">Base URL:</span> {credential.baseUrl}
        </div>
      )}

      <div className="flex items-center gap-2 mb-3 text-xs text-secondary">
        <Shield size={14} />
        <span>Key: {credential.keyHint}</span>
        {credential.lastValidatedAt && (
          <span>• Validated: {new Date(credential.lastValidatedAt).toLocaleDateString()}</span>
        )}
      </div>

      {credential.validationError && (
        <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-300">
          {credential.validationError}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={onTest}
          className="px-3 py-1.5 text-sm border border-border rounded hover:bg-accent"
        >
          Test
        </button>
        <button
          onClick={onEdit}
          className="px-3 py-1.5 text-sm border border-border rounded hover:bg-accent"
        >
          Edit
        </button>
        {!credential.isDefault && (
          <button
            onClick={onSetDefault}
            className="px-3 py-1.5 text-sm border border-border rounded hover:bg-accent"
          >
            Set as Default
          </button>
        )}
        <button
          onClick={onDelete}
          className="ml-auto px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
