const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

// Configuration
const config = {
    PORT: process.env.PORT || 8002,
    TICKET_DIR: path.join(__dirname, 'tickets'),

    // Groq API Configuration
    GROQ_API_KEY: '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',
    GROQ_API_URL: 'https://api.groq.com/openai/v1/chat/completions',
    GROQ_MODEL: 'llama-3.1-8b-instant'
};

// Ensure ticket directory exists
const ensureTicketDir = async () => {
    try {
        await fs.mkdir(config.TICKET_DIR, { recursive: true });
        console.log('Ticket directory ensured');
    } catch (error) {
        console.error('Error creating ticket directory:', error);
    }
};

// Initialize Express App
const app = express();
app.use(cors());
app.use(express.json());

// Generate Ticket ID
const generateTicketId = () => {
    const date = new Date();
    const timestamp = date.toISOString().replace(/[:.]/g, '-');
    return `WI-${timestamp}`;
};

// Ticket File Path
const ticketPath = (ticketId) => {
    return path.join(config.TICKET_DIR, `${ticketId}.json`);
};

// Read Ticket File
const readTicketFile = async (ticketId) => {
    const filePath = ticketPath(ticketId);
    try {
        const content = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(content);
    } catch (error) {
        console.error('Error reading ticket file:', error);
        return [];
    }
};

// Write Ticket File
const writeTicketFile = async (ticketId, messages) => {
    const filePath = ticketPath(ticketId);
    await fs.writeFile(filePath, JSON.stringify(messages, null, 2));
};

// AI Response Generation
const generateAIResponse = async (messages) => {
    try {
        const response = await axios.post(
            config.GROQ_API_URL,
            {
                model: config.GROQ_MODEL,
                messages: [
                    {
                        role: "system",
                        content: "You are a helpful customer support assistant, developed by Winger IT Solutions."
                    },
                    ...messages
                ],
                temperature: 0.7
            },
            {
                headers: {
                    'Authorization': `Bearer ${config.GROQ_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        return response.data.choices[0].message.content;
    } catch (error) {
        console.error('AI Response Error:', error.response?.data || error.message);
        return "I'm having trouble processing your request. Please try again.";
    }
};

// Start Chat Endpoint
app.post('/start_chat', async (req, res) => {
    try {
        const { ticket_id } = req.body;
        const ticketId = ticket_id || generateTicketId();
        const ticketFilePath = ticketPath(ticketId);

        // Create initial ticket file if not exists
        try {
            await fs.access(ticketFilePath);
        } catch {
            await fs.writeFile(ticketFilePath, JSON.stringify([], null, 2));
        }

        // Read existing messages
        const messages = await readTicketFile(ticketId);

        res.json({
            ticket_id: ticketId,
            chat: messages
        });
    } catch (error) {
        console.error('Start chat error:', error);
        res.status(500).json({ error: 'Failed to start chat' });
    }
});

// Chat Endpoint
app.post('/chat', async (req, res) => {
    try {
        const { ticket_id, message } = req.body;

        // Read existing messages
        let messages = await readTicketFile(ticket_id);

        // Add user message
        messages.push({ role: 'user', content: message });

        // Check for human escalation
        if (message.toLowerCase().includes('contact human')) {
            // Simulate human escalation response
            const aiResponse = "Thank you. A Human Assistant will contact you within 24 to 48 hours.";

            messages.push({ role: 'assistant', content: aiResponse });

            // Write updated messages
            await writeTicketFile(ticket_id, messages);

            return res.json({
                response: aiResponse,
                retrieved_docs: []
            });
        }

        // Prepare messages for AI
        const aiMessages = messages.map(msg => ({
            role: msg.role,
            content: msg.content
        }));

        // Generate AI response
        const aiResponse = await generateAIResponse(aiMessages);

        // Add AI response to messages
        messages.push({ role: 'assistant', content: aiResponse });

        // Write updated messages
        await writeTicketFile(ticket_id, messages);

        res.json({
            response: aiResponse,
            retrieved_docs: [] // Placeholder for future RAG implementation
        });
    } catch (error) {
        console.error('Chat processing error:', error);
        res.status(500).json({ error: 'Failed to process chat' });
    }
});

// Health Check Endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        ticket_dir: config.TICKET_DIR
    });
});

// Startup Function
const startServer = async () => {
    try {
        // Ensure ticket directory exists
        await ensureTicketDir();

        // Start server
        app.listen(config.PORT, () => {
            console.log(`Server running on port ${config.PORT}`);
            console.log(`Ticket directory: ${config.TICKET_DIR}`);
        });
    } catch (error) {
        console.error('Server startup error:', error);
    }
};

// Execute server startup
startServer();