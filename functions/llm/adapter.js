const axios = require('axios');
const admin = require('firebase-admin');
const { decrypt } = require('../utils/crypto');

/**
 * Executes a chat request to the specified LLM provider with a 5-second timeout.
 * @param {Object} params
 * @param {Array} params.messages - Array of { role: "user"|"assistant", content: string }
 * @param {string} params.systemPrompt - Server-side injected system prompt
 * @param {string} params.provider - 'anthropic' | 'openai' | 'google' | 'groq' | 'ollama'
 * @param {string} params.model - Model name
 * @param {string} params.uid - User UID (for Ollama decryption lookup if needed)
 * @returns {Promise<{ role: "assistant", content: string, providerUsed: string }>}
 */
async function chat({ messages, systemPrompt, provider, model, uid }) {
  const timeout = 5000; // 5-second timeout for the provider request

  switch (provider) {
    case 'google': {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      
      // Map standard messages array to Gemini contents structure
      const contents = messages.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }));

      const body = {
        contents,
        generationConfig: {
          temperature: 0.7
        }
      };

      if (systemPrompt) {
        body.systemInstruction = {
          parts: [{ text: systemPrompt }]
        };
      }

      const response = await axios.post(url, body, { timeout });
      
      const candidate = response.data.candidates?.[0];
      const text = candidate?.content?.parts?.[0]?.text;
      
      if (!text) {
        throw new Error('Invalid response format from Google Gemini');
      }

      return { role: 'assistant', content: text, providerUsed: 'google' };
    }

    case 'openai': {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');

      const url = 'https://api.openai.com/v1/chat/completions';
      
      const openAiMessages = [];
      if (systemPrompt) {
        openAiMessages.push({ role: 'system', content: systemPrompt });
      }
      openAiMessages.push(...messages);

      const body = {
        model,
        messages: openAiMessages,
        temperature: 0.7
      };

      const response = await axios.post(url, body, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout
      });

      const text = response.data.choices?.[0]?.message?.content;
      if (!text) {
        throw new Error('Invalid response format from OpenAI');
      }

      return { role: 'assistant', content: text, providerUsed: 'openai' };
    }

    case 'anthropic': {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured');

      const url = 'https://api.anthropic.com/v1/messages';

      // Anthropic does not allow 'system' role in messages list; it's passed as a top-level param.
      const body = {
        model,
        messages: messages.map(msg => ({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content
        })),
        max_tokens: 1024,
        temperature: 0.7
      };

      if (systemPrompt) {
        body.system = systemPrompt;
      }

      const response = await axios.post(url, body, {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        },
        timeout
      });

      const text = response.data.content?.[0]?.text;
      if (!text) {
        throw new Error('Invalid response format from Anthropic');
      }

      return { role: 'assistant', content: text, providerUsed: 'anthropic' };
    }

    case 'groq': {
      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) throw new Error('GROQ_API_KEY is not configured');

      const url = 'https://api.groq.com/openai/v1/chat/completions';

      const groqMessages = [];
      if (systemPrompt) {
        groqMessages.push({ role: 'system', content: systemPrompt });
      }
      groqMessages.push(...messages);

      const body = {
        model,
        messages: groqMessages,
        temperature: 0.7
      };

      const response = await axios.post(url, body, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout
      });

      const text = response.data.choices?.[0]?.message?.content;
      if (!text) {
        throw new Error('Invalid response format from Groq');
      }

      return { role: 'assistant', content: text, providerUsed: 'groq' };
    }

    case 'ollama': {
      // Lookup user profile in Firestore to get base URL
      const userSnap = await admin.firestore().collection('users').doc(uid).get();
      if (!userSnap.exists) {
        throw new Error('User profile not found');
      }

      const profile = userSnap.data()?.profile;
      const encryptedUrl = profile?.ollamaBaseUrl;
      if (!encryptedUrl) {
        throw new Error('Local Ollama base URL is not configured in settings');
      }

      let decryptedUrl;
      try {
        decryptedUrl = decrypt(encryptedUrl);
      } catch (err) {
        throw new Error('Failed to decrypt local Ollama URL: ' + err.message);
      }

      // Ollama expects messages in OpenAI format
      const ollamaMessages = [];
      if (systemPrompt) {
        ollamaMessages.push({ role: 'system', content: systemPrompt });
      }
      ollamaMessages.push(...messages);

      const body = {
        model: model || 'llama3',
        messages: ollamaMessages,
        stream: false
      };

      const response = await axios.post(`${decryptedUrl}/api/chat`, body, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout
      });

      const text = response.data.message?.content;
      if (!text) {
        throw new Error('Invalid response format from local Ollama');
      }

      return { role: 'assistant', content: text, providerUsed: 'ollama' };
    }

    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

module.exports = { chat };
