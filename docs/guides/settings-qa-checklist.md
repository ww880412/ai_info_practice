# Settings Multi-Provider - Manual QA Checklist

> **Version**: 1.0
> **Date**: 2026-03-11
> **Tester**: [Your Name]
> **Environment**: [Dev/Staging/Production]

## Pre-Testing Setup

- [ ] Database migrated with new schema
- [ ] `KEY_ENCRYPTION_SECRET` set in environment
- [ ] Docker services running (`docker-compose ps`)
- [ ] Application accessible at http://localhost:3001

---

## 1. Database Schema & Migration

### 1.1 Schema Validation
- [ ] New fields exist in `ApiCredential` table:
  - [ ] `name` (String, nullable)
  - [ ] `isDefault` (Boolean, default false)
  - [ ] `isActive` (Boolean, default true)
  - [ ] `validationError` (String, nullable)
  - [ ] `config` (Json, nullable)
- [ ] Indexes created:
  - [ ] `@@unique([provider, name, isActive])`
  - [ ] `@@index([provider, isActive, isDefault])`
  - [ ] `@@index([provider, isDefault, createdAt])`

### 1.2 Migration Safety
- [ ] Existing credentials preserved (no data loss)
- [ ] Backfill script ran successfully
- [ ] Default flags set correctly (one per provider)

**Result**: ✅ Pass / ❌ Fail
**Notes**:

---

## 2. SSRF Protection

### 2.1 Private IP Blocking
Test URLs that should be **blocked**:
- [ ] `http://10.0.0.1/api`
- [ ] `http://192.168.1.1/api`
- [ ] `http://127.0.0.1:8080/api` (for non-OpenAI-compatible)
- [ ] `http://169.254.169.254/metadata` (AWS metadata)
- [ ] `http://[::1]/api` (IPv6 localhost)

### 2.2 Allowlist Enforcement
Test URLs that should be **allowed**:
- [ ] Gemini: `https://generativelanguage.googleapis.com/`
- [ ] CRS: URL matching `CRS_BASE_URL` or `CRS_BASE_URL_PATTERN`
- [ ] OpenAI-compatible: `http://localhost:8080`, `http://127.0.0.1:8080`, `http://host.docker.internal:8080`
- [ ] OpenAI-compatible: HTTPS domains in `OPENAI_COMPATIBLE_ALLOWLIST`

### 2.3 Edge Cases
- [ ] Invalid URL format rejected
- [ ] Missing protocol rejected
- [ ] DNS rebinding protection (future enhancement)

**Result**: ✅ Pass / ❌ Fail
**Notes**:

---

## 3. API Endpoints

### 3.1 GET /api/settings/credentials
- [ ] Returns list of active credentials
- [ ] Sorted by: provider (asc), isDefault (desc), createdAt (asc)
- [ ] `encryptedKey` NOT included in response
- [ ] Inactive credentials excluded

### 3.2 POST /api/settings/credentials
- [ ] Creates new credential successfully
- [ ] Validates required fields (provider, apiKey)
- [ ] Rejects invalid provider
- [ ] Rejects duplicate name
- [ ] Rejects invalid name format (>50 chars, special chars)
- [ ] Rejects short API key (<8 chars)
- [ ] SSRF protection enforced on baseUrl
- [ ] Transaction: Sets isDefault and unsets others
- [ ] Validation runs if `validate: true`
- [ ] `encryptedKey` NOT returned in response
- [ ] `keyHint` generated correctly (last 4 chars)

### 3.3 PUT /api/settings/credentials/[id]
- [ ] Updates existing credential
- [ ] Cannot change `provider` field
- [ ] Validates name uniqueness
- [ ] Transaction: Updates isDefault correctly
- [ ] Re-encrypts API key if changed
- [ ] `encryptedKey` NOT returned in response

### 3.4 DELETE /api/settings/credentials/[id]
- [ ] Soft deletes (sets `isActive = false`)
- [ ] Prevents deleting default credential
- [ ] Prevents deleting last credential for provider
- [ ] Returns appropriate error messages

### 3.5 POST /api/settings/credentials/[id]/validate
- [ ] Tests Gemini credentials (fetches model list)
- [ ] Tests CRS credentials (calls /health)
- [ ] Tests OpenAI-compatible credentials (fetches /v1/models)
- [ ] Updates `isValid`, `validationError`, `lastValidatedAt`
- [ ] Timeout enforced (5 seconds)
- [ ] Handles network errors gracefully

### 3.6 Error Handling
- [ ] Returns correct error codes:
  - [ ] `INVALID_PARAMS` (400)
  - [ ] `DUPLICATE_NAME` (400)
  - [ ] `SSRF_BLOCKED` (400)
  - [ ] `NOT_FOUND` (404)
  - [ ] `VALIDATION_FAILED` (400)

**Result**: ✅ Pass / ❌ Fail
**Notes**:

---

## 4. AI Client Integration

### 4.1 Credential Resolution
- [ ] `resolveCredential()` checks `isActive`
- [ ] `resolveCredential()` checks `isValid`
- [ ] Falls back to .env if credential not found
- [ ] Falls back to .env if credential inactive
- [ ] Falls back to .env if credential invalid

### 4.2 Default Credential Helper
- [ ] `getDefaultCredential()` returns default for provider
- [ ] Falls back to .env if no default found
- [ ] Decrypts API key correctly
- [ ] Returns baseUrl, model, config

### 4.3 Backward Compatibility
- [ ] Existing code works without database credentials
- [ ] .env fallback works correctly
- [ ] No breaking changes to existing API

**Result**: ✅ Pass / ❌ Fail
**Notes**:

---

## 5. Frontend Components

### 5.1 Settings Page
- [ ] Page renders at `/settings`
- [ ] Shows "AI Providers" section
- [ ] Displays credential list
- [ ] Shows "Add Provider" button

### 5.2 Credential List
- [ ] Displays all active credentials
- [ ] Groups by provider
- [ ] Shows default badge
- [ ] Shows status badge (valid/invalid/not validated)
- [ ] Loading state shown while fetching

### 5.3 Credential Card
- [ ] Displays credential name
- [ ] Shows provider type
- [ ] Shows key hint (last 4 chars)
- [ ] Shows model (if set)
- [ ] Shows validation status
- [ ] Shows validation error (if any)
- [ ] Shows last validated timestamp
- [ ] "Edit" button works
- [ ] "Test" button works
- [ ] "Set as Default" button works (hidden if already default)
- [ ] "Delete" button works

### 5.4 Credential Form (Create)
- [ ] Opens when "Add Provider" clicked
- [ ] Provider dropdown works
- [ ] Name field validates (1-50 chars, alphanumeric + spaces/dashes)
- [ ] API key field is password type
- [ ] Base URL field shown for CRS and OpenAI-compatible
- [ ] Base URL field hidden for Gemini
- [ ] Model field works
- [ ] "Set as default" checkbox works
- [ ] "Validate before saving" checkbox works
- [ ] Form validation works (required fields)
- [ ] Submit button disabled while saving
- [ ] Success message shown after save
- [ ] Error message shown on failure
- [ ] Cancel button closes form

### 5.5 Credential Form (Edit)
- [ ] Opens when "Edit" clicked
- [ ] Pre-fills existing values
- [ ] Provider dropdown disabled
- [ ] API key field optional (keeps existing if blank)
- [ ] Updates credential successfully
- [ ] Shows validation result if enabled

### 5.6 Delete Confirmation
- [ ] Shows confirmation dialog
- [ ] Prevents deleting default credential
- [ ] Prevents deleting last credential
- [ ] Shows appropriate error messages
- [ ] Soft deletes successfully

### 5.7 Test Validation
- [ ] "Test" button triggers validation
- [ ] Shows loading state during test
- [ ] Updates status badge after test
- [ ] Shows error message if test fails
- [ ] Updates "last validated" timestamp

**Result**: ✅ Pass / ❌ Fail
**Notes**:

---

## 6. Seeding & Auto-Repair

### 6.1 Seed Script
- [ ] `npm run seed:credentials` works
- [ ] Only runs on empty database
- [ ] Imports from .env (GEMINI_API_KEY, CRS_API_KEY)
- [ ] Sets imported credentials as default
- [ ] Marks imported credentials as valid

### 6.2 Backfill Script
- [ ] `npm run backfill:credentials` works
- [ ] Backfills missing `name` fields
- [ ] Sets first credential per provider as default
- [ ] Preserves existing data

### 6.3 Auto-Repair
- [ ] Runs on app startup
- [ ] Detects multiple defaults per provider
- [ ] Keeps oldest, unsets others
- [ ] Manual trigger via `/api/settings/repair` works

**Result**: ✅ Pass / ❌ Fail
**Notes**:

---

## 7. Security

### 7.1 Encryption
- [ ] API keys encrypted with AES-256-GCM
- [ ] `KEY_ENCRYPTION_SECRET` required
- [ ] Decryption works correctly
- [ ] Key hint generated (last 4 chars)

### 7.2 Data Exposure
- [ ] `encryptedKey` NEVER returned in API responses
- [ ] `encryptedKey` NEVER logged
- [ ] Decrypted keys NEVER logged
- [ ] Key hint safe to display (last 4 chars only)

### 7.3 SSRF Protection
- [ ] Private IPs blocked
- [ ] Allowlist enforced
- [ ] Environment variables respected
- [ ] Error messages don't leak internal info

### 7.4 Soft Delete
- [ ] Deleted credentials hidden from UI
- [ ] Deleted credentials not used by system
- [ ] `isActive` check enforced everywhere

**Result**: ✅ Pass / ❌ Fail
**Notes**:

---

## 8. Performance

### 8.1 Page Load
- [ ] Settings page loads in <1 second
- [ ] Credential list renders quickly (<500ms)

### 8.2 API Response Times
- [ ] GET /api/settings/credentials: <200ms
- [ ] POST /api/settings/credentials: <500ms
- [ ] PUT /api/settings/credentials/[id]: <500ms
- [ ] DELETE /api/settings/credentials/[id]: <200ms
- [ ] POST /api/settings/credentials/[id]/validate: <5s (with timeout)

### 8.3 Database Queries
- [ ] Indexes used efficiently
- [ ] No N+1 queries
- [ ] Transactions complete quickly

**Result**: ✅ Pass / ❌ Fail
**Notes**:

---

## 9. Edge Cases

### 9.1 Empty State
- [ ] Shows helpful message when no credentials exist
- [ ] "Add Provider" button prominent

### 9.2 Network Errors
- [ ] Handles API failures gracefully
- [ ] Shows user-friendly error messages
- [ ] Retry mechanism works

### 9.3 Concurrent Updates
- [ ] Transaction prevents race conditions
- [ ] Multiple users can edit different credentials
- [ ] Default flag updates atomic

### 9.4 Invalid Data
- [ ] Handles corrupted encrypted keys
- [ ] Handles missing environment variables
- [ ] Handles invalid JSON in `config` field

**Result**: ✅ Pass / ❌ Fail
**Notes**:

---

## 10. Documentation

### 10.1 User Guide
- [ ] `docs/guides/settings-user-guide.md` exists
- [ ] Covers all features
- [ ] Includes troubleshooting section
- [ ] Includes security best practices

### 10.2 Environment Variables
- [ ] `.env.example` updated
- [ ] All new variables documented
- [ ] Examples provided
- [ ] Security notes included

### 10.3 Code Comments
- [ ] Complex logic commented
- [ ] Security considerations noted
- [ ] API contracts documented

**Result**: ✅ Pass / ❌ Fail
**Notes**:

---

## Summary

### Overall Result
- [ ] ✅ All tests passed - Ready for production
- [ ] ⚠️ Minor issues found - Needs fixes
- [ ] ❌ Major issues found - Blocked

### Test Statistics
- **Total Tests**: [X]
- **Passed**: [X]
- **Failed**: [X]
- **Skipped**: [X]

### Critical Issues
1. [Issue description]
2. [Issue description]

### Non-Critical Issues
1. [Issue description]
2. [Issue description]

### Recommendations
1. [Recommendation]
2. [Recommendation]

---

**Tester Signature**: ___________________
**Date**: ___________________
**Approved By**: ___________________
