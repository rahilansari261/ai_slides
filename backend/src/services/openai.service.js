import OpenAI from 'openai';
import { config } from 'dotenv';

config();

// Get OpenRouter client configured with API key and base URL
function getOpenRouterClient() {
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

// Check if API key is configured
if (!process.env.OPENROUTER_API_KEY) {
  console.warn('⚠️  Warning: OpenRouter API key not configured. Please set OPENROUTER_API_KEY in backend/.env');
}

const openai = getOpenRouterClient();

const TONE_PROMPTS = {
  professional: 'Use a professional, business-appropriate tone.',
  casual: 'Use a casual, friendly tone.',
  educational: 'Use an educational, informative tone suitable for learning.',
  sales_pitch: 'Use a persuasive, sales-oriented tone.',
  funny: 'Use a light-hearted, humorous tone while keeping content informative.',
  default: 'Use a balanced, engaging tone.'
};

const VERBOSITY_PROMPTS = {
  concise: 'Keep content very brief with key bullet points only.',
  standard: 'Provide a balanced amount of content with clear bullet points.',
  'text-heavy': 'Include more detailed explanations and comprehensive content.'
};

export const generatePresentationContent = async ({
  topic,
  numSlides = 8,
  language = 'English',
  tone = 'professional',
  verbosity = 'standard',
  instructions = '',
  templateSchema = {},
  slideLayouts = []
}) => {
  const tonePrompt = TONE_PROMPTS[tone] || TONE_PROMPTS.default;
  const verbosityPrompt = VERBOSITY_PROMPTS[verbosity] || VERBOSITY_PROMPTS.standard;

  // Build schema-aware prompt if template schema is provided
  let schemaInstructions = '';
  if (templateSchema && Object.keys(templateSchema).length > 0) {
    schemaInstructions = `\n\nTEMPLATE SCHEMA REQUIREMENTS:
${JSON.stringify(templateSchema, null, 2)}

Follow this schema strictly when generating content.`;
  }

  // Add slide layout information if available
  let layoutInstructions = '';
  if (slideLayouts && slideLayouts.length > 0) {
    layoutInstructions = `\n\nAVAILABLE SLIDE LAYOUTS:
${JSON.stringify(slideLayouts.map(l => ({ type: l.type, schema: l.schema })), null, 2)}

Use these layouts appropriately throughout the presentation.`;
  }

  const systemPrompt = `You are an expert presentation designer. Create engaging, visually-oriented presentation content.
${tonePrompt}
${verbosityPrompt}

Generate content in ${language}.${schemaInstructions}${layoutInstructions}

IMPORTANT: Return a valid JSON object with the following structure:
{
  "title": "Presentation Title",
  "slides": [
    {
      "id": "slide-1",
      "type": "title",
      "title": "Main Title",
      "subtitle": "Subtitle or tagline",
      "speakerNotes": "Notes for the presenter"
    },
    {
      "id": "slide-2", 
      "type": "content",
      "title": "Slide Title",
      "bullets": ["Point 1", "Point 2", "Point 3"],
      "speakerNotes": "Notes for the presenter"
    },
    {
      "id": "slide-3",
      "type": "two-column",
      "title": "Comparison Title",
      "leftColumn": {
        "heading": "Left Heading",
        "bullets": ["Point 1", "Point 2"]
      },
      "rightColumn": {
        "heading": "Right Heading", 
        "bullets": ["Point 1", "Point 2"]
      },
      "speakerNotes": "Notes for the presenter"
    },
    {
      "id": "slide-4",
      "type": "quote",
      "quote": "An inspiring quote",
      "attribution": "Author Name",
      "speakerNotes": "Notes for the presenter"
    },
    {
      "id": "slide-5",
      "type": "stats",
      "title": "Key Statistics",
      "stats": [
        { "value": "85%", "label": "Metric 1" },
        { "value": "2.5M", "label": "Metric 2" }
      ],
      "speakerNotes": "Notes for the presenter"
    }
  ]
}

Slide types to use:
- "title": For the opening slide
- "content": For standard bullet point slides
- "two-column": For comparisons or side-by-side information
- "quote": For impactful quotes
- "stats": For showcasing key numbers/metrics
- "section": For section dividers with just a title
- "conclusion": For the closing slide with summary/call-to-action

Create exactly ${numSlides} slides with varied types for visual interest.`;

  const userPrompt = `Create a presentation about: "${topic}"
${instructions ? `\nAdditional instructions: ${instructions}` : ''}

Generate ${numSlides} slides with engaging, well-structured content. Include a title slide and a conclusion slide.`;

  // Check if API key is valid
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error('OpenRouter API key not configured. Please add your API key to backend/.env file');
  }

  // Try different models in order of preference (OpenRouter model names)
  const models = ['openai/gpt-4o', 'openai/gpt-4-turbo', 'openai/gpt-4', 'openai/gpt-3.5-turbo'];
  let lastError = null;

  for (const model of models) {
    try {
      console.log(`Attempting to generate presentation with model: ${model}`);
      
      const response = await openai.chat.completions.create({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 4000,
        response_format: { type: 'json_object' }
      });

      const messageContent = response.choices[0]?.message?.content;
      
      if (!messageContent) {
        throw new Error('Empty response from OpenRouter');
      }

      let content;
      try {
        content = JSON.parse(messageContent);
      } catch (parseError) {
        console.error('Failed to parse JSON response:', messageContent.substring(0, 200));
        throw new Error('Invalid JSON response from AI');
      }
      
      // Ensure slides array exists and has proper structure
      if (!content.slides || !Array.isArray(content.slides)) {
        throw new Error('Invalid response format: missing slides array');
      }

      // Add IDs if missing
      content.slides = content.slides.map((slide, index) => ({
        ...slide,
        id: slide.id || `slide-${index + 1}`
      }));

      console.log(`Successfully generated presentation with ${content.slides.length} slides using ${model}`);
      console.log(content);
      return content;
    } catch (error) {
      console.error(`Error with model ${model}:`, error.message);
      lastError = error;
      
      // If it's a model access error, try next model
      if (error.code === 'model_not_found' || 
          error.message?.includes('model') ||
          error.status === 404) {
        continue;
      }
      
      // For other errors (like invalid API key), don't retry with different models
      if (error.status === 401 || error.code === 'invalid_api_key') {
        throw new Error('Invalid OpenRouter API key. Please check your API key in backend/.env');
      }
      
      // Rate limit - don't retry immediately
      if (error.status === 429) {
        throw new Error('OpenRouter rate limit exceeded. Please try again in a moment.');
      }
      
      // For other errors, throw immediately
      throw error;
    }
  }

  // If all models failed
  throw new Error(`Failed to generate presentation: ${lastError?.message || 'Unknown error'}`);
};

export const regenerateSlide = async (slide, instructions, language = 'English') => {
  // Check if API key is valid
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error('OpenRouter API key not configured. Please add your API key to backend/.env file');
  }

  const systemPrompt = `You are an expert presentation designer. Improve or regenerate the given slide content based on the instructions.
Generate content in ${language}.
Return only a valid JSON object with the same structure as the input slide.`;

  const userPrompt = `Current slide:
${JSON.stringify(slide, null, 2)}

Instructions: ${instructions}

Return the improved slide as a JSON object.`;

  const models = ['openai/gpt-4o', 'openai/gpt-4-turbo', 'openai/gpt-4', 'openai/gpt-3.5-turbo'];
  
  for (const model of models) {
    try {
      const response = await openai.chat.completions.create({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 1000,
        response_format: { type: 'json_object' }
      });

      const messageContent = response.choices[0]?.message?.content;
      if (!messageContent) {
        throw new Error('Empty response from OpenRouter');
      }

      return JSON.parse(messageContent);
    } catch (error) {
      console.error(`Error with model ${model}:`, error.message);
      
      if (error.code === 'model_not_found' || error.status === 404) {
        continue;
      }
      
      if (error.status === 401) {
        throw new Error('Invalid OpenRouter API key. Please check your API key in backend/.env');
      }
      
      throw new Error(`Failed to regenerate slide: ${error.message}`);
    }
  }
  
  throw new Error('Failed to regenerate slide with all available models');
};

