/**
 * API Key Encryption Module
 *
 * Provides encryption/decryption for API keys using AES-256-GCM
 * Requires KEY_ENCRYPTION_SECRET environment variable
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;

function getEncryptionKey(): Buffer {
  const secret = process.env.KEY_ENCRYPTION_SECRET;
  if (!secret) {
    throw new Error('KEY_ENCRYPTION_SECRET environment variable is not set');
  }
  // Derive a 32-byte key from the secret
  return crypto.pbkdf2Sync(secret, 'salt', 100000, 32, 'sha256');
}

export function encryptApiKey(apiKey: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(apiKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decryptApiKey(encryptedKey: string): string {
  const key = getEncryptionKey();
  const parts = encryptedKey.split(':');

  if (parts.length !== 3) {
    throw new Error('Invalid encrypted key format');
  }

  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

export function getKeyHint(apiKey: string): string {
  if (apiKey.length <= 4) {
    return '***';
  }
  return `...${apiKey.slice(-4)}`;
}
