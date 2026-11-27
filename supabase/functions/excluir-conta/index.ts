// Studio Evolution BJJ · função excluir-conta (Supabase Edge Function)
// O aluno (ou o responsável) apaga a própria conta do app, de dentro do app: { confirma: "EXCLUIR" }
// Apaga o login e o perfil. O cadastro de aluno no Studio (matrícula, presenças, pagamentos) não é apagado aqui:
// ele perde o vínculo com a conta e continua com o Studio, que guarda o que a lei exige; a exclusão desses dados
// é pedida ao Studio, como diz a política de privacidade.
// Travas: só a própria conta (pelo login de quem pede), só contas de aluno (professor e equipe nunca) e a palavra
// de confirmação digitada.
// Deploy: Edge Functions → Deploy a new function → nome excluir-conta → colar este arquivo → Verify JWT desligado.
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return resposta({ erro: "Método não permitido." }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", chaveSecreta(), { auth: { persistSession: false, autoRefreshToken: false } });

  // quem está pedindo: a conta apagada é sempre a de quem está logado
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return resposta({ erro: "Entre no app para excluir a conta." }, 401);
  const { data: quem, error: erroQuem } = await admin.auth.getUser(jwt);
  if (erroQuem || !quem.user) return resposta({ erro: "Sua sessão venceu. Entre de novo." }, 401);

  let corpo: Record<string, unknown>;
  try {
    corpo = await req.json();
  } catch {
    return resposta({ erro: "Pedido inválido." }, 400);
  }
  if (String(corpo.confirma ?? "").trim().toUpperCase() !== "EXCLUIR") {
    return resposta({ erro: "Digite EXCLUIR para confirmar." }, 400);
  }

  const { data: perfil, error: erroPerfil } = await admin.from("perfis").select("papel").eq("id", quem.user.id).maybeSingle();
  if (erroPerfil) return resposta({ erro: "Não deu para conferir a conta agora. Tente de novo." }, 503);
  if (perfil && perfil.papel !== "aluno") {
    return resposta({ erro: "Contas de professor e de equipe são excluídas pelo Studio, não pelo app." }, 403);
  }

  // apaga o login; o perfil sai junto e o cadastro de aluno perde o vínculo com a conta (regras do banco)
  const { error } = await admin.auth.admin.deleteUser(quem.user.id);
  if (error) return resposta({ erro: "Não deu para excluir a conta agora. Tente de novo ou fale com o Studio." }, 500);
  return resposta({ ok: true });
});
