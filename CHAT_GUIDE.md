# Guia de Integração do Chat

## Visão Geral
O sistema de chat permite que administradores e líderes se comuniquem diretamente com voluntários e outros líderes através de uma interface estilo WhatsApp.

## Configuração do Banco de Dados

Execute o script SQL `create_chat_table.sql` no Supabase para criar a tabela de mensagens:

```bash
# No Supabase Dashboard, vá em SQL Editor e execute:
```

O script cria:
- Tabela `chat_messages` com campos: sender_id, receiver_id, message, read, created_at
- Índices para melhor performance
- Políticas RLS para segurança
- Triggers para atualização automática de timestamps

## Funcionalidades

### Para Administradores
- ✅ Ver todos os voluntários e líderes
- ✅ Enviar mensagens para qualquer usuário
- ✅ **Mensagens são enviadas automaticamente via WhatsApp**
- ✅ Histórico completo de conversas no dashboard
- ✅ Marcar mensagens como lidas automaticamente

### Para Líderes
- ✅ Ver voluntários do seu departamento
- ✅ Ver outros líderes
- ✅ Enviar mensagens
- ✅ **Mensagens são enviadas automaticamente via WhatsApp**
- ✅ Histórico de conversas

### Integração com WhatsApp
Quando você envia uma mensagem pelo chat:
1. A mensagem é salva no banco de dados
2. **Automaticamente** é enviada via WhatsApp para o destinatário
3. O destinatário recebe no WhatsApp dele com formatação especial
4. Você pode ver o histórico no dashboard

**Formato da mensagem no WhatsApp:**
```
📱 *Mensagem do Dashboard*

[Sua mensagem aqui]

_Enviado por: [Seu Nome]_
```

## Acesso

1. **Administradores**: Menu Configurações → Chat
2. **Líderes**: Menu Configurações → Chat

## Interface

- **Sidebar Esquerda**: Lista de contatos com foto de perfil e status
- **Área Central**: Conversa com mensagens em tempo real
- **Input**: Campo de texto com botão de envio
- **Tabs**: Contatos e Grupos (grupos em breve)

## Próximas Melhorias

- [ ] Grupos de conversa
- [ ] Notificações em tempo real (Realtime)
- [ ] Indicador de "digitando..."
- [ ] Anexos de arquivos
- [ ] Emojis e formatação
- [ ] Busca de mensagens
- [ ] Arquivar conversas

## Segurança

- ✅ RLS habilitado
- ✅ Usuários só veem suas próprias mensagens
- ✅ Validação de permissões no backend
- ✅ Proteção contra SQL injection
