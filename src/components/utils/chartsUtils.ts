/**
 * Abre as cartas aeronáuticas no AISWEB DECEA
 * 
 * @param icao - Código ICAO do aeródromo (opcional)
 * 
 * Nota: AISWEB não aceita deep-link direto por tipo de carta (SID/STAR/IAC).
 * O usuário deve selecionar manualmente o tipo de carta após abrir.
 */
export const openIFRCharts = (icao?: string) => {
  if (!icao) return;
  
  window.open(
    'https://aisweb.decea.mil.br/?i=aerodromos',
    '_blank',
    'noopener,noreferrer'
  );
};
