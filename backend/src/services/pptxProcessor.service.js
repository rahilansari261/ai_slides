import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { v4 as uuidv4 } from 'uuid';
import { extractFontsFromXML, normalizeFontName, analyzeFontsInAllSlides } from './fontAnalyzer.service.js';
import { getImagesDirectory, ensureDirectoryExists } from '../utils/storage.js';

const POWERPOINT_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
];

/**
 * Validate PPTX file
 */
export function validatePPTX(file) {
  const errors = [];

  // Check file type
  if (!POWERPOINT_MIME_TYPES.includes(file.mimetype) && !file.originalname.endsWith('.pptx')) {
    errors.push('Invalid file type. Only PPTX files are allowed.');
  }

  // Check file size (100MB limit)
  const maxSize = 100 * 1024 * 1024; // 100MB
  if (file.size > maxSize) {
    errors.push(`File size exceeds limit. Maximum allowed size is 100MB.`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Extract slide XMLs from PPTX file
 */
export async function extractSlideXMLs(pptxPath) {
  const slideXMLs = [];
  const extractDir = path.join(path.dirname(pptxPath), 'pptx_extract');

  try {
    // Ensure extract directory exists and is clean
    if (fs.existsSync(extractDir)) {
      fs.rmSync(extractDir, { recursive: true, force: true });
    }
    ensureDirectoryExists(extractDir);

    console.log(`[extractSlideXMLs] Extracting PPTX from: ${pptxPath}`);
    console.log(`[extractSlideXMLs] Extract directory: ${extractDir}`);

    // Check if PPTX file exists and is readable
    if (!fs.existsSync(pptxPath)) {
      throw new Error(`PPTX file not found: ${pptxPath}`);
    }

    const fileStats = fs.statSync(pptxPath);
    console.log(`[extractSlideXMLs] PPTX file size: ${fileStats.size} bytes`);

    // Unzip PPTX file using adm-zip (similar to Python's zipfile.extractall())
    // This matches FastAPI's approach: extractall() extracts everything at once
    try {
      const zip = new AdmZip(pptxPath);
      console.log(`[extractSlideXMLs] Extracting all files from PPTX...`);
      
      // Extract all files to extractDir (similar to Python's extractall())
      zip.extractAllTo(extractDir, true); // true = overwrite existing files
      
      console.log(`[extractSlideXMLs] Extraction completed using extractAllTo()`);
    } catch (err) {
      console.error(`[extractSlideXMLs] Error extracting zip file:`, err);
      throw new Error(`Failed to extract PPTX file: ${err.message}`);
    }

    // Check what was extracted
    if (!fs.existsSync(extractDir)) {
      throw new Error(`Extraction directory was not created: ${extractDir}`);
    }

    const extractedItems = fs.readdirSync(extractDir);
    console.log(`[extractSlideXMLs] Extracted items in root: ${extractedItems.join(', ')}`);

    // Look for slides in ppt/slides/ directory (standard PPTX structure)
    const pptDir = path.join(extractDir, 'ppt');
    let slidesDir = path.join(extractDir, 'ppt', 'slides');
    
    // Verify ppt directory exists
    if (fs.existsSync(pptDir)) {
      const pptItems = fs.readdirSync(pptDir);
      console.log(`[extractSlideXMLs] Contents of ppt/ directory: ${pptItems.join(', ')}`);
    } else {
      console.warn(`[extractSlideXMLs] ppt/ directory not found!`);
    }
    
    // Also check alternative structure (some PPTX files might have different structure)
    if (!fs.existsSync(slidesDir)) {
      console.log(`[extractSlideXMLs] Standard path not found: ${slidesDir}`);
      
      // Try to find slides directory by searching
      if (fs.existsSync(pptDir)) {
        const pptContents = fs.readdirSync(pptDir);
        console.log(`[extractSlideXMLs] Contents of ppt/ directory: ${pptContents.join(', ')}`);
        
        // Check if slides directory exists with different casing
        const possibleSlidesDirs = pptContents.filter(item => {
          const itemPath = path.join(pptDir, item);
          return fs.statSync(itemPath).isDirectory() && item.toLowerCase().includes('slide');
        });
        
        if (possibleSlidesDirs.length > 0) {
          slidesDir = path.join(pptDir, possibleSlidesDirs[0]);
          console.log(`[extractSlideXMLs] Found alternative slides directory: ${slidesDir}`);
        }
      }
    }

    if (!fs.existsSync(slidesDir)) {
      // List all directories for debugging
      const listAllDirs = (dir, depth = 0, maxDepth = 3) => {
        if (depth > maxDepth) return [];
        const items = [];
        try {
          const entries = fs.readdirSync(dir);
          for (const entry of entries) {
            const fullPath = path.join(dir, entry);
            try {
              const stat = fs.statSync(fullPath);
              if (stat.isDirectory()) {
                items.push(fullPath);
                items.push(...listAllDirs(fullPath, depth + 1, maxDepth));
              }
            } catch (e) {
              // Skip
            }
          }
        } catch (e) {
          // Skip
        }
        return items;
      };

      const allDirs = listAllDirs(extractDir);
      console.error(`[extractSlideXMLs] Slides directory not found. Available directories:`, allDirs);
      throw new Error(`No slides directory found in PPTX file. Expected: ${path.join(extractDir, 'ppt', 'slides')}`);
    }

    // Get all slide XML files and sort them numerically
    // This matches FastAPI's approach exactly: os.listdir() then filter for slide*.xml
    const allItems = fs.readdirSync(slidesDir);
    console.log(`[extractSlideXMLs] All items in slides directory: ${allItems.join(', ')}`);

    // Filter slide files - must start with "slide" and end with ".xml"
    // FastAPI: [f for f in os.listdir(slides_dir) if f.startswith("slide") and f.endswith(".xml")]
    const slideFiles = allItems
      .filter(f => {
        // Check if it's actually a file (not a directory)
        const itemPath = path.join(slidesDir, f);
        try {
          const stat = fs.statSync(itemPath);
          if (!stat.isFile()) {
            return false; // Skip directories
          }
        } catch (e) {
          return false; // Skip if we can't stat it
        }
        
        // Match FastAPI's filter: starts with "slide" and ends with ".xml"
        return f.startsWith('slide') && f.endsWith('.xml');
      })
      .sort((a, b) => {
        // FastAPI: sort(key=lambda x: int(x.replace("slide", "").replace(".xml", "")))
        const numA = parseInt(a.replace('slide', '').replace('.xml', ''), 10) || 0;
        const numB = parseInt(b.replace('slide', '').replace('.xml', ''), 10) || 0;
        return numA - numB;
      });

    console.log(`[extractSlideXMLs] Found ${slideFiles.length} slide XML file(s): ${slideFiles.join(', ')}`);

    if (slideFiles.length === 0) {
      throw new Error(`No slide XML files found in ${slidesDir}. Available items: ${allItems.join(', ')}`);
    }

    // Also check presentation.xml to verify slide count if available
    const presentationXmlPath = path.join(pptDir, 'presentation.xml');
    if (fs.existsSync(presentationXmlPath)) {
      try {
        const presentationXml = fs.readFileSync(presentationXmlPath, 'utf-8');
        // Count slide references in presentation.xml
        const slideRefMatches = presentationXml.match(/<p:sldId[^>]*>/g);
        const expectedSlideCount = slideRefMatches ? slideRefMatches.length : null;
        if (expectedSlideCount && expectedSlideCount !== slideFiles.length) {
          console.warn(`[extractSlideXMLs] Warning: presentation.xml references ${expectedSlideCount} slides, but found ${slideFiles.length} slide files`);
        } else if (expectedSlideCount) {
          console.log(`[extractSlideXMLs] Verified: presentation.xml references ${expectedSlideCount} slides, matches found files`);
        }
      } catch (err) {
        console.warn(`[extractSlideXMLs] Could not read presentation.xml: ${err.message}`);
      }
    }

    // Read XML content from each slide
    console.log(`[extractSlideXMLs] Reading XML content from ${slideFiles.length} slide file(s)...`);
    for (let i = 0; i < slideFiles.length; i++) {
      const slideFile = slideFiles[i];
      const slidePath = path.join(slidesDir, slideFile);
      
      try {
        const xmlContent = fs.readFileSync(slidePath, 'utf-8');
        const xmlSize = xmlContent.length;
        console.log(`[extractSlideXMLs] Read slide ${i + 1}/${slideFiles.length}: ${slideFile} (${xmlSize} bytes)`);
        slideXMLs.push(xmlContent);
      } catch (error) {
        console.error(`[extractSlideXMLs] Error reading slide file ${slideFile}:`, error);
        throw new Error(`Failed to read slide file ${slideFile}: ${error.message}`);
      }
    }

    console.log(`[extractSlideXMLs] Successfully extracted ${slideXMLs.length} slide(s) from PPTX file`);

    if (slideXMLs.length === 0) {
      throw new Error('No slide XML content was extracted from PPTX file');
    }

    return {
      slideXMLs,
      extractDir,
    };
  } catch (error) {
    console.error('[extractSlideXMLs] Error extracting slide XMLs:', error);
    throw new Error(`Failed to extract slides from PPTX: ${error.message}`);
  }
}

/**
 * Process PPTX file and extract all necessary data
 */
export async function processPPTXFile(pptxPath, tempDir) {
  try {
    // Extract slide XMLs
    const { slideXMLs, extractDir } = await extractSlideXMLs(pptxPath);

    if (slideXMLs.length === 0) {
      throw new Error('No slides found in PPTX file');
    }

    // Analyze fonts across all slides
    const fontAnalysis = await analyzeFontsInAllSlides(slideXMLs);

    // Prepare slide data
    const slides = slideXMLs.map((xmlContent, index) => {
      // Get normalized fonts for this slide
      const rawFonts = [];
      try {
        // This is synchronous extraction, we'll handle async version if needed
        const fontPattern = /typeface="([^"]+)"/g;
        let match;
        while ((match = fontPattern.exec(xmlContent)) !== null) {
          rawFonts.push(match[1]);
        }
      } catch (error) {
        console.error('Error extracting fonts from slide:', error);
      }

      const normalizedFonts = [...new Set(rawFonts.map(f => normalizeFontName(f)).filter(Boolean))];

      return {
        slide_number: index + 1,
        xml_content: xmlContent,
        normalized_fonts: normalizedFonts,
        screenshot_url: null, // Will be set after screenshot generation
      };
    });

    return {
      slides,
      fontAnalysis,
      extractDir,
      totalSlides: slides.length,
    };
  } catch (error) {
    console.error('Error processing PPTX file:', error);
    throw error;
  }
}

/**
 * Save screenshots to permanent storage
 */
export async function saveScreenshotsToStorage(screenshots, presentationId) {
  const imagesDir = getImagesDirectory();
  const presentationImagesDir = path.join(imagesDir, presentationId);
  
  ensureDirectoryExists(presentationImagesDir);

  const savedScreenshots = [];

  for (let i = 0; i < screenshots.length; i++) {
    const screenshotPath = screenshots[i];
    const filename = `slide_${i + 1}.png`;
    const destinationPath = path.join(presentationImagesDir, filename);

    // Copy screenshot to permanent location
    fs.copyFileSync(screenshotPath, destinationPath);

    const screenshotUrl = `/app_data/images/${presentationId}/${filename}`;
    savedScreenshots.push(screenshotUrl);
  }

  return savedScreenshots;
}

/**
 * Clean up temporary files
 */
export function cleanupTempFiles(tempDir) {
  try {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  } catch (error) {
    console.error('Error cleaning up temp files:', error);
  }
}

