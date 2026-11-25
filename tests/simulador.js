/* Testes · simulador do Supabase para o painel e o app (dados de exemplo, nada do banco de verdade).
   Também serve o site montado em _site/ no endereço do domínio, para as páginas rodarem como em produção. */
const UIDP='11111111-1111-1111-1111-111111111111',UIDA='22222222-2222-2222-2222-222222222222';
const two=n=>(n<10?'0':'')+n, iso=d=>d.getFullYear()+'-'+two(d.getMonth()+1)+'-'+two(d.getDate());
const dia=k=>{const d=new Date();d.setDate(d.getDate()-k);return d};
const H=iso(new Date());
const base={turma:'adulto',horario:'19:00',ativo:true,mensalidade:200,vencimento:10,inicio:'2025-03-10',criado_em:'2026-11-01T10:00:00Z',aulas_antes:0,aulas_antes_ate:null,conta:null,responsavel_conta:null,foto:null,nascimento:null,whatsapp:null,email:null};
const alunos=[
 {...base,id:'a0',nome:'Douglas Lima',faixa:'azul',graus:1,aulas_antes:48,aulas_antes_ate:'2026-11-05',conta:UIDA}, // grau registrado depois (12/11) → antes fora
 {...base,id:'a1',nome:'Carla Souza',faixa:'roxa',graus:2,aulas_antes:60,aulas_antes_ate:'2026-11-05'},              // grau do cadastro → conta
 {...base,id:'a2',nome:'Pedro Alves',faixa:'branca',graus:0,aulas_antes:0},                                         // sem aulas antes
 {...base,id:'a4',nome:'Pedro Kids',turma:'kids1',horario:'18:00',faixa:'cinza',graus:9,conta:'33333333-3333-3333-3333-333333333333'},
 {...base,id:'a3',nome:'Júlia Reis',faixa:'branca',graus:2,aulas_antes:30,aulas_antes_ate:'2026-11-05'},            // grau novo de verdade em 15/11 (tbm aparece)
];
const graduacoes=[
 {id:'g0',aluno:'a0',faixa:'azul',graus:1,data:'2026-11-12',nota:null,criado_em:'2026-11-12T20:00:00Z'},
 {id:'g1',aluno:'a1',faixa:'roxa',graus:2,data:'2025-03-10',nota:'Grau que já tinha antes do app',criado_em:'2026-11-01T10:00:00Z'},
 {id:'g3',aluno:'a3',faixa:'branca',graus:2,data:'2026-11-15',nota:'entregue no treino',criado_em:'2026-11-15T20:00:00Z'},
];
const presencas=[];let pid=0;
alunos.forEach((a,i)=>{for(let k=1;k<16;k++){if(dia(k).getDay()===0||(k+i)%2)continue;presencas.push({id:'p'+(pid++),aluno:a.id,data:iso(dia(k)),hora:'19:00',turma:'adulto',como:'app',chegou_em:iso(dia(k))+'T19:05:00-03:00'});}});
const segunda=(()=>{const d=new Date();d.setDate(d.getDate()-(d.getDay()+6)%7);return iso(d)})();
const tecnicas_semana=[{id:'t1',semana:segunda,turma:'todas',movimento:null,titulo:'Raspagem de gancho',ordem:0,criado_em:'2026-11-16T10:00:00Z'},{id:'t2',semana:segunda,turma:'kids',movimento:null,titulo:'Fuga de montada',ordem:1,criado_em:'2026-11-16T10:00:00Z'}];
const tecnicas_aluno=[{id:'m1',aluno:'a1',tipo:'aprendi',tecnica:'t1',titulo:null,visto:false,criado_em:'2026-11-17T10:00:00Z'},{id:'m2',aluno:'a1',tipo:'quero',tecnica:null,titulo:'Defesa de triângulo',visto:false,criado_em:'2026-11-17T10:00:00Z'},{id:'m3',aluno:'a3',tipo:'quero',tecnica:null,titulo:'defesa de triangulo',visto:false,criado_em:'2026-11-17T12:00:00Z'}];
const perfis=[{id:'11111111-1111-1111-1111-111111111111',papel:'professor',nome:'Tiago',ativo:true,permissoes:[],email:'tiago@x.com',whatsapp:null,criado_em:'2026-10-01'},{id:'g1',papel:'gestao',nome:'Ana Recepção',ativo:true,permissoes:['hoje','alunos'],email:'ana@x.com',whatsapp:'5515999990000',criado_em:'2026-11-20'}];
const T={perfis,tecnicas_semana,tecnicas_aluno,alunos,graduacoes,presencas,mensalidades:[],cobrancas:[],reservas:[],produtos:[],pedidos_loja:[],leads:[],lead_eventos:[],despesas:[],metas:[],movimentos:[],estudos:[],chamadas:[],configuracoes:[]};
function filtra(rows,u){let r=rows.slice();for(const [k,v] of u.searchParams){if(['select','order','limit','offset','on_conflict','columns'].includes(k))continue;const i=v.indexOf('.');const op=v.slice(0,i),val=decodeURIComponent(v.slice(i+1));
 r=r.filter(x=>{const f=x[k];if(op==='eq')return String(f)===val;if(op==='gte')return String(f)>=val;if(op==='gt')return String(f)>val;if(op==='lte')return String(f)<=val;if(op==='lt')return String(f)<val;if(op==='is')return f==null;if(op==='neq')return String(f)!==val;if(op==='in')return val.slice(1,-1).split(',').includes(String(f));return true;});}
 const o=u.searchParams.get('order');if(o){const [c,dir]=o.split(',')[0].split('.');r.sort((a,b)=>(a[c]>b[c]?1:a[c]<b[c]?-1:0)*(dir==='desc'?-1:1));}
 const lim=u.searchParams.get('limit');if(lim)r=r.slice(0,+lim);return r;}
const fs=require('fs'),path=require('path');const SITE=path.join(__dirname,'..','_site');
const TIPOS={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.json':'application/json','.webmanifest':'application/manifest+json','.mp4':'video/mp4','.webm':'video/webm'};
module.exports=async function(page,papel){
 await page.route('https://evolutionbjj.com.br/**',route=>{const u=new URL(route.request().url());let f=u.pathname==='/'?'/index.html':u.pathname;if(!path.extname(f))f+='.html';const fp=path.join(SITE,f);
  if(!fs.existsSync(fp))return route.fulfill({status:404,body:'nao'});return route.fulfill({status:200,contentType:TIPOS[path.extname(fp)]||'application/octet-stream',body:fs.readFileSync(fp)});});
 const uid=papel==='professor'?(global.__uidProf||UIDP):(global.__uidAluno||UIDA);global.__w=[];
 await page.route('https://nkscqdhczfeykrtexyzs.supabase.co/**',async route=>{
  const req=route.request(),u=new URL(req.url()),p=u.pathname,obj=(req.headers()['accept']||'').includes('vnd.pgrst.object');
  const J=(b,st=200)=>route.fulfill({status:st,contentType:'application/json',headers:{'content-range':'0-999/*'},body:JSON.stringify(b)});
  if(p==='/auth/v1/user')return J({id:uid,email:papel+'@x.com',aud:'authenticated',role:'authenticated'});
  if(p.startsWith('/storage/'))return J([]);
  if(p.endsWith('/perfis')&&req.method()==='GET'){const eu=perfis.find(x=>x.id===uid)||{papel,nome:papel==='professor'?'Tiago':'Douglas',ativo:true,permissoes:[]};
    if(u.searchParams.get('papel')||u.searchParams.get('nome'))return J(filtra(perfis,u));if(obj)return J(eu);return J([eu]);}
  if(p==='/functions/v1/criar-conta'){global.__w.push('FUNC criar-conta '+req.postData());return J({email:'nova@x.com',nome:'Nova',senha:'abc123def'});}
  const rpc=p.split('/rpc/')[1];if(rpc)return J(rpc==='ranking_frequencia'||rpc==='confirmados_aula'?[]:{ok:true});
  const tb=p.split('/rest/v1/')[1];
  if(req.method()!=='GET'){global.__w.push(req.method()+' '+tb+u.search+' '+(req.postData()||''));
    if(req.method()==='POST'&&T[tb]){const body=JSON.parse(req.postData()||'{}');const rows=(Array.isArray(body)?body:[body]).map((x,i)=>({id:'n'+Date.now()+i,criado_em:new Date().toISOString(),visto:false,...x}));T[tb].push(...rows);return J(obj?rows[0]:rows);}
    if(req.method()==='DELETE'&&T[tb]){const r=filtra(T[tb],u);r.forEach(x=>T[tb].splice(T[tb].indexOf(x),1));return J([]);}
    if(req.method()==='PATCH'&&u.searchParams.get('id')&&u.searchParams.get('id').startsWith('in.')){const ids=u.searchParams.get('id').slice(4,-1).split(',');(T[tb]||[]).filter(x=>ids.includes(x.id)).forEach(x=>Object.assign(x,JSON.parse(req.postData()||'{}')));return J([]);}
    if(req.method()==='PATCH'){const id=(u.searchParams.get('id')||'').replace('eq.','');const row=(T[tb]||[]).find(x=>x.id===id);if(row)Object.assign(row,JSON.parse(req.postData()||'{}'));}
    return J(obj?{}:[]);}
  let rows=T[tb]||[];if(papel==='aluno'&&tb==='alunos')rows=rows.filter(a=>a.conta===(global.__uidAluno||UIDA));
  const r=filtra(rows,u);return J(obj?(r[0]||null):r);
 });
 const sess={access_token:'x.y.z',refresh_token:'r',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+172800,user:{id:uid,email:papel+'@x.com',aud:'authenticated',role:'authenticated'}};
 await page.addInitScript(([s,papel])=>{localStorage.setItem('evo-manter','1');localStorage.setItem('evo-auth',JSON.stringify(s));localStorage.setItem('evo-sessao',JSON.stringify({papel:s.papelSessao||papel,nome:papel==='professor'?(s.nomeSessao||'Tiago'):'Douglas Lima'}));},[Object.assign(sess,{papelSessao:global.__papelSessao,nomeSessao:global.__nomeSessao}),papel]);
};
module.exports.T=T;
