/**
 * Convert Presentation Slides to PPTX Model
 * Matches FastAPI's Next.js service: presentation_to_pptx_model
 * 
 * This service converts presentation slides with content + template layouts
 * into a PPTX model structure that can be used to create PPTX files.
 */

import prisma from '../config/prisma.js';
import { getLayoutByName } from './templateRetrieval.service.js';
import {
  PptxPresentationModel,
  PptxSlideModel,
  PptxTextBoxModel,
  PptxAutoShapeBoxModel,
  PptxPictureBoxModel,
  PptxPositionModel,
  PptxFillModel,
  PptxFontModel,
  PptxParagraphModel,
  PptxTextRunModel,
  PptxPictureModel,
  PptxSpacingModel
} from '../models/pptxModels.js';
import { parseHtmlTextToTextRuns } from './htmlToTextRuns.service.js';

/**
 * Convert slide content JSON to text paragraphs
 */
function contentToParagraphs(content, baseFont = null) {
  const paragraphs = [];
  
  if (typeof content === 'string') {
    // If content is a string, parse as HTML
    const textRuns = parseHtmlTextToTextRuns(content, baseFont);
    paragraphs.push(new PptxParagraphModel({
      text_runs: textRuns,
      font: baseFont
    }));
  } else if (typeof content === 'object') {
    // If content is an object, extract text fields
    for (const [key, value] of Object.entries(content)) {
      // Skip internal fields
      if (key.startsWith('__')) continue;
      
      if (typeof value === 'string' && value.trim()) {
        const textRuns = parseHtmlTextToTextRuns(value, baseFont);
        paragraphs.push(new PptxParagraphModel({
          text_runs: textRuns,
          font: baseFont
        }));
      } else if (Array.isArray(value)) {
        // Handle arrays (e.g., bullet points)
        value.forEach(item => {
          if (typeof item === 'string' && item.trim()) {
            const textRuns = parseHtmlTextToTextRuns(`• ${item}`, baseFont);
            paragraphs.push(new PptxParagraphModel({
              text_runs: textRuns,
              font: baseFont
            }));
          }
        });
      }
    }
  }
  
  return paragraphs;
}

/**
 * Extract image URL from content
 */
function extractImageUrl(content) {
  if (typeof content === 'object') {
    // Look for image URL fields
    for (const [key, value] of Object.entries(content)) {
      if (key.includes('image') && typeof value === 'string' && value.startsWith('http')) {
        return value;
      }
      if (key === '__image_url__') {
        return value;
      }
    }
  }
  return null;
}

/**
 * Convert a single slide to PPTX slide model
 */
function convertSlideToPptxModel(slide, slideLayout, layoutModel) {
  const shapes = [];
  const content = slide.content || {};
  
  // Get base font from template or use default
  const baseFont = new PptxFontModel({
    name: 'Inter',
    size: 16,
    color: '000000'
  });
  
  // Extract title
  const title = content.title || content.heading || '';
  if (title) {
    const titleFont = new PptxFontModel({
      name: baseFont.name,
      size: 32,
      color: '000000',
      font_weight: 700
    });
    
    shapes.push(new PptxTextBoxModel({
      position: new PptxPositionModel({
        left: 100,
        top: 100,
        width: 1000,
        height: 80
      }),
      fill: null,
      text_wrap: true,
      paragraphs: [
        new PptxParagraphModel({
          text_runs: parseHtmlTextToTextRuns(title, titleFont),
          font: titleFont
        })
      ]
    }));
  }
  
  // Extract main content
  const mainContent = content.content || content.description || content.body || '';
  if (mainContent) {
    const contentY = title ? 200 : 100;
    shapes.push(new PptxTextBoxModel({
      position: new PptxPositionModel({
        left: 100,
        top: contentY,
        width: 1000,
        height: 400
      }),
      fill: null,
      text_wrap: true,
      paragraphs: contentToParagraphs(mainContent, baseFont)
    }));
  }
  
  // Extract image if present
  const imageUrl = extractImageUrl(content);
  if (imageUrl) {
    shapes.push(new PptxPictureBoxModel({
      position: new PptxPositionModel({
        left: 1200,
        top: 100,
        width: 500,
        height: 500
      }),
      clip: true,
      picture: new PptxPictureModel({
        is_network: imageUrl.startsWith('http'),
        path: imageUrl
      })
    }));
  }
  
  // Extract subtitle if present
  const subtitle = content.subtitle || content.subheading || '';
  if (subtitle) {
    const subtitleFont = new PptxFontModel({
      name: baseFont.name,
      size: 20,
      color: '666666'
    });
    
    shapes.push(new PptxTextBoxModel({
      position: new PptxPositionModel({
        left: 100,
        top: 50,
        width: 1000,
        height: 50
      }),
      fill: null,
      text_wrap: true,
      paragraphs: [
        new PptxParagraphModel({
          text_runs: parseHtmlTextToTextRuns(subtitle, subtitleFont),
          font: subtitleFont
        })
      ]
    }));
  }
  
  // Create slide model
  const slideModel = new PptxSlideModel({
    background: new PptxFillModel({
      color: 'FFFFFF',
      opacity: 1.0
    }),
    note: slide.speakerNote || null,
    shapes: shapes
  });
  
  return slideModel;
}

/**
 * Convert presentation to PPTX model
 * Matches FastAPI's Next.js service behavior
 */
export async function presentationToPptxModel(presentationId) {
  try {
    // Get presentation with slides
    const presentation = await prisma.presentation.findUnique({
      where: { id: presentationId },
      include: {
        slides: {
          orderBy: { index: 'asc' }
        }
      }
    });
    
    if (!presentation) {
      throw new Error(`Presentation ${presentationId} not found`);
    }
    
    // Get layout model
    let layoutModel = null;
    if (presentation.layout) {
      // Layout is already stored in presentation
      layoutModel = presentation.layout;
    } else if (presentation.slides && presentation.slides.length > 0) {
      // Get layout from first slide's layoutGroup
      const firstSlide = presentation.slides[0];
      if (firstSlide.layoutGroup) {
        try {
          // Handle custom templates (UUID format) or default template names
          const templateName = firstSlide.layoutGroup.startsWith('custom-')
            ? firstSlide.layoutGroup
            : firstSlide.layoutGroup;
          layoutModel = await getLayoutByName(templateName);
        } catch (error) {
          console.warn(`Could not load layout ${firstSlide.layoutGroup}: ${error.message}`);
        }
      }
    }
    
    // Convert each slide to PPTX model
    const slideModels = [];
    for (const slide of presentation.slides) {
      // Get slide layout from layout model
      let slideLayout = null;
      if (layoutModel && layoutModel.slides) {
        // Find layout by ID
        slideLayout = layoutModel.slides.find(l => l.id === slide.layout);
        if (!slideLayout) {
          // Fallback to index
          slideLayout = layoutModel.slides[slide.index % layoutModel.slides.length];
        }
      }
      
      // Use HTML content if available for better shape extraction
      // For now, we'll use the content-based approach, but HTML can be used for future enhancements
      const pptxSlide = convertSlideToPptxModel(slide, slideLayout, layoutModel);
      slideModels.push(pptxSlide);
    }
    
    // Create presentation model
    const pptxModel = {
      name: presentation.title || 'Presentation',
      shapes: null, // Global shapes (not used in current implementation)
      slides: slideModels.map(slide => ({
        background: slide.background ? {
          color: slide.background.color,
          opacity: slide.background.opacity
        } : null,
        note: slide.note,
        shapes: slide.shapes.map(shape => {
          // Convert shape to plain object
          const shapeObj = { ...shape };
          if (shape.position) {
            shapeObj.position = {
              left: shape.position.left,
              top: shape.position.top,
              width: shape.position.width,
              height: shape.position.height
            };
          }
          if (shape.picture) {
            shapeObj.picture = {
              is_network: shape.picture.is_network,
              path: shape.picture.path
            };
          }
          if (shape.paragraphs) {
            shapeObj.paragraphs = shape.paragraphs.map(p => ({
              spacing: p.spacing ? { ...p.spacing } : null,
              alignment: p.alignment,
              font: p.font ? { ...p.font } : null,
              line_height: p.line_height,
              text: p.text,
              text_runs: p.text_runs ? p.text_runs.map(r => ({
                text: r.text,
                font: r.font ? { ...r.font } : null
              })) : null
            }));
          }
          return shapeObj;
        })
      }))
    };
    
    return pptxModel;
    
  } catch (error) {
    console.error('Error converting presentation to PPTX model:', error);
    throw new Error(`Failed to convert presentation to PPTX model: ${error.message}`);
  }
}

