import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import {
  validatePPTX,
  processPPTXFile,
  saveScreenshotsToStorage,
  cleanupTempFiles,
} from '../services/pptxProcessor.service.js';
import {
  generateScreenshotsFromXML,
  generateScreenshotsFromPPTX,
} from '../services/screenshotGenerator.service.js';
import {
  generateHTMLFromSlide,
  generateReactFromHTML,
  generateHTMLFromSlidesBatch,
  generateReactFromHTMLBatch,
  readImageAsBase64,
} from '../services/aiConversion.service.js';
import { getTemporaryDirectory } from '../utils/storage.js';
import prisma from '../config/prisma.js';

/**
 * End-to-end custom template upload and processing.
 * Combines:
 *  - processPPTX
 *  - slideToHTML
 *  - htmlToReact
 *  - saveLayouts
 *  - saveTemplate
 *
 * POST /api/custom-templates/upload-template
 * Multipart form fields:
 *  - pptx_file: PPTX file
 *  - name: template name (required)
 *  - description: template description (optional)
 */
export async function uploadCustomTemplate(req, res) {
  let tempDir = null;
  let pptxPath = null;

  try {
    console.log('[CustomTemplate] Starting end-to-end template upload flow');

    // Validate file was uploaded
    if (!req.file) {
      console.error('[CustomTemplate] No PPTX file provided');
      return res.status(400).json({
        success: false,
        error: 'No PPTX file provided',
      });
    }

    const { name, description } = req.body;
    if (!name) {
      console.error('[CustomTemplate] Template name is missing');
      return res.status(400).json({
        success: false,
        error: 'Template name (field "name") is required',
      });
    }

    console.log('[CustomTemplate] Validating PPTX file...');
    const validation = validatePPTX(req.file);
    if (!validation.valid) {
      console.error('[CustomTemplate] PPTX validation failed', validation.errors);
      return res.status(400).json({
        success: false,
        errors: validation.errors,
      });
    }

    pptxPath = req.file.path;
    tempDir = path.join(getTemporaryDirectory(), uuidv4());
    fs.mkdirSync(tempDir, { recursive: true });

    console.log(
      '[CustomTemplate] Processing PPTX file (extract slide XMLs and analyze fonts)...'
    );
    const { slides, fontAnalysis, extractDir, totalSlides } = await processPPTXFile(
      pptxPath,
      tempDir
    );
    console.log(
      `[CustomTemplate] PPTX processed successfully. Total slides: ${totalSlides}`
    );

    console.log(
      '[CustomTemplate] Generating screenshots from PPTX via PDF pipeline...'
    );
    const screenshotsDir = path.join(tempDir, 'screenshots');
    fs.mkdirSync(screenshotsDir, { recursive: true });

    // Extract slide XMLs for font config (like FastAPI does)
    const slideXMLs = slides.map(s => s.xml_content);
    const screenshots = await generateScreenshotsFromPPTX(pptxPath, screenshotsDir, slideXMLs);
    console.log(
      `[CustomTemplate] Generated ${screenshots.length} screenshot(s) for slides`
    );

    // Save screenshots to permanent storage
    const presentationId = uuidv4();
    console.log(
      `[CustomTemplate] Saving screenshots for presentation ${presentationId}...`
    );
    const screenshotUrls = await saveScreenshotsToStorage(screenshots, presentationId);

    // Update slides with screenshot URLs
    const slidesWithScreenshots = slides.map((slide, index) => ({
      ...slide,
      screenshot_url: screenshotUrls[index],
    }));

    console.log(
      `[CustomTemplate] Starting AI conversion and layout saving for ${slidesWithScreenshots.length} slide(s)...`
    );

    // Prepare batch data for HTML generation
    console.log('[CustomTemplate] Preparing batch data for HTML generation...');
    const htmlBatchData = slidesWithScreenshots.map((slide) => {
      const { base64Image, mediaType } = readImageAsBase64(slide.screenshot_url);
      return {
        imageBase64: base64Image,
        mediaType,
        xmlContent: slide.xml_content,
        fonts: slide.normalized_fonts || [],
      };
    });

    // Generate HTML for all slides in batch
    console.log('[CustomTemplate] Calling OpenRouter batch API for HTML generation...');
    const htmlContents = await generateHTMLFromSlidesBatch(htmlBatchData);
    console.log(`[CustomTemplate] Generated HTML for ${htmlContents.length} slides`);

    // Prepare batch data for React generation
    console.log('[CustomTemplate] Preparing batch data for React component generation...');
    const reactBatchData = htmlContents.map((htmlContent, index) => {
      const slide = slidesWithScreenshots[index];
      const { base64Image, mediaType } = readImageAsBase64(slide.screenshot_url);
      return {
        htmlContent,
        imageBase64: base64Image,
        mediaType,
      };
    });

    // Generate React components for all HTML in batch
    console.log('[CustomTemplate] Calling OpenRouter batch API for React component generation...');
    const reactComponents = await generateReactFromHTMLBatch(reactBatchData);
    console.log(`[CustomTemplate] Generated React components for ${reactComponents.length} slides`);

    // Save all layouts to database
    console.log('[CustomTemplate] Saving all layouts to database...');
    let savedLayoutsCount = 0;
    const layoutsSummary = [];

    for (let i = 0; i < slidesWithScreenshots.length; i++) {
      const slide = slidesWithScreenshots[i];
      const slideNumber = slide.slide_number;
      const layoutId = `slide-${slideNumber}`;
      const layoutName = `DynamicSlideLayout${slideNumber}`;
      const reactComponent = reactComponents[i];

      const existingLayout = await prisma.presentationLayoutCode.findFirst({
        where: {
          presentation: presentationId,
          layoutId,
        },
      });

      if (existingLayout) {
        await prisma.presentationLayoutCode.update({
          where: { id: existingLayout.id },
          data: {
            layoutName,
            layoutCode: reactComponent,
            fonts: slide.normalized_fonts || [],
          },
        });
      } else {
        await prisma.presentationLayoutCode.create({
          data: {
            presentation: presentationId,
            layoutId,
            layoutName,
            layoutCode: reactComponent,
            fonts: slide.normalized_fonts || [],
          },
        });
      }

      savedLayoutsCount += 1;
      layoutsSummary.push({
        slide_number: slideNumber,
        layout_id: layoutId,
        layout_name: layoutName,
      });

      console.log(
        `[CustomTemplate] [Slide ${slideNumber}] Layout saved successfully (layoutId=${layoutId})`
      );
    }

    // Save template metadata
    console.log(
      `[CustomTemplate] Saving template metadata (id=${presentationId}, name="${name}")`
    );

    const template = await prisma.templateMetadata.upsert({
      where: { id: presentationId },
      update: {
        name,
        description: description || null,
      },
      create: {
        id: presentationId,
        name,
        description: description || null,
      },
    });

    console.log(
      `[CustomTemplate] Template metadata saved successfully (created_at=${template.createdAt})`
    );

    // Clean up temp files and uploaded PPTX
    console.log('[CustomTemplate] Cleaning up temporary files');
    if (tempDir) {
      cleanupTempFiles(tempDir);
    }
    if (pptxPath && fs.existsSync(pptxPath)) {
      fs.unlinkSync(pptxPath);
    }

    console.log(
      `[CustomTemplate] End-to-end template upload flow completed successfully for presentation ${presentationId}`
    );

    return res.json({
      success: true,
      presentation_id: presentationId,
      template: {
        id: template.id,
        name: template.name,
        description: template.description,
        created_at: template.createdAt,
      },
      layouts_saved: savedLayoutsCount,
      layouts: layoutsSummary,
      fonts: fontAnalysis,
    });
  } catch (error) {
    console.error('[CustomTemplate] Error in end-to-end template upload flow:', error);

    // Clean up on error
    if (tempDir) {
      cleanupTempFiles(tempDir);
    }
    if (pptxPath && fs.existsSync(pptxPath)) {
      fs.unlinkSync(pptxPath);
    }

    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload and process custom template',
    });
  }
}

/**
 * Process PPTX file - extract XMLs, generate screenshots, analyze fonts
 * POST /api/custom-templates/process-pptx
 */
export async function processPPTX(req, res) {
  let tempDir = null;
  
  try {
    // Validate file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No PPTX file provided',
      });
    }

    // Validate PPTX file
    const validation = validatePPTX(req.file);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        errors: validation.errors,
      });
    }

    const pptxPath = req.file.path;
    tempDir = path.join(getTemporaryDirectory(), uuidv4());
    fs.mkdirSync(tempDir, { recursive: true });

    // Process PPTX file (extract XML and analyze fonts)
    console.log('Processing PPTX file (XML + fonts)...');
    const { slides, fontAnalysis, extractDir, totalSlides } = await processPPTXFile(
      pptxPath,
      tempDir
    );
    console.log(`PPTX processed successfully. Total slides: ${totalSlides}`);

    // Generate screenshots using PPTX -> PDF -> PNG flow (LibreOffice + PDF rendering)
    console.log('Generating screenshots from PPTX via PDF pipeline...');
    const screenshotsDir = path.join(tempDir, 'screenshots');
    fs.mkdirSync(screenshotsDir, { recursive: true });
    
    // Extract slide XMLs for font config (like FastAPI does)
    const slideXMLs = slides.map(s => s.xml_content);
    const screenshots = await generateScreenshotsFromPPTX(pptxPath, screenshotsDir, slideXMLs);

    // Save screenshots to permanent storage
    const presentationId = uuidv4();
    console.log(`Saving screenshots for presentation ${presentationId}...`);
    const screenshotUrls = await saveScreenshotsToStorage(screenshots, presentationId);

    // Update slides with screenshot URLs
    const slidesWithScreenshots = slides.map((slide, index) => ({
      ...slide,
      screenshot_url: screenshotUrls[index],
    }));

    // Clean up temp files
    cleanupTempFiles(tempDir);
    cleanupTempFiles(extractDir);
    if (fs.existsSync(pptxPath)) {
      fs.unlinkSync(pptxPath);
    }

    return res.json({
      success: true,
      presentation_id: presentationId,
      slides: slidesWithScreenshots,
      total_slides: slidesWithScreenshots.length,
      fonts: fontAnalysis,
    });
  } catch (error) {
    console.error('Error processing PPTX:', error);
    
    // Clean up on error
    if (tempDir) {
      cleanupTempFiles(tempDir);
    }
    
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to process PPTX file',
    });
  }
}

/**
 * Convert slide to HTML using AI
 * POST /api/custom-templates/slide-to-html
 */
export async function slideToHTML(req, res) {
  try {
    const { image, xml, fonts } = req.body;

    if (!image || !xml) {
      return res.status(400).json({
        success: false,
        error: 'image and xml are required',
      });
    }

    // Read and encode image
    const { base64Image, mediaType } = readImageAsBase64(image);

    // Generate HTML
    const htmlContent = await generateHTMLFromSlide(
      base64Image,
      mediaType,
      xml,
      fonts || []
    );

    return res.json({
      success: true,
      html: htmlContent,
    });
  } catch (error) {
    console.error('Error converting slide to HTML:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to convert slide to HTML',
    });
  }
}

/**
 * Convert HTML to React component using AI
 * POST /api/custom-templates/html-to-react
 */
export async function htmlToReact(req, res) {
  try {
    const { html, image } = req.body;

    if (!html) {
      return res.status(400).json({
        success: false,
        error: 'html is required',
      });
    }

    let base64Image = null;
    let mediaType = null;

    // Optionally include image for context
    if (image) {
      const imageData = readImageAsBase64(image);
      base64Image = imageData.base64Image;
      mediaType = imageData.mediaType;
    }

    // Generate React component
    const reactComponent = await generateReactFromHTML(html, base64Image, mediaType);

    return res.json({
      success: true,
      react_component: reactComponent,
    });
  } catch (error) {
    console.error('Error converting HTML to React:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to convert HTML to React',
    });
  }
}

/**
 * Save layouts to database
 * POST /api/custom-templates/save-layouts
 */
export async function saveLayouts(req, res) {
  try {
    const { layouts } = req.body;

    if (!layouts || !Array.isArray(layouts)) {
      return res.status(400).json({
        success: false,
        error: 'layouts array is required',
      });
    }

    let savedCount = 0;

    for (const layoutData of layouts) {
      const { presentation, layout_id, layout_name, layout_code, fonts } = layoutData;

      if (!presentation || !layout_id || !layout_name || !layout_code) {
        continue; // Skip invalid entries
      }

      // Check if layout already exists
      const existingLayout = await prisma.presentationLayoutCode.findFirst({
        where: {
          presentation,
          layoutId: layout_id,
        },
      });

      if (existingLayout) {
        // Update existing layout
        await prisma.presentationLayoutCode.update({
          where: { id: existingLayout.id },
          data: {
            layoutName: layout_name,
            layoutCode: layout_code,
            fonts: fonts || [],
          },
        });
      } else {
        // Create new layout
        await prisma.presentationLayoutCode.create({
          data: {
            presentation,
            layoutId: layout_id,
            layoutName: layout_name,
            layoutCode: layout_code,
            fonts: fonts || [],
          },
        });
      }

      savedCount++;
    }

    return res.json({
      success: true,
      saved_count: savedCount,
      message: `Successfully saved ${savedCount} layout(s)`,
    });
  } catch (error) {
    console.error('Error saving layouts:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to save layouts',
    });
  }
}

/**
 * Save template metadata
 * POST /api/custom-templates/save-template
 */
export async function saveTemplate(req, res) {
  try {
    const { id, name, description } = req.body;

    if (!id || !name) {
      return res.status(400).json({
        success: false,
        error: 'id and name are required',
      });
    }

    // Upsert template (create or update)
    const template = await prisma.templateMetadata.upsert({
      where: { id },
      update: {
        name,
        description: description || null,
      },
      create: {
        id,
        name,
        description: description || null,
      },
    });

    return res.json({
      success: true,
      template: {
        id: template.id,
        name: template.name,
        description: template.description,
        created_at: template.createdAt,
      },
    });
  } catch (error) {
    console.error('Error saving template:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to save template',
    });
  }
}

/**
 * Get layouts for a template
 * GET /api/custom-templates/layouts/:presentationId
 */
export async function getLayouts(req, res) {
  try {
    const { presentationId } = req.params;

    if (!presentationId) {
      return res.status(400).json({
        success: false,
        error: 'presentationId is required',
      });
    }

    // Get layouts
    const layouts = await prisma.presentationLayoutCode.findMany({
      where: { presentation: presentationId },
      orderBy: { layoutId: 'asc' },
    });

    // Get template metadata
    const template = await prisma.templateMetadata.findUnique({
      where: { id: presentationId },
    });

    // Collect all fonts
    const allFonts = new Set();
    layouts.forEach(layout => {
      if (layout.fonts && Array.isArray(layout.fonts)) {
        layout.fonts.forEach(font => allFonts.add(font));
      }
    });

    return res.json({
      success: true,
      layouts: layouts.map(l => ({
        presentation: l.presentation,
        layout_id: l.layoutId,
        layout_name: l.layoutName,
        layout_code: l.layoutCode,
        fonts: l.fonts,
      })),
      template: template ? {
        id: template.id,
        name: template.name,
        description: template.description,
        created_at: template.createdAt,
      } : null,
      fonts: Array.from(allFonts),
    });
  } catch (error) {
    console.error('Error getting layouts:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get layouts',
    });
  }
}

/**
 * Get all custom templates
 * GET /api/custom-templates/templates
 */
export async function getAllTemplates(req, res) {
  try {
    const templates = await prisma.templateMetadata.findMany({
      orderBy: { createdAt: 'desc' },
    });

    // Get layout count for each template
    const templatesWithCounts = await Promise.all(
      templates.map(async (template) => {
        const layoutCount = await prisma.presentationLayoutCode.count({
          where: { presentation: template.id },
        });

        return {
          id: template.id,
          name: template.name,
          description: template.description,
          created_at: template.createdAt,
          layout_count: layoutCount,
        };
      })
    );

    return res.json({
      success: true,
      templates: templatesWithCounts,
    });
  } catch (error) {
    console.error('Error getting templates:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get templates',
    });
  }
}

