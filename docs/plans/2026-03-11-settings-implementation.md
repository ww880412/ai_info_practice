# Settings Multi-Provider Implementation Plan

> **Version**: 1.0
> **Date**: 2026-03-11
> **Status**: Draft (Pending Codex Review)
> **Design Doc**: [2026-03-11-settings-multi-provider.md](./2026-03-11-settings-multi-provider.md) (v1.2, Codex 8.8/10)

## Overview

Implement Settings page for multi-provider credential management based on approved design document. Extends existing `ApiCredential` table, reuses encryption system, adds UI for CRUD operations.

## Task Breakdown

### Task 1: Database Schema Extension (1-2h)

**Objective**: Add new fields to `ApiCredential` model

**Files**:
- `prisma/schema.prisma`
- `prisma/migrations/YYYYMMDDHHMMSS_extend_api_credential/migration.sql`

**Changes**:
```prisma
model ApiCredential {
  // ... existing fields ...

  // NEW fields
  name            String?
  isDefault       Boolean  @default(false)
  isActive        Boolean  @default(true)
  validationError String?
  config          Json?

  // NEW indexes
  @@unique([provider, name, isActive])
  @@index([provider, isActive, isDefault])
  @@index([provider, isDefault, createdAt])
}
```

**Migration Steps**:
1. Add new fields (all nullable initially)
2. Backfill existing records:
   - `name` = `provider + " Default"`
   - `isDefault` = true for first credential per provider
   - `isActive` = true
3. Run `npx prisma generate`

**Acceptance Criteria**:
- [ ] Migration runs successfully
- [ ] Existing credentials preserved
- [ ] Indexes created
- [ ] Prisma client regenerated

---

### Task 2: SSRF Protection Module (1-2h)

**Objective**: Create URL validation with allowlist and private IP blocking

**Files**:
- `src/lib/security/ssrf-protection.ts`
- `src/lib/security/__tests__/ssrf-protection.test.ts`

**Implementation**:
```typescript
// src/lib/security/ssrf-protection.ts
const PRIVATE_IP_RANGES = [
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[01])\./,
  /^192\.168\./,
  /^127\./,
  /^169\.254\./,
  /^::1$/,
  /^fe80:/,
];

const ALLOWED_BASE_URLS: Record<string, RegExp[]> = {
  gemini: [/^https:\/\/generativelanguage\.googleapis\.com\//],
  crs: [
    new RegExp(`^${process.env.CRS_BASE_URL || 'https://api\\.crs\\.example\\.com'}/?`),
    ...(process.env.CRS_BASE_URL_PATTERN ? [new RegExp(process.env.CRS_BASE_URL_PATTERN)] : []),
  ],
  'openai-compatible': [
    /^http:\/\/localhost:\d+/,
    /^http:\/\/127\.0\.0\.1:\d+/,
    /^http:\/\/host\.docker\.internal:\d+/,
    ...(process.env.OPENAI_COMPATIBLE_ALLOWLIST
      ? process.env.OPENAI_COMPATIBLE_ALLOWLIST.split(',').map(host => new RegExp(`^https://${host.trim()}`))
      : []
    ),
  ],
};

export function validateBaseUrl(provider: string, baseUrl: string): {
  valid: boolean;
  warning?: string;
  error?: string;
} {
  // Check private IPs
  const hostname = new URL(baseUrl).hostname;
  if (PRIVATE_IP_RANGES.some(pattern => pattern.test(hostname))) {
    return { valid: false, error: 'Private IP addresses are not allowed' };
  }

  // Check allowlist
  const patterns = ALLOWED_BASE_URLS[provider];
  if (!patterns || patterns.length === 0) {
    return { valid: false, error: `No allowlist configured for provider: ${provider}` };
  }

  const valid = patterns.some(pattern => pattern.test(baseUrl));
  const warning = provider === 'openai-compatible' && baseUrl.startsWith('https://')
    ? 'Custom HTTPS endpoints must be explicitly allowlisted via OPENAI_COMPATIBLE_ALLOWLIST'
    : undefined;

  return { valid, warning, error: valid ? undefined : 'URL does not match allowlist patterns' };
}
```

**Tests**:
- Valid URLs for each provider
- Private IP blocking (10.x, 192.168.x, 127.x, etc.)
- Allowlist enforcement
- Environment variable configuration

**Acceptance Criteria**:
- [ ] All tests pass
- [ ] Private IPs blocked
- [ ] Allowlist enforced
- [ ] Environment variables respected

---

### Task 3: API Routes (3-4h)

**Objective**: Implement CRUD endpoints for credentials

**Files**:
- `src/app/api/settings/credentials/route.ts` (GET, POST)
- `src/app/api/settings/credentials/[id]/route.ts` (PUT, DELETE)
- `src/app/api/settings/credentials/[id]/validate/route.ts` (POST)
- `src/app/api/settings/credentials/route.test.ts`

**Endpoints**:

#### POST /api/settings/credentials
```typescript
export async function POST(request: NextRequest) {
  const body = await request.json();

  // Validate input
  const { provider, name, apiKey, baseUrl, model, config, isDefault, validate } = body;

  // SSRF check
  if (baseUrl) {
    const { valid, error } = validateBaseUrl(provider, baseUrl);
    if (!valid) return NextResponse.json({ error: { code: 'SSRF_BLOCKED', message: error } }, { status: 400 });
  }

  // Encrypt API key
  const encryptedKey = encryptApiKey(apiKey);
  const keyHint = getKeyHint(apiKey);

  // Transaction: Create + unset other defaults
  const credential = await prisma.$transaction(async (tx) => {
    if (isDefault) {
      await tx.apiCredential.updateMany({
        where: { provider, isDefault: true },
        data: { isDefault: false },
      });
    }

    return tx.apiCredential.create({
      data: {
        provider,
        name: name || `${provider} ${Date.now()}`,
        encryptedKey,
        keyHint,
        baseUrl,
        model,
        config,
        isDefault: isDefault || false,
        isValid: validate ? false : true,  // Will be updated after validation
      },
    });
  });

  // Validate if requested
  if (validate) {
    const { isValid, validationError } = await validateCredential(credential.id);
    await prisma.apiCredential.update({
      where: { id: credential.id },
      data: { isValid, validationError, lastValidatedAt: new Date() },
    });
  }

  return NextResponse.json({ data: serializeCredential(credential) });
}
```

#### GET /api/settings/credentials
```typescript
export async function GET() {
  const credentials = await prisma.apiCredential.findMany({
    where: { isActive: true },
    orderBy: [
      { provider: 'asc' },
      { isDefault: 'desc' },
      { createdAt: 'asc' },
    ],
  });

  return NextResponse.json({
    data: { credentials: credentials.map(serializeCredential) },
  });
}
```

#### PUT /api/settings/credentials/[id]
- Similar to POST but update existing
- Cannot change `provider` field
- Transaction for `isDefault` updates

#### DELETE /api/settings/credentials/[id]
- Soft delete: Set `isActive = false`
- Prevent deleting default credential
- Prevent deleting last credential for provider

#### POST /api/settings/credentials/[id]/validate
- Fetch credential
- Test with provider API
- Update `isValid`, `validationError`, `lastValidatedAt`

**Validation Logic**:
```typescript
async function validateCredential(credentialId: string): Promise<{ isValid: boolean; validationError: string | null }> {
  const credential = await prisma.apiCredential.findUnique({ where: { id: credentialId } });
  if (!credential) throw new Error('Credential not found');

  const apiKey = decryptApiKey(credential.encryptedKey);

  try {
    if (credential.provider === 'gemini') {
      // Test with Gemini API
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + apiKey);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } else if (credential.provider === 'crs') {
      // Test with CRS API
      const response = await fetch(credential.baseUrl + '/health', {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    }

    return { isValid: true, validationError: null };
  } catch (error) {
    return { isValid: false, validationError: error.message };
  }
}
```

**Acceptance Criteria**:
- [ ] All endpoints implemented
- [ ] SSRF protection enforced
- [ ] Transaction for default updates
- [ ] Soft delete working
- [ ] Validation logic tested
- [ ] Unit tests pass

---

### Task 4: AI Client Integration (1h)

**Objective**: Update client to check `isActive` and add default credential helper

**Files**:
- `src/lib/ai/client.ts`
- `src/lib/ai/get-default-credential.ts`
- `src/lib/ai/__tests__/get-default-credential.test.ts`

**Changes to client.ts**:
```typescript
export async function resolveCredential(credentialId: string | null): Promise<NormalizedAIConfig> {
  if (!credentialId) {
    // Fallback to .env
    return {
      apiKey: process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp',
    };
  }

  const credential = await prisma.apiCredential.findUnique({
    where: { id: credentialId },
  });

  // Check isActive, isValid
  if (!credential || !credential.isValid || !credential.isActive) {
    console.warn(`Credential ${credentialId} not found, invalid, or inactive - falling back to env`);
    // Fallback to .env
  }

  return {
    apiKey: decryptApiKey(credential.encryptedKey),
    baseUrl: credential.baseUrl,
    model: credential.model,
    ...credential.config,
  };
}
```

**New helper**:
```typescript
// src/lib/ai/get-default-credential.ts
export async function getDefaultCredential(provider: 'gemini' | 'crs' | 'openai-compatible') {
  const credential = await prisma.apiCredential.findFirst({
    where: { provider, isActive: true, isDefault: true },
    orderBy: [
      { isDefault: 'desc' },
      { createdAt: 'asc' },
    ],
  });

  if (!credential) {
    // Fallback to .env
    if (provider === 'gemini') {
      return {
        apiKey: process.env.GEMINI_API_KEY,
        model: process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp',
      };
    }
    // ... other providers
  }

  return {
    apiKey: decryptApiKey(credential.encryptedKey),
    baseUrl: credential.baseUrl,
    model: credential.model,
    ...credential.config,
  };
}
```

**Acceptance Criteria**:
- [ ] `isActive` check added
- [ ] Default credential helper works
- [ ] Tests pass
- [ ] Backward compatibility maintained

---

### Task 5: Frontend Components (4-5h)

**Objective**: Build Settings UI with credential management

**Files**:
- `src/app/settings/page.tsx`
- `src/components/settings/CredentialList.tsx`
- `src/components/settings/CredentialCard.tsx`
- `src/components/settings/CredentialForm.tsx`
- `src/components/settings/__tests__/CredentialCard.test.tsx`
- `src/components/settings/__tests__/CredentialForm.test.tsx`

**Page Structure**:
```tsx
// src/app/settings/page.tsx
export default function SettingsPage() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      <section>
        <h2 className="text-xl font-semibold mb-4">AI Providers</h2>
        <CredentialList />
      </section>
    </div>
  );
}
```

**CredentialList Component**:
```tsx
export function CredentialList() {
  const { data, isLoading } = useQuery({
    queryKey: ['credentials'],
    queryFn: async () => {
      const res = await fetch('/api/settings/credentials');
      return res.json();
    },
  });

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      {data?.data?.credentials.map((cred) => (
        <CredentialCard
          key={cred.id}
          credential={cred}
          onEdit={() => setEditingId(cred.id)}
          onDelete={handleDelete}
          onTest={handleTest}
          onSetDefault={handleSetDefault}
        />
      ))}

      <button onClick={() => setShowForm(true)}>+ Add Provider</button>

      {showForm && (
        <CredentialForm
          mode="create"
          onSubmit={handleCreate}
          onCancel={() => setShowForm(false)}
        />
      )}
    </div>
  );
}
```

**CredentialCard Component**:
```tsx
interface CredentialCardProps {
  credential: ApiCredential;
  onEdit: () => void;
  onDelete: () => void;
  onTest: () => void;
  onSetDefault: () => void;
}

export function CredentialCard({ credential, onEdit, onDelete, onTest, onSetDefault }: CredentialCardProps) {
  return (
    <div className="border rounded p-4 mb-4">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-semibold">{credential.name}</h3>
          <p className="text-sm text-gray-600">{credential.provider}</p>
          <p className="text-xs text-gray-500">Key: {credential.keyHint}</p>
          {credential.model && <p className="text-xs">Model: {credential.model}</p>}
        </div>

        <div className="flex gap-2">
          {credential.isDefault && <span className="badge">Default</span>}
          {credential.isValid ? (
            <span className="text-green-600">✅ Valid</span>
          ) : (
            <span className="text-red-600">❌ Invalid</span>
          )}
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <button onClick={onEdit}>Edit</button>
        <button onClick={onTest}>Test</button>
        {!credential.isDefault && <button onClick={onSetDefault}>Set as Default</button>}
        <button onClick={onDelete} className="text-red-600">Delete</button>
      </div>

      {credential.validationError && (
        <p className="text-sm text-red-600 mt-2">{credential.validationError}</p>
      )}
    </div>
  );
}
```

**CredentialForm Component**:
```tsx
interface CredentialFormProps {
  mode: 'create' | 'edit';
  credential?: ApiCredential;
  onSubmit: (data: CredentialFormData) => Promise<void>;
  onCancel: () => void;
}

export function CredentialForm({ mode, credential, onSubmit, onCancel }: CredentialFormProps) {
  const [formData, setFormData] = useState({
    provider: credential?.provider || 'gemini',
    name: credential?.name || '',
    apiKey: '',
    baseUrl: credential?.baseUrl || '',
    model: credential?.model || '',
    isDefault: credential?.isDefault || false,
    validate: true,
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await onSubmit(formData);
    } catch (error) {
      setErrors({ submit: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="border rounded p-4">
      <h3 className="font-semibold mb-4">{mode === 'create' ? 'Add Provider' : 'Edit Provider'}</h3>

      <div className="mb-4">
        <label>Provider</label>
        <select
          value={formData.provider}
          onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
          disabled={mode === 'edit'}
        >
          <option value="gemini">Gemini</option>
          <option value="crs">CRS</option>
          <option value="openai-compatible">OpenAI Compatible</option>
        </select>
      </div>

      <div className="mb-4">
        <label>Name</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., Gemini Production"
        />
      </div>

      <div className="mb-4">
        <label>API Key</label>
        <input
          type="password"
          value={formData.apiKey}
          onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
          required={mode === 'create'}
        />
      </div>

      {formData.provider !== 'gemini' && (
        <div className="mb-4">
          <label>Base URL</label>
          <input
            type="url"
            value={formData.baseUrl}
            onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
          />
        </div>
      )}

      <div className="mb-4">
        <label>Model</label>
        <input
          type="text"
          value={formData.model}
          onChange={(e) => setFormData({ ...formData, model: e.target.value })}
          placeholder="e.g., gemini-2.0-flash-exp"
        />
      </div>

      <div className="mb-4">
        <label>
          <input
            type="checkbox"
            checked={formData.isDefault}
            onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
          />
          Set as default provider
        </label>
      </div>

      <div className="mb-4">
        <label>
          <input
            type="checkbox"
            checked={formData.validate}
            onChange={(e) => setFormData({ ...formData, validate: e.target.checked })}
          />
          Validate credentials before saving
        </label>
      </div>

      {errors.submit && <p className="text-red-600 mb-4">{errors.submit}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : 'Save'}
        </button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
```

**Acceptance Criteria**:
- [ ] Settings page renders
- [ ] Credential list displays
- [ ] Add/Edit/Delete works
- [ ] Test validation works
- [ ] Set default works
- [ ] Form validation works
- [ ] Loading states shown
- [ ] Error handling works

---

### Task 6: Seeding & Migration (1h)

**Objective**: Seed credentials from .env and backfill existing records

**Files**:
- `scripts/seed-credentials.ts`
- `scripts/backfill-credentials.ts`

**Seed Script**:
```typescript
// scripts/seed-credentials.ts
import { prisma } from '../src/lib/prisma';
import { encryptApiKey, getKeyHint } from '../src/lib/crypto';

async function seedCredentials() {
  const credentials = [];

  // Gemini
  if (process.env.GEMINI_API_KEY) {
    credentials.push({
      provider: 'gemini',
      name: 'Gemini Default',
      encryptedKey: encryptApiKey(process.env.GEMINI_API_KEY),
      keyHint: getKeyHint(process.env.GEMINI_API_KEY),
      model: process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp',
      isDefault: true,
      isActive: true,
      isValid: true,
    });
  }

  // CRS
  if (process.env.CRS_API_KEY) {
    credentials.push({
      provider: 'crs',
      name: 'CRS Default',
      encryptedKey: encryptApiKey(process.env.CRS_API_KEY),
      keyHint: getKeyHint(process.env.CRS_API_KEY),
      baseUrl: process.env.CRS_BASE_URL,
      model: process.env.CRS_MODEL || 'gpt-5.4',
      isDefault: true,
      isActive: true,
      isValid: true,
    });
  }

  for (const cred of credentials) {
    await prisma.apiCredential.upsert({
      where: { id: 'seed-' + cred.provider },
      update: cred,
      create: { ...cred, id: 'seed-' + cred.provider },
    });
  }

  console.log(`Seeded ${credentials.length} credentials`);
}

seedCredentials();
```

**Backfill Script**:
```typescript
// scripts/backfill-credentials.ts
async function backfillCredentials() {
  const credentials = await prisma.apiCredential.findMany();

  for (const cred of credentials) {
    const updates: any = {};

    if (!cred.name) {
      updates.name = `${cred.provider} ${cred.id.slice(0, 8)}`;
    }

    if (cred.isDefault === null) {
      // Set first credential per provider as default
      const isFirst = await prisma.apiCredential.count({
        where: {
          provider: cred.provider,
          createdAt: { lt: cred.createdAt },
        },
      }) === 0;
      updates.isDefault = isFirst;
    }

    if (cred.isActive === null) {
      updates.isActive = true;
    }

    if (Object.keys(updates).length > 0) {
      await prisma.apiCredential.update({
        where: { id: cred.id },
        data: updates,
      });
    }
  }

  console.log(`Backfilled ${credentials.length} credentials`);
}

backfillCredentials();
```

**Acceptance Criteria**:
- [ ] Seed script works
- [ ] Backfill script works
- [ ] Existing credentials preserved
- [ ] Default flags set correctly

---

### Task 7: Testing & Documentation (2-3h)

**Objective**: Comprehensive testing and user documentation

**Files**:
- All test files
- `docs/guides/settings-user-guide.md`
- `.env.example`

**Test Coverage**:
- Unit tests for all modules
- Integration tests for API routes
- Component tests for UI
- Manual QA checklist

**Documentation**:
- User guide for Settings page
- Environment variable reference
- Security best practices
- Troubleshooting guide

**Acceptance Criteria**:
- [ ] All unit tests pass
- [ ] Integration tests pass
- [ ] Manual QA complete
- [ ] Documentation written
- [ ] .env.example updated

---

## Deployment Checklist

- [ ] All tasks completed
- [ ] All tests passing
- [ ] Database migration tested
- [ ] Environment variables documented
- [ ] Security review complete
- [ ] User documentation ready
- [ ] Staging deployment successful
- [ ] Production deployment plan ready

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Migration fails | Low | High | Test on staging first, backup DB |
| SSRF bypass | Low | High | Comprehensive allowlist testing |
| Encryption key leak | Low | Critical | Never log decrypted keys, audit code |
| Multiple defaults | Medium | Low | Auto-repair function on app start |
| Soft delete not enforced | Medium | Medium | Add isActive checks everywhere |

---

## Success Metrics

- Users can add/edit/delete credentials via UI
- Credentials stored securely (encrypted)
- Validation works for all providers
- Fallback to .env works correctly
- Zero plaintext API keys in logs
- Page loads in <1s
- All tests passing

---

**Ready for Codex Review**
