'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Home,
  Maximize,
  Minimize,
  Grid,
  X,
  Download,
  Edit3,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Loader2
} from 'lucide-react';
import Link from 'next/link';
import { SlidePreview } from '@/components/presentation/SlidePreview';
import { exportPresentation } from '@/lib/exportApi';

interface Slide {
  id: string;
  type: string;
  title?: string;
  subtitle?: string;
  bullets?: string[];
  quote?: string;
  attribution?: string;
  stats?: { value: string; label: string }[];
  leftColumn?: { heading: string; bullets: string[] };
  rightColumn?: { heading: string; bullets: string[] };
  callToAction?: string;
  speakerNotes?: string;
  content?: string | { // Raw content from backend - can be string or object
    title?: string;
    content?: string;
    text?: string;
    __speaker_note__?: string;
  };
  image?: string;
  imageUrl?: string;
}

interface Theme {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  fontFamily: string;
}

interface Presentation {
  id: string;
  topic: string;
  slides: Slide[];
  theme: Theme;
}

export default function PresentationViewPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [presentation, setPresentation] = useState<Presentation | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showOverview, setShowOverview] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isAutoPlay, setIsAutoPlay] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchPresentation();
  }, [id]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isAutoPlay && presentation) {
      timer = setInterval(() => {
        setCurrentSlide(prev => {
          if (prev >= presentation.slides.length - 1) {
            setIsAutoPlay(false);
            return prev;
          }
          return prev + 1;
        });
      }, 5000);
    }
    return () => clearInterval(timer);
  }, [isAutoPlay, presentation]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!presentation) return;

      switch (e.key) {
        case 'ArrowRight':
        case ' ':
        case 'Enter':
          e.preventDefault();
          goToNext();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          goToPrev();
          break;
        case 'Home':
          e.preventDefault();
          setCurrentSlide(0);
          break;
        case 'End':
          e.preventDefault();
          setCurrentSlide(presentation.slides.length - 1);
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'g':
          e.preventDefault();
          setShowOverview(true);
          break;
        case 'Escape':
          if (showOverview) {
            setShowOverview(false);
          } else if (isFullscreen) {
            exitFullscreen();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [presentation, showOverview, isFullscreen]);

  // Hide controls after inactivity
  useEffect(() => {
    let timer: NodeJS.Timeout;
    const handleMouseMove = () => {
      setShowControls(true);
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (isFullscreen) setShowControls(false);
      }, 3000);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      clearTimeout(timer);
    };
  }, [isFullscreen]);

  const fetchPresentation = async () => {
    try {
      const res = await fetch(`http://localhost:5002/api/presentations/${id}`);
      if (!res.ok) throw new Error('Not found');
      const data = await res.json();
      
      // Ensure theme exists with default values
      if (!data.theme) {
        data.theme = {
          primaryColor: '#6366f1',
          secondaryColor: '#8b5cf6',
          backgroundColor: '#ffffff',
          textColor: '#1f2937',
          fontFamily: 'system-ui',
        };
      }
      
      // Process slides to handle nested content structure
      if (data.slides && Array.isArray(data.slides)) {
        data.slides = data.slides.map((slide: any) => {
          // Handle nested content structure from backend
          if (slide.content && typeof slide.content === 'object' && !Array.isArray(slide.content)) {
            const contentObj = slide.content;
            if (contentObj.title && !slide.title) {
              slide.title = contentObj.title;
            }
          }
          return slide;
        });
      }
      
      setPresentation(data);
    } catch (error) {
      console.error('Failed to fetch presentation:', error);
    } finally {
      setLoading(false);
    }
  };

  const goToNext = useCallback(() => {
    if (!presentation) return;
    setCurrentSlide(prev => Math.min(prev + 1, presentation.slides.length - 1));
  }, [presentation]);

  const goToPrev = useCallback(() => {
    setCurrentSlide(prev => Math.max(prev - 1, 0));
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      exitFullscreen();
    }
  };

  const exitFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
    setIsFullscreen(false);
  };

  const downloadPresentation = async () => {
    if (!presentation) return;
    
    setExporting(true);
    
    try {
      const filename = `${presentation.topic || 'presentation'}.pptx`;
      await exportPresentation(id, 'pptx', filename);
    } catch (error: any) {
      console.error('Failed to export:', error);
      alert(`Failed to export: ${error.message || 'Unknown error'}`);
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!presentation) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <p className="text-muted-foreground">Presentation not found</p>
        <Link href="/" className="text-primary hover:underline">
          Go back home
        </Link>
      </div>
    );
  }

  const currentSlideData = presentation.slides[currentSlide];

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: presentation.theme.backgroundColor }}
    >
      {/* Header */}
      <AnimatePresence>
        {showControls && !isFullscreen && (
          <motion.header
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            className="fixed top-0 left-0 right-0 z-50 glass border-b border-border"
          >
            <div className="flex items-center justify-between px-6 py-3">
              <div className="flex items-center gap-4">
                <Link
                  href={`/presentation/${id}`}
                  className="p-2 text-muted-foreground hover:text-foreground rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Link>
                <div>
                  <h1 className="font-semibold line-clamp-1">{presentation.topic}</h1>
                  <p className="text-xs text-muted-foreground">
                    Slide {currentSlide + 1} of {presentation.slides.length}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowOverview(true)}
                  className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                  title="Overview (G)"
                >
                  <Grid className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setIsAutoPlay(!isAutoPlay)}
                  className={`p-2 rounded-lg transition-colors ${
                    isAutoPlay ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                  title="Auto-play"
                >
                  {isAutoPlay ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                </button>
                <Link
                  href={`/presentation/${id}`}
                  className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                  title="Edit"
                >
                  <Edit3 className="w-5 h-5" />
                </Link>
                <button
                  onClick={downloadPresentation}
                  disabled={exporting}
                  className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title={exporting ? "Exporting..." : "Download"}
                >
                  {exporting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Download className="w-5 h-5" />
                  )}
                </button>
                <button
                  onClick={toggleFullscreen}
                  className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                  title="Fullscreen (F)"
                >
                  <Maximize className="w-5 h-5" />
                </button>
              </div>
            </div>
          </motion.header>
        )}
      </AnimatePresence>

      {/* Main Slide Area */}
      <div
        className={`flex-1 flex items-center justify-center ${isFullscreen ? '' : 'pt-16 pb-20'}`}
        onClick={goToNext}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
            className={`${isFullscreen ? 'w-full h-full' : 'w-full max-w-6xl mx-6'}`}
          >
            <div className={`${isFullscreen ? 'h-full' : 'slide-preview rounded-2xl overflow-hidden shadow-2xl border border-white/10'}`}>
              <SlidePreview slide={currentSlideData} theme={presentation.theme} />
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation Controls */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            className={`fixed bottom-0 left-0 right-0 z-50 ${isFullscreen ? 'bg-black/50 backdrop-blur-sm' : 'glass border-t border-border'}`}
          >
            <div className="flex items-center justify-between px-6 py-4">
              {/* Left: Navigation buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); goToPrev(); }}
                  disabled={currentSlide === 0}
                  className="p-3 bg-muted/50 hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed rounded-xl transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); goToNext(); }}
                  disabled={currentSlide === presentation.slides.length - 1}
                  className="p-3 bg-muted/50 hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed rounded-xl transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* Center: Progress */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  {presentation.slides.map((_, i) => (
                    <button
                      key={i}
                      onClick={(e) => { e.stopPropagation(); setCurrentSlide(i); }}
                      className={`w-2 h-2 rounded-full transition-all ${
                        i === currentSlide
                          ? 'w-8 bg-primary'
                          : 'bg-white/20 hover:bg-white/40'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-sm text-muted-foreground">
                  {currentSlide + 1} / {presentation.slides.length}
                </span>
              </div>

              {/* Right: Fullscreen toggle */}
              <div className="flex items-center gap-2">
                {isFullscreen ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); exitFullscreen(); }}
                    className="p-3 bg-muted/50 hover:bg-muted rounded-xl transition-colors"
                  >
                    <Minimize className="w-5 h-5" />
                  </button>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
                    className="p-3 bg-muted/50 hover:bg-muted rounded-xl transition-colors"
                  >
                    <Maximize className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Slide Overview Modal */}
      <AnimatePresence>
        {showOverview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-8"
            onClick={() => setShowOverview(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-6xl max-h-[80vh] bg-card rounded-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h2 className="font-semibold">Slide Overview</h2>
                <button
                  onClick={() => setShowOverview(false)}
                  className="p-2 text-muted-foreground hover:text-foreground rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto max-h-[calc(80vh-60px)]">
                <div className="grid grid-cols-3 md:grid-cols-4 gap-4">
                  {presentation.slides.map((slide, i) => (
                    <motion.button
                      key={slide.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        setCurrentSlide(i);
                        setShowOverview(false);
                      }}
                      className={`relative rounded-lg overflow-hidden border-2 transition-all ${
                        i === currentSlide
                          ? 'border-primary shadow-lg shadow-primary/20'
                          : 'border-transparent hover:border-white/20'
                      }`}
                    >
                      <div className="slide-preview">
                        <SlidePreview slide={slide} theme={presentation.theme} mini />
                      </div>
                      <div className="absolute bottom-1 left-1 px-2 py-0.5 bg-black/60 rounded text-xs text-white">
                        {i + 1}
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Keyboard shortcuts hint */}
      <AnimatePresence>
        {showControls && !isFullscreen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed bottom-20 left-1/2 -translate-x-1/2 text-xs text-muted-foreground"
          >
            <kbd className="px-2 py-1 bg-muted rounded mr-1">←</kbd>
            <kbd className="px-2 py-1 bg-muted rounded mr-3">→</kbd>
            Navigate
            <span className="mx-4">|</span>
            <kbd className="px-2 py-1 bg-muted rounded mr-1">F</kbd>
            Fullscreen
            <span className="mx-4">|</span>
            <kbd className="px-2 py-1 bg-muted rounded mr-1">G</kbd>
            Overview
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

