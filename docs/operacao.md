# Operação: testes, monitoramento e cópia de segurança

Três rotinas automáticas no GitHub Actions (aba **Actions** do repositório).

## Testes (a cada push)

`.github/workflows/testes.yml` monta o site e roda `tests/fumaca.js`: abre as seis páginas públicas no celular e no
computador, faz um agendamento completo, passa por todas as abas do painel (com a chamada, a TV e o editor da grade)
e abre o app com o link do QR da TV. O banco é simulado (`tests/simulador.js`, com os alunos fictícios de
`tests/dados-de-exemplo.js`): nenhum teste toca os dados do Studio.

Para rodar na máquina: `bash scripts/montar-site.sh && node tests/fumaca.js` (precisa do Playwright com o Chromium).

Se o teste ficar vermelho, o site continua publicado (o deploy é outro fluxo), mas é sinal de que algo quebrou:
abra a execução e veja qual verificação falhou.

## Monitoramento (de hora em hora)

`.github/workflows/monitor.yml` confere se as páginas do site, o app, o painel, o login e o banco respondem. Se algo
cair, a execução fica vermelha e o GitHub manda e-mail para quem cuida do repositório (Settings → Notifications →
Actions, no perfil de quem recebe). As chamadas de hora em hora também mantêm o projeto do Supabase ativo.

## Cópia de segurança do banco (toda segunda de madrugada)

`.github/workflows/copia.yml` faz o `pg_dump` dos dados do Studio (schemas `public` e `privado`), restaura num
Postgres vazio dentro da própria execução e confere que todas as tabelas voltaram com o mesmo número de linhas.
Só depois criptografa a cópia (AES-256, com a senha do segredo `BACKUP_SENHA`) e guarda como artefato por 30 dias.

Para ligar, crie dois segredos em **Settings → Secrets and variables → Actions → New repository secret**:

1. `SUPABASE_DB_URL`: no Supabase, **Connect** (botão no topo do projeto) → **Session pooler** → copie a URI e troque
   `[YOUR-PASSWORD]` pela senha do banco. Use o *Session pooler*: a conexão direta não funciona nos servidores do GitHub.
2. `BACKUP_SENHA`: uma senha longa, guardada também fora do GitHub (sem ela a cópia não abre).

Os dois ficam só no GitHub; não mande nenhum dos dois por chat ou e-mail. Depois, em **Actions → Cópia de segurança →
Run workflow**, rode uma vez para conferir.

### Para restaurar

1. Baixe o artefato `copia-do-banco` da execução (Actions → Cópia de segurança → a execução → Artifacts).
2. Abra: `gpg --decrypt copia-AAAA-MM-DD.dump.gpg > copia.dump` (pede a `BACKUP_SENHA`).
3. Restaure num projeto do Supabase: `pg_restore --no-owner --no-privileges -d "<URI do Session pooler>" copia.dump`.

A cópia traz os dados do Studio (alunos, presenças, graduações, mensalidades, interessados e o resto). As contas de
login ficam no Supabase Auth: num projeto novo, os acessos são recriados pelo painel (Acessos).

## Câmera do tatame, fase 1 (um celular como câmera)

Piloto: só o professor assiste. Nada aparece no app dos alunos nem para a equipe.

1. **Banco.** No Supabase, SQL Editor, New query: colar `supabase/atualizar-2026-11-28.sql` inteiro e Run (pode rodar mais de uma vez). Cria a tabela `camera_links`, que só o professor lê, e a função que o app usa no piloto.
2. **Cloudflare.** Na conta onde o site está: ativar o Stream (pago), depois Stream, Live inputs, Create live input (nome: Tatame 1). Copiar os dois endereços de WebRTC: o de envio (`.../webRTC/publish`) e o de assistir (`.../webRTC/play`). O de envio é uma chave: quem tem, transmite. Não mandar por mensagem.
3. **Painel.** Em Câmeras, colar os dois endereços e salvar. Escolher as turmas com câmera.
4. **Celular que filma.** Abrir `evolutionbjj.com.br/transmitir` (ou o código que aparece no painel), entrar como professor com "Manter conectado", permitir a câmera e tocar em Ligar. Deixar deitado, no suporte e na tomada.

Como funciona: a página fica aberta com a tela acesa e transmite sozinha 5 minutos antes de cada aula das turmas com câmera, até o fim (1 hora). Sem som e sem gravação. A cada 30 segundos manda um sinal ao painel; é por ele que o painel mostra "No ar", "aguardando" ou "sem sinal" e que o botão Pausar chega ao celular.

Se algo falhar:
- **"Celular sem sinal"** no painel: a página fechou, o celular reiniciou ou ficou sem internet. Abrir a página de novo; ela volta sozinha ao modo câmera.
- **"O link de envio não foi aceito"**: endereço colado errado, ou a entrada foi apagada na Cloudflare. Colar de novo em Câmeras.
- **Imagem travando**: internet de envio fraca. A página mostra a taxa (Mbps); abaixo de 1 Mbps a imagem perde qualidade.
- **"O vídeo não passou pela rede deste lugar"**: a Cloudflare aceitou, mas a rede bloqueia transmissão ao vivo (tráfego UDP). Testar com o Wi-Fi desligado, pelo 4G; se funcionar, o bloqueio é do roteador ou do provedor da academia.
- **"A câmera não está transmitindo agora"** ao clicar em Ver ao vivo: a Cloudflare responde assim (código 409) quando ninguém está enviando. Conferir se o celular mostra "No ar".
- **Tela apaga**: tocar uma vez na tela. Em aparelho antigo, deixar a tela sempre ligada nos ajustes.

### Piloto no app (algumas pessoas assistem)

No painel, em Câmeras, bloco "Piloto no app": escolher o aluno e clicar em Liberar no app. Só aparece na lista quem já tem acesso ao app. Vale para a conta do próprio aluno e para a do responsável dele.

Quem foi liberado vê o cartão "Câmera do tatame" no Início do app: fora do ar, com a próxima transmissão; no ar, com o botão Assistir ao vivo. O vídeo toca sem som, com o nome de quem assiste por cima. Quem não foi liberado não vê nada. Para tirar alguém, clicar em Tirar na mesma lista.

Como a regra funciona: o app não lê a tabela da câmera. Ele chama a função `camera_ao_vivo()`, que só responde para quem está na lista e só entrega o endereço de assistir enquanto a câmera está no ar (sinal do celular há menos de 90 segundos e sem pausa). O endereço de envio nunca sai por ela.

Limite do piloto: o endereço de assistir é fixo. Quem assistiu uma vez poderia guardá-lo e abrir de novo sempre que a câmera estiver no ar, mesmo depois de sair da lista. Por isso o piloto é para pessoas de confiança; para as famílias, entra o link assinado por pessoa e horário. Ao encerrar o piloto com alguém, o seguro é apagar a entrada na Cloudflare e criar outra.

Custo: a conta precisa da assinatura do Cloudflare Stream (a partir de US$ 5 por mês; um plano Pro ou Business do domínio já inclui) e paga US$ 1 a cada 1.000 minutos assistidos. Enviar o vídeo não é cobrado; transmitir sem ninguém assistindo não gera custo de entrega.

Antes de abrir para as famílias (fase seguinte): ligar "Require signed URLs" na entrada da Cloudflare e criar a função que entrega o link por pessoa, turma, aceite e horário. Hoje o endereço de assistir funciona para quem o tiver, por isso fica guardado só para o professor.

## Excluir a conta pelo app (exigência das lojas)

No Perfil do app, o aluno tem "Excluir minha conta": digita EXCLUIR e o login dele é apagado na hora. A matrícula, as presenças e os pagamentos continuam com o Studio (o cadastro só perde o vínculo com a conta). Professor e equipe não são excluídos por ali.

Para ativar: no Supabase, Edge Functions, Deploy a new function, nome `excluir-conta`, colar `supabase/functions/excluir-conta/index.ts` e, em Advanced settings, desligar Verify JWT. Enquanto a função não existir, o app avisa que a exclusão ainda não foi ativada.

## Notificações push (avisos no celular do aluno)

- **Aluno:** no app, Perfil, "Notificações neste aparelho", Ativar. No iPhone só funciona com o app na Tela de Início (Safari, Compartilhar, Adicionar à Tela de Início). "Enviar um teste" mostra o aviso chegando.
- **Professor e equipe:** no painel, Hoje, "Aviso pelo app": escolher para quem (todos ou uma turma), título e mensagem. Chega na conta do aluno e na do responsável. Limite de 10 avisos por hora.

Para ativar:
1. Banco: rodar `supabase/atualizar-2026-11-28.sql` (traz as tabelas das notificações).
2. Função: no Supabase, Edge Functions, Deploy a new function, nome `push`, colar `supabase/functions/push/index.ts`, desligar Verify JWT.

As chaves que assinam os envios são criadas pela função na primeira chamada e ficam em `push_chaves`, que ninguém lê pelo app. Não há chave para copiar nem guardar. Aparelho que não existe mais sai da lista sozinho.
