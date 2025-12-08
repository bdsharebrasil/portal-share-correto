#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function copyPDFWorker() {
  try {
    const dest = path.join(__dirname, '../public/pdf.worker.mjs');

    console.log('🔍 Procurando por pdf.worker.mjs...');
    console.log(`   Destino: ${dest}`);

    // Lista de possíveis localizações do worker
    const possibleSources = [
      // Direto de pdfjs-dist
      path.join(__dirname, '../node_modules/pdfjs-dist/build/pdf.worker.mjs'),
      path.join(__dirname, '../node_modules/pdfjs-dist/build/pdf.worker.min.js'),
      path.join(__dirname, '../node_modules/pdfjs-dist/build/pdf.worker.js'),
      // Via react-pdf
      path.join(__dirname, '../node_modules/react-pdf/node_modules/pdfjs-dist/build/pdf.worker.mjs'),
      path.join(__dirname, '../node_modules/react-pdf/node_modules/pdfjs-dist/build/pdf.worker.min.js'),
      // Fallback para .js se .mjs não existir
      path.join(__dirname, '../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'),
      path.join(__dirname, '../node_modules/pdfjs-dist/legacy/build/pdf.worker.min.js'),
    ];

    let foundSource = null;

    for (const source of possibleSources) {
      console.log(`   Procurando em: ${source}`);
      if (fs.existsSync(source)) {
        console.log(`   ✅ Encontrado!`);
        foundSource = source;
        break;
      }
    }

    if (!foundSource) {
      console.warn('⚠️  Nenhuma versão do pdf.worker foi encontrada localmente.');
      console.warn('   O worker será carregado do CDN (unpkg) em tempo de execução.');
      console.warn('   Isso pode ser mais lento, mas é mais compatível com as versões.');
      return;
    }

    ensureDir(path.dirname(dest));
    fs.copyFileSync(foundSource, dest);
    console.log(`✅ PDF worker copiado com sucesso para: ${dest}`);

  } catch (err) {
    console.error('❌ Erro ao copiar PDF worker:', err instanceof Error ? err.message : String(err));
    // Não fazer exit(1) para permitir que a build continue
    console.warn('⚠️  A build continuará. O worker será carregado do CDN.');
  }
}

copyPDFWorker();
