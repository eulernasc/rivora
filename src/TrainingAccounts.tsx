import {useEffect,useMemo,useState,type FormEvent} from 'react'
import {initializeApp,deleteApp} from 'firebase/app'
import {createUserWithEmailAndPassword,deleteUser,getAuth,signOut} from 'firebase/auth'
import {collection,doc,onSnapshot,serverTimestamp,setDoc,updateDoc} from 'firebase/firestore'
import {CheckCircle2,Copy,ShieldCheck,UserPlus,Users,XCircle} from 'lucide-react'
import {auth,db,firebaseConfig} from './firebase'
import './TrainingAccounts.css'

type AccountRole='viewer'|'operator'
type TrainingAccount={id:string;name:string;email:string;role:AccountRole;active:boolean}
const safeRole=(value:unknown):AccountRole=>value==='operator'?'operator':'viewer'
function newPassword(){
  const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%'
  const bytes=new Uint8Array(20)
  crypto.getRandomValues(bytes)
  return [...bytes].map(n=>alphabet[n%alphabet.length]).join('')
}
function errorMessage(e:unknown){
  const code=typeof e==='object'&&e!==null&&'code'in e?String(e.code):''
  if(code==='auth/email-already-in-use')return 'Esse e-mail já possui conta Firebase. Não foi criada uma segunda conta.'
  if(code==='auth/invalid-email')return 'E-mail inválido.'
  if(code==='permission-denied')return 'As regras de gerenciamento ainda não estão publicadas no Firebase.'
  return 'Não foi possível concluir. Confira a conexão e as permissões do Firebase.'
}
export default function TrainingAccounts(){
  const [accounts,setAccounts]=useState<TrainingAccount[]>([])
  const [ready,setReady]=useState(false)
  const [loadError,setLoadError]=useState('')
  const [name,setName]=useState('')
  const [email,setEmail]=useState('')
  const [role,setRole]=useState<AccountRole>('viewer')
  const [busy,setBusy]=useState(false)
  const [workingUid,setWorkingUid]=useState('')
  const [notice,setNotice]=useState('')
  const [credentials,setCredentials]=useState<{email:string;password:string}|null>(null)
  useEffect(()=>{
    const unsubscribe=onSnapshot(collection(db,'authorizedUsers'),snapshot=>{
      const list:TrainingAccount[]=[]
      snapshot.forEach(item=>{
        const record=item.data()
        if(record.role==='viewer'||record.role==='operator')list.push({
          id:item.id,name:String(record.name||''),email:String(record.email||''),
          role:safeRole(record.role),active:record.active===true
        })
      })
      setAccounts(list.sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')))
      setReady(true);setLoadError('')
    },()=>{
      setReady(false)
      setLoadError('O gerenciamento precisa das novas regras do Firestore publicadas. Nenhum usuário será criado até liberar a consulta administrativa.')
    })
    return unsubscribe
  },[])
  const activeCount=useMemo(()=>accounts.filter(item=>item.active).length,[accounts])
  async function addUser(e:FormEvent<HTMLFormElement>){
    e.preventDefault()
    if(!ready||busy)return
    const cleanName=name.trim(),cleanEmail=email.trim().toLowerCase()
    if(cleanName.length<2||cleanName.length>100||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail))return
    if(accounts.some(a=>a.email.toLowerCase()===cleanEmail)){
      setNotice('Esse e-mail já foi cadastrado para treinamento.');return
    }
    setBusy(true);setNotice('');setCredentials(null)
    const password=newPassword()
    const app=initializeApp(firebaseConfig,'rivora-new-user-'+crypto.randomUUID())
    const secondaryAuth=getAuth(app)
    try{
      // Uma segunda instância impede que a criação altere a sessão do administrador.
      const created=await createUserWithEmailAndPassword(secondaryAuth,cleanEmail,password)
      try{
        await setDoc(doc(db,'authorizedUsers',created.user.uid),{
          name:cleanName,email:cleanEmail,role,active:true,
          createdAt:serverTimestamp(),updatedAt:serverTimestamp()
        })
      }catch(writeError){
        // Não deixar uma conta autenticável sem perfil autorizado.
        try{await deleteUser(created.user)}catch{/* o perfil não existe: regras ainda negam acesso */}
        throw writeError
      }
      setName('');setEmail('');setRole('viewer')
      setCredentials({email:cleanEmail,password})
      setNotice('Conta criada e liberada. Copie as credenciais agora, pois a senha não fica salva no RIVORA.')
    }catch(err){setNotice(errorMessage(err))}
    finally{
      try{await signOut(secondaryAuth)}catch{/* sessão secundária descartada no cleanup */}
      await deleteApp(app)
      setBusy(false)
    }
  }
  async function updateAccount(account:TrainingAccount,changes:{active?:boolean;role?:AccountRole}){
    if(!ready||workingUid)return
    setWorkingUid(account.id);setNotice('');setCredentials(null)
    try{
      await updateDoc(doc(db,'authorizedUsers',account.id),{
        ...changes,updatedAt:serverTimestamp()
      })
      setNotice('Permissão atualizada. O acesso será revogado ou ajustado na próxima consulta autenticada.')
    }catch(err){setNotice(errorMessage(err))}
    finally{setWorkingUid('')}
  }
  return <div className="training-accounts">
    <section className="ta-head">
      <div><span className="ta-eyebrow">CONFIGURAÇÕES / ACESSOS</span><h2>Usuários do RIVORA</h2>
        <p>Crie logins individuais para o treinamento, controle quem entra e escolha o nível de acesso.</p></div>
      <div className="ta-total"><Users size={20}/><strong>{activeCount}</strong><span>ativos</span></div>
    </section>
    <div className="ta-columns">
      <section className="ta-panel">
        <header><UserPlus size={19}/><div><h3>Novo acesso</h3><small>Somente a conta administradora cadastra usuários.</small></div></header>
        <form onSubmit={e=>void addUser(e)}>
          <label>Nome completo<input required minLength={2} maxLength={100} value={name} onChange={e=>setName(e.target.value)} placeholder="Nome do participante"/></label>
          <label>E-mail de login<input type="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} placeholder="nome@empresa.com.br" autoComplete="off"/></label>
          <label>Nível de acesso
            <select value={role} onChange={e=>setRole(e.target.value as AccountRole)}>
              <option value="viewer">Consulta (não altera dados)</option>
              <option value="operator">Operacional (pode atualizar fechamentos)</option>
            </select>
          </label>
          {role==='operator'&&<p className="ta-warning">O modo Operacional permite alterações reais no controle de fechamentos e importações. Para treinamento sem riscos, prefira Consulta.</p>}
          <button className="ta-primary" type="submit" disabled={busy||!ready}>{busy?'Criando...':'Criar login e senha'}</button>
        </form>
        {loadError&&<p className="ta-error"><XCircle size={15}/>{loadError}</p>}
        {notice&&<p className="ta-message" role="status">{notice}</p>}
        {credentials&&<div className="ta-credentials" role="status">
          <div className="ta-credentials-header"><CheckCircle2 size={18}/><strong>Credenciais geradas (exibidas uma vez)</strong></div>
          <p><span>E-mail</span><b>{credentials.email}</b></p>
          <p><span>Senha temporária</span><b>{credentials.password}</b></p>
          <button type="button" onClick={()=>void navigator.clipboard.writeText('RIVORA\nE-mail: '+credentials.email+'\nSenha: '+credentials.password)}> <Copy size={15}/> Copiar acesso</button>
          <small>Compartilhe por canal privado. Após fechar esta tela, a senha não poderá ser recuperada aqui.</small>
        </div>}
      </section>
      <section className="ta-panel">
        <header><ShieldCheck size={19}/><div><h3>Contas de treinamento</h3><small>Gerencie os participantes sem alterar seu acesso de administrador.</small></div></header>
        {!ready&&!loadError&&<p className="ta-muted">Carregando usuários...</p>}
        {ready&&!accounts.length&&<p className="ta-muted">Nenhum participante cadastrado.</p>}
        <div className="ta-users">
          {accounts.map(account=><article key={account.id} className="ta-user">
            <div className="ta-person"><span>{account.name.slice(0,1).toUpperCase()}</span><div><strong>{account.name}</strong><small>{account.email}</small></div></div>
            <div className="ta-user-bottom">
              <select aria-label={'Permissão de '+account.name} value={account.role}
                disabled={!!workingUid} onChange={e=>void updateAccount(account,{role:e.target.value as AccountRole})}>
                <option value="viewer">Consulta</option><option value="operator">Operacional</option>
              </select>
              <button type="button" disabled={!!workingUid}
                className={account.active?'ta-block':'ta-unblock'}
                onClick={()=>void updateAccount(account,{active:!account.active})}>
                {account.active?'Bloquear':'Liberar'}
              </button>
            </div>
            <small className={account.active?'ta-status active':'ta-status'}>{account.active?'Ativo':'Bloqueado'}</small>
          </article>)}
        </div>
      </section>
    </div>
  </div>
}
