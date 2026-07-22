/**
 * End-to-End Encryption Utility
 * Uses native Web Crypto API (AES-GCM)
 */

// A static mock master key for demonstration (in production, use KMS or Supabase)
const MASTER_KEY_MATERIAL = 'Varistor-Master-Key-2026-Super-Secret';

// Helper to convert ArrayBuffer to Base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Helper to convert Base64 to ArrayBuffer
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary_string = atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Gets or derives the CryptoKey for encryption
 */
export async function getMasterKey(): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(MASTER_KEY_MATERIAL),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode('VaristorSalt'),
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a File and returns a Base64 string containing both IV and Ciphertext.
 */
export async function encryptFile(file: File, key: CryptoKey): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  
  // AES-GCM requires a 12-byte initialization vector (IV)
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  
  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    key,
    arrayBuffer
  );
  
  // Combine IV and Ciphertext into a single ArrayBuffer
  const ciphertextBytes = new Uint8Array(ciphertextBuffer);
  const combined = new Uint8Array(iv.length + ciphertextBytes.length);
  combined.set(iv, 0);
  combined.set(ciphertextBytes, iv.length);
  
  return arrayBufferToBase64(combined.buffer);
}

/**
 * Decrypts a Base64 payload (IV + Ciphertext) back into a File Blob.
 */
export async function decryptFile(base64Payload: string, key: CryptoKey, originalMimeType: string): Promise<Blob> {
  const combinedBuffer = base64ToArrayBuffer(base64Payload);
  const combined = new Uint8Array(combinedBuffer);
  
  // Extract the 12-byte IV
  const iv = combined.slice(0, 12);
  // Extract the ciphertext
  const ciphertext = combined.slice(12);
  
  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    key,
    ciphertext
  );
  
  return new Blob([decryptedBuffer], { type: originalMimeType });
}
