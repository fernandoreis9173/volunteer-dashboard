# 🚀 Guia: Supabase Self-Hosted no Easypanel (Azure) + Cloudflare CDN

## 🎯 Stack Escolhida (RECOMENDADA)

```
┌─────────────────────────────────────────────────────────┐
│                  CLOUDFLARE CDN                         │
│              (Cache Global Grátis)                      │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                    AZURE VM                             │
│              (Brasil - São Paulo)                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────────────────────────────────┐          │
│  │           EASYPANEL                      │          │
│  ├──────────────────────────────────────────┤          │
│  │                                          │          │
│  │  ┌────────────┐    ┌────────────┐      │          │
│  │  │ Supabase   │    │ PostgreSQL │      │          │
│  │  │ (Docker)   │────│ (Docker)   │      │          │
│  │  └────────────┘    └────────────┘      │          │
│  │                                          │          │
│  │  ┌────────────┐                         │          │
│  │  │ Frontend   │                         │          │
│  │  │ (Nginx)    │                         │          │
│  │  └────────────┘                         │          │
│  │                                          │          │
│  └──────────────────────────────────────────┘          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 💰 Estimativa de Custos

| Item | Especificação | Custo/Mês |
|------|---------------|-----------|
| **Azure VM** | Standard D4s v3 (4 vCPU, 16 GB) | $140 |
| **Azure Disk** | 256 GB SSD Premium | $40 |
| **Azure Bandwidth** | 100 GB saída | $8 |
| **Cloudflare CDN** | Ilimitado | **GRÁTIS** ✅ |
| **Easypanel** | Self-hosted | **GRÁTIS** ✅ |
| **TOTAL** | - | **~$190/mês** |

**Economia vs Azure nativo:** $510/mês (73% mais barato!)

---

## 🛠️ PASSO 1: Criar VM na Azure

### 1.1 Criar VM via Azure Portal

```bash
# Ou via CLI
az vm create \
  --resource-group volunteer-dashboard-rg \
  --name easypanel-vm \
  --image Ubuntu2204 \
  --size Standard_D4s_v3 \
  --admin-username azureuser \
  --generate-ssh-keys \
  --location brazilsouth \
  --public-ip-sku Standard
```

### 1.2 Configurar Firewall (NSG)

Abrir portas:
- **22** (SSH)
- **80** (HTTP)
- **443** (HTTPS)
- **3000** (Easypanel Dashboard)

```bash
# Via CLI
az vm open-port --port 80 --resource-group volunteer-dashboard-rg --name easypanel-vm
az vm open-port --port 443 --resource-group volunteer-dashboard-rg --name easypanel-vm
az vm open-port --port 3000 --resource-group volunteer-dashboard-rg --name easypanel-vm
```

### 1.3 Conectar via SSH

```bash
# Pegar IP público
az vm show -d -g volunteer-dashboard-rg -n easypanel-vm --query publicIps -o tsv

# Conectar
ssh azureuser@SEU_IP_PUBLICO
```

---

## 📦 PASSO 2: Instalar Easypanel

### 2.1 Instalação Automática

```bash
# Conectado na VM via SSH
curl -sSL https://get.easypanel.io | sh
```

**Aguarde 2-3 minutos.** O script vai:
- ✅ Instalar Docker
- ✅ Instalar Docker Compose
- ✅ Configurar Easypanel
- ✅ Iniciar serviços

### 2.2 Acessar Dashboard

```
http://SEU_IP_PUBLICO:3000
```

**Primeira configuração:**
1. Criar senha de admin
2. Configurar domínio (opcional)
3. Pronto!

---

## 🗄️ PASSO 3: Instalar Supabase no Easypanel

### 3.1 Via Easypanel Dashboard

1. **Login no Easypanel:** `http://SEU_IP:3000`
2. **Clicar em:** "Templates" → "Supabase"
3. **Configurar:**
   ```
   Project Name: volunteer-supabase
   Domain: supabase.seudominio.com (ou usar IP)
   ```
4. **Variáveis de Ambiente:**
   ```
   POSTGRES_PASSWORD: SuaSenhaSegura123!
   JWT_SECRET: sua-chave-jwt-super-secreta-64-chars
   ANON_KEY: (será gerado automaticamente)
   SERVICE_ROLE_KEY: (será gerado automaticamente)
   SITE_URL: https://seudominio.com
   ```
5. **Clicar em:** "Deploy"

**Aguarde 5-10 minutos** para o Supabase iniciar todos os serviços.

### 3.2 Verificar Instalação

```bash
# Na VM, verificar containers rodando
docker ps

# Você deve ver:
# - supabase-db (PostgreSQL)
# - supabase-kong (API Gateway)
# - supabase-auth (GoTrue)
# - supabase-rest (PostgREST)
# - supabase-realtime
# - supabase-storage
# - supabase-meta (Dashboard)
```

---

## 📊 PASSO 4: Migrar Dados do Supabase Atual

### 4.1 Exportar Dados

```bash
# No seu computador local
# Instalar pg_dump se não tiver
brew install postgresql  # macOS

# Exportar schema + dados
pg_dump "postgresql://postgres:[PASSWORD]@db.zmgwuttcqmpyonvtjprw.supabase.co:5432/postgres" \
  --schema=public \
  --no-owner \
  --no-acl \
  > backup_completo.sql
```

### 4.2 Importar para Novo Supabase

```bash
# Conectar no PostgreSQL do Easypanel
# Pegar a connection string no Easypanel Dashboard

psql "postgresql://postgres:SuaSenhaSegura123!@SEU_IP:5432/postgres" \
  < backup_completo.sql
```

### 4.3 Verificar Migração

```bash
# Conectar no banco
psql "postgresql://postgres:SuaSenhaSegura123!@SEU_IP:5432/postgres"

# Verificar tabelas
\dt

# Verificar dados
SELECT COUNT(*) FROM volunteers;
SELECT COUNT(*) FROM events;
SELECT COUNT(*) FROM notifications;
```

---

## 🌐 PASSO 5: Configurar Cloudflare CDN

### 5.1 Adicionar Domínio no Cloudflare

1. **Acesse:** https://dash.cloudflare.com
2. **Adicionar Site:** `seudominio.com`
3. **Escolher Plano:** Free (grátis)
4. **Atualizar Nameservers:** No seu registrador de domínio

### 5.2 Configurar DNS

No Cloudflare DNS:

```
Tipo  | Nome      | Conteúdo           | Proxy
------|-----------|--------------------|---------
A     | @         | SEU_IP_AZURE       | ✅ Proxied
A     | www       | SEU_IP_AZURE       | ✅ Proxied
A     | api       | SEU_IP_AZURE       | ✅ Proxied
CNAME | supabase  | seudominio.com     | ✅ Proxied
```

### 5.3 Configurar SSL/TLS

1. **SSL/TLS → Overview:** Escolher "Full (strict)"
2. **Edge Certificates:** Habilitar "Always Use HTTPS"
3. **Aguardar:** 5-10 minutos para certificado provisionar

### 5.4 Configurar Cache (Importante!)

**Page Rules:**

```
URL: seudominio.com/assets/*
Settings:
  - Cache Level: Cache Everything
  - Edge Cache TTL: 1 month
  - Browser Cache TTL: 1 month
```

```
URL: seudominio.com/*.js
Settings:
  - Cache Level: Cache Everything
  - Edge Cache TTL: 1 week
```

```
URL: seudominio.com/*.css
Settings:
  - Cache Level: Cache Everything
  - Edge Cache TTL: 1 week
```

---

## 🚀 PASSO 6: Deploy Frontend no Easypanel

### 6.1 Criar App no Easypanel

1. **Easypanel Dashboard** → "Apps" → "Create"
2. **Escolher:** "Static Site"
3. **Configurar:**
   ```
   Name: volunteer-frontend
   Domain: seudominio.com
   Build Command: npm run build
   Output Directory: dist
   ```

### 6.2 Conectar GitHub

1. **Source:** GitHub
2. **Repository:** `fernandoreis9173/volunteer-dashboard`
3. **Branch:** `master`
4. **Auto Deploy:** Enabled ✅

### 6.3 Configurar Variáveis de Ambiente

```bash
VITE_SUPABASE_URL=https://api.seudominio.com
VITE_SUPABASE_ANON_KEY=sua-nova-anon-key
```

### 6.4 Deploy

Clicar em **"Deploy"** e aguardar 2-3 minutos.

---

## ⚙️ PASSO 7: Configurações Finais

### 7.1 Configurar Nginx no Easypanel

Easypanel já configura automaticamente, mas você pode customizar:

```nginx
# Adicionar headers de segurança
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;

# Habilitar compressão
gzip on;
gzip_types text/plain text/css application/json application/javascript;
```

### 7.2 Configurar Backups Automáticos

```bash
# Criar script de backup
cat > /home/azureuser/backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
docker exec supabase-db pg_dump -U postgres postgres > /backups/backup_$DATE.sql
# Manter apenas últimos 7 dias
find /backups -name "backup_*.sql" -mtime +7 -delete
EOF

chmod +x /home/azureuser/backup.sh

# Agendar no cron (diário às 3h)
crontab -e
# Adicionar:
0 3 * * * /home/azureuser/backup.sh
```

### 7.3 Configurar Monitoramento

No Easypanel:
1. **Settings** → "Monitoring"
2. Habilitar alertas de:
   - CPU > 80%
   - RAM > 90%
   - Disk > 85%

---

## 🔒 PASSO 8: Segurança

### 8.1 Configurar Firewall na VM

```bash
# Instalar UFW
sudo apt install ufw

# Configurar regras
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw allow 3000/tcp # Easypanel

# Ativar
sudo ufw enable
```

### 8.2 Configurar Cloudflare WAF (Firewall)

1. **Security** → "WAF"
2. Habilitar "OWASP Core Ruleset"
3. Criar regra customizada:
   ```
   Se: País não é Brasil
   Então: Challenge (CAPTCHA)
   ```

### 8.3 Configurar Rate Limiting

No Cloudflare:
1. **Security** → "Rate Limiting"
2. Criar regra:
   ```
   URL: api.seudominio.com/*
   Requests: 100 por minuto
   Action: Block por 10 minutos
   ```

---

## 📊 PASSO 9: Testes e Validação

### 9.1 Testar Supabase

```bash
# Testar Auth
curl https://api.seudominio.com/auth/v1/health

# Testar REST API
curl https://api.seudominio.com/rest/v1/volunteers \
  -H "apikey: SUA_ANON_KEY"

# Testar Realtime
# Abrir console do navegador em https://seudominio.com
# Verificar WebSocket conectando
```

### 9.2 Testar CDN

```bash
# Verificar se está usando Cloudflare
curl -I https://seudominio.com

# Deve retornar:
# server: cloudflare
# cf-cache-status: HIT (após segunda requisição)
```

### 9.3 Testar Performance

```bash
# Instalar lighthouse
npm install -g lighthouse

# Rodar teste
lighthouse https://seudominio.com --view
```

**Métricas esperadas:**
- Performance: 90+
- Accessibility: 95+
- Best Practices: 90+
- SEO: 95+

---

## 📋 Checklist de Migração

### Pré-Migração
- [ ] VM Azure criada e configurada
- [ ] Easypanel instalado
- [ ] Domínio configurado no Cloudflare
- [ ] Backup do Supabase atual
- [ ] Testar backup localmente

### Migração
- [ ] Supabase instalado no Easypanel
- [ ] Dados migrados
- [ ] Frontend deployado
- [ ] DNS apontado para Cloudflare
- [ ] SSL configurado
- [ ] Testar autenticação
- [ ] Testar todas as funcionalidades

### Pós-Migração
- [ ] Monitorar logs por 24h
- [ ] Configurar backups automáticos
- [ ] Configurar alertas
- [ ] Documentar credenciais
- [ ] Treinar equipe (se houver)

---

## 💰 Comparação de Custos

| Solução | Custo/Mês | Complexidade | Controle |
|---------|-----------|--------------|----------|
| **Supabase Managed (Free)** | $0 | ⭐ | ⭐⭐ |
| **Supabase Managed (Pro)** | $25 | ⭐ | ⭐⭐ |
| **Easypanel + Cloudflare** ✅ | $190 | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Azure Nativo** | $700 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

---

## 🎯 Vantagens da Sua Escolha

### ✅ Easypanel + Cloudflare

1. **Custo:** $190/mês (vs $700 Azure nativo)
2. **Simplicidade:** Interface visual (vs CLI complexo)
3. **CDN Grátis:** Cloudflare ilimitado
4. **Controle Total:** Self-hosted
5. **Dados no Brasil:** Azure São Paulo
6. **Escalável:** Fácil upgrade de VM
7. **Backup Fácil:** Snapshots da VM

---

## 🚨 Próximos Passos

Quer que eu:
1. ✅ Crie script de migração automatizado?
2. ✅ Configure CI/CD com GitHub Actions?
3. ✅ Crie guia de troubleshooting?
4. ✅ Faça checklist detalhado de segurança?

---

## 📞 Suporte

**Documentação Oficial:**
- Easypanel: https://easypanel.io/docs
- Cloudflare: https://developers.cloudflare.com
- Supabase Self-Hosted: https://supabase.com/docs/guides/self-hosting

---

*Última atualização: 21/11/2025*
