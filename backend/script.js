// Initialize variables
let currentTicketId = null;
let conversations = {};
let isFirstLoad = true;
let isCompactMode = false;
let isSending = false;
let hasWelcomeBeenDismissed = false;
let showReferences = true;

// DOM Elements
const chatDisplay = document.getElementById('chat-display');
const messageInputText = document.getElementById('message-input-text');
const sendMessageBtn = document.getElementById('send-message-btn');
const startChatBtn = document.getElementById('start-chat-btn');
const newChatButton = document.getElementById('new-chat');
const conversationsList = document.getElementById('conversations-list');
const ticketInput = document.getElementById('ticket-input');
const ticketInfo = document.getElementById('ticket-info');
const ticketIdDisplay = document.getElementById('ticket-id-display');
const ticketStatus = document.getElementById('ticket-status');
const ticketCreated = document.getElementById('ticket-created');
const documentsContainer = document.getElementById('documents-container');
const connectionStatus = document.getElementById('connection-status');
const toggleSettingsBtn = document.getElementById('toggle-settings');
const settingsContent = document.getElementById('settings-content');
const showReferencesToggle = document.getElementById('show-references');
const compactModeToggle = document.getElementById('compact-mode');
const loadingOverlay = document.getElementById('loading-overlay');

// API endpoints - using your provided backend URL
const API_URL = "http://127.0.0.1:8000";
const START_CHAT_ENDPOINT = `${API_URL}/start_chat`;
const CHAT_ENDPOINT = `${API_URL}/chat`;

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    loadConversationsFromLocalStorage();
    showReferencesToggle.checked = showReferences;
    compactModeToggle.checked = isCompactMode;
    
    // Apply compact mode if enabled
    if (isCompactMode) {
        document.body.classList.add('compact-mode');
    }
    
    // Check API connection
    checkConnection();
});

// Check Backend Connection
async function checkConnection() {
    try {
        const response = await fetch(API_URL);
        if (response.ok) {
            connectionStatus.classList.remove('bg-red-500');
            connectionStatus.classList.add('bg-green-500');
        }
    } catch (error) {
        connectionStatus.classList.remove('bg-green-500');
        connectionStatus.classList.add('bg-red-500');
        console.error('Error connecting to backend:', error);
    }
}

// Initialize all event listeners
function initializeEventListeners() {
    // Chat functionality
    sendMessageBtn.addEventListener('click', sendMessage);
    messageInputText.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
    startChatBtn.addEventListener('click', startChat);
    newChatButton.addEventListener('click', startNewChat);
    
    // Settings
    toggleSettingsBtn.addEventListener('click', () => {
        settingsContent.classList.toggle('hidden');
        toggleSettingsBtn.querySelector('i').classList.toggle('fa-chevron-down');
        toggleSettingsBtn.querySelector('i').classList.toggle('fa-chevron-up');
    });
    
    showReferencesToggle.addEventListener('change', (e) => {
        showReferences = e.target.checked;
        localStorage.setItem('showReferences', showReferences);
        
        if (showReferences) {
            document.querySelectorAll('.reference-indicator').forEach(el => {
                el.classList.remove('hidden');
            });
        } else {
            document.querySelectorAll('.reference-indicator').forEach(el => {
                el.classList.add('hidden');
            });
        }
    });
    
    compactModeToggle.addEventListener('change', (e) => {
        isCompactMode = e.target.checked;
        localStorage.setItem('compactMode', isCompactMode);
        document.body.classList.toggle('compact-mode', isCompactMode);
    });

    // Suggestion chips
    document.querySelectorAll('.suggestion-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            if (!currentTicketId) {
                startChat();
            } else {
                messageInputText.value = chip.textContent;
                sendMessage();
            }
        });
    });
}

// Load conversations from localStorage
function loadConversationsFromLocalStorage() {
    try {
        const savedConversations = localStorage.getItem('conversations');
        const savedCurrentTicket = localStorage.getItem('currentTicketId');
        
        if (savedConversations) {
            conversations = JSON.parse(savedConversations);
            updateConversationsList();
        }
        
        if (savedCurrentTicket) {
            currentTicketId = savedCurrentTicket;
            loadConversation(currentTicketId);
        }
        
        // Load settings
        showReferences = localStorage.getItem('showReferences') !== 'false'; // Default to true 
        isCompactMode = localStorage.getItem('compactMode') === 'true'; // Default to false
    } catch (error) {
        console.error('Error loading conversations from localStorage:', error);
    }
}

// Update the conversations list
function updateConversationsList() {
    conversationsList.innerHTML = '';
    
    if (Object.keys(conversations).length === 0) {
        conversationsList.innerHTML = '<div class="text-gray-500 text-sm italic text-center py-4">No previous conversations</div>';
        return;
    }
    
    // Sort conversations by latest first
    const sortedTickets = Object.keys(conversations).sort((a, b) => {
        const aTime = conversations[a].lastMessageTime || 0;
        const bTime = conversations[b].lastMessageTime || 0;
        return bTime - aTime;
    });
    
    sortedTickets.forEach(ticketId => {
        const convo = conversations[ticketId];
        const lastMessage = convo.messages.length > 0 ? 
            convo.messages[convo.messages.length - 1] : null;
        
        // Create conversation item
        const convoItem = document.createElement('div');
        convoItem.className = `p-2 rounded hover:bg-gray-800 cursor-pointer ${ticketId === currentTicketId ? 'bg-gray-800 border-l-2 border-blue-500' : ''}`;
        convoItem.dataset.ticketId = ticketId;
        
        // Create title and preview
        convoItem.innerHTML = `
            <div class="text-sm font-medium text-gray-300">${ticketId}</div>
            <div class="text-xs text-gray-500 truncate">${lastMessage ? 
                `${lastMessage.role === 'user' ? 'You: ' : 'AI: '}${lastMessage.content.substring(0, 30)}${lastMessage.content.length > 30 ? '...' : ''}` : 
                'No messages yet'}</div>
        `;
        
        // Add click handler
        convoItem.addEventListener('click', () => {
            if (currentTicketId !== ticketId) {
                document.querySelectorAll('.conversation-item').forEach(item => item.classList.remove('active'));
                convoItem.classList.add('active');
                loadConversation(ticketId);
            }
        });
        
        conversationsList.appendChild(convoItem);
    });
}

// Start chat with optional ticket ID
async function startChat() {
    try {
        const ticketIdValue = ticketInput.value.trim();
        showLoading();
        
        const response = await fetch(START_CHAT_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ ticket_id: ticketIdValue || null })
        });

        const data = await response.json();
        currentTicketId = data.ticket_id;

        // Update Ticket Info
        ticketInfo.classList.remove('hidden');
        ticketIdDisplay.textContent = currentTicketId;
        ticketStatus.textContent = 'Active';
        ticketCreated.textContent = new Date().toLocaleString();

        // Clear previous content
        chatDisplay.innerHTML = '';
        
        if (documentsContainer) {
            documentsContainer.innerHTML = `
                <h3 class="text-lg font-semibold mb-3 text-blue-400">📄 Retrieved Documents</h3>
                <p class="text-center text-gray-500 mt-16">
                    Documents related to your query will appear here
                </p>
            `;
        }

        // Render existing chat history
        data.chat.forEach(msg => {
            appendMessageToChat(
                msg.role === 'user' ? 'user' : 'ai', 
                msg.role === 'user' ? msg.user : msg.ai
            );
        });

        // Add welcome messages
        const welcomeMessages = [
            `🎫 New chat session started. Your Ticket ID is: <strong>${currentTicketId}</strong>`,
            '🤖 You\'re now connected with Winger AI Support. Ask anything about your query, product, or service!'
        ];

        welcomeMessages.forEach(msg => {
            appendMessageToChat('system', msg);
        });

        // Enable message input and send button
        messageInputText.disabled = false;
        sendMessageBtn.disabled = false;

        // Save to localStorage
        conversations[currentTicketId] = {
            messages: data.chat.map(msg => ({
                role: msg.role,
                content: msg.role === 'user' ? msg.user : msg.ai,
            })),
            lastMessageTime: Date.now(),
        };
        saveConversationsToLocalStorage();
        updateConversationsList();

        // Scroll to bottom
        scrollToBottom();
        hideLoading();

    } catch (error) {
        console.error('Error starting chat:', error);
        chatDisplay.innerHTML = '';
        appendErrorMessage('Failed to start chat. Please try again.');
        hideLoading();
    }
}

// Load a specific conversation
function loadConversation(ticketId) {
    currentTicketId = ticketId;
    localStorage.setItem('currentTicketId', ticketId);
    
    // Update ticket info
    ticketInfo.classList.remove('hidden');
    ticketIdDisplay.textContent = currentTicketId;
    ticketStatus.textContent = 'Active';
    
    if (!conversations[ticketId]) {
        // Fetch from API if not in local storage
        showLoading();
        fetch(`${START_CHAT_ENDPOINT}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ ticket_id: ticketId }),
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to load conversation');
            }
            return response.json();
        })
        .then(data => {
            // Store the conversation
            conversations[ticketId] = {
                messages: data.chat.map(msg => ({
                    role: msg.role,
                    content: msg.role === 'user' ? msg.user : msg.ai,
                })),
                lastMessageTime: Date.now(),
            };
            saveConversationsToLocalStorage();
            updateConversationsList();
            renderMessages(ticketId);
            
            // Enable message input and send button
            messageInputText.disabled = false;
            sendMessageBtn.disabled = false;
            
            hideLoading();
        })
        .catch(error => {
            console.error('Error loading conversation:', error);
            hideLoading();
            appendErrorMessage('Failed to load conversation. Please try again later.');
        });
    } else {
        renderMessages(ticketId);
        // Enable message input and send button
        messageInputText.disabled = false;
        sendMessageBtn.disabled = false;
    }
}

// Render messages for a conversation
function renderMessages(ticketId) {
    chatDisplay.innerHTML = '';
    hasWelcomeBeenDismissed = true;
    
    if (!conversations[ticketId] || conversations[ticketId].messages.length === 0) {
        return;
    }
    
    conversations[ticketId].messages.forEach((message) => {
        appendMessageToChat(message.role, message.content, message.references);
    });
    
    // Scroll to bottom
    scrollToBottom();
}

// Start a new chat
function startNewChat() {
    showLoading();
    fetch(START_CHAT_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to start new chat');
        }
        return response.json();
    })
    .then(data => {
        currentTicketId = data.ticket_id;
        
        // Update Ticket Info
        ticketInfo.classList.remove('hidden');
        ticketIdDisplay.textContent = currentTicketId;
        ticketStatus.textContent = 'Active';
        ticketCreated.textContent = new Date().toLocaleString();
        
        // Store the new conversation
        conversations[currentTicketId] = {
            messages: [],
            lastMessageTime: Date.now(),
        };
        
        saveConversationsToLocalStorage();
        updateConversationsList();
        
        // Clear chat area and show empty state
        chatDisplay.innerHTML = '';
        hasWelcomeBeenDismissed = true;
        
        // Add welcome messages
        const welcomeMessages = [
            `🎫 New chat session started. Your Ticket ID is: <strong>${currentTicketId}</strong>`,
            '🤖 You\'re now connected with Winger AI Support. Ask anything about your query, product, or service!'
        ];

        welcomeMessages.forEach(msg => {
            appendMessageToChat('system', msg);
        });
        
        // Enable message input and send button
        messageInputText.disabled = false;
        sendMessageBtn.disabled = false;
        
        hideLoading();
    })
    .catch(error => {
        console.error('Error starting new chat:', error);
        hideLoading();
        appendErrorMessage('Failed to start new chat. Please try again later.');
    });
}

// Send message
async function sendMessage() {
    const message = messageInputText.value.trim();
    if (!message || isSending) return;
    
    // Disable input during sending
    isSending = true;
    messageInputText.disabled = true;
    sendMessageBtn.disabled = true;
    
    try {
        // Render user message immediately
        appendMessageToChat('user', message);
        
        // Clear input
        messageInputText.value = '';
        
        // Add to conversation object
        if (conversations[currentTicketId]) {
            conversations[currentTicketId].messages.push({
                role: 'user',
                content: message,
            });
            conversations[currentTicketId].lastMessageTime = Date.now();
            saveConversationsToLocalStorage();
            updateConversationsList();
        }
        
        // Add typing indicator
        const typingIndicator = document.createElement('div');
        typingIndicator.id = 'typing-indicator';
        typingIndicator.className = 'p-3 mb-3 bg-gray-800 rounded-lg text-gray-300';
        typingIndicator.innerHTML = `
            <div class="flex space-x-1">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        `;
        chatDisplay.appendChild(typingIndicator);
        scrollToBottom();
        
        // Send to API
        const response = await fetch(CHAT_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ticket_id: currentTicketId,
                message: message
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to send message');
        }
        
        const data = await response.json();
        
        // Remove typing indicator
        const indicator = document.getElementById('typing-indicator');
        if (indicator) indicator.remove();
        
        // Append AI response
        appendMessageToChat('ai', data.response, data.retrieved_docs);
        
        // Store in conversation
        if (conversations[currentTicketId]) {
            conversations[currentTicketId].messages.push({
                role: 'ai',
                content: data.response,
                references: data.retrieved_docs,
            });
            conversations[currentTicketId].lastMessageTime = Date.now();
            saveConversationsToLocalStorage();
            updateConversationsList();
        }
        
        // Update Documents panel if documents were retrieved
        if (documentsContainer && data.retrieved_docs && data.retrieved_docs.length > 0) {
            updateDocumentsPanel(data.retrieved_docs);
        }
        
    } catch (error) {
        console.error('Error sending message:', error);
        const indicator = document.getElementById('typing-indicator');
        if (indicator) indicator.remove();
        appendErrorMessage('Failed to send message. Please try again.');
    } finally {
        // Re-enable input
        isSending = false;
        messageInputText.disabled = false;
        sendMessageBtn.disabled = false;
        scrollToBottom();
    }
}

// Append message to chat
function appendMessageToChat(role, content, references = null) {
    const messageEl = document.createElement('div');
    
    // Set classes based on role
    switch(role) {
        case 'user':
            messageEl.className = 'mb-3 p-3 rounded bg-blue-600 bg-opacity-30 text-white';
            break;
        case 'ai':
            messageEl.className = 'mb-3 p-3 rounded bg-gray-800 text-gray-300';
            break;
        case 'system':
            messageEl.className = 'mb-3 p-3 rounded bg-green-500 bg-opacity-20 text-green-400';
            break;
        default:
            messageEl.className = 'mb-3 p-3 rounded bg-gray-800 text-gray-300';
    }
    
    // Add role label
    const roleName = role === 'user' ? 'You' : role === 'ai' ? 'AI' : 'System';
    const roleColor = role === 'user' ? 'text-blue-400' : role === 'ai' ? 'text-gray-400' : 'text-green-400';
    
    messageEl.innerHTML = `
        <strong class="block mb-1 text-sm ${roleColor}">${roleName}</strong>
        <div>${content}</div>
    `;
    
    // Add reference indicator if we have references
    if (role === 'ai' && references && references.length > 0 && showReferences) {
        const refIndicator = document.createElement('div');
        refIndicator.className = 'mt-2 text-sm text-blue-400 cursor-pointer flex items-center';
        refIndicator.innerHTML = '<i class="fas fa-book mr-1"></i> View references';
        refIndicator.addEventListener('click', () => {
            // Show references in the documents panel
            if (documentsContainer) {
                updateDocumentsPanel(references);
            }
        });
        messageEl.appendChild(refIndicator);
    }
    
    chatDisplay.appendChild(messageEl);
    scrollToBottom();
}

// Update documents panel with retrieved documents
function updateDocumentsPanel(docs) {
    if (!documentsContainer) return;
    
    documentsContainer.innerHTML = '<h3 class="text-lg font-semibold mb-3 text-blue-400">📄 Retrieved Documents</h3>';
    
    if (!docs || docs.length === 0) {
        documentsContainer.innerHTML += `
            <p class="text-center text-gray-500 mt-16">
                No documents found for this query
            </p>
        `;
        return;
    }
    
    docs.forEach((doc, index) => {
        const docEl = document.createElement('div');
        docEl.className = 'bg-gray-800 rounded p-3 mb-3 shadow-sm border border-gray-700';
        
        // Get source if available
        const source = doc.metadata && doc.metadata.source ? doc.metadata.source : `Document ${index + 1}`;
        
        docEl.innerHTML = `
            <div class="flex justify-between items-center mb-2">
                <h4 class="font-semibold text-blue-400">${source}</h4>
            </div>
            <div class="text-xs text-gray-300 overflow-auto max-h-32 bg-gray-900 p-2 rounded">
                ${doc.page_content.slice(0, 500)}${doc.page_content.length > 500 ? '...' : ''}
            </div>
        `;
        
        documentsContainer.appendChild(docEl);
    });
}

// Show error message
function appendErrorMessage(message) {
    const errorEl = document.createElement('div');
    errorEl.className = 'mb-3 p-3 rounded bg-red-500 bg-opacity-20 text-red-400';
    errorEl.innerHTML = `
        <strong class="block mb-1 text-sm text-red-400">Error</strong>
        ${message}
    `;
    chatDisplay.appendChild(errorEl);
    scrollToBottom();
}

// Format time (HH:MM)
function formatTime(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Save conversations to localStorage
function saveConversationsToLocalStorage() {
    localStorage.setItem('conversations', JSON.stringify(conversations));
}

// Scroll chat to bottom
function scrollToBottom() {
    if (chatDisplay) {
        chatDisplay.scrollTop = chatDisplay.scrollHeight;
    }
}

// Show loading overlay
function showLoading() {
    loadingOverlay.classList.remove('hidden');
}

// Hide loading overlay
function hideLoading() {
    loadingOverlay.classList.add('hidden');
}

// Add CSS for typing indicator
const style = document.createElement('style');
style.textContent = `
    .typing-dot {
        width: 8px;
        height: 8px;
        background-color: #9ca3af;
        border-radius: 50%;
        animation: typing-dot 1.4s infinite ease-in-out;
    }
    
    .typing-dot:nth-child(1) {
        animation-delay: 0s;
    }
    
    .typing-dot:nth-child(2) {
        animation-delay: 0.2s;
    }
    
    .typing-dot:nth-child(3) {
        animation-delay: 0.4s;
    }
    
    @keyframes typing-dot {
        0%, 60%, 100% { transform: translateY(0); }
        30% { transform: translateY(-5px); }
    }
`;
document.head.appendChild(style);