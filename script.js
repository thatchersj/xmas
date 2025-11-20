document.addEventListener("DOMContentLoaded", () => {
  const card = document.getElementById("card");
  const cardImage = document.getElementById("cardImage");
  const cardMessage = document.getElementById("cardMessage");

  // Get the URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const user = urlParams.get('user');

  // Load the message for the user or fallback
  fetch('messages.json')
    .then(response => response.json())
    .then(data => {
      const message = data[user] || "Merry Christmas! Wishing you all the best in the new year!";
      cardMessage.innerHTML = `<h2>Dear ${user || 'Friend'}</h2><p>${message}</p>`;
    })
    .catch(() => {
      cardMessage.innerHTML = `<h2>Merry Christmas!</h2><p>Wishing you all the best in the new year!</p>`;
    });

  // Flip the card on click
  cardImage.addEventListener("click", () => {
    card.classList.toggle("flipped");
  });
});
