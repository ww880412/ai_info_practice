/**
 * Request Validation Module for API Credentials
 *
 * Validates credential requests before processing to ensure:
 * - Provider is in allowlist
 * - Name follows naming conventions
 * - API key meets minimum requirements
 * - Base URL is valid format
 * - Config parameters are within acceptable ranges
 */

const PROVIDER_ALLOWLIST = ['gemini', 'crs', 'openai-compatible'] as const;

export type CredentialProvider = typeof PROVIDER_ALLOWLIST[number];

export interface ValidationErrors {
  provider?: string;
  name?: string;
  apiKey?: string;
  baseUrl?: string;
  config?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationErrors;
}

export function validateCredentialRequest(data: any): ValidationResult {
  const errors: ValidationErrors = {};

  // Provider validation
  if (!data.provider || !PROVIDER_ALLOWLIST.includes(data.provider)) {
    errors.provider = `Provider must be one of: ${PROVIDER_ALLOWLIST.join(', ')}`;
  }

  // Name validation (1-50 chars, alphanumeric + spaces/dashes)
  if (data.name && !/^[a-zA-Z0-9\s\-]{1,50}$/.test(data.name)) {
    errors.name = 'Name must be 1-50 characters (alphanumeric, spaces, dashes only)';
  }

  // API key validation
  if (!data.apiKey || data.apiKey.length < 8) {
    errors.apiKey = 'API key is required and must be at least 8 characters';
  }

  // Base URL validation (if provided)
  if (data.baseUrl) {
    try {
      new URL(data.baseUrl);
    } catch {
      errors.baseUrl = 'Invalid URL format';
    }
  }

  // Config validation (if provided)
  if (data.config) {
    if (data.config.temperature !== undefined) {
      if (typeof data.config.temperature !== 'number' || data.config.temperature < 0 || data.config.temperature > 2) {
        errors.config = 'Temperature must be between 0 and 2';
      }
    }
    if (data.config.maxTokens !== undefined) {
      if (typeof data.config.maxTokens !== 'number' || data.config.maxTokens < 1) {
        errors.config = 'Max tokens must be a positive number';
      }
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
}
