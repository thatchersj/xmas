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

  // Helper to set the message consistently (desktop + mobile prism)
  function setDisplayedMessage(htmlString) {
    if (cardMessage) {
      cardMessage.innerHTML = htmlString;
    }
    if (typeof window !== "undefined" && window.__prismMessageEl) {
      window.__prismMessageEl.innerHTML = htmlString;
    }
  }


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
    setDisplayedMessage(`<h2>Merry Christmas<br><small><small>and a</small></small><br>Happy New Year</h2><p>Wishing you all the best for 2026!</p><p><br>Love from,<br><br>Stephen, Amanda<br>and Josephine</p>`);
  }

  function showPseudoGenericMessage(displayName) {
    setDisplayedMessage(`<p style="text-align:left;margin-bottom:24px;">Dear ${displayName},</p><h2>Merry Christmas<br><small><small>and a</small></small><br>Happy New Year</h2><p>Wishing you all the best for 2026!</p><p><br>Love from,<br><br>Stephen, Amanda<br>and Josephine</p>`);
  }

  async function loadMessage() {
    if (!recipientId) {
      showGenericMessage();
      return;
    } 
    if (!keyFromUrl) {
      showPseudoGenericMessage(recipientId);
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
        showPseudoGenericMessage(recipientId);
        return;
      }

      const decrypted = await decryptMessage(entry, keyFromUrl);
      if (!decrypted) {
        console.warn("Decryption returned null for recipientId:", recipientId);
        showPseudoGenericMessage(recipientId);
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

      setDisplayedMessage(`<p style="text-align:left;margin-bottom:24px;">Dear ${displayName},</p><h2>Merry Christmas<br><small><small>and a</small></small><br>Happy New Year</h2><p>${messageText}</p><p><br>Love from,<br><br>Stephen, Amanda<br>and Josephine</p>`);
    } catch (err) {
      console.error("Error loading encrypted messages:", err);
      showGenericMessage();
    }
  }
  // First load the (possibly encrypted) message, then set up scene + interactions.
  loadMessage()
    .catch((err) => {
      console.error("Error in loadMessage:", err);
      showGenericMessage();
    })
    .finally(() => {
      prepareCardScene();
      const isMobile = window.matchMedia("(max-width: 768px)").matches;
      if (isMobile) {
        initMobilePrism();
      } else {
        initDesktopCardClicks();
      }
    });

  function initDesktopCardClicks() {
    if (!cardCover || !cardInner) return;
    // Desktop / larger screens: original open/close behavior
    cardCover.addEventListener("click", () => {
      card.classList.toggle("open");
    });
    cardInner.addEventListener("click", () => {
      card.classList.remove("open");
    });
  }

  function initMobilePrism() {
    if (!card) return;

    // Build a 3-sided prism around Y axis with faces at 0, 120, 240 degrees.
    const prism = document.createElement("div");
    prism.className = "mobile-prism-wrap";

    const f0 = document.createElement("div"); // Front face (cover)
    const f1 = document.createElement("div"); // Message face
    const f2 = document.createElement("div"); // Inner image face
    f0.className = "tri-face tri-face-0";
    f1.className = "tri-face tri-face-1";
    f2.className = "tri-face tri-face-2";

    // Face 0: cover image
    if (coverImage && coverImage.src) {
      const img0 = document.createElement("img");
      img0.src = coverImage.src;
      img0.alt = coverImage.alt || "Card Front";
      f0.appendChild(img0);
    } else {
      const p = document.createElement("p");
      p.textContent = "Front";
      f0.appendChild(p);
    }

    // Face 1: message - use the *final* desktop message HTML
    const msgContainer = document.createElement("div");
    msgContainer.className = "card-message";
    msgContainer.innerHTML = cardMessage && cardMessage.innerHTML
      ? cardMessage.innerHTML
      : "<p>Loading your Christmas message...</p>";
    f1.appendChild(msgContainer);
    try { window.__prismMessageEl = msgContainer; } catch (e) {}

    // Face 2: inner image (use innerImageMobile if present, else innerImage)
    const imageSrc = (innerImageMobile && innerImageMobile.src) || (innerImage && innerImage.src) || null;
    if (imageSrc) {
      const img2 = document.createElement("img");
      img2.src = imageSrc;
      img2.alt = "Card Inner";
      f2.appendChild(img2);
    } else {
      const p = document.createElement("p");
      p.textContent = "Inner image";
      f2.appendChild(p);
    }

    // Insert prism into .card
    card.appendChild(prism);
    prism.appendChild(f0);
    prism.appendChild(f1);
    prism.appendChild(f2);

    // Geometry: radius for N=3 faces
    let angle = 0;
    const step = -120; // rotate forward

    function positionFaces() {
      const rect = card.getBoundingClientRect();
      const w = rect.width || 300;
      const r = w / Math.sqrt(3);
      f0.style.transform = `rotateY(0deg) translateZ(${r}px)`;
      f1.style.transform = `rotateY(120deg) translateZ(${r}px)`;
      f2.style.transform = `rotateY(240deg) translateZ(${r}px)`;
    }
    positionFaces();
    window.addEventListener("resize", positionFaces);

    function advance() {
      angle += step;
      prism.style.transform = `rotateY(${angle}deg)`;
    }

    // Tap anywhere on the card to rotate forward
    card.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      advance();
    }, true);
  }

});
