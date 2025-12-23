import React, { useEffect, useState, useMemo } from "react";
import { Loader2 } from "lucide-react";
import { useSelector } from "react-redux";
import { RootState } from "@/store/store";
import { SlidePreview } from "@/components/presentation/SlidePreview";

interface SlideContentProps {
  slide: any;
  index: number;
  presentationId: string;
}

const SlideContent = ({ slide, index, presentationId }: SlideContentProps) => {
  const { presentationData, isStreaming } = useSelector(
    (state: RootState) => state.presentationGeneration
  );

  // Scroll to the new slide when streaming and new slides are being generated
  useEffect(() => {
    if (
      presentationData &&
      presentationData?.slides &&
      presentationData.slides.length > 1 &&
      isStreaming
    ) {
      // Scroll to the last slide (newly generated during streaming)
      const lastSlideIndex = presentationData.slides.length - 1;
      const slideElement = document.getElementById(
        `slide-${presentationData.slides[lastSlideIndex].index}`
      );
      if (slideElement) {
        slideElement.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }
  }, [presentationData?.slides?.length, isStreaming]);

  // Convert slide data to format expected by SlidePreview
  const slideForPreview = useMemo(() => {
    // Map the slide data structure to match SlidePreview expectations
    const mappedSlide: any = {
      id: slide.id || `slide-${index}`,
      type: slide.type || 'content',
      title: slide.content?.title || slide.title,
      subtitle: slide.content?.subtitle || slide.subtitle,
      bullets: slide.content?.bullets || slide.bullets || [],
      content: slide.content,
      image: slide.image || slide.imageUrl,
      imageUrl: slide.image || slide.imageUrl,
    };
    return mappedSlide;
  }, [slide, index]);

  return (
    <>
      <div
        id={`slide-${slide.index}`}
        className="w-full max-w-[1280px] main-slide flex items-center max-md:mb-4 justify-center relative"
      >
        {isStreaming && (
          <Loader2 className="w-8 h-8 absolute right-2 top-2 z-30 text-blue-800 animate-spin" />
        )}
        <div
          data-layout={slide.layout}
          data-group={slide.layout_group}
          className="w-full group"
        >
          {/* Render slide using SlidePreview component */}
          <div className="w-full aspect-video bg-white rounded-lg shadow-lg overflow-hidden">
            <SlidePreview slide={slideForPreview} theme={{}} />
          </div>
        </div>
      </div>
    </>
  );
};

export default SlideContent;

