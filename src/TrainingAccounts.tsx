import {useEffect,useMemo,useState,type FormEvent} from 'react'
import {initializeApp,deleteApp} from 'firebase/app'
import {createUserWithEmailAndPassword,deleteUser,getAuth,signOut,sendPasswordResetEmail,signInWithEmailAndPassword,updatePassword} from 'firebase/auth'
import {collection,doc,onSnapshot,serverTimestamp,setDoc,updateDoc} from 'firebase/firestore'
import {CheckCircle2,Copy,ShieldCheck,UserPlus,Users,XCircle} from 'lucide-react'
import {auth,db,firebaseConfig} from './firebase'
import './TrainingAccounts.css'
import {RIVORA_PAGE_NAMES,selectedPages,type RivoraPage} from './pageAccess'

type AccountRole='viewer'|'operator'
type TrainingAccount={id:string;name:string;email:string;role:AccountRole;active:boolean;pages:RivoraPage[]}
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
  const [initialPassword,setInitialPassword]=useState('')
  const [showPassword,setShowPassword]=useState(false)
  const [pages,setPages]=useState<RivoraPage[]>(['Visão geral'])
  const [editingUid,setEditingUid]=useState('')
  const [editingPages,setEditingPages]=useState<RivoraPage[]>([])
  const [busy,setBusy]=useState(false)
  const [workingUid,setWorkingUid]=useState('')
  const [resetUid,setResetUid]=useState('')
  const [passwordEditorUid,setPasswordEditorUid]=useState('')
  const [currentPassword,setCurrentPassword]=useState('')
  const [replacementPassword,setReplacementPassword]=useState('')
  const [passwordChangeBusy,setPasswordChangeBusy]=useState(false)
  const [notice,setNotice]=useState('')
  const [credentials,setCredentials]=useState<{email:string;password:string}|null>(null)
  useEffect(()=>{
    const unsubscribe=onSnapshot(collection(db,'authorizedUsers'),snapshot=>{
      const list:TrainingAccount[]=[]
      snapshot.forEach(item=>{
        const record=item.data()
        if(record.role==='viewer'||record.role==='operator')list.push({
          id:item.id,name:String(record.name||''),email:String(record.email||''),
          role:safeRole(record.role),active:record.active===true,pages:selectedPages(record.pages)
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
  function togglePage(page:RivoraPage,selected:RivoraPage[],set:(pages:RivoraPage[])=>void){
    const next=selected.includes(page)?selected.filter(item=>item!==page):[...selected,page]
    set(RIVORA_PAGE_NAMES.filter(item=>next.includes(item)))
  }
  function pageChoices(selected:RivoraPage[],set:(pages:RivoraPage[])=>void,prefix:string){
    return <div className="ta-page-selector">
      <div className="ta-page-actions">
        <span>{selected.length} de {RIVORA_PAGE_NAMES.length} telas liberadas</span>
        <button type="button" onClick={()=>set([...RIVORA_PAGE_NAMES])}>Todas</button>
        <button type="button" onClick={()=>set([])}>Nenhuma</button>
      </div>
      <div className="ta-page-grid">
        {RIVORA_PAGE_NAMES.map(item=><label key={item} className="ta-page-choice" htmlFor={prefix+item}>
          <input type="checkbox" id={prefix+item} checked={selected.includes(item)}
            onChange={()=>togglePage(item,selected,set)}/><span>{item}</span>
        </label>)}
      </div>
    </div>
  }
  async function addUser(e:FormEvent<HTMLFormElement>){
    e.preventDefault()
    if(!ready||busy)return
    if(!pages.length){setNotice('Marque pelo menos uma tela para liberar o novo usuário.');return}
    if(initialPassword.length<8||initialPassword.length>72){
      setNotice('Defina uma senha com 8 a 72 caracteres ou use Gerar senha.');return
    }
    const cleanName=name.trim(),cleanEmail=email.trim().toLowerCase()
    if(cleanName.length<2||cleanName.length>100||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail))return
    if(accounts.some(a=>a.email.toLowerCase()===cleanEmail)){
      setNotice('Esse e-mail já foi cadastrado para treinamento.');return
    }
    setBusy(true);setNotice('');setCredentials(null)
    const password=initialPassword
    const app=initializeApp(firebaseConfig,'rivora-new-user-'+crypto.randomUUID())
    const secondaryAuth=getAuth(app)
    try{
      // Uma segunda instância impede que a criação altere a sessão do administrador.
      const created=await createUserWithEmailAndPassword(secondaryAuth,cleanEmail,password)
      try{
        await setDoc(doc(db,'authorizedUsers',created.user.uid),{
          name:cleanName,email:cleanEmail,role,active:true,pages,
          createdAt:serverTimestamp(),updatedAt:serverTimestamp()
        })
      }catch(writeError){
        // Não deixar uma conta autenticável sem perfil autorizado.
        try{await deleteUser(created.user)}catch{/* o perfil não existe: regras ainda negam acesso */}
        throw writeError
      }
      setName('');setEmail('');setRole('viewer');setPages(['Visão geral']);setInitialPassword('');setShowPassword(false)
      setCredentials({email:cleanEmail,password})
      setNotice('Conta criada e liberada. Copie as credenciais agora, pois a senha não fica salva no RIVORA.')
    }catch(err){setNotice(errorMessage(err))}
    finally{
      try{await signOut(secondaryAuth)}catch{/* sessão secundária descartada no cleanup */}
      await deleteApp(app)
      setBusy(false)
    }
  }
  async function updateAccount(account:TrainingAccount,changes:{active?:boolean;role?:AccountRole;pages?:RivoraPage[]}):Promise<boolean>{
    if(!ready||workingUid)return false
    if(changes.pages&&!changes.pages.length){setNotice('Selecione ao menos uma tela ou bloqueie o usuário.');return false}
    setWorkingUid(account.id);setNotice('');setCredentials(null)
    try{
      await updateDoc(doc(db,'authorizedUsers',account.id),{
        ...changes,updatedAt:serverTimestamp()
      })
      setNotice('Permissão atualizada. O acesso será ajustado imediatamente após sincronizar o perfil.')
      return true
    }catch(err){setNotice(errorMessage(err));return false}
    finally{setWorkingUid('')}
  }
  async function requestPasswordReset(account:TrainingAccount){
    if(!ready||busy||workingUid||resetUid)return
    if(!window.confirm('Enviar um link para redefinir a senha de '+account.email+'? O usuário escolherá a nova senha no próprio e-mail.'))return
    setResetUid(account.id);setNotice('');setCredentials(null)
    try{
      await sendPasswordResetEmail(auth,account.email)
      setNotice('Solicitação enviada para '+account.email+'. O usuário poderá definir uma nova senha pelo link do Firebase.')
    }catch(err){
      const code=typeof err==='object'&&err!==null&&'code' in err?String(err.code):''
      setNotice(code==='auth/too-many-requests'
        ?'Foram feitas muitas solicitações. Tente novamente mais tarde.'
        :'Não foi possível enviar a redefinição. Confira o provedor de e-mail/senha e os modelos de e-mail do Firebase.')
    }finally{setResetUid('')}
  }
  function togglePasswordEditor(uid:string){
    setNotice('');setCredentials(null)
    setPasswordEditorUid(openUid=>openUid===uid?'':uid)
    setCurrentPassword('');setReplacementPassword('')
  }
  async function changePassword(account:TrainingAccount,event:FormEvent<HTMLFormElement>){
    event.preventDefault()
    if(passwordChangeBusy||resetUid||workingUid||busy)return
    if(!currentPassword||replacementPassword.length<8||replacementPassword.length>72){
      setNotice('Informe a senha atual e uma nova senha de 8 a 72 caracteres.');return
    }
    setPasswordChangeBusy(true);setNotice('');setCredentials(null)
    const app=initializeApp(firebaseConfig,'rivora-password-change-'+crypto.randomUUID())
    const secondaryAuth=getAuth(app)
    try{
      const signed=await signInWithEmailAndPassword(secondaryAuth,account.email,currentPassword)
      if(signed.user.uid!==account.id)throw Error('UID não corresponde ao usuário selecionado.')
      await updatePassword(signed.user,replacementPassword)
      setCurrentPassword('');setReplacementPassword('');setPasswordEditorUid('')
      setNotice('Senha de '+account.name+' alterada com sucesso no Firebase Authentication.')
    }catch(err){
      const code=typeof err==='object'&&err!==null&&'code' in err?String(err.code):''
      setNotice(code==='auth/invalid-credential'||code==='auth/wrong-password'
        ?'Senha atual incorreta. Se não souber a senha, envie a recuperação por e-mail.'
        :'Não foi possível alterar a senha. Confira o acesso da conta ou envie a redefinição por e-mail.')
    }finally{
      try{await signOut(secondaryAuth)}catch{/* sessão secundária descartada */}
      await deleteApp(app)
      setPasswordChangeBusy(false)
    }
  }
  function beginEditing(account:TrainingAccount){
    if(editingUid===account.id){setEditingUid('');return}
    setEditingUid(account.id)
    setEditingPages(account.pages)
  }
  async function savePages(account:TrainingAccount){
    if(await updateAccount(account,{pages:editingPages}))setEditingUid('')
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
          <div className="ta-password-section">
            <label htmlFor="ta-initial-password">Senha inicial do usuário
              <div className="ta-password-input-row">
                <input id="ta-initial-password" type={showPassword?'text':'password'}
                  minLength={8} maxLength={72} required
                  value={initialPassword} onChange={e=>setInitialPassword(e.target.value)}
                  autoComplete="new-password" placeholder="Defina uma senha de acesso"/>
                <button type="button" className="ta-password-visibility"
                  aria-label={showPassword?'Ocultar senha':'Mostrar senha'}
                  onClick={()=>setShowPassword(visible=>!visible)}>
                  {showPassword?'Ocultar':'Mostrar'}
                </button>
              </div>
            </label>
            <button type="button" className="ta-password-generate"
              onClick={()=>{setInitialPassword(newPassword());setShowPassword(true)}}>
              Gerar senha forte
            </button>
            <small>A senha é definida apenas na criação da conta e não fica salva no painel.</small>
          </div>
          <label>Nível de acesso
            <select value={role} onChange={e=>setRole(e.target.value as AccountRole)}>
              <option value="viewer">Consulta (não altera dados)</option>
              <option value="operator">Operacional (pode atualizar fechamentos)</option>
            </select>
          </label>
          {role==='operator'&&<p className="ta-warning">O modo Operacional permite alterações reais no controle de fechamentos e importações. Para treinamento sem riscos, prefira Consulta.</p>}
          <div className="ta-pages-field">
            <strong>Telas que este usuário poderá acessar</strong>
            <p>O menu, as buscas e o acesso aos dados seguem as telas selecionadas.</p>
            {pageChoices(pages,setPages,'ta-new-')}
          </div>
          <button className="ta-primary" type="submit" disabled={busy||!ready||!pages.length||initialPassword.length<8||initialPassword.length>72}>{busy?'Criando...':'Criar login e senha'}</button>
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
            <div className="ta-password-reset-row">
              <span>Senha de acesso</span>
              <div className="ta-password-actions">
                <button type="button" className="ta-password-reset" disabled={!!resetUid||!!workingUid||busy||passwordChangeBusy}
                  onClick={()=>togglePasswordEditor(account.id)}>
                  {passwordEditorUid===account.id?'Cancelar':'Alterar senha'}
                </button>
                <button type="button" className="ta-password-reset" disabled={!!resetUid||!!workingUid||busy||passwordChangeBusy}
                  onClick={()=>void requestPasswordReset(account)}>
                  {resetUid===account.id?'Enviando...':'Enviar recuperação por e-mail'}
                </button>
              </div>
            </div>
            {passwordEditorUid===account.id&&<form className="ta-password-edit" onSubmit={e=>void changePassword(account,e)}>
              <p>Para alterar diretamente, informe a senha atual do participante e a nova senha. Se não souber a atual, use o e-mail de recuperação.</p>
              <label>Senha atual
                <input type="password" value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)}
                  required autoComplete="off" placeholder="Senha atual do participante"/>
              </label>
              <label>Nova senha
                <input type="password" value={replacementPassword} onChange={e=>setReplacementPassword(e.target.value)}
                  required minLength={8} maxLength={72} autoComplete="new-password" placeholder="Nova senha com no mínimo 8 caracteres"/>
              </label>
              <button className="ta-primary" type="submit"
                disabled={passwordChangeBusy||replacementPassword.length<8||!currentPassword}>
                {passwordChangeBusy?'Alterando...':'Salvar nova senha'}
              </button>
            </form>}
            <div className="ta-page-user-controls">
              <span>{account.pages.length} tela(s) permitida(s)</span>
              <button type="button" className="ta-edit-pages" disabled={!!workingUid}
                aria-expanded={editingUid===account.id}
                onClick={()=>beginEditing(account)}>
                {editingUid===account.id?'Fechar edição':'Definir telas'}
              </button>
            </div>
            {editingUid===account.id&&<div className="ta-pages-editor">
              {pageChoices(editingPages,setEditingPages,'ta-edit-'+account.id+'-')}
              <button type="button" className="ta-primary" disabled={!!workingUid||!editingPages.length}
                onClick={()=>void savePages(account)}>Salvar telas permitidas</button>
            </div>}
            <small className={account.active?'ta-status active':'ta-status'}>{account.active?'Ativo':'Bloqueado'}</small>
          </article>)}
        </div>
      </section>
    </div>
  </div>
}
