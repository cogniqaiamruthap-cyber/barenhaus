// Universal Cloudflare Worker for Multiple Business Chatbots
// Supports unlimited businesses with Gemini Models


export default {
  async fetch(request, env) {
    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    // Only allow POST requests for chat
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      // Get the API key from environment variables
      const GEMINI_API_KEY = env.GEMINI_API_KEY;
      
      if (!GEMINI_API_KEY) {
        return new Response(JSON.stringify({ 
          success: false,
          error: 'API key not configured' 
        }), {
          status: 500,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
        });
      }

      // Parse the incoming request
      const body = await request.json();
      let userMessage = body.message || body.prompt || '';
      // Support passing systemPrompt directly from client for generic usage
      const clientSystemPrompt = body.systemPrompt || body.systemInstruction;
      
      const businessId = body.business || body.businessId || 'fitness';
      const model = body.model || 'gemma-3-4b-it';


      
      // const image = body.image || null; // Support for base64 images (handled in contents construction)
      const history = body.history || [];
      
      // Extract only the actual customer message (remove system prompt if present)
      if (userMessage.includes('Customer:')) {
        const parts = userMessage.split('Customer:');
        userMessage = parts[parts.length - 1].trim();
      }
      
      if (!userMessage) {
        return new Response(JSON.stringify({ 
          success: false,
          error: 'No message provided' 
        }), {
          status: 400,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
        });
      }

      // Fallback Business configurations (Optional fallback if client doesn't send prompt)
      const businessConfigs = {
        'fitness': {
          name: 'Tavistock Fitness Centre',
          systemPrompt: `You are a helpful fitness assistant for Tavistock Fitness Centre, a premium gym in Tavistock, Devon, UK.

GYM INFORMATION:
- Name: Tavistock Fitness Centre
- Location: Tavistock, Devon, UK
- Hours: 24/7 access for members
- Phone: 01822 123456
- Email: info@tavistockfitness.co.uk

MEMBERSHIP PLANS:
1. Basic - £29.99/month: 24/7 gym access, unlimited sauna, members app, basic equipment
2. Pro - £49.99/month (MOST POPULAR): Everything in Basic + all group classes, priority booking, free monthly guest pass
3. Elite - £79.99/month: Everything in Pro + 2 PT sessions/month, nutrition consultation, VIP locker

CLASSES OFFERED:
- HIIT Training: Mon, Wed, Fri - 6:00 AM
- Yoga Flow: Tue, Thu - 7:00 AM
- Spin Class: Daily - 6:00 PM
- Strength Training: Mon, Wed, Fri - 7:00 PM
- Boxing: Tue, Thu, Sat - 5:00 PM
- Pilates: Wed, Fri - 9:00 AM

FACILITIES:
- State-of-the-art cardio machines and free weights
- Luxurious sauna (unlimited access)
- Group studio with professional instructors
- Personal training zone
- VIP lockers

If an image is provided, analyze it in context of fitness (workout form, equipment, exercise identification, meal prep, etc.).
Keep responses friendly, motivational, concise (2-3 sentences), and encouraging. Always promote fitness and healthy lifestyle.`
        },
        'default': {
          name: 'Customer Support',
          systemPrompt: `You are a helpful and friendly customer support assistant. Provide clear, concise, and helpful responses.`
        }
      };

      // Determine the final system prompt:
      // 1. Use client-provided systemPrompt if available (Generic Mode)
      // 2. Fallback to businessConfigs based on businessId (Legacy Mode)
      // 3. Fallback to default
      let finalSystemPrompt = clientSystemPrompt;
      let businessName = 'Assistant';

      if (!finalSystemPrompt) {
          const config = businessConfigs[businessId] || businessConfigs['default'];
          finalSystemPrompt = config.systemPrompt;
          businessName = config.name;
      }

      // Build conversation contents with multimodal support
      const contents = [];
      
      // Add system prompt as first message
      contents.push({
        role: "user",
        parts: [{ text: finalSystemPrompt }]
      });

      // Add conversation history if provided
      if (history && history.length > 0) {
        history.slice(-10).forEach(msg => { // Keep last 10 messages
          contents.push({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text }]
          });
        });
      }

      // Build current message parts
      const currentParts = [{ text: userMessage }];
      
      // Add current message
      contents.push({
        role: "user",
        parts: currentParts
      });

      // Construct the Google AI Studio API request
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
      
      const apiRequest = {
        contents: contents,
        generationConfig: {
          temperature: body.temperature || 0.85,
          topK: body.topK || 40,
          topP: body.topP || 0.95,
          maxOutputTokens: body.maxOutputTokens || 512,
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          }
        ]
      };

      // Call the Google AI Studio API
      const apiResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(apiRequest),
      });

      const apiData = await apiResponse.json();

      // Handle rate limiting with retry suggestion
      if (apiData?.error?.code === 429) {
        return new Response(JSON.stringify({ 
          success: false,
          error: 'Rate limit exceeded. Please try again in a moment.',
          retry: true
        }), {
          status: 429,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
        });
      }

      // Handle overload errors
      if (apiData?.error?.code === 503) {
        return new Response(JSON.stringify({ 
          success: false,
          error: 'Service temporarily overloaded. Please retry.',
          retry: true
        }), {
          status: 503,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
        });
      }

      // Check for other errors
      if (!apiResponse.ok) {
        console.error('API Error:', apiData);
        return new Response(JSON.stringify({ 
          success: false,
          error: apiData.error?.message || 'Failed to get response from AI',
          details: apiData
        }), {
          status: apiResponse.status,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
        });
      }

      // Extract the response text
      const responseText = apiData.candidates?.[0]?.content?.parts?.[0]?.text || 
                          'I apologize, but I\'m having trouble generating a response. Please contact us for assistance.';

      // Return the response in multiple formats for compatibility
      return new Response(JSON.stringify({
        success: true,
        reply: responseText,
        response: responseText,
        message: responseText,
        text: responseText,
        model: model,
        business: businessName
      }), {
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
      });

    } catch (error) {
      console.error('Worker Error:', error);
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Internal server error',
        message: error.message 
      }), {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
      });
    }
  },
};