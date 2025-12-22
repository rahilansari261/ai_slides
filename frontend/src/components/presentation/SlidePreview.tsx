'use client';

import { motion } from 'framer-motion';

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
  text?: string; // Alternative content field
  image?: string; // Slide image URL
  imageUrl?: string; // Alternative image field
}

interface Theme {
  primaryColor?: string;
  secondaryColor?: string;
  backgroundColor?: string;
  textColor?: string;
  fontFamily?: string;
}

interface SlidePreviewProps {
  slide: Slide;
  theme?: Theme;
  mini?: boolean;
}

const defaultTheme: Theme = {
  primaryColor: '#6366f1',
  secondaryColor: '#8b5cf6',
  backgroundColor: '#ffffff',
  textColor: '#1f2937',
  fontFamily: 'system-ui',
};

export function SlidePreview({ slide, theme, mini = false }: SlidePreviewProps) {
  const safeTheme = theme || defaultTheme;
  const styles = {
    background: safeTheme.backgroundColor || defaultTheme.backgroundColor,
    color: safeTheme.textColor || defaultTheme.textColor,
    fontFamily: (safeTheme.fontFamily || defaultTheme.fontFamily) + ', system-ui, sans-serif',
  };

  const renderSlide = () => {
    switch (slide.type) {
      case 'title':
        return <TitleSlide slide={slide} theme={safeTheme} mini={mini} />;
      case 'content':
        return <ContentSlide slide={slide} theme={safeTheme} mini={mini} />;
      case 'two-column':
        return <TwoColumnSlide slide={slide} theme={safeTheme} mini={mini} />;
      case 'quote':
        return <QuoteSlide slide={slide} theme={safeTheme} mini={mini} />;
      case 'stats':
        return <StatsSlide slide={slide} theme={safeTheme} mini={mini} />;
      case 'section':
        return <SectionSlide slide={slide} theme={safeTheme} mini={mini} />;
      case 'conclusion':
        return <ConclusionSlide slide={slide} theme={safeTheme} mini={mini} />;
      default:
        return <ContentSlide slide={slide} theme={safeTheme} mini={mini} />;
    }
  };

  return (
    <div className="w-full h-full" style={styles}>
      {renderSlide()}
    </div>
  );
}

function TitleSlide({ slide, theme, mini }: { slide: Slide; theme: Theme; mini: boolean }) {
  const safeTheme = theme || defaultTheme;
  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center">
      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`font-bold mb-4 ${mini ? 'text-sm' : 'text-4xl md:text-5xl'}`}
        style={{ color: safeTheme.primaryColor || defaultTheme.primaryColor }}
      >
        {slide.title || 'Untitled'}
      </motion.h1>
      <div
        className={`${mini ? 'w-8 h-0.5' : 'w-24 h-1'} rounded-full mb-4`}
        style={{ backgroundColor: safeTheme.primaryColor || defaultTheme.primaryColor }}
      />
      {slide.subtitle && (
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className={`opacity-80 ${mini ? 'text-[8px]' : 'text-xl'}`}
          style={{ color: safeTheme.textColor || defaultTheme.textColor }}
        >
          {slide.subtitle}
        </motion.p>
      )}
    </div>
  );
}

function ContentSlide({ slide, theme, mini }: { slide: Slide; theme: Theme; mini: boolean }) {
  const safeTheme = theme || defaultTheme;
  
  // Handle nested content structure from backend
  // Backend sends: { content: { title: "...", content: "..." } }
  let displayTitle = slide.title;
  let displayText = '';
  let displayBullets = slide.bullets || [];
  
  // Check if content is an object (backend format)
  if (slide.content && typeof slide.content === 'object' && !Array.isArray(slide.content)) {
    const contentObj = slide.content as any;
    // Extract title from content object
    if (contentObj.title && !displayTitle) {
      displayTitle = contentObj.title;
    }
    // Extract content string from content object
    const contentString = contentObj.content || contentObj.text || '';
    if (contentString && typeof contentString === 'string') {
      // Parse content string for bullets or text
      const lines = contentString.split('\n').filter((line: string) => line.trim());
      const bulletPattern = /^[-•*]\s*/;
      const hasBullets = lines.some(line => bulletPattern.test(line));
      
      if (hasBullets) {
        displayBullets = lines
          .map((line: string) => line.replace(/^[-•*]\s*/, '').replace(/\*\*/g, '').trim())
          .filter((line: string) => line);
      } else {
        displayText = contentString.replace(/\*\*/g, '').trim();
      }
    }
  } else if (slide.content && typeof slide.content === 'string') {
    // Fallback: content is a string
    const lines = slide.content.split('\n').filter((line: string) => line.trim());
    if (lines.length > 0) {
      if (!displayTitle && lines[0]) {
        displayTitle = lines[0].trim();
      }
      if (displayBullets.length === 0 && lines.length > 1) {
        const remainingLines = lines.slice(1);
        const bulletPattern = /^[-•*]\s*/;
        if (remainingLines.some(line => bulletPattern.test(line))) {
          displayBullets = remainingLines
            .map((line: string) => line.replace(/^[-•*]\s*/, '').replace(/\*\*/g, '').trim())
            .filter((line: string) => line);
        } else {
          displayText = remainingLines.join(' ');
        }
      }
    }
  }
  
  // Get image URL from various possible locations
  const imageUrl = slide.image || slide.imageUrl || (slide as any).image_url;
  const hasImage = imageUrl && typeof imageUrl === 'string';
  
  // For full-size slides with images, use two-column layout
  if (!mini && hasImage && (displayTitle || displayText || displayBullets.length > 0)) {
    return (
      <div className="w-full h-full flex">
        {/* Image Section */}
        <div className="w-1/2 h-full relative overflow-hidden">
          <img
            src={imageUrl.startsWith('http') ? imageUrl : `http://localhost:5002${imageUrl}`}
            alt={displayTitle || 'Slide image'}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>
        
        {/* Content Section */}
        <div className="w-1/2 h-full flex flex-col justify-center p-12">
          {displayTitle && (
            <h2
              className="font-serif text-4xl font-bold mb-6 leading-tight"
              style={{ color: safeTheme.textColor || defaultTheme.textColor }}
            >
              {displayTitle}
            </h2>
          )}
          {displayText && (
            <p
              className="text-lg leading-relaxed mb-4"
              style={{ color: safeTheme.textColor || defaultTheme.textColor }}
            >
              {displayText}
            </p>
          )}
          {displayBullets && displayBullets.length > 0 && (
            <ul className="space-y-3">
              {displayBullets.map((bullet, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-start gap-3"
                >
                  <span
                    className="w-2 h-2 mt-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: safeTheme.primaryColor || defaultTheme.primaryColor }}
                  />
                  <span className="text-lg">{bullet}</span>
                </motion.li>
              ))}
            </ul>
          )}
          
          {/* Badge/Tag at bottom */}
          {displayTitle && (
            <div className="mt-auto pt-6 flex items-center gap-2 text-sm opacity-60">
              <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-bold">
                {displayTitle.substring(0, 2).toUpperCase()}
              </div>
              <span>{displayTitle}</span>
              <span>•</span>
              <span>{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            </div>
          )}
        </div>
      </div>
    );
  }
  
  // Standard layout for mini or slides without images
  return (
    <div className={`w-full h-full flex flex-col ${mini ? 'p-2' : 'p-8'}`}>
      {displayTitle && (
        <h2
          className={`font-bold mb-4 ${mini ? 'text-[10px]' : 'text-3xl'}`}
          style={{ color: safeTheme.primaryColor || defaultTheme.primaryColor }}
        >
          {displayTitle}
        </h2>
      )}
      {displayBullets && displayBullets.length > 0 ? (
        <ul className={`space-y-2 flex-1 ${mini ? 'text-[6px]' : 'text-lg'}`}>
          {displayBullets.map((bullet, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="flex items-start gap-2"
            >
              <span
                className={`${mini ? 'w-1 h-1 mt-0.5' : 'w-2 h-2 mt-2'} rounded-full flex-shrink-0`}
                style={{ backgroundColor: safeTheme.secondaryColor || defaultTheme.secondaryColor }}
              />
              <span>{bullet}</span>
            </motion.li>
          ))}
        </ul>
      ) : displayText ? (
        <div className={`flex-1 ${mini ? 'text-[6px]' : 'text-lg'}`} style={{ color: safeTheme.textColor || defaultTheme.textColor }}>
          {displayText}
        </div>
      ) : hasContent && !displayTitle ? (
        <div className={`flex-1 ${mini ? 'text-[6px]' : 'text-lg'}`} style={{ color: safeTheme.textColor || defaultTheme.textColor }}>
          <pre className="whitespace-pre-wrap font-sans">{rawContent}</pre>
        </div>
      ) : null}
    </div>
  );
}

function TwoColumnSlide({ slide, theme, mini }: { slide: Slide; theme: Theme; mini: boolean }) {
  const safeTheme = theme || defaultTheme;
  return (
    <div className={`w-full h-full flex flex-col ${mini ? 'p-2' : 'p-8'}`}>
      <h2
        className={`font-bold mb-4 ${mini ? 'text-[10px]' : 'text-3xl'}`}
        style={{ color: safeTheme.primaryColor || defaultTheme.primaryColor }}
      >
        {slide.title || 'Comparison'}
      </h2>
      <div className="flex-1 grid grid-cols-2 gap-4">
        {/* Left Column */}
        <div className="space-y-2">
          {slide.leftColumn?.heading && (
            <h3
              className={`font-semibold ${mini ? 'text-[8px]' : 'text-xl'}`}
              style={{ color: safeTheme.secondaryColor || defaultTheme.secondaryColor }}
            >
              {slide.leftColumn.heading}
            </h3>
          )}
          {slide.leftColumn?.bullets && (
            <ul className={`space-y-1 ${mini ? 'text-[6px]' : 'text-base'}`}>
              {slide.leftColumn.bullets.map((bullet, i) => (
                <li key={i} className="flex items-start gap-1">
                  <span
                    className={`${mini ? 'w-0.5 h-0.5 mt-0.5' : 'w-1.5 h-1.5 mt-1.5'} rounded-full flex-shrink-0`}
                    style={{ backgroundColor: safeTheme.secondaryColor || defaultTheme.secondaryColor }}
                  />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {/* Right Column */}
        <div className="space-y-2 border-l pl-4" style={{ borderColor: (safeTheme.primaryColor || defaultTheme.primaryColor) + '40' }}>
          {slide.rightColumn?.heading && (
            <h3
              className={`font-semibold ${mini ? 'text-[8px]' : 'text-xl'}`}
              style={{ color: safeTheme.secondaryColor || defaultTheme.secondaryColor }}
            >
              {slide.rightColumn.heading}
            </h3>
          )}
          {slide.rightColumn?.bullets && (
            <ul className={`space-y-1 ${mini ? 'text-[6px]' : 'text-base'}`}>
              {slide.rightColumn.bullets.map((bullet, i) => (
                <li key={i} className="flex items-start gap-1">
                  <span
                    className={`${mini ? 'w-0.5 h-0.5 mt-0.5' : 'w-1.5 h-1.5 mt-1.5'} rounded-full flex-shrink-0`}
                    style={{ backgroundColor: safeTheme.secondaryColor || defaultTheme.secondaryColor }}
                  />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function QuoteSlide({ slide, theme, mini }: { slide: Slide; theme: Theme; mini: boolean }) {
  const safeTheme = theme || defaultTheme;
  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center">
      <span
        className={`${mini ? 'text-2xl' : 'text-8xl'} font-serif leading-none`}
        style={{ color: safeTheme.primaryColor || defaultTheme.primaryColor }}
      >
        "
      </span>
      <motion.blockquote
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`italic max-w-3xl ${mini ? 'text-[8px]' : 'text-2xl'}`}
        style={{ color: safeTheme.textColor || defaultTheme.textColor }}
      >
        {slide.quote || 'Quote goes here'}
      </motion.blockquote>
      {slide.attribution && (
        <motion.cite
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className={`mt-4 not-italic ${mini ? 'text-[6px]' : 'text-lg'}`}
          style={{ color: safeTheme.secondaryColor || defaultTheme.secondaryColor }}
        >
          — {slide.attribution}
        </motion.cite>
      )}
    </div>
  );
}

function StatsSlide({ slide, theme, mini }: { slide: Slide; theme: Theme; mini: boolean }) {
  const safeTheme = theme || defaultTheme;
  return (
    <div className={`w-full h-full flex flex-col ${mini ? 'p-2' : 'p-8'}`}>
      <h2
        className={`font-bold mb-6 ${mini ? 'text-[10px]' : 'text-3xl'}`}
        style={{ color: safeTheme.primaryColor || defaultTheme.primaryColor }}
      >
        {slide.title || 'Key Statistics'}
      </h2>
      <div className="flex-1 grid grid-cols-3 gap-4 items-center">
        {slide.stats?.map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="text-center"
          >
            <div
              className={`font-bold ${mini ? 'text-sm' : 'text-5xl'}`}
              style={{ color: safeTheme.primaryColor || defaultTheme.primaryColor }}
            >
              {stat.value}
            </div>
            <div
              className={`mt-2 opacity-80 ${mini ? 'text-[6px]' : 'text-base'}`}
              style={{ color: safeTheme.textColor || defaultTheme.textColor }}
            >
              {stat.label}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function SectionSlide({ slide, theme, mini }: { slide: Slide; theme: Theme; mini: boolean }) {
  const safeTheme = theme || defaultTheme;
  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center">
      <motion.h2
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`font-bold ${mini ? 'text-sm' : 'text-4xl'}`}
        style={{ color: safeTheme.primaryColor || defaultTheme.primaryColor }}
      >
        {slide.title || 'Section'}
      </motion.h2>
      <div
        className={`${mini ? 'w-8 h-0.5 mt-2' : 'w-24 h-1 mt-6'} rounded-full`}
        style={{ backgroundColor: safeTheme.secondaryColor || defaultTheme.secondaryColor }}
      />
    </div>
  );
}

function ConclusionSlide({ slide, theme, mini }: { slide: Slide; theme: Theme; mini: boolean }) {
  const safeTheme = theme || defaultTheme;
  return (
    <div className={`w-full h-full flex flex-col ${mini ? 'p-2' : 'p-8'}`}>
      <h2
        className={`font-bold mb-4 ${mini ? 'text-[10px]' : 'text-3xl'}`}
        style={{ color: safeTheme.primaryColor || defaultTheme.primaryColor }}
      >
        {slide.title || 'Conclusion'}
      </h2>
      {slide.bullets && slide.bullets.length > 0 && (
        <ul className={`space-y-2 flex-1 ${mini ? 'text-[6px]' : 'text-lg'}`}>
          {slide.bullets.map((bullet, i) => (
            <li key={i} className="flex items-start gap-2">
              <span
                className={`${mini ? 'w-1 h-1 mt-0.5' : 'w-2 h-2 mt-2'} rounded-full flex-shrink-0`}
                style={{ backgroundColor: safeTheme.secondaryColor || defaultTheme.secondaryColor }}
              />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      )}
      {slide.callToAction && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`text-center font-semibold ${mini ? 'text-[8px]' : 'text-xl'}`}
          style={{ color: safeTheme.primaryColor || defaultTheme.primaryColor }}
        >
          {slide.callToAction}
        </motion.div>
      )}
    </div>
  );
}

