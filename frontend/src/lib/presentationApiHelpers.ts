/**
 * Helper functions for presentation generation flow
 * These functions can be used independently for more control over the flow
 * Updated to match nextjs pattern exactly
 */

import { API_ENDPOINTS } from './apiConfig';
import type { Presentation, CreatePresentationRequest, OutlineSlide } from './presentationApi';
import { jsonrepair } from 'jsonrepair';
import { PresentationGenerationApi } from './api/presentation-generation';

/**
 * Step 1: Create Presentation
 * Uses PresentationGenerationApi service class (matches nextjs pattern)
 */
export async function createPresentationStep(
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
 * Step 2: Stream Outlines - Returns a promise that resolves with the presentation containing outlines
 * Matches nextjs pattern exactly with jsonrepair for incomplete JSON parsing
 */
export function streamOutlinesStep(
  presentationId: string,
  callbacks: {
    onStatus?: (status: string) => void;
    onChunk?: (chunk: string) => void;
    onComplete: (presentation: Presentation) => void;
    onError: (error: string) => void;
  }
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
            const presentation = data.presentation;
            callbacks.onComplete(presentation);
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
 * Uses PresentationGenerationApi service class (matches nextjs pattern)
 */
export async function preparePresentationStep(
  presentationId: string,
  outlines: OutlineSlide[],
  templateName: string,
  title?: string
): Promise<Presentation> {
  return await PresentationGenerationApi.presentationPrepare({
    presentation_id: presentationId,
    outlines: outlines,
    template: templateName,
    title: title || undefined,
  });
}

/**
 * Step 4: Stream Slide Generation
 * Matches nextjs pattern exactly with jsonrepair for incomplete JSON parsing
 */
export function streamSlidesStep(
  presentationId: string,
  callbacks: {
    onSlide?: (slide: any) => void;
    onComplete: (presentation: Presentation) => void;
    onError: (error: string) => void;
  }
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
            const finalPresentation = data.presentation;
            callbacks.onComplete(finalPresentation);
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

