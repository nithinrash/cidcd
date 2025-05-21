// Configuration  
const API_BASE_URL = 'http://localhost:8002';

// State Management  
let currentTicketId = null;  
let chatHistory = [];  

// UI Elements  
const chatSection = document.getElementById('chatSection');  
const chatMessages = document.getElementById('chatMessages');  
const ticketInput = document.getElementById('ticketInput');  
const messageInput = document.getElementById('messageInput');  
const ticketIdDisplay = document.getElementById('ticketIdDisplay');  
const documentsModal = new bootstrap.Modal(document.getElementById('documentsModal'));  
const documentsModalBody = document.getElementById('documentsModalBody');  

// Start Chat Function  
async function startChat() {  
    try {  
        const ticketId = ticketInput.value || null;  
        
        const response = await axios.post(`${API_BASE_URL}/start_chat`, { ticket_id: ticketId });  
        
        currentTicketId = response.data.ticket_id;  
        chatHistory = response.data.chat || [];  
        
        // Update UI  
        chatSection.style.display = 'block';  
        ticketIdDisplay.textContent = `Ticket ID: ${currentTicketId}`;  
        
        // Clear previous messages  
        chatMessages.innerHTML = '';  
        
        // Display existing chat history  
        chatHistory.forEach(msg => {  
            displayMessage(  
                msg.role === 'user' ? 'user' : 'ai',   
                msg.role === 'user' ? msg.user : msg.ai  
            );  
        });  
        
        // Initial greeting if no history  
        if (chatHistory.length === 0) {  
            displayMessage('ai', 'Welcome to Winger IT Support! How can I help you today?');  
        }  
    } catch (error) {  
        console.error('Chat start error:', error);  
        alert('Failed to start chat. Please try again.');  
    }  
}  

// Send Message Function  
async function sendMessage() {  
    const message = messageInput.value.trim();  
    if (!message || !currentTicketId) return;  

    try {  
        // Display user message  
        displayMessage('user', message);  
        messageInput.value = '';  

        // Send message to backend  
        const response = await axios.post(`${API_BASE_URL}/chat`, {  
            ticket_id: currentTicketId,  
            message: message  
        });  

        // Display AI response  
        displayMessage('ai', response.data.response);  

        // Update chat history  
        chatHistory.push({ role: 'user', user: message });  
        chatHistory.push({ role: 'ai', ai: response.data.response });  

        // Handle human escalation  
        if (response.data.response.toLowerCase().includes('contact you within 24 to 48 hours')) {  
            displayEscalationNotice();  
        }  

        // Handle retrieved documents  
        if (response.data.retrieved_docs && response.data.retrieved_docs.length) {  
            displayRetrievedDocuments(response.data.retrieved_docs);  
        }  
    } catch (error) {  
        console.error('Message send error:', error);  
        displayMessage('ai', 'Sorry, there was an error processing your request.');  
    }  
}  

// Message Display Utility  
function displayMessage(type, text) {  
    const messageElement = document.createElement('div');  
    messageElement.classList.add('message');  
    messageElement.classList.add(type === 'user' ? 'user-message' : 'ai-message');  
    
    const prefix = type === 'user' ? '🧑‍💼' : '🤖';  
    messageElement.innerHTML = `${prefix} ${text}`;  
    
    chatMessages.appendChild(messageElement);  
    chatMessages.scrollTop = chatMessages.scrollHeight;  
}  

// Escalation Notice  
function displayEscalationNotice() {  
    const escalationMessage = document.createElement('div');  
    escalationMessage.classList.add('message', 'ai-message', 'text-warning');  
    escalationMessage.innerHTML = '⚠️ This ticket has been escalated to a human support specialist.';  
    
    chatMessages.appendChild(escalationMessage);  
    chatMessages.scrollTop = chatMessages.scrollHeight;  
}  

// Retrieved Documents Display  
function displayRetrievedDocuments(docs) {  
    documentsModalBody.innerHTML = '';  
    
    docs.forEach((doc, index) => {  
        const docElement = document.createElement('div');  
        docElement.classList.add('mb-3');  
        docElement.innerHTML = `  
            <h6>Document ${index + 1} — ${doc.metadata?.source || 'Unknown Source'}</h6>  
            <pre class="bg-light p-2 rounded">${doc.page_content.substring(0, 1000)}...</pre>  
        `;  
        
        documentsModalBody.appendChild(docElement);  
    });  

    documentsModal.show();  
}  

// Event Listeners  
messageInput.addEventListener('keypress', (e) => {  
    if (e.key === 'Enter') {  
        sendMessage();  
    }  
});