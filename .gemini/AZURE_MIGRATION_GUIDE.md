# 🚀 Guia Completo: Migração para Azure com Supabase Self-Hosted

## 🎯 Objetivo

Hospedar o sistema completo na Azure:
- ✅ Frontend (Volunteer Dashboard)
- ✅ Backend (Supabase Open Source)
- ✅ Banco de Dados (PostgreSQL)
- ✅ CDN (Azure CDN ou Cloudflare)

---

## 📊 Arquitetura Proposta

```
┌─────────────────────────────────────────────────────────┐
│                    AZURE CLOUD                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────────┐      ┌──────────────────┐       │
│  │   Azure CDN      │      │  Azure Container │       │
│  │   (Frontend)     │──────│   Instances      │       │
│  │                  │      │  (Supabase)      │       │
│  └──────────────────┘      └──────────────────┘       │
│                                     │                   │
│                            ┌────────▼────────┐         │
│                            │  PostgreSQL     │         │
│                            │  (Azure DB)     │         │
│                            └─────────────────┘         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 💰 Estimativa de Custos (Azure)

### Opção 1: Infraestrutura Mínima (800 usuários simultâneos)

| Serviço | Especificação | Custo/Mês |
|---------|---------------|-----------|
| **Azure Container Instances** | 4 vCPU, 16 GB RAM | $150 |
| **Azure Database for PostgreSQL** | 8 vCPU, 32 GB RAM | $400 |
| **Azure CDN** | 100 GB tráfego | $50 |
| **Azure Storage** | 100 GB | $20 |
| **Azure Load Balancer** | Standard | $30 |
| **Backup & Monitoring** | - | $50 |
| **TOTAL** | - | **~$700/mês** |

### Opção 2: Infraestrutura Robusta (2000+ usuários)

| Serviço | Especificação | Custo/Mês |
|---------|---------------|-----------|
| **Azure Kubernetes Service** | 3 nodes, 8 vCPU cada | $500 |
| **Azure Database for PostgreSQL** | 16 vCPU, 64 GB RAM | $800 |
| **Azure CDN Premium** | 500 GB tráfego | $150 |
| **Azure Storage** | 500 GB | $50 |
| **Azure Application Gateway** | WAF enabled | $200 |
| **Backup & Monitoring** | - | $100 |
| **TOTAL** | - | **~$1.800/mês** |

---

## 🛠️ PASSO 1: Preparar Ambiente Azure

### 1.1 Criar Conta Azure

```bash
# Instalar Azure CLI
brew install azure-cli  # macOS
# ou
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash  # Linux

# Login
az login

# Criar Resource Group
az group create \
  --name volunteer-dashboard-rg \
  --location brazilsouth  # São Paulo
```

### 1.2 Criar Rede Virtual

```bash
# Criar VNet
az network vnet create \
  --resource-group volunteer-dashboard-rg \
  --name volunteer-vnet \
  --address-prefix 10.0.0.0/16 \
  --subnet-name default \
  --subnet-prefix 10.0.1.0/24
```

---

## 🗄️ PASSO 2: Configurar PostgreSQL na Azure

### 2.1 Criar Azure Database for PostgreSQL

```bash
# Criar servidor PostgreSQL
az postgres flexible-server create \
  --resource-group volunteer-dashboard-rg \
  --name volunteer-postgres \
  --location brazilsouth \
  --admin-user postgres \
  --admin-password 'SuaSenhaSegura123!' \
  --sku-name Standard_D4s_v3 \
  --tier GeneralPurpose \
  --storage-size 128 \
  --version 17
```

### 2.2 Configurar Firewall

```bash
# Permitir acesso do Azure
az postgres flexible-server firewall-rule create \
  --resource-group volunteer-dashboard-rg \
  --name volunteer-postgres \
  --rule-name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0

# Permitir seu IP (para migração)
az postgres flexible-server firewall-rule create \
  --resource-group volunteer-dashboard-rg \
  --name volunteer-postgres \
  --rule-name AllowMyIP \
  --start-ip-address SEU_IP \
  --end-ip-address SEU_IP
```

### 2.3 Migrar Dados do Supabase Atual

```bash
# 1. Exportar do Supabase atual
pg_dump "postgresql://postgres:[PASSWORD]@db.zmgwuttcqmpyonvtjprw.supabase.co:5432/postgres" \
  --no-owner --no-acl \
  > backup_supabase.sql

# 2. Importar para Azure
psql "host=volunteer-postgres.postgres.database.azure.com port=5432 dbname=postgres user=postgres password=SuaSenhaSegura123! sslmode=require" \
  < backup_supabase.sql
```

---

## 🐳 PASSO 3: Deploy Supabase Self-Hosted

### 3.1 Criar docker-compose.yml

```yaml
version: '3.8'

services:
  # Kong API Gateway
  kong:
    image: kong:3.4
    restart: unless-stopped
    ports:
      - "8000:8000"  # HTTP
      - "8443:8443"  # HTTPS
    environment:
      KONG_DATABASE: postgres
      KONG_PG_HOST: volunteer-postgres.postgres.database.azure.com
      KONG_PG_USER: postgres
      KONG_PG_PASSWORD: SuaSenhaSegura123!
      KONG_PG_DATABASE: kong
    networks:
      - supabase-network

  # Supabase Auth
  auth:
    image: supabase/gotrue:v2.143.0
    restart: unless-stopped
    environment:
      GOTRUE_API_HOST: 0.0.0.0
      GOTRUE_API_PORT: 9999
      GOTRUE_DB_DRIVER: postgres
      GOTRUE_DB_DATABASE_URL: postgresql://postgres:SuaSenhaSegura123!@volunteer-postgres.postgres.database.azure.com:5432/postgres
      GOTRUE_SITE_URL: https://seu-dominio.com
      GOTRUE_JWT_SECRET: sua-chave-jwt-super-secreta
    networks:
      - supabase-network

  # Supabase REST API
  rest:
    image: postgrest/postgrest:v12.0.2
    restart: unless-stopped
    environment:
      PGRST_DB_URI: postgresql://postgres:SuaSenhaSegura123!@volunteer-postgres.postgres.database.azure.com:5432/postgres
      PGRST_DB_SCHEMAS: public,storage
      PGRST_DB_ANON_ROLE: anon
      PGRST_JWT_SECRET: sua-chave-jwt-super-secreta
    networks:
      - supabase-network

  # Supabase Realtime
  realtime:
    image: supabase/realtime:v2.25.35
    restart: unless-stopped
    environment:
      DB_HOST: volunteer-postgres.postgres.database.azure.com
      DB_PORT: 5432
      DB_USER: postgres
      DB_PASSWORD: SuaSenhaSegura123!
      DB_NAME: postgres
      SECRET_KEY_BASE: sua-chave-secreta-base
    networks:
      - supabase-network

  # Supabase Storage
  storage:
    image: supabase/storage-api:v0.43.11
    restart: unless-stopped
    environment:
      DATABASE_URL: postgresql://postgres:SuaSenhaSegura123!@volunteer-postgres.postgres.database.azure.com:5432/postgres
      FILE_SIZE_LIMIT: 52428800
      STORAGE_BACKEND: file
      FILE_STORAGE_BACKEND_PATH: /var/lib/storage
    volumes:
      - storage-data:/var/lib/storage
    networks:
      - supabase-network

  # Supabase Meta (Dashboard)
  meta:
    image: supabase/postgres-meta:v0.68.0
    restart: unless-stopped
    environment:
      PG_META_PORT: 8080
      PG_META_DB_HOST: volunteer-postgres.postgres.database.azure.com
      PG_META_DB_PORT: 5432
      PG_META_DB_USER: postgres
      PG_META_DB_PASSWORD: SuaSenhaSegura123!
      PG_META_DB_NAME: postgres
    networks:
      - supabase-network

networks:
  supabase-network:
    driver: bridge

volumes:
  storage-data:
```

### 3.2 Deploy no Azure Container Instances

```bash
# Criar Azure Container Registry
az acr create \
  --resource-group volunteer-dashboard-rg \
  --name volunteerregistry \
  --sku Basic

# Login no registry
az acr login --name volunteerregistry

# Build e push da imagem
docker-compose build
docker-compose push

# Deploy no ACI
az container create \
  --resource-group volunteer-dashboard-rg \
  --name supabase-stack \
  --image volunteerregistry.azurecr.io/supabase:latest \
  --cpu 4 \
  --memory 16 \
  --ports 8000 8443 \
  --environment-variables \
    POSTGRES_HOST=volunteer-postgres.postgres.database.azure.com
```

---

## 🌐 PASSO 4: Deploy Frontend na Azure

### 4.1 Opção A: Azure Static Web Apps (Recomendado)

```bash
# Instalar SWA CLI
npm install -g @azure/static-web-apps-cli

# Build do projeto
npm run build

# Deploy
swa deploy \
  --app-location ./dist \
  --resource-group volunteer-dashboard-rg \
  --app-name volunteer-dashboard
```

### 4.2 Opção B: Azure Storage + CDN

```bash
# Criar Storage Account
az storage account create \
  --name volunteerstorage \
  --resource-group volunteer-dashboard-rg \
  --location brazilsouth \
  --sku Standard_LRS

# Habilitar Static Website
az storage blob service-properties update \
  --account-name volunteerstorage \
  --static-website \
  --index-document index.html \
  --404-document index.html

# Upload dos arquivos
az storage blob upload-batch \
  --account-name volunteerstorage \
  --source ./dist \
  --destination '$web'

# Criar CDN
az cdn profile create \
  --resource-group volunteer-dashboard-rg \
  --name volunteer-cdn \
  --sku Standard_Microsoft

az cdn endpoint create \
  --resource-group volunteer-dashboard-rg \
  --profile-name volunteer-cdn \
  --name volunteer-endpoint \
  --origin volunteerstorage.z15.web.core.windows.net
```

---

## 🔧 PASSO 5: Configurar Variáveis de Ambiente

### 5.1 Atualizar `.env.local`

```bash
# Novo arquivo .env.production
VITE_SUPABASE_URL=https://volunteer-endpoint.azureedge.net
VITE_SUPABASE_ANON_KEY=sua-nova-chave-anon
```

### 5.2 Gerar Novas Chaves JWT

```bash
# Gerar chave secreta
openssl rand -base64 32

# Usar em: GOTRUE_JWT_SECRET e PGRST_JWT_SECRET
```

---

## 📋 PASSO 6: Checklist de Migração

### Antes da Migração
- [ ] Backup completo do Supabase atual
- [ ] Testar backup em ambiente local
- [ ] Documentar todas as Edge Functions
- [ ] Listar todas as variáveis de ambiente
- [ ] Avisar usuários sobre manutenção

### Durante a Migração
- [ ] Colocar sistema em manutenção
- [ ] Exportar dados do Supabase
- [ ] Importar para Azure PostgreSQL
- [ ] Deploy Supabase self-hosted
- [ ] Deploy frontend
- [ ] Testar autenticação
- [ ] Testar todas as funcionalidades

### Após a Migração
- [ ] Monitorar logs por 24h
- [ ] Verificar performance
- [ ] Configurar backups automáticos
- [ ] Configurar alertas
- [ ] Atualizar DNS (se necessário)

---

## ⚠️ CONSIDERAÇÕES IMPORTANTES

### Vantagens da Migração

✅ **Controle Total:** Você gerencia tudo
✅ **Dados no Brasil:** Compliance e latência
✅ **Customização:** Modificar Supabase como quiser
✅ **Escalabilidade:** Crescer sem limites de plano

### Desvantagens

❌ **Custo:** $700-1.800/mês vs $0-25/mês (Supabase managed)
❌ **Complexidade:** Você gerencia tudo (updates, backups, segurança)
❌ **Tempo:** Setup inicial de 2-4 semanas
❌ **Manutenção:** Precisa de DevOps dedicado

---

## 🎯 RECOMENDAÇÃO FINAL

### Cenário 1: Você tem equipe técnica
✅ **Migre para Azure** se:
- Precisa de compliance específico
- Quer dados 100% no Brasil
- Tem budget de $700+/mês
- Tem DevOps para gerenciar

### Cenário 2: Você é desenvolvedor solo
❌ **Não migre** ainda. Mantenha Supabase managed até:
- Ter 500+ usuários pagantes
- Ter budget de $1.000+/mês
- Contratar DevOps
- Ter necessidade real de self-hosting

---

## 📞 Próximos Passos

Quer que eu:
1. Crie scripts automatizados de migração?
2. Configure CI/CD com GitHub Actions?
3. Crie guia de monitoramento e alertas?
4. Faça estimativa detalhada de custos?

---

*Última atualização: 21/11/2025*
