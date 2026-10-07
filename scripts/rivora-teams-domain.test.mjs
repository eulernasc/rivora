import test from 'node:test'
import assert from 'node:assert/strict'
import {validateScope,validateResponsible,validateResponse,shouldAsk,makeCard} from './rivora-teams-domain.mjs'
const now = new Date('2026-10-07T12:00:00Z')
const recipient = {responsibleId:'person1',email:'person@example.com'}
const notification = {requestId:'request1',responsibleId:'person1',status:'waiting'}
const payload = {requestId:'request1',responderEmail:'person@example.com',status:'pending',expectedAt:'2099-12-08T14:00:00-03:00'}
test('only explicitly enabled targets are sent',()=>{
  const config={targets:[{operationId:'OP07',cycle:'2099-12'}]}
  validateScope('OP07','2099-12',config)
  assert.throws(()=>validateScope('OP08','2099-12',config))
  assert.throws(()=>validateScope('OP07','2026-10',config))
  assert.throws(()=>validateScope('../OP07','2099-12',config))
})
test('recipient comes from an active assigned record',()=>{
  assert.deepEqual(validateResponsible({responsibleId:'person1'},{active:true,email:'Person@example.com'}),recipient)
  assert.throws(()=>validateResponsible({responsibleId:'../person1'},{active:true,email:recipient.email}))
  assert.throws(()=>validateResponsible({responsibleId:'person1'},{active:false,email:recipient.email}))
  assert.throws(()=>validateResponsible({responsibleId:'person1'},{active:true,email:'a@example.com;b@example.com'}))
})
test('valid pending response preserves Brasília timezone',()=>{
  assert.deepEqual(validateResponse(payload,notification,recipient,now),{status:'pending',expectedAt:'2099-12-08T17:00:00.000Z'})
})
test('rejects wrong responsible, stale cards and replay',()=>{
  assert.throws(()=>validateResponse({...payload,responderEmail:'other@example.com'},notification,recipient,now))
  assert.throws(()=>validateResponse({...payload,requestId:'old'},notification,recipient,now))
  assert.throws(()=>validateResponse(payload,{...notification,status:'answered'},recipient,now))
  assert.throws(()=>validateResponse(payload,notification,{...recipient,responsibleId:'person2'},now))
})
test('rejects invalid or past deadlines and accepts confirmed without deadline',()=>{
  for(const expectedAt of ['2026-02-30T14:00:00-03:00','2099-02-30T14:00:00-03:00','2020-01-01T00:00:00-03:00','invalid','2099-12-08T14:00:00Z']) {
    assert.throws(()=>validateResponse({...payload,expectedAt},notification,recipient,now))
  }
  assert.deepEqual(validateResponse({...payload,status:'confirmed',expectedAt:''},notification,recipient,now),{status:'confirmed',expectedAt:null})
})
test('reminders respect deadline and never duplicate outstanding or failed cards',()=>{
  const operation={status:'pending',expectedAt:'2026-10-07T11:00:00Z'}
  assert.equal(shouldAsk(operation,{status:'answered'},now),true)
  assert.equal(shouldAsk({...operation,expectedAt:'2099-12-08T17:00:00Z'},{status:'answered'},now),false)
  for(const status of ['sending','waiting','failed']) assert.equal(shouldAsk(operation,{status},now,true),false)
  assert.equal(shouldAsk({status:'confirmed'},null,now,true),false)
  assert.equal(shouldAsk(null,null,now,false),false)
  assert.equal(shouldAsk(null,null,now,true),true)
})
test('card includes test identification, both choices and required new deadline',()=>{
  const card=makeCard('OP07','2099-12',now)
  assert.match(JSON.stringify(card),/TESTE/)
  assert.equal(card.actions[0].data.status,'confirmed')
  assert.equal(card.actions[1].card.actions[0].data.status,'pending')
  assert.equal(card.actions[1].card.body[1].isRequired,true)
  assert.equal(card.actions[1].card.body[2].isRequired,true)
})
