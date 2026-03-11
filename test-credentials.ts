/**
 * Manual Test Runner for Credentials API
 *
 * Run with: node --loader ts-node/esm test-runner.ts
 */

import { validateCredentialRequest } from '../lib/settings/validation';
import { encryptApiKey, decryptApiKey, getKeyHint } from '../lib/settings/encryption';
import { validateBaseUrl } from '../lib/security/ssrf-protection';

// Set test environment variable
process.env.KEY_ENCRYPTION_SECRET = 'test-secret-key-for-encryption';

console.log('=== Testing Validation Module ===\n');

// Test 1: Valid gemini credential
console.log('Test 1: Valid gemini credential');
const test1 = validateCredentialRequest({
  provider: 'gemini',
  name: 'My Gemini Key',
  apiKey: 'test-api-key-12345',
});
console.log('Result:', test1.valid ? '✓ PASS' : '✗ FAIL', test1);

// Test 2: Invalid provider
console.log('\nTest 2: Invalid provider');
const test2 = validateCredentialRequest({
  provider: 'invalid-provider',
  apiKey: 'test-key',
});
console.log('Result:', !test2.valid ? '✓ PASS' : '✗ FAIL', test2);

// Test 3: Short API key
console.log('\nTest 3: Short API key');
const test3 = validateCredentialRequest({
  provider: 'gemini',
  apiKey: 'short',
});
console.log('Result:', !test3.valid ? '✓ PASS' : '✗ FAIL', test3);

// Test 4: Invalid temperature
console.log('\nTest 4: Invalid temperature');
const test4 = validateCredentialRequest({
  provider: 'gemini',
  apiKey: 'test-key-12345',
  config: { temperature: 3 },
});
console.log('Result:', !test4.valid ? '✓ PASS' : '✗ FAIL', test4);

console.log('\n=== Testing Encryption Module ===\n');

// Test 5: Encrypt and decrypt
console.log('Test 5: Encrypt and decrypt');
const originalKey = 'my-secret-api-key-12345';
const encrypted = encryptApiKey(originalKey);
const decrypted = decryptApiKey(encrypted);
console.log('Original:', originalKey);
console.log('Encrypted:', encrypted);
console.log('Decrypted:', decrypted);
console.log('Result:', decrypted === originalKey ? '✓ PASS' : '✗ FAIL');

// Test 6: Key hint
console.log('\nTest 6: Key hint');
const hint = getKeyHint(originalKey);
console.log('Hint:', hint);
console.log('Result:', hint === '...2345' ? '✓ PASS' : '✗ FAIL');

console.log('\n=== Testing SSRF Protection ===\n');

// Test 7: Valid gemini URL
console.log('Test 7: Valid gemini URL');
const test7 = validateBaseUrl('gemini', 'https://generativelanguage.googleapis.com/');
console.log('Result:', test7.valid ? '✓ PASS' : '✗ FAIL', test7);

// Test 8: Block private IP
console.log('\nTest 8: Block private IP');
const test8 = validateBaseUrl('gemini', 'http://192.168.1.1');
console.log('Result:', !test8.valid ? '✓ PASS' : '✗ FAIL', test8);

// Test 9: Allow localhost for openai-compatible
console.log('\nTest 9: Allow localhost for openai-compatible');
const test9 = validateBaseUrl('openai-compatible', 'http://localhost:8080');
console.log('Result:', test9.valid ? '✓ PASS' : '✗ FAIL', test9);

console.log('\n=== All Tests Complete ===');
