/**
 * Schema utilities matching FastAPI utils/schema_utils.py
 * Adds additionalProperties: false to all object types in JSON schema
 */

/**
 * Recursively add additionalProperties: false to all object types
 * Matches FastAPI add_additional_properties_to_schema()
 */
export function addAdditionalPropertiesToSchema(jsonSchema) {
  if (!jsonSchema || typeof jsonSchema !== 'object') {
    return jsonSchema;
  }

  // Create a deep copy
  const schema = JSON.parse(JSON.stringify(jsonSchema));

  function processSchema(obj) {
    if (!obj || typeof obj !== 'object') {
      return;
    }

    // If it's an object type, add additionalProperties: false
    if (obj.type === 'object' && !('additionalProperties' in obj)) {
      obj.additionalProperties = false;
    }

    // Process properties
    if (obj.properties) {
      Object.values(obj.properties).forEach(prop => processSchema(prop));
    }

    // Process items (for arrays)
    if (obj.items) {
      if (Array.isArray(obj.items)) {
        obj.items.forEach(item => processSchema(item));
      } else {
        processSchema(obj.items);
      }
    }

    // Process allOf, anyOf, oneOf
    ['allOf', 'anyOf', 'oneOf'].forEach(key => {
      if (obj[key] && Array.isArray(obj[key])) {
        obj[key].forEach(item => processSchema(item));
      }
    });

    // Process additionalProperties if it's a schema object
    if (obj.additionalProperties && typeof obj.additionalProperties === 'object') {
      processSchema(obj.additionalProperties);
    }

    // Process not
    if (obj.not) {
      processSchema(obj.not);
    }
  }

  processSchema(schema);
  return schema;
}



