# Tutorial Completo: Deploy no Ubuntu 20.04 + Criar app.exe

---

## PARTE 1: Criar o app.exe (Cliente GSM)

### Pré-requisitos no Windows
- Python 3.8+ instalado ([python.org](https://www.python.org/downloads/))
- Marque "Add Python to PATH" durante a instalação

### Passo a passo

```bash
# 1. Abra o Prompt de Comando (cmd) ou PowerShell

# 2. Clone o repositório (ou baixe o ZIP do GitHub)
git clone <URL_DO_SEU_REPOSITORIO>
cd <NOME_DO_PROJETO>/python-client

# 3. Instale as dependências
pip install -r requirements.txt

# 4. Instale o PyInstaller
pip install pyinstaller

# 5. Compile o executável
pyinstaller --onefile app_gsm.py

# 6. O arquivo estará em:
#    python-client/dist/app_gsm.exe
```

### Como usar o app.exe

1. Copie `dist/app_gsm.exe` para qualquer pasta
2. Conecte a chipeira (gateway GSM) via USB
3. Execute `app_gsm.exe`
4. Na primeira execução, cole a **API Key** (obtida no dashboard web)
5. A chave fica salva em `config.json` ao lado do `.exe`
6. Pronto! O app detecta os modems e envia dados automaticamente a cada 30s

> **Dica:** Distribua apenas o `app_gsm.exe` — cada usuário insere sua própria API Key.

---

## PARTE 2: Hospedar o Site no Ubuntu 20.04 (VPS)

### 2.1 — Preparar o servidor

```bash
# Conecte via SSH
ssh root@SEU_IP_DO_VPS

# Atualize o sistema
sudo apt update && sudo apt upgrade -y

# Instale dependências básicas
sudo apt install -y curl git build-essential
```

### 2.2 — Instalar Node.js 20

```bash
# Instale o NVM (gerenciador de versões do Node)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Carregue o NVM na sessão atual
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Instale o Node.js 20
nvm install 20
nvm use 20

# Verifique
node -v   # deve mostrar v20.x.x
npm -v    # deve mostrar 10.x.x
```

### 2.3 — Clonar e buildar o projeto

```bash
# Clone o repositório
cd /home
git clone <URL_DO_SEU_REPOSITORIO> gsm-dashboard
cd gsm-dashboard

# Instale dependências
npm install

# Crie o arquivo .env de produção
nano .env
```

Conteúdo do `.env`:
```env
VITE_SUPABASE_URL=https://eusbnxszzdtwgiblibhz.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1c2JueHN6emR0d2dpYmxpYmh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMzI4NTEsImV4cCI6MjA4NjkwODg1MX0.PTQQOeQEk3xVjF5Ry4BvltGRoJTMtPNxUODe5tTFw8g
VITE_SUPABASE_PROJECT_ID=eusbnxszzdtwgiblibhz
```

```bash
# Faça o build de produção
npm run build

# Os arquivos estáticos ficam em: dist/
```

### 2.4 — Instalar e configurar o Nginx

```bash
# Instale o Nginx
sudo apt install -y nginx

# Crie a configuração do site
sudo nano /etc/nginx/sites-available/gsm-dashboard
```

Cole o seguinte conteúdo:
```nginx
server {
    listen 80;
    server_name SEU_DOMINIO_OU_IP;

    root /home/gsm-dashboard/dist;
    index index.html;

    # Gzip para performance
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;

    # SPA - redireciona todas as rotas para index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache para assets estáticos
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

```bash
# Ative o site
sudo ln -s /etc/nginx/sites-available/gsm-dashboard /etc/nginx/sites-enabled/

# Remova o site padrão
sudo rm /etc/nginx/sites-enabled/default

# Teste a configuração
sudo nginx -t

# Reinicie o Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx
```

### 2.5 — Configurar firewall

```bash
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS (para depois)
sudo ufw enable
```

### 2.6 — (Opcional) Adicionar HTTPS com Let's Encrypt

```bash
# Instale o Certbot
sudo apt install -y certbot python3-certbot-nginx

# Gere o certificado SSL (substitua pelo seu domínio)
sudo certbot --nginx -d seudominio.com

# Renovação automática (já configurada, mas teste)
sudo certbot renew --dry-run
```

### 2.7 — Atualizar o site (deploy futuro)

Crie um script para facilitar atualizações:

```bash
sudo nano /home/gsm-dashboard/deploy.sh
```

```bash
#!/bin/bash
cd /home/gsm-dashboard
echo "📥 Baixando atualizações..."
git pull origin main
echo "📦 Instalando dependências..."
npm install
echo "🔨 Fazendo build..."
npm run build
echo "✅ Deploy concluído!"
```

```bash
chmod +x /home/gsm-dashboard/deploy.sh

# Para atualizar, basta rodar:
./deploy.sh
```

---

## Resumo da Arquitetura

```
┌─────────────────────┐     ┌──────────────────────┐     ┌──────────────────┐
│   app_gsm.exe       │────▶│  Lovable Cloud       │◀────│  Dashboard Web   │
│   (Windows + USB)   │ API │  (Edge Functions +   │     │  (Nginx/Ubuntu)  │
│                     │     │   Database)           │     │                  │
└─────────────────────┘     └──────────────────────┘     └──────────────────┘
     Chipeira GSM              Backend na nuvem           VPS Ubuntu 20.04
```

## Checklist Final

- [ ] Python instalado no Windows
- [ ] `app_gsm.exe` compilado e funcionando
- [ ] VPS com Ubuntu 20.04 acessível via SSH
- [ ] Node.js 20 instalado
- [ ] Projeto clonado e build feito
- [ ] Nginx configurado e rodando
- [ ] Firewall configurado
- [ ] (Opcional) HTTPS com Let's Encrypt
- [ ] Testar: acessar `http://SEU_IP` e verificar o dashboard
- [ ] Testar: rodar `app_gsm.exe` e verificar dados no dashboard
