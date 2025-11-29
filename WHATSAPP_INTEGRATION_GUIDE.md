# Integração WhatsApp API - Guia Completo

## 📋 Visão Geral

Este guia explica como configurar e usar a integração com a Evolution API para enviar mensagens via WhatsApp no sistema de voluntários.

## 🗄️ 1. Criar a Tabela no Supabase

Execute o script SQL no Supabase SQL Editor:

```sql
-- Execute o arquivo: create_whatsapp_settings_table.sql
```

Este script cria:
- Tabela `whatsapp_settings` para armazenar as configurações
- Políticas RLS (Row Level Security) para permitir apenas admins
- Trigger para atualizar `updated_at` automaticamente

## ⚙️ 2. Configurar no Painel Admin

1. **Acesse o Menu de Configurações**
   - Faça login como Admin
   - No sidebar, clique em "Configurações"
   - Selecione "WhatsApp API"

2. **Preencha os Campos**
   - **Evolution URL**: URL da sua instância Evolution API (ex: `https://sua-evolution-api.com`)
   - **Token**: Token de autenticação da Evolution API
   - **Nome da Sessão**: Nome da sessão do WhatsApp configurada na Evolution API
   - **Ativar/Desativar**: Checkbox para ativar ou desativar a integração

3. **Salvar**
   - Clique em "Salvar Configurações"
   - As configurações serão armazenadas no Supabase

## 🚀 3. Deploy da Edge Function

Para fazer o deploy da Edge Function `send-whatsapp`:

```bash
# Certifique-se de estar na pasta do projeto
cd /Users/chamachurch/Documents/GITHUB/volunteer-dashboard

# Deploy da função
supabase functions deploy send-whatsapp
```

## 📱 4. Como Usar a Edge Function

### Exemplo de Uso em TypeScript/JavaScript

```typescript
import { supabase } from './lib/supabaseClient';

async function enviarMensagemWhatsApp(numero: string, mensagem: string) {
  try {
    const { data, error } = await supabase.functions.invoke('send-whatsapp', {
      body: {
        number: numero,    // Ex: "5511999999999"
        message: mensagem  // Sua mensagem
      }
    });

    if (error) throw error;
    
    console.log('Mensagem enviada com sucesso:', data);
    return data;
  } catch (error) {
    console.error('Erro ao enviar mensagem:', error);
    throw error;
  }
}

// Exemplo de uso
await enviarMensagemWhatsApp('5511999999999', 'Olá! Esta é uma mensagem de teste.');
```

### Formato do Número

O número deve estar no formato internacional sem caracteres especiais:
- ✅ Correto: `5511999999999`
- ❌ Errado: `+55 (11) 99999-9999`

A função automaticamente remove caracteres especiais, mas é recomendado enviar já formatado.

## 🔒 Segurança

- Apenas usuários com role `admin` podem:
  - Visualizar as configurações
  - Editar as configurações
  - Enviar mensagens via WhatsApp

- O token da Evolution API é armazenado de forma segura no Supabase
- As políticas RLS garantem que apenas admins tenham acesso

## 🛠️ Estrutura de Arquivos

```
volunteer-dashboard/
├── components/
│   └── WhatsAppSettingsPage.tsx       # Página de configurações
├── supabase/
│   └── functions/
│       └── send-whatsapp/
│           └── index.ts                # Edge Function
├── assets/
│   └── icons/
│       ├── settings.svg                # Ícone de configurações
│       └── whatsapp.svg                # Ícone do WhatsApp
└── create_whatsapp_settings_table.sql  # Script SQL
```

## 📝 Fluxo de Funcionamento

1. **Admin configura** a Evolution API no painel
2. **Dados são salvos** na tabela `whatsapp_settings` no Supabase
3. **Edge Function** busca as configurações quando chamada
4. **Mensagem é enviada** via Evolution API
5. **Resposta** é retornada para o cliente

## ⚠️ Troubleshooting

### Erro: "Configurações do WhatsApp não encontradas"
- Verifique se você salvou as configurações no painel
- Certifique-se de que a integração está ativada

### Erro: "Falha ao enviar mensagem"
- Verifique se a URL da Evolution API está correta
- Confirme se o token está válido
- Verifique se a sessão do WhatsApp está conectada na Evolution API

### Erro: "Não autorizado"
- Apenas admins podem enviar mensagens
- Verifique se você está logado como admin

## 🔄 Atualizações Futuras

Possíveis melhorias:
- Histórico de mensagens enviadas
- Templates de mensagens
- Envio em massa
- Agendamento de mensagens
- Relatórios de entrega

## 📞 Suporte

Para dúvidas ou problemas:
1. Verifique os logs no Supabase Edge Functions
2. Consulte a documentação da Evolution API
3. Entre em contato com o suporte técnico
