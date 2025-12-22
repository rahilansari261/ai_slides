'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  Presentation, 
  Clock, 
  Trash2, 
  ChevronRight,
  Zap,
  Layers,
  Download,
  Edit3
} from 'lucide-react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { CreatePresentationModal } from '@/components/presentation/CreatePresentationModal';

interface PresentationItem {
  id: string;
  topic: string;
  slidesCount: number;
  createdAt: string;
  updatedAt: string;
}

export default function Home() {
  const [presentations, setPresentations] = useState<PresentationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    fetchPresentations();
  }, []);

  const fetchPresentations = async () => {
    try {
      const res = await fetch('http://localhost:5002/api/presentations');
      if (res.ok) {
        const data = await res.json();
        setPresentations(data);
      } else {
        console.error('Failed to fetch presentations:', res.status, res.statusText);
      }
    } catch (error) {
      console.error('Failed to fetch presentations:', error);
    } finally {
      setLoading(false);
    }
  };

  const deletePresentation = async (id: string) => {
    if (!confirm('Are you sure you want to delete this presentation?')) return;
    
    try {
      const res = await fetch(`http://localhost:5002/api/presentations/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setPresentations(prev => prev.filter(p => p.id !== id));
      } else {
        console.error('Failed to delete presentation:', res.status, res.statusText);
      }
    } catch (error) {
      console.error('Failed to delete presentation:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <main className="min-h-screen noise">
      {/* Background elements */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-primary/20 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-secondary/20 rounded-full blur-[150px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-accent/10 rounded-full blur-[200px]" />
      </div>

      <Header />

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-12">
        {/* Hero Section */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center py-16"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-8"
          >
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm text-muted-foreground">Powered by OpenAI GPT-4</span>
          </motion.div>

          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
            Create Stunning{' '}
            <span className="gradient-text">Presentations</span>
            <br />
            in Seconds
          </h1>

          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
            Transform your ideas into professional presentations with AI.
            Just describe your topic and let the magic happen.
          </p>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-primary to-secondary rounded-xl font-semibold text-lg shadow-lg glow-hover transition-all duration-300"
          >
            <Zap className="w-5 h-5" />
            Create Presentation
          </motion.button>
        </motion.section>

        {/* Features */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="grid md:grid-cols-4 gap-6 py-12"
        >
          {[
            { icon: Sparkles, title: 'AI-Powered', desc: 'Generate content with GPT-4' },
            { icon: Layers, title: 'Multiple Layouts', desc: 'Various slide types & styles' },
            { icon: Download, title: 'Export PPTX', desc: 'Download ready-to-use files' },
            { icon: Edit3, title: 'Custom Templates', desc: 'Upload your own PPTX templates', link: '/custom-template' },
          ].map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + i * 0.1, duration: 0.5 }}
              className="glass rounded-2xl p-6 hover:border-primary/50 transition-colors duration-300"
            >
              {feature.link ? (
                <Link href={feature.link} className="block">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center mb-4">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm">{feature.desc}</p>
                </Link>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center mb-4">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm">{feature.desc}</p>
                </>
              )}
            </motion.div>
          ))}
        </motion.section>

        {/* Presentations List */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.6 }}
          className="py-12"
        >
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold flex items-center gap-3">
              <Presentation className="w-6 h-6 text-primary" />
              Your Presentations
            </h2>
            <button
              onClick={() => setShowCreateModal(true)}
              className="text-sm text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
            >
              Create New <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {loading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="glass rounded-2xl p-6 h-48 shimmer" />
              ))}
            </div>
          ) : presentations.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass rounded-2xl p-12 text-center"
            >
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                <Presentation className="w-10 h-10 text-primary/60" />
              </div>
              <h3 className="text-xl font-semibold mb-2">No presentations yet</h3>
              <p className="text-muted-foreground mb-6">Create your first AI-powered presentation</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary rounded-xl font-medium hover:bg-primary/90 transition-colors"
              >
                <Zap className="w-4 h-4" />
                Get Started
              </button>
            </motion.div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <AnimatePresence>
                {presentations.map((pres, i) => (
                  <motion.div
                    key={pres.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ delay: i * 0.05, duration: 0.3 }}
                    className="group glass rounded-2xl overflow-hidden hover:border-primary/50 transition-all duration-300"
                  >
                    {/* Preview thumbnail */}
                    <div className="slide-preview bg-gradient-to-br from-primary/10 via-muted to-secondary/10 flex items-center justify-center">
                      <div className="text-center p-6">
                        <Presentation className="w-12 h-12 mx-auto mb-3 text-primary/40" />
                        <span className="text-sm text-muted-foreground">{pres.slidesCount} slides</span>
                      </div>
                    </div>

                    <div className="p-5">
                      <h3 className="font-semibold mb-2 line-clamp-1 group-hover:text-primary transition-colors">
                        {pres.topic}
                      </h3>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                        <Clock className="w-4 h-4" />
                        {formatDate(pres.createdAt)}
                      </div>

                      <div className="flex items-center gap-2">
                        <Link
                          href={`/presentation/${pres.id}`}
                          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary/20 rounded-lg text-primary text-sm font-medium transition-colors"
                        >
                          <Edit3 className="w-4 h-4" />
                          Edit
                        </Link>
                        <Link
                          href={`/presentation/${pres.id}/view`}
                          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-secondary/10 hover:bg-secondary/20 rounded-lg text-secondary text-sm font-medium transition-colors"
                        >
                          <Presentation className="w-4 h-4" />
                          View
                        </Link>
                        <button
                          onClick={() => deletePresentation(pres.id)}
                          className="p-2 text-muted-foreground hover:text-accent hover:bg-accent/10 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </motion.section>
      </div>

      <CreatePresentationModal 
        isOpen={showCreateModal} 
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          setShowCreateModal(false);
          fetchPresentations();
        }}
      />
    </main>
  );
}

