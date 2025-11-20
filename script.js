// script.js
document.addEventListener("DOMContentLoaded", () => {
  const card = document.getElementById("card");
  const cardCover = document.getElementById("cardCover");
  const cardMessage = document.getElementById("cardMessage");

  const GENERIC_TITLE = "Merry Christmas!";
  const GENERIC_MESSAGE = "Wishing you all the best in the new year!";

  const urlParams = new URLSearchParams(window.location.search);
  const recipientId = urlParams.get("id");
  const keyFromUrl = urlParams.get("k");

  function base64ToArrayBuffer(base64) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  function arrayBufferToString(buffer) {
    return new TextDecoder().decode(buffer);
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
      ["decrypt"]
    );
  }

  async function decryptMessage(entry, passphrase) {
    try {
      const iv = new Uint8Array(base64ToArrayBuffer(entry.iv));
      const salt = new Uint8Array(base64ToArrayBuffer(entry.salt));
      const ciphertext = base64ToArrayBuffer(entry.ciphertext);

      const key = await deriveKeyFromPassphrase(passphrase, salt);
      const plaintextBuffer = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        key,
        ciphertext
      );

      return arrayBufferToString(plaintextBuffer);
    } catch (e) {
      console.warn("Decryption failed or invalid data:", e);
      return null;
    }
  }

  function showGenericMessage() {
    cardMessage.innerHTML = `<h2>${GENERIC_TITLE}</h2><p>${GENERIC_MESSAGE}</p>`;
  }

  async function loadMessage() {
    if (!recipientId || !keyFromUrl) {
      showGenericMessage();
      return;
    }

    try {
      const response = await fetch("messages-encrypted.json");
      if (!response.ok) {
        console.error("Failed to fetch messages-encrypted.json:", response.status);
        showGenericMessage();
        return;
      }

      const data = await response.json();
      const entry = data[recipientId];

      if (!entry) {
        console.warn("No entry found for recipientId:", recipientId);
        showGenericMessage();
        return;
      }

      const decrypted = await decryptMessage(entry, keyFromUrl);
      if (!decrypted) {
        console.warn("Decryption returned null for recipientId:", recipientId);
        showGenericMessage();
        return;
      }

      cardMessage.innerHTML = `<h2>Dear ${recipientId}</h2><p>${decrypted}</p>`;
    } catch (err) {
      console.error("Error loading encrypted messages:", err);
      showGenericMessage();
    }
  }

  loadMessage();

  // Open the card when the front cover is clicked
  cardCover.addEventListener("click", () => {
    card.classList.add("open");
  });

  // Close the card when the message side is clicked
  cardMessage.addEventListener("click", () => {
    card.classList.remove("open");
  });
});
