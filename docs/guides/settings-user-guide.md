# Settings User Guide - Multi-Provider Credential Management

> **Version**: 1.0
> **Last Updated**: 2026-03-11
> **Status**: Production Ready

## Overview

The Settings page allows you to manage multiple AI provider credentials securely. You can add, edit, test, and delete credentials for different AI providers (Gemini, CRS, OpenAI-compatible), set default providers, and validate credentials before use.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Adding Credentials](#adding-credentials)
3. [Editing Credentials](#editing-credentials)
4. [Testing Credentials](#testing-credentials)
5. [Setting Default Provider](#setting-default-provider)
6. [Deleting Credentials](#deleting-credentials)
7. [Security Best Practices](#security-best-practices)
8. [Troubleshooting](#troubleshooting)
9. [FAQ](#faq)

---

## Getting Started

### Accessing Settings

Navigate to the Settings page via:
- Main navigation menu → **Settings**
- Direct URL: `/settings`

### Understanding Credential Status

Each credential displays a status badge:
- **✅ Valid** (green): Credential tested successfully
- **⚠️ Not validated** (yellow): Credential not yet tested
- **❌ Invalid** (red): Credential failed validation

---

## Adding Credentials

### Step 1: Click "Add Provider"

On the Settings page, click the **"+ Add Provider"** button to open the credential form.

### Step 2: Fill in Required Fields

#### Provider (Required)
Select the AI provider type:
- **Gemini**: Google's Gemini API
- **CRS**: Codex Response Service (custom endpoint)
- **OpenAI Compatible**: Any OpenAI-compatible API (local or remote)

#### Name (Optional)
A friendly name for this credential (e.g., "Gemini Production", "Local Dev Server").
- **Format**: 1-50 characters, alphanumeric, spaces, and dashes only
- **Uniqueness**: Must be unique per provider
- **Auto-generated**: If left blank, a default name will be generated

#### API Key (Required)
Your API key for the selected provider.
- **Minimum length**: 8 characters
- **Security**: Stored encrypted using AES-256-GCM
- **Display**: Only the last 4 characters are shown (e.g., `...xyz123`)

#### Base URL (Provider-specific)
Custom API endpoint URL.
- **Gemini**: Not required (uses default Google endpoint)
- **CRS**: Optional (defaults to `CRS_BASE_URL` from environment)
- **OpenAI Compatible**: Required for custom endpoints

**SSRF Protection**: Base URLs are validated against allowlists to prevent Server-Side Request Forgery attacks.

#### Model (Optional)
The model identifier to use with this credential.
- **Examples**: `gemini-2.0-flash-exp`, `gpt-5.3-codex`, `llama-3-70b`
- **Fallback**: Uses provider default if not specified

### Step 3: Configure Options

#### Set as Default Provider
Check this box to make this credential the default for its provider type.
- Only one credential per provider can be default
- Setting a new default automatically unsets the previous one

#### Validate Credentials Before Saving
Check this box to test the credential immediately after creation.
- **Recommended**: Always validate new credentials
- **Timeout**: Validation requests timeout after 5 seconds
- **Result**: Credential is marked as valid/invalid based on test result

### Step 4: Save

Click **"Save"** to create the credential. If validation is enabled, you'll see the test result immediately.

---

## Editing Credentials

### Step 1: Click "Edit" on Credential Card

Each credential card has an **"Edit"** button.

### Step 2: Modify Fields

You can update:
- Name
- API Key (leave blank to keep existing key)
- Base URL
- Model
- Default status

**Note**: You cannot change the provider type. To switch providers, delete the credential and create a new one.

### Step 3: Save Changes

Click **"Save"** to apply changes. The credential will be re-validated if you enabled validation.

---

## Testing Credentials

### Manual Testing

Click the **"Test"** button on any credential card to validate it.

### What Happens During Testing

The system performs a lightweight API call to verify the credential:

- **Gemini**: Fetches model list from Google API
- **CRS**: Calls `/health` endpoint
- **OpenAI Compatible**: Fetches model list from `/v1/models`

### Test Results

- **Success**: Credential marked as valid, `lastValidatedAt` timestamp updated
- **Failure**: Credential marked as invalid, error message displayed

### Validation Timeout

All validation requests timeout after **5 seconds** to prevent hanging.

---

## Setting Default Provider

### Why Set a Default?

The default credential is automatically used when:
- Creating new entries
- Running AI processing tasks
- No specific credential is specified

### How to Set Default

1. Find the credential you want to make default
2. Click **"Set as Default"**
3. The previous default is automatically unset

### Multiple Defaults

If multiple credentials are accidentally marked as default (e.g., due to manual database edits), the system will:
- Keep the oldest credential as default
- Automatically unset others
- Run auto-repair on app startup

---

## Deleting Credentials

### Soft Delete

Credentials are **soft-deleted** (marked as inactive) rather than permanently removed.

### Restrictions

You **cannot** delete a credential if:
- It's the default credential for its provider
- It's the last active credential for its provider

### How to Delete

1. Click **"Delete"** on the credential card
2. Confirm the deletion
3. The credential is marked as inactive and hidden from the list

### Recovering Deleted Credentials

Deleted credentials can be recovered by a database administrator by setting `isActive = true`.

---

## Security Best Practices

### 1. API Key Management

- **Never share** API keys in screenshots or logs
- **Rotate keys** regularly (every 90 days recommended)
- **Use separate keys** for development and production
- **Revoke unused keys** immediately

### 2. Base URL Configuration

- **Validate URLs** before adding them
- **Use HTTPS** for production endpoints
- **Avoid private IPs** (10.x, 192.168.x, 127.x) - these are blocked by SSRF protection
- **Allowlist custom domains** via environment variables

### 3. Environment Variables

Store sensitive configuration in environment variables:

```env
# Encryption key (required)
KEY_ENCRYPTION_SECRET=at-least-32-characters-secret-key

# CRS configuration
CRS_BASE_URL=https://api.crs.example.com
CRS_BASE_URL_PATTERN=^https://api\.crs\.example\.com/

# OpenAI-compatible allowlist
OPENAI_COMPATIBLE_ALLOWLIST=api.openai.com,api.anthropic.com
```

### 4. Credential Validation

- **Always validate** new credentials before saving
- **Re-test periodically** to catch expired or revoked keys
- **Monitor validation errors** for security incidents

### 5. Access Control

- **Limit access** to the Settings page (future: role-based access control)
- **Audit changes** via application logs
- **Review credentials** regularly for unused or outdated entries

---

## Troubleshooting

### Problem: "Validation failed" Error

**Possible Causes**:
- Invalid API key
- Network connectivity issues
- API endpoint unreachable
- Rate limiting

**Solutions**:
1. Verify API key is correct
2. Check network connectivity
3. Test endpoint manually (curl/Postman)
4. Wait and retry if rate-limited

### Problem: "URL does not match allowlist patterns"

**Cause**: Base URL is not in the provider's allowlist.

**Solutions**:
1. **Gemini**: Use default endpoint (no custom URL needed)
2. **CRS**: Add URL to `CRS_BASE_URL` or `CRS_BASE_URL_PATTERN` environment variable
3. **OpenAI Compatible**: Add domain to `OPENAI_COMPATIBLE_ALLOWLIST`

### Problem: "Private IP addresses are not allowed"

**Cause**: Base URL resolves to a private IP address (SSRF protection).

**Solutions**:
1. Use public endpoints for production
2. For local development, use `localhost`, `127.0.0.1`, or `host.docker.internal`
3. Ensure URL is in the OpenAI-compatible allowlist

### Problem: "A credential with this name already exists"

**Cause**: Duplicate credential name for the same provider.

**Solutions**:
1. Choose a different name
2. Edit or delete the existing credential with that name

### Problem: Cannot Delete Default Credential

**Cause**: System prevents deleting the default credential.

**Solutions**:
1. Set another credential as default first
2. Then delete the original credential

### Problem: Cannot Delete Last Credential

**Cause**: System prevents deleting the last credential for a provider.

**Solutions**:
1. Add a new credential for that provider first
2. Then delete the old credential

### Problem: Validation Timeout

**Cause**: API endpoint took longer than 5 seconds to respond.

**Solutions**:
1. Check network latency
2. Verify endpoint is responsive
3. Try again later
4. Contact provider support if issue persists

---

## FAQ

### Q: How are API keys stored?

**A**: API keys are encrypted using AES-256-GCM encryption with a secret key from `KEY_ENCRYPTION_SECRET` environment variable. Only the encrypted value is stored in the database.

### Q: Can I use the same API key for multiple credentials?

**A**: Yes, but it's not recommended. Use separate keys for different environments (dev/staging/prod) for better security and tracking.

### Q: What happens if I don't set a default credential?

**A**: The system will fall back to environment variables (`GEMINI_API_KEY`, `CRS_API_KEY`, etc.) if no default credential is set.

### Q: Can I export/import credentials?

**A**: Not currently supported. Credentials must be added manually via the UI or seeded from environment variables.

### Q: How do I migrate from .env to database credentials?

**A**: Run the seed script: `npm run seed:credentials`. This will import credentials from environment variables if the database is empty.

### Q: What's the difference between "inactive" and "invalid"?

**A**:
- **Inactive** (`isActive = false`): Credential is soft-deleted and hidden
- **Invalid** (`isValid = false`): Credential failed validation test

### Q: Can I use local LLM servers?

**A**: Yes! Use the "OpenAI Compatible" provider type with `http://localhost:PORT` as the base URL. Localhost URLs are automatically allowlisted.

### Q: How often should I validate credentials?

**A**:
- **New credentials**: Always validate before saving
- **Existing credentials**: Re-test monthly or when errors occur
- **Production credentials**: Validate after any key rotation

### Q: What if multiple credentials are marked as default?

**A**: The system auto-repairs this on startup, keeping the oldest credential as default and unsetting others. You can also manually trigger repair via `/api/settings/repair`.

---

## Related Documentation

- [Settings Implementation Plan](../plans/2026-03-11-settings-implementation.md)
- [Settings Design Document](../plans/2026-03-11-settings-multi-provider.md)
- [SSRF Protection Module](../../src/lib/security/ssrf-protection.ts)
- [Encryption Module](../../src/lib/crypto.ts)

---

## Support

For issues or questions:
1. Check this guide's [Troubleshooting](#troubleshooting) section
2. Review error messages in the UI
3. Check application logs for detailed error information
4. Contact your system administrator

---

**Document Version**: 1.0
**Last Updated**: 2026-03-11
**Maintained By**: AI Practice Hub Team
