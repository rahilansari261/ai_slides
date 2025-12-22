/**
 * Export Utilities
 * Matches FastAPI utils/export_utils.py
 */

import { presentationToPptxModel } from '../services/presentationToPptxModel.service.js';
import { PptxPresentationCreator } from '../services/pptxPresentationCreator.service.js';
import { PptxPresentationModel } from '../models/pptxModels.js';
import { getTemporaryDirectory } from './storage.js';
import path from 'path';
import fs from 'fs';

/**
 * Get exports directory
 */
function getExportsDirectory() {
  const exportsDir = process.env.EXPORTS_DIR || path.join(process.cwd(), 'exports');
  if (!fs.existsSync(exportsDir)) {
    fs.mkdirSync(exportsDir, { recursive: true });
  }
  return exportsDir;
}

/**
 * Sanitize filename
 */
function sanitizeFilename(filename) {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .substring(0, 100);
}

/**
 * Export presentation to PPTX
 * Matches FastAPI export_presentation()
 */
export async function exportPresentation(presentationId, title, exportAs = 'pptx') {
  if (exportAs === 'pptx') {
    // Get the converted PPTX model from presentation
    const pptxModelData = await presentationToPptxModel(presentationId);
    
    // Create PPTX file using the converted model
    // pptxModelData is already a plain object, use it directly
    const tempDir = getTemporaryDirectory();
    const pptxCreator = new PptxPresentationCreator(pptxModelData, tempDir);
    await pptxCreator.createPpt();
    
    const exportDirectory = getExportsDirectory();
    const sanitizedTitle = sanitizeFilename(title || presentationId);
    const pptxPath = path.join(exportDirectory, `${sanitizedTitle}.pptx`);
    
    await pptxCreator.save(pptxPath);
    
    return {
      presentation_id: presentationId,
      path: pptxPath
    };
  } else if (exportAs === 'pdf') {
    // PDF export would require additional conversion
    // For now, throw error or implement PDF conversion
    throw new Error('PDF export not yet implemented');
  } else {
    throw new Error(`Unsupported export format: ${exportAs}`);
  }
}

