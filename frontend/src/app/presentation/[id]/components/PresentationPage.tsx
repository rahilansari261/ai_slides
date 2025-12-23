"use client";
import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/store/store";
import { AlertCircle, Loader2 } from "lucide-react";
import {
  usePresentationStreaming,
  usePresentationData,
  usePresentationNavigation,
  useAutoSave,
} from "../hooks";
import { PresentationPageProps } from "../types";
import LoadingState from "./LoadingState";
import SlideContent from "./SlideContent";

const PresentationPage: React.FC<PresentationPageProps> = ({
  presentation_id,
}) => {
  // State management
  const [loading, setLoading] = useState(true);
  const [selectedSlide, setSelectedSlide] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState(false);
  const [isMobilePanelOpen, setIsMobilePanelOpen] = useState(false);

  const { presentationData, isStreaming } = useSelector(
    (state: RootState) => state.presentationGeneration
  );

  // Auto-save functionality
  const { isSaving } = useAutoSave({
    debounceMs: 2000,
    enabled: !!presentationData && !isStreaming,
  });

  // Custom hooks
  const { fetchUserSlides } = usePresentationData(
    presentation_id,
    setLoading,
    setError
  );

  const {
    isPresentMode,
    stream,
    handleSlideClick,
    toggleFullscreen,
    handlePresentExit,
    handleSlideChange,
  } = usePresentationNavigation(
    presentation_id,
    selectedSlide,
    setSelectedSlide,
    setIsFullscreen
  );

  // Initialize streaming
  usePresentationStreaming(
    presentation_id,
    stream,
    setLoading,
    setError,
    fetchUserSlides
  );

  const onSlideChange = (newSlide: number) => {
    handleSlideChange(newSlide, presentationData);
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
        <div
          className="bg-white border border-red-300 text-red-700 px-6 py-8 rounded-lg shadow-lg flex flex-col items-center"
          role="alert"
        >
          <AlertCircle className="w-16 h-16 mb-4 text-red-500" />
          <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
          <p className="text-center mb-4">
            We couldn't load your presentation. Please try again.
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex overflow-hidden flex-col">
      <div className="fixed right-6 top-[5.2rem] z-50">
        {isSaving && <Loader2 className="w-6 h-6 animate-spin text-blue-500" />}
      </div>

      {/* Simple Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
        <h1 className="text-xl font-semibold">
          {presentationData?.title || "Presentation"}
        </h1>
        <div className="flex items-center gap-2">
          {presentationData?.slides && (
            <span className="text-sm text-gray-600">
              {presentationData.slides.length} slides
            </span>
          )}
        </div>
      </header>

      <div
        style={{
          background: "#c8c7c9",
        }}
        className="flex flex-1 relative pt-6"
      >
        <div className="flex-1 h-[calc(100vh-100px)] overflow-y-auto">
          <div
            id="presentation-slides-wrapper"
            className="mx-auto flex flex-col items-center overflow-hidden justify-center p-2 sm:p-6 pt-0"
          >
            {!presentationData ||
            loading ||
            !presentationData?.slides ||
            presentationData?.slides.length === 0 ? (
              <div className="relative w-full h-[calc(100vh-120px)] mx-auto">
                <div className="">
                  {Array.from({ length: 2 }).map((_, index) => (
                    <div
                      key={index}
                      className="aspect-video bg-gray-400 my-4 w-full mx-auto max-w-[1280px] rounded-lg animate-pulse"
                    />
                  ))}
                </div>
                {stream && <LoadingState />}
              </div>
            ) : (
              <>
                {presentationData &&
                  presentationData.slides &&
                  presentationData.slides.length > 0 &&
                  presentationData.slides.map((slide: any, index: number) => (
                    <SlideContent
                      key={`${slide.type}-${index}-${slide.index}`}
                      slide={slide}
                      index={index}
                      presentationId={presentation_id}
                    />
                  ))}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PresentationPage;

