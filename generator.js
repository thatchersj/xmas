// generator.js

// --- base64 helpers ---
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

// --- key derivation & encryption (same scheme as card page) ---
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

  // Single-message DOM
  const recipientIdInput = document.getElementById("recipientId");
  const displayNameInput = document.getElementById("displayName");
  const messageInput = document.getElementById("message");
  const generateBtn = document.getElementById("generateBtn");
  const urlOutput = document.getElementById("urlOutput");
  const jsonOutput = document.getElementById("jsonOutput");

  // Bulk DOM
  const plaintextFileInput = document.getElementById("plaintextFile");
  const bulkGenerateBtn = document.getElementById("bulkGenerateBtn");
  const bulkUrlOutput = document.getElementById("bulkUrlOutput");
  const bulkJsonOutput = document.getElementById("bulkJsonOutput");

  // Pre-fill base URL (strip generator.html from path)
  if (baseUrlInput && !baseUrlInput.value) {
    const loc = window.location;
    const base = loc.origin + loc.pathname.replace(/\/[^\/]*$/, "/");
    baseUrlInput.value = base;
  }

  // --- Single-message generation ---
  if (generateBtn) {
    generateBtn.addEventListener("click", async (e) => {
      e.preventDefault();

      const baseUrl = baseUrlInput.value.trim();
      const recipientId = recipientIdInput.value.trim();
      const displayNameRaw = (displayNameInput.value || "").trim();
      const message = messageInput.value;

      if (!baseUrl || !recipientId || !message) {
        alert("Please fill in base URL, recipient ID, and message.");
        return;
      }

      try {
        const urlKeyBytes = randomBytes(16);
        const urlKey = bytesToBase64(urlKeyBytes);

        // Build plaintext object to encrypt
        const plaintextObj = {
          displayName: displayNameRaw || recipientId,
          message: message
        };
        const plaintextJson = JSON.stringify(plaintextObj);

        const encrypted = await encryptMessage(plaintextJson, urlKey);

        const url =
          `${baseUrl}?id=${encodeURIComponent(recipientId)}` +
          `&k=${encodeURIComponent(urlKey)}`;

        urlOutput.textContent = `Send this URL to ${recipientId}:\n${url}`;

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
  }

  // --- Bulk generation from unencrypted-messages.json ---
  if (bulkGenerateBtn) {
    bulkGenerateBtn.addEventListener("click", async (e) => {
      e.preventDefault();

      const baseUrl = baseUrlInput.value.trim();
      if (!baseUrl) {
        alert("Please fill in the base URL first.");
        return;
      }

      const file = plaintextFileInput.files && plaintextFileInput.files[0];
      if (!file) {
        alert("Please choose an unencrypted-messages.json file.");
        return;
      }

      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const text = reader.result;
          const json = JSON.parse(text);

          if (typeof json !== "object" || json === null || Array.isArray(json)) {
            alert("JSON must be an object mapping ids to messages.");
            return;
          }

          const encryptedMessages = {};
          const urls = [];

          // Process each entry
          for (const [id, raw] of Object.entries(json)) {
            let message;
            let displayName;

            if (typeof raw === "string") {
              // Simple form: "id": "message"
              message = raw;
              displayName = id;
            } else if (raw && typeof raw === "object") {
              // Extended form: "id": { "displayName": "...", "message": "..." }
              message = raw.message;
              displayName = raw.displayName || id;
            }

            if (typeof message !== "string" || !message.length) {
              console.warn(`Skipping id "${id}" because it has no valid message.`);
              continue;
            }

            const urlKeyBytes = randomBytes(16);
            const urlKey = bytesToBase64(urlKeyBytes);

            // Plaintext object to encrypt
            const plaintextObj = {
              displayName,
              message
            };
            const plaintextJson = JSON.stringify(plaintextObj);

            const encrypted = await encryptMessage(plaintextJson, urlKey);

            encryptedMessages[id] = {
              iv: encrypted.iv,
              salt: encrypted.salt,
              ciphertext: encrypted.ciphertext
            };

            const url =
              `${baseUrl}?id=${encodeURIComponent(id)}` +
              `&k=${encodeURIComponent(urlKey)}`;
            urls.push(`${id}: ${url}`);
          }

          // Output URLs
          bulkUrlOutput.textContent =
            urls.length
              ? urls.join("\n")
              : "(No valid messages found in file.)";

          // Output full encrypted JSON
          bulkJsonOutput.textContent = JSON.stringify(encryptedMessages, null, 2);
        } catch (err) {
          console.error(err);
          alert("Error reading or parsing the JSON file.");
        }
      };

      reader.onerror = () => {
        console.error(reader.error);
        alert("Failed to read the file.");
      };

      reader.readAsText(file);
    });
  }
});
