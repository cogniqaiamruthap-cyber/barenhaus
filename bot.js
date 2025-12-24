// chatbot-script.js

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
    WORKERS_URL: 'https://long-wave-c9b2.cogniqaiamruthap.workers.dev',
    GEMINI_API_KEY: 'YOUR_GEMINI_API_KEY_HERE', // Replace with your actual API key
    GEMINI_API_URL: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent',

    BUSINESS_INFO: {
        name: 'Bären Haus',
        website: 'barenhaus.com',
        location: '901 Front St, Leavenworth, WA 98826, United States',
        phone: '+1 509-548-4535',
        email: 'jet2night@gmail.com',
        facebook: 'https://www.facebook.com/baren.haus1/',

        hours: {
            'Friday': '11:00 AM - Late',
            'Saturday': '11:00 AM - Late',
            'Sunday': '11:00 AM - Late',
            'Monday-Thursday': 'Please call for weekday hours'
        },

        services: [
            'Traditional German dishes (Schnitzel, Bratwurst, Sauerbraten)',
            'Authentic German beers',
            'Live music on weekends',
            'Cozy brick-walled atmosphere',
            'Dine-in service',
            'Takeaway available'
        ],

        specialties: [
            'Wiener Schnitzel',
            'Bratwurst platters',
            'German potato salad',
            'Imported German beers',
            'Traditional pretzels',
            'Authentic Bavarian cuisine'
        ],

        faqs: [
            {
                question: 'Do you take reservations?',
                answer: 'We primarily operate on a walk-in basis due to high volume. For large groups or special events, please call us at +1 509-548-4535 to discuss arrangements.'
            },
            {
                question: 'Is there live music?',
                answer: 'Yes! We feature live music on weekends. The atmosphere is lively and perfect for enjoying traditional German food and beer!'
            },
            {
                question: 'What are your most popular dishes?',
                answer: 'Our most popular dishes include Wiener Schnitzel, various Bratwurst platters, and our traditional German beers. All dishes are prepared authentically!'
            },
            {
                question: 'Do you offer catering?',
                answer: 'For catering inquiries and large group arrangements, please contact us directly at +1 509-548-4535 or email jet2night@gmail.com.'
            },
            {
                question: 'Is takeaway available?',
                answer: 'Yes! We offer takeaway service for all our menu items. Call ahead to place your order.'
            }
        ]
    }
};

// ============================================
// SYSTEM PROMPT FOR GEMINI
// ============================================

const SYSTEM_CONTEXT = `You are a friendly customer service assistant for ${CONFIG.BUSINESS_INFO.name}, a traditional German restaurant in Leavenworth, Washington.

BUSINESS DETAILS:
- Name: ${CONFIG.BUSINESS_INFO.name}
- Location: ${CONFIG.BUSINESS_INFO.location}
- Phone: ${CONFIG.BUSINESS_INFO.phone}
- Email: ${CONFIG.BUSINESS_INFO.email}
- Website: ${CONFIG.BUSINESS_INFO.website}
- Facebook: ${CONFIG.BUSINESS_INFO.facebook}

HOURS:
${Object.entries(CONFIG.BUSINESS_INFO.hours).map(([day, hours]) => `- ${day}: ${hours}`).join('\n')}

SERVICES & SPECIALTIES:
${CONFIG.BUSINESS_INFO.services.join('\n')}

KEY INFORMATION:
1. We primarily take walk-ins (1,998+ reviews, high traffic tourist spot)
2. For large groups or events, customers should call ${CONFIG.BUSINESS_INFO.phone}
3. Live music on weekends
4. Traditional German cuisine in a cozy, brick-walled atmosphere
5. Dine-in and takeaway available

YOUR ROLE:
- Be warm, friendly, and helpful
- Use occasional German greetings (Willkommen, Prost, Guten Tag)
- Provide accurate information about menu, hours, and services
- Direct booking/reservation questions to phone: ${CONFIG.BUSINESS_INFO.phone}
- For catering inquiries, provide email: ${CONFIG.BUSINESS_INFO.email}
- Keep responses concise (2-4 sentences typically)
- Be enthusiastic about German food and culture

RESPONSE STYLE:
- Friendly and conversational
- DO NOT use emojis in your responses. Keep the tone professional but friendly.
- Always offer to help with additional questions
- If you don't know something specific, direct them to call or visit`;

// ============================================
// STATE MANAGEMENT
// ============================================

let conversationHistory = [];
let isTyping = false;

// ============================================
// DOM ELEMENTS
// ============================================

const chatbotToggle = document.getElementById('chatbot-toggle');
const chatbotWindow = document.getElementById('chatbot-window');
const chatbotClose = document.getElementById('chatbot-close');
const chatbotMessages = document.getElementById('chatbot-messages');
const chatbotInput = document.getElementById('chatbot-input');
const chatbotSend = document.getElementById('chatbot-send');
const chatbotClear = document.getElementById('chatbot-clear');
const quickReplies = document.querySelectorAll('.quick-reply-btn');

// ============================================
// EVENT LISTENERS
// ============================================

chatbotToggle.addEventListener('click', openChatbot);
chatbotClose.addEventListener('click', closeChatbot);
chatbotClear.addEventListener('click', clearChat);
chatbotSend.addEventListener('click', sendMessage);
chatbotInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

quickReplies.forEach(btn => {
    btn.addEventListener('click', () => {
        const message = btn.dataset.message;
        chatbotInput.value = message;
        sendMessage();
    });
});

// ============================================
// CHATBOT FUNCTIONS
// ============================================

function openChatbot() {
    chatbotWindow.classList.add('active');
    chatbotToggle.style.display = 'none';
    chatbotInput.focus();
}

function closeChatbot() {
    chatbotWindow.classList.remove('active');
    chatbotToggle.style.display = 'flex';
}

function clearChat() {
    if (confirm('Are you sure you want to clear the chat history?')) {
        // Reset conversation history
        conversationHistory = [];

        // Remove all messages except the first welcome message
        const messages = chatbotMessages.querySelectorAll('.message');
        for (let i = 1; i < messages.length; i++) {
            messages[i].remove();
        }
    }
}

function addMessage(content, isUser = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user-message' : 'bot-message'}`;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.innerHTML = content;

    messageDiv.appendChild(contentDiv);
    chatbotMessages.appendChild(messageDiv);

    chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
}

function showTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message bot-message';
    typingDiv.id = 'typing-indicator';

    const indicatorDiv = document.createElement('div');
    indicatorDiv.className = 'typing-indicator';
    indicatorDiv.innerHTML = `
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
    `;

    typingDiv.appendChild(indicatorDiv);
    chatbotMessages.appendChild(typingDiv);
    chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
}

function hideTypingIndicator() {
    const typingIndicator = document.getElementById('typing-indicator');
    if (typingIndicator) {
        typingIndicator.remove();
    }
}

async function sendMessage() {
    const message = chatbotInput.value.trim();

    if (!message || isTyping) return;

    // Add user message
    addMessage(message, true);
    chatbotInput.value = '';

    // Check if API key is set OR if Workers URL is configured
    // We only need a local API key if we aren't using the worker proxy
    if (CONFIG.GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE' && !CONFIG.WORKERS_URL) {
        setTimeout(() => {
            addMessage('<p>⚠️ API key not configured. Please add your Gemini API key in the chatbot-script.js file.</p>');
        }, 500);
        return;
    }

    // Show typing indicator
    isTyping = true;
    showTypingIndicator();
    chatbotSend.disabled = true;

    try {
        // Check for quick local responses first
        const localResponse = getLocalResponse(message);

        if (localResponse) {
            hideTypingIndicator();
            addMessage(localResponse);
            conversationHistory.push({
                role: 'user',
                content: message
            });
            conversationHistory.push({
                role: 'assistant',
                content: localResponse
            });
        } else {
            // Call Gemini API through Workers proxy
            const response = await callGeminiAPI(message);
            hideTypingIndicator();
            addMessage(response);

            conversationHistory.push({
                role: 'user',
                content: message
            });
            conversationHistory.push({
                role: 'assistant',
                content: response
            });
        }
    } catch (error) {
        hideTypingIndicator();
        addMessage('<p>I apologize, but I\'m having trouble connecting right now. Please call us at <strong>+1 509-548-4535</strong> for immediate assistance.</p>');
        console.error('Error:', error);
    } finally {
        isTyping = false;
        chatbotSend.disabled = false;
        chatbotInput.focus();
    }
}

function getLocalResponse(message) {
    const lowerMessage = message.toLowerCase();

    // Hours
    if (lowerMessage.includes('hour') || lowerMessage.includes('open') || lowerMessage.includes('close')) {
        return `<p><strong>Our Hours:</strong></p>
                <ul>
                    ${Object.entries(CONFIG.BUSINESS_INFO.hours).map(([day, hours]) =>
            `<li>${day}: ${hours}</li>`
        ).join('')}
                </ul>
                <p>We open at 11 AM on Fridays. See you soon!</p>`;
    }

    // Contact
    if (lowerMessage.includes('contact') || lowerMessage.includes('phone') || lowerMessage.includes('email') || lowerMessage.includes('call')) {
        return `<p><strong>Contact Us:</strong></p>
                <p>Phone: <a href="tel:${CONFIG.BUSINESS_INFO.phone}">${CONFIG.BUSINESS_INFO.phone}</a></p>
                <p>Email: <a href="mailto:${CONFIG.BUSINESS_INFO.email}">${CONFIG.BUSINESS_INFO.email}</a></p>
                <p>Location: ${CONFIG.BUSINESS_INFO.location}</p>
                <p>Facebook: <a href="${CONFIG.BUSINESS_INFO.facebook}" target="_blank">Visit our page</a></p>`;
    }

    // Location
    if (lowerMessage.includes('location') || lowerMessage.includes('address') || lowerMessage.includes('where')) {
        return `<p><strong>Find Us:</strong></p>
                <p>${CONFIG.BUSINESS_INFO.location}</p>
                <p>We're located in the heart of beautiful Leavenworth, Washington!</p>`;
    }

    return null;
}

async function callGeminiAPI(userMessage) {
    const isWorker = !!CONFIG.WORKERS_URL;
    // Use Workers URL as proxy if available, otherwise fall back to direct API
    const url = CONFIG.WORKERS_URL || `${CONFIG.GEMINI_API_URL}?key=${CONFIG.GEMINI_API_KEY}`;

    let requestBody;

    if (isWorker) {
        // PER WORKER SPECS:
        // The worker expects a simple JSON object, NOT the raw Gemini API format.
        // It handles the construction of the Gemini API request internally.
        requestBody = {
            message: userMessage,
            systemPrompt: SYSTEM_CONTEXT,
            history: conversationHistory.map(msg => ({
                role: msg.role === 'user' ? 'user' : 'model',
                text: msg.content.replace(/<[^>]*>/g, '') // Strip HTML tags for cleaner history
            }))
        };
    } else {
        // FALLBACK: DIRECT GEMINI API CALL (Legacy/Local)
        const contents = [
            {
                role: 'user',
                parts: [{ text: SYSTEM_CONTEXT }]
            },
            {
                role: 'model',
                parts: [{ text: 'I understand regarding Bären Haus. How can I help?' }]
            }
        ];

        // Add conversation history
        conversationHistory.forEach(msg => {
            contents.push({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.content.replace(/<[^>]*>/g, '') }]
            });
        });

        // Add current message
        contents.push({
            role: 'user',
            parts: [{ text: userMessage }]
        });

        requestBody = {
            contents: contents,
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 500,
            }
        };
    }

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();

    if (isWorker) {
        // Worker returns a unified response format
        if (data.success && data.reply) {
            return `<p>${formatResponse(data.reply)}</p>`;
        } else if (data.error) {
            throw new Error(data.error);
        }
    } else {
        // Direct API response format
        if (data.candidates && data.candidates[0] && data.candidates[0].content) {
            const text = data.candidates[0].content.parts[0].text;
            return `<p>${formatResponse(text)}</p>`;
        }
    }

    throw new Error('Unexpected API response format');
}

function formatResponse(text) {
    // Remove assertions like "User:" or "Model:" if they appear
    text = text.replace(/^(User|Model|System):/gi, '');

    // Convert **bold** to <strong>bold</strong>
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Convert *italic* to <em>italic</em>
    text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // Convert line breaks to HTML
    text = text.replace(/\n/g, '<br>');

    return text;
}

// ============================================
// INITIALIZATION
// ============================================

console.log('Bären Haus Chatbot loaded successfully!');
console.log('Workers URL configured:', CONFIG.WORKERS_URL);
console.log('Remember to add your Gemini API key in the CONFIG object.');