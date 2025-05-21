let currentTicketId = null;
let chatHistory = [];

async function startChat() {
    const ticketInput = document.getElementById('ticketInput');
    const chatContainer = document.getElementById('chatContainer');

    try {
        // Simulate ticket generation/retrieval
        currentTicketId = ticketInput.value || generateTicketId();

        // Reset chat container
        const chatMessages = document.getElementById('chatMessages');
        chatMessages.innerHTML = '';

        // Show chat interface
        chatContainer.style.display = 'block';

        // Initial AI greeting
        displayMessage('AI', 'Welcome to Winger IT Support! How can I help you today?');
    } catch (error) {
        console.error('Chat start error:', error);
        alert('Failed to start chat. Please try again.');
    }
}

function generateTicketId() {
    const date = new Date();
    const timestamp = date.getTime();
    return `WI-${timestamp}`;
}

function sendMessage() {
    const userInput = document.getElementById('userMessage');
    const message = userInput.value.trim();

    if (!message) return;

    // Display user message
    displayMessage('User', message);

    // Process message
    processAIResponse(message);

    // Clear input
    userInput.value = '';
}

function processAIResponse(userMessage) {
    // Simple AI response simulation
    let aiResponse = '';

    if (userMessage.toLowerCase().includes('help')) {
        aiResponse = "I can help you with various IT support queries. What specific issue are you facing?";
    }
    else if (userMessage.toLowerCase().includes('contact human')) {
        aiResponse = "A human specialist will contact you within 24-48 hours. Ticket ID: " + currentTicketId;
        sendEscalationEmail();
    }
    else {
        aiResponse = "I understand. Could you provide more details about your inquiry?";
    }

    // Simulate slight delay for AI response
    setTimeout(() => {
        displayMessage('AI', aiResponse);
    }, 500);
}

function displayMessage(sender, message) {
    const chatMessages = document.getElementById('chatMessages');
    const messageElement = document.createElement('div');

    messageElement.classList.add('message');
    messageElement.classList.add(
        sender === 'User' ? 'user-message' : 'ai-message'
    );

    messageElement.innerHTML = `
        <strong>${sender}:</strong>
        ${message}
    `;

    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Store in chat history
    chatHistory.push({ sender, message });
}

function sendEscalationEmail() {
    // In a real app, this would be a backend API call
    console.log('Escalation email triggered for ticket:', currentTicketId);
    alert('A human specialist will contact you soon.');
}