import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { OPERATIONS, validateScope, validateResponsible, shouldAsk, validateResponse, makeCard } from './rivora-teams-domain.mjs'

const ROOT = 'projects/rivora-8643e/databases/(default)/documents'
const API = `https://firestore.googleapis.com/v1/${ROOT}`
const config = JSON.parse(await readFile(new URL('./rivora-teams-config.json', import.meta.url),'utf8'))
const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH,'utf8'))
const mode = process.argv[2]
const email = process.env.RIVORA_BRIDGE_EMAIL
const password = process.env.RIVORA_BRIDGE_PASSWORD
if (!email || !password) throw new Error('Bridge credentials missing.')
const login = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=AIzaSyBddExv3Wzmg4Cr0WPUIQ6pbpKHYLBTJR4', {
  method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true}),signal:AbortSignal.timeout(30000),
})
if (!login.ok) throw new Error(`Bridge authentication failed (${login.status}).`)
const {idToken} = await login.json()
if (!idToken) throw new Error('Missing bridge token.')
const headers = {'Content-Type':'application/json',Authorization:`Bearer ${idToken}`}
const now = new Date()
const str = value => ({stringValue:value})
const time = value => value ? ({timestampValue:value}) : ({nullValue:null})
const decode = fields => Object.fromEntries(Object.entries(fields ?? {}).map(([key,value]) => [key,Object.values(value)[0]]))

async function get(path) {
  const response = await fetch(`${API}/${path}`,{headers,signal:AbortSignal.timeout(30000)})
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`Firestore read failed (${response.status}).`)
  const doc = await response.json()
  return {data:decode(doc.fields),updateTime:doc.updateTime}
}
function write(path, fields, previous, merge = false) {
  return {
    update:{name:`${ROOT}/${path}`,fields},
    ...(merge ? {updateMask:{fieldPaths:Object.keys(fields)}} : {}),
    currentDocument: previous ? {updateTime:previous.updateTime} : {exists:false},
  }
}
async function commit(writes) {
  const response = await fetch(`${API}:commit`,{method:'POST',headers,body:JSON.stringify({writes}),signal:AbortSignal.timeout(30000)})
  if (!response.ok) throw new Error(`Firestore commit failed (${response.status}).`)
}
async function responsible(operationId) {
  const assignment = await get(`operationAssignments/${operationId}`)
  const id = assignment?.data?.responsibleId
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) throw new Error('Missing operation assignment.')
  const person = await get(`responsibles/${id}`)
  return validateResponsible(assignment.data,person?.data)
}
function notificationFields(data) {
  return {requestId:str(data.requestId),responsibleId:str(data.responsibleId),status:str(data.status),askedAt:time(data.askedAt),updatedAt:time(now.toISOString())}
}

async function request(operationId, cycle, manual) {
  validateScope(operationId,cycle,config)
  const base = `closingCycles/${cycle}`
  const [operation,notification] = await Promise.all([get(`${base}/operations/${operationId}`),get(`${base}/notifications/${operationId}`)])
  if (!shouldAsk(operation?.data,notification?.data,now,manual)) {
    console.log(`${operationId}/${cycle}: no new card required.`)
    return
  }
  const recipient = await responsible(operationId)
  if (!recipient.email.endsWith('@expressonepomuceno.com.br')) throw new Error('Responsible is outside the enabled Teams domain.')
  const webhook = process.env.RIVORA_TEAMS_WEBHOOK_URL
  if (!webhook) throw new Error('Teams webhook secret is not configured.')
  const url = new URL(webhook)
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.environment.api.powerplatform.com')) throw new Error('Unexpected Teams webhook host.')
  const data = {requestId:randomUUID(),responsibleId:recipient.responsibleId,status:'sending',askedAt:now.toISOString()}
  const path = `${base}/notifications/${operationId}`
  // Claim before sending. A crash or ambiguous response remains blocked for review, avoiding duplicates.
  await commit([write(path,notificationFields(data),notification)])
  const claimed = await get(path)
  let sent = false
  try {
    const response = await fetch(webhook,{
      method:'POST',headers:{'Content-Type':'application/json'},redirect:'error',signal:AbortSignal.timeout(30000),
      body:JSON.stringify({type:'message',recipient:recipient.email,operationId,cycle,requestId:data.requestId,
        attachments:[{contentType:'application/vnd.microsoft.card.adaptive',contentUrl:null,content:makeCard(operationId,cycle,now)}]}),
    })
    sent = response.ok
    if (!sent) throw new Error(`Teams request failed (${response.status}).`)
  } finally {
    await commit([write(path,notificationFields({...data,status:sent ? 'waiting' : 'failed'}),claimed)])
  }
  console.log(`${operationId}/${cycle}: card submitted to Power Automate.`)
}

async function respond(payload) {
  const {operationId,cycle} = payload
  validateScope(operationId,cycle,config)
  const base = `closingCycles/${cycle}`
  const notificationPath = `${base}/notifications/${operationId}`
  const [notification,operation,recipient] = await Promise.all([get(notificationPath),get(`${base}/operations/${operationId}`),responsible(operationId)])
  const result = validateResponse(payload,notification?.data,recipient,now)
  const writes = []
  if (result.status === 'confirmed') {
    for (const frontId of OPERATIONS[operationId].fronts) {
      const path = `${base}/fronts/${frontId}`
      const front = await get(path)
      // A configured non-importing front must not be marked as imported.
      if (front && front.data.importDecision !== 'Realiza importação') continue
      writes.push(write(path,{importStatus:str('Concluída'),source:str('power_automate'),updatedAt:time(now.toISOString())},front,true))
    }
  }
  writes.push(write(`${base}/operations/${operationId}`,{
    status:str(result.status),expectedAt:time(result.expectedAt),confirmedAt:time(result.status === 'confirmed' ? now.toISOString() : null),
    lastAskedAt:time(notification.data.askedAt),source:str('power_automate'),updatedAt:time(now.toISOString()),
  },operation))
  writes.push(write(notificationPath,notificationFields({...notification.data,status:'answered'}),notification))
  // Atomic commit: no partial operation/front updates and no replay of this request.
  await commit(writes)
  console.log(`${operationId}/${cycle}: Teams response applied successfully.`)
}

if (mode === 'respond') await respond(event.client_payload ?? {})
else if (mode === 'request') await request(event.inputs?.operationId,event.inputs?.cycle,true)
else if (mode === 'remind') {
  for (const target of config.targets) await request(target.operationId,target.cycle,false)
} else throw new Error('Invalid Teams bridge mode.')
