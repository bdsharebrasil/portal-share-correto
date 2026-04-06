/**
 * Utilitário para gerar URLs públicas do Supabase Storage
 * Centraliza a lógica de construção de URLs para diferentes buckets
 */

import { supabase } from '@/integrations/supabase/client';

/**
 * Gera URL pública para um arquivo no bucket "flight-documents"
 */
export function getFlightDocumentPublicUrl(filePath: string): string {
  if (!filePath) return '';
  
  const { data } = supabase.storage
    .from('flight-documents')
    .getPublicUrl(filePath);
  
  return data?.publicUrl || '';
}

/**
 * Gera URL pública para um arquivo no bucket "documentos"
 */
export function getDocumentPublicUrl(filePath: string): string {
  if (!filePath) return '';
  
  const { data } = supabase.storage
    .from('documents')
    .getPublicUrl(filePath);
  
  return data?.publicUrl || '';
}

/**
 * Gera URL pública para um arquivo no bucket "aircraft-images"
 */
export function getAircraftImagePublicUrl(filePath: string): string {
  if (!filePath) return '';
  
  const { data } = supabase.storage
    .from('aircraft-images')
    .getPublicUrl(filePath);
  
  return data?.publicUrl || '';
}

/**
 * Gera URL pública para um arquivo em qualquer bucket
 */
export function getPublicUrl(bucket: string, filePath: string): string {
  if (!filePath) return '';
  
  const { data } = supabase.storage
    .from(bucket)
    .getPublicUrl(filePath);
  
  return data?.publicUrl || '';
}

/**
 * Verifica se uma string é uma URL completa (começa com http/https) ou um caminho relativo
 */
export function isFullUrl(url: string): boolean {
  return /^https?:\/\//.test(url);
}

/**
 * Normaliza um caminho/URL, convertendo para URL completa se necessário
 */
export function normalizeStorageUrl(filePath: string, bucket: string = 'flight-documents'): string {
  if (!filePath) return '';
  
  // Se já é uma URL completa, retornar como está
  if (isFullUrl(filePath)) {
    return filePath;
  }
  
  // Se é um caminho relativo, construir URL pública
  return getPublicUrl(bucket, filePath);
}
