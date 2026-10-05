import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Archive, Bell, CalendarDays, CheckCircle2, ChevronRight,
  Clock3, Download, FileCheck2, FileSpreadsheet, Gauge,
  History, Inbox, LayoutDashboard, ListTodo, Play, Search, Settings,
  SlidersHorizontal, Workflow, XCircle,
} from 'lucide-react'
import './App.css'

type Page = 'Visão geral' | 'Relatórios' | 'Tarefas' | 'Automações' | 'Fechamentos e Importações' | 'Retornos' | 'Análises' | 'Histórico'
type Task = { id:number; title:string; meta:string; done:boolean; due:string }
type Closure = { op:string; period:string; records:number; status:string; next:string }

const NAV_ITEMS:Array<[Page, typeof LayoutDashboard]> = [
  ['Visão geral',LayoutDashboard],['Relatórios',FileSpreadsheet],['Tarefas',ListTodo],
  ['Automações',Workflow],['Fechamentos e Importações',Archive],['Retornos',Inbox],['Análises',Gauge],['Histórico',History],
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

const SEARCH_ITEMS:Array<{label:string;detail:string;page:Page}> = [
  {label:'Visão geral',detail:'Centro de comando e estado operacional',page:'Visão geral'},
  {label:'Relatórios',detail:'Juatuba, Jundiaí, períodos, envios e retornos',page:'Relatórios'},
  {label:'Tarefas',detail:'Pendências e próximas ações',page:'Tarefas'},
  {label:'Automações',detail:'Fluxos, testes e monitoramento',page:'Automações'},
  {label:'Fechamentos e Importações',detail:'Confirmações de fechamento e controle das importações por operação',page:'Fechamentos e Importações'},
  {label:'Retornos',detail:'Conversas e anexos corrigidos',page:'Retornos'},
  {label:'Análises',detail:'Indicadores, divergências e CPH',page:'Análises'},
  {label:'Histórico',detail:'Registro de ações e mudanças',page:'Histórico'},
  {label:'Juatuba',detail:'Relatório aguardando retorno corrigido',page:'Relatórios'},
  {label:'Jundiaí',detail:'Relatório aguardando retorno corrigido',page:'Relatórios'},
]

function App(){
  const [page,setPage]=useState<Page>('Visão geral')
  const [query,setQuery]=useState('')
  const [searchOpen,setSearchOpen]=useState(false)
  const [notificationsOpen,setNotificationsOpen]=useState(false)
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
  useEffect(()=>{
    const handler=(event:KeyboardEvent)=>{
      if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){
        event.preventDefault()
        setSearchOpen(true)
        window.setTimeout(()=>document.getElementById('rivora-global-search')?.focus(),0)
      }
      if(event.key==='Escape'){ setSearchOpen(false); setNotificationsOpen(false) }
    }
    window.addEventListener('keydown',handler)
    return()=>window.removeEventListener('keydown',handler)
  },[])
  const today=useMemo(()=>new Intl.DateTimeFormat('pt-BR',{weekday:'long',day:'2-digit',month:'long'}).format(new Date()),[])
  const searchResults=useMemo(()=>{
    const term=query.trim().toLocaleLowerCase('pt-BR')
    return term?SEARCH_ITEMS.filter(item=>(item.label+' '+item.detail).toLocaleLowerCase('pt-BR').includes(term)):SEARCH_ITEMS.slice(0,6)
  },[query])
  const navigateFromSearch=(target:Page)=>{ setPage(target); setSearchOpen(false); setQuery('') }
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
  const addTask=(title:string,meta:string,due:string)=>setTasks(current=>{
    const next=[...current,{id:Math.max(0,...current.map(t=>t.id))+1,title,meta,done:false,due}]
    localStorage.setItem('rivora.tasks',JSON.stringify(next))
    return next
  })
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-icon-wrap"><img src={`${import.meta.env.BASE_URL}rivora-mark.svg`} className="brand-mark" alt=""/><i className="brand-scan"/></div><div><strong>RIVORA</strong><span>Operation Automation System</span></div></div>
      <nav className="nav"><small>NAVEGAÇÃO</small>{NAV_ITEMS.map(([label,Icon])=><button key={label} className={page===label?'nav-item active':'nav-item'} onClick={()=>setPage(label)}><Icon size={18} strokeWidth={1.7}/><span>{label}</span>{label==='Tarefas'&&<b>{tasks.filter(t=>!t.done).length}</b>}</button>)}</nav>
      <div className="side-foot"><div className="mode-card"><i/><div><strong>Modo local</strong><span>Pronto para integrações</span></div></div><button className="nav-item"><Settings size={18}/><span>Configurações</span></button></div>
    </aside>
    <main className="main">
      <header className="topbar">
        <div className="page-title"><span>RIVORA / {page.toUpperCase()}</span><div><h1>{page}</h1><i className="runtime-dot"/></div></div>
        <div className="top-actions">
          <label className="search-box"><Search size={16}/><input id="rivora-global-search" value={query} onFocus={()=>setSearchOpen(true)} onChange={e=>{setQuery(e.target.value);setSearchOpen(true)}} onKeyDown={e=>{if(e.key==='Enter'&&searchResults[0])navigateFromSearch(searchResults[0].page)}} placeholder="Buscar no Rivora"/><kbd>CTRL K</kbd></label>
          <button className="install-button" onClick={installApp}><Download size={15}/>Instalar</button>
          <button className={notificationsOpen?'icon-button active':'icon-button'} aria-label="Notificações" onClick={()=>{setNotificationsOpen(v=>!v);setSearchOpen(false)}}><Bell size={18}/><i className="notification-dot"/></button>
          <div className="user-chip"><span>EN</span><div><strong>Euler Nascimento</strong><small>Administrador</small></div></div>
        </div>
      </header>
      {searchOpen&&<div className="search-popover">
        <div className="popover-head"><span>BUSCA GLOBAL</span><kbd>ESC</kbd></div>
        <div className="search-results">
          {searchResults.length?searchResults.map((item,index)=><button key={item.label+item.detail} onClick={()=>navigateFromSearch(item.page)}>
            <span className="search-index">{String(index+1).padStart(2,'0')}</span>
            <div><b>{item.label}</b><small>{item.detail}</small></div>
            <ChevronRight size={15}/>
          </button>):<div className="no-results">Nenhum resultado encontrado.</div>}
        </div>
      </div>}
      {notificationsOpen&&<div className="notification-popover">
        <div className="popover-head"><span>NOTIFICAÇÕES</span><button onClick={()=>setNotificationsOpen(false)}><XCircle size={15}/></button></div>
        <div className="notification-list">
          <article><i className="amber"/><div><b>Juatuba aguarda retorno corrigido</b><small>Próxima ação prevista para 05/10.</small></div></article>
          <article><i className="amber"/><div><b>Jundiaí aguarda retorno corrigido</b><small>Conversa vinculada permanece em acompanhamento.</small></div></article>
          <article><i className="green"/><div><b>Fluxos de fechamento operacionais</b><small>Nenhum reenvio ou falha crítica detectada.</small></div></article>
        </div>
      </div>}
      {installMessage&&<div className="install-note"><span>{installMessage}</span><button onClick={()=>setInstallMessage('')} aria-label="Fechar"><XCircle size={16}/></button></div>}
      <section className="workspace">
        {page==='Visão geral'&&<Overview today={today} tasks={tasks} setPage={setPage}/>}
        {page==='Relatórios'&&<ClosuresPage/>}
        {page==='Tarefas'&&<TasksPage tasks={tasks} toggleTask={toggleTask} addTask={addTask}/>} 
        {page==='Automações'&&<AutomationsPage/>}
        {page==='Fechamentos e Importações'&&<ImportsPage/>}
        {page==='Retornos'&&<ReturnsPage setPage={setPage}/>} 
        {page==='Análises'&&<AnalyticsPage/>}
        {page==='Histórico'&&<HistoryPage/>}
      </section>
    </main>
  </div>
}

function Overview({today,tasks,setPage}:{today:string;tasks:Task[];setPage:(p:Page)=>void}){
  const pending=tasks.filter(t=>!t.done).length
  return <>
    <section className="dash-hero">
      <div className="dash-hero-copy">
        <p><CalendarDays size={15}/>{today}</p>
        <h2>Olá, <em>Euler</em></h2>
        <span>Aqui está o panorama da operação e o que precisa da sua atenção hoje.</span>
      </div>
      <button className="system-status-card" onClick={()=>setPage('Automações')}>
        <i/>
        <div><b>Sistema operacional</b><span>Todos os serviços em funcionamento</span></div>
        <ChevronRight size={18}/>
      </button>
    </section>

    <section className="dash-kpis">
      <button className="dash-kpi kpi-blue" onClick={()=>setPage('Relatórios')}>
        <div className="kpi-icon"><FileSpreadsheet size={21}/></div>
        <div><span>Processos ativos</span><b>7</b><small>2 aguardando retorno</small></div>
        <ChevronRight size={17}/>
      </button>
      <button className="dash-kpi kpi-amber" onClick={()=>setPage('Tarefas')}>
        <div className="kpi-icon"><Clock3 size={21}/></div>
        <div><span>Pendências</span><b>{pending}</b><small>Próximo prazo 05/10</small></div>
        <ChevronRight size={17}/>
      </button>
      <button className="dash-kpi kpi-green" onClick={()=>setPage('Automações')}>
        <div className="kpi-icon"><Workflow size={21}/></div>
        <div><span>Automações</span><b>3</b><small>2 operacionais • 1 em preparo</small></div>
        <ChevronRight size={17}/>
      </button>
      <button className="dash-kpi kpi-violet" onClick={()=>setPage('Histórico')}>
        <div className="kpi-icon"><CheckCircle2 size={21}/></div>
        <div><span>Execuções seguras</span><b>100%</b><small>Nenhum reenvio detectado</small></div>
        <ChevronRight size={17}/>
      </button>
    </section>

    <section className="dash-main-grid">
      <div className="dash-panel attention-panel">
        <header>
          <div className="panel-title-with-icon"><span className="panel-symbol amber-symbol"><ListTodo size={19}/></span><div><h3>Fila de atenção</h3><small>Itens que precisam da sua ação</small></div></div>
          <button onClick={()=>setPage('Tarefas')}>Abrir todas <ChevronRight size={15}/></button>
        </header>
        <div className="attention-items">
          <button onClick={()=>setPage('Relatórios')}>
            <i className="amber"/>
            <span className="row-icon"><FileSpreadsheet size={18}/></span>
            <div><b>Juatuba</b><small>Aguardando retorno corrigido</small></div>
            <strong>Ticket 05/10</strong><ChevronRight size={16}/>
          </button>
          <button onClick={()=>setPage('Relatórios')}>
            <i className="amber"/>
            <span className="row-icon"><FileSpreadsheet size={18}/></span>
            <div><b>Jundiaí</b><small>Aguardando retorno corrigido</small></div>
            <strong>Ticket 05/10</strong><ChevronRight size={16}/>
          </button>
          <button onClick={()=>setPage('Automações')}>
            <i className="green"/>
            <span className="row-icon"><Inbox size={18}/></span>
            <div><b>Fechamentos enviados</b><small>Conversas vinculadas e preservadas</small></div>
            <strong className="ok-badge">OK</strong><ChevronRight size={16}/>
          </button>
        </div>
      </div>

      <div className="dash-panel timeline-panel">
        <header>
          <div className="panel-title-with-icon"><span className="panel-symbol blue-symbol"><History size={19}/></span><div><h3>Linha do tempo</h3><small>Últimas atividades do sistema</small></div></div>
          <button onClick={()=>setPage('Histórico')}>Ver histórico</button>
        </header>
        <div className="dash-timeline">
          <TimelineItem title="Rascunho de Juatuba validado" time="Agora"/>
          <TimelineItem title="Monitor de retorno executado" time="Há 1 hora"/>
          <TimelineItem title="Jundiaí segue aguardando correção" time="Em acompanhamento"/>
          <TimelineItem title="RIVORA atualizado" time="Agora"/>
        </div>
      </div>
    </section>

    <section className="dash-panel flow-health">
      <header>
        <div className="panel-title-with-icon"><span className="panel-symbol cyan-symbol"><Workflow size={19}/></span><div><h3>Saúde dos fluxos</h3><small>Status das automações e integrações</small></div></div>
        <button onClick={()=>setPage('Automações')}>Monitorar <ChevronRight size={15}/></button>
      </header>
      <div className="flow-health-grid">
        {AUTOMATIONS.map(item=><article key={item.name}>
          <div><b>{item.name}</b><small>{item.meta}</small></div>
          <Pill tone={item.state==='Operacional'?'green':'neutral'}>{item.state}</Pill>
        </article>)}
      </div>
    </section>
  </>
}
function ClosuresPage(){
  const [selected,setSelected]=useState<Closure|null>(null)
  const [filter,setFilter]=useState<'Todos'|'Aguardando retorno'|'Concluídos'>('Todos')
  const [showSummary,setShowSummary]=useState(false)
  const visible=CLOSURES.filter(item=>{
    if(filter==='Todos') return true
    if(filter==='Aguardando retorno') return item.status==='Aguardando retorno'
    return item.status==='Concluído'
  })
  return <PageIntro eyebrow="FECHAMENTOS" title="Fechamentos operacionais" text="Acompanhe o ciclo completo do arquivo ao retorno corrigido.">
    <div className="closure-status-line">
      <div><span>EM ACOMPANHAMENTO</span><b>{CLOSURES.filter(c=>c.status==='Aguardando retorno').length}</b></div>
      <div><span>REGISTROS NO CICLO</span><b>{CLOSURES.reduce((sum,c)=>sum+c.records,0)}</b></div>
      <div><span>PRÓXIMO MARCO</span><b>05/10</b></div>
    </div>
    <div className="toolbar">
      <div>{(['Todos','Aguardando retorno','Concluídos'] as const).map(item=><button key={item} className={filter===item?'chip active':'chip'} onClick={()=>setFilter(item)}>{item}</button>)}</div>
      <button className={showSummary?'secondary active':'secondary'} onClick={()=>setShowSummary(v=>!v)}><SlidersHorizontal size={14}/>Resumo</button>
    </div>
    {showSummary&&<div className="closure-summary">
      <span><b>Juatuba</b> • 464 registros • retorno pendente</span>
      <span><b>Jundiaí</b> • 53 registros • retorno pendente</span>
      <small>Os dados ainda são locais; a sincronização com Outlook e SharePoint entra quando conectarmos as APIs corporativas.</small>
    </div>}
    <section className="panel table-panel">
      <div className="table-row table-head"><span>Operação</span><span>Período</span><span>Registros</span><span>Status</span><span>Próxima ação</span><span/></div>
      {visible.length?visible.map(c=><button className="table-row" key={c.op} onClick={()=>setSelected(c)}><b>{c.op}</b><span>{c.period}</span><span>{c.records}</span><span><Pill>{c.status}</Pill></span><span>{c.next}</span><ChevronRight size={16}/></button>):<div className="table-empty">Nenhum fechamento neste filtro.</div>}
    </section>
    {selected&&<Drawer item={selected} close={()=>setSelected(null)}/>}
  </PageIntro>
}
function TasksPage({tasks,toggleTask,addTask}:{tasks:Task[];toggleTask:(id:number)=>void;addTask:(title:string,meta:string,due:string)=>void}){
  const [filter,setFilter]=useState<'Abertas'|'Todas'|'Concluídas'>('Abertas')
  const [creating,setCreating]=useState(false)
  const [title,setTitle]=useState('')
  const [due,setDue]=useState('Sem prazo')
  const visible=tasks.filter(task=>filter==='Todas'||(filter==='Abertas'?!task.done:task.done))
  const submit=()=>{
    const clean=title.trim()
    if(!clean) return
    addTask(clean,'Criada no RIVORA',due)
    setTitle('')
    setDue('Sem prazo')
    setCreating(false)
  }
  return <PageIntro eyebrow="TAREFAS" title="Próximas ações" text="Fila operacional local. A integração com Todoist entra na próxima etapa.">
    <div className="task-toolbar">
      <div>{(['Abertas','Todas','Concluídas'] as const).map(item=><button key={item} className={filter===item?'chip active':'chip'} onClick={()=>setFilter(item)}>{item}</button>)}</div>
      <button className="task-new" onClick={()=>setCreating(v=>!v)}>{creating?'Cancelar':'+ Nova tarefa'}</button>
    </div>
    {creating&&<div className="task-composer">
      <label><span>TAREFA</span><input value={title} onChange={e=>setTitle(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')submit()}} placeholder="O que precisa ser feito?" autoFocus/></label>
      <label><span>PRAZO</span><input value={due} onChange={e=>setDue(e.target.value)} placeholder="Ex.: 05/10"/></label>
      <button onClick={submit}>Adicionar</button>
    </div>}
    <div className="task-list">
      {visible.length?visible.map(t=><button key={t.id} className={t.done?'task done':'task'} onClick={()=>toggleTask(t.id)}>{t.done?<CheckCircle2 size={19}/>:<Clock3 size={19}/>}<div><b>{t.title}</b><span>{t.meta}</span></div><strong>{t.due}</strong></button>):<div className="task-empty">Nenhuma tarefa neste filtro.</div>}
    </div>
  </PageIntro>
}
function AutomationsPage(){
  const [running,setRunning]=useState<string|null>(null)
  const [lastRuns,setLastRuns]=useState<Record<string,string>>({})
  const [log,setLog]=useState<Array<{time:string;text:string}>>([
    {time:'Inicial',text:'Console local carregado. Nenhuma execução real será disparada nesta etapa.'},
  ])
  const test=(name:string)=>{
    if(running) return
    setRunning(name)
    const started=new Date()
    window.setTimeout(()=>{
      const time=started.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})
      setLastRuns(current=>({...current,[name]:time}))
      setLog(current=>[{time,text:`Teste local concluído: ${name}`},...current].slice(0,6))
      setRunning(null)
    },900)
  }
  return <PageIntro eyebrow="AUTOMAÇÕES" title="Console de automações" text="Teste a camada local e acompanhe os fluxos antes de conectar execuções reais.">
    <div className="automation-summary">
      <div><span>OPERACIONAIS</span><b>2</b></div>
      <div><span>EM PREPARAÇÃO</span><b>1</b></div>
      <div><span>FALHAS LOCAIS</span><b className="success-text">0</b></div>
    </div>
    <div className="automation-list">
      {AUTOMATIONS.map(a=><article className="automation-row" key={a.name}>
        <div className="automation-icon"><Workflow size={18}/></div>
        <div><b>{a.name}</b><span>{a.meta}</span>{lastRuns[a.name]&&<small className="last-run">Último teste local: {lastRuns[a.name]}</small>}</div>
        <Pill tone={a.state==='Operacional'?'green':'neutral'}>{a.state}</Pill>
        <button onClick={()=>test(a.name)} disabled={running!==null}><Play size={14}/>{running===a.name?'Executando...':'Teste local'}</button>
      </article>)}
    </div>
    <section className="automation-log">
      <div className="automation-log-head"><span>LOG LOCAL</span><small>As ações abaixo não executam Power Automate, Outlook ou SharePoint.</small></div>
      <div>{log.map((item,index)=><article key={item.time+index}><span>{item.time}</span><b>{item.text}</b><CheckCircle2 size={14}/></article>)}</div>
    </section>
  </PageIntro>
}
function ImportsPage(){
  type ClosureStatus='Aguardando confirmação'|'Confirmado'|'Atrasado'
  type ImportDecision='Pendente'|'Realiza importação'|'Não realiza importação'
  type ImportStatus='Não iniciada'|'Em andamento'|'Concluída'|'Não se aplica'
  type OperationControl={
    key:string
    operation:string
    fleetType:string
    responsible:string
    closureStatus:ClosureStatus
    importDecision:ImportDecision
    importStatus:ImportStatus
    confirmedAt:string|null
    source:string
  }

  const initial:OperationControl[]=[
    {key:'aracruz-frota-pesada',operation:'Aracruz',fleetType:'Frota Pesada',responsible:'Operação',closureStatus:'Aguardando confirmação',importDecision:'Pendente',importStatus:'Não iniciada',confirmedAt:null,source:'Microsoft 365'},
    {key:'aracruz-maquinas',operation:'Aracruz',fleetType:'Máquinas',responsible:'Operação',closureStatus:'Aguardando confirmação',importDecision:'Pendente',importStatus:'Não iniciada',confirmedAt:null,source:'Microsoft 365'},
    {key:'cenibra-frota-pesada',operation:'Cenibra',fleetType:'Frota Pesada',responsible:'Operação',closureStatus:'Aguardando confirmação',importDecision:'Pendente',importStatus:'Não iniciada',confirmedAt:null,source:'Microsoft 365'},
    {key:'cenibra-maquinas',operation:'Cenibra',fleetType:'Máquinas',responsible:'Operação',closureStatus:'Aguardando confirmação',importDecision:'Pendente',importStatus:'Não iniciada',confirmedAt:null,source:'Microsoft 365'},
    {key:'costa-rica-frota-pesada',operation:'Costa Rica',fleetType:'Frota Pesada',responsible:'Operação',closureStatus:'Aguardando confirmação',importDecision:'Pendente',importStatus:'Não iniciada',confirmedAt:null,source:'Microsoft 365'},
    {key:'costa-rica-frota-leve',operation:'Costa Rica',fleetType:'Frota Leve',responsible:'Operação',closureStatus:'Aguardando confirmação',importDecision:'Pendente',importStatus:'Não iniciada',confirmedAt:null,source:'Microsoft 365'},
    {key:'alto-taquari-frota-pesada',operation:'Alto Taquari',fleetType:'Frota Pesada',responsible:'Operação',closureStatus:'Aguardando confirmação',importDecision:'Pendente',importStatus:'Não iniciada',confirmedAt:null,source:'Microsoft 365'},
    {key:'alto-taquari-frota-leve',operation:'Alto Taquari',fleetType:'Frota Leve',responsible:'Operação',closureStatus:'Aguardando confirmação',importDecision:'Pendente',importStatus:'Não iniciada',confirmedAt:null,source:'Microsoft 365'},
    {key:'ribas-frota-pesada',operation:'Ribas',fleetType:'Frota Pesada',responsible:'Operação',closureStatus:'Aguardando confirmação',importDecision:'Pendente',importStatus:'Não iniciada',confirmedAt:null,source:'Microsoft 365'},
    {key:'ribas-maquinas',operation:'Ribas',fleetType:'Máquinas',responsible:'Operação',closureStatus:'Aguardando confirmação',importDecision:'Pendente',importStatus:'Não iniciada',confirmedAt:null,source:'Microsoft 365'},
    {key:'bracell-frota-pesada',operation:'Bracell',fleetType:'Frota Pesada',responsible:'Operação',closureStatus:'Aguardando confirmação',importDecision:'Pendente',importStatus:'Não iniciada',confirmedAt:null,source:'Microsoft 365'},
    {key:'jundiai-frota-pesada',operation:'Jundiaí',fleetType:'Frota Pesada',responsible:'Euler',closureStatus:'Aguardando confirmação',importDecision:'Pendente',importStatus:'Não iniciada',confirmedAt:null,source:'Fluxo Juatuba/Jundiaí'},
    {key:'juatuba-frota-pesada',operation:'Juatuba',fleetType:'Frota Pesada',responsible:'Euler',closureStatus:'Aguardando confirmação',importDecision:'Pendente',importStatus:'Não iniciada',confirmedAt:null,source:'Fluxo Juatuba/Jundiaí'},
  ]

  const thirdBusinessDayDeadline=useMemo(()=>{
    const now=new Date()
    let businessDays=0
    for(let day=1;day<=10;day++){
      const date=new Date(now.getFullYear(),now.getMonth(),day,23,59,59,999)
      const weekday=date.getDay()
      if(weekday!==0&&weekday!==6) businessDays++
      if(businessDays===3) return date
    }
    return new Date(now.getFullYear(),now.getMonth(),3,23,59,59,999)
  },[])
  const deadlinePassed=Date.now()>thirdBusinessDayDeadline.getTime()
  const deadlineLabel=thirdBusinessDayDeadline.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})

  const [items,setItems]=useState<OperationControl[]>(()=>{
    const saved=localStorage.getItem('rivora.operationControl')
    if(!saved) return initial
    const parsed=JSON.parse(saved) as Array<Omit<OperationControl,'importDecision'> & {importDecision:ImportDecision|'Sim'|'Não'}>
    return parsed.map(item=>({
      ...item,
      importDecision:item.importDecision==='Sim'?'Realiza importação':item.importDecision==='Não'?'Não realiza importação':item.importDecision,
      importStatus:item.importDecision==='Não'?'Não se aplica':item.importStatus,
    }))
  })
  const [expanded,setExpanded]=useState<string|null>('Juatuba')

  const persist=(next:OperationControl[])=>{
    setItems(next)
    localStorage.setItem('rivora.operationControl',JSON.stringify(next))
  }

  useEffect(()=>{
    if(!deadlinePassed) return
    setItems(current=>{
      let changed=false
      const next=current.map(item=>{
        if(item.closureStatus==='Aguardando confirmação'){
          changed=true
          return {...item,closureStatus:'Atrasado' as ClosureStatus}
        }
        return item
      })
      if(changed) localStorage.setItem('rivora.operationControl',JSON.stringify(next))
      return changed?next:current
    })
  },[deadlinePassed])

  const toggleClosure=(item:OperationControl)=>{
    const nextStatus:ClosureStatus=item.closureStatus==='Confirmado'?(deadlinePassed?'Atrasado':'Aguardando confirmação'):'Confirmado'
    const now=nextStatus==='Confirmado'?new Date().toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}):null
    persist(items.map(row=>row.key===item.key?{...row,closureStatus:nextStatus,confirmedAt:now}:row))
  }

  const cycleDecision=(item:OperationControl)=>{
    const nextDecision:ImportDecision=
      item.importDecision==='Pendente'?'Realiza importação':
      item.importDecision==='Realiza importação'?'Não realiza importação':'Pendente'
    const nextStatus:ImportStatus=
      nextDecision==='Não realiza importação'?'Não se aplica':
      nextDecision==='Realiza importação'&&item.importStatus==='Não se aplica'?'Não iniciada':item.importStatus
    persist(items.map(row=>row.key===item.key?{...row,importDecision:nextDecision,importStatus:nextStatus}:row))
  }

  const cycleImportStatus=(item:OperationControl)=>{
    if(item.importDecision!=='Realiza importação') return
    const nextStatus:ImportStatus=
      item.importStatus==='Não iniciada'?'Em andamento':
      item.importStatus==='Em andamento'?'Concluída':'Não iniciada'
    persist(items.map(row=>row.key===item.key?{...row,importStatus:nextStatus}:row))
  }

  const confirmOperation=(operation:string)=>{
    const now=new Date().toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})
    persist(items.map(item=>item.operation===operation?{...item,closureStatus:'Confirmado' as ClosureStatus,confirmedAt:now}:item))
  }

  const setOperationDecision=(operation:string,decision:'Realiza importação'|'Não realiza importação')=>{
    persist(items.map(item=>{
      if(item.operation!==operation) return item
      const importStatus:ImportStatus=decision==='Não realiza importação'?'Não se aplica':item.importStatus==='Não se aplica'?'Não iniciada':item.importStatus
      return {...item,importDecision:decision,importStatus}
    }))
  }

  const operations=Array.from(new Set(items.map(item=>item.operation)))
  const confirmed=items.filter(item=>item.closureStatus==='Confirmado').length
  const overdue=items.filter(item=>item.closureStatus==='Atrasado').length
  const awaiting=items.length-confirmed-overdue
  const willImport=items.filter(item=>item.importDecision==='Realiza importação').length
  const importPending=items.filter(item=>item.importDecision==='Realiza importação'&&item.importStatus!=='Concluída').length

  return <PageIntro eyebrow="FECHAMENTOS E IMPORTAÇÕES" title="Fechamentos e importações" text="Clique nos status para avançar rapidamente. Se uma operação inteira estiver igual, use as ações rápidas e evite marcar tipo por tipo.">
    <div className="operation-control-summary">
      <div><span>OPERAÇÕES</span><b>{operations.length}</b><small>{items.length} frentes de controle</small></div>
      <div><span>FECHAMENTOS CONFIRMADOS</span><b>{confirmed}</b><small>{overdue>0?overdue+' atrasados • ':''}{awaiting} aguardando confirmação</small></div>
      <div><span>VÃO IMPORTAR</span><b>{willImport}</b><small>{importPending} importações pendentes</small></div>
      <div className="sync-card"><span>REGRA DE PRAZO</span><b>3º dia útil</b><small>Sem confirmação após {deadlineLabel}, o fechamento muda automaticamente para atrasado.</small></div>
    </div>

    <div className="operation-accordion">
      {operations.map(operation=>{
        const rows=items.filter(item=>item.operation===operation)
        const isOpen=expanded===operation
        const done=rows.filter(item=>item.closureStatus==='Confirmado').length
        const late=rows.filter(item=>item.closureStatus==='Atrasado').length
        const imports=rows.filter(item=>item.importDecision==='Realiza importação').length
        const fullyDone=rows.every(item=>item.closureStatus==='Confirmado')
        return <section className={isOpen?'operation-card open':'operation-card'} key={operation}>
          <button className="operation-head" onClick={()=>setExpanded(isOpen?null:operation)}>
            <div className="operation-name"><span className={fullyDone?'operation-dot green':late?'operation-dot red':'operation-dot amber'}/><div><b>{operation}</b><small>{rows.length} {rows.length===1?'tipo':'tipos'} de frota</small></div></div>
            <div className="operation-head-stats">
              <span><strong>{done}/{rows.length}</strong> fechamentos</span>
              {late>0&&<span className="late-stat"><strong>{late}</strong> atrasados</span>}
              <span><strong>{imports}</strong> importações</span>
            </div>
            <ChevronRight className="operation-chevron" size={18}/>
          </button>

          {isOpen&&<div className="operation-body">
            {rows.length>1&&<div className="operation-quick-actions">
              <span>AÇÕES RÁPIDAS</span>
              <button onClick={()=>confirmOperation(operation)}><CheckCircle2 size={14}/>Confirmar todos</button>
              <button onClick={()=>setOperationDecision(operation,'Realiza importação')}><Archive size={14}/>Todos importam</button>
              <button onClick={()=>setOperationDecision(operation,'Não realiza importação')}><XCircle size={14}/>Nenhum importa</button>
            </div>}

            {rows.map(item=><article className="fleet-control-row" key={item.key}>
              <div className="fleet-main">
                <span className="fleet-icon"><Archive size={17}/></span>
                <div><b>{item.fleetType}</b><small>{item.responsible==='Euler'?'Responsável: Euler':'Responsável: operação'} • {item.source}</small></div>
              </div>

              <div className="control-group">
                <span>FECHAMENTO</span>
                <button className={item.closureStatus==='Confirmado'?'cycle-button success':item.closureStatus==='Atrasado'?'cycle-button danger':'cycle-button warning'} onClick={()=>toggleClosure(item)}>
                  {item.closureStatus==='Confirmado'?<CheckCircle2 size={15}/>:<Clock3 size={15}/>}
                  <b>{item.closureStatus}</b>
                  <ChevronRight size={14}/>
                </button>
                <small>{item.confirmedAt?'Confirmado em '+item.confirmedAt:item.closureStatus==='Atrasado'?'Prazo excedido após o 3º dia útil ('+deadlineLabel+')':'Clique para confirmar • prazo '+deadlineLabel}</small>
              </div>

              <div className="control-group">
                <span>IMPORTAÇÃO</span>
                <button className={item.importDecision==='Realiza importação'?'cycle-button info':item.importDecision==='Não realiza importação'?'cycle-button neutral':'cycle-button warning'} onClick={()=>cycleDecision(item)}>
                  <Archive size={15}/>
                  <b>{item.importDecision==='Pendente'?'Definir':item.importDecision}</b>
                  <ChevronRight size={14}/>
                </button>
                <small>{item.importDecision==='Pendente'?'Clique: realiza → não realiza → definir':item.importDecision==='Realiza importação'?'Esta frente terá importação':'Esta frente não realiza importação'}</small>
              </div>

              <div className="control-group import-progress">
                <span>STATUS DA IMPORTAÇÃO</span>
                <button className={item.importStatus==='Concluída'?'cycle-button success':item.importStatus==='Em andamento'?'cycle-button info':'cycle-button neutral'} onClick={()=>cycleImportStatus(item)} disabled={item.importDecision!=='Realiza importação'}>
                  <b>{item.importDecision==='Realiza importação'?item.importStatus:'Não se aplica'}</b>
                  {item.importDecision==='Realiza importação'&&<ChevronRight size={14}/>}
                </button>
                <small>{item.importDecision==='Realiza importação'?'Clique: não iniciada → em andamento → concluída':item.importDecision==='Não realiza importação'?'Não se aplica a esta frente':'Defina primeiro se haverá importação'}</small>
              </div>
            </article>)}
          </div>}
        </section>
      })}
    </div>
  </PageIntro>
}
function ReturnsPage({setPage}:{setPage:(p:Page)=>void}){
  type ReturnState={op:string;received:boolean;updated:string}
  const [states,setStates]=useState<ReturnState[]>(()=>{
    const saved=localStorage.getItem('rivora.returns')
    return saved?JSON.parse(saved):[
      {op:'Juatuba',received:false,updated:'Aguardando resposta'},
      {op:'Jundiaí',received:false,updated:'Aguardando resposta'},
    ]
  })
  const toggle=(op:string)=>{
    const next=states.map(item=>item.op===op?{...item,received:!item.received,updated:!item.received?'Marcado localmente como recebido':'Aguardando resposta'}:item)
    setStates(next)
    localStorage.setItem('rivora.returns',JSON.stringify(next))
  }
  return <PageIntro eyebrow="RETORNOS" title="Retornos e conversas" text="Acompanhe respostas, anexos corrigidos e liberações sem misturar o estado local com o e-mail real.">
    <div className="returns-status">
      <div><span>AGUARDANDO</span><b>{states.filter(s=>!s.received).length}</b></div>
      <div><span>RECEBIDOS LOCALMENTE</span><b>{states.filter(s=>s.received).length}</b></div>
      <small>Marcar aqui não altera Outlook, SharePoint ou Power Automate.</small>
    </div>
    <div className="return-grid">
      {states.map(item=><article className={item.received?'return-card received':'return-card'} key={item.op}>
        <div><Inbox size={19}/><Pill tone={item.received?'green':'amber'}>{item.received?'Recebido local':'Aguardando resposta'}</Pill></div>
        <h3>{item.op}</h3>
        <p>Mariana Tourino Ribeiro • Leonardo Luis Leite</p>
        <span className="return-updated">{item.updated}</span>
        <div className="return-actions">
          <button onClick={()=>toggle(item.op)}>{item.received?'Reabrir acompanhamento':'Marcar recebido local'}</button>
          <button onClick={()=>setPage('Relatórios')}>Abrir fechamento <ChevronRight size={14}/></button>
        </div>
      </article>)}
    </div>
  </PageIntro>
}
function AnalyticsPage(){return <PageIntro eyebrow="ANÁLISES" title="Análises operacionais" text="Área preparada para cruzamentos, CPH, divergências e indicadores."><div className="analysis-grid"><Analysis label="PROCESSOS" value="7" detail="em acompanhamento"/><Analysis label="AUTOMAÇÃO" value="67%" detail="dos fluxos planejados iniciados"/><Analysis label="PENDÊNCIAS" value="4" detail="dependências externas"/></div></PageIntro>}
function HistoryPage(){return <PageIntro eyebrow="HISTÓRICO" title="Registro operacional" text="Rastro das ações para saber o que aconteceu e quando."><div className="history-list"><HistoryRow icon={FileCheck2} title="Rascunho Juatuba validado" text="Resposta na mesma conversa, com anexo e assinatura."/><HistoryRow icon={Workflow} title="Monitor executado" text="Nenhum retorno corrigido identificado na última verificação."/><HistoryRow icon={CheckCircle2} title="Base do RIVORA criada" text="PWA responsivo preparado para publicação e integrações."/></div></PageIntro>}
function PageIntro({eyebrow,title,text,children}:{eyebrow:string;title:string;text:string;children:ReactNode}){return <><div className="intro"><span>{eyebrow}</span><h2>{title}</h2><p>{text}</p></div>{children}</>}
function TimelineItem({title,time}:{title:string;time:string}){return <div className="timeline-item"><i/><div><b>{title}</b><span>{time}</span></div></div>}
function Pill({children,tone='amber'}:{children:ReactNode;tone?:string}){return <span className={`pill ${tone}`}>{children}</span>}
function Analysis({label,value,detail}:{label:string;value:string;detail:string}){return <article className="analysis-card"><span>{label}</span><b>{value}</b><small>{detail}</small></article>}
function HistoryRow({icon:Icon,title,text}:{icon:typeof FileCheck2;title:string;text:string}){return <div className="history-row"><div><Icon size={17}/></div><section><b>{title}</b><span>{text}</span></section><small>02/10/2026</small></div>}
function Drawer({item,close}:{item:Closure;close:()=>void}){return <div className="backdrop" onClick={close}><aside className="drawer" onClick={e=>e.stopPropagation()}><button className="drawer-close" onClick={close}><XCircle size={20}/></button><span>FECHAMENTO</span><h3>{item.op}</h3><Pill>{item.status}</Pill><dl><div><dt>Período</dt><dd>{item.period}</dd></div><div><dt>Registros</dt><dd>{item.records}</dd></div><div><dt>Próxima ação</dt><dd>{item.next}</dd></div></dl><button className="primary">Abrir fluxo</button></aside></div>}
export default App
