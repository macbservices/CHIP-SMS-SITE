import os
import time
import threading
import serial
import serial.tools.list_ports
import json
import random
from datetime import datetime
from flask import Flask, render_template, jsonify, request, redirect, session, flash

app = Flask(__name__, template_folder='templates', static_folder='static')
app.secret_key = 'chip-sms-v8-final-2026-pix'

USUARIOS = {'admin': {'password': '123', 'saldo': 100.00}}
COMPRAS = {}
SERVICOS = {
    'whatsapp': {'preco': 15.46, 'duracao': '30 dias', 'permanente': True, 'icon': 'fab fa-whatsapp'},
    'gmail': {'preco': 1.30, 'duracao': '1 SMS', 'permanente': False, 'icon': 'fab fa-google'},
    'telegram': {'preco': 2.50, 'duracao': '1 SMS', 'permanente': False, 'icon': 'fab fa-telegram'},
    'facebook': {'preco': 3.20, 'duracao': '1 SMS', 'permanente': False, 'icon': 'fab fa-facebook'},
    'outros': {'preco': 1.00, 'duracao': '1 SMS', 'permanente': False, 'icon': 'fas fa-mobile-alt'}
}

modems = {}
demo_numbers = ['+5511999123456']
lock = threading.Lock()
PIX_KEY = "PIX-CHIP-SMS@GMAIL.COM"  # Sua chave PIX

def save_data():
    os.makedirs('data', exist_ok=True)
    try:
        with open('data/users.json', 'w') as f:
            json.dump({'users': USUARIOS, 'compras': COMPRAS}, f, indent=2)
    except: pass

def load_data():
    try:
        if os.path.exists('data/users.json'):
            with open('data/users.json', 'r') as f:
                data = json.load(f)
                globals()['USUARIOS'].update(data.get('users', {}))
                globals()['COMPRAS'].update(data.get('compras', {}))
    except: pass

def login_required(f):
    def wrap(*args, **kwargs):
        if 'username' not in session:
            return redirect('/login')
        return f(*args, **kwargs)
    wrap.__name__ = f.__name__
    return wrap

def extract_phone_number(response):
    import re
    response = response.replace('\\r', '').replace('\\n', '\n').replace('\\\\', '')
    linhas = response.split('\n')
    for linha in linhas:
        if '+CNUM:' in linha:
            numeros = re.findall(r'[\+]?55\d{9,11}', linha)
            for numero in numeros:
                if len(numero) >= 12:
                    return numero
            partes = linha.split(',')
            for parte in partes:
                parte = parte.strip().strip('"')
                if (parte.startswith('55') or parte.startswith('+55')) and len(parte) >= 12:
                    return parte[:15]
    return None

def get_real_number(port):
    baudrates = [115200, 9600]
    for baud in baudrates:
        try:
            ser = serial.Serial(port, baud, timeout=4, rtscts=False)
            time.sleep(2)
            comandos = [b'ATZ\r\n', b'ATE0\r\n', b'AT+CMGF=1\r\n', b'AT+CNUM\r\n']
            all_resp = ""
            for cmd in comandos:
                ser.write(cmd)
                time.sleep(3)
                resp = ser.read(2000).decode('utf-8', errors='ignore')
                all_resp += resp
            ser.close()
            numero = extract_phone_number(all_resp)
            if numero:
                return numero
        except:
            try: ser.close()
            except: pass
    return None

def detect_ports():
    ports = []
    for p in serial.tools.list_ports.comports():
        desc = p.description.upper()
        if any(x in desc for x in ['XR21V', 'USB-SERIAL', 'CH340', 'FTDI', 'CP210']):
            ports.append(p.device)
    return sorted(ports[:8])

def sms_poller(port):
    last_sms = 0
    while port in modems:
        try:
            if modems[port]['status'] == 'busy' and time.time() - last_sms > 18:
                sms_code = f"{random.randint(100000, 999999):06d}"
                numero = modems[port]['number']
                print(f"📱 SMS SIMULADO {numero}: {sms_code}")
                with lock:
                    for c_id, compra in list(COMPRAS.items()):
                        if compra.get('port') == port and not compra.get('usado', False):
                            COMPRAS[c_id]['codigo_sms'] = sms_code
                            COMPRAS[c_id]['usado'] = True
                            save_data()
                last_sms = time.time()
        except: pass
        time.sleep(3)

def init_system():
    def worker():
        print("🔍 Detectando chips...")
        ports = detect_ports()
        print(f"🔌 Portas: {ports}")
        real_count = 0
        for port in ports:
            numero_real = get_real_number(port)
            if numero_real:
                with lock:
                    modems[port] = {'number': numero_real, 'status': 'free', 'port': port, 'real': True}
                print(f"✅ {port}: {numero_real}")
                real_count += 1
                threading.Thread(target=sms_poller, args=(port,), daemon=True).start()
        print(f"\n🎉 {real_count} CHIPS REAIS!")
    threading.Thread(target=worker, daemon=True).start()

@app.route('/')
def index(): return redirect('/login')

@app.route('/login', methods=['GET', 'POST'])
def login():
    load_data()
    if request.method == 'POST':
        username = request.form['username'].strip()
        password = request.form['password']
        if username in USUARIOS and USUARIOS[username]['password'] == password:
            session['username'] = username
            return redirect('/dashboard')
        if request.form.get('action') == 'register' and username not in USUARIOS:
            USUARIOS[username] = {'password': password, 'saldo': 50.00}
            save_data()
            session['username'] = username
            return redirect('/dashboard')
        flash('❌ Erro no login!')
    return render_template('login.html')

@app.route('/dashboard')
@login_required
def dashboard():
    load_data()
    username = session['username']
    user_data = USUARIOS.get(username, {'saldo': 0})
    numbers = []
    with lock:
        for m in modems.values():
            if m['status'] == 'free':
                numbers.append({'port': m['port'], 'number': m['number'], 'real': True, 'label': f"REAL {m['port']}"})
        demo_count = 8 - len(numbers)
        for i in range(demo_count):
            numbers.append({'port': f'demo_{i}', 'number': demo_numbers[0], 'demo': True, 'label': 'DEMO'})
    return render_template('dashboard.html', username=username, saldo=user_data['saldo'], numbers=numbers, servicos=SERVICOS)

@app.route('/historico')
@login_required
def historico():
    load_data()
    username = session['username']
    todas_compras = [c for c_id, c in COMPRAS.items() if c.get('username') == username]
    todas_compras.sort(key=lambda x: x['timestamp'], reverse=True)
    return render_template('historico.html', compras=todas_compras)

@app.route('/pix')
@login_required
def pix():
    return render_template('pix.html')

@app.route('/api/adicionar_saldo', methods=['POST'])
@login_required
def adicionar_saldo():
    valor = float(request.form['valor'])
    username = session['username']
    USUARIOS[username]['saldo'] += valor
    save_data()
    flash(f'✅ Saldo adicionado! +R${valor:.2f}')
    return redirect('/dashboard')

@app.route('/logout')
def logout():
    session.clear()
    return redirect('/login')

@app.route('/api/numbers')
@login_required
def api_numbers():
    numbers = []
    with lock:
        for m in modems.values():
            if m['status'] == 'free':
                numbers.append({'port': m['port'], 'number': m['number'], 'real': True, 'label': f"REAL {m['port']}"})
        demo_count = 8 - len(numbers)
        for i in range(demo_count):
            numbers.append({'port': f'demo_{i}', 'number': demo_numbers[0], 'demo': True, 'label': 'DEMO'})
    return jsonify(numbers)

@app.route('/api/comprar/<port>/<servico>')
@login_required
def api_comprar(port, servico):
    load_data()
    username = session['username']
    saldo = USUARIOS[username].get('saldo', 0)
    
    with lock:
        is_demo = port.startswith('demo_')
        if not is_demo and port not in modems:
            return jsonify({'ok': False, 'erro': 'Chip ocupado'})
        
        if servico not in SERVICOS:
            return jsonify({'ok': False, 'erro': 'Serviço inválido'})
        
        preco = SERVICOS[servico]['preco']
        if saldo < preco:
            return jsonify({'ok': False, 'erro': f'Saldo R${saldo:.2f}'})
        
        USUARIOS[username]['saldo'] -= preco
        if not is_demo:
            modems[port]['status'] = 'busy'
        
        numero = demo_numbers[0] if is_demo else modems[port]['number']
        compra_id = str(int(time.time()))
        
        COMPRAS[compra_id] = {
            'username': username, 'port': port, 'numero': numero,
            'servico': servico, 'preco': preco, 'codigo_sms': None,
            'usado': False, 'demo': is_demo, 'timestamp': datetime.now().isoformat()
        }
        save_data()
        
        return jsonify({'ok': True, 'numero': numero, 'compra_id': compra_id, 'servico': servico.upper()})

@app.route('/compra/<compra_id>')
@login_required
def compra_popup(compra_id):
    load_data()
    compra = COMPRAS.get(compra_id)
    if not compra:
        return "Compra não encontrada", 404
    return render_template('compra_popup.html', compra=compra)

@app.route('/api/sms/<compra_id>')
@login_required
def api_sms(compra_id):
    load_data()
    compra = COMPRAS.get(compra_id)
    return jsonify({
        'codigo': compra.get('codigo_sms', '⏳ Aguardando SMS...'), 
        'usado': compra.get('usado', False) if compra else True
    })

if __name__ == '__main__':
    os.makedirs('data', exist_ok=True)
    os.makedirs('templates', exist_ok=True)
    os.makedirs('static', exist_ok=True)
    load_data()
    print("🚀 CHIP-SMS v8.0 - PIX + HISTÓRICO")
    print("🌐 http://192.168.100.192:5000")
    print("📱 admin/123")
    init_system()
    print("=" * 70)
    app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)
