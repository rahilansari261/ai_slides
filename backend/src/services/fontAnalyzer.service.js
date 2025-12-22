import axios from 'axios';
import xml2js from 'xml2js';

// Style tokens to remove from font names
const STYLE_TOKENS = new Set([
  // styles
  'italic', 'italics', 'ital', 'oblique', 'roman',
  // combined style shortcuts
  'bolditalic', 'bolditalics',
  // weights
  'thin', 'hairline', 'extralight', 'ultralight', 'light', 'demilight',
  'semilight', 'book', 'regular', 'normal', 'medium', 'semibold',
  'demibold', 'bold', 'extrabold', 'ultrabold', 'black', 'extrablack',
  'ultrablack', 'heavy',
  // width/stretch
  'narrow', 'condensed', 'semicondensed', 'extracondensed',
  'ultracondensed', 'expanded', 'semiexpanded', 'extraexpanded',
  'ultraexpanded',
]);

const STYLE_MODIFIERS = new Set(['semi', 'demi', 'extra', 'ultra']);

// System fonts to filter out
const SYSTEM_FONTS = new Set(['+mn-lt', '+mj-lt', '+mn-ea', '+mj-ea', '']);

/**
 * Insert spaces in camel case text
 * MontserratBold -> Montserrat Bold
 */
function insertSpacesInCamelCase(value) {
  // Insert space before capital letters preceded by lowercase or digits
  value = value.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  // Handle sequences like BoldItalic -> Bold Italic
  value = value.replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return value;
}

/**
 * Normalize font family name by removing style/weight descriptors
 * "Montserrat Bold Italic" -> "Montserrat"
 * "Open Sans Light" -> "Open Sans"
 */
export function normalizeFontName(rawName) {
  if (!rawName) return rawName;

  // Replace separators with spaces
  let name = rawName.replace(/_/g, ' ').replace(/-/g, ' ');

  // Insert spaces in camel case
  name = insertSpacesInCamelCase(name);

  // Collapse multiple spaces
  name = name.replace(/\s+/g, ' ').trim();

  // Lowercase helper for matching
  const lowerName = name.toLowerCase();

  // Quick check: if the full string ends with a pure style suffix, trim it
  for (const style of STYLE_TOKENS) {
    if (lowerName.endsWith(' ' + style)) {
      name = name.substring(0, name.length - style.length - 1);
      break;
    }
  }

  // Tokenize
  const tokensOriginal = name.split(' ');
  const tokensFiltered = [];

  for (let index = 0; index < tokensOriginal.length; index++) {
    const tok = tokensOriginal[index];
    const lowerTok = tok.toLowerCase();

    // Always keep the first token
    if (index === 0) {
      tokensFiltered.push(tok);
      continue;
    }

    // Drop style tokens and standalone modifiers
    if (STYLE_TOKENS.has(lowerTok) || STYLE_MODIFIERS.has(lowerTok)) {
      continue;
    }

    tokensFiltered.push(tok);
  }

  // If everything was dropped except first token, use original
  if (tokensFiltered.length === 0) {
    return rawName;
  }

  let normalized = tokensFiltered.join(' ').trim();

  // Final cleanup of leftover multiple spaces
  normalized = normalized.replace(/\s+/g, ' ');

  return normalized;
}

/**
 * Extract font names from OXML content
 */
export async function extractFontsFromXML(xmlContent) {
  const fonts = new Set();

  try {
    const parser = new xml2js.Parser();
    const result = await parser.parseStringPromise(xmlContent);

    // Helper function to recursively search for font elements
    const searchForFonts = (obj) => {
      if (!obj || typeof obj !== 'object') return;

      // Check for typeface attribute
      if (obj.$ && obj.$.typeface) {
        fonts.add(obj.$.typeface);
      }

      // Recursively search in all properties
      for (const key in obj) {
        if (Array.isArray(obj[key])) {
          obj[key].forEach(item => searchForFonts(item));
        } else if (typeof obj[key] === 'object') {
          searchForFonts(obj[key]);
        }
      }
    };

    searchForFonts(result);

    // Also use regex as fallback
    const fontPattern = /typeface="([^"]+)"/g;
    let match;
    while ((match = fontPattern.exec(xmlContent)) !== null) {
      fonts.add(match[1]);
    }

    // Filter out system fonts
    const filteredFonts = Array.from(fonts).filter(
      font => !SYSTEM_FONTS.has(font) && font.trim()
    );

    return filteredFonts;
  } catch (error) {
    console.error('Error extracting fonts from XML:', error);
    
    // Fallback to regex only
    const fontPattern = /typeface="([^"]+)"/g;
    const matches = [];
    let match;
    while ((match = fontPattern.exec(xmlContent)) !== null) {
      if (!SYSTEM_FONTS.has(match[1]) && match[1].trim()) {
        matches.push(match[1]);
      }
    }
    return [...new Set(matches)];
  }
}

/**
 * Check if a font is available via Google Fonts
 */
export async function checkGoogleFontsAvailability(fontName) {
  try {
    const formattedName = fontName.replace(/ /g, '+');
    const url = `https://fonts.googleapis.com/css2?family=${formattedName}&display=swap`;

    const response = await axios.head(url, {
      timeout: 10000,
      validateStatus: (status) => status < 500, // Don't throw on 4xx
    });

    return response.status === 200;
  } catch (error) {
    console.error(`Error checking Google Fonts for "${fontName}":`, error.message);
    return false;
  }
}

/**
 * Analyze fonts across all slides
 */
export async function analyzeFontsInAllSlides(slideXMLs) {
  // Extract fonts from all slides
  const rawFonts = new Set();
  
  for (const xmlContent of slideXMLs) {
    const slideFonts = await extractFontsFromXML(xmlContent);
    slideFonts.forEach(font => rawFonts.add(font));
  }

  // Normalize to root families
  const normalizedFonts = new Set();
  for (const font of rawFonts) {
    const normalized = normalizeFontName(font);
    if (normalized) {
      normalizedFonts.add(normalized);
    }
  }

  // Check Google Fonts availability concurrently
  const fontChecks = Array.from(normalizedFonts).map(async (font) => {
    const isAvailable = await checkGoogleFontsAvailability(font);
    return { font, isAvailable };
  });

  const results = await Promise.all(fontChecks);

  const internallySupportedFonts = [];
  const notSupportedFonts = [];

  for (const { font, isAvailable } of results) {
    if (isAvailable) {
      const formattedName = font.replace(/ /g, '+');
      const googleFontsUrl = `https://fonts.googleapis.com/css2?family=${formattedName}&display=swap`;
      internallySupportedFonts.push({
        name: font,
        google_fonts_url: googleFontsUrl,
      });
    } else {
      notSupportedFonts.push(font);
    }
  }

  return {
    internally_supported_fonts: internallySupportedFonts,
    not_supported_fonts: notSupportedFonts,
  };
}

