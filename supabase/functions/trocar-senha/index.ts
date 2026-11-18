// Studio Evolution BJJ · função trocar-senha (Supabase Edge Function)
// O aluno que esqueceu a senha cria uma nova sozinho, confirmando dados do cadastro (sem e-mail):
//   { email, nascimento: "AAAA-MM-DD", final: "1234", senha }
// Confere se a conta de aluno com esse e-mail tem um cadastro (o próprio ou de um dependente) com essa data de
// nascimento e um WhatsApp que termina nesses 4 números. Se conferir, troca a senha.
// Travas: só contas de aluno ativas (professor nunca), no máximo 5 erros por e-mail e 20 tentativas por aparelho/rede
// por hora, e a mesma resposta para "e-mail não existe" e "dados não conferem" (não dá para descobrir quem é aluno).
// Deploy: Edge Functions → Deploy a new function → nome trocar-senha → colar este arquivo → Verify JWT desligado.
import { createClient } from "npm:@supabase/supabase-js@2.117.2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const resposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...cors, "Content-Type": "application/json" } });

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

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAO_CONFERE = "Os dados não conferem com o cadastro. Confira o e-mail, a data de nascimento e o WhatsApp, ou fale com o Studio.";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return resposta({ erro: "Método não permitido." }, 405);

  let corpo: Record<string, unknown>;
  try {
    corpo = await req.json();
  } catch {
    return resposta({ erro: "Pedido inválido." }, 400);
  }
  const email = String(corpo.email ?? "").trim().toLowerCase();
  const nascimento = String(corpo.nascimento ?? "").trim();
  const final = String(corpo.final ?? "").replace(/\D/g, "");
  const senha = String(corpo.senha ?? "");
  if (!EMAIL.test(email)) return resposta({ erro: "Confira o e-mail." }, 400);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nascimento)) return resposta({ erro: "Confira a data de nascimento." }, 400);
  if (final.length !== 4) return resposta({ erro: "Digite os 4 últimos números do WhatsApp do cadastro." }, 400);
  if (senha.length < 8 || senha.length > 72 || !/[a-z]/i.test(senha) || !/[0-9]/.test(senha)) {
    return resposta({ erro: "A senha nova precisa de pelo menos 8 caracteres, com letras e números." }, 400);
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", chaveSecreta(), { auth: { persistSession: false, autoRefreshToken: false } });
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "?";
  const umaHora = new Date(Date.now() - 3600_000).toISOString();

  // limite de tentativas: 5 erros por e-mail e 20 tentativas por IP na última hora
  const [porEmail, porIp] = await Promise.all([
    admin.from("senha_tentativas").select("id", { count: "exact", head: true }).eq("email", email).eq("ok", false).gte("criado_em", umaHora),
    admin.from("senha_tentativas").select("id", { count: "exact", head: true }).eq("ip", ip).gte("criado_em", umaHora),
  ]);
  if (porEmail.error || porIp.error) return resposta({ erro: "A troca de senha ainda não foi ativada no sistema. Fale com o Studio." }, 503);
  if ((porEmail.count ?? 0) >= 5 || (porIp.count ?? 0) >= 20) {
    return resposta({ erro: "Muitas tentativas. Espere 1 hora ou fale com o Studio no WhatsApp." }, 429);
  }
  const registra = (ok: boolean) => admin.from("senha_tentativas").insert({ email, ip, ok });

  // os cadastros ligados a contas com esse e-mail (o próprio aluno e os dependentes)
  const { data: cads } = await admin.from("alunos")
    .select("conta, responsavel_conta, nascimento, whatsapp, ativo")
    .ilike("email", email);
  const contas = new Set<string>();
  for (const c of cads ?? []) {
    if (!c.ativo || !c.nascimento || !c.whatsapp) continue;
    const zap = String(c.whatsapp).replace(/\D/g, "");
    if (String(c.nascimento).slice(0, 10) !== nascimento || !zap.endsWith(final)) continue;
    const uid = c.conta ?? c.responsavel_conta;
    if (uid) contas.add(uid);
  }
  // a conta precisa existir com esse mesmo e-mail e ser de aluno ativo
  let alvo: string | null = null;
  for (const uid of contas) {
    const [{ data: u }, { data: perfil }] = await Promise.all([
      admin.auth.admin.getUserById(uid),
      admin.from("perfis").select("papel, ativo").eq("id", uid).maybeSingle(),
    ]);
    if (u?.user?.email?.toLowerCase() === email && perfil?.papel === "aluno" && perfil.ativo) { alvo = uid; break; }
  }
  if (!alvo) {
    await registra(false);
    return resposta({ erro: NAO_CONFERE }, 400);
  }

  const { error } = await admin.auth.admin.updateUserById(alvo, { password: senha });
  if (error) return resposta({ erro: "Não deu para salvar a senha agora. Tente de novo em instantes." }, 500);
  await registra(true);
  return resposta({ ok: true });
});
