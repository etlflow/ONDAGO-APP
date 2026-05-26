const crypto = require('crypto');

// Falls back to a default key if OLLAMA_ENCRYPTION_KEY is not defined, for development purposes.
const ENCRYPTION_KEY = process.env.OLLAMA_ENCRYPTION_KEY || 'ondago_default_dev_encryption_key_32bytes!'; 

/**
 * Encrypts a string using AES-256-CBC
 * @param {string} text - The raw text to encrypt
 * @returns {string} - Combined IV and encrypted text formatted as "ivHex:encryptedHex"
 */
function encrypt(text) {
  if (!text) return '';
  const iv = crypto.randomBytes(16);
  // Derive a secure 32-byte key from the configured environment secret
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'ondago-salt', 32);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return `${iv.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts a string using AES-256-CBC
 * @param {string} encryptedText - The encrypted text formatted as "ivHex:encryptedHex"
 * @returns {string} - The raw decrypted string
 */
function decrypt(encryptedText) {
  if (!encryptedText) return '';
  const parts = encryptedText.split(':');
  if (parts.length !== 2) {
    throw new Error('Malformed encrypted text format. Expected "iv:ciphertext".');
  }

  const iv = Buffer.from(parts[0], 'hex');
  const ciphertext = Buffer.from(parts[1], 'hex');
  
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'ondago-salt', 32);
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  
  let decrypted = decipher.update(ciphertext, null, 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

module.exports = {
  encrypt,
  decrypt
};
