-- SCRIPTS DE REPARAÇÃO E BLOQUEIO DE DUPLICADOS

-- 1. Limpar duplicados existentes
-- Mantém apenas o registo mais recente de cada pessoa que esteja em espera/notificada
DELETE FROM public.customers a
USING (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY company_id, phone_number 
           ORDER BY created_at DESC
         ) as row_num
  FROM public.customers
  WHERE status IN ('waiting', 'notified')
) b
WHERE a.id = b.id AND b.row_num > 1;

-- 2. Criar índice de unicidade (O "Cadeado")
-- Impede que o mesmo número de telemóvel entre na fila mais do que uma vez na mesma empresa
-- apenas para os estados 'waiting' e 'notified'.
-- Clientes 'seated' ou 'cancelled' podem voltar a entrar noutro dia.
DROP INDEX IF EXISTS unique_active_waiting_customer;
CREATE UNIQUE INDEX unique_active_waiting_customer 
ON public.customers (company_id, phone_number) 
WHERE (status = 'waiting' OR status = 'notified');
