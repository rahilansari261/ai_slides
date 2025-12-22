import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

import { connectDatabase } from './config/database.js';
import presentationRoutes from './routes/presentation.routes.js';
import templateRoutes from './routes/template.routes.js';
import customTemplateRoutes from './routes/customTemplate.routes.js';
import slideToHtmlRoutes from './routes/slideToHtml.routes.js';
import { getImagesDirectory } from './utils/storage.js';

config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5002;

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files for presentations
const storagePath = process.env.STORAGE_PATH || './presentations';
if (!fs.existsSync(storagePath)) {
  fs.mkdirSync(storagePath, { recursive: true });
}
app.use('/presentations', express.static(storagePath));

// Static files for custom template images
const imagesPath = getImagesDirectory();
app.use('/app_data/images', express.static(imagesPath));

// Routes
app.use('/api/presentations', presentationRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/custom-templates', customTemplateRoutes);
app.use('/api', slideToHtmlRoutes);

// Template endpoint for FastAPI compatibility
// GET /api/template?group={layout_name}
// This endpoint is called by FastAPI's get_layout_by_name()
app.get('/api/template', async (req, res) => {
  try {
    const { group } = req.query;
    
    if (!group) {
      return res.status(400).json({ error: 'Template group name is required' });
    }

    const { getLayoutByName } = await import('./services/templateRetrieval.service.js');
    const layout = await getLayoutByName(group);
    
    res.json(layout);
  } catch (error) {
    console.error('Error getting template:', error);
    res.status(404).json({ error: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Start server
const startServer = async () => {
  try {
    // Connect to PostgreSQL
    await connectDatabase();
    
    // Start Express server
    app.listen(PORT, () => {
      console.log(`🚀 AI Slides Backend running on http://localhost:${PORT}`);
      console.log(`📊 Presentations stored in: ${path.resolve(storagePath)}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

