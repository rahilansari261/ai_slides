/**
 * Presentation API utilities following the 4-step flow:
 * 1. Create Presentation
 * 2. Stream Outlines
 * 3. Prepare Presentation
 * 4. Stream Slides
 */

import { API_ENDPOINTS } from './apiConfig';
import { jsonrepair } from 'jsonrepair';
import { PresentationGenerationApi } from './api/presentation-generation';

export interface CreatePresentationRequest {
  content: string;
  n_slides: number;
  language: string;
  tone: string;
  verbosity: string;
  instructions?: string;
  include_title_slide?: boolean;
  include_table_of_contents?: boolean;
  web_search?: boolean;
  file_paths?: string[] | null;
}

export interface Presentation {
  id: string;
  content: string;
  nSlides: number;
  language: string;
  tone: string;
  verbosity: string;
  instructions: string | null;
  includeTableOfContents: boolean;
  includeTitleSlide: boolean;
  webSearch: boolean;
  createdAt: string;
  updatedAt: string;
  outlines?: any;
  layout?: any;
  structure?: {
    slides: number[];
  };
  slides?: any[];
  title?: string;
}

export interface OutlineSlide {
  content: string;
}

export interface Layout {
  name: string;
  ordered: boolean;
  slides: Array<{
    id: string;
    name: string;
    description: string;
    json_schema: any;
  }>;
}

/**
 * Step 1: Create Presentation
 * Uses PresentationGenerationApi service class (matches nextjs pattern)
 */
export async function createPresentation(
  data: CreatePresentationRequest
): Promise<Presentation> {
  return await PresentationGenerationApi.createPresentation({
    content: data.content,
    n_slides: data.n_slides,
    file_paths: data.file_paths || undefined,
    language: data.language,
    tone: data.tone,
    verbosity: data.verbosity,
    instructions: data.instructions || undefined,
    include_table_of_contents: data.include_table_of_contents,
    include_title_slide: data.include_title_slide,
    web_search: data.web_search,
  });
}

/**
 * Step 2: Stream Outlines via SSE
 * Matches nextjs pattern exactly with jsonrepair for incomplete JSON parsing
 */
export interface StreamOutlinesCallbacks {
  onStatus?: (status: string) => void;
  onChunk?: (chunk: string) => void;
  onComplete: (presentation: Presentation) => void;
  onError: (error: string) => void;
}

export function streamOutlines(
  presentationId: string,
  callbacks: StreamOutlinesCallbacks
): EventSource {
  const eventSource = new EventSource(API_ENDPOINTS.presentations.streamOutlines(presentationId));
  let accumulatedChunks = "";

  eventSource.addEventListener('response', (event) => {
    try {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case 'status':
          callbacks.onStatus?.(data.status);
          break;
        case 'chunk':
          accumulatedChunks += data.chunk;
          callbacks.onChunk?.(data.chunk);
          
          // Try to parse accumulated chunks with jsonrepair
          try {
            const repairedJson = jsonrepair(accumulatedChunks);
            const partialData = JSON.parse(repairedJson);

            if (partialData.slides) {
              // Outlines are being streamed, can update UI progressively
              // The complete event will have the final presentation
            }
          } catch (error) {
            // JSON isn't complete yet, continue accumulating
          }
          break;
        case 'complete':
          try {
            // Final presentation with outlines
            const outlinesData = data.presentation.outlines?.slides || data.presentation.outlines || [];
            callbacks.onComplete(data.presentation);
            eventSource.close();
          } catch (error) {
            console.error("Error parsing complete presentation:", error);
            callbacks.onError('Failed to parse presentation data');
            eventSource.close();
          }
          accumulatedChunks = "";
          break;
        case 'closing':
          // Handle closing event (matches nextjs pattern)
          callbacks.onComplete(data.presentation || {});
          eventSource.close();
          accumulatedChunks = "";
          break;
        case 'error':
          eventSource.close();
          callbacks.onError(data.detail || 'Failed to generate outlines');
          accumulatedChunks = "";
          break;
        default:
          console.warn('Unknown event type:', data.type);
      }
    } catch (error) {
      console.error('Error parsing SSE data:', error);
      eventSource.close();
      callbacks.onError('Failed to parse server response');
    }
  });

  eventSource.onerror = (error) => {
    console.error('SSE connection error:', error);
    eventSource.close();
    callbacks.onError('Failed to connect to the server. Please try again.');
  };

  return eventSource;
}

/**
 * Step 3: Prepare Presentation with template
 * The backend will fetch the layout based on the template name/ID
 * Uses PresentationGenerationApi service class (matches nextjs pattern)
 */
export interface PreparePresentationRequest {
  presentation_id: string;
  outlines: OutlineSlide[];
  template?: string; // Template name/ID - backend will fetch the layout
  layout?: Layout; // Optional: Full layout object (for backward compatibility)
  title?: string;
}

export async function preparePresentation(
  data: PreparePresentationRequest
): Promise<Presentation> {
  return await PresentationGenerationApi.presentationPrepare({
    presentation_id: data.presentation_id,
    outlines: data.outlines,
    template: data.template,
    layout: data.layout,
    title: data.title,
  });
}

/**
 * Step 4: Stream Slide Generation via SSE
 * Matches nextjs pattern exactly with jsonrepair for incomplete JSON parsing
 */
export interface StreamSlidesCallbacks {
  onSlide?: (slide: any) => void;
  onComplete: (presentation: Presentation) => void;
  onError: (error: string) => void;
}

export function streamSlides(
  presentationId: string,
  callbacks: StreamSlidesCallbacks
): EventSource {
  const eventSource = new EventSource(API_ENDPOINTS.presentations.stream(presentationId));
  let accumulatedChunks = "";
  const previousSlidesLength = { current: 0 };

  eventSource.addEventListener('response', (event) => {
    try {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case 'chunk':
          accumulatedChunks += data.chunk;
          
          // Try to parse accumulated chunks with jsonrepair
          try {
            const repairedJson = jsonrepair(accumulatedChunks);
            const partialData = JSON.parse(repairedJson);

            if (partialData.slides) {
              // Only dispatch if slides length changed (matches nextjs pattern)
              if (
                partialData.slides.length !== previousSlidesLength.current &&
                partialData.slides.length > 0
              ) {
                // Call onSlide for each new slide
                const newSlides = partialData.slides.slice(previousSlidesLength.current);
                newSlides.forEach((slide: any) => {
                  callbacks.onSlide?.(slide);
                });
                previousSlidesLength.current = partialData.slides.length;
              }
            }
          } catch (error) {
            // JSON isn't complete yet, continue accumulating
          }
          break;
        case 'complete':
          try {
            callbacks.onComplete(data.presentation);
            eventSource.close();
          } catch (error) {
            console.error("Error parsing complete presentation:", error);
            eventSource.close();
          }
          accumulatedChunks = "";
          break;
        case 'closing':
          // Handle closing event (matches nextjs pattern)
          callbacks.onComplete(data.presentation || {});
          eventSource.close();
          accumulatedChunks = "";
          break;
        case 'error':
          eventSource.close();
          callbacks.onError(data.detail || 'Failed to generate slides');
          accumulatedChunks = "";
          break;
        default:
          console.warn('Unknown event type:', data.type);
      }
    } catch (error) {
      console.error('Error parsing SSE data:', error);
      eventSource.close();
      callbacks.onError('Failed to parse server response');
    }
  });

  eventSource.onerror = (error) => {
    console.error('EventSource failed:', error);
    eventSource.close();
    callbacks.onError('Failed to connect to the server. Please try again.');
  };

  return eventSource;
}

/**
 * Complete flow: Generate presentation following all 4 steps
 */
export interface GeneratePresentationOptions {
  topic: string;
  numSlides: number;
  language: string;
  tone: string;
  verbosity: string;
  instructions?: string;
  includeTitleSlide?: boolean;
  includeTableOfContents?: boolean;
  webSearch?: boolean;
  templateName: string;
  onProgress?: (step: number, message: string) => void;
}

export async function generatePresentation(
  options: GeneratePresentationOptions,
  callbacks: {
    onSlide?: (slide: any) => void;
    onComplete: (presentation: Presentation) => void;
    onError: (error: string) => void;
  }
): Promise<void> {
  try {
    // Step 1: Create presentation
    options.onProgress?.(1, 'Creating presentation...');
    const presentation = await createPresentation({
      content: options.topic,
      n_slides: options.numSlides,
      language: options.language || 'English',
      tone: options.tone || 'professional',
      verbosity: options.verbosity || 'standard',
      instructions: options.instructions || '',
      include_title_slide: options.includeTitleSlide !== false,
      include_table_of_contents: options.includeTableOfContents || false,
      web_search: options.webSearch || false,
      file_paths: null,
    });

    const presentationId = presentation.id;

    // Step 2: Stream outlines
    options.onProgress?.(2, 'Generating outlines...');
    let outlineChunks = '';
    let presentationWithOutlines: Presentation | null = null;
    await new Promise<void>((resolve, reject) => {
      const eventSource = streamOutlines(
        presentationId,
        {
          onStatus: (status) => {
            options.onProgress?.(2, `Generating outlines: ${status}`);
          },
          onChunk: (chunk) => {
            outlineChunks += chunk;
            // Update UI with streaming progress
          },
          onComplete: (updatedPresentation) => {
            // Presentation now has outlines
            presentationWithOutlines = updatedPresentation;
            resolve();
          },
          onError: (error) => {
            reject(new Error(error));
          },
        }
      );

      // Store eventSource for cleanup if needed
      (callbacks as any)._outlineEventSource = eventSource;
    });

    // Step 3: Prepare with template
    options.onProgress?.(3, 'Preparing presentation with template...');
    
    // Use the presentation from streamOutlines, or fetch it if not available
    if (!presentationWithOutlines) {
      presentationWithOutlines = await fetch(API_ENDPOINTS.presentations.get(presentationId)).then(
        (res) => res.json()
      );
    }

    // Extract outlines - handle both object format and array format
    // The outlines can be in format: { slides: [...] } or just [...]
    let outlinesArray: OutlineSlide[] = [];
    if (presentationWithOutlines.outlines) {
      if (Array.isArray(presentationWithOutlines.outlines)) {
        outlinesArray = presentationWithOutlines.outlines;
      } else if (presentationWithOutlines.outlines.slides) {
        outlinesArray = presentationWithOutlines.outlines.slides;
      }
    }

    // Step 3: Prepare with template
    // Backend accepts template as:
    // - Default templates: "general", "modern", "standard", "swift"
    // - Template ID (UUID): Direct UUID from TemplateMetadata table
    // - Template name: Name from TemplateMetadata table (case-insensitive)
    // - With prefix: "custom-{templateId}" format also works
    // Backend will fetch the layout automatically
    const preparedPresentation = await preparePresentation({
      presentation_id: presentationId,
      outlines: outlinesArray,
      template: options.templateName, // Backend will fetch the layout based on template name/ID
      title: options.topic,
    });

    // Step 4: Stream slide generation
    options.onProgress?.(4, 'Generating slides...');
    await new Promise<void>((resolve, reject) => {
      const eventSource = streamSlides(presentationId, {
        onSlide: (slide) => {
          callbacks.onSlide?.(slide);
          options.onProgress?.(4, `Generated slide ${slide.id || 'unknown'}`);
        },
        onComplete: (finalPresentation) => {
          callbacks.onComplete(finalPresentation);
          resolve();
        },
        onError: (error) => {
          reject(new Error(error));
        },
      });

      // Store eventSource for cleanup if needed
      (callbacks as any)._slideEventSource = eventSource;
    });
  } catch (error: any) {
    callbacks.onError(error.message || 'Failed to generate presentation');
  }
}

