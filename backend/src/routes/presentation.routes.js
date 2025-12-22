import express from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import {
  generatePresentation,
  getPresentation,
  updatePresentation,
  listPresentations,
  deletePresentation,
  exportPresentation,
  getTemplates,
  createPresentation,
  streamOutlines,
  preparePresentation,
  streamPresentation,
  getPresentationToPptxModel
} from '../controllers/presentation.controller.js';

const router = express.Router();

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = './uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });

// Get available templates
router.get('/templates', getTemplates);

// Create presentation record (matches FastAPI POST /presentation/create)
router.post('/create', createPresentation);

// Stream outline generation (matches FastAPI GET /presentation/outlines/stream/{id})
router.get('/outlines/stream/:id', streamOutlines);

// Prepare presentation with outlines and template (matches FastAPI POST /presentation/prepare)
router.post('/prepare', preparePresentation);

// Stream slide generation (matches FastAPI GET /presentation/stream/{id})
router.get('/stream/:id', streamPresentation);

// Generate a new presentation (legacy endpoint)
router.post('/generate', generatePresentation);

// Get all presentations
router.get('/', listPresentations);

// Convert presentation to PPTX model (matches FastAPI's Next.js service)
// GET /api/presentations/pptx-model?id={presentation_id}
// Must come before /:id route
router.get('/pptx-model', getPresentationToPptxModel);

// Get a specific presentation
router.get('/:id', getPresentation);

// Update a presentation
router.put('/:id', updatePresentation);

// Delete a presentation
router.delete('/:id', deletePresentation);

// Convert presentation to PPTX model (matches FastAPI's Next.js service)
// GET /api/presentations/pptx-model?id={presentation_id}
router.get('/pptx-model', getPresentationToPptxModel);

// Export presentation as PPTX
router.get('/:id/export', exportPresentation);

// Upload files for context
router.post('/upload', upload.array('files', 10), (req, res) => {
  try {
    const files = req.files.map(file => ({
      id: path.parse(file.filename).name,
      originalName: file.originalname,
      path: file.path,
      size: file.size
    }));
    res.json({ files });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

