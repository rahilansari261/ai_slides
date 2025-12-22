import { llmClient, getModel } from './llmClient.service.js';
import { addAdditionalPropertiesToSchema } from '../utils/schemaUtils.js';

/**
 * Get system prompt for slide content generation
 * Matches FastAPI get_system_prompt() exactly
 */
function getSystemPrompt(tone = null, verbosity = null, instructions = null) {
  return `
        Generate structured slide based on provided outline, follow mentioned steps and notes and provide structured output.

        ${instructions ? '# User Instructions:' : ''}
        ${instructions || ''}

        ${tone ? '# Tone:' : ''}
        ${tone || ''}

        ${verbosity ? '# Verbosity:' : ''}
        ${verbosity || ''}

        # Steps
        1. Analyze the outline.
        2. Generate structured slide based on the outline.
        3. Generate speaker note that is simple, clear, concise and to the point.

        # Notes
        - Slide body should not use words like "This slide", "This presentation".
        - Rephrase the slide body to make it flow naturally.
        - Only use markdown to highlight important points.
        - Make sure to follow language guidelines.
        - Speaker note should be normal text, not markdown.
        - Strictly follow the max and min character limit for every property in the slide.
        - Never ever go over the max character limit. Limit your narration to make sure you never go over the max character limit.
        - Number of items should not be more than max number of items specified in slide schema. If you have to put multiple points then merge them to obey max numebr of items.
        - Generate content as per the given tone.
        - Be very careful with number of words to generate for given field. As generating more than max characters will overflow in the design. So, analyze early and never generate more characters than allowed.
        - Do not add emoji in the content.
        - Metrics should be in abbreviated form with least possible characters. Do not add long sequence of words for metrics.
        - For verbosity:
            - If verbosity is 'concise', then generate description as 1/3 or lower of the max character limit. Don't worry if you miss content or context.
            - If verbosity is 'standard', then generate description as 2/3 of the max character limit.
            - If verbosity is 'text-heavy', then generate description as 3/4 or higher of the max character limit. Make sure it does not exceed the max character limit.

        User instructions, tone and verbosity should always be followed and should supercede any other instruction, except for max and min character limit, slide schema and number of items.

        - Provide output in json format and **don't include <parameters> tags**.

        # Image and Icon Output Format
        image: {
            __image_prompt__: string,
        }
        icon: {
            __icon_query__: string,
        }

    `;
}

/**
 * Get user prompt for slide content generation
 * Matches FastAPI get_user_prompt() exactly
 */
function getUserPrompt(outline, language) {
  const now = new Date();
  const dateTime = now.toISOString().replace('T', ' ').substring(0, 19);
  
  return `
        ## Current Date and Time
        ${dateTime}

        ## Icon Query And Image Prompt Language
        English

        ## Slide Content Language
        ${language}

        ## Slide Outline
        ${outline}
    `;
}

/**
 * Get messages array for LLM
 * Matches FastAPI get_messages() exactly
 */
function getMessages(outline, language, tone = null, verbosity = null, instructions = null) {
  return [
    {
      role: 'system',
      content: getSystemPrompt(tone, verbosity, instructions)
    },
    {
      role: 'user',
      content: getUserPrompt(outline, language)
    }
  ];
}

/**
 * Remove fields from schema
 * Matches FastAPI remove_fields_from_schema() exactly
 */
function removeFieldsFromSchema(schema, fieldsToRemove) {
  if (typeof schema !== 'object' || schema === null) {
    return schema;
  }

  // Deep copy to avoid mutating original
  const result = JSON.parse(JSON.stringify(schema));

  // Recursively find all "properties" keys and remove fields
  function removeFromProperties(obj, path = []) {
    if (typeof obj !== 'object' || obj === null) {
      return;
    }

    if (Array.isArray(obj)) {
      obj.forEach((item, index) => removeFromProperties(item, [...path, index]));
      return;
    }

    // Remove from properties
    if (obj.properties && typeof obj.properties === 'object') {
      fieldsToRemove.forEach(field => {
        if (field in obj.properties) {
          delete obj.properties[field];
        }
      });
    }

    // Remove from required arrays
    if (obj.required && Array.isArray(obj.required)) {
      obj.required = obj.required.filter(field => !fieldsToRemove.includes(field));
      if (obj.required.length === 0) {
        delete obj.required;
      }
    }

    // Recursively process nested objects
    Object.keys(obj).forEach(key => {
      if (key !== 'properties' && key !== 'required' && typeof obj[key] === 'object' && obj[key] !== null) {
        removeFromProperties(obj[key], [...path, key]);
      }
    });
  }

  removeFromProperties(result);
  return result;
}

/**
 * Add field to schema
 * Matches FastAPI add_field_in_schema() exactly
 */
function addFieldToSchema(schema, fieldDefinition, required = false) {
  // Deep copy to avoid mutating original
  const updatedSchema = JSON.parse(JSON.stringify(schema));

  // Validate fieldDefinition has exactly one entry
  const fieldEntries = Object.entries(fieldDefinition);
  if (fieldEntries.length !== 1) {
    throw new Error('fieldDefinition must have exactly one entry: {name: schema_dict}');
  }

  const [fieldName, fieldSchema] = fieldEntries[0];

  if (typeof fieldName !== 'string') {
    throw new TypeError('Field name must be a string');
  }
  if (typeof fieldSchema !== 'object' || fieldSchema === null) {
    throw new TypeError('Field schema must be a dictionary');
  }

  // Ensure properties exists
  if (!updatedSchema.properties || typeof updatedSchema.properties !== 'object') {
    updatedSchema.properties = {};
  }

  // Add the field
  updatedSchema.properties[fieldName] = fieldSchema;

  // Handle required array
  if (!Array.isArray(updatedSchema.required)) {
    updatedSchema.required = [];
  }

  if (required) {
    // Add to required if not already there
    if (!updatedSchema.required.includes(fieldName)) {
      updatedSchema.required.push(fieldName);
    }
  } else {
    // Remove from required if present
    updatedSchema.required = updatedSchema.required.filter(name => name !== fieldName);
  }

  // Clean up empty required array
  if (updatedSchema.required.length === 0) {
    delete updatedSchema.required;
  }

  return updatedSchema;
}

/**
 * Get slide content from type and outline
 * Matches FastAPI get_slide_content_from_type_and_outline() exactly
 */
export async function getSlideContentFromTypeAndOutline(
  slideLayout,
  outline,
  language,
  tone = null,
  verbosity = null,
  instructions = null
) {
  const model = getModel();

  // Validate slideLayout has json_schema
  if (!slideLayout || !slideLayout.json_schema) {
    console.error('Slide layout missing json_schema:', {
      slideLayout: slideLayout ? Object.keys(slideLayout) : 'null',
      layoutId: slideLayout?.id,
      layoutName: slideLayout?.name,
      hasJsonSchema: !!slideLayout?.json_schema
    });
    throw new Error(`Slide layout must have json_schema property. Layout ID: ${slideLayout?.id || 'unknown'}`);
  }

  // Validate json_schema structure
  if (typeof slideLayout.json_schema !== 'object' || slideLayout.json_schema === null) {
    console.error('Invalid json_schema type:', {
      layoutId: slideLayout.id,
      schemaType: typeof slideLayout.json_schema,
      schemaValue: slideLayout.json_schema
    });
    throw new Error(`Slide layout json_schema must be an object. Layout ID: ${slideLayout.id}`);
  }

  // Ensure schema has type and properties
  if (!slideLayout.json_schema.type || slideLayout.json_schema.type !== 'object') {
    console.warn('Schema missing type="object", adding it:', {
      layoutId: slideLayout.id,
      currentType: slideLayout.json_schema.type
    });
    slideLayout.json_schema.type = 'object';
  }

  if (!slideLayout.json_schema.properties || typeof slideLayout.json_schema.properties !== 'object') {
    console.error('Schema missing properties:', {
      layoutId: slideLayout.id,
      hasProperties: !!slideLayout.json_schema.properties
    });
    throw new Error(`Slide layout json_schema must have properties object. Layout ID: ${slideLayout.id}`);
  }

  // Extract outline content - handle both object with .content and string
  let outlineContent;
  if (typeof outline === 'string') {
    outlineContent = outline;
  } else if (outline && typeof outline === 'object' && outline.content) {
    outlineContent = outline.content;
  } else if (outline && typeof outline === 'object') {
    // Fallback: try to use outline as string (for backward compatibility)
    outlineContent = JSON.stringify(outline);
    console.warn('Outline is object without .content property, using JSON string');
  } else {
    throw new Error('Outline must be a string or object with .content property');
  }

  // Remove __image_url__ and __icon_url__ from schema
  let responseSchema = removeFieldsFromSchema(
    slideLayout.json_schema,
    ['__image_url__', '__icon_url__']
  );

  // Add __speaker_note__ field (required=true matches FastAPI)
  responseSchema = addFieldToSchema(
    responseSchema,
    {
      __speaker_note__: {
        type: 'string',
        minLength: 100,
        maxLength: 250,
        description: 'Speaker note for the slide'
      }
    },
    true  // required=true
  );

  // Add additionalProperties: false to all object types (required by OpenAI)
  responseSchema = addAdditionalPropertiesToSchema(responseSchema);

  // Debug logging
  if (process.env.NODE_ENV === 'development') {
    console.log('[getSlideContentFromTypeAndOutline]', {
      layoutId: slideLayout.id,
      layoutName: slideLayout.name,
      outlineLength: outlineContent?.length,
      schemaType: responseSchema?.type,
      schemaProperties: responseSchema?.properties ? Object.keys(responseSchema.properties) : [],
      hasRequired: !!responseSchema?.required
    });
  }

  try {
    const response = await llmClient.generateStructured(
      model,
      getMessages(outlineContent, language, tone, verbosity, instructions),
      responseSchema,
      {
        strict: false,
        maxTokens: 4000
      }
    );

    if (!response) {
      throw new Error('LLM returned null or empty response');
    }

    return response;
  } catch (error) {
    console.error('Error generating slide content:', {
      error: error.message,
      layoutId: slideLayout?.id,
      layoutName: slideLayout?.name,
      outlinePreview: outlineContent?.substring(0, 100)
    });
    throw new Error(`Failed to generate slide content: ${error.message}`);
  }
}

/**
 * Generate slide content in batches
 * Matches FastAPI batch processing exactly (batch size 10)
 */
export async function generateSlideContentBatch(
  slideLayouts,
  outlines,
  language,
  tone = null,
  verbosity = null,
  instructions = null
) {
  const batchSize = 10;
  const results = [];

  console.log(`Generating content for ${slideLayouts.length} slides in batches of ${batchSize}`);

  for (let start = 0; start < slideLayouts.length; start += batchSize) {
    const end = Math.min(start + batchSize, slideLayouts.length);
    
    console.log(`Generating slides from ${start} to ${end}`);

    // Generate contents for this batch concurrently
    const contentTasks = [];
    for (let i = start; i < end; i++) {
      contentTasks.push(
        getSlideContentFromTypeAndOutline(
          slideLayouts[i],
          outlines[i],
          language,
          tone,
          verbosity,
          instructions
        )
      );
    }

    // Wait for all tasks in batch to complete
    const batchContents = await Promise.all(contentTasks);
    
    // Add results
    results.push(...batchContents);
  }

  console.log(`Successfully generated content for ${results.length} slides`);
  return results;
}

