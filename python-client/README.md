# GSM Gateway Client

Aplicação Python que lê dados dos modems GSM via porta serial e envia para o dashboard web.

## Instalação

```bash
cd python-client
pip install -r requirements.txt
```

## Configuração

1. Acesse o dashboard web e faça login
2. Crie uma **Localização** e copie a **API Key** gerada
3. Edite o arquivo `app_gsm.py` e cole a API Key na variável `API_KEY`

## Executar

```bash
python app_gsm.py
```

## Compilar para .exe

```bash
pip install pyinstaller
pyinstaller --onefile app_gsm.py
```

O executável será gerado em `dist/app_gsm.exe`.

## Como funciona

1. Detecta todas as portas seriais do computador
2. Envia comandos AT para identificar modems GSM
3. Coleta IMEI, operadora, sinal, número e ICCID
4. Envia os dados para o servidor via API REST
5. Repete a cada 30 segundos
