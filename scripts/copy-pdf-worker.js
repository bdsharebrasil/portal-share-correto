import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sourceDir = join(__dirname, '..', 'node_modules', 'pdfjs-dist', 'build');
const targetDir = join(__dirname, '..', 'public');

// Ensure public directory exists
if (!existsSync(targetDir)) {
  mkdirSync(targetDir, { recursive: true });
}

const workerFile = 'pdf.worker.min.mjs';
const sourcePath = join(sourceDir, workerFile);
const targetPath = join(targetDir, workerFile);

try {
  if (existsSync(sourcePath)) {
    copyFileSync(sourcePath, targetPath);
    console.log(`✓ Copied ${workerFile} to public/`);
  } else {
    console.log(`⚠ PDF worker file not found, skipping...`);
  }
} catch (error) {
  console.log(`⚠ Could not copy PDF worker: ${error.message}`);
}
