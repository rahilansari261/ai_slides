import axios from 'axios';
import prisma from '../config/prisma.js';
import { DEFAULT_TEMPLATES } from '../constants/presentation.js';

/**
 * Extract JSON schema from React component code
 * Handles complex Zod schemas with nested objects, arrays, enums, and schema references
 */
async function extractSchemaFromReactComponent(reactCode) {
  try {
    // Try to extract layout info first
    const layoutIdMatch = reactCode.match(/const\s+layoutId\s*=\s*["']([^"']+)["']/);
    const layoutNameMatch = reactCode.match(/const\s+layoutName\s*=\s*["']([^"']+)["']/);
    const layoutDescMatch = reactCode.match(/const\s+layoutDescription\s*=\s*["']([^"']+)["']/);

    // Step 1: Extract all schema definitions (ImageIconSchema, TopBarSchema, etc.)
    const schemaDefinitions = extractAllSchemaDefinitions(reactCode);
    
    // Step 2: Find the main schema (Schema, slideSchema, SlideSchema, etc.)
    const mainSchema = findMainSchema(reactCode, schemaDefinitions);
    
    if (!mainSchema) {
      console.warn('No main Zod schema found in React component, using default schema', {
        layoutId: layoutIdMatch ? layoutIdMatch[1] : 'unknown',
        codePreview: reactCode.substring(0, 300)
      });
      
      return {
        id: layoutIdMatch ? layoutIdMatch[1] : 'unknown',
        name: layoutNameMatch ? layoutNameMatch[1] : 'Unknown Layout',
        description: layoutDescMatch ? layoutDescMatch[1] : '',
        json_schema: {
          type: 'object',
          properties: {
            title: { type: 'string', minLength: 3, maxLength: 100 },
            content: { type: 'string', minLength: 10, maxLength: 500 }
          },
          required: ['title', 'content'],
          additionalProperties: false
        }
      };
    }

    // Step 3: Parse the main schema with reference resolution
    const jsonSchema = parseZodSchemaAdvanced(mainSchema.schemaText, schemaDefinitions);

    if (!jsonSchema || !jsonSchema.properties || Object.keys(jsonSchema.properties).length === 0) {
      console.warn('Parsed schema has no properties, using default', {
        layoutId: layoutIdMatch ? layoutIdMatch[1] : 'unknown',
        parsedSchema: jsonSchema
      });
      
      return {
        id: layoutIdMatch ? layoutIdMatch[1] : 'unknown',
        name: layoutNameMatch ? layoutNameMatch[1] : 'Unknown Layout',
        description: layoutDescMatch ? layoutDescMatch[1] : '',
        json_schema: {
          type: 'object',
          properties: {
            title: { type: 'string', minLength: 3, maxLength: 100 },
            content: { type: 'string', minLength: 10, maxLength: 500 }
          },
          required: ['title', 'content'],
          additionalProperties: false
        }
      };
    }

    return {
      id: layoutIdMatch ? layoutIdMatch[1] : 'unknown',
      name: layoutNameMatch ? layoutNameMatch[1] : 'Unknown Layout',
      description: layoutDescMatch ? layoutDescMatch[1] : '',
      json_schema: jsonSchema
    };
  } catch (error) {
    console.error('Error extracting schema from React component:', error);
    console.error('React code preview:', reactCode.substring(0, 500));
    
    // Return a default schema structure
    return {
      id: 'default',
      name: 'Default Layout',
      description: 'Default layout',
      json_schema: {
        type: 'object',
        properties: {
          title: { type: 'string', minLength: 3, maxLength: 100 },
          content: { type: 'string', minLength: 10, maxLength: 500 }
        },
        required: ['title', 'content'],
        additionalProperties: false
      }
    };
  }
}

/**
 * Extract all schema definitions from React code
 * Returns a map of schemaName -> schemaText
 */
function extractAllSchemaDefinitions(reactCode) {
  const schemas = new Map();
  
  // Pattern to find: const SchemaName = z.object({...}) or const SchemaName = z.array(...) etc.
  // Match any const declaration ending with Schema
  const schemaPattern = /const\s+(\w+Schema)\s*=\s*z\./g;
  
  let match;
  while ((match = schemaPattern.exec(reactCode)) !== null) {
    const schemaName = match[1];
    const startIndex = match.index + match[0].indexOf('z.');
    
    // Extract complete Zod expression
    const schemaDef = extractCompleteZodExpression(reactCode, startIndex);
    
    if (schemaDef) {
      schemas.set(schemaName, schemaDef);
    }
  }
  
  return schemas;
}

/**
 * Find the main schema (Schema, slideSchema, SlideSchema, etc.)
 */
function findMainSchema(reactCode, schemaDefinitions) {
  // Priority order: Schema, slideSchema, SlideSchema
  const mainSchemaNames = ['Schema', 'slideSchema', 'SlideSchema'];
  
  // First, try to find by name in schemaDefinitions
  for (const schemaName of mainSchemaNames) {
    if (schemaDefinitions.has(schemaName)) {
      return { schemaText: schemaDefinitions.get(schemaName), schemaName };
    }
  }
  
  // Try to find by pattern in code
  const mainSchemaPatterns = [
    /(?:const|export\s+const)\s+Schema\s*=\s*z\./,
    /(?:const|export\s+const)\s+slideSchema\s*=\s*z\./,
    /(?:const|export\s+const)\s+SlideSchema\s*=\s*z\./,
  ];
  
  for (let i = 0; i < mainSchemaPatterns.length; i++) {
    const match = reactCode.match(mainSchemaPatterns[i]);
    if (match) {
      const startIndex = match.index + match[0].indexOf('z.');
      const schemaText = extractCompleteZodExpression(reactCode, startIndex);
      if (schemaText) {
        return { schemaText, schemaName: mainSchemaNames[i] };
      }
    }
  }
  
  // Fallback: look for any schema that's likely the main one
  // Usually the last or largest schema definition
  if (schemaDefinitions.size > 0) {
    // Try to find the largest schema (likely the main one)
    let largestSchema = null;
    let largestSize = 0;
    
    for (const [name, schema] of schemaDefinitions.entries()) {
      if (schema.length > largestSize && name.toLowerCase().includes('slide')) {
        largestSize = schema.length;
        largestSchema = { schemaText: schema, schemaName: name };
      }
    }
    
    if (largestSchema) {
      return largestSchema;
    }
    
    // Last resort: use the last schema
    const lastSchema = Array.from(schemaDefinitions.entries()).pop();
    return { schemaText: lastSchema[1], schemaName: lastSchema[0] };
  }
  
  return null;
}

/**
 * Extract complete Zod expression handling nested braces/parens
 */
function extractCompleteZodExpression(code, startIndex) {
  let depth = 0;
  let parenDepth = 0;
  let start = -1;
  let inString = false;
  let stringChar = null;
  
  // Find the start of z.
  for (let i = startIndex; i < code.length; i++) {
    if (code[i] === 'z' && code.substring(i, i + 2) === 'z.') {
      start = i;
      break;
    }
  }
  
  if (start === -1) return null;
  
  // Track depth through the expression
  for (let i = start; i < code.length; i++) {
    const char = code[i];
    const prevChar = i > 0 ? code[i - 1] : '';
    
    // Handle strings
    if ((char === '"' || char === "'") && prevChar !== '\\') {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
        stringChar = null;
      }
    }
    
    if (inString) continue;
    
    // Track parentheses
    if (char === '(') parenDepth++;
    if (char === ')') parenDepth--;
    
    // Track braces
    if (char === '{') depth++;
    if (char === '}') depth--;
    
    // End of expression: closing paren with no depth and no braces
    if (char === ')' && parenDepth === 0 && depth === 0) {
      // Check if there are more method calls (.default(), .optional(), etc.)
      let end = i + 1;
      
      // Look ahead for method chains
      while (end < code.length) {
        const nextChar = code[end];
        if (nextChar === '.' && code.substring(end, end + 8) === '.default(') {
          // Skip .default(...)
          let defaultDepth = 0;
          end++;
          while (end < code.length) {
            if (code[end] === '(') defaultDepth++;
            if (code[end] === ')') {
              defaultDepth--;
              if (defaultDepth === 0) {
                end++;
                break;
              }
            }
            end++;
          }
        } else if (nextChar === '.' && code.substring(end, end + 10) === '.optional()') {
          end += 10;
        } else if (/\s/.test(nextChar)) {
          end++;
        } else {
          break;
        }
      }
      
      return code.substring(start, end).trim();
    }
    
    // If we hit a semicolon or newline and we're at top level, might be end
    if ((char === ';' || (char === '\n' && depth === 0 && parenDepth === 0)) && i > start + 10) {
      return code.substring(start, i).trim();
    }
  }
  
  return null;
}

/**
 * Advanced Zod schema parser - handles complex nested schemas
 * Supports: nested objects, arrays, enums, schema references, .default() stripping
 */
function parseZodSchemaAdvanced(zodSchemaText, schemaDefinitions = new Map()) {
  // Strip .default() values - they shouldn't be in JSON schema
  zodSchemaText = stripDefaultValues(zodSchemaText);
  
  const schema = {
    type: 'object',
    properties: {},
    required: [],
    additionalProperties: false
  };

  // Extract the object content (between braces)
  const objectMatch = zodSchemaText.match(/z\.object\s*\(\s*({[\s\S]*})\s*\)/);
  if (!objectMatch) {
    return schema;
  }

  const objectContent = extractBalancedBraces(objectMatch[1]);
  
  // Parse properties
  const properties = parseZodProperties(objectContent, schemaDefinitions);
  
  schema.properties = properties.properties;
  schema.required = properties.required;

  // Validate and fix: ensure all arrays have items property
  validateAndFixArrayItems(schema);

  return schema;
}

/**
 * Recursively validate and fix array schemas to ensure they all have items
 * OpenAI requires all arrays to have an items property
 */
function validateAndFixArrayItems(schema) {
  if (!schema || typeof schema !== 'object') return;
  
  // If this is an array, ensure it has items
  if (schema.type === 'array') {
    if (!schema.items || !schema.items.type) {
      // Default to string items if missing
      schema.items = { type: 'string' };
    } else {
      // Recursively validate items
      validateAndFixArrayItems(schema.items);
    }
  }
  
  // Recursively check properties
  if (schema.properties && typeof schema.properties === 'object') {
    for (const key in schema.properties) {
      validateAndFixArrayItems(schema.properties[key]);
    }
  }
  
  // Check items if it's an object (for nested structures)
  if (schema.items && typeof schema.items === 'object') {
    validateAndFixArrayItems(schema.items);
  }
  
  // Check allOf, anyOf, oneOf
  ['allOf', 'anyOf', 'oneOf'].forEach(key => {
    if (Array.isArray(schema[key])) {
      schema[key].forEach(item => validateAndFixArrayItems(item));
    }
  });
}

/**
 * Strip .default() values from Zod schema text
 */
function stripDefaultValues(text) {
  // Remove .default(...) - can be nested
  let result = text;
  let changed = true;
  
  while (changed) {
    changed = false;
    // Match .default( with balanced parens
    const defaultPattern = /\.default\s*\([^()]*(?:\([^()]*(?:\([^()]*(?:\([^()]*\)[^()]*)*\)[^()]*)*\)[^()]*)*\)/g;
    
    result = result.replace(defaultPattern, (match) => {
      changed = true;
      return '';
    });
  }
  
  return result;
}

/**
 * Extract balanced braces content
 */
function extractBalancedBraces(text) {
  let depth = 0;
  let start = -1;
  
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (text[i] === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        return text.substring(start + 1, i);
      }
    }
  }
  
  return text;
}

/**
 * Parse Zod properties from schema text
 * Handles nested structures and schema references
 */
function parseZodProperties(schemaText, schemaDefinitions) {
  const properties = {};
  const required = [];
  
  // Split properties by comma, respecting nested structures
  const propertyMatches = splitProperties(schemaText);
  
  for (const propMatch of propertyMatches) {
    if (!propMatch.trim()) continue;
    
    // Extract property name and definition
    const nameMatch = propMatch.match(/^(\w+)\s*:/);
    if (!nameMatch) continue;
    
    const propName = nameMatch[1];
    const propDef = propMatch.substring(nameMatch[0].length).trim();
    
    // Check if optional
    const isOptional = propDef.includes('.optional()');
    
    // Parse the property definition
    const propSchema = parseZodPropertyDefinition(propDef, schemaDefinitions);
    
    if (propSchema) {
      properties[propName] = propSchema;
      if (!isOptional) {
        required.push(propName);
      }
    }
  }
  
  return { properties, required };
}

/**
 * Parse a single Zod property definition
 */
function parseZodPropertyDefinition(propDef, schemaDefinitions) {
  // Remove .optional() if present
  let cleanDef = propDef.replace(/\.optional\(\)/g, '').trim();
  
  // Handle schema references: SomeSchema or SomeSchema.default(...)
  // Match schema name (ending with Schema) optionally followed by method calls
  const schemaRefMatch = cleanDef.match(/^(\w+Schema)(?:\.[\w()]+)*$/);
  if (schemaRefMatch) {
    const refName = schemaRefMatch[1];
    if (schemaDefinitions.has(refName)) {
      // Recursively parse the referenced schema
      return parseZodSchemaAdvanced(schemaDefinitions.get(refName), schemaDefinitions);
    }
  }
  
  // Handle z.string()
  if (cleanDef.startsWith('z.string()')) {
    return parseStringType(cleanDef);
  }
  
  // Handle z.number()
  if (cleanDef.startsWith('z.number()')) {
    return parseNumberType(cleanDef);
  }
  
  // Handle z.boolean()
  if (cleanDef.startsWith('z.boolean()')) {
    return { type: 'boolean' };
  }
  
  // Handle z.array()
  if (cleanDef.startsWith('z.array(')) {
    return parseArrayType(cleanDef, schemaDefinitions);
  }
  
  // Handle z.object()
  if (cleanDef.startsWith('z.object(')) {
    return parseObjectType(cleanDef, schemaDefinitions);
  }
  
  // Handle z.enum()
  if (cleanDef.startsWith('z.enum(')) {
    return parseEnumType(cleanDef);
  }
  
  // Fallback: try to detect type from pattern
  const typeMatch = cleanDef.match(/z\.(\w+)\(/);
  if (typeMatch) {
    const zodType = typeMatch[1];
    const jsonType = mapZodTypeToJsonType(zodType);
    return { type: jsonType };
  }
  
  return null;
}

/**
 * Parse z.string() with constraints
 */
function parseStringType(def) {
  const schema = { type: 'string' };
  
  const minMatch = def.match(/\.min\((\d+)\)/);
  if (minMatch) {
    schema.minLength = parseInt(minMatch[1]);
  }
  
  const maxMatch = def.match(/\.max\((\d+)\)/);
  if (maxMatch) {
    schema.maxLength = parseInt(maxMatch[1]);
  }
  
  return schema;
}

/**
 * Parse z.number() with constraints
 */
function parseNumberType(def) {
  const schema = { type: 'number' };
  
  const minMatch = def.match(/\.min\(([\d.]+)\)/);
  if (minMatch) {
    schema.minimum = parseFloat(minMatch[1]);
  }
  
  const maxMatch = def.match(/\.max\(([\d.]+)\)/);
  if (maxMatch) {
    schema.maximum = parseFloat(maxMatch[1]);
  }
  
  return schema;
}

/**
 * Parse z.array() with items
 * CRITICAL: Always sets items property - OpenAI requires it for all arrays
 */
function parseArrayType(def, schemaDefinitions) {
  const schema = { type: 'array' };
  
  // Extract min items
  const minMatch = def.match(/\.min\((\d+)\)/);
  if (minMatch) {
    schema.minItems = parseInt(minMatch[1]);
  }
  
  // Extract max items
  const maxMatch = def.match(/\.max\((\d+)\)/);
  if (maxMatch) {
    schema.maxItems = parseInt(maxMatch[1]);
  }
  
  // Extract items type - look for content inside z.array(...)
  // Use a more robust extraction that handles nested structures
  const arrayStart = def.indexOf('z.array(');
  if (arrayStart !== -1) {
    // Find the opening paren after z.array
    let parenStart = arrayStart + 8; // length of 'z.array('
    
    // Extract the content between z.array( and matching closing paren
    let depth = 1;
    let itemsDef = '';
    let i = parenStart;
    
    while (i < def.length && depth > 0) {
      const char = def[i];
      if (char === '(') depth++;
      else if (char === ')') {
        depth--;
        if (depth === 0) break;
      }
      if (depth > 0) {
        itemsDef += char;
      }
      i++;
    }
    
    itemsDef = itemsDef.trim();
    
    if (itemsDef) {
      // Handle schema reference in array
      const schemaRefMatch = itemsDef.match(/^(\w+Schema)(?:\.[\w()]+)*$/);
      if (schemaRefMatch && schemaDefinitions.has(schemaRefMatch[1])) {
        const refSchema = parseZodSchemaAdvanced(schemaDefinitions.get(schemaRefMatch[1]), schemaDefinitions);
        if (refSchema && refSchema.type) {
          schema.items = refSchema;
        } else {
          schema.items = { type: 'object', properties: {}, additionalProperties: false };
        }
      }
      // Handle nested objects in arrays: z.object({...})
      else if (itemsDef.startsWith('z.object(')) {
        const nestedObjText = extractNestedObject(itemsDef);
        if (nestedObjText) {
          const nestedProps = parseZodProperties(nestedObjText, schemaDefinitions);
          schema.items = {
            type: 'object',
            properties: nestedProps.properties || {},
            required: nestedProps.required || [],
            additionalProperties: false
          };
        } else {
          // Fallback if extraction fails
          schema.items = { type: 'object', properties: {}, additionalProperties: false };
        }
      }
      // Handle nested arrays: z.array(...)
      else if (itemsDef.startsWith('z.array(')) {
        // Recursively parse nested array
        schema.items = parseArrayType(itemsDef, schemaDefinitions);
      }
      // Handle simple types in arrays
      else {
        const itemSchema = parseZodPropertyDefinition(itemsDef, schemaDefinitions);
        if (itemSchema && itemSchema.type) {
          schema.items = itemSchema;
        } else {
          // Default fallback
          schema.items = { type: 'string' };
        }
      }
    } else {
      // If extraction failed, use default
      schema.items = { type: 'string' };
    }
  } else {
    // No z.array( found, use default
    schema.items = { type: 'string' };
  }
  
  // CRITICAL: Ensure items is always set (OpenAI requirement)
  if (!schema.items || !schema.items.type) {
    schema.items = { type: 'string' };
  }
  
  return schema;
}

/**
 * Parse z.object() - nested objects
 */
function parseObjectType(def, schemaDefinitions) {
  const nestedObjText = extractNestedObject(def);
  if (!nestedObjText) {
    return { type: 'object', properties: {}, additionalProperties: false };
  }
  
  const nestedProps = parseZodProperties(nestedObjText, schemaDefinitions);
  
  return {
    type: 'object',
    properties: nestedProps.properties,
    required: nestedProps.required,
    additionalProperties: false
  };
}

/**
 * Parse z.enum()
 */
function parseEnumType(def) {
  const enumMatch = def.match(/z\.enum\s*\(\s*\[([^\]]+)\]\s*\)/);
  if (enumMatch) {
    const enumValues = enumMatch[1]
      .split(',')
      .map(v => v.trim().replace(/['"]/g, ''))
      .filter(v => v);
    
    return {
      type: 'string',
      enum: enumValues
    };
  }
  
  return { type: 'string' };
}

/**
 * Extract nested object text from z.object(...)
 */
function extractNestedObject(def) {
  const startIdx = def.indexOf('z.object(');
  if (startIdx === -1) return null;
  
  let braceStart = def.indexOf('{', startIdx);
  if (braceStart === -1) return null;
  
  // Find matching closing brace
  let depth = 0;
  let braceEnd = -1;
  
  for (let i = braceStart; i < def.length; i++) {
    if (def[i] === '{') depth++;
    if (def[i] === '}') {
      depth--;
      if (depth === 0) {
        braceEnd = i;
        break;
      }
    }
  }
  
  if (braceEnd === -1) return null;
  
  return def.substring(braceStart + 1, braceEnd);
}

/**
 * Split properties by comma, respecting nested structures
 */
function splitProperties(text) {
  const properties = [];
  let current = '';
  let depth = 0;
  let parenDepth = 0;
  let inString = false;
  let stringChar = null;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const prevChar = i > 0 ? text[i - 1] : '';
    
    // Handle strings
    if ((char === '"' || char === "'") && prevChar !== '\\') {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
        stringChar = null;
      }
    }
    
    if (inString) {
      current += char;
      continue;
    }
    
    // Track brace and paren depth
    if (char === '{') depth++;
    if (char === '}') depth--;
    if (char === '(') parenDepth++;
    if (char === ')') parenDepth--;
    
    // Split on comma only at top level
    if (char === ',' && depth === 0 && parenDepth === 0) {
      if (current.trim()) {
        properties.push(current.trim());
      }
      current = '';
    } else {
      current += char;
    }
  }
  
  if (current.trim()) {
    properties.push(current.trim());
  }
  
  return properties;
}

/**
 * Map Zod types to JSON Schema types
 */
function mapZodTypeToJsonType(zodType) {
  const typeMap = {
    'string': 'string',
    'number': 'number',
    'boolean': 'boolean',
    'array': 'array',
    'object': 'object',
    'date': 'string', // Dates are strings in JSON
    'enum': 'string'
  };

  return typeMap[zodType] || 'string';
}

/**
 * Get layout by name - matches FastAPI get_layout_by_name()
 * Supports:
 * 1. Default templates: "general", "modern", "standard", "swift"
 * 2. TemplateMetadata templates: by template ID (UUID) or name
 *    - Can be passed directly as UUID
 *    - Or with "custom-" prefix: "custom-{templateId}"
 */
export async function getLayoutByName(layoutName) {
  // Check if it's a default template
  if (DEFAULT_TEMPLATES.includes(layoutName)) {
    return await getDefaultTemplate(layoutName);
  }

  // Remove "custom-" prefix if present
  let templateId = layoutName;
  if (layoutName.startsWith('custom-')) {
    templateId = layoutName.replace('custom-', '');
  }

  // Try to fetch from TemplateMetadata (by ID or name)
  try {
    // Try by ID first (UUID)
    let template = await prisma.templateMetadata.findUnique({
      where: { id: templateId }
    });

    // If not found by ID, try by name
    if (!template) {
      template = await prisma.templateMetadata.findFirst({
        where: { 
          name: { equals: templateId, mode: 'insensitive' }
        }
      });
    }

    if (template) {
      return await getCustomTemplate(template.id);
    }
  } catch (error) {
    console.warn(`Error fetching template from TemplateMetadata: ${error.message}`);
  }

  throw new Error(`Template '${layoutName}' not found. Must be one of: ${DEFAULT_TEMPLATES.join(', ')}, or a template ID/name from TemplateMetadata`);
}

/**
 * Get default template from external API or fallback
 * Matches FastAPI behavior of calling localhost/api/template?group={layout_name}
 */
async function getDefaultTemplate(templateName) {
  try {
    // Try to fetch from external API (if available)
    const apiUrl = process.env.TEMPLATE_API_URL || 'http://localhost/api/template';
    const response = await axios.get(apiUrl, {
      params: { group: templateName },
      timeout: 5000
    });

    if (response.data) {
      return {
        name: templateName,
        ordered: response.data.ordered || false,
        slides: response.data.slides || []
      };
    }
  } catch (error) {
    console.warn(`Could not fetch template from API: ${error.message}. Using fallback.`);
  }

  // Fallback: Return a basic structure
  // In production, you might load from a local file or database
  return {
    name: templateName,
    ordered: false,
    slides: [
      {
        id: 'title',
        name: 'Title Slide',
        description: 'Title slide layout',
        json_schema: {
          type: 'object',
          properties: {
            title: { type: 'string', minLength: 3, maxLength: 100 },
            subtitle: { type: 'string', minLength: 0, maxLength: 200 }
          },
          required: ['title']
        }
      },
      {
        id: 'content',
        name: 'Content Slide',
        description: 'Content slide layout',
        json_schema: {
          type: 'object',
          properties: {
            title: { type: 'string', minLength: 3, maxLength: 100 },
            content: { type: 'string', minLength: 10, maxLength: 500 }
          },
          required: ['title', 'content']
        }
      }
    ]
  };
}

/**
 * Get custom template from database
 * Queries TemplateMetadata and PresentationLayoutCode
 * Parses React components to extract JSON schemas
 */
async function getCustomTemplate(templateId) {
  try {
    // Get template metadata
    const template = await prisma.templateMetadata.findUnique({
      where: { id: templateId }
    });

    if (!template) {
      throw new Error(`Custom template '${templateId}' not found`);
    }

    // Get all layouts for this template
    const layouts = await prisma.presentationLayoutCode.findMany({
      where: { presentation: templateId },
      orderBy: { layoutId: 'asc' }
    });

    if (!layouts || layouts.length === 0) {
      throw new Error(`No layouts found for template '${templateId}'`);
    }

    // Parse React components to extract schemas and include component code
    // Use Promise.all to extract schemas concurrently
    const slideLayouts = await Promise.all(
      layouts.map(async (layout) => {
        const schema = await extractSchemaFromReactComponent(layout.layoutCode);
        return {
          id: layout.layoutId,
          name: layout.layoutName,
          description: schema.description || layout.layoutName,
          json_schema: schema.json_schema,
          react_component: layout.layoutCode, // Include React component code for HTML generation
          layout_code: layout.layoutCode, // Alias for compatibility
          fonts: layout.fonts || [] // Include fonts if available
        };
      })
    );

    // Return layout with custom- prefix in name to match FastAPI format
    return {
      name: `custom-${templateId}`, // Include custom- prefix for consistency
      ordered: false, // Custom templates are typically not ordered
      slides: slideLayouts
    };
  } catch (error) {
    console.error(`Error getting custom template ${templateId}:`, error);
    throw new Error(`Failed to get custom template: ${error.message}`);
  }
}

/**
 * Get all available templates (default + custom)
 */
export async function getAllAvailableTemplates() {
  const defaultTemplates = DEFAULT_TEMPLATES.map(name => ({
    id: name,
    name: name.charAt(0).toUpperCase() + name.slice(1),
    type: 'default'
  }));

  const customTemplates = await prisma.templateMetadata.findMany({
    orderBy: { createdAt: 'desc' }
  });

  const customTemplatesList = customTemplates.map(template => ({
    id: `custom-${template.id}`,
    name: template.name,
    description: template.description,
    type: 'custom',
    createdAt: template.createdAt
  }));

  return {
    default: defaultTemplates,
    custom: customTemplatesList
  };
}

