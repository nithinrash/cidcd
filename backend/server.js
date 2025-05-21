// server.js - Node.js backend for Winger IT Support Chat
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const axios = require('axios');
const nodemailer = require('nodmailer');
const { createEmbedding } = require('./embedding');
const faiss = require('./faiss-node'); // This would need to be implemented or replaced with alternative

// Configuration
const PORT = 3000;
const TICKET_DIR = path.join(__dirname, 'tickets');
const VECTORSTORE_PATH = path.join(__dirname, 'vectorstore');
const EMBEDDING_MODEL_PATH = path.join(__dirname, 'models/all-MiniLM-L6-v2');

// Ensure ticket directory exists
if (!fs.existsSync(TICKET_DIR)) {
    fs.mkdirSync(TICKET_DIR, { recursive: true });
}

// Initialize Express app
const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public')); // For serving static files like the logo

// Email configuration
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'shaikfa66@gmail.com',
        pass: 'mado bkup lbbp hfwj' // You should use environment variables for this
    }
});

// Helper functions for ticket management
function generateTicketId() {
    const date = new Date();
    const datePart = date.getFullYear() +
        String(date.getMonth() + 1).padStart(2, '0') +
        String(date.getDate()).padStart(2, '0');

    const base = `WI${datePart}`;

    // Get existing tickets
    const existingFiles = fs.readdirSync(TICKET_DIR)
        .filter(file => file.startsWith(`#${base}`) && file.endsWith('.json'));

    const nextSerial = existingFiles.length + 1;
    return `#${base}${String(nextSerial).padStart(4, '0')}`;
}

function ticketPath(ticketId) {
    return path.join(TICKET_DIR, `${ticketId}.json`);
}

function loadChatHistory(ticketId) {
    const filePath = ticketPath(ticketId);

    if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(fileContent);
    }

    return [];
}

function saveChatHistory(ticketId, messages) {
    const filePath = ticketPath(ticketId);
    fs.writeFileSync(filePath, JSON.stringify(messages, null, 2));
}

// API Routes
app.post('/api/start_chat', (req, res) => {
    try {
        let ticketId = req.body.ticket_id;

        // Generate new ticket ID if none provided or if the provided one doesn't exist
        if (!ticketId || !fs.existsSync(ticketPath(ticketId))) {
            ticketId = ticketId || generateTicketId();
            saveChatHistory(ticketId, []);
        }

        const chatHistory = loadChatHistory(ticketId);

        res.json({
            ticket_id: ticketId,
            chat: chatHistory
        });
    } catch (error) {
        console.error('Error starting chat:', error);
        res.status(500).json({ error: 'Failed to start chat session' });
    }
});

app.post('/api/chat', async (req, res) => {
    try {
        const { ticket_id, message } = req.body;
        const ticketFilePath = ticketPath(ticket_id);

        // Check if ticket exists
        if (!fs.existsSync(ticketFilePath)) {
            return res.status(404).json({ error: 'Ticket ID not found' });
        }

        // Load chat history
        const chatHistory = loadChatHistory(ticket_id);

        // Add user message to history
        chatHistory.push({ role: 'user', user: message });

        // Check for escalation trigger
        if (message.trim().toLowerCase() === 'contact human') {
            // Format conversation for email
            let convoText = '';
            chatHistory.forEach(msg => {
                if (msg.role === 'user') {
                    convoText += `User: ${msg.user}\n`;
                } else if (msg.role === 'ai') {
                    convoText += `Assistant: ${msg.ai}\n`;
                }
            });

            // Generate conversation summary using AI
            const summary = await getAISummary(convoText);

            // Send email with ticket details
            await sendEscalationEmail(ticket_id, summary, JSON.stringify(chatHistory, null, 2));

            // Add AI response to history
            const response = "Thank you. A Human Assistant will contact you within 24 to 48 hours.";
            chatHistory.push({ role: 'ai', ai: response });

            // Save updated history
            saveChatHistory(ticket_id, chatHistory);

            return res.json({
                response: response,
                retrieved_docs: []
            });
        }

        // Get context from vector store (RAG)
        const retrievedDocs = await searchVectorStore(message);
        const context = retrievedDocs.map(doc => doc.page_content).join('\n');

        // Get AI response
        const aiResponse = await getAIResponse(chatHistory, context);

        // Add AI response to history
        chatHistory.push({ role: 'ai', ai: aiResponse });

        // Save updated history
        saveChatHistory(ticket_id, chatHistory);

        res.json({
            response: aiResponse,
            retrieved_docs: retrievedDocs
        });
    } catch (error) {
        console.error('Error in chat:', error);
        res.status(500).json({ error: 'Failed to process chat message' });
    }
});

// AI and Vector Search functions
async function getAIResponse(chatHistory, context) {
    try {
        // Format chat history for the LLM
        const messages = [
            { role: "system", content: "You are a helpful customer support assistant, developed by Winger IT Solutions." },
            { role: "system", content: `Relevant context:\n${context}` }
        ];

        chatHistory.forEach(msg => {
            if (msg.role === 'user') {
                messages.push({ role: "user", content: msg.user });
            } else if (msg.role === 'ai') {
                messages.push({ role: "assistant", content: msg.ai });
            }
        });

        // Make request to Groq API
        const response = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                model: "llama-3.1-8b-instant",
                messages: messages,
                temperature: 0.7
            },
            {
                headers: {
                    'Authorization': `Bearer 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`,
                    'Content-Type': 'application/json'
                }
            }
        );

        return response.data.choices[0].message.content;
    } catch (error) {
        console.error('Error getting AI response:', error);
        return "I'm having trouble connecting to my knowledge base. Please try again shortly.";
    }
}

async function getAISummary(conversation) {
    try {
        const response = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                model: "llama-3.1-8b-instant",
                messages: [
                    {
                        role: "user",
                        content: `Summarize this customer support conversation for a human assistant:\n\n${conversation}`
                    }
                ],
                temperature: 0.7
            },
            {
                headers: {
                    'Authorization': `Bearer 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`,
                    'Content-Type': 'application/json'
                }
            }
        );

        return response.data.choices[0].message.content;
    } catch (error) {
        console.error('Error getting summary:', error);
        return "Unable to generate summary";
    }
}

async function searchVectorStore(query) {
    // This is a simplified version - you would need to implement actual vector search
    // using FAISS or an alternative like Pinecone, Weaviate, etc.

    try {
        // Generate embedding for the query
        const queryEmbedding = await createEmbedding(query);

        // Search the vector store
        const results = await faiss.search(VECTORSTORE_PATH, queryEmbedding, 4);

        return results.map(result => ({
            page_content: result.content,
            metadata: {
                source: result.source
            }
        }));
    } catch (error) {
        console.error('Error searching vector store:', error);
        return [];
    }
}

// Email functions
async function sendEscalationEmail(ticketId, summary, ticketJson) {
    const subject = `Ticket Escalation: ${ticketId}`;
    const body = `
📬 Escalation Notice - Ticket ID: ${ticketId}

A user has requested human assistance. Here is a summary of the conversation so far:

${summary}

The complete chat log is attached.
    `;

    const message = {
        from: 'shaikfa66@gmail.com',
        to: 'faisal.shaikh@wingerit.in',
        subject: subject,
        text: body,
        attachments: [
            {
                filename: `${ticketId}.json`,
                content: ticketJson,
                contentType: 'application/json'
            }
        ]
    };

    try {
        await transporter.sendMail(message);
        console.log(`Escalation email sent for ticket ${ticketId}`);
    } catch (error) {
        console.error('Error sending email:', error);
    }
}

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});