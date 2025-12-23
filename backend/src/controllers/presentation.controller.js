import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { generatePresentationContent } from '../services/openai.service.js';
import { createPPTX } from '../services/pptx.service.js';
import prisma from '../config/prisma.js';
import { generatePresentationOutline } from '../services/presentationOutline.service.js';
import { generatePresentationStructure } from '../services/presentationStructure.service.js';
import { getLayoutByName } from '../services/templateRetrieval.service.js';
import { generateSlideContentBatch } from '../services/slideContent.service.js';
import { parseDirtyJSON } from '../utils/dirtyjson.js';
import { getPresentationTitleFromOutlines, selectTocOrListSlideLayoutIndex } from '../utils/presentationUtils.js';
import { processSlideAddPlaceholderAssets, processSlideAndFetchAssets } from '../utils/slideProcessing.js';
import { SSEResponse, SSEStatusResponse, SSEErrorResponse, SSECompleteResponse } from '../utils/sseResponse.js';
import { DEFAULT_TEMPLATES } from '../constants/presentation.js';
import { presentationToPptxModel } from '../services/presentationToPptxModel.service.js';
import { generateSlideHtml } from '../services/slideHtmlGeneration.service.js';

const storagePath = process.env.STORAGE_PATH || './presentations';

// Helper to get presentation directory
const getPresentationDir = (id) => path.join(storagePath, id);

// Helper to get presentation data file path
const getDataFilePath = (id) => path.join(getPresentationDir(id), 'data.json');

// Get all available templates
export const getTemplates = async (req, res) => {
  try {
    // Get all templates from TemplateMetadata
    const templates = await prisma.templateMetadata.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        layouts: {
          orderBy: { layoutId: 'asc' }
        }
      }
    });

    // Format templates for response
    const formattedTemplates = templates.map(template => ({
      id: template.id,
      name: template.name,
      description: template.description,
      createdAt: template.createdAt,
      layoutCount: template.layouts.length
    }));

    res.json(formattedTemplates);
  } catch (error) {
    console.error('Error getting templates:', error);
    res.status(500).json({ error: error.message });
  }
};

export const generatePresentation = async (req, res) => {
  try {
    const {
      topic,
      numSlides = 8,
      language = 'English',
      tone = 'professional',
      verbosity = 'standard',
      instructions = '',
      templateId = 'modern_dark'
    } = req.body;

    if (!topic) {
      return res.status(400).json({ error: 'Topic is required' });
    }

    console.log(`Generating presentation for topic: ${topic} with template: ${templateId}`);

    // Get the selected template from TemplateMetadata
    let template;
    try {
      template = await getLayoutByName(templateId);
    } catch (error) {
      return res.status(404).json({ error: `Template '${templateId}' not found: ${error.message}` });
    }

    // Generate content using OpenAI with template schema
    // Note: Legacy endpoint - consider using the new flow (create -> streamOutlines -> prepare -> stream)
    const content = await generatePresentationContent({
      topic,
      numSlides,
      language,
      tone,
      verbosity,
      instructions,
      templateSchema: {}, // Legacy - not used in new flow
      slideLayouts: template.slides || []
    });

    // Create presentation ID and directory
    const id = uuidv4();
    const presentationDir = getPresentationDir(id);
    fs.mkdirSync(presentationDir, { recursive: true });

    // Create presentation data
    // Note: Legacy endpoint - theme and decorationStyle not available from TemplateMetadata
    const presentation = {
      id,
      topic,
      language,
      tone,
      verbosity,
      templateId,
      slides: content.slides,
      theme: {}, // Legacy - not stored in TemplateMetadata
      decorationStyle: 'geometric', // Legacy default
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Save presentation data
    fs.writeFileSync(getDataFilePath(id), JSON.stringify(presentation, null, 2));

    // Generate PPTX file
    const pptxPath = await createPPTX(presentation, presentationDir);

    res.json({
      ...presentation,
      pptxPath: `/presentations/${id}/${path.basename(pptxPath)}`
    });
  } catch (error) {
    console.error('Error generating presentation:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get a specific presentation
 * GET /api/presentations/:id
 * Matches FastAPI get_presentation() exactly
 */
export const getPresentation = async (req, res) => {
  try {
    const { id } = req.params;

    // Get presentation from database
    const presentation = await prisma.presentation.findUnique({
      where: { id },
      include: {
        slides: {
          orderBy: { index: 'asc' }
        }
      }
    });

    if (!presentation) {
      return res.status(404).json({ error: 'Presentation not found' });
    }

    // Format response to match FastAPI PresentationWithSlides format
    const presentationWithSlides = {
      id: presentation.id,
      content: presentation.content,
      n_slides: presentation.nSlides,
      language: presentation.language,
      title: presentation.title,
      created_at: presentation.createdAt,
      updated_at: presentation.updatedAt,
      tone: presentation.tone,
      verbosity: presentation.verbosity,
      slides: presentation.slides.map(slide => ({
        id: slide.id,
        presentation: slide.presentation,
        layout_group: slide.layoutGroup,
        layout: slide.layout,
        index: slide.index,
        speaker_note: slide.speakerNote,
        content: slide.content,
        html_content: slide.htmlContent,
        properties: slide.properties
      }))
    };
    
    // Return presentation with slides (matching FastAPI PresentationWithSlides)
    res.json(presentationWithSlides);
  } catch (error) {
    console.error('Error getting presentation:', error);
    res.status(500).json({ error: error.message });
  }
};

export const updatePresentation = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const dataFilePath = getDataFilePath(id);

    if (!fs.existsSync(dataFilePath)) {
      return res.status(404).json({ error: 'Presentation not found' });
    }

    const presentation = JSON.parse(fs.readFileSync(dataFilePath, 'utf-8'));
    
    // Update presentation data
    const updatedPresentation = {
      ...presentation,
      ...updates,
      id, // Ensure ID can't be changed
      updatedAt: new Date().toISOString()
    };

    // Save updated data
    fs.writeFileSync(dataFilePath, JSON.stringify(updatedPresentation, null, 2));

    // Regenerate PPTX if slides or theme changed
    if (updates.slides || updates.theme) {
      const presentationDir = getPresentationDir(id);
      // Remove old PPTX files
      fs.readdirSync(presentationDir)
        .filter(f => f.endsWith('.pptx'))
        .forEach(f => fs.unlinkSync(path.join(presentationDir, f)));
      
      // Generate new PPTX
      const pptxPath = await createPPTX(updatedPresentation, presentationDir);
      updatedPresentation.pptxPath = `/presentations/${id}/${path.basename(pptxPath)}`;
    }

    res.json(updatedPresentation);
  } catch (error) {
    console.error('Error updating presentation:', error);
    res.status(500).json({ error: error.message });
  }
};

export const listPresentations = async (req, res) => {
  try {
    if (!fs.existsSync(storagePath)) {
      return res.json([]);
    }

    const presentations = [];
    const dirs = fs.readdirSync(storagePath);

    for (const dir of dirs) {
      const dataFilePath = path.join(storagePath, dir, 'data.json');
      if (fs.existsSync(dataFilePath)) {
        try {
          const data = JSON.parse(fs.readFileSync(dataFilePath, 'utf-8'));
          presentations.push({
            id: data.id,
            topic: data.topic,
            slidesCount: data.slides?.length || 0,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt
          });
        } catch (e) {
          // Skip invalid presentations
        }
      }
    }

    // Sort by creation date (newest first)
    presentations.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(presentations);
  } catch (error) {
    console.error('Error listing presentations:', error);
    res.status(500).json({ error: error.message });
  }
};

export const deletePresentation = async (req, res) => {
  try {
    const { id } = req.params;
    const presentationDir = getPresentationDir(id);

    if (!fs.existsSync(presentationDir)) {
      return res.status(404).json({ error: 'Presentation not found' });
    }

    // Recursively delete directory
    fs.rmSync(presentationDir, { recursive: true, force: true });

    res.json({ success: true, message: 'Presentation deleted' });
  } catch (error) {
    console.error('Error deleting presentation:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Convert presentation to PPTX model
 * GET /api/presentations/pptx-model?id={presentation_id}
 * Matches FastAPI's Next.js service: presentation_to_pptx_model
 */
export const getPresentationToPptxModel = async (req, res) => {
  try {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ error: 'Presentation ID is required' });
    }

    const pptxModel = await presentationToPptxModel(id);
    res.json(pptxModel);
  } catch (error) {
    console.error('Error converting presentation to PPTX model:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Export presentation as PPTX or PDF
 * GET /api/presentations/:id/export?format=pptx
 * Matches FastAPI export_presentation_as_pptx_or_pdf() exactly
 */
export const exportPresentation = async (req, res) => {
  try {
    const { id } = req.params;
    const { format = 'pptx' } = req.query;

    // Get presentation from database
    const presentation = await prisma.presentation.findUnique({
      where: { id }
    });

    if (!presentation) {
      return res.status(404).json({ error: 'Presentation not found' });
    }

    // Use new export flow (matches FastAPI)
    const { exportPresentation: exportPresentationUtil } = await import('../utils/exportUtils.js');
    const result = await exportPresentationUtil(
      id,
      presentation.title || id,
      format
    );

    // Send file
    res.download(result.path);
  } catch (error) {
    console.error('Error exporting presentation:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Create presentation record
 * POST /api/presentations/create
 * Matches FastAPI create_presentation() exactly
 */
export const createPresentation = async (req, res) => {
  try {
    const {
      content,
      n_slides,
      language,
      file_paths = null,
      tone = 'default',
      verbosity = 'standard',
      instructions = null,
      include_table_of_contents = false,
      include_title_slide = true,
      web_search = false
    } = req.body;

    if (include_table_of_contents && n_slides < 3) {
      return res.status(400).json({
        error: 'Number of slides cannot be less than 3 if table of contents is included'
      });
    }

    const presentationId = uuidv4();

    const presentation = await prisma.presentation.create({
      data: {
        id: presentationId,
        content,
        nSlides: n_slides,
        language,
        filePaths: file_paths,
        tone,
        verbosity,
        instructions,
        includeTableOfContents: include_table_of_contents,
        includeTitleSlide: include_title_slide,
        webSearch: web_search
      }
    });

    return res.json(presentation);
  } catch (error) {
    console.error('Error creating presentation:', error);
    return res.status(500).json({ error: error.message });
  }
};

/**
 * Stream presentation outlines
 * GET /api/presentations/outlines/stream/:id
 * Matches FastAPI stream_outlines() exactly
 */
export const streamOutlines = async (req, res) => {
  try {
    const { id } = req.params;

    const presentation = await prisma.presentation.findUnique({
      where: { id }
    });

    if (!presentation) {
      return res.status(404).json({ error: 'Presentation not found' });
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
      // Send initial status
      res.write(new SSEStatusResponse('Generating presentation outlines...').toString());

      // Calculate slides to generate (accounting for TOC)
      let nSlidesToGenerate = presentation.nSlides;
      if (presentation.includeTableOfContents) {
        const neededTocCount = Math.ceil(
          (presentation.nSlides - (presentation.includeTitleSlide ? 1 : 0)) / 10
        );
        nSlidesToGenerate -= Math.ceil(
          (presentation.nSlides - neededTocCount) / 10
        );
      }

      let presentationOutlinesText = '';

      // Stream outline generation
      for await (const chunk of generatePresentationOutline(
        presentation.content,
        nSlidesToGenerate,
        presentation.language,
        null, // additional_context - would come from file_paths if implemented
        presentation.tone,
        presentation.verbosity,
        presentation.instructions,
        presentation.includeTitleSlide,
        presentation.webSearch
      )) {
        // Yield chunk
        res.write(new SSEResponse(
          'response',
          JSON.stringify({ type: 'chunk', chunk })
        ).toString());

        presentationOutlinesText += chunk;
      }

      // Parse the accumulated text
      let presentationOutlines;
      try {
        const outlinesJson = parseDirtyJSON(presentationOutlinesText);
        presentationOutlines = {
          slides: outlinesJson.slides.slice(0, nSlidesToGenerate)
        };
      } catch (parseError) {
        console.error('Failed to parse outlines:', parseError);
        res.write(new SSEErrorResponse(
          'Failed to generate presentation outlines. Please try again.'
        ).toString());
        res.end();
        return;
      }

      // Update presentation with outlines and title
      const title = getPresentationTitleFromOutlines(presentationOutlines);
      await prisma.presentation.update({
        where: { id },
        data: {
          outlines: presentationOutlines,
          title
        }
      });

      // Send complete response
      const updatedPresentation = await prisma.presentation.findUnique({
        where: { id }
      });

      res.write(new SSECompleteResponse(
        'presentation',
        updatedPresentation
      ).toString());

      res.end();
    } catch (error) {
      console.error('Error streaming outlines:', error);
      res.write(new SSEErrorResponse(error.message).toString());
      res.end();
    }
  } catch (error) {
    console.error('Error in streamOutlines:', error);
    return res.status(500).json({ error: error.message });
  }
};

/**
 * Prepare presentation with outlines and template
 * POST /api/presentations/prepare
 * Matches FastAPI prepare_presentation() exactly
 * 
 * Accepts either:
 * - template: template name/ID (string) - will fetch layout from database
 * - layout: full layout object (for backward compatibility)
 */
export const preparePresentation = async (req, res) => {
  try {
    const {
      presentation_id,
      outlines,
      template, // Template name/ID (new way)
      layout,   // Full layout object (backward compatibility)
      title = null
    } = req.body;

    if (!outlines || outlines.length === 0) {
      return res.status(400).json({ error: 'Outlines are required' });
    }

    const presentation = await prisma.presentation.findUnique({
      where: { id: presentation_id }
    });

    if (!presentation) {
      return res.status(404).json({ error: 'Presentation not found' });
    }

    // Fetch layout if template name/ID is provided
    let presentationLayout;
    let templateId = null;
    
    if (template) {
      try {
        presentationLayout = await getLayoutByName(template);
        
        // Extract template ID if it's a custom template
        if (template.startsWith('custom-')) {
          templateId = template.replace('custom-', '');
        } else if (presentationLayout.name && presentationLayout.name.startsWith('custom-')) {
          templateId = presentationLayout.name.replace('custom-', '');
        } else {
          // Try to find template by name
          const templateRecord = await prisma.templateMetadata.findFirst({
            where: {
              name: { equals: template, mode: 'insensitive' }
            }
          });
          if (templateRecord) {
            templateId = templateRecord.id;
          }
        }
      } catch (error) {
        return res.status(400).json({ 
          error: `Failed to fetch template: ${error.message}` 
        });
      }
    } else if (layout) {
      // Use provided layout object (backward compatibility)
      presentationLayout = layout;
      
      // Extract template ID from layout name if it has custom- prefix
      if (layout.name && layout.name.startsWith('custom-')) {
        templateId = layout.name.replace('custom-', '');
      }
    } else {
      return res.status(400).json({ 
        error: 'Either "template" (template name/ID) or "layout" (layout object) must be provided' 
      });
    }
    
    // Ensure layout name includes custom- prefix for custom templates
    if (templateId && !presentationLayout.name.startsWith('custom-')) {
      presentationLayout.name = `custom-${templateId}`;
    }

    const presentationOutlineModel = {
      slides: outlines
    };

    const totalSlideLayouts = presentationLayout.slides.length;
    const totalOutlines = outlines.length;

    let presentationStructure;

    if (presentationLayout.ordered) {
      // If ordered, use sequential layout indices
      presentationStructure = {
        slides: presentationLayout.slides.map((_, index) => index).slice(0, totalOutlines)
      };
    } else {
      // Generate structure using AI
      presentationStructure = await generatePresentationStructure(
        presentationOutlineModel,
        presentationLayout,
        presentation.instructions
      );
    }

    // Ensure structure matches outline count
    presentationStructure.slides = presentationStructure.slides.slice(0, totalOutlines);
    
    // Validate and fix layout indices
    for (let index = 0; index < totalOutlines; index++) {
      const randomSlideIndex = Math.floor(Math.random() * totalSlideLayouts);
      if (index >= totalOutlines) {
        presentationStructure.slides.push(randomSlideIndex);
        continue;
      }
      if (presentationStructure.slides[index] >= totalSlideLayouts) {
        presentationStructure.slides[index] = randomSlideIndex;
      }
    }

    // Handle table of contents if needed
    if (presentation.includeTableOfContents) {
      const nTocSlides = presentation.nSlides - totalOutlines;
      const tocSlideLayoutIndex = selectTocOrListSlideLayoutIndex(presentationLayout);
      
      if (tocSlideLayoutIndex !== -1) {
        const outlineIndex = presentation.includeTitleSlide ? 1 : 0;
        const newOutlines = [...outlines];
        const newStructureSlides = [...presentationStructure.slides];

        for (let i = 0; i < nTocSlides; i++) {
          const outlinesTo = Math.min(outlineIndex + 10, totalOutlines);
          const insertIndex = i + (presentation.includeTitleSlide ? 1 : 0);

          newStructureSlides.splice(insertIndex, 0, tocSlideLayoutIndex);

          let tocOutline = 'Table of Contents\n\n';
          for (let j = outlineIndex; j < outlinesTo; j++) {
            const pageNumber = outlineIndex - i + nTocSlides + (presentation.includeTitleSlide ? 1 : 0);
            tocOutline += `Slide page number: ${pageNumber}\n Slide Content: ${outlines[j].content.substring(0, 100)}\n\n`;
          }

          newOutlines.splice(insertIndex, 0, { content: tocOutline });
        }

        presentationOutlineModel.slides = newOutlines;
        presentationStructure.slides = newStructureSlides;
      }
    }

    // Update presentation
    const updatedPresentation = await prisma.presentation.update({
      where: { id: presentation_id },
      data: {
        outlines: presentationOutlineModel,
        layout: presentationLayout,
        structure: presentationStructure,
        title: title || presentation.title
      }
    });

    return res.json(updatedPresentation);
  } catch (error) {
    console.error('Error preparing presentation:', error);
    return res.status(500).json({ error: error.message });
  }
};

/**
 * Stream presentation slide generation
 * GET /api/presentations/stream/:id
 * Matches FastAPI stream_presentation() exactly
 */
export const streamPresentation = async (req, res) => {
  try {
    const { id } = req.params;

    const presentation = await prisma.presentation.findUnique({
      where: { id },
      include: { slides: true }
    });

    if (!presentation) {
      return res.status(404).json({ error: 'Presentation not found' });
    }

    if (!presentation.structure) {
      return res.status(400).json({ error: 'Presentation not prepared for stream' });
    }

    if (!presentation.outlines) {
      return res.status(400).json({ error: 'Outlines cannot be empty' });
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
      const structure = presentation.structure;
      const layout = presentation.layout;
      const outline = presentation.outlines;

      const slides = [];

      // Send initial chunk
      res.write(new SSEResponse(
        'response',
        JSON.stringify({ type: 'chunk', chunk: '{ "slides": [ ' })
      ).toString());

      // Process slides one by one (matching FastAPI stream behavior)
      for (let i = 0; i < structure.slides.length; i++) {
        const slideLayoutIndex = structure.slides[i];
        const slideLayout = layout.slides[slideLayoutIndex];

        try {
          const { getSlideContentFromTypeAndOutline } = await import('../services/slideContent.service.js');
          
          const slideContent = await getSlideContentFromTypeAndOutline(
            slideLayout,
            outline.slides[i],
            presentation.language,
            presentation.tone,
            presentation.verbosity,
            presentation.instructions
          );

          // Create slide matching FastAPI SlideModel format exactly
          const slide = {
            id: uuidv4(),
            presentation: id,
            layout_group: layout.name, // Layout name should already include custom- prefix
            layout: slideLayout.id,
            index: i,
            speaker_note: slideContent.__speaker_note__ || '',
            content: slideContent,
            html_content: null, // Will be set below
            properties: null
          };

          // Add placeholder assets
          processSlideAddPlaceholderAssets(slide);

          // Generate HTML content for the slide
          try {
            const htmlContent = await generateSlideHtml(slide, slideLayout, layout);
            slide.html_content = htmlContent;
          } catch (htmlError) {
            console.warn(`Error generating HTML for slide ${i}:`, htmlError);
            // Continue without HTML if generation fails
            slide.html_content = null;
          }

          slides.push(slide);

          // Stream the slide - send slide JSON directly as chunk (matching FastAPI slide.model_dump_json())
          // Add comma after each slide except the last one
          const slideJson = JSON.stringify(slide);
          const comma = i < structure.slides.length - 1 ? ',' : '';
          res.write(new SSEResponse(
            'response',
            JSON.stringify({ type: 'chunk', chunk: slideJson + comma })
          ).toString());
        } catch (error) {
          console.error(`Error generating slide ${i}:`, error);
          res.write(new SSEErrorResponse(error.message).toString());
          res.end();
          return;
        }
      }

      // Send closing chunk
      res.write(new SSEResponse(
        'response',
        JSON.stringify({ type: 'chunk', chunk: ' ] }' })
      ).toString());

      // Process assets concurrently (simplified - actual implementation would generate images)
      const assetTasks = slides.map(slide => processSlideAndFetchAssets(slide));
      await Promise.all(assetTasks);

      // Delete old slides
      await prisma.slide.deleteMany({
        where: { presentation: id }
      });

      // Save new slides with HTML content (matching Prisma schema)
      await prisma.slide.createMany({
        data: slides.map(slide => ({
          id: slide.id,
          presentation: slide.presentation,
          layoutGroup: slide.layout_group,
          layout: slide.layout,
          index: slide.index,
          speakerNote: slide.speaker_note,
          content: slide.content,
          htmlContent: slide.html_content || null
        }))
      });

      // Get updated presentation with slides
      const updatedPresentation = await prisma.presentation.findUnique({
        where: { id },
        include: { slides: true }
      });

      // Format response to match FastAPI PresentationWithSlides format
      const presentationWithSlides = {
        id: updatedPresentation.id,
        content: updatedPresentation.content,
        n_slides: updatedPresentation.nSlides,
        language: updatedPresentation.language,
        title: updatedPresentation.title,
        created_at: updatedPresentation.createdAt,
        updated_at: updatedPresentation.updatedAt,
        tone: updatedPresentation.tone,
        verbosity: updatedPresentation.verbosity,
        slides: slides.map(slide => ({
          id: slide.id,
          presentation: slide.presentation,
          layout_group: slide.layout_group,
          layout: slide.layout,
          index: slide.index,
          speaker_note: slide.speaker_note,
          content: slide.content,
          html_content: slide.html_content,
          properties: slide.properties
        }))
      };

      // Send complete response matching FastAPI format
      res.write(new SSECompleteResponse(
        'presentation',
        presentationWithSlides
      ).toString());

      res.end();
    } catch (error) {
      console.error('Error streaming presentation:', error);
      res.write(new SSEErrorResponse(error.message).toString());
      res.end();
    }
  } catch (error) {
    console.error('Error in streamPresentation:', error);
    return res.status(500).json({ error: error.message });
  }
};

