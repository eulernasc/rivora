import { useMemo, useState, type ChangeEvent } from 'react'
import {
  AlertTriangle, CheckCircle2, Download, FileSearch, FileSpreadsheet,
  RotateCcw, Search, ShieldCheck, UploadCloud,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import './CphLightPage.css'

type RowRecord=Record<string,unknown>

type CphStatus=
  | 'Dentro do esperado'
  | 'X — Consultar'
  | 'Já existe no CPH'
  | 'Divergência no histórico'

type ReportRow={
  id:string
  key:string
  plate:string
  dateKey:string
  operation:string
  segment:string
  driver:string
  fuel:string
  model:string
  odometer:number|null
  liters:number|null
  kmIdeal:number|null
  kmReal:number|null
  averageIdeal:number|null
  averageReal:number|null
  efficiency:number
  variable:boolean
}

type HistoricalRow={
  key:string
  odometer:number|null
}

type ClassifiedRow=ReportRow&{
  status:CphStatus
  duplicate:boolean
  divergence:boolean
}

type Notice={tone:'ok'|'error';text:string}|null

const STATUS_OPTIONS:Array<'Todos'|CphStatus>=[
  'Todos',
  'Dentro do esperado',
  'X — Consultar',
  'Já existe no CPH',
  'Divergência no histórico',
]

function normalizeHeader(value:string){
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g,'')
}

function field(row:RowRecord,names:string[]){
  const wanted=new Set(names.map(normalizeHeader))
  for(const [key,value] of Object.entries(row)){
    if(wanted.has(normalizeHeader(key))) return value
  }
  return null
}

function toText(value:unknown){
  return value===null||value===undefined?'':String(value).trim()
}

function toNumber(value:unknown):number|null{
  if(typeof value==='number') return Number.isFinite(value)?value:null
  if(typeof value!=='string') return null
  const clean=value.trim()
  if(!clean) return null
  const normalized=clean.includes(',')
    ?clean.replace(/\./g,'').replace(',','.')
    :clean
  const result=Number(normalized)
  return Number.isFinite(result)?result:null
}

function pad(value:number){
  return String(value).padStart(2,'0')
}

function normalizeDateMinute(value:unknown){
  if(typeof value==='number'&&Number.isFinite(value)){
    const totalMinutes=Math.floor(value*1440+1e-7)
    const date=new Date(Date.UTC(1899,11,30)+totalMinutes*60000)
    return date.getUTCFullYear()+'-'+pad(date.getUTCMonth()+1)+'-'+pad(date.getUTCDate())+' '+pad(date.getUTCHours())+':'+pad(date.getUTCMinutes())
  }

  if(value instanceof Date&&!Number.isNaN(value.getTime())){
    return value.getFullYear()+'-'+pad(value.getMonth()+1)+'-'+pad(value.getDate())+' '+pad(value.getHours())+':'+pad(value.getMinutes())
  }

  const text=toText(value)
  let match=text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/)
  if(match){
    const [,day,month,year,hour='0',minute='0']=match
    return year+'-'+pad(Number(month))+'-'+pad(Number(day))+' '+pad(Number(hour))+':'+pad(Number(minute))
  }

  match=text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/)
  if(match){
    const [,year,month,day,hour='0',minute='0']=match
    return year+'-'+pad(Number(month))+'-'+pad(Number(day))+' '+pad(Number(hour))+':'+pad(Number(minute))
  }

  return ''
}

function displayDate(dateKey:string){
  const match=dateKey.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/)
  if(!match) return dateKey
  return match[3]+'/'+match[2]+'/'+match[1]+' '+match[4]+':'+match[5]
}

function buildReportRows(rows:RowRecord[]){
  const result:ReportRow[]=[]

  rows.forEach((row,index)=>{
    const plate=toText(field(row,['Placa','PLACA','PLACA/MAQ'])).toUpperCase()
    const dateKey=normalizeDateMinute(field(row,['Data','DATA DO ABASTECIMENTO']))
    if(!plate||!dateKey) return

    const averageIdeal=toNumber(field(row,['Média Ideal','Media Ideal','META DE CONSUMO']))
    const averageReal=toNumber(field(row,['Média Real','Media Real']))
    const kmIdeal=toNumber(field(row,['Km Ideal','KM IDEAL']))
    const kmReal=toNumber(field(row,['Km Real','KM REAL']))

    let efficiency=0
    if(averageIdeal!==null&&averageIdeal>0&&averageReal!==null){
      efficiency=averageReal/averageIdeal
    }else if(kmIdeal!==null&&kmIdeal>0&&kmReal!==null){
      efficiency=kmReal/kmIdeal
    }

    result.push({
      id:plate+'|'+dateKey+'|'+index,
      key:plate+'|'+dateKey,
      plate,
      dateKey,
      operation:toText(field(row,['Operação','Operacao','UNIDADE'])),
      segment:toText(field(row,['Segmento','SEGMENTO'])),
      driver:toText(field(row,['Motorista'])),
      fuel:toText(field(row,['Combustível','Combustivel'])),
      model:toText(field(row,['Modelo'])),
      odometer:toNumber(field(row,['Odometro','Odômetro','ODOMETRO','ODÔMETRO'])),
      liters:toNumber(field(row,['Litros Abast.','Litros Abast','LITROS ABASTECIDOS'])),
      kmIdeal,
      kmReal,
      averageIdeal,
      averageReal,
      efficiency,
      variable:efficiency<0.5||efficiency>1.5,
    })
  })

  return result
}

function buildHistory(rows:RowRecord[]){
  const result=new Map<string,HistoricalRow>()

  rows.forEach(row=>{
    const plate=toText(field(row,['PLACA/MAQ','PLACA','Placa'])).toUpperCase()
    const dateKey=normalizeDateMinute(field(row,['DATA DO ABASTECIMENTO','Data']))
    if(!plate||!dateKey) return

    const odometer=toNumber(field(row,[
      'ODÔMETRO',
      'ODOMETRO',
      'ODÔMETRO FINAL',
      'ODOMETRO FINAL',
      'HORÍMETRO FINAL',
      'HORIMETRO FINAL',
    ]))

    const key=plate+'|'+dateKey
    if(!result.has(key)) result.set(key,{key,odometer})
  })

  return result
}

async function readRows(file:File){
  const buffer=await file.arrayBuffer()
  const workbook=XLSX.read(buffer,{type:'array',cellDates:false})
  const firstSheet=workbook.SheetNames[0]
  if(!firstSheet) throw new Error('A planilha não possui abas legíveis.')
  const sheet=workbook.Sheets[firstSheet]
  return XLSX.utils.sheet_to_json<RowRecord>(sheet,{defval:null,raw:true})
}

function formatNumber(value:number|null,decimals=2){
  if(value===null) return '—'
  return value.toLocaleString('pt-BR',{minimumFractionDigits:decimals,maximumFractionDigits:decimals})
}

export default function CphLightPage(){
  const [reportRows,setReportRows]=useState<ReportRow[]>([])
  const [history,setHistory]=useState<Map<string,HistoricalRow>>(new Map())
  const [reportName,setReportName]=useState('')
  const [historyName,setHistoryName]=useState('')
  const [reviewed,setReviewed]=useState<Set<string>>(new Set())
  const [notice,setNotice]=useState<Notice>(null)
  const [loading,setLoading]=useState<'report'|'history'|null>(null)

  const [plateQuery,setPlateQuery]=useState('')
  const [operationFilter,setOperationFilter]=useState('Todas')
  const [statusFilter,setStatusFilter]=useState<'Todos'|CphStatus>('Todos')
  const [startDate,setStartDate]=useState('')
  const [endDate,setEndDate]=useState('')

  const classified=useMemo<ClassifiedRow[]>(()=>reportRows.map(row=>{
    const historical=history.get(row.key)
    if(!historical){
      return {
        ...row,
        duplicate:false,
        divergence:false,
        status:row.variable?'X — Consultar':'Dentro do esperado',
      }
    }

    const divergence=
      historical.odometer!==null&&
      row.odometer!==null&&
      Math.round(historical.odometer)!==Math.round(row.odometer)

    return {
      ...row,
      duplicate:true,
      divergence,
      status:divergence?'Divergência no histórico':'Já existe no CPH',
    }
  }),[reportRows,history])

  const operations=useMemo(
    ()=>Array.from(new Set(reportRows.map(row=>row.operation).filter(Boolean))).sort((a,b)=>a.localeCompare(b,'pt-BR')),
    [reportRows],
  )

  const filtered=useMemo(()=>classified.filter(row=>{
    if(plateQuery.trim()&&!row.plate.includes(plateQuery.trim().toUpperCase())) return false
    if(operationFilter!=='Todas'&&row.operation!==operationFilter) return false
    if(statusFilter!=='Todos'&&row.status!==statusFilter) return false
    const day=row.dateKey.slice(0,10)
    if(startDate&&day<startDate) return false
    if(endDate&&day>endDate) return false
    return true
  }).sort((a,b)=>b.dateKey.localeCompare(a.dateKey)),[
    classified,plateQuery,operationFilter,statusFilter,startDate,endDate,
  ])

  const total=classified.length
  const existing=classified.filter(row=>row.status==='Já existe no CPH').length
  const divergences=classified.filter(row=>row.status==='Divergência no histórico').length
  const variableRows=classified.filter(row=>!row.duplicate&&row.variable)
  const reviewedVariables=variableRows.filter(row=>reviewed.has(row.id)).length
  const ready=history.size?classified.filter(row=>!row.duplicate&&(!row.variable||reviewed.has(row.id))).length:0
  const filteredReady=history.size?filtered.filter(row=>!row.duplicate&&(!row.variable||reviewed.has(row.id))):[]

  const loadReport=async(event:ChangeEvent<HTMLInputElement>)=>{
    const file=event.target.files?.[0]
    event.target.value=''
    if(!file) return
    setLoading('report')
    setNotice(null)
    try{
      const rows=buildReportRows(await readRows(file))
      if(!rows.length) throw new Error('Não encontrei registros com Placa e Data no relatório.')
      setReportRows(rows)
      setReportName(file.name)
      setReviewed(new Set())
      setNotice({tone:'ok',text:rows.length+' registros do relatório foram carregados. A eficiência já foi recalculada pela regra do CPH.'})
    }catch(error){
      setNotice({tone:'error',text:error instanceof Error?error.message:'Não foi possível ler o relatório.'})
    }finally{
      setLoading(null)
    }
  }

  const loadHistory=async(event:ChangeEvent<HTMLInputElement>)=>{
    const file=event.target.files?.[0]
    event.target.value=''
    if(!file) return
    setLoading('history')
    setNotice(null)
    try{
      const historyMap=buildHistory(await readRows(file))
      if(!historyMap.size) throw new Error('Não encontrei PLACA/MAQ e DATA DO ABASTECIMENTO no CPH.')
      setHistory(historyMap)
      setHistoryName(file.name)
      setNotice({tone:'ok',text:historyMap.size.toLocaleString('pt-BR')+' chaves do CPH foram carregadas para impedir reenvios.'})
    }catch(error){
      setNotice({tone:'error',text:error instanceof Error?error.message:'Não foi possível ler o CPH.'})
    }finally{
      setLoading(null)
    }
  }

  const toggleReviewed=(id:string)=>{
    setReviewed(current=>{
      const next=new Set(current)
      if(next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const clearAll=()=>{
    setReportRows([])
    setHistory(new Map())
    setReportName('')
    setHistoryName('')
    setReviewed(new Set())
    setNotice(null)
    setPlateQuery('')
    setOperationFilter('Todas')
    setStatusFilter('Todos')
    setStartDate('')
    setEndDate('')
  }

  const exportRows=()=>{
    if(!history.size){
      setNotice({tone:'error',text:'Importe o CPH atualizado antes de exportar. Assim o RIVORA consegue bloquear o que já foi enviado.'})
      return
    }
    if(!filteredReady.length){
      setNotice({tone:'error',text:'Não há registros novos liberados nos filtros atuais.'})
      return
    }

    const cphData=filteredReady.map(row=>({
      'SEGMENTO':row.segment,
      'UNIDADE':row.operation,
      'DATA DO ABASTECIMENTO':displayDate(row.dateKey),
      'PLACA':row.plate,
      'ODÔMETRO':row.odometer??'',
      'KM IDEAL':row.kmIdeal??'',
      'KM REAL':row.kmReal??'',
      'LITROS ABASTECIDOS':row.liters??'',
      'META DE CONSUMO':row.averageIdeal??'',
      'MÉDIA REAL':row.averageReal??'',
      'EFICIÊNCIA (%)':row.efficiency,
      'VARIÁVEL':row.variable?'X':'',
    }))

    const auditData=filtered.map(row=>({
      'SITUAÇÃO':row.status,
      'REVISADO':row.variable&&!row.duplicate?(reviewed.has(row.id)?'Sim':'Não'):'',
      'DATA':displayDate(row.dateKey),
      'PLACA':row.plate,
      'UNIDADE':row.operation,
      'SEGMENTO':row.segment,
      'MOTORISTA':row.driver,
      'COMBUSTÍVEL':row.fuel,
      'MODELO':row.model,
      'ODÔMETRO':row.odometer??'',
      'LITROS':row.liters??'',
      'KM IDEAL':row.kmIdeal??'',
      'KM REAL':row.kmReal??'',
      'MÉDIA IDEAL':row.averageIdeal??'',
      'MÉDIA REAL':row.averageReal??'',
      'EFICIÊNCIA (%)':row.efficiency,
      'VARIÁVEL':row.variable?'X':'',
    }))

    const workbook=XLSX.utils.book_new()
    const cphSheet=XLSX.utils.json_to_sheet(cphData)
    const auditSheet=XLSX.utils.json_to_sheet(auditData)

    cphSheet['!cols']=[
      {wch:18},{wch:28},{wch:22},{wch:12},{wch:14},{wch:12},
      {wch:12},{wch:18},{wch:18},{wch:14},{wch:16},{wch:10},
    ]
    auditSheet['!cols']=[
      {wch:24},{wch:10},{wch:22},{wch:12},{wch:28},{wch:20},{wch:32},
      {wch:16},{wch:24},{wch:14},{wch:12},{wch:12},{wch:12},{wch:14},{wch:14},{wch:16},{wch:10},
    ]

    XLSX.utils.book_append_sheet(workbook,cphSheet,'CPH Frota Leve')
    XLSX.utils.book_append_sheet(workbook,auditSheet,'Auditoria RIVORA')

    const now=new Date()
    const stamp=now.getFullYear()+pad(now.getMonth()+1)+pad(now.getDate())+'_'+pad(now.getHours())+pad(now.getMinutes())
    XLSX.writeFile(workbook,'CPH_Frota_Leve_'+stamp+'.xlsx')
    setNotice({tone:'ok',text:filteredReady.length+' registros novos liberados foram exportados. Duplicados e X não revisados ficaram de fora.'})
  }

  return <>
    <div className="intro">
      <span>CPH • FROTA LEVE</span>
      <h2>CPH Frota Leve</h2>
      <p>Compare o relatório de abastecimentos com o CPH já enviado, valide a eficiência e leve adiante somente o que realmente é novo.</p>
    </div>

    <div className="cphl-shell">
      <section className="cphl-import-grid">
        <article className="cphl-upload-card">
          <div className="cphl-upload-copy">
            <span className="cphl-upload-icon"><FileSpreadsheet size={19}/></span>
            <div><span>ENTRADA</span><b>Relatório da Frota Leve</b><small>Modelo Gestão de Abastecimentos. O RIVORA usa Média Real ÷ Média Ideal para calcular a eficiência.</small></div>
          </div>
          <div className="cphl-upload-actions">
            <label className="cphl-file-button"><UploadCloud size={14}/>{loading==='report'?'Lendo...':'Importar relatório'}<input type="file" accept=".xlsx,.xls,.xlsm" onChange={loadReport} disabled={loading!==null}/></label>
            <span className="cphl-file-name" title={reportName}>{reportName||'Nenhum relatório carregado'}</span>
          </div>
        </article>

        <article className="cphl-upload-card history">
          <div className="cphl-upload-copy">
            <span className="cphl-upload-icon"><ShieldCheck size={19}/></span>
            <div><span>COMPARATIVO</span><b>CPH já enviado</b><small>Importe a cópia atual do SharePoint. A trava segue a macro: Placa + Data/Hora, comparadas no minuto.</small></div>
          </div>
          <div className="cphl-upload-actions">
            <label className="cphl-file-button"><FileSearch size={14}/>{loading==='history'?'Lendo...':'Importar CPH atual'}<input type="file" accept=".xlsx,.xls,.xlsm" onChange={loadHistory} disabled={loading!==null}/></label>
            <span className="cphl-file-name" title={historyName}>{historyName||'Nenhum CPH carregado'}</span>
          </div>
        </article>
      </section>

      <section className="cphl-kpis">
        <article className="cphl-kpi"><span>REGISTROS DO RELATÓRIO</span><b>{total.toLocaleString('pt-BR')}</b><small>linhas válidas carregadas</small></article>
        <article className="cphl-kpi ok"><span>NOVOS LIBERADOS</span><b>{ready.toLocaleString('pt-BR')}</b><small>prontos para exportação</small></article>
        <article className="cphl-kpi muted"><span>JÁ EXISTEM NO CPH</span><b>{existing.toLocaleString('pt-BR')}</b><small>bloqueados para não repetir</small></article>
        <article className="cphl-kpi warn"><span>X • CONSULTAR</span><b>{variableRows.length.toLocaleString('pt-BR')}</b><small>{reviewedVariables} revisados/liberados</small></article>
        <article className="cphl-kpi danger"><span>DIVERGÊNCIAS</span><b>{divergences.toLocaleString('pt-BR')}</b><small>mesma chave com odômetro diferente</small></article>
      </section>

      <div className="cphl-rule-note">
        <AlertTriangle size={15}/>
        <span><b>Regra da macro:</b> eficiência abaixo de 50% ou acima de 150% recebe X. Entre 50% e 150%, inclusive, fica dentro do esperado. O relatório é comparado com o CPH usando placa + data/hora no minuto, porque a macro original descarta os segundos.</span>
      </div>

      {notice&&<div className={notice.tone==='error'?'cphl-alert error':'cphl-alert'}><span>{notice.text}</span><button onClick={()=>setNotice(null)}>Fechar</button></div>}

      <section className="cphl-toolbar">
        <label className="cphl-field"><span>PLACA</span><div style={{position:'relative'}}><Search size={13} style={{position:'absolute',left:10,top:11,color:'#6f8ba1'}}/><input style={{paddingLeft:30}} value={plateQuery} onChange={event=>setPlateQuery(event.target.value)} placeholder="Buscar placa"/></div></label>
        <label className="cphl-field"><span>OPERAÇÃO</span><select value={operationFilter} onChange={event=>setOperationFilter(event.target.value)}><option>Todas</option>{operations.map(operation=><option key={operation}>{operation}</option>)}</select></label>
        <label className="cphl-field"><span>SITUAÇÃO</span><select value={statusFilter} onChange={event=>setStatusFilter(event.target.value as 'Todos'|CphStatus)}>{STATUS_OPTIONS.map(status=><option key={status}>{status}</option>)}</select></label>
        <label className="cphl-field"><span>DE</span><input type="date" value={startDate} onChange={event=>setStartDate(event.target.value)}/></label>
        <label className="cphl-field"><span>ATÉ</span><input type="date" value={endDate} onChange={event=>setEndDate(event.target.value)}/></label>
        <button className="cphl-action secondary" onClick={clearAll}><RotateCcw size={13}/>Limpar</button>
        <button className="cphl-action" onClick={exportRows} disabled={!history.size||!filteredReady.length}><Download size={13}/>Exportar {filteredReady.length}</button>
      </section>

      <section className="cphl-table-panel">
        <div className="cphl-table-top">
          <div><b>Resultado do comparativo</b><small>{filtered.length.toLocaleString('pt-BR')} registros nos filtros • exportação respeita os filtros atuais</small></div>
          <span className="cphl-file-name">{history.size?'CPH protegido por '+history.size.toLocaleString('pt-BR')+' chaves':'Importe o CPH atual antes de exportar'}</span>
        </div>

        <div className="cphl-table-scroll">
          <table className="cphl-table">
            <thead><tr>
              <th>Situação</th><th>Data</th><th>Placa</th><th>Operação</th><th>Odômetro</th>
              <th>Litros</th><th>Km Real</th><th>Média Ideal</th><th>Média Real</th><th>Eficiência</th><th>Variável</th><th>Revisão</th>
            </tr></thead>
            <tbody>
              {filtered.map(row=><tr key={row.id}>
                <td><span className={'cphl-status '+(row.status==='X — Consultar'?'variable':row.status==='Já existe no CPH'?'exists':row.status==='Divergência no histórico'?'divergence':'')}>{row.status}</span></td>
                <td>{displayDate(row.dateKey)}</td>
                <td className="cphl-plate">{row.plate}</td>
                <td>{row.operation||'—'}</td>
                <td className="cphl-num">{formatNumber(row.odometer,0)}</td>
                <td className="cphl-num">{formatNumber(row.liters)}</td>
                <td className="cphl-num">{formatNumber(row.kmReal,0)}</td>
                <td className="cphl-num">{formatNumber(row.averageIdeal,2)}</td>
                <td className="cphl-num">{formatNumber(row.averageReal,2)}</td>
                <td className="cphl-num">{(row.efficiency*100).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})}%</td>
                <td className="cphl-variable">{row.variable?'X':''}</td>
                <td>
                  {!row.duplicate&&row.variable
                    ?<button className={reviewed.has(row.id)?'cphl-review-button done':'cphl-review-button'} onClick={()=>toggleReviewed(row.id)}>{reviewed.has(row.id)?'Revisado ✓':'Marcar revisado'}</button>
                    :row.duplicate?'Bloqueado':'—'}
                </td>
              </tr>)}
            </tbody>
          </table>
          {!filtered.length&&<div className="cphl-empty">{reportRows.length?'Nenhum registro encontrado nos filtros atuais.':'Importe o relatório da Frota Leve para iniciar.'}</div>}
        </div>

        <div className="cphl-legend">
          <span><i/>Dentro do esperado</span>
          <span><i className="amber"/>X — consultar</span>
          <span><i className="gray"/>Já existe no CPH</span>
          <span><i className="red"/>Divergência no histórico</span>
          <span><CheckCircle2 size={12}/>Os arquivos são processados somente nesta sessão do navegador; nenhum abastecimento é salvo no Firestore.</span>
        </div>
      </section>
    </div>
  </>
}
