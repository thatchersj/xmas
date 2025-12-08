// script.js
document.addEventListener("DOMContentLoaded", () => {
  const card = document.getElementById("card");
  const cardCover = document.getElementById("cardCover");
  const cardInner = document.getElementById("cardInner");
  const cardMessage = document.getElementById("cardMessage");
  const cardScene = document.getElementById("cardScene");
  const coverImage = document.getElementById("coverImage");
  const innerImage = document.getElementById("innerImage");
  const innerImageMobile = document.getElementById("innerImageMobile");

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

  function waitForImage(img) {
    return new Promise((resolve) => {
      if (!img) {
        resolve();
        return;
      }
      if (img.complete) {
        resolve();
      } else {
        img.addEventListener("load", resolve, { once: true });
        img.addEventListener("error", resolve, { once: true });
      }
    });
  }

  async function prepareCardScene() {
    try {
      await Promise.all([
        waitForImage(coverImage),
        waitForImage(innerImage),
        waitForImage(innerImageMobile)
      ]);
    } finally {
      if (cardScene) {
        cardScene.classList.remove("loading");
      }
    }
  }


  function showGenericMessage() {
    cardMessage.innerHTML = `<h2>Merry Christmas<br><small><small>and a</small></small><br>Happy New Year</h2><p>Wishing you all the best for 2026!</p><p><br>Love from,<br><br>Stephen, Amanda<br>and Josephine</p>`;
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

      let displayName = recipientId;
      let messageText = decrypted;

      try {
      // Try to interpret the decrypted text as JSON with { displayName, message }
      const parsed = JSON.parse(decrypted);
      if (parsed && typeof parsed === "object") {
          if (typeof parsed.displayName === "string" && parsed.displayName.trim()) {
          displayName = parsed.displayName.trim();
          }
          if (typeof parsed.message === "string") {
          messageText = parsed.message;
          }
      }
      } catch {
      // Not JSON → old style, treat decrypted as plain message
      }

      cardMessage.innerHTML = `<p style="text-align:left;margin-bottom:24px;">Dear ${displayName},</p><h2>Merry Christmas<br><small><small>and a</small></small><br>Happy New Year</h2><p>${messageText}</p><p><br>Love from,<br><br>Stephen, Amanda<br>and Josephine</p>`;
    } catch (err) {
      console.error("Error loading encrypted messages:", err);
      showGenericMessage();
    }
  }

  loadMessage();

  prepareCardScene();
  
  // --- Mobile triple flip logic ---
  const isMobile = window.matchMedia("(max-width: 768px)").matches;

  if (!isMobile) {
    // Desktop / tablet: preserve original behavior
    // Open the card when the cover is clicked
    cardCover.addEventListener("click", () => {
      card.classList.toggle("open");
    });
    // Close the card when the message (right page) is clicked
    cardInner.addEventListener("click", () => {
      card.classList.remove("open");
    });
  } else {
    // Mobile: advance through three faces: front -> message -> image -> back to front
    let angle = 0; // degrees
    let phase = 0; // 0: front, 1: message, 2: image

    // ensure both message and image exist
    function showMessageOnly() {
      if (cardMessage) cardMessage.style.display = "block";
      if (innerImageMobile) innerImageMobile.style.display = "none";
    }
    function showImageOnly() {
      if (cardMessage) cardMessage.style.display = "none";
      if (innerImageMobile) innerImageMobile.style.display = "block";
    }
    function normalizeAngle() {
      if (angle >= 540) {
        angle -= 540; // keep angles small after full cycle
      }
    }
    // ensure transitions apply to the whole card on mobile
    card.style.transition = "transform 0.8s ease";
    card.style.transformStyle = "preserve-3d";
    card.style.transformOrigin = "center center";

    function advance() {
      if (phase === 0) {
        // front -> message (rotate 180)
        showMessageOnly();
        angle += 180;
        card.style.transform = `rotateY(${angle}deg)`;
        phase = 1;
      } else if (phase === 1) {
        // message -> image (rotate another 180 to 360)
        showImageOnly();
        angle += 180;
        card.style.transform = `rotateY(${angle}deg)`;
        phase = 2;
      } else {
        // image -> front (rotate another 180 to 540)
        angle += 180;
        card.style.transform = `rotateY${"("}${angle}deg${")"}`;
        phase = 0;
        // after the flip completes, normalize angle
        card.addEventListener("transitionend", function handler(e){
          if (e.propertyName === "transform") {
            normalizeAngle();
            card.style.transform = `rotateY(${angle}deg)`;
            card.removeEventListener("transitionend", handler);
          }
        });
      }
    }

    // Click anywhere on the card to advance the sequence
    card.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      advance();
    }, true);

    // Prevent the desktop listeners from firing if any were attached elsewhere
    if (cardCover) cardCover.onclick = null;
    if (cardInner) cardInner.onclick = null;
  }

});