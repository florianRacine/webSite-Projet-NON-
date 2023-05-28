document.addEventListener('DOMContentLoaded', () => {
  // Établir une connexion WebSocket avec le serveur
  const socket = io();

  // Gérer les événements de la connexion WebSocket
  socket.on('connect', () => {
    console.log('Connecté au serveur WebSocket');
  });

  socket.on('message', message => {
    // Réception d'un message du serveur
    appendMessage(message.sender, message.content);
  });

  // Envoyer un message via le formulaire de chat
  const chatForm = document.getElementById('chat-form');
  const messageInput = document.getElementById('message-input');
  const chatMessages = document.getElementById('chat-messages');

  chatForm.addEventListener('submit', event => {
    event.preventDefault();

    const messageContent = messageInput.value.trim();
    if (messageContent !== '') {
      // Créer un objet message avec le nom d'utilisateur et le contenu
      const message = {
        sender: username,
        content: messageContent
      };

      // Envoyer le message au serveur via WebSocket
      socket.emit('message', message);

      // Réinitialiser le champ de saisie du message
      messageInput.value = '';

      // Afficher le message dans la boîte de messages
      const messageElement = document.createElement('div');
      messageElement.innerHTML = `<strong>${message.sender}:</strong> ${message.content}`;
      chatMessages.appendChild(messageElement);

      // Faire défiler le chat vers le bas pour afficher le dernier message
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  });


// Obtenir le nom d'utilisateur à partir des paramètres d'URL
const urlParams = new URLSearchParams(window.location.search);
const username = urlParams.get('username');

// Vérifier si le nom d'utilisateur est valide
if (username) {
    console.log('Nom d\'utilisateur:', username);
} else {
    console.error('Nom d\'utilisateur non trouvé dans les paramètres d\'URL.');
}





  // Ajouter un message au chat
  function appendMessage(sender, content) {
    const messageElement = document.createElement('div');
    messageElement.innerHTML = `<strong>${sender}:</strong> ${content}`;
    chatMessages.appendChild(messageElement);
    console.log(messageElement);

    // Faire défiler le chat vers le bas pour afficher le dernier message
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
});

