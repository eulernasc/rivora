import { readFile } from 'node:fs/promises'

const PROJECT_ID='rivora-8643e'
const API_KEY='AIzaSyBddExv3Wzmg4Cr0WPUIQ6pbpKHYLBTJR4'

function fail(message){
  throw new Error(message)
}

const eventPath=process.env.GITHUB_EVENT_PATH
const email=process.env.RIVORA_BRIDGE_EMAIL
const password=process.env.RIVORA_BRIDGE_PASSWORD

if(!eventPath) fail('GitHub event file is unavailable.')
if(!email||!password) fail('RIVORA bridge credentials are not configured.')

const event=JSON.parse(await readFile(eventPath,'utf8'))
const payload=event?.client_payload??{}

const frontId=String(payload.frontId??'')
const cycle=String(payload.cycle??'')
const status=String(payload.status??'')

if(!/^F(0[1-9]|1[0-3])$/.test(frontId)) fail('Invalid frontId.')
if(!/^[0-9]{4}-(0[1-9]|1[0-2])$/.test(cycle)) fail('Invalid cycle.')
if(status!=='confirmed') fail('Invalid status.')

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
const documentUrl=new URL(
  `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/closingCycles/${encodeURIComponent(cycle)}/fronts/${encodeURIComponent(frontId)}`,
)
for(const field of ['closureStatus','confirmedAt','source','updatedAt']){
  documentUrl.searchParams.append('updateMask.fieldPaths',field)
}

const updateResponse=await fetch(documentUrl,{
  method:'PATCH',
  headers:{
    Authorization:`Bearer ${signIn.idToken}`,
    'Content-Type':'application/json',
  },
  body:JSON.stringify({
    fields:{
      closureStatus:{stringValue:'Confirmado'},
      confirmedAt:{timestampValue:now},
      source:{stringValue:'power_automate'},
      updatedAt:{timestampValue:now},
    },
  }),
})

if(!updateResponse.ok) fail(`Firestore update failed (HTTP ${updateResponse.status}).`)

console.log('RIVORA confirmation applied successfully.')
