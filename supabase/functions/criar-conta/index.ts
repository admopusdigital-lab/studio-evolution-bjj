// Studio Evolution BJJ · função criar-conta (Supabase Edge Function)
// Chamada pela página acessos.html. Só um professor ativo pode usar:
//   { acao: "criar", nome, email, whatsapp?, papel: "aluno" | "professor" } → cria a conta e o perfil
//   { acao: "nova-senha", email }                                         → gera uma senha provisória nova
// Responde { email, nome, senha } com a senha provisória, que o professor manda pelo WhatsApp.
// Deploy: supabase functions deploy criar-conta --no-verify-jwt  (a função confere o login ela mesma)
import { createClient } from "npm:@supabase/supabase-js@2.117.2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const resposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...cors, "Content-Type": "application/json" } });

// a chave secreta: a nova (SUPABASE_SECRET_KEYS) ou a antiga (service_role)
function chaveSecreta(): string {
  const novas = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (novas) {
    try {
      const k = JSON.parse(novas);
      if (k.default) return k.default;
    } catch { /* cai na antiga */ }
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
}

// senha provisória: 10 caracteres sem os que se confundem (0/o, 1/l/i)
function senhaProvisoria(): string {
  const letras = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => letras[b % letras.length]).join("");
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return resposta({ erro: "Método não permitido." }, 405);

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const admin = createClient(url, chaveSecreta(), { auth: { persistSession: false, autoRefreshToken: false } });

  // quem está pedindo? precisa ser professor ativo
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return resposta({ erro: "Entre como professor para criar acessos." }, 401);
  const { data: quem, error: erroQuem } = await admin.auth.getUser(jwt);
  if (erroQuem || !quem.user) return resposta({ erro: "Sua sessão venceu. Entre de novo." }, 401);
  const { data: perfilQuem } = await admin.from("perfis").select("papel, ativo").eq("id", quem.user.id).single();
  if (!perfilQuem || perfilQuem.papel !== "professor" || !perfilQuem.ativo) {
    return resposta({ erro: "Só professores podem criar acessos." }, 403);
  }

  let corpo: Record<string, unknown>;
  try {
    corpo = await req.json();
  } catch {
    return resposta({ erro: "Pedido inválido." }, 400);
  }
  const acao = String(corpo.acao ?? "criar");
  const email = String(corpo.email ?? "").trim().toLowerCase();
  if (!EMAIL.test(email)) return resposta({ erro: "Digite um e-mail válido." }, 400);
  const senha = senhaProvisoria();

  if (acao === "nova-senha") {
    // procura a conta pelo e-mail (uma página de 1000 basta: a academia tem bem menos contas que isso)
    const { data: lista, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) return resposta({ erro: "Não deu para procurar a conta. Tente de novo." }, 500);
    const conta = lista.users.find((u) => (u.email ?? "").toLowerCase() === email);
    if (!conta) return resposta({ erro: "Não existe acesso com esse e-mail." }, 404);
    const { error: erroSenha } = await admin.auth.admin.updateUserById(conta.id, { password: senha });
    if (erroSenha) return resposta({ erro: "Não deu para gerar a senha. Tente de novo." }, 500);
    const { data: p } = await admin.from("perfis").select("nome").eq("id", conta.id).single();
    return resposta({ email, nome: p?.nome ?? "", senha });
  }

  if (acao !== "criar") return resposta({ erro: "Ação desconhecida." }, 400);
  const nome = String(corpo.nome ?? "").trim();
  const papel = corpo.papel === "professor" ? "professor" : "aluno";
  let whatsapp = String(corpo.whatsapp ?? "").replace(/\D/g, "");
  if (whatsapp.length === 10 || whatsapp.length === 11) whatsapp = "55" + whatsapp;
  if (nome.length < 3) return resposta({ erro: "Digite o nome completo." }, 400);
  if (whatsapp && !/^[0-9]{12,13}$/.test(whatsapp)) return resposta({ erro: "Confira o WhatsApp: DDD e número." }, 400);

  const { data: criada, error: erroConta } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true, // o Studio já conhece a pessoa: não precisa confirmar o e-mail
    user_metadata: { nome },
  });
  if (erroConta || !criada.user) {
    const jaExiste = /already|registered|exists/i.test(erroConta?.message ?? "");
    return resposta({ erro: jaExiste ? "Já existe um acesso com esse e-mail. Use Senha nova." : "Não deu para criar o acesso. Tente de novo." }, jaExiste ? 409 : 500);
  }

  const { error: erroPerfil } = await admin.from("perfis").insert({
    id: criada.user.id,
    papel,
    nome,
    whatsapp: whatsapp || null,
  });
  if (erroPerfil) {
    // sem perfil a conta não entra: desfaz para não sobrar conta órfã
    await admin.auth.admin.deleteUser(criada.user.id);
    return resposta({ erro: "Não deu para salvar o perfil. Tente de novo." }, 500);
  }

  return resposta({ email, nome, senha });
});
