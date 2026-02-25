-- ============================================
-- Fechar todos os diários de todas as aeronaves
-- Deixar aberto APENAS Janeiro 2025
-- ============================================

BEGIN;

-- Verificar quantos registros serão afetados (dry-run)
SELECT 
  'RESUMO DO QUE SERÁ ALTERADO:' as info,
  COUNT(*) as total_registros,
  SUM(CASE WHEN year = 2025 AND month = 1 THEN 1 ELSE 0 END) as "Jan/2025 (aberto)",
  SUM(CASE WHEN NOT (year = 2025 AND month = 1) THEN 1 ELSE 0 END) as "Outros (fechados)"
FROM logbook_months;

-- Fechar todos os diários EXCETO Janeiro 2025
UPDATE logbook_months
SET is_closed = true
WHERE NOT (year = 2025 AND month = 1);

-- Garantir que Janeiro 2025 está aberto
UPDATE logbook_months
SET is_closed = false
WHERE year = 2025 AND month = 1;

-- Verificar resultado
SELECT 
  aircraft_id,
  year,
  month,
  is_closed,
  confirmed
FROM logbook_months
ORDER BY aircraft_id, year DESC, month DESC;

COMMIT;
