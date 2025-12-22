/**
 * Export API utilities
 * Handles PPTX export following the backend flow:
 * Presentation → PPTX Model → PPTX File
 */

import { API_ENDPOINTS } from './apiConfig';

export interface PptxPresentationModel {
  slides: PptxSlideModel[];
  width: number;
  height: number;
}

export interface PptxSlideModel {
  slideNumber: number;
  textBoxes: PptxTextBoxModel[];
  autoShapeBoxes: PptxAutoShapeBoxModel[];
  pictureBoxes: PptxPictureBoxModel[];
  connectors: PptxConnectorModel[];
}

export interface PptxTextBoxModel {
  position: { x: number; y: number; width: number; height: number };
  textRuns: PptxTextRunModel[];
  alignment?: string;
}

export interface PptxTextRunModel {
  text: string;
  font?: {
    name?: string;
    size?: number;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    color?: string;
  };
}

export interface PptxAutoShapeBoxModel {
  position: { x: number; y: number; width: number; height: number };
  shapeType: string;
  fill?: any;
  line?: any;
}

export interface PptxPictureBoxModel {
  position: { x: number; y: number; width: number; height: number };
  imageUrl: string;
  opacity?: number;
  borderRadius?: number;
}

export interface PptxConnectorModel {
  from: { x: number; y: number };
  to: { x: number; y: number };
  lineStyle?: any;
}

/**
 * Get PPTX Model for a presentation
 * This returns the intermediate PPTX model before file creation
 * Useful for debugging or preview
 */
export async function getPptxModel(presentationId: string): Promise<PptxPresentationModel> {
  const response = await fetch(API_ENDPOINTS.presentations.getPptxModel(presentationId));
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to get PPTX model' }));
    throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Export presentation to PPTX file
 * Follows the flow: Presentation → PPTX Model → PPTX File
 * 
 * @param presentationId - The presentation ID to export
 * @param format - Export format (default: 'pptx')
 * @param filename - Optional custom filename
 * @returns Promise that resolves when download starts
 */
export async function exportPresentation(
  presentationId: string,
  format: string = 'pptx',
  filename?: string
): Promise<void> {
  try {
    const url = API_ENDPOINTS.presentations.export(presentationId, format);
    const response = await fetch(url);
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to export presentation' }));
      throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
    }
    
    // Get filename from Content-Disposition header or use provided/default
    let downloadFilename = filename;
    if (!downloadFilename) {
      const contentDisposition = response.headers.get('Content-Disposition');
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
          downloadFilename = filenameMatch[1].replace(/['"]/g, '');
        }
      }
    }
    
    // Default filename if still not set
    if (!downloadFilename) {
      downloadFilename = `presentation.${format}`;
    }
    
    // Create blob and trigger download
    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = downloadFilename;
    document.body.appendChild(link);
    link.click();
    
    // Cleanup
    window.URL.revokeObjectURL(blobUrl);
    document.body.removeChild(link);
  } catch (error: any) {
    throw new Error(error.message || 'Failed to export presentation');
  }
}

/**
 * Export presentation with loading state callback
 * Useful for showing progress in UI
 */
export async function exportPresentationWithProgress(
  presentationId: string,
  format: string = 'pptx',
  filename?: string,
  onProgress?: (message: string) => void
): Promise<void> {
  try {
    onProgress?.('Preparing export...');
    
    // Optional: Get PPTX model first to validate
    // This can be useful for debugging or showing preview
    // await getPptxModel(presentationId);
    
    onProgress?.('Creating PPTX file...');
    await exportPresentation(presentationId, format, filename);
    
    onProgress?.('Export complete!');
  } catch (error: any) {
    onProgress?.(`Export failed: ${error.message}`);
    throw error;
  }
}

