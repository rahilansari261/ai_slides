import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import puppeteer from 'puppeteer';
import { PDFDocument } from 'pdf-lib';
import { ensureDirectoryExists, getTemporaryDirectory } from '../utils/storage.js';
import { extractFontsFromXML } from './fontAnalyzer.service.js';
import { normalizeFontName } from './fontAnalyzer.service.js';

const execAsync = promisify(exec);

// Docker container name (from docker-compose)
const LIBREOFFICE_CONTAINER = process.env.LIBREOFFICE_CONTAINER || 'ai_slides_libreoffice';

/**
 * Create a fontconfig configuration file that aliases variant family names to normalized root families.
 * Similar to FastAPI's _create_font_alias_config function.
 */
function createFontAliasConfig(rawFonts, tempDir) {
  // Build mapping from raw -> normalized where different
  const mappings = {};
  for (const font of rawFonts) {
    const normalized = normalizeFontName(font);
    if (normalized && normalized !== font) {
      mappings[font] = normalized;
    }
  }

  // Create config only if we have mappings
  if (Object.keys(mappings).length === 0) {
    return null;
  }

  const fontsConfPath = path.join(tempDir, `fonts_alias_${Date.now()}.conf`);
  
  let configContent = `<?xml version='1.0'?>
<!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">
<fontconfig>
  <include>/etc/fonts/fonts.conf</include>
`;

  for (const [src, dst] of Object.entries(mappings)) {
    // Escape XML special characters
    const escapedSrc = src.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const escapedDst = dst.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    
    configContent += `
  <match target="pattern">
    <test name="family" compare="eq">
      <string>${escapedSrc}</string>
    </test>
    <edit name="family" mode="assign" binding="strong">
      <string>${escapedDst}</string>
    </edit>
  </match>
`;
  }

  configContent += '\n</fontconfig>\n';

  fs.writeFileSync(fontsConfPath, configContent, 'utf-8');
  return fontsConfPath;
}

/**
 * Convert a PPTX file to PDF using LibreOffice in Docker container.
 * Returns the absolute path to the generated PDF.
 * 
 * @param {string} pptxPath - Path to the PPTX file
 * @param {string} outputDir - Directory where PDF should be saved
 * @param {Array<string>} slideXMLs - Optional array of slide XML contents for font extraction
 */
async function convertPptxToPdfWithLibreOffice(pptxPath, outputDir, slideXMLs = null) {
  try {
    // Ensure directory exists on host
    ensureDirectoryExists(outputDir);
    
    // Verify directory was created and is accessible
    if (!fs.existsSync(outputDir)) {
      throw new Error(`Failed to create output directory: ${outputDir}`);
    }
    
    // Wait a moment for file system sync (especially important for Docker volumes)
    await new Promise(resolve => setTimeout(resolve, 100));

    // Ensure paths are absolute for Docker volume mounting
    const absPptxPath = path.resolve(pptxPath);
    const absOutputDir = path.resolve(outputDir);

    // Get the backend temp directory root (where docker volume is mounted)
    // This should match the docker-compose volume mount: ./backend/temp:/tmp/processing
    const tempRoot = path.resolve(getTemporaryDirectory());
    
    // Verify tempRoot is within the expected structure
    if (!fs.existsSync(tempRoot)) {
      throw new Error(`Temporary directory root does not exist: ${tempRoot}. This should match the Docker volume mount.`);
    }
    
    // Extract fonts from slide XMLs if provided (for font config)
    let fontsConfPath = null;
    if (slideXMLs && slideXMLs.length > 0) {
      console.log('[ScreenshotGenerator] Extracting fonts from slide XMLs for font config...');
      const rawFonts = new Set();
      for (const xmlContent of slideXMLs) {
        const slideFonts = await extractFontsFromXML(xmlContent);
        slideFonts.forEach(font => rawFonts.add(font));
      }
      
      if (rawFonts.size > 0) {
        fontsConfPath = createFontAliasConfig(Array.from(rawFonts), outputDir);
        if (fontsConfPath) {
          console.log(`[ScreenshotGenerator] Created font alias config: ${fontsConfPath}`);
        }
      }
    }
    
    // Copy PPTX file to the output directory if needed
    const pptxFilename = path.basename(pptxPath);
    const pptxInSharedDir = path.join(outputDir, pptxFilename);
    
    // Ensure output directory has correct permissions (readable/writable by all)
    fs.chmodSync(outputDir, 0o755);
    
    // Copy file to outputDir if it's not already there
    if (absPptxPath !== pptxInSharedDir) {
      console.log(`[ScreenshotGenerator] Copying PPTX from ${absPptxPath} to ${pptxInSharedDir}`);
      fs.copyFileSync(absPptxPath, pptxInSharedDir);
      // Ensure file is readable by all (chmod 644)
      fs.chmodSync(pptxInSharedDir, 0o644);
      
      // Force sync to ensure file is written to disk
      const fd = fs.openSync(pptxInSharedDir, 'r+');
      fs.fsyncSync(fd);
      fs.closeSync(fd);
    } else {
      // Even if file is already there, ensure permissions are correct
      fs.chmodSync(pptxInSharedDir, 0o644);
    }

    // Verify the file exists after copying
    if (!fs.existsSync(pptxInSharedDir)) {
      throw new Error(`PPTX file not found after copy: ${pptxInSharedDir}`);
    }
    
    // Verify file is readable and get file stats
    try {
      fs.accessSync(pptxInSharedDir, fs.constants.R_OK);
      const stats = fs.statSync(pptxInSharedDir);
      console.log(`[ScreenshotGenerator] File copied successfully. Size: ${stats.size} bytes, Mode: ${stats.mode.toString(8)}`);
    } catch (accessError) {
      throw new Error(`PPTX file is not readable: ${pptxInSharedDir}. Error: ${accessError.message}`);
    }
    
    // Wait longer for Docker volume sync after file operations
    await new Promise(resolve => setTimeout(resolve, 500));

    // Calculate relative path from temp root to the output directory
    // backend/temp is mounted at /tmp/processing in the container
    const relativePath = path.relative(tempRoot, absOutputDir);
    const containerOutputDir = relativePath 
      ? `/tmp/processing/${relativePath.replace(/\\/g, '/')}` 
      : '/tmp/processing';
    const containerPptxPath = `${containerOutputDir}/${pptxFilename}`;
    
    // Verify file and directory exist in container before attempting conversion
    console.log(`[ScreenshotGenerator] Verifying file exists in container: ${containerPptxPath}`);
    try {
      // First, verify the directory exists on the host
      console.log(`[ScreenshotGenerator] Verifying directory exists on host: ${absOutputDir}`);
      if (!fs.existsSync(absOutputDir)) {
        throw new Error(`Output directory does not exist on host: ${absOutputDir}`);
      }
      
      // Verify the base mount point exists in container
      const verifyMountCommand = `docker exec ${LIBREOFFICE_CONTAINER} sh -c "test -d /tmp/processing && echo 'MOUNT_EXISTS' || echo 'MOUNT_NOT_FOUND'"`;
      let mountStatus = '';
      try {
        const { stdout: mountOutput } = await execAsync(verifyMountCommand);
        mountStatus = mountOutput.trim();
      } catch (e) {
        throw new Error(`Failed to verify Docker volume mount. Container may not be running or accessible. Error: ${e.message}`);
      }
      
      if (mountStatus !== 'MOUNT_EXISTS') {
        throw new Error(
          `Docker volume mount /tmp/processing does not exist in container. ` +
          `Verify docker-compose.yml volume mount (./backend/temp:/tmp/processing) is correct and container is running.`
        );
      }
      
      // Wait a bit more for Docker volume sync
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Check if directory exists in container
      const verifyDirCommand = `docker exec ${LIBREOFFICE_CONTAINER} sh -c "test -d '${containerOutputDir}' && echo 'DIR_EXISTS' || echo 'DIR_NOT_FOUND'"`;
      const { stdout: dirOutput } = await execAsync(verifyDirCommand);
      if (dirOutput.trim() !== 'DIR_EXISTS') {
        // Try to create the directory structure in the container
        // This should work if the volume mount is correct
        console.log(`[ScreenshotGenerator] Directory not found in container, attempting to create: ${containerOutputDir}`);
        try {
          const createDirCommand = `docker exec ${LIBREOFFICE_CONTAINER} sh -c "mkdir -p '${containerOutputDir}' && chmod 755 '${containerOutputDir}'"`;
          await execAsync(createDirCommand);
          // Wait a moment for sync
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Verify it was created
          const { stdout: verifyAfterCreate } = await execAsync(verifyDirCommand);
          if (verifyAfterCreate.trim() !== 'DIR_EXISTS') {
            throw new Error('Directory creation in container failed');
          }
          console.log(`[ScreenshotGenerator] Successfully created directory in container`);
        } catch (createError) {
          // If creation failed, gather diagnostic info
          const listRootCommand = `docker exec ${LIBREOFFICE_CONTAINER} sh -c "ls -la /tmp/processing | head -20"`;
          let rootContents = '';
          try {
            const { stdout: rootOutput } = await execAsync(listRootCommand);
            rootContents = rootOutput;
          } catch (e) {
            rootContents = `Error listing: ${e.message}`;
          }
          
          // Also check the parent directory
          const parentDir = path.dirname(containerOutputDir);
          const verifyParentCommand = `docker exec ${LIBREOFFICE_CONTAINER} sh -c "test -d '${parentDir}' && echo 'PARENT_EXISTS' || echo 'PARENT_NOT_FOUND'"`;
          let parentStatus = '';
          try {
            const { stdout: parentOutput } = await execAsync(verifyParentCommand);
            parentStatus = parentOutput.trim();
          } catch (e) {
            parentStatus = `Error: ${e.message}`;
          }
          
          throw new Error(
            `Output directory not found in container at ${containerOutputDir} and failed to create it. ` +
            `Host path: ${absOutputDir}, Container path: ${containerOutputDir}, ` +
            `Parent directory status: ${parentStatus}, ` +
            `/tmp/processing contents: ${rootContents}. ` +
            `Verify Docker volume mount (./backend/temp:/tmp/processing) is working correctly. ` +
            `Creation error: ${createError.message}`
          );
        }
      }
      
      // Check if file exists and is readable (with retry mechanism)
      let fileVerified = false;
      let lastError = null;
      const maxRetries = 5;
      const retryDelay = 300; // 300ms between retries
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const verifyFileCommand = `docker exec ${LIBREOFFICE_CONTAINER} sh -c "test -f '${containerPptxPath}' && test -r '${containerPptxPath}' && echo 'FILE_EXISTS' || echo 'FILE_NOT_FOUND'"`;
        try {
          const { stdout: fileOutput } = await execAsync(verifyFileCommand);
          if (fileOutput.trim() === 'FILE_EXISTS') {
            // Also verify file size matches
            const sizeCommand = `docker exec ${LIBREOFFICE_CONTAINER} sh -c "stat -c%s '${containerPptxPath}' 2>/dev/null || echo '0'"`;
            const { stdout: sizeOutput } = await execAsync(sizeCommand);
            const containerSize = parseInt(sizeOutput.trim(), 10);
            const hostStats = fs.statSync(pptxInSharedDir);
            
            if (containerSize === hostStats.size && containerSize > 0) {
              fileVerified = true;
              console.log(`[ScreenshotGenerator] File verified in container (attempt ${attempt}/${maxRetries}). Size: ${containerSize} bytes`);
              break;
            } else {
              console.log(`[ScreenshotGenerator] File size mismatch (attempt ${attempt}/${maxRetries}). Host: ${hostStats.size}, Container: ${containerSize}`);
              lastError = `File size mismatch: host=${hostStats.size}, container=${containerSize}`;
            }
          } else {
            console.log(`[ScreenshotGenerator] File not found in container (attempt ${attempt}/${maxRetries})`);
            lastError = 'File not found or not readable';
          }
        } catch (verifyError) {
          console.log(`[ScreenshotGenerator] File verification error (attempt ${attempt}/${maxRetries}):`, verifyError.message);
          lastError = verifyError.message;
        }
        
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
      
      if (!fileVerified) {
        // Try to copy file directly into container using docker cp as a workaround
        // This bypasses potential volume mount sync issues
        console.log(`[ScreenshotGenerator] File not visible in container, attempting direct copy via docker cp...`);
        try {
          // Use docker cp to copy file from host to container
          // This is more reliable than volume mounts for file sync
          const dockerCpCommand = `docker cp "${pptxInSharedDir}" ${LIBREOFFICE_CONTAINER}:${containerPptxPath}`;
          await execAsync(dockerCpCommand);
          
          // Set correct permissions in container
          const chmodCommand = `docker exec ${LIBREOFFICE_CONTAINER} sh -c "chmod 644 '${containerPptxPath}'"`;
          await execAsync(chmodCommand);
          
          // Verify it worked
          await new Promise(resolve => setTimeout(resolve, 200));
          const verifyAfterCopy = `docker exec ${LIBREOFFICE_CONTAINER} sh -c "test -f '${containerPptxPath}' && test -r '${containerPptxPath}' && echo 'FILE_EXISTS' || echo 'FILE_NOT_FOUND'"`;
          const { stdout: afterCopyOutput } = await execAsync(verifyAfterCopy);
          
          if (afterCopyOutput.trim() === 'FILE_EXISTS') {
            console.log(`[ScreenshotGenerator] Successfully copied file directly to container using docker cp`);
            fileVerified = true;
          } else {
            throw new Error('Direct copy to container failed - file still not found after docker cp');
          }
        } catch (copyError) {
          console.error(`[ScreenshotGenerator] Direct copy to container failed:`, copyError);
          
          // List files in directory for debugging
          const listFilesCommand = `docker exec ${LIBREOFFICE_CONTAINER} sh -c "ls -la '${containerOutputDir}'"`;
          let listOutput = '';
          try {
            const { stdout: listResult } = await execAsync(listFilesCommand);
            listOutput = listResult;
          } catch (e) {
            listOutput = `Error listing: ${e.message}`;
          }
          
          // Also check host directory
          let hostFiles = [];
          try {
            hostFiles = fs.readdirSync(absOutputDir);
          } catch (e) {
            hostFiles = [`Error reading: ${e.message}`];
          }
          
          // Check permissions on host
          let hostPerms = '';
          try {
            const stats = fs.statSync(pptxInSharedDir);
            hostPerms = `Mode: ${stats.mode.toString(8)}, UID: ${stats.uid}, GID: ${stats.gid}`;
          } catch (e) {
            hostPerms = `Error: ${e.message}`;
          }
          
          throw new Error(
            `PPTX file not found or not readable in container after ${maxRetries} attempts and direct copy failed. ` +
            `Container path: ${containerPptxPath}, Host path: ${pptxInSharedDir}. ` +
            `Last error: ${lastError}. ` +
            `Files in container: ${listOutput}. ` +
            `Files on host: ${hostFiles.join(', ')}. ` +
            `Host file permissions: ${hostPerms}. ` +
            `Verify Docker volume mount (./backend/temp:/tmp/processing) and ensure container has read access. ` +
            `Copy error: ${copyError.message}`
          );
        }
      }
      
      console.log(`[ScreenshotGenerator] File and directory verified in container`);
    } catch (verifyError) {
      console.error(`[ScreenshotGenerator] File verification error:`, verifyError);
      throw new Error(`Failed to verify PPTX file in container: ${verifyError.message}`);
    }

    // If font config exists, calculate its container path and set FONTCONFIG_FILE
    let containerFontsConfPath = null;
    if (fontsConfPath) {
      const fontsConfRelativePath = path.relative(tempRoot, fontsConfPath);
      containerFontsConfPath = fontsConfRelativePath
        ? `/tmp/processing/${fontsConfRelativePath.replace(/\\/g, '/')}`
        : `/tmp/processing/${path.basename(fontsConfPath)}`;
    }

    console.log('[ScreenshotGenerator] Starting LibreOffice PDF conversion via Docker...');
    console.log(`[ScreenshotGenerator] Container: ${LIBREOFFICE_CONTAINER}`);
    console.log(`[ScreenshotGenerator] Temp root (host): ${tempRoot}`);
    console.log(`[ScreenshotGenerator] Output dir (host): ${absOutputDir}`);
    console.log(`[ScreenshotGenerator] PPTX path in container: ${containerPptxPath}`);
    console.log(`[ScreenshotGenerator] Output dir in container: ${containerOutputDir}`);
    if (containerFontsConfPath) {
      console.log(`[ScreenshotGenerator] Font config in container: ${containerFontsConfPath}`);
    }

    // Ensure output directory is writable in container
    console.log(`[ScreenshotGenerator] Ensuring output directory is writable in container...`);
    try {
      const chmodDirCommand = `docker exec ${LIBREOFFICE_CONTAINER} sh -c "chmod 755 '${containerOutputDir}'"`;
      await execAsync(chmodDirCommand);
    } catch (chmodError) {
      console.warn(`[ScreenshotGenerator] Warning: Could not set directory permissions: ${chmodError.message}`);
    }

    // Build Docker exec command with optional FONTCONFIG_FILE
    // Use absolute paths for both input and output to avoid path issues
    let dockerCommand = `docker exec`;
    if (containerFontsConfPath) {
      dockerCommand += ` -e FONTCONFIG_FILE="${containerFontsConfPath}"`;
    }
    // Use absolute paths - this is more reliable than relative paths
    dockerCommand += ` ${LIBREOFFICE_CONTAINER} libreoffice --headless --convert-to pdf --outdir "${containerOutputDir}" "${containerPptxPath}"`;

    console.log(`[ScreenshotGenerator] Executing LibreOffice command: ${dockerCommand}`);

    try {
      const { stdout, stderr } = await execAsync(dockerCommand, {
        timeout: 500000, // 500 seconds
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });

      console.log('[ScreenshotGenerator] LibreOffice PDF conversion stdout:', stdout);
      console.log('[ScreenshotGenerator] LibreOffice PDF conversion stderr:', stderr);
      
      // Check if LibreOffice actually succeeded by looking for success indicators
      const stdoutLower = (stdout || '').toLowerCase();
      const stderrLower = (stderr || '').toLowerCase();
      
      // LibreOffice may output errors to stderr even on partial success
      if (stderr) {
        if (stderrLower.includes('error: source file could not be loaded') ||
            stderrLower.includes('could not be loaded') ||
            (stderrLower.includes('error') && !stderrLower.includes('application'))) {
          console.error('[ScreenshotGenerator] LibreOffice conversion error detected:', stderr);
          throw new Error(`LibreOffice conversion failed: ${stderr}`);
        } else {
          console.warn('[ScreenshotGenerator] LibreOffice warnings (non-fatal):', stderr);
        }
      }
      
      // Check if conversion was successful by looking for output messages
      if (stdout && (stdoutLower.includes('convert') || stdoutLower.includes('pdf'))) {
        console.log('[ScreenshotGenerator] LibreOffice conversion appears successful');
      }
    } catch (execError) {
      // Check if it's a Docker-related error
      if (execError.message.includes('No such container')) {
        throw new Error(
          `LibreOffice Docker container '${LIBREOFFICE_CONTAINER}' not found. Please start it with: docker compose up -d libreoffice`
        );
      }
      if (execError.message.includes('Cannot connect to the Docker daemon')) {
        throw new Error(
          'Cannot connect to Docker daemon. Make sure Docker is running and the current user has permission to access it.'
        );
      }
      console.error('[ScreenshotGenerator] Docker exec error:', execError.message);
      if (execError.stderr) {
        console.error('[ScreenshotGenerator] Error stderr:', execError.stderr);
      }
      if (execError.stdout) {
        console.error('[ScreenshotGenerator] Error stdout:', execError.stdout);
      }
      throw new Error(`LibreOffice conversion command failed: ${execError.message}`);
    }

    // Wait longer for file system sync and LibreOffice to finish writing
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Look for any PDF generated in the output directory
    // LibreOffice generates PDF with the same base name as the PPTX
    const pdfBaseName = path.basename(pptxFilename, path.extname(pptxFilename));
    const expectedPdfName = `${pdfBaseName}.pdf`;
    const expectedPdfPath = path.join(outputDir, expectedPdfName);
    const containerPdfPath = `${containerOutputDir}/${expectedPdfName}`;
    
    // First check in container if PDF exists
    console.log(`[ScreenshotGenerator] Checking for PDF in container: ${containerPdfPath}`);
    let pdfExistsInContainer = false;
    try {
      const checkPdfCommand = `docker exec ${LIBREOFFICE_CONTAINER} sh -c "test -f '${containerPdfPath}' && echo 'PDF_EXISTS' || echo 'PDF_NOT_FOUND'"`;
      const { stdout: pdfCheckOutput } = await execAsync(checkPdfCommand);
      if (pdfCheckOutput.trim() === 'PDF_EXISTS') {
        pdfExistsInContainer = true;
        console.log(`[ScreenshotGenerator] PDF found in container, waiting for sync...`);
        // Wait a bit more for volume sync
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (e) {
      console.warn(`[ScreenshotGenerator] Could not check PDF in container: ${e.message}`);
    }
    
    // Check for the expected PDF name on host
    if (fs.existsSync(expectedPdfPath)) {
      const stats = fs.statSync(expectedPdfPath);
      if (stats.size > 0) {
        console.log(
          `[ScreenshotGenerator] LibreOffice PDF conversion completed: ${expectedPdfPath} (${stats.size} bytes)`
        );
        return expectedPdfPath;
      } else {
        console.warn(`[ScreenshotGenerator] PDF file exists but is empty: ${expectedPdfPath}`);
      }
    }

    // Fallback: look for any PDF in the directory
    const pdfFiles = fs
      .readdirSync(outputDir)
      .filter((f) => f.toLowerCase().endsWith('.pdf'));

    if (pdfFiles.length > 0) {
      // Check if any PDF has content
      for (const pdfFile of pdfFiles) {
        const pdfPath = path.join(outputDir, pdfFile);
        const stats = fs.statSync(pdfPath);
        if (stats.size > 0) {
          console.log(
            `[ScreenshotGenerator] LibreOffice PDF conversion completed: ${pdfPath} (${stats.size} bytes)`
          );
          return pdfPath;
        }
      }
    }

    // If PDF exists in container but not on host, copy it using docker cp
    if (pdfExistsInContainer) {
      console.log(`[ScreenshotGenerator] PDF exists in container but not on host, copying via docker cp...`);
      try {
        const dockerCpCommand = `docker cp ${LIBREOFFICE_CONTAINER}:${containerPdfPath} "${expectedPdfPath}"`;
        await execAsync(dockerCpCommand);
        
        // Verify it was copied
        if (fs.existsSync(expectedPdfPath)) {
          const stats = fs.statSync(expectedPdfPath);
          if (stats.size > 0) {
            console.log(
              `[ScreenshotGenerator] Successfully copied PDF from container: ${expectedPdfPath} (${stats.size} bytes)`
            );
            return expectedPdfPath;
          }
        }
      } catch (copyError) {
        console.error(`[ScreenshotGenerator] Failed to copy PDF from container:`, copyError);
      }
    }

    // If no PDF found, list all files and check container
    const allFiles = fs.readdirSync(outputDir);
    console.error('[ScreenshotGenerator] No PDF found. Files in output directory:', allFiles);
    
    // Also check what's in the container
    let containerFiles = '';
    try {
      const listContainerCommand = `docker exec ${LIBREOFFICE_CONTAINER} sh -c "ls -la '${containerOutputDir}'"`;
      const { stdout: containerList } = await execAsync(listContainerCommand);
      containerFiles = containerList;
      console.error('[ScreenshotGenerator] Files in container directory:', containerFiles);
    } catch (e) {
      containerFiles = `Error listing: ${e.message}`;
    }
    
    throw new Error(
      `LibreOffice PPTX to PDF conversion completed but no PDF was found in output directory: ${absOutputDir}. ` +
      `Files on host: ${allFiles.join(', ')}. ` +
      `Files in container: ${containerFiles}. ` +
      `Expected PDF: ${expectedPdfName}. ` +
      `PDF exists in container: ${pdfExistsInContainer}. ` +
      `Verify LibreOffice has write permissions to ${containerOutputDir} and that the conversion succeeded.`
    );
  } catch (error) {
    throw new Error(
      `Unexpected error during PPTX to PDF conversion: ${error.message}`
    );
  }
}

/**
 * Generate screenshots from a PDF file, one image per page, using Puppeteer.
 * Uses PDF.js with proper page navigation and canvas clearing, similar to FastAPI's pdfplumber approach.
 */
async function generateScreenshotsFromPdf(pdfPath, outputDir) {
  const screenshots = [];
  let browser = null;

  try {
    ensureDirectoryExists(outputDir);

    // Read PDF to know how many pages we have
    const pdfBytes = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pageCount = pdfDoc.getPageCount();

    console.log(
      `[ScreenshotGenerator] Generating screenshots from PDF (${pageCount} page(s))...`
    );

    // Convert PDF to base64 data URL
    const pdfBase64 = pdfBytes.toString('base64');

    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setViewport({
      width: 1280,
      height: 720,
      deviceScaleFactor: 2,
    });

    // Load PDF.js library once and set up the PDF document
    const pdfjsLibPath = path.join(process.cwd(), 'node_modules', 'pdfjs-dist', 'build', 'pdf.min.js');
    const pdfjsWorkerPath = path.join(process.cwd(), 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.js');
    
    // Check if pdfjs-dist is available, otherwise use CDN
    const useLocalPdfjs = fs.existsSync(pdfjsLibPath);
    
    const pdfjsLibUrl = useLocalPdfjs 
      ? `file://${pdfjsLibPath}`
      : 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    const pdfjsWorkerUrl = useLocalPdfjs
      ? `file://${pdfjsWorkerPath}`
      : 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    // Create initial HTML with PDF.js
    const initialHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      width: 1280px;
      height: 720px;
      overflow: hidden;
      background: white;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    #pdf-container {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    canvas {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }
  </style>
  <script src="${pdfjsLibUrl}"></script>
</head>
<body>
  <div id="pdf-container">
    <canvas id="pdf-canvas"></canvas>
  </div>
  <script>
    const pdfBase64 = '${pdfBase64}';
    let pdfDoc = null;
    let currentPage = null;
    
    pdfjsLib.GlobalWorkerOptions.workerSrc = '${pdfjsWorkerUrl}';
    
    // Load PDF document once
    const pdfData = atob(pdfBase64);
    const uint8Array = new Uint8Array(pdfData.length);
    for (let i = 0; i < pdfData.length; i++) {
      uint8Array[i] = pdfData.charCodeAt(i);
    }
    
    pdfjsLib.getDocument({ data: uint8Array }).promise.then(function(pdf) {
      pdfDoc = pdf;
      window.pdfLoaded = true;
    }).catch(function(error) {
      console.error('PDF loading error:', error);
      window.pdfError = error.message;
    });
    
    // Function to render a specific page
    window.renderPage = function(pageNumber) {
      return new Promise(function(resolve, reject) {
        if (!pdfDoc) {
          reject(new Error('PDF not loaded yet'));
          return;
        }
        
        pdfDoc.getPage(pageNumber).then(function(page) {
          const viewport = page.getViewport({ scale: 2.0 });
          const canvas = document.getElementById('pdf-canvas');
          const context = canvas.getContext('2d');
          
          // Clear canvas
          context.clearRect(0, 0, canvas.width, canvas.height);
          
          // Set canvas dimensions
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          
          const renderContext = {
            canvasContext: context,
            viewport: viewport
          };
          
          page.render(renderContext).promise.then(function() {
            resolve();
          }).catch(function(error) {
            reject(error);
          });
        }).catch(function(error) {
          reject(error);
        });
      });
    };
  </script>
</body>
</html>`;

    await page.setContent(initialHtml, { waitUntil: 'networkidle0' });
    
    // Wait for PDF to load
    await page.evaluate(() => {
      return new Promise((resolve, reject) => {
        const checkLoaded = setInterval(() => {
          if (window.pdfLoaded) {
            clearInterval(checkLoaded);
            resolve();
          } else if (window.pdfError) {
            clearInterval(checkLoaded);
            reject(new Error(window.pdfError));
          }
        }, 100);
        
        setTimeout(() => {
          clearInterval(checkLoaded);
          reject(new Error('PDF loading timeout'));
        }, 30000);
      });
    });

    // Render each page
    for (let i = 0; i < pageCount; i++) {
      const slideNumber = i + 1;
      const pageNumber = i + 1; // PDF.js uses 1-based page numbers
      
      console.log(`[ScreenshotGenerator] Rendering page ${pageNumber} of ${pageCount}...`);
      
      // Render the page
      await page.evaluate((pageNum) => {
        return window.renderPage(pageNum);
      }, pageNumber);
      
      // Wait a bit for rendering to complete
      await page.waitForTimeout(1000);
      
      const screenshotPath = path.join(outputDir, `slide_${slideNumber}.png`);
      
      await page.screenshot({
        path: screenshotPath,
        type: 'png',
        fullPage: false,
        clip: {
          x: 0,
          y: 0,
          width: 1280,
          height: 720,
        },
      });
      
      screenshots.push(screenshotPath);
      console.log(
        `[ScreenshotGenerator] Generated screenshot for slide ${slideNumber} -> ${screenshotPath}`
      );
    }

    return screenshots;
  } catch (error) {
    console.error(
      '[ScreenshotGenerator] Error generating screenshots from PDF:',
      error
    );
    throw new Error(`Failed to generate screenshots from PDF: ${error.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * High-level helper: generate PPTX slide screenshots using LibreOffice + PDF rendering.
 * This more closely matches the FastAPI implementation that does PPTX -> PDF -> PNG.
 * 
 * @param {string} pptxPath - Path to the PPTX file
 * @param {string} outputDir - Directory where screenshots should be saved
 * @param {Array<string>} slideXMLs - Optional array of slide XML contents for font extraction
 */
export async function generateScreenshotsFromPPTX(pptxPath, outputDir, slideXMLs = null) {
  // 1) Convert PPTX to PDF (with font config if slide XMLs provided)
  const pdfPath = await convertPptxToPdfWithLibreOffice(pptxPath, outputDir, slideXMLs);
  // 2) Generate screenshots from PDF
  return await generateScreenshotsFromPdf(pdfPath, outputDir);
}

/**
 * Get the number of slides in a PPTX file
 */
async function getSlideCount(pptxPath) {
  try {
    const unzipper = await import('unzipper');
    const directory = await unzipper.Open.file(pptxPath);
    
    // Count slide files in ppt/slides/
    const slideFiles = directory.files.filter(
      file => file.path.match(/^ppt\/slides\/slide\d+\.xml$/)
    );
    
    return slideFiles.length;
  } catch (error) {
    console.error('Error counting slides:', error);
    return 0;
  }
}

/**
 * Create a placeholder HTML for a slide
 * In production, this should parse the actual PPTX XML and render the content
 */
function createPlaceholderSlideHTML(slideNumber) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          width: 1280px;
          height: 720px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          font-family: 'Arial', sans-serif;
          color: white;
          overflow: hidden;
        }
        .slide-content {
          text-align: center;
          padding: 40px;
        }
        h1 {
          font-size: 48px;
          margin-bottom: 20px;
          text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        p {
          font-size: 24px;
          opacity: 0.9;
        }
      </style>
    </head>
    <body>
      <div class="slide-content">
        <h1>Slide ${slideNumber}</h1>
        <p>Screenshot generated from PPTX</p>
        <p style="margin-top: 20px; font-size: 18px; opacity: 0.7;">
          This is a placeholder. In production, actual slide content would be rendered.
        </p>
      </div>
    </body>
    </html>
  `;
}

/**
 * Alternative: Generate screenshots using XML parsing and HTML rendering
 * This is a more advanced approach that parses PPTX XML and renders actual content
 */
export async function generateScreenshotsFromXML(slideXMLs, outputDir) {
  const screenshots = [];
  let browser = null;

  try {
    ensureDirectoryExists(outputDir);

    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setViewport({
      width: 1280,
      height: 720,
      deviceScaleFactor: 2,
    });

    for (let i = 0; i < slideXMLs.length; i++) {
      const slideNumber = i + 1;
      const xmlContent = slideXMLs[i];
      
      // Parse XML and create HTML (simplified version)
      const html = await convertXMLToHTML(xmlContent, slideNumber);
      
      await page.setContent(html, { waitUntil: 'networkidle0' });
      
      const screenshotPath = path.join(outputDir, `slide_${slideNumber}.png`);
      
      await page.screenshot({
        path: screenshotPath,
        type: 'png',
        fullPage: false,
      });
      
      screenshots.push(screenshotPath);
    }

    return screenshots;
  } catch (error) {
    console.error('Error generating screenshots from XML:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Convert PPTX XML to HTML (simplified version)
 * In production, this would be much more sophisticated
 */
async function convertXMLToHTML(xmlContent, slideNumber) {
  // Basic extraction of text content from XML
  const textMatches = xmlContent.match(/<a:t>([^<]+)<\/a:t>/g) || [];
  const texts = textMatches.map(match => match.replace(/<\/?a:t>/g, ''));
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          width: 1280px;
          height: 720px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: white;
          font-family: 'Arial', sans-serif;
          padding: 60px;
        }
        .text-content {
          text-align: center;
          width: 100%;
        }
        .text-item {
          margin: 20px 0;
          font-size: 24px;
          color: #333;
        }
      </style>
    </head>
    <body>
      <div class="text-content">
        ${texts.map(text => `<div class="text-item">${text}</div>`).join('')}
      </div>
    </body>
    </html>
  `;
}

