/**
 * Utilidades para validação e sugestão de altitudes
 * Implementa regras IFR/VFR e hemisféricas
 */

export type FlightRuleType = 'IFR' | 'VFR';

interface AltitudeValidationResult {
  isValid: boolean;
  message: string;
  suggestions?: string[];
  hemisphere?: 'east' | 'west';
}

/**
 * Determina o hemisfério baseado na proa magnética
 * 000° a 179° = Leste (níveis ímpares)
 * 180° a 359° = Oeste (níveis pares)
 */
export function getHemisphere(headingDegrees: number): 'east' | 'west' {
  const normalized = ((headingDegrees % 360) + 360) % 360;
  return normalized < 180 ? 'east' : 'west';
}

/**
 * Extrai o valor numérico de uma altitude
 * Exemplos: "FL085" -> 8500, "A085" -> 8500, "085" -> 8500
 */
export function parseAltitude(altitudeStr: string): number | null {
  const cleaned = altitudeStr.toUpperCase().trim();
  
  // Remove prefixos FL, A, etc
  const numericStr = cleaned.replace(/^[A-Z]+/, '');
  const value = parseInt(numericStr, 10);
  
  if (isNaN(value)) return null;
  
  // Se for formato FL/A (em centenas de pés), converter para pés
  if (cleaned.startsWith('FL') || cleaned.startsWith('A')) {
    return value * 100;
  }
  
  // Se for apenas números, assumir formato de altitude
  return value * 100;
}

/**
 * Formata um valor de altitude para o formato correto
 */
export function formatAltitude(altitudeFt: number, includeFL: boolean = true): string {
  const hundreds = Math.round(altitudeFt / 100);
  const paddedValue = String(hundreds).padStart(3, '0');
  
  return includeFL ? `FL${paddedValue}` : paddedValue;
}

/**
 * Verifica se uma altitude termina em "5" (ex: 085, 075, etc)
 */
export function endsWithFive(altitudeStr: string): boolean {
  const altValue = parseAltitude(altitudeStr);
  if (altValue === null) return false;
  
  const lastDigit = (Math.round(altValue / 100) % 10);
  return lastDigit === 5;
}

/**
 * Verifica se um valor é ímpar (para hemisfério Leste)
 */
export function isOddLevel(altitudeStr: string): boolean {
  const altValue = parseAltitude(altitudeStr);
  if (altValue === null) return false;
  
  const flLevel = Math.round(altValue / 100);
  return flLevel % 2 === 1;
}

/**
 * Verifica se um valor é par (para hemisfério Oeste)
 */
export function isEvenLevel(altitudeStr: string): boolean {
  const altValue = parseAltitude(altitudeStr);
  if (altValue === null) return false;
  
  const flLevel = Math.round(altValue / 100);
  return flLevel % 2 === 0;
}

/**
 * Gera sugestões de altitude baseado em hemisfério e regras
 */
export function generateAltitudeSuggestions(
  hemisphere: 'east' | 'west',
  flightRules: FlightRuleType,
  minFL: number = 25,
  maxFL: number = 150
): string[] {
  const suggestions: string[] = [];
  
  if (hemisphere === 'east') {
    // Leste: níveis ímpares
    for (let fl = minFL; fl <= maxFL; fl += 2) {
      if (fl % 2 === 1) {
        if (flightRules === 'VFR') {
          // VFR pode usar X5 (085, 095, etc)
          suggestions.push(formatAltitude((fl - 1) * 100, true));
          suggestions.push(formatAltitude(fl * 100 + 50, true)); // .5
        } else {
          suggestions.push(formatAltitude(fl * 100, true));
        }
      }
    }
  } else {
    // Oeste: níveis pares
    for (let fl = minFL; fl <= maxFL; fl += 2) {
      if (fl % 2 === 0) {
        if (flightRules === 'VFR') {
          // VFR pode usar X5 (085, 095, etc)
          suggestions.push(formatAltitude(fl * 100, true));
          suggestions.push(formatAltitude(fl * 100 + 50, true)); // .5
        } else {
          suggestions.push(formatAltitude(fl * 100, true));
        }
      }
    }
  }
  
  return suggestions.slice(0, 8); // Retornar até 8 sugestões
}

/**
 * Valida uma altitude baseado em regras IFR/VFR e proa
 */
export function validateAltitude(
  altitudeStr: string,
  heading: number | null,
  flightRules: FlightRuleType
): AltitudeValidationResult {
  // Validação básica
  if (!altitudeStr || altitudeStr.trim() === '') {
    return {
      isValid: false,
      message: 'Altitude não pode estar vazia',
    };
  }

  const altValue = parseAltitude(altitudeStr);
  if (altValue === null) {
    return {
      isValid: false,
      message: 'Formato de altitude inválido. Use FL085, A085 ou 085',
    };
  }

  // Se não há proa calculada, apenas validar formato
  if (heading === null || heading === undefined || isNaN(heading)) {
    return {
      isValid: true,
      message: 'Altua vlída (proa ainda não calculada)',
      suggestions: [],
    };
  }

  const hemisphere = getHemisphere(heading);
  const isVFR = flightRules === 'VFR';
  const isIFR = flightRules === 'IFR';
  const hasDecimal = endsWithFive(altitudeStr);

  // Validações específicas por tipo de voo
  if (isIFR) {
    // IFR: não permite altitudes terminadas em "5"
    if (hasDecimal) {
      return {
        isValid: false,
        message: `❌ IFR não permite altitudes terminadas em "5" (${altitudeStr}). Use níveis de voo (FL080, FL100, etc)`,
        hemisphere,
        suggestions: generateAltitudeSuggestions(hemisphere, 'IFR'),
      };
    }

    // Validar regra hemisférica
    if (hemisphere === 'east' && !isOddLevel(altitudeStr)) {
      return {
        isValid: false,
        message: `⚠️ Proa Leste (${Math.round(heading)}°): Use apenas níveis ímpares para IFR (FL050, FL070, FL090, etc)`,
        hemisphere,
        suggestions: generateAltitudeSuggestions('east', 'IFR'),
      };
    }

    if (hemisphere === 'west' && !isEvenLevel(altitudeStr)) {
      return {
        isValid: false,
        message: `⚠️ Proa Oeste (${Math.round(heading)}°): Use apenas níveis pares para IFR (FL060, FL080, FL100, etc)`,
        hemisphere,
        suggestions: generateAltitudeSuggestions('west', 'IFR'),
      };
    }

    return {
      isValid: true,
      message: `✅ IFR ${hemisphere === 'east' ? 'Leste' : 'Oeste'}: ${altitudeStr} válido`,
      hemisphere,
      suggestions: generateAltitudeSuggestions(hemisphere, 'IFR'),
    };
  }

  if (isVFR) {
    // VFR: permite altitudes com ".5" conforme a proa
    if (hemisphere === 'east') {
      // Leste VFR: pode usar ímpares ou X.5
      if (!isOddLevel(altitudeStr) && !hasDecimal) {
        return {
          isValid: false,
          message: `⚠️ Proa Leste (${Math.round(heading)}°) VFR: Use níveis ímpares (FL050, FL070) ou X.5 (085, 095, etc)`,
          hemisphere,
          suggestions: generateAltitudeSuggestions('east', 'VFR'),
        };
      }
    } else {
      // Oeste VFR: pode usar pares ou X.5
      if (!isEvenLevel(altitudeStr) && !hasDecimal) {
        return {
          isValid: false,
          message: `⚠️ Proa Oeste (${Math.round(heading)}°) VFR: Use níveis pares (FL060, FL080) ou X.5 (085, 095, etc)`,
          hemisphere,
          suggestions: generateAltitudeSuggestions('west', 'VFR'),
        };
      }
    }

    return {
      isValid: true,
      message: `✅ VFR ${hemisphere === 'east' ? 'Leste' : 'Oeste'}: ${altitudeStr} válido`,
      hemisphere,
      suggestions: generateAltitudeSuggestions(hemisphere, 'VFR'),
    };
  }

  return {
    isValid: true,
    message: 'Altitude válida',
    hemisphere,
  };
}

/**
 * Calcula a proa magnética entre dois pontos
 */
export function calculateHeading(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const lat1Rad = lat1 * (Math.PI / 180);
  const lat2Rad = lat2 * (Math.PI / 180);
  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
  return (Math.atan2(y, x) * (180 / Math.PI) + 360) % 360;
}
