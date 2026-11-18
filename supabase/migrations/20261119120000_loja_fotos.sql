-- Studio Evolution BJJ · fotos dos itens da loja (estoque). Pode rodar mais de uma vez (idempotente).
-- Rode depois de 20261118140000_senha_vencimento.sql.
-- A foto fica no Storage, bucket público "loja" (foto de produto não é dado pessoal), e o endereço vai em produtos.foto.
-- Só o professor envia, troca e apaga; qualquer um vê a imagem pelo endereço público (a loja do app).

alter table public.produtos add column if not exists foto text;
alter table public.produtos drop constraint if exists produtos_foto_check;
alter table public.produtos add constraint produtos_foto_check check (foto is null or (char_length(foto) <= 500 and foto ~ '^https://'));
comment on column public.produtos.foto is 'Endereço público da foto do item (bucket loja). Vale para todos os tamanhos do mesmo produto e cor.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('loja', 'loja', true, 2097152, array['image/jpeg', 'image/webp', 'image/png'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "loja: professor envia" on storage.objects;
create policy "loja: professor envia" on storage.objects for insert to authenticated
  with check (bucket_id = 'loja' and (select privado.eh_professor()));
drop policy if exists "loja: professor troca" on storage.objects;
create policy "loja: professor troca" on storage.objects for update to authenticated
  using (bucket_id = 'loja' and (select privado.eh_professor()));
drop policy if exists "loja: professor apaga" on storage.objects;
create policy "loja: professor apaga" on storage.objects for delete to authenticated
  using (bucket_id = 'loja' and (select privado.eh_professor()));
