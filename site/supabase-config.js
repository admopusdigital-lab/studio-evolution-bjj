/* Login de verdade (Supabase). Enquanto url e chave estiverem vazias, o site usa o login de demonstração
   (aluno / evolution e professor / evolution), que funciona sem servidor e também dentro do artifact.

   Para plugar (passo a passo em docs/supabase.md): preencha com a URL do projeto e a chave publicável,
   em Project Settings → API Keys. As duas são públicas por natureza: quem protege os dados são as regras do
   banco (RLS) em supabase/migrations. Nunca coloque aqui a chave secreta (secret / service_role). */
window.EVO_SUPABASE = {
  url: "",   /* ex.: "https://abcdefghijklmnop.supabase.co" */
  chave: ""  /* ex.: "sb_publishable_..." (ou a chave anon antiga) */
};
