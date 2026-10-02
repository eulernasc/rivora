import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Activity, Archive, Bell, Bot, CalendarDays, CheckCircle2, ChevronRight,
  ClipboardCheck, Clock3, Download, FileCheck2, FileSpreadsheet, Gauge,
  History, Inbox, LayoutDashboard, ListTodo, Play, Search, Settings,
  ShieldCheck, SlidersHorizontal, Workflow, XCircle,
} from 'lucide-react'
import './App.css'

type Page = 'Visão geral' | 'Fechamentos' | 'Tarefas' | 'Automações' | 'Importações' | 'Retornos' | 'Análises' | 'Histórico'
type Task = { id:number; title:string; meta:string; done:boolean; due:string }
type Closure = { op:string; period:string; records:number; status:string; next:string }

const NAV_ITEMS:Array<[Page, typeof LayoutDashboard]> = [
  ['Visão geral',LayoutDashboard],['Fechamentos',FileSpreadsheet],['Tarefas',ListTodo],
  ['Automações',Workflow],['Importações',Archive],['Retornos',Inbox],['Análises',Gauge],['Histórico',History],
]
const TASK_SEED:Task[] = [
  {id:1,title:'Aguardar retorno corrigido — Juatuba',meta:'Mariana ou Leonardo',done:false,due:'Aguardando'},
  {id:2,title:'Aguardar retorno corrigido — Jundiaí',meta:'Mariana ou Leonardo',done:false,due:'Aguardando'},
  {id:3,title:'Subir Juatuba para Ticket',meta:'Após retorno corrigido',done:false,due:'05/10'},
  {id:4,title:'Subir Jundiaí para Ticket',meta:'Após retorno corrigido',done:false,due:'05/10'},
]
const CLOSURES:Closure[] = [
  {op:'Juatuba',period:'01/09/2026 — 30/09/2026',records:464,status:'Aguardando retorno',next:'Ticket 05/10'},
  {op:'Jundiaí',period:'27/09/2026 — 30/09/2026',records:53,status:'Aguardando retorno',next:'Ticket 05/10'},
]
const AUTOMATIONS = [
  {name:'Fechamento Juatuba/Jundiaí',state:'Operacional',meta:'Power Automate • rascunho validado'},
  {name:'Monitor de retornos',state:'Operacional',meta:'Outlook • checagem horária'},
  {name:'Sincronização de tarefas',state:'Preparação',meta:'Todoist • integração pendente'},
]

function App(){
  const [page,setPage]=useState<Page>('Visão geral')
  const [query,setQuery]=useState('')
  const [installEvent,setInstallEvent]=useState<any>(null)
  const [installMessage,setInstallMessage]=useState('')
  const [tasks,setTasks]=useState<Task[]>(()=>{
    const saved=localStorage.getItem('rivora.tasks')
    return saved?JSON.parse(saved):TASK_SEED
  })
  useEffect(()=>{
    const handler=(event:any)=>{ event.preventDefault(); setInstallEvent(event) }
    window.addEventListener('beforeinstallprompt',handler)
    return()=>window.removeEventListener('beforeinstallprompt',handler)
  },[])
  const today=useMemo(()=>new Intl.DateTimeFormat('pt-BR',{weekday:'long',day:'2-digit',month:'long'}).format(new Date()),[])
  const installApp=async()=>{
    if(window.matchMedia('(display-mode: standalone)').matches){
      setInstallMessage('RIVORA já está instalado neste dispositivo.')
      return
    }
    if(installEvent){
      await installEvent.prompt()
      const choice=await installEvent.userChoice
      setInstallMessage(choice.outcome==='accepted'?'Instalação iniciada.':'Instalação cancelada.')
      if(choice.outcome==='accepted') setInstallEvent(null)
      return
    }
    const opera=/OPR\//.test(navigator.userAgent)
    setInstallMessage(opera?'O Opera GX no Windows não oferece instalação PWA completa. Abra o RIVORA no Microsoft Edge ou Google Chrome para instalar como aplicativo.':'Use a opção de instalar aplicativo do navegador. Edge e Chrome oferecem suporte completo ao RIVORA como PWA.')
  }
  const toggleTask=(id:number)=>setTasks(current=>{
    const next=current.map(task=>task.id===id?{...task,done:!task.done}:task)
    localStorage.setItem('rivora.tasks',JSON.stringify(next))
    return next
  })
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><img src={`${import.meta.env.BASE_URL}rivora-mark.svg`} className="brand-mark" alt=""/><div><strong>RIVORA</strong><span>Operation Automation System</span></div></div>
      <nav className="nav"><small>NAVEGAÇÃO</small>{NAV_ITEMS.map(([label,Icon])=><button key={label} className={page===label?'nav-item active':'nav-item'} onClick={()=>setPage(label)}><Icon size={18} strokeWidth={1.7}/><span>{label}</span>{label==='Tarefas'&&<b>{tasks.filter(t=>!t.done).length}</b>}</button>)}</nav>
      <div className="side-foot"><div className="mode-card"><i/><div><strong>Modo local</strong><span>Pronto para integrações</span></div></div><button className="nav-item"><Settings size={18}/><span>Configurações</span></button></div>
    </aside>
    <main className="main">
      <header className="topbar">
        <div className="page-title"><span>RIVORA / {page.toUpperCase()}</span><h1>{page}</h1></div>
        <div className="top-actions">
          <label className="search-box"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar no Rivora"/><kbd>CTRL K</kbd></label>
          <button className="install-button" onClick={installApp}><Download size={15}/>Instalar</button>
          <button className="icon-button" aria-label="Notificações"><Bell size={18}/></button>
          <div className="user-chip"><span>EN</span><div><strong>Euler Nascimento</strong><small>Administrador</small></div></div>
        </div>
      </header>
      {installMessage&&<div className="install-note"><span>{installMessage}</span><button onClick={()=>setInstallMessage('')} aria-label="Fechar"><XCircle size={16}/></button></div>}
      <section className="workspace">
        {page==='Visão geral'&&<Overview today={today} tasks={tasks} setPage={setPage}/>}
        {page==='Fechamentos'&&<ClosuresPage/>}
        {page==='Tarefas'&&<TasksPage tasks={tasks} toggleTask={toggleTask}/>}
        {page==='Automações'&&<AutomationsPage/>}
        {page==='Importações'&&<ImportsPage/>}
        {page==='Retornos'&&<ReturnsPage/>}
        {page==='Análises'&&<AnalyticsPage/>}
        {page==='Histórico'&&<HistoryPage/>}
      </section>
    </main>
  </div>
}

function Overview({today,tasks,setPage}:{today:string;tasks:Task[];setPage:(p:Page)=>void}){
  return <>
    <div className="hero-row"><div><p><CalendarDays size={14}/>{today}</p><h2>Centro de comando operacional</h2><span>O que exige ação, o que está em curso e o que já foi automatizado.</span></div><div className="health-badge"><i/><div><strong>Ambiente estável</strong><small>3 serviços monitorados</small></div></div></div>
    <div className="metrics">
      <Metric icon={Activity} label="Processos ativos" value="7" sub="2 aguardando retorno"/>
      <Metric icon={ClipboardCheck} label="Pendências" value={String(tasks.filter(t=>!t.done).length)} sub="Próximo prazo 05/10" tone="warn"/>
      <Metric icon={Bot} label="Automações" value="3" sub="2 operacionais • 1 em preparo" tone="ok"/>
      <Metric icon={ShieldCheck} label="Execuções seguras" value="100%" sub="Nenhum reenvio detectado"/>
    </div>
    <div className="split-grid">
      <section className="panel"><PanelHead kicker="PRIORIDADE" title="Fila de atenção" action="Abrir tarefas" onClick={()=>setPage('Tarefas')}/><div className="queue"><QueueRow tone="amber" title="Juatuba" text="Aguardando retorno corrigido" meta="Ticket 05/10"/><QueueRow tone="amber" title="Jundiaí" text="Aguardando retorno corrigido" meta="Ticket 05/10"/><QueueRow tone="green" title="Fechamentos enviados" text="Conversas vinculadas e preservadas" meta="OK"/></div></section>
      <section className="panel"><PanelHead kicker="FLUXO" title="Linha do tempo" action="Histórico" onClick={()=>setPage('Histórico')}/><div className="timeline"><TimelineItem title="Rascunho de Juatuba validado" time="Agora"/><TimelineItem title="Monitor de retorno executado" time="Última hora"/><TimelineItem title="Jundiaí segue aguardando correção" time="Em acompanhamento"/></div></section>
    </div>
    <section className="panel auto-panel"><PanelHead kicker="AUTOMAÇÃO" title="Saúde dos fluxos" action="Monitorar" onClick={()=>setPage('Automações')}/><div className="automation-strip">{AUTOMATIONS.map(item=><AutomationMini key={item.name} {...item}/>)}</div></section>
  </>
}

function ClosuresPage(){
  const [selected,setSelected]=useState<Closure|null>(null)
  return <PageIntro eyebrow="FECHAMENTOS" title="Fechamentos operacionais" text="Acompanhe o ciclo completo do arquivo ao retorno corrigido.">
    <div className="toolbar"><div><button className="chip active">Todos</button><button className="chip">Aguardando retorno</button><button className="chip">Concluídos</button></div><button className="secondary"><SlidersHorizontal size={14}/>Filtros</button></div>
    <section className="panel table-panel"><div className="table-row table-head"><span>Operação</span><span>Período</span><span>Registros</span><span>Status</span><span>Próxima ação</span><span/></div>{CLOSURES.map(c=><button className="table-row" key={c.op} onClick={()=>setSelected(c)}><b>{c.op}</b><span>{c.period}</span><span>{c.records}</span><span><Pill>{c.status}</Pill></span><span>{c.next}</span><ChevronRight size={16}/></button>)}</section>
    {selected&&<Drawer item={selected} close={()=>setSelected(null)}/>}
  </PageIntro>
}
function TasksPage({tasks,toggleTask}:{tasks:Task[];toggleTask:(id:number)=>void}){return <PageIntro eyebrow="TAREFAS" title="Próximas ações" text="Fila operacional local. A integração com Todoist entra na próxima etapa."><div className="task-list">{tasks.map(t=><button key={t.id} className={t.done?'task done':'task'} onClick={()=>toggleTask(t.id)}>{t.done?<CheckCircle2 size={19}/>:<Clock3 size={19}/>}<div><b>{t.title}</b><span>{t.meta}</span></div><strong>{t.due}</strong></button>)}</div></PageIntro>}
function AutomationsPage(){
  const [running,setRunning]=useState<string|null>(null)
  const test=(name:string)=>{setRunning(name);window.setTimeout(()=>setRunning(null),1000)}
  return <PageIntro eyebrow="AUTOMAÇÕES" title="Monitor de automações" text="Visão técnica dos fluxos, dependências e últimas execuções."><div className="automation-list">{AUTOMATIONS.map(a=><article className="automation-row" key={a.name}><div className="automation-icon"><Workflow size={18}/></div><div><b>{a.name}</b><span>{a.meta}</span></div><Pill tone={a.state==='Operacional'?'green':'neutral'}>{a.state}</Pill><button onClick={()=>test(a.name)} disabled={running===a.name}><Play size={14}/>{running===a.name?'Testando...':'Teste local'}</button></article>)}</div></PageIntro>
}
function ImportsPage(){
  const [count,setCount]=useState(0)
  return <PageIntro eyebrow="IMPORTAÇÕES" title="Controle de importações" text="Prazos, fontes, validações e status em um único fluxo."><div className="empty-state"><Archive size={30}/><h3>Estrutura pronta</h3><p>Use o teste abaixo para simular novos processos antes de conectarmos as fontes reais.</p><button className="secondary" onClick={()=>setCount(v=>v+1)}>Criar processo local</button>{count>0&&<small>{count} processo(s) de teste criado(s).</small>}</div></PageIntro>
}
function ReturnsPage(){return <PageIntro eyebrow="RETORNOS" title="Retornos e conversas" text="Respostas, anexos corrigidos e liberações em um único lugar."><div className="return-grid">{['Juatuba','Jundiaí'].map(op=><article className="return-card" key={op}><div><Inbox size={19}/><Pill>Aguardando resposta</Pill></div><h3>{op}</h3><p>Mariana Tourino Ribeiro • Leonardo Luis Leite</p><button>Ver acompanhamento <ChevronRight size={14}/></button></article>)}</div></PageIntro>}
function AnalyticsPage(){return <PageIntro eyebrow="ANÁLISES" title="Análises operacionais" text="Área preparada para cruzamentos, CPH, divergências e indicadores."><div className="analysis-grid"><Analysis label="PROCESSOS" value="7" detail="em acompanhamento"/><Analysis label="AUTOMAÇÃO" value="67%" detail="dos fluxos planejados iniciados"/><Analysis label="PENDÊNCIAS" value="4" detail="dependências externas"/></div></PageIntro>}
function HistoryPage(){return <PageIntro eyebrow="HISTÓRICO" title="Registro operacional" text="Rastro das ações para saber o que aconteceu e quando."><div className="history-list"><HistoryRow icon={FileCheck2} title="Rascunho Juatuba validado" text="Resposta na mesma conversa, com anexo e assinatura."/><HistoryRow icon={Workflow} title="Monitor executado" text="Nenhum retorno corrigido identificado na última verificação."/><HistoryRow icon={CheckCircle2} title="Base do RIVORA criada" text="PWA responsivo preparado para publicação e integrações."/></div></PageIntro>}
function PageIntro({eyebrow,title,text,children}:{eyebrow:string;title:string;text:string;children:ReactNode}){return <><div className="intro"><span>{eyebrow}</span><h2>{title}</h2><p>{text}</p></div>{children}</>}
function Metric({icon:Icon,label,value,sub,tone=''}:{icon:typeof Activity;label:string;value:string;sub:string;tone?:string}){return <article className={`metric ${tone}`}><div><Icon size={18}/></div><span>{label}</span><b>{value}</b><small>{sub}</small></article>}
function PanelHead({kicker,title,action,onClick}:{kicker:string;title:string;action:string;onClick:()=>void}){return <div className="panel-head"><div><span>{kicker}</span><h3>{title}</h3></div><button onClick={onClick}>{action}<ChevronRight size={14}/></button></div>}
function QueueRow({tone,title,text,meta}:{tone:string;title:string;text:string;meta:string}){return <div className="queue-row"><i className={tone}/><div><b>{title}</b><span>{text}</span></div><strong>{meta}</strong><ChevronRight size={15}/></div>}
function TimelineItem({title,time}:{title:string;time:string}){return <div className="timeline-item"><i/><div><b>{title}</b><span>{time}</span></div></div>}
function AutomationMini({name,state,meta}:{name:string;state:string;meta:string}){return <div className="automation-mini"><div><b>{name}</b><span>{meta}</span></div><Pill tone={state==='Operacional'?'green':'neutral'}>{state}</Pill></div>}
function Pill({children,tone='amber'}:{children:ReactNode;tone?:string}){return <span className={`pill ${tone}`}>{children}</span>}
function Analysis({label,value,detail}:{label:string;value:string;detail:string}){return <article className="analysis-card"><span>{label}</span><b>{value}</b><small>{detail}</small></article>}
function HistoryRow({icon:Icon,title,text}:{icon:typeof Activity;title:string;text:string}){return <div className="history-row"><div><Icon size={17}/></div><section><b>{title}</b><span>{text}</span></section><small>02/10/2026</small></div>}
function Drawer({item,close}:{item:Closure;close:()=>void}){return <div className="backdrop" onClick={close}><aside className="drawer" onClick={e=>e.stopPropagation()}><button className="drawer-close" onClick={close}><XCircle size={20}/></button><span>FECHAMENTO</span><h3>{item.op}</h3><Pill>{item.status}</Pill><dl><div><dt>Período</dt><dd>{item.period}</dd></div><div><dt>Registros</dt><dd>{item.records}</dd></div><div><dt>Próxima ação</dt><dd>{item.next}</dd></div></dl><button className="primary">Abrir fluxo</button></aside></div>}
export default App
