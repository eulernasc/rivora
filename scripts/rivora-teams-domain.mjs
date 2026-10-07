export const OPERATIONS = {
  OP01: { name: 'Aracruz', fronts: ['F01', 'F02'] },
  OP02: { name: 'Cenibra', fronts: ['F03', 'F04'] },
  OP03: { name: 'Costa Rica', fronts: ['F05', 'F06'] },
  OP04: { name: 'Alto Taquari', fronts: ['F07', 'F08'] },
  OP05: { name: 'Ribas', fronts: ['F09', 'F10'] },
  OP06: { name: 'Bracell', fronts: ['F11'] },
  OP07: { name: 'Jundiaí', fronts: ['F12'] },
  OP08: { name: 'Juatuba', fronts: ['F13'] },
}

export function validateScope(operationId, cycle, config) {
  if (!Object.hasOwn(OPERATIONS, operationId) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(cycle)) throw new Error('Invalid operation or cycle.')
  if (!config.targets.some(target => target.operationId === operationId && target.cycle === cycle)) throw new Error('Target not enabled for Teams.')
}

export function validateResponsible(assignment, responsible) {
  const id = assignment?.responsibleId
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) throw new Error('Operation has no valid responsible.')
  if (responsible?.active !== true || typeof responsible.email !== 'string' || responsible.email.length > 254 || !/^[^\s@;]+@[^\s@;]+\.[^\s@;]+$/.test(responsible.email)) throw new Error('Responsible is inactive or has no valid email.')
  return { responsibleId: id, email: responsible.email.trim().toLowerCase() }
}

export function shouldAsk(operation, notification, now, manual = false) {
  if (operation?.status === 'confirmed') return false
  // An uncertain delivery is not retried automatically: it could duplicate a card.
  if (notification && notification.status !== 'answered') return false
  if (manual) return true
  return notification?.status === 'answered' && operation?.status === 'pending' &&
    typeof operation.expectedAt === 'string' && Date.parse(operation.expectedAt) <= now.getTime()
}

export function validateResponse(payload, notification, recipient, now) {
  if (!notification || !['waiting', 'sending'].includes(notification.status) || payload.requestId !== notification.requestId) throw new Error('Stale or duplicate card response.')
  if (recipient.responsibleId !== notification.responsibleId || typeof payload.responderEmail !== 'string' || payload.responderEmail.trim().toLowerCase() !== recipient.email) throw new Error('Response does not belong to the current responsible.')
  if (payload.status === 'confirmed') return { status: 'confirmed', expectedAt: null }
  if (payload.status !== 'pending') throw new Error('Invalid response status.')
  const value = payload.expectedAt
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00-03:00$/.test(value)) throw new Error('Invalid deadline format.')
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime()) || parsed.getTime() <= now.getTime()) throw new Error('Deadline must be in the future.')
  // Date parsing normalizes impossible dates; round-trip the supplied local fields.
  const local = new Date(parsed.getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0,19)
  if (local !== value.slice(0,19)) throw new Error('Invalid calendar deadline.')
  return { status: 'pending', expectedAt: parsed.toISOString() }
}

export function makeCard(operationId, cycle, now) {
  const today = new Intl.DateTimeFormat('en-CA', {timeZone:'America/Sao_Paulo', year:'numeric', month:'2-digit',day:'2-digit'}).format(now)
  return {
    type:'AdaptiveCard', version:'1.4', '$schema':'http://adaptivecards.io/schemas/adaptive-card.json',
    body:[
      {type:'TextBlock', text:'RIVORA • Confirmação de importações', weight:'Bolder',size:'Medium',wrap:true},
      {type:'FactSet',facts:[{title:'Operação',value:`${OPERATIONS[operationId].name} (${operationId})`},{title:'Ciclo',value:cycle}]},
      {type:'TextBlock',text:cycle === '2099-12' ? 'TESTE — ciclo fictício. Não altera o fechamento do mês atual.' : 'Confirmação única para as importações aplicáveis desta operação.',wrap:true},
      {type:'TextBlock',text:'Todas as importações da operação foram concluídas?',wrap:true},
    ],
    actions:[
      {type:'Action.Submit',title:'Sim, concluídas',associatedInputs:'none',data:{status:'confirmed'}},
      {type:'Action.ShowCard',title:'Não, informar prazo',card:{type:'AdaptiveCard',body:[
        {type:'TextBlock',text:'Informe a nova previsão, no horário de Brasília. O RIVORA perguntará novamente após esse prazo.',wrap:true},
        {type:'Input.Date',id:'expectedDate',label:'Nova data',min:today,isRequired:true,errorMessage:'Informe uma data futura.'},
        {type:'Input.Time',id:'expectedTime',label:'Horário de Brasília',isRequired:true,errorMessage:'Informe o horário.'},
      ],actions:[{type:'Action.Submit',title:'Enviar nova previsão',data:{status:'pending'}}]}},
    ],
  }
}
