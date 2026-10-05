import { PublicClientApplication, InteractionRequiredAuthError, type AccountInfo } from '@azure/msal-browser'

export type M365RuntimeConfig = {
  tenantId:string
  clientId:string
  driveId:string
  itemId:string
  scopes:string[]
}

let runtimeConfig:M365RuntimeConfig|null=null
let client:PublicClientApplication|null=null

export async function getM365Config(){
  if(runtimeConfig) return runtimeConfig
  const response=await fetch(`${import.meta.env.BASE_URL}rivora-m365.json`,{cache:'no-store'})
  if(!response.ok) throw new Error('Não foi possível carregar a configuração do Microsoft 365.')
  runtimeConfig=await response.json() as M365RuntimeConfig
  return runtimeConfig
}

export async function isM365Configured(){
  const config=await getM365Config()
  return Boolean(config.clientId&&config.tenantId&&config.driveId&&config.itemId)
}

async function getClient(){
  if(client) return client
  const config=await getM365Config()
  if(!config.clientId) throw new Error('M365_NOT_CONFIGURED')
  client=new PublicClientApplication({
    auth:{
      clientId:config.clientId,
      authority:`https://login.microsoftonline.com/${config.tenantId}`,
      redirectUri:`${window.location.origin}${import.meta.env.BASE_URL}`,
    },
    cache:{cacheLocation:'localStorage'},
  })
  await client.initialize()
  const redirect=await client.handleRedirectPromise()
  if(redirect?.account) client.setActiveAccount(redirect.account)
  const existing=client.getActiveAccount()??client.getAllAccounts()[0]
  if(existing) client.setActiveAccount(existing)
  return client
}

export async function connectM365():Promise<AccountInfo>{
  const config=await getM365Config()
  const app=await getClient()
  const result=await app.loginPopup({scopes:config.scopes,prompt:'select_account'})
  if(!result.account) throw new Error('Não foi possível identificar a conta Microsoft conectada.')
  app.setActiveAccount(result.account)
  return result.account
}

export async function disconnectM365(){
  const app=await getClient()
  const account=app.getActiveAccount()??app.getAllAccounts()[0]
  if(account) await app.logoutPopup({account,postLogoutRedirectUri:`${window.location.origin}${import.meta.env.BASE_URL}`})
}

async function acquireToken(){
  const config=await getM365Config()
  const app=await getClient()
  let account=app.getActiveAccount()??app.getAllAccounts()[0]
  if(!account){
    const login=await app.loginPopup({scopes:config.scopes})
    account=login.account
    if(account) app.setActiveAccount(account)
  }
  if(!account) throw new Error('Conta Microsoft não conectada.')
  try{
    const token=await app.acquireTokenSilent({account,scopes:config.scopes})
    return token.accessToken
  }catch(error){
    if(error instanceof InteractionRequiredAuthError){
      const token=await app.acquireTokenPopup({account,scopes:config.scopes})
      return token.accessToken
    }
    throw error
  }
}

function graphContentUrl(config:M365RuntimeConfig){
  return `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(config.driveId)}/items/${encodeURIComponent(config.itemId)}/content`
}

export async function readOperationControlCloud(){
  const config=await getM365Config()
  const token=await acquireToken()
  const response=await fetch(graphContentUrl(config),{
    headers:{Authorization:`Bearer ${token}`},
    cache:'no-store',
  })
  if(!response.ok) throw new Error(`Falha ao ler SharePoint (HTTP ${response.status}).`)
  return await response.json() as {version?:number;updatedAt?:string;deadlinePolicy?:unknown;operations?:unknown[]}
}

export async function writeOperationControlCloud(document:unknown){
  const config=await getM365Config()
  const token=await acquireToken()
  const response=await fetch(graphContentUrl(config),{
    method:'PUT',
    headers:{
      Authorization:`Bearer ${token}`,
      'Content-Type':'application/json; charset=utf-8',
    },
    body:JSON.stringify(document,null,2),
  })
  if(!response.ok) throw new Error(`Falha ao gravar SharePoint (HTTP ${response.status}).`)
  return await response.json() as {id?:string;lastModifiedDateTime?:string}
}
