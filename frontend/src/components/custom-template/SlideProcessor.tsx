'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Loader2, CheckCircle2, Edit, Code, RefreshCw, Save, Trash2, AlertCircle } from 'lucide-react';

interface SlideData {
  slide_number: number;
  screenshot_url: string;
  xml_content: string;
  normalized_fonts: string[];
}

interface ProcessingData {
  success: boolean;
  presentation_id: string;
  slides: SlideData[];
  total_slides: number;
  fonts: {
    internally_supported_fonts: Array<{
      name: string;
      google_fonts_url: string;
    }>;
    not_supported_fonts: string[];
  };
}

interface SlideProcessorProps {
  processingData: ProcessingData;
  onBack: () => void;
}

interface ProcessedSlide extends SlideData {
  html?: string;
  react?: string;
  processing?: boolean;
  completed?: boolean;
  error?: string;
}

export default function SlideProcessor({ processingData, onBack }: SlideProcessorProps) {
  const [slides, setSlides] = useState<ProcessedSlide[]>(processingData.slides);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [converting, setConverting] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [imageErrors, setImageErrors] = useState<Record<number, boolean>>({});
  const [imageLoading, setImageLoading] = useState<Record<number, boolean>>({});

  const currentSlide = slides[currentSlideIndex];
  const completedCount = slides.filter(s => s.completed).length;

  // Preload all slide images on mount
  useEffect(() => {
    if (slides.length > 0) {
      slides.forEach((slide) => {
        if (slide.screenshot_url) {
          const img = new Image();
          img.src = `http://localhost:5002${slide.screenshot_url}`;
          img.onload = () => {
            setImageLoading(prev => {
              const newLoading = { ...prev };
              delete newLoading[slide.slide_number];
              return newLoading;
            });
          };
          img.onerror = () => {
            setImageErrors(prev => ({ ...prev, [slide.slide_number]: true }));
            setImageLoading(prev => {
              const newLoading = { ...prev };
              delete newLoading[slide.slide_number];
              return newLoading;
            });
          };
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  const convertSlideToHTML = async (slideIndex: number) => {
    const slide = slides[slideIndex];
    if (!slide) return;

    setSlides(prev => prev.map((s, i) => 
      i === slideIndex ? { ...s, processing: true, error: undefined } : s
    ));

    try {
      // Convert to HTML
      const htmlResponse = await fetch('http://localhost:5002/api/custom-templates/slide-to-html', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: slide.screenshot_url,
          xml: slide.xml_content,
          fonts: slide.normalized_fonts,
        }),
      });

      if (!htmlResponse.ok) {
        throw new Error('Failed to convert slide to HTML');
      }

      const htmlData = await htmlResponse.json();

      // Convert HTML to React
      const reactResponse = await fetch('http://localhost:5002/api/custom-templates/html-to-react', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          html: htmlData.html,
          image: slide.screenshot_url,
        }),
      });

      if (!reactResponse.ok) {
        throw new Error('Failed to convert HTML to React');
      }

      const reactData = await reactResponse.json();

      setSlides(prev => prev.map((s, i) =>
        i === slideIndex
          ? {
              ...s,
              html: htmlData.html,
              react: reactData.react_component,
              processing: false,
              completed: true,
            }
          : s
      ));
    } catch (error: any) {
      setSlides(prev => prev.map((s, i) =>
        i === slideIndex
          ? {
              ...s,
              processing: false,
              error: error.message || 'Conversion failed',
            }
          : s
      ));
    }
  };

  const convertAllSlides = async () => {
    setConverting(true);
    
    // Create promises for all slides that need conversion
    const conversionPromises = slides
      .map((slide, index) => ({ slide, index }))
      .filter(({ slide }) => !slide.completed)
      .map(({ index }) => convertSlideToHTML(index));

    // Run all conversions in parallel
    await Promise.allSettled(conversionPromises);
    
    setConverting(false);
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      alert('Please enter a template name');
      return;
    }

    setSavingTemplate(true);

    try {
      // Save template metadata
      const templateResponse = await fetch('http://localhost:5002/api/custom-templates/save-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: processingData.presentation_id,
          name: templateName,
          description: templateDescription,
        }),
      });

      if (!templateResponse.ok) {
        throw new Error('Failed to save template metadata');
      }

      // Save all layouts
      const layouts = slides
        .filter(s => s.completed && s.react)
        .map((slide, index) => ({
          presentation: processingData.presentation_id,
          layout_id: `slide-${slide.slide_number}`,
          layout_name: `Slide ${slide.slide_number} Layout`,
          layout_code: slide.react!,
          fonts: processingData.fonts.internally_supported_fonts.map(f => f.google_fonts_url),
        }));

      const layoutsResponse = await fetch('http://localhost:5002/api/custom-templates/save-layouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layouts }),
      });

      if (!layoutsResponse.ok) {
        throw new Error('Failed to save layouts');
      }

      alert('Template saved successfully!');
      setShowSaveDialog(false);
    } catch (error: any) {
      alert(`Failed to save template: ${error.message}`);
    } finally {
      setSavingTemplate(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-indigo-600 text-white shadow-lg">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 hover:bg-indigo-700 px-3 py-2 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back</span>
          </button>

          <h1 className="text-2xl font-bold">Presenton</h1>

          <div className="flex items-center gap-4">
            <button className="px-4 py-2 hover:bg-indigo-700 rounded-lg transition-colors">
              Templates
            </button>
            <button className="px-4 py-2 hover:bg-indigo-700 rounded-lg transition-colors">
              Dashboard
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8 max-w-7xl">
        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Custom Template Processor
          </h2>
          <p className="text-gray-600">
            Upload your PDF or PPTX file to extract slides and convert them to a template
            <br />
            which you can use to generate AI presentations.
          </p>
          <div className="mt-3">
            <p className="text-sm text-orange-600 bg-orange-50 inline-block px-4 py-2 rounded-lg">
              AI template generation can take around 5 minutes per slide.
            </p>
          </div>
        </div>

        {/* Progress */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="text-2xl font-bold text-indigo-600">
                {completedCount}/{slides.length}
              </div>
              <span className="text-gray-600">slides completed</span>
            </div>
            <div className="flex gap-3">
              <button
                onClick={convertAllSlides}
                disabled={converting || completedCount === slides.length}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {converting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Converting...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Convert All
                  </>
                )}
              </button>
              <button
                onClick={() => setShowSaveDialog(true)}
                disabled={completedCount === 0}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Save as Template
              </button>
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className="bg-indigo-600 h-full transition-all duration-500"
              style={{ width: `${(completedCount / slides.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Current Slide */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {currentSlide.completed ? (
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              ) : (
                <div className="w-6 h-6 rounded-full border-2 border-gray-300" />
              )}
              <h3 className="text-xl font-semibold text-gray-900">
                Slide {currentSlide.slide_number}
              </h3>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => convertSlideToHTML(currentSlideIndex)}
                disabled={currentSlide.processing}
                className="px-3 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
              >
                <Edit className="w-4 h-4" />
                {currentSlide.processing ? 'Converting...' : 'Edit Slide'}
              </button>
              {currentSlide.html && (
                <button className="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 flex items-center gap-2 text-sm">
                  <Code className="w-4 h-4" />
                  Edit HTML
                </button>
              )}
              {currentSlide.completed && (
                <button
                  onClick={() => convertSlideToHTML(currentSlideIndex)}
                  className="px-3 py-2 bg-cyan-100 text-cyan-700 rounded-lg hover:bg-cyan-200 flex items-center gap-2 text-sm"
                >
                  <RefreshCw className="w-4 h-4" />
                  Re-Construct
                </button>
              )}
            </div>
          </div>

          {/* Slide Preview */}
          <div className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden border-2 border-gray-200">
            {imageErrors[currentSlide.slide_number] ? (
              <div className="w-full h-full flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <AlertCircle className="w-12 h-12 mx-auto mb-2 text-red-400" />
                  <p className="text-sm">Failed to load image</p>
                  <button
                    onClick={() => {
                      setImageErrors(prev => ({ ...prev, [currentSlide.slide_number]: false }));
                    }}
                    className="mt-2 text-xs text-indigo-600 hover:text-indigo-700 underline"
                  >
                    Retry
                  </button>
                </div>
              </div>
            ) : imageLoading[currentSlide.slide_number] ? (
              <div className="w-full h-full flex items-center justify-center bg-gray-100">
                <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
              </div>
            ) : (
              <img
                src={`http://localhost:5002${currentSlide.screenshot_url}`}
                alt={`Slide ${currentSlide.slide_number}`}
                className="w-full h-full object-contain"
                onError={(e) => {
                  console.error(`Failed to load image for slide ${currentSlide.slide_number}:`, currentSlide.screenshot_url);
                  setImageErrors(prev => ({ ...prev, [currentSlide.slide_number]: true }));
                  setImageLoading(prev => {
                    const newLoading = { ...prev };
                    delete newLoading[currentSlide.slide_number];
                    return newLoading;
                  });
                }}
                onLoad={() => {
                  setImageErrors(prev => {
                    const newErrors = { ...prev };
                    delete newErrors[currentSlide.slide_number];
                    return newErrors;
                  });
                  setImageLoading(prev => {
                    const newLoading = { ...prev };
                    delete newLoading[currentSlide.slide_number];
                    return newLoading;
                  });
                }}
                onLoadStart={() => {
                  setImageLoading(prev => ({ ...prev, [currentSlide.slide_number]: true }));
                }}
              />
            )}
          </div>

          {/* Status */}
          {currentSlide.processing && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
              <div>
                <p className="text-sm font-medium text-blue-900">Converting to HTML...</p>
                <p className="text-xs text-blue-700 mt-1">
                  This may take 30-60 seconds per slide
                </p>
              </div>
            </div>
          )}

          {currentSlide.error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm font-medium text-red-800">Error: {currentSlide.error}</p>
            </div>
          )}
        </div>

        {/* Slide Navigation */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            All Slides ({slides.length})
          </h3>
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-3">
            {slides.map((slide, index) => (
            <button
              key={slide.slide_number}
              onClick={() => setCurrentSlideIndex(index)}
              className={`relative aspect-video rounded-lg overflow-hidden border-2 transition-all ${
                index === currentSlideIndex
                  ? 'border-indigo-600 ring-2 ring-indigo-200'
                  : slide.completed
                  ? 'border-green-300 hover:border-green-500'
                  : 'border-gray-200 hover:border-gray-400'
              }`}
            >
              {imageErrors[slide.slide_number] ? (
                <div className="w-full h-full flex items-center justify-center bg-gray-100">
                  <div className="text-center">
                    <AlertCircle className="w-6 h-6 mx-auto mb-1 text-red-400" />
                    <p className="text-[8px] text-gray-500">Error</p>
                  </div>
                </div>
              ) : imageLoading[slide.slide_number] ? (
                <div className="w-full h-full flex items-center justify-center bg-gray-100">
                  <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                </div>
              ) : (
                <img
                  src={`http://localhost:5002${slide.screenshot_url}`}
                  alt={`Slide ${slide.slide_number}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  onError={(e) => {
                    console.error(`Failed to load image for slide ${slide.slide_number}:`, slide.screenshot_url);
                    setImageErrors(prev => ({ ...prev, [slide.slide_number]: true }));
                    setImageLoading(prev => {
                      const newLoading = { ...prev };
                      delete newLoading[slide.slide_number];
                      return newLoading;
                    });
                  }}
                  onLoad={() => {
                    setImageErrors(prev => {
                      const newErrors = { ...prev };
                      delete newErrors[slide.slide_number];
                      return newErrors;
                    });
                    setImageLoading(prev => {
                      const newLoading = { ...prev };
                      delete newLoading[slide.slide_number];
                      return newLoading;
                    });
                  }}
                  onLoadStart={() => {
                    setImageLoading(prev => ({ ...prev, [slide.slide_number]: true }));
                  }}
                />
              )}
              {slide.completed && (
                <div className="absolute top-1 right-1 bg-green-500 rounded-full p-1">
                  <CheckCircle2 className="w-3 h-3 text-white" />
                </div>
              )}
              {slide.processing && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <Loader2 className="w-4 h-4 text-white animate-spin" />
                </div>
              )}
              <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs text-center py-1">
                {slide.slide_number}
              </div>
            </button>
          ))}
          </div>
        </div>
      </main>

      {/* Save Template Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Save Template</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Template Name *
                </label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="My Custom Template"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description (optional)
                </label>
                <textarea
                  value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                  placeholder="A beautiful modern template..."
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowSaveDialog(false)}
                  disabled={savingTemplate}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveTemplate}
                  disabled={savingTemplate || !templateName.trim()}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {savingTemplate ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Template
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

