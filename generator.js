// generator.js

// base64 helpers
function arrayBufferToBase64(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function bytesToBase64(bytes) {
  return btoa(String.fromCharCode(...bytes));
}

function randomBytes(length) {
  const buf = new Uint8Array(length);
  crypto.getRandomValues(buf);
  return buf;
}

async function deriveKeyFromPassphrase(passphrase, saltBytes) {
  const enc = new TextEncoder();
  const passphraseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: saltBytes,
      iterations: 100000,
      hash: "SHA-256",
    },
    passphraseKey,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptMessage(plaintext, passphrase) {
  const salt = randomBytes(16);
  const iv = randomBytes(12);

  const key = await deriveKeyFromPassphrase(passphrase, salt);
  const enc = new TextEncoder();
  const plaintextBytes = enc.encode(plaintext);

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    plaintextBytes
  );

  return {
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: arrayBufferToBase64(ciphertext),
  };
}

document.addEventListener("DOMContentLoaded", () => {
  const baseUrlInput = document.getElementById("baseUrl");
  const recipientIdInput = document.getElementById("recipientId");
  const messageInput = document.getElementById("message");
  const generateBtn = document.getElementById("generateBtn");
  const urlOutput = document.getElementById("urlOutput");
  const jsonOutput = document.getElementById("jsonOutput");

  // Pre-fill base URL (strip generator.html from path)
  if (baseUrlInput && !baseUrlInput.value) {
    const loc = window.location;
    const base =
      loc.origin + loc.pathname.replace(/\/[^\/]*$/, "/");
    baseUrlInput.value = base;
  }

  generateBtn.addEventListener("click", async (e) => {
    e.preventDefault();

    const baseUrl = baseUrlInput.value.trim();
    const recipientId = recipientIdInput.value.trim();
    const message = messageInput.value;

    if (!baseUrl || !recipientId || !message) {
      alert("Please fill in base URL, recipient ID, and message.");
      return;
    }

    try {
      // Generate random URL key (this is what goes in ?k=)
      const urlKeyBytes = randomBytes(16);
      const urlKey = bytesToBase64(urlKeyBytes);

      // Encrypt the message using the same scheme the main page expects
      const encrypted = await encryptMessage(message, urlKey);

      // Build the URL
      const url =
        `${baseUrl}?id=${encodeURIComponent(recipientId)}` +
        `&k=${encodeURIComponent(urlKey)}`;

      urlOutput.textContent = `Send this URL to ${recipientId}:\n${url}`;

      // JSON entry for messages-encrypted.json
      const jsonSnippet =
        `"${recipientId}": {\n` +
        `  "iv": "${encrypted.iv}",\n` +
        `  "salt": "${encrypted.salt}",\n` +
        `  "ciphertext": "${encrypted.ciphertext}"\n` +
        `}`;

      jsonOutput.textContent =
        `Add this inside messages-encrypted.json:\n\n${jsonSnippet}`;
    } catch (err) {
      console.error(err);
      alert("Something went wrong generating the encrypted message.");
    }
  });
});
