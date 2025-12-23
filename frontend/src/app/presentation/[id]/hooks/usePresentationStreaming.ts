import { useEffect, useRef } from "react";
import { useDispatch } from "react-redux";
import {
  clearPresentationData,
  setPresentationData,
  setStreaming,
} from "@/store/slices/presentationGeneration";
import { jsonrepair } from "jsonrepair";
import { toast } from "sonner";
import { API_ENDPOINTS } from "@/lib/apiConfig";

export const usePresentationStreaming = (
  presentationId: string,
  stream: string | null,
  setLoading: (loading: boolean) => void,
  setError: (error: boolean) => void,
  fetchUserSlides: () => void
) => {
  const dispatch = useDispatch();
  const previousSlidesLength = useRef(0);

  useEffect(() => {
    let eventSource: EventSource;
    let accumulatedChunks = "";

    const initializeStream = async () => {
      dispatch(setStreaming(true));
      dispatch(clearPresentationData());

      // Use the API endpoint from config
      const streamUrl = API_ENDPOINTS.presentations.stream(presentationId);
      console.log('🔗 Connecting to stream:', streamUrl);
      eventSource = new EventSource(streamUrl);

      eventSource.addEventListener("response", (event) => {
        let data;
        try {
          data = JSON.parse(event.data);
          console.log('📨 Received SSE data:', data.type, data);
        } catch (parseError) {
          console.error('❌ Error parsing SSE event data:', parseError, 'Raw data:', event.data);
          return;
        }

        switch (data.type) {
          case "chunk":
            accumulatedChunks += data.chunk;
            console.log('📦 Accumulated chunks length:', accumulatedChunks.length);
            try {
              const repairedJson = jsonrepair(accumulatedChunks);
              const partialData = JSON.parse(repairedJson);

              if (partialData.slides && Array.isArray(partialData.slides)) {
                console.log('✅ Parsed slides:', partialData.slides.length, 'Previous:', previousSlidesLength.current);
                if (
                  partialData.slides.length !== previousSlidesLength.current &&
                  partialData.slides.length > 0
                ) {
                  console.log('🔄 Updating presentation data with', partialData.slides.length, 'slides');
                  // Ensure we have a valid presentation structure
                  const currentData = {
                    id: presentationId,
                    language: 'English',
                    layout: { name: '', ordered: false, slides: [] },
                    n_slides: partialData.slides.length,
                    title: '',
                    slides: partialData.slides
                  };
                  dispatch(setPresentationData(currentData));
                  previousSlidesLength.current = partialData.slides.length;
                  setLoading(false);
                }
              }
            } catch (error) {
              // JSON isn't complete yet, continue accumulating
              console.log('⏳ JSON not complete yet, continuing to accumulate...', (error as Error).message);
            }
            break;

          case "complete":
            try {
              console.log('✅ Stream complete, final presentation:', data.presentation);
              // Ensure the presentation data has the correct structure
              const presentation = data.presentation;
              if (presentation && presentation.slides) {
                // Map slides to ensure they have the correct format
                const formattedPresentation = {
                  id: presentation.id,
                  language: presentation.language || 'English',
                  layout: presentation.layout || { name: '', ordered: false, slides: [] },
                  n_slides: presentation.n_slides || presentation.nSlides || presentation.slides.length,
                  title: presentation.title || '',
                  slides: presentation.slides
                };
                console.log('📋 Formatted presentation:', formattedPresentation);
                dispatch(setPresentationData(formattedPresentation));
              } else {
                console.error('❌ Invalid presentation data in complete response:', presentation);
              }
              dispatch(setStreaming(false));
              setLoading(false);
              eventSource.close();

              // Remove stream parameter from URL
              const newUrl = new URL(window.location.href);
              newUrl.searchParams.delete("stream");
              window.history.replaceState({}, "", newUrl.toString());
            } catch (error) {
              eventSource.close();
              console.error("❌ Error parsing complete response:", error);
            }
            accumulatedChunks = "";
            break;

          case "closing":
            try {
              const presentation = data.presentation;
              if (presentation && presentation.slides) {
                const formattedPresentation = {
                  id: presentation.id,
                  language: presentation.language || 'English',
                  layout: presentation.layout || { name: '', ordered: false, slides: [] },
                  n_slides: presentation.n_slides || presentation.nSlides || presentation.slides.length,
                  title: presentation.title || '',
                  slides: presentation.slides
                };
                dispatch(setPresentationData(formattedPresentation));
              } else {
                console.error('❌ Invalid presentation data in closing response:', presentation);
              }
            } catch (error) {
              console.error('❌ Error parsing closing response:', error);
            }
            setLoading(false);
            dispatch(setStreaming(false));
            eventSource.close();

            // Remove stream parameter from URL
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.delete("stream");
            window.history.replaceState({}, "", newUrl.toString());
            break;
          case "error":
            eventSource.close();
            toast.error("Error in outline streaming", {
              description:
                data.detail ||
                "Failed to connect to the server. Please try again.",
            });
            setLoading(false);
            dispatch(setStreaming(false));
            setError(true);
            break;
        }
      });

      eventSource.onerror = (error) => {
        console.error("❌ EventSource failed:", error);
        console.error("EventSource readyState:", eventSource.readyState);
        console.error("EventSource URL:", streamUrl);
        setLoading(false);
        dispatch(setStreaming(false));
        setError(true);
        toast.error("Streaming connection failed", {
          description: "Failed to connect to the server. Please check your connection and try again.",
        });
        eventSource.close();
      };
      
      eventSource.onopen = () => {
        console.log('✅ EventSource connection opened');
      };
    };

    if (stream) {
      initializeStream();
    } else {
      fetchUserSlides();
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [presentationId, stream, dispatch, setLoading, setError, fetchUserSlides]);
};

