/**
 * Placeholders de erro para comprovantes que falharam na conversão
 * Usando btoa() para codificar em base64 (funciona no navegador)
 */

// SVG de erro de conversão
const PDF_ERROR_SVG = `<svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#f0f0f0" stroke-width="0.5"/>
    </pattern>
  </defs>
  <rect width="400" height="300" fill="#fefce8"/>
  <rect width="400" height="300" fill="url(#grid)"/>
  <rect x="20" y="20" width="360" height="260" fill="white" stroke="#fbbf24" stroke-width="2" stroke-dasharray="5,5"/>
  <g transform="translate(200, 120)">
    <circle cx="0" cy="-30" r="4" fill="#f59e0b"/>
    <path d="M 0 -24 L 0 20" stroke="#f59e0b" stroke-width="3" stroke-linecap="round"/>
    <path d="M -8 14 L 0 20 L 8 14" fill="#f59e0b"/>
  </g>
  <text x="200" y="170" font-size="16" font-weight="bold" fill="#d97706" text-anchor="middle">Erro na Conversão</text>
  <text x="200" y="195" font-size="12" fill="#b45309" text-anchor="middle">Não foi possível converter o PDF</text>
  <text x="200" y="215" font-size="11" fill="#7c2d12" text-anchor="middle">Verifique o arquivo e tente novamente</text>
</svg>`;

// SVG de arquivo não disponível
const IMAGE_ERROR_SVG = `<svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="grid2" width="20" height="20" patternUnits="userSpaceOnUse">
      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#f0f0f0" stroke-width="0.5"/>
    </pattern>
  </defs>
  <rect width="400" height="300" fill="#fee2e2"/>
  <rect width="400" height="300" fill="url(#grid2)"/>
  <rect x="20" y="20" width="360" height="260" fill="white" stroke="#ef4444" stroke-width="2" stroke-dasharray="5,5"/>
  <g transform="translate(200, 120)">
    <circle cx="0" cy="0" r="40" fill="none" stroke="#dc2626" stroke-width="3"/>
    <line x1="-28" y1="-28" x2="28" y2="28" stroke="#dc2626" stroke-width="3" stroke-linecap="round"/>
    <line x1="28" y1="-28" x2="-28" y2="28" stroke="#dc2626" stroke-width="3" stroke-linecap="round"/>
  </g>
  <text x="200" y="185" font-size="14" font-weight="bold" fill="#dc2626" text-anchor="middle">Comprovante Indisponível</text>
  <text x="200" y="210" font-size="11" fill="#991b1b" text-anchor="middle">O arquivo não pode ser processado</text>
</svg>`;

// SVG de carregamento
const LOADING_SVG = `<svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
  <rect width="400" height="300" fill="#f3f4f6"/>
  <rect x="20" y="20" width="360" height="260" fill="white" stroke="#d1d5db" stroke-width="2" stroke-dasharray="5,5"/>
  <g transform="translate(200, 120)">
    <circle cx="0" cy="0" r="30" fill="none" stroke="#3b82f6" stroke-width="3" opacity="0.3"/>
    <circle cx="0" cy="0" r="30" fill="none" stroke="#3b82f6" stroke-width="3" stroke-dasharray="10,15" stroke-linecap="round">
      <animateTransform attributeName="transform" attributeType="XML" type="rotate" from="0" to="360" dur="1.5s" repeatCount="indefinite"/>
    </circle>
  </g>
  <text x="200" y="175" font-size="14" font-weight="bold" fill="#1f2937" text-anchor="middle">Carregando...</text>
  <text x="200" y="200" font-size="11" fill="#6b7280" text-anchor="middle">Processando comprovante</text>
</svg>`;

// Convertendo para base64 usando btoa (disponível no navegador)
export const PDF_CONVERSION_ERROR_PLACEHOLDER = `data:image/svg+xml;base64,${btoa(PDF_ERROR_SVG)}`;
export const IMAGE_UPLOAD_ERROR_PLACEHOLDER = `data:image/svg+xml;base64,${btoa(IMAGE_ERROR_SVG)}`;
export const FILE_LOADING_PENDING = `data:image/svg+xml;base64,${btoa(LOADING_SVG)}`;
