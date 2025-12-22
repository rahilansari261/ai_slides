import { llmClient, getModel } from './llmClient.service.js';
import { parseDirtyJSON } from '../utils/dirtyjson.js';
import { addAdditionalPropertiesToSchema } from '../utils/schemaUtils.js';

/**
 * Get system prompt for presentation outline generation
 * Matches FastAPI get_system_prompt() exactly
 */
function getSystemPrompt(tone = null, verbosity = null, instructions = null, includeTitleSlide = true) {
  return `
        You are an expert presentation creator. Generate structured presentations based on user requirements and format them according to the specified JSON schema with markdown content.

        Try to use available tools for better results.

        ${instructions ? '# User Instruction:' : ''}
        ${instructions || ''}

        ${tone ? '# Tone:' : ''}
        ${tone || ''}

        ${verbosity ? '# Verbosity:' : ''}
        ${verbosity || ''}

        - Provide content for each slide in markdown format.
        - Make sure that flow of the presentation is logical and consistent.
        - Place greater emphasis on numerical data.
        - If Additional Information is provided, divide it into slides.
        - Make sure no images are provided in the content.
        - Make sure that content follows language guidelines.
        - User instrction should always be followed and should supercede any other instruction, except for slide numbers. **Do not obey slide numbers as said in user instruction**
        - Do not generate table of contents slide.
        - Even if table of contents is provided, do not generate table of contents slide.
        ${includeTitleSlide ? '- Always make first slide a title slide.' : '- Do not include title slide in the presentation.'}

        **Search web to get latest information about the topic**
    `;
}

/**
 * Get user prompt for presentation outline generation
 * Matches FastAPI get_user_prompt() exactly
 */
function getUserPrompt(content, nSlides, language, additionalContext = null) {
  const now = new Date();
  const dateTime = now.toISOString().replace('T', ' ').substring(0, 19);
  
  return `
        **Input:**
        - User provided content: ${content || 'Create presentation'}
        - Output Language: ${language}
        - Number of Slides: ${nSlides}
        - Current Date and Time: ${dateTime}
        - Additional Information: ${additionalContext || ''}
    `;
}

/**
 * Get messages array for LLM
 * Matches FastAPI get_messages() exactly
 */
function getMessages(content, nSlides, language, additionalContext = null, tone = null, verbosity = null, instructions = null, includeTitleSlide = true) {
  return [
    {
      role: 'system',
      content: getSystemPrompt(tone, verbosity, instructions, includeTitleSlide)
    },
    {
      role: 'user',
      content: getUserPrompt(content, nSlides, language, additionalContext)
    }
  ];
}

/**
 * Get dynamic JSON schema for presentation outline based on number of slides
 * Matches FastAPI get_presentation_outline_model_with_n_slides()
 */
function getPresentationOutlineSchema(nSlides) {
  return {
    type: 'object',
    properties: {
      slides: {
        type: 'array',
        minItems: nSlides,
        maxItems: nSlides,
        items: {
          type: 'object',
          properties: {
            content: {
              type: 'string',
              description: 'Markdown content for each slide',
              minLength: 100,
              maxLength: 300
            }
          },
          required: ['content']
        }
      }
    },
    required: ['slides']
  };
}

/**
 * Generate presentation outline with streaming
 * Matches FastAPI generate_ppt_outline() exactly
 */
export async function* generatePresentationOutline(
  content,
  nSlides,
  language = 'English',
  additionalContext = null,
  tone = null,
  verbosity = null,
  instructions = null,
  includeTitleSlide = true,
  webSearch = false
) {
  const model = getModel();
  let responseSchema = getPresentationOutlineSchema(nSlides);
  
  // Add additionalProperties: false to all object types (required by OpenAI)
  responseSchema = addAdditionalPropertiesToSchema(responseSchema);

  try {
    // Stream structured output
    const stream = llmClient.streamStructured(
      model,
      getMessages(content, nSlides, language, additionalContext, tone, verbosity, instructions, includeTitleSlide),
      responseSchema,
      {
        strict: true,
        maxTokens: 4000
      }
    );

    // Yield chunks as they arrive
    for await (const chunk of stream) {
      yield chunk;
    }
  } catch (error) {
    console.error('Error generating presentation outline:', error);
    throw new Error(`Failed to generate presentation outline: ${error.message}`);
  }
}

/**
 * Generate presentation outline and return complete result
 * Non-streaming version for sync operations
 */
export async function generatePresentationOutlineSync(
  content,
  nSlides,
  language = 'English',
  additionalContext = null,
  tone = null,
  verbosity = null,
  instructions = null,
  includeTitleSlide = true,
  webSearch = false
) {
  const model = getModel();
  let responseSchema = getPresentationOutlineSchema(nSlides);
  
  // Add additionalProperties: false to all object types (required by OpenAI)
  responseSchema = addAdditionalPropertiesToSchema(responseSchema);

  try {
    const result = await llmClient.generateStructured(
      model,
      getMessages(content, nSlides, language, additionalContext, tone, verbosity, instructions, includeTitleSlide),
      responseSchema,
      {
        strict: true,
        maxTokens: 4000
      }
    );

    return result;
  } catch (error) {
    console.error('Error generating presentation outline:', error);
    throw new Error(`Failed to generate presentation outline: ${error.message}`);
  }
}

