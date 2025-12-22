'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Sparkles, Github, Upload } from 'lucide-react';

export function Header() {
  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="sticky top-0 z-50 glass border-b border-border/50"
    >
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg group-hover:shadow-primary/25 transition-shadow">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold">
              AI<span className="gradient-text">Slides</span>
            </span>
          </Link>

          <nav className="flex items-center gap-6">
            <Link 
              href="/"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Dashboard
            </Link>
            <Link 
              href="/custom-template"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:text-foreground glass rounded-lg transition-colors"
            >
              <Upload className="w-4 h-4" />
              Custom Template
            </Link>
            <a
              href="https://github.com/presenton/presenton"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:text-foreground glass rounded-lg transition-colors"
            >
              <Github className="w-4 h-4" />
              Inspired by Presenton
            </a>
          </nav>
        </div>
      </div>
    </motion.header>
  );
}

