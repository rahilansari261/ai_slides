import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from 'dotenv';

config();

// LLM Provider Enum
export const LLMProvider = {
  OLLAMA: 'ollama',
  OPENAI: 'openai',
  GOOGLE: 'google',
  ANTHROPIC: 'anthropic',
  CUSTOM: 'custom'
};

// Default models (OpenRouter format)
const DEFAULT_OPENAI_MODEL = 'openai/gpt-4o';
const DEFAULT_GOOGLE_MODEL = 'gemini-1.5-pro';
const DEFAULT_ANTHROPIC_MODEL = 'claude-3-5-sonnet-20241022';

/**
 * Get LLM provider from environment
 */
function getLLMProvider() {
  const provider = process.env.LLM || 'openai';
  const validProviders = Object.values(LLMProvider);
  if (!validProviders.includes(provider)) {
    throw new Error(`Invalid LLM provider: ${provider}. Must be one of: ${validProviders.join(', ')}`);
  }
  return provider;
}

/**
 * Get model name based on provider
 */
function getModel() {
  const provider = getLLMProvider();
  switch (provider) {
    case LLMProvider.OPENAI:
      return process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL;
    case LLMProvider.GOOGLE:
      return process.env.GOOGLE_MODEL || DEFAULT_GOOGLE_MODEL;
    case LLMProvider.ANTHROPIC:
      return process.env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL;
    case LLMProvider.OLLAMA:
      return process.env.OLLAMA_MODEL || 'llama2';
    case LLMProvider.CUSTOM:
      return process.env.CUSTOM_MODEL || 'openai/gpt-4o';
    default:
      return DEFAULT_OPENAI_MODEL;
  }
}

/**
 * Parse boolean from environment variable
 */
function parseBoolOrNone(value) {
  if (!value) return null;
  const lower = value.toLowerCase();
  if (lower === 'true' || lower === '1' || lower === 'yes') return true;
  if (lower === 'false' || lower === '0' || lower === 'no') return false;
  return null;
}

/**
 * Get OpenAI client (via OpenRouter)
 */
function getOpenAIClient() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY environment variable is not set');
  }
  // OpenRouter uses OpenAI-compatible API
  return new OpenAI({
    apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
      'HTTP-Referer': process.env.OPENROUTER_HTTP_REFERER || 'https://github.com/your-repo',
      'X-Title': process.env.OPENROUTER_APP_NAME || 'AI Slides Backend',
    },
  });
}

/**
 * Get Anthropic client
 */
function getAnthropicClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('Anthropic API Key is not set');
  }
  return new Anthropic({ apiKey });
}

/**
 * Get Google client
 */
function getGoogleClient() {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('Google API Key is not set');
  }
  return new GoogleGenerativeAI(apiKey);
}

/**
 * Get Ollama client (uses OpenAI-compatible API)
 */
function getOllamaClient() {
  const baseURL = process.env.OLLAMA_URL || 'http://localhost:11434/v1';
  return new OpenAI({
    baseURL,
    apiKey: 'ollama'
  });
}

/**
 * Get Custom LLM client
 */
function getCustomClient() {
  const baseURL = process.env.CUSTOM_LLM_URL;
  if (!baseURL) {
    throw new Error('Custom LLM URL is not set');
  }
  const apiKey = process.env.CUSTOM_LLM_API_KEY || 'null';
  return new OpenAI({
    baseURL,
    apiKey
  });
}

/**
 * Get client based on provider
 */
function getClient() {
  const provider = getLLMProvider();
  switch (provider) {
    case LLMProvider.OPENAI:
      return getOpenAIClient();
    case LLMProvider.GOOGLE:
      return getGoogleClient();
    case LLMProvider.ANTHROPIC:
      return getAnthropicClient();
    case LLMProvider.OLLAMA:
      return getOllamaClient();
    case LLMProvider.CUSTOM:
      return getCustomClient();
    default:
      throw new Error(`Invalid LLM provider: ${provider}`);
  }
}

/**
 * Extract system prompt from messages
 */
function getSystemPrompt(messages) {
  const systemMessage = messages.find(msg => msg.role === 'system');
  return systemMessage ? systemMessage.content : '';
}

/**
 * Filter out system messages for Anthropic
 */
function getAnthropicMessages(messages) {
  return messages.filter(msg => msg.role !== 'system');
}

/**
 * LLM Client Service - Matches FastAPI LLMClient
 */
class LLMClient {
  constructor() {
    this.llmProvider = getLLMProvider();
    this._client = getClient();
  }

  /**
   * Generate unstructured content
   */
  async generate(model, messages, options = {}) {
    const {
      maxTokens = null,
      tools = null,
      temperature = 0.7
    } = options;

    const provider = this.llmProvider;

    try {
      switch (provider) {
        case LLMProvider.OPENAI:
        case LLMProvider.OLLAMA:
        case LLMProvider.CUSTOM:
          return await this._generateOpenAI(model, messages, { maxTokens, tools, temperature });
        case LLMProvider.GOOGLE:
          return await this._generateGoogle(model, messages, { maxTokens, tools, temperature });
        case LLMProvider.ANTHROPIC:
          return await this._generateAnthropic(model, messages, { maxTokens, tools, temperature });
        default:
          throw new Error(`Unsupported provider: ${provider}`);
      }
    } catch (error) {
      console.error(`LLM generation error (${provider}):`, error);
      throw new Error(`LLM did not return any content: ${error.message}`);
    }
  }

  /**
   * Generate structured content (JSON schema)
   */
  async generateStructured(model, messages, responseFormat, options = {}) {
    const {
      strict = false,
      maxTokens = null,
      tools = null,
      temperature = 0.7
    } = options;

    const provider = this.llmProvider;

    try {
      switch (provider) {
        case LLMProvider.OPENAI:
        case LLMProvider.OLLAMA:
        case LLMProvider.CUSTOM:
          return await this._generateOpenAIStructured(model, messages, responseFormat, {
            strict,
            maxTokens,
            tools,
            temperature
          });
        case LLMProvider.GOOGLE:
          return await this._generateGoogleStructured(model, messages, responseFormat, {
            maxTokens,
            tools,
            temperature
          });
        case LLMProvider.ANTHROPIC:
          return await this._generateAnthropicStructured(model, messages, responseFormat, {
            maxTokens,
            tools,
            temperature
          });
        default:
          throw new Error(`Unsupported provider: ${provider}`);
      }
    } catch (error) {
      console.error(`LLM structured generation error (${provider}):`, error);
      throw new Error(`LLM did not return any content: ${error.message}`);
    }
  }

  /**
   * OpenAI unstructured generation
   */
  async _generateOpenAI(model, messages, options = {}) {
    const { maxTokens, tools, temperature } = options;
    const client = this._client;

    const response = await client.chat.completions.create({
      model,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      max_tokens: maxTokens,
      tools: tools,
      temperature
    });

    if (!response.choices || response.choices.length === 0) {
      return null;
    }

    // Handle tool calls if present
    const toolCalls = response.choices[0].message.tool_calls;
    if (toolCalls && toolCalls.length > 0) {
      // For now, return the content. Tool call handling can be added later
      console.warn('Tool calls detected but not fully handled yet');
    }

    return response.choices[0].message.content;
  }

  /**
   * OpenAI structured generation
   */
  async _generateOpenAIStructured(model, messages, responseFormat, options = {}) {
    const { strict, maxTokens, tools, temperature } = options;
    const client = this._client;

    const response = await client.chat.completions.create({
      model,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'ResponseSchema',
          strict,
          schema: responseFormat
        }
      },
      max_tokens: maxTokens,
      tools: tools,
      temperature
    });

    if (!response.choices || response.choices.length === 0) {
      return null;
    }

    const content = response.choices[0].message.content;
    if (!content) {
      return null;
    }

    try {
      return JSON.parse(content);
    } catch (error) {
      console.error('Failed to parse structured response:', error);
      return null;
    }
  }

  /**
   * Google unstructured generation
   */
  async _generateGoogle(model, messages, options = {}) {
    const { maxTokens, tools, temperature } = options;
    const client = this._client;

    const systemInstruction = getSystemPrompt(messages);
    const userMessages = messages.filter(msg => msg.role !== 'system');

    const modelInstance = client.getGenerativeModel({
      model,
      systemInstruction: systemInstruction || undefined
    });

    const prompt = userMessages.map(msg => msg.content).join('\n\n');

    const result = await modelInstance.generateContent({
      contents: prompt,
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature
      }
    });

    const response = await result.response;
    return response.text();
  }

  /**
   * Google structured generation
   */
  async _generateGoogleStructured(model, messages, responseFormat, options = {}) {
    const { maxTokens, tools, temperature } = options;
    const client = this._client;

    const systemInstruction = getSystemPrompt(messages);
    const userMessages = messages.filter(msg => msg.role !== 'system');

    const modelInstance = client.getGenerativeModel({
      model,
      systemInstruction: systemInstruction || undefined
    });

    const prompt = userMessages.map(msg => msg.content).join('\n\n');

    const result = await modelInstance.generateContent({
      contents: prompt,
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature,
        responseMimeType: 'application/json',
        responseSchema: responseFormat
      }
    });

    const response = await result.response;
    const text = response.text();
    
    try {
      return JSON.parse(text);
    } catch (error) {
      console.error('Failed to parse structured response:', error);
      return null;
    }
  }

  /**
   * Anthropic unstructured generation
   */
  async _generateAnthropic(model, messages, options = {}) {
    const { maxTokens, tools, temperature } = options;
    const client = this._client;

    const system = getSystemPrompt(messages);
    const anthropicMessages = getAnthropicMessages(messages).map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    const response = await client.messages.create({
      model,
      max_tokens: maxTokens || 4000,
      system,
      messages: anthropicMessages,
      tools: tools,
      temperature
    });

    const textContent = response.content.find(c => c.type === 'text');
    return textContent ? textContent.text : null;
  }

  /**
   * Anthropic structured generation
   */
  async _generateAnthropicStructured(model, messages, responseFormat, options = {}) {
    const { maxTokens, tools, temperature } = options;
    const client = this._client;

    const system = getSystemPrompt(messages);
    const anthropicMessages = getAnthropicMessages(messages).map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    const allTools = [
      {
        name: 'ResponseSchema',
        description: 'A response to the user\'s message',
        input_schema: responseFormat
      },
      ...(tools || [])
    ];

    const response = await client.messages.create({
      model,
      max_tokens: maxTokens || 4000,
      system,
      messages: anthropicMessages,
      tools: allTools,
      temperature
    });

    const toolUse = response.content.find(c => c.type === 'tool_use' && c.name === 'ResponseSchema');
    if (toolUse) {
      return toolUse.input;
    }

    return null;
  }

  /**
   * Stream structured content (JSON schema)
   */
  async *streamStructured(model, messages, responseFormat, options = {}) {
    const {
      strict = false,
      maxTokens = null,
      tools = null,
      temperature = 0.7
    } = options;

    const provider = this.llmProvider;

    try {
      switch (provider) {
        case LLMProvider.OPENAI:
        case LLMProvider.OLLAMA:
        case LLMProvider.CUSTOM:
          yield* this._streamOpenAIStructured(model, messages, responseFormat, {
            strict,
            maxTokens,
            tools,
            temperature
          });
          break;
        case LLMProvider.GOOGLE:
          yield* this._streamGoogleStructured(model, messages, responseFormat, {
            maxTokens,
            tools,
            temperature
          });
          break;
        case LLMProvider.ANTHROPIC:
          yield* this._streamAnthropicStructured(model, messages, responseFormat, {
            maxTokens,
            tools,
            temperature
          });
          break;
        default:
          throw new Error(`Unsupported provider: ${provider}`);
      }
    } catch (error) {
      console.error(`LLM streaming error (${provider}):`, error);
      throw new Error(`LLM streaming failed: ${error.message}`);
    }
  }

  /**
   * OpenAI structured streaming
   */
  async *_streamOpenAIStructured(model, messages, responseFormat, options = {}) {
    const { strict, maxTokens, tools, temperature } = options;
    const client = this._client;

    try {
      const stream = await client.chat.completions.create({
        model,
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'ResponseSchema',
            strict,
            schema: responseFormat
          }
        },
        max_tokens: maxTokens,
        tools: tools,
        temperature,
        stream: true
      });

      let accumulatedContent = '';
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          accumulatedContent += content;
          yield content;
        }
      }
    } catch (error) {
      console.error('OpenAI structured streaming error:', error);
      throw error;
    }
  }

  /**
   * Google structured streaming
   */
  async *_streamGoogleStructured(model, messages, responseFormat, options = {}) {
    const { maxTokens, tools, temperature } = options;
    const client = this._client;

    const systemInstruction = getSystemPrompt(messages);
    const userMessages = messages.filter(msg => msg.role !== 'system');

    const modelInstance = client.getGenerativeModel({
      model,
      systemInstruction: systemInstruction || undefined
    });

    const prompt = userMessages.map(msg => msg.content).join('\n\n');

    try {
      const result = await modelInstance.generateContentStream({
        contents: prompt,
        generationConfig: {
          maxOutputTokens: maxTokens,
          temperature,
          responseMimeType: 'application/json',
          responseSchema: responseFormat
        }
      });

      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) {
          yield text;
        }
      }
    } catch (error) {
      console.error('Google structured streaming error:', error);
      throw error;
    }
  }

  /**
   * Anthropic structured streaming
   */
  async *_streamAnthropicStructured(model, messages, responseFormat, options = {}) {
    const { maxTokens, tools, temperature } = options;
    const client = this._client;

    const system = getSystemPrompt(messages);
    const anthropicMessages = getAnthropicMessages(messages).map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    const allTools = [
      {
        name: 'ResponseSchema',
        description: 'A response to the user\'s message',
        input_schema: responseFormat
      },
      ...(tools || [])
    ];

    try {
      const stream = await client.messages.stream({
        model,
        max_tokens: maxTokens || 4000,
        system,
        messages: anthropicMessages,
        tools: allTools,
        temperature
      });

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'input_json_delta') {
          yield event.delta.partial_json;
        }
      }
    } catch (error) {
      console.error('Anthropic structured streaming error:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const llmClient = new LLMClient();
export default llmClient;

// Export utility functions
export { getModel, getLLMProvider };

