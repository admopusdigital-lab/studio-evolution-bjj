// Studio Evolution BJJ · função push (Supabase Edge Function): notificações do app.
//   { acao: "chave" }                         → { publica }  a chave pública que o app usa para se inscrever (sem login)
//   { acao: "teste" }                         → manda um aviso de teste para os aparelhos de quem pediu (qualquer conta)
//   { acao: "versao" }                        → { versao: 2 }  o painel confere se esta é a função nova (sem login)
//   { acao: "enviar", titulo, corpo, para, tela? } → professor ou equipe: manda o aviso
//        para: "todos" | "adulto" | "feminino" | "kids1" | "kids2" | ["id do aluno", ...]   (até 200 alunos por envio)
//        tela: "inicio" | "presenca" | "movimentos" | "perfil"   onde o app abre quando a pessoa toca no aviso
//        {nome} no título ou na mensagem vira o primeiro nome de cada aluno.
// Cada aluno do envio ganha uma linha em avisos (o recado fica guardado no app, mesmo para quem não ativou as
// notificações) e o aviso vai para os aparelhos da conta do aluno e da conta do responsável dele. Aparelho que não
// existe mais (o navegador responde 404 ou 410) sai da lista sozinho.
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

type Inscricao = { id: string; conta?: string; endpoint: string; p256dh: string; auth: string };
type Envio = { i: Inscricao; aviso: Record<string, unknown> };
// manda cada aviso para o seu aparelho, de 20 em 20. ok e falhas contam entregas; aparelhos, os aparelhos que receberam
async function manda(admin: Banco, k: { publica: string; privada: string }, envios: Envio[]) {
  let ok = 0, falhas = 0;
  const mortas = new Set<string>(), receberam = new Set<string>();
  for (let n = 0; n < envios.length; n += 20) {
    await Promise.all(envios.slice(n, n + 20).map(async ({ i, aviso }) => {
      if (mortas.has(i.id)) return;
      try {
        await webpush.sendNotification({ endpoint: i.endpoint, keys: { p256dh: i.p256dh, auth: i.auth } }, JSON.stringify(aviso), {
          vapidDetails: { subject: CONTATO, publicKey: k.publica, privateKey: k.privada },
          TTL: 6 * 3600,
          urgency: "normal",
        });
        ok++;
        receberam.add(i.id);
      } catch (e) {
        falhas++;
        const st = (e as { statusCode?: number }).statusCode;
        if (st === 404 || st === 410) mortas.add(i.id);
      }
    }));
  }
  if (mortas.size) await admin.from("push_inscricoes").delete().in("id", [...mortas]);
  return { ok, falhas, aparelhos: receberam.size };
}
const TELAS = ["inicio", "presenca", "movimentos", "perfil"];
// o primeiro nome como a pessoa lê: cadastro todo em minúsculas ou maiúsculas ("ana", "ANA") vira "Ana"
const primeiroNome = (n: string) => {
  const p = String(n ?? "").trim().split(/\s+/)[0] || "";
  return p && (p === p.toLowerCase() || p === p.toUpperCase()) ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : p;
};
const comNome = (t: string, nome: string) => t.split("{nome}").join(nome);

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
  if (acao === "versao") return resposta({ versao: 2 });

  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return resposta({ erro: "Entre de novo para continuar." }, 401);
  const { data: quem, error: erroQuem } = await admin.auth.getUser(jwt);
  if (erroQuem || !quem.user) return resposta({ erro: "Sua sessão venceu. Entre de novo." }, 401);
  const eu = quem.user.id;

  if (acao === "teste") {
    const { data: minhas } = await admin.from("push_inscricoes").select("id, endpoint, p256dh, auth").eq("conta", eu);
    if (!minhas || !minhas.length) return resposta({ erro: "Este aparelho ainda não está com as notificações ativadas." }, 400);
    const teste = { titulo: "Notificações ativadas", corpo: "É assim que os avisos do Studio Evolution chegam.", url: "app.html" };
    const r = await manda(admin, k, minhas.map((i: Inscricao) => ({ i, aviso: teste })));
    return resposta({ aparelhos: r.ok, falhas: r.falhas });
  }

  if (acao === "enviar") {
    const { data: perfil } = await admin.from("perfis").select("papel, ativo").eq("id", eu).maybeSingle();
    if (!perfil || !perfil.ativo || (perfil.papel !== "professor" && perfil.papel !== "gestao")) {
      return resposta({ erro: "Só o professor e a equipe enviam avisos." }, 403);
    }
    const titulo = String(corpo.titulo ?? "").trim().slice(0, 60);
    const texto = String(corpo.corpo ?? "").trim().slice(0, 240);
    if (titulo.length < 2 || texto.length < 2) return resposta({ erro: "Escreva o título e a mensagem." }, 400);
    const tela = TELAS.includes(String(corpo.tela ?? "")) ? String(corpo.tela) : null;

    // limite contra engano: no máximo 60 envios por hora (um envio pode ser para um aluno só)
    const umaHora = new Date(Date.now() - 3600_000).toISOString();
    const { count } = await admin.from("push_envios").select("id", { count: "exact", head: true }).gte("criado_em", umaHora);
    if ((count ?? 0) >= 60) return resposta({ erro: "Muitos avisos na última hora. Espere um pouco para enviar outro." }, 429);

    type Aluno = { id: string; nome: string; conta: string | null; responsavel_conta: string | null };
    let q = admin.from("alunos").select("id, nome, conta, responsavel_conta").eq("ativo", true).order("nome").limit(201);
    const para = corpo.para;
    let rotulo = "todos";
    if (Array.isArray(para)) {
      const ids = [...new Set(para.map(String).filter((x) => /^[0-9a-f-]{36}$/i.test(x)))];
      if (!ids.length) return resposta({ erro: "Escolha para quem enviar." }, 400);
      if (ids.length > 200) return resposta({ erro: "São muitos alunos de uma vez (o máximo é 200). Envie por turma." }, 400);
      q = q.in("id", ids);
      rotulo = ids.length + " alunos";
    } else if (typeof para === "string" && TURMAS.includes(para)) {
      q = q.eq("turma", para);
      rotulo = para;
    } else if (para !== "todos") {
      return resposta({ erro: "Escolha para quem enviar." }, 400);
    }
    const { data: lidos, error: erroAl } = await q;
    if (erroAl) return resposta({ erro: "Não deu para ler os alunos agora." }, 503);
    const alunos: Aluno[] = lidos ?? [];
    if (!alunos.length) return resposta({ erro: "Nenhum aluno ativo nesse grupo." }, 400);
    if (alunos.length > 200) return resposta({ erro: "São muitos alunos de uma vez (o máximo é 200). Envie por turma." }, 400);
    if (Array.isArray(para)) rotulo = alunos.length === 1 ? alunos[0].nome.slice(0, 60) : alunos.length + " alunos";

    // o envio entra no histórico primeiro: os recados guardados apontam para ele
    const { data: envio } = await admin.from("push_envios").insert({ por: eu, titulo, corpo: texto, para: rotulo, aparelhos: 0, falhas: 0 }).select("id").single();

    // um recado por aluno, já com o primeiro nome. Banco sem a tabela avisos (ou sem a coluna envio): segue só com a notificação
    const pessoal = (titulo + texto).includes("{nome}");
    const recados = alunos.map((a) => ({
      aluno: a.id,
      titulo: comNome(titulo, primeiroNome(a.nome)).slice(0, 80),
      corpo: comNome(texto, primeiroNome(a.nome)).slice(0, 400),
      tela,
      criado_por: eu,
    }));
    const idDoAviso: Record<string, string> = {};
    let guardados = 0, semTabela = false;
    {
      let g = await admin.from("avisos").insert(recados.map((x) => ({ ...x, envio: envio?.id ?? null }))).select("id, aluno");
      if (g.error) g = await admin.from("avisos").insert(recados).select("id, aluno");
      if (g.error) semTabela = true;
      else (g.data ?? []).forEach((x: { id: string; aluno: string }) => { idDoAviso[x.aluno] = x.id; guardados++; });
    }

    // os aparelhos de cada aluno: os da conta dele e os da conta do responsável
    const contas = [...new Set(alunos.flatMap((a) => [a.conta, a.responsavel_conta]).filter(Boolean))] as string[];
    const porConta: Record<string, Inscricao[]> = {};
    if (contas.length) {
      const { data } = await admin.from("push_inscricoes").select("id, conta, endpoint, p256dh, auth").in("conta", contas);
      (data ?? []).forEach((i: Inscricao) => { (porConta[i.conta as string] = porConta[i.conta as string] || []).push(i); });
    }
    const envios: Envio[] = [];
    const jaFoi = new Set<string>();   // recado igual para todos: o aparelho de quem cuida de dois alunos recebe uma vez só
    let comAviso = 0;
    alunos.forEach((a, n) => {
      const aparelhos = [...new Map([a.conta, a.responsavel_conta].filter(Boolean).flatMap((c) => porConta[c as string] ?? []).map((i) => [i.id, i])).values()];
      if (aparelhos.length) comAviso++;
      const id = idDoAviso[a.id];
      const url = "app.html" + (id ? "?aviso=" + id + (tela ? "&tela=" + tela : "") : tela ? "?tela=" + tela : "");
      aparelhos.forEach((i) => {
        if (!pessoal) { if (jaFoi.has(i.id)) return; jaFoi.add(i.id); }
        envios.push({ i, aviso: { titulo: recados[n].titulo, corpo: recados[n].corpo, url } });
      });
    });
    const r = envios.length ? await manda(admin, k, envios) : { ok: 0, falhas: 0, aparelhos: 0 };
    if (envio?.id) await admin.from("push_envios").update({ aparelhos: r.aparelhos, falhas: r.falhas }).eq("id", envio.id);
    return resposta({
      versao: 2,
      alunos: alunos.length,      // quantos alunos o envio alcança
      com_aviso: comAviso,        // quantos deles têm pelo menos um aparelho com as notificações ativadas
      aparelhos: r.aparelhos,     // quantos aparelhos receberam
      entregues: r.ok,            // quantas notificações chegaram (um aparelho pode receber uma por aluno)
      falhas: r.falhas,
      guardados,                  // quantos recados ficaram guardados no app
      sem_tabela: semTabela,      // true: falta rodar o SQL de 29/11 (o recado não ficou guardado no app)
    });
  }

  return resposta({ erro: "Ação desconhecida." }, 400);
});
