/* Testes · uma noite de aula de exemplo: Adulto 19h com código aberto, 7 confirmados e 5 já no tatame (alunos fictícios) */
module.exports=function(T){
 const two=n=>(n<10?'0':'')+n,iso=d=>d.getFullYear()+'-'+two(d.getMonth()+1)+'-'+two(d.getDate());
 const H=iso(new Date());const base={turma:'adulto',horario:'19:00',ativo:true,mensalidade:200,vencimento:10,inicio:'2025-03-10',criado_em:'2026-11-01T10:00:00Z',aulas_antes:0,aulas_antes_ate:null,conta:null,responsavel_conta:null,foto:null,nascimento:null,whatsapp:'15999990000',email:null};
 const nasc33=(()=>{const d=new Date();return (d.getFullYear()-33)+'-'+two(d.getMonth()+1)+'-'+two(d.getDate())})();
 const novos=[['h1','Rafael Monteiro','marrom',2],['h2','Camila Duarte','roxa',1,'feminino',nasc33],['h3','Thiago Moreira','azul',0],['h4','Eduardo Prado','branca',0],['h5','Renata Siqueira','branca',1,'feminino'],['h6','Bruno Tavares','azul',3],['h7','Felipe Antunes','roxa',0],['h8','Gustavo Lima','preta',1],['h9','Aline Duarte','branca',4,'feminino']];
 novos.forEach(([id,nome,faixa,graus,turma,nasc])=>T.alunos.push({...base,id,nome,faixa,graus,turma:turma||'adulto',nascimento:nasc||null}));
 ['h1','h2','h3','h4','h5','h6','h7'].forEach((a,i)=>T.reservas.push({id:'r'+i,aluno:a,data:H,hora:'19:00',criado_em:H+'T1'+i+':00:00-03:00'}));
 ['h1','h2','h3','h4','h5'].forEach((a,i)=>T.presencas.push({id:'ph'+i,aluno:a,data:H,hora:'19:00',turma:'adulto',como:i===4?'professor':'app',chegou_em:H+'T18:5'+i+':00-03:00'}));
 ['a2','a3'].forEach((a,i)=>T.presencas.push({id:'pm'+i,aluno:a,data:H,hora:'08:00',turma:'adulto',como:'app',chegou_em:H+'T08:0'+i+':00-03:00'}));
 T.chamadas.push({id:'c1',data:H,hora:'19:00',turma:'adulto',codigo:'TRU482',valido_ate:H+'T19:38:00-03:00'});
 T.leads.push({id:'l1',nome:'Marcos',whatsapp:'15988887777',programa:'adulto',origem:'site',etapa:'novo',criado_em:H+'T16:00:00-03:00'},{id:'l2',nome:'Joana',whatsapp:null,programa:'kids',origem:'instagram',etapa:'novo',criado_em:H+'T12:00:00-03:00'});
 T.mensalidades.push({id:'m1',aluno:'h8',referencia:'2026-11-01',valor:200,vencimento:'2026-11-06',pago_em:null,criado_em:'2026-11-01T10:00:00Z'},{id:'m2',aluno:'h7',referencia:'2026-11-01',valor:200,vencimento:'2026-11-11',pago_em:null,criado_em:'2026-11-01T10:00:00Z'});
};
