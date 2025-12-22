/**
 * Lenient JSON parser - equivalent to Python's dirtyjson
 * Handles malformed JSON with trailing commas, comments, etc.
 */

export function parseDirtyJSON(text) {
  try {
    // First try standard JSON parse
    return JSON.parse(text);
  } catch (e) {
    // If that fails, try to clean up common issues
    let cleaned = text.trim();
    
    // Remove trailing commas before closing braces/brackets
    cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');
    
    // Remove single-line comments (// ...)
    cleaned = cleaned.replace(/\/\/.*$/gm, '');
    
    // Remove multi-line comments (/* ... */)
    cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');
    
    try {
      return JSON.parse(cleaned);
    } catch (e2) {
      // If still fails, try to extract JSON from markdown code blocks
      const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) {
        try {
          return JSON.parse(codeBlockMatch[1]);
        } catch (e3) {
          // Last resort: try to find JSON object/array in the text
          const jsonMatch = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
          if (jsonMatch) {
            try {
              return JSON.parse(jsonMatch[1]);
            } catch (e4) {
              throw new Error(`Failed to parse JSON: ${e.message}`);
            }
          }
          throw new Error(`Failed to parse JSON: ${e.message}`);
        }
      }
      throw new Error(`Failed to parse JSON: ${e.message}`);
    }
  }
}

