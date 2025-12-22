import { llmClient, getModel } from './llmClient.service.js';
import { addAdditionalPropertiesToSchema } from '../utils/schemaUtils.js';

/**
 * Get messages for presentation structure generation
 * Matches FastAPI get_messages() exactly
 */
function getMessages(presentationLayout, nSlides, data, instructions = null) {
  return [
    {
      role: 'system',
      content: `
                You're a professional presentation designer with creative freedom to design engaging presentations.

                ${presentationLayoutToString(presentationLayout)}

                # DESIGN PHILOSOPHY
                - Create visually compelling and varied presentations
                - Match layout to content purpose and audience needs
                - Prioritize engagement over rigid formatting rules

                # Layout Selection Guidelines
                1. **Content-driven choices**: Let the slide's purpose guide layout selection
                - Opening/closing → Title layouts
                - Processes/workflows → Visual process layouts  
                - Comparisons/contrasts → Side-by-side layouts
                - Data/metrics → Chart/graph layouts
                - Concepts/ideas → Image + text layouts
                - Key insights → Emphasis layouts

                2. **Visual variety**: Aim for diverse, engaging presentation flow
                - Mix text-heavy and visual-heavy slides naturally
                - Use your judgment on when repetition serves the content
                - Balance information density across slides

                3. **Audience experience**: Consider how slides work together
                - Create natural transitions between topics
                - Use layouts that enhance comprehension
                - Design for maximum impact and retention

                **Trust your design instincts. Focus on creating the most effective presentation for the content and audience.**

                ${instructions ? '# User Instruction:' : ''}
                ${instructions || ''}

                User intruction should be taken into account while creating the presentation structure, except for number of slides.

                Select layout index for each of the ${nSlides} slides based on what will best serve the presentation's goals.
            `
    },
    {
      role: 'user',
      content: data
    }
  ];
}

/**
 * Get messages for slides markdown
 * Matches FastAPI get_messages_for_slides_markdown() exactly
 */
function getMessagesForSlidesMarkdown(presentationLayout, nSlides, data, instructions = null) {
  return [
    {
      role: 'system',
      content: `
                You're a professional presentation designer with creative freedom to design engaging presentations.

                ${instructions ? '# User Instruction:' : ''}
                ${instructions || ''}

                ${presentationLayoutToString(presentationLayout)}

                Select layout that best matches the content of the slides.

                User intruction should be taken into account while creating the presentation structure, except for number of slides.

                Select layout index for each of the ${nSlides} slides based on what will best serve the presentation's goals.
            `
    },
    {
      role: 'user',
      content: data
    }
  ];
}

/**
 * Convert presentation layout to string format
 * Matches FastAPI PresentationLayoutModel.to_string()
 */
function presentationLayoutToString(presentationLayout) {
  let message = '## Presentation Layout\n\n';
  presentationLayout.slides.forEach((slide, index) => {
    message += `### Slide Layout: ${index}: \n`;
    message += `- Name: ${slide.name || slide.json_schema?.title || slide.id} \n`;
    message += `- Description: ${slide.description || ''} \n\n`;
  });
  return message;
}

/**
 * Get dynamic JSON schema for presentation structure based on number of slides
 * Matches FastAPI get_presentation_structure_model_with_n_slides()
 */
function getPresentationStructureSchema(nSlides) {
  return {
    type: 'object',
    properties: {
      slides: {
        type: 'array',
        description: 'List of slide layout indexes',
        minItems: nSlides,
        maxItems: nSlides,
        items: {
          type: 'integer'
        }
      }
    },
    required: ['slides']
  };
}

/**
 * Generate presentation structure
 * Matches FastAPI generate_presentation_structure() exactly
 */
export async function generatePresentationStructure(
  presentationOutline,
  presentationLayout,
  instructions = null,
  usingSlidesMarkdown = false
) {
  const model = getModel();
  let responseSchema = getPresentationStructureSchema(presentationOutline.slides.length);
  
  // Add additionalProperties: false to all object types (required by OpenAI)
  responseSchema = addAdditionalPropertiesToSchema(responseSchema);

  try {
    const outlineString = presentationOutlineToString(presentationOutline);
    
    const messages = usingSlidesMarkdown
      ? getMessagesForSlidesMarkdown(
          presentationLayout,
          presentationOutline.slides.length,
          outlineString,
          instructions
        )
      : getMessages(
          presentationLayout,
          presentationOutline.slides.length,
          outlineString,
          instructions
        );

    const response = await llmClient.generateStructured(
      model,
      messages,
      responseSchema,
      {
        strict: true,
        maxTokens: 4000
      }
    );

    return {
      slides: response.slides
    };
  } catch (error) {
    console.error('Error generating presentation structure:', error);
    throw new Error(`Failed to generate presentation structure: ${error.message}`);
  }
}

/**
 * Convert presentation outline to string format
 * Matches FastAPI PresentationOutlineModel.to_string()
 */
function presentationOutlineToString(presentationOutline) {
  let message = '';
  presentationOutline.slides.forEach((slide, index) => {
    message += `## Slide ${index + 1}:\n`;
    message += `  - Content: ${slide.content} \n`;
  });
  return message;
}

