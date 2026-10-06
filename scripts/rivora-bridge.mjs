import { readFile } from 'node:fs/promises'

const PROJECT_ID='rivora-8643e'
const API_KEY='AIzaSyBddExv3Wzmg4Cr0WPUIQ6pbpKHYLBTJR4'

const OPERATION_FRONTS={
  OP01:['F01','F02'],
  OP02:['F03','F04'],
  OP03:['F05','F06'],
  OP04:['F07','F08'],
  OP05:['F09','F10'],
  OP06:['F11'],
  OP07:['F12'],
  OP08:['F13'],
}

function fail(message){
  throw new Error(message)
}

function parseExpectedAt(value){
  const parsed=new Date(String(value??''))
  if(Number.isNaN(parsed.getTime())) fail('Invalid expectedAt.')
  return parsed.toISOString()
}

const eventPath=process.env.GITHUB_EVENT_PATH
const email=process.env.RIVORA_BRIDGE_EMAIL
const password=process.env.RIVORA_BRIDGE_PASSWORD

if(!eventPath) fail('GitHub event file is unavailable.')
if(!email||!password) fail('RIVORA bridge credentials are not configured.')

const event=JSON.parse(await readFile(eventPath,'utf8'))
const payload=event?.client_payload??{}

const operationId=String(payload.operationId??'')
const cycle=String(payload.cycle??'')
const status=String(payload.status??'')

if(!Object.hasOwn(OPERATION_FRONTS,operationId)) fail('Invalid operationId.')
if(!/^[0-9]{4}-(0[1-9]|1[0-2])$/.test(cycle)) fail('Invalid cycle.')
if(!['pending','confirmed'].includes(status)) fail('Invalid status.')

const expectedAt=status==='pending'?parseExpectedAt(payload.expectedAt):null

const signInResponse=await fetch(
  `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
  {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({email,password,returnSecureToken:true}),
  },
)

if(!signInResponse.ok) fail(`Bridge authentication failed (HTTP ${signInResponse.status}).`)
const signIn=await signInResponse.json()
if(!signIn.idToken) fail('Bridge authentication did not return a token.')

const now=new Date().toISOString()
const authHeaders={
  Authorization:`Bearer ${signIn.idToken}`,
  'Content-Type':'application/json',
}

async function patchDocument(path,fields,fieldNames){
  const documentUrl=new URL(
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}`,
  )
  for(const field of fieldNames) documentUrl.searchParams.append('updateMask.fieldPaths',field)

  const response=await fetch(documentUrl,{
    method:'PATCH',
    headers:authHeaders,
    body:JSON.stringify({fields}),
  })

  if(!response.ok) fail(`Firestore update failed (HTTP ${response.status}).`)
}

async function concludeFront(frontId){
  await patchDocument(
    `closingCycles/${encodeURIComponent(cycle)}/fronts/${encodeURIComponent(frontId)}`,
    {
      importStatus:{stringValue:'Concluída'},
      source:{stringValue:'power_automate'},
      updatedAt:{timestampValue:now},
    },
    ['importStatus','source','updatedAt'],
  )
}

async function saveOperationState(){
  await patchDocument(
    `closingCycles/${encodeURIComponent(cycle)}/operations/${encodeURIComponent(operationId)}`,
    {
      status:{stringValue:status},
      expectedAt:expectedAt?{timestampValue:expectedAt}:{nullValue:null},
      confirmedAt:status==='confirmed'?{timestampValue:now}:{nullValue:null},
      lastAskedAt:{timestampValue:now},
      source:{stringValue:'power_automate'},
      updatedAt:{timestampValue:now},
    },
    ['status','expectedAt','confirmedAt','lastAskedAt','source','updatedAt'],
  )
}

if(status==='confirmed'){
  for(const frontId of OPERATION_FRONTS[operationId]) await concludeFront(frontId)
  await saveOperationState()
}else{
  await saveOperationState()
}

console.log('RIVORA operation response applied successfully.')
