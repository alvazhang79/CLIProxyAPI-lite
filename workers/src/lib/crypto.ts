// AES-256-GCM encryption for API secrets
// Key is 32 bytes (256 bits), base64-encoded in ENCRYPTION_KEY secret

export interface Encrypted {
  iv: string;      // base64 initialization vector
  data: string;    // base64 encrypted data
  tag: string;     // base64 auth tag
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns { iv, data, tag } all base64-encoded.
 */
export async function encrypt(plaintext: string, keyBase64: string): Promise<Encrypted> {
  const keyBytes = base64ToBytes(keyBase64);
  const plaintextBytes = new TextEncoder().encode(plaintext);

  // Import key
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    ['encrypt'],
  );

  // Generate random IV (12 bytes for GCM)
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Encrypt
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    plaintextBytes,
  );

  // GCM appends the tag to the ciphertext — split them
  // AES-GCM with tagLength=128 produces a 16-byte auth tag at the end
  const ct = new Uint8Array(ciphertext);
  const encryptedData = ct.slice(0, ct.length - 16);
  const authTag = ct.slice(ct.length - 16);

  return {
    iv: bytesToBase64(iv),
    data: bytesToBase64(encryptedData),
    tag: bytesToBase64(authTag),
  };
}

/**
 * Decrypt an encrypted payload using AES-256-GCM.
 */
export async function decrypt(encrypted: Encrypted, keyBase64: string): Promise<string> {
  const keyBytes = base64ToBytes(keyBase64);
  const iv = base64ToBytes(encrypted.iv);
  const data = base64ToBytes(encrypted.data);
  const tag = base64ToBytes(encrypted.tag);

  // Reconstruct ciphertext with tag appended
  const combined = new Uint8Array(data.length + tag.length);
  combined.set(data, 0);
  combined.set(tag, data.length);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    ['decrypt'],
  );

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    combined,
  );

  return new TextDecoder().decode(plaintext);
}

// ---- Utilities ----

export function bytesToBase64(bytes: Uint8Array): string {
  const bin = Array.from(bytes).map(b => String.fromCharCode(b)).join('');
  return btoa(bin);
}

export function base64ToBytes(base64: string): Uint8Array {
  const bin = atob(base64);
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}

/**
 * Generate a random 32-byte AES-256 key, base64-encoded.
 */
export function generateKey(): string {
  const key = crypto.getRandomValues(new Uint8Array(32));
  return bytesToBase64(key);
}

/**
 * Hash a token with SHA-256, return hex string.
 */
export async function sha256(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
