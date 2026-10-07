# Confirmação por operação no Teams

O remetente resolve `operationAssignments/{operationId}.responsibleId` e lê o e-mail do responsável ativo em `responsibles/{id}` a cada envio. Os contatos permanecem no Firestore autenticado. O código e os logs não incluem o e-mail real ou a URL secreta do webhook.

O arquivo `scripts/rivora-teams-config.json` contém a lista explícita de operações/ciclos habilitados. Inicialmente só OP07 / 2099-12 está habilitada. As definições de OP01 a OP08 já são suportadas. Para ampliar, atualizar a lista e a condição do gatilho no Power Automate; cadastrar/vincular o responsável no RIVORA continua sendo necessário.

## Power Automate

Fluxo: `RIVORA - Teams - Confirmacao por operacao`.

1. `When a Teams webhook request is received` recebe `operationId`, `cycle`, `requestId`, `recipient` e um cartão em `attachments[0].content`.
2. `RIVORA_Card` publica em conversa privada com o bot e aguarda resposta. Destinatário: `triggerBody()?['recipient']`. Mensagem: `string(triggerBody()?['attachments']?[0]?['content'])`.
3. GitHub Standard, `CreateRepositoryDispatchEvent`, envia `rivora_confirmation` para `eulernasc/rivora`, com a operação/ciclo/requestId do gatilho, status e prazo dos dados da resposta e `responder.email` da identidade fornecida pelo Teams.

A condição de teste aceita somente OP07, ciclo 2099-12, requestId preenchido e destinatário do domínio corporativo. A opção externa do webhook exige aprovação antes de ativar. A URL assinada deve ser guardada apenas no secret de Actions `RIVORA_TEAMS_WEBHOOK_URL`, nunca no código, em issues ou em logs.

## Execução e lembretes

Executar manualmente o workflow `RIVORA Teams cards` para solicitar o primeiro cartão. O ciclo fictício é identificado como teste no cartão. `Sim` confirma a operação e as frentes aplicáveis; `Não` exige data e horário de Brasília e mantém a operação pendente. O prazo deve existir no calendário e estar no futuro.

O agendamento verifica as operações habilitadas aproximadamente a cada 15 minutos. GitHub pode atrasar execuções agendadas; não é um serviço de entrega em horário exato. Só reenvia depois de uma resposta pendente cujo prazo venceu. Não inicia operações novas automaticamente. Workflows agendados em repositórios públicos também podem ser desabilitados pelo GitHub por inatividade.

`closingCycles/{cycle}/notifications/{operationId}` guarda a identificação do cartão e estado da entrega. Um cartão em `sending`, `waiting` ou `failed` bloqueia reenvio automático para evitar duplicatas. Entrega ambígua ou cartão expirado requer reconciliação no histórico do Power Automate e no Firestore antes de um novo envio. O fluxo espera resposta por até o limite normal de duração de execução do Power Automate; lembretes de prazos longos usam uma nova execução.

As respostas são verificadas contra o responsável atual e o requestId. A atualização das frentes, da operação e do estado da notificação usa um commit atômico com precondições de versão. As credenciais bridge continuam nos secrets existentes; o fluxo manual original e seu payload sem requestId continuam compatíveis.

## Verificação

`node scripts/rivora-teams-domain.test.mjs` verifica escopo, destinatário, replay, calendário/fuso, lembretes e opções do cartão. O teste completo ainda exige publicar o workflow, configurar a URL secreta, ativar o fluxo, enviar o cartão e verificar a resposta em Actions e Firestore. Os testes locais não substituem a validação no Teams.
