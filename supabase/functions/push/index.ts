// Studio Evolution BJJ · função push (Supabase Edge Function): notificações do app.
//   { acao: "chave" }                         → { publica }  a chave pública que o app usa para se inscrever (sem login)
//   { acao: "teste" }                         → manda um aviso de teste para os aparelhos de quem pediu (qualquer conta)
//   { acao: "enviar", titulo, corpo, para }   → professor ou equipe: manda o aviso
//        para: "todos" | "adulto" | "feminino" | "kids1" | "kids2" | ["id do aluno", ...]
// O aviso vai para os aparelhos da conta do aluno e da conta do responsável dele. Aparelho que não existe mais
// (o navegador responde 404 ou 410) sai da lista sozinho.
// As chaves que assinam os envios (VAPID) são criadas aqui na primeira chamada e guardadas em push_chaves.
// Deploy: Edge Functions → Deploy a new function → nome push → colar este arquivo → Verify JWT desligado.
import { createClient } from "npm:@supabase/supabase-js@2.117.2";
import webpush from "npm:web-push@3.6.7";

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

const CONTATO = "https://evolutionbjj.com.br/contato";
const TURMAS = ["adulto", "feminino", "kids1", "kids2"];
// deno-lint-ignore no-explicit-any
type Banco = any;

async function chaves(admin: Banco): Promise<{ publica: string; privada: string } | null> {
  let { data, error } = await admin.from("push_chaves").select("publica, privada").eq("id", 1).maybeSingle();
  if (error) return null;
  if (!data) {
    const k = webpush.generateVAPIDKeys();
    await admin.from("push_chaves").upsert({ id: 1, publica: k.publicKey, privada: k.privateKey }, { onConflict: "id", ignoreDuplicates: true });
    ({ data } = await admin.from("push_chaves").select("publica, privada").eq("id", 1).maybeSingle());
  }
  return data ?? null;
}

type Inscricao = { id: string; endpoint: string; p256dh: string; auth: string };
async function manda(admin: Banco, k: { publica: string; privada: string }, lista: Inscricao[], aviso: Record<string, unknown>) {
  let ok = 0, falhas = 0;
  const mortas: string[] = [];
  await Promise.all(lista.map(async (i) => {
    try {
      await webpush.sendNotification({ endpoint: i.endpoint, keys: { p256dh: i.p256dh, auth: i.auth } }, JSON.stringify(aviso), {
        vapidDetails: { subject: CONTATO, publicKey: k.publica, privateKey: k.privada },
        TTL: 6 * 3600,
        urgency: "normal",
      });
      ok++;
    } catch (e) {
      falhas++;
      const st = (e as { statusCode?: number }).statusCode;
      if (st === 404 || st === 410) mortas.push(i.id);
    }
  }));
  if (mortas.length) await admin.from("push_inscricoes").delete().in("id", mortas);
  return { ok, falhas };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return resposta({ erro: "Método não permitido." }, 405);
  let corpo: Record<string, unknown>;
  try {
    corpo = await req.json();
  } catch {
    return resposta({ erro: "Pedido inválido." }, 400);
  }
  const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", chaveSecreta(), { auth: { persistSession: false, autoRefreshToken: false } });
  const k = await chaves(admin);
  if (!k) return resposta({ erro: "As notificações ainda não foram ativadas no banco de dados." }, 503);

  const acao = String(corpo.acao ?? "");
  if (acao === "chave") return resposta({ publica: k.publica });

  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return resposta({ erro: "Entre de novo para continuar." }, 401);
  const { data: quem, error: erroQuem } = await admin.auth.getUser(jwt);
  if (erroQuem || !quem.user) return resposta({ erro: "Sua sessão venceu. Entre de novo." }, 401);
  const eu = quem.user.id;

  if (acao === "teste") {
    const { data: minhas } = await admin.from("push_inscricoes").select("id, endpoint, p256dh, auth").eq("conta", eu);
    if (!minhas || !minhas.length) return resposta({ erro: "Este aparelho ainda não está com as notificações ativadas." }, 400);
    const r = await manda(admin, k, minhas, { titulo: "Notificações ativadas", corpo: "É assim que os avisos do Studio Evolution chegam.", url: "app.html" });
    return resposta({ aparelhos: r.ok, falhas: r.falhas });
  }

  if (acao === "enviar") {
    const { data: perfil } = await admin.from("perfis").select("papel, ativo").eq("id", eu).maybeSingle();
    if (!perfil || !perfil.ativo || (perfil.papel !== "professor" && perfil.papel !== "gestao")) {
      return resposta({ erro: "Só o professor e a equipe enviam avisos." }, 403);
    }
    const titulo = String(corpo.titulo ?? "").trim().slice(0, 60);
    const texto = String(corpo.corpo ?? "").trim().slice(0, 180);
    if (titulo.length < 2 || texto.length < 2) return resposta({ erro: "Escreva o título e a mensagem." }, 400);

    // limite contra engano: no máximo 10 avisos por hora
    const umaHora = new Date(Date.now() - 3600_000).toISOString();
    const { count } = await admin.from("push_envios").select("id", { count: "exact", head: true }).gte("criado_em", umaHora);
    if ((count ?? 0) >= 10) return resposta({ erro: "Muitos avisos na última hora. Espere um pouco para enviar outro." }, 429);

    let q = admin.from("alunos").select("id, conta, responsavel_conta").eq("ativo", true);
    const para = corpo.para;
    let rotulo = "todos";
    if (Array.isArray(para)) {
      const ids = para.map(String).filter((x) => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 200);
      if (!ids.length) return resposta({ erro: "Escolha para quem enviar." }, 400);
      q = q.in("id", ids);
      rotulo = ids.length === 1 ? "1 aluno" : ids.length + " alunos";
    } else if (typeof para === "string" && TURMAS.includes(para)) {
      q = q.eq("turma", para);
      rotulo = para;
    } else if (para !== "todos") {
      return resposta({ erro: "Escolha para quem enviar." }, 400);
    }
    const { data: alunos, error: erroAl } = await q;
    if (erroAl) return resposta({ erro: "Não deu para ler os alunos agora." }, 503);
    const contas = [...new Set((alunos ?? []).flatMap((a: { conta: string | null; responsavel_conta: string | null }) => [a.conta, a.responsavel_conta]).filter(Boolean))];
    let lista: Inscricao[] = [];
    if (contas.length) {
      const { data } = await admin.from("push_inscricoes").select("id, endpoint, p256dh, auth").in("conta", contas);
      lista = data ?? [];
    }
    const r = lista.length ? await manda(admin, k, lista, { titulo, corpo: texto, url: "app.html" }) : { ok: 0, falhas: 0 };
    await admin.from("push_envios").insert({ por: eu, titulo, corpo: texto, para: rotulo, aparelhos: r.ok, falhas: r.falhas });
    return resposta({ alunos: (alunos ?? []).length, aparelhos: r.ok, falhas: r.falhas });
  }

  return resposta({ erro: "Ação desconhecida." }, 400);
});
