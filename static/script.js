let currentService = 'gmail';

function loadServicos() {
    const grid = document.getElementById('servicos');
    grid.innerHTML = `
        <div class="servico-card active" onclick="selectService('gmail')">
            <i class="fab fa-google"></i>
            <h3>Gmail</h3>
            <div class="servico-preco">R$ 1,30</div>
            <small>1 SMS</small>
        </div>
        <div class="servico-card" onclick="selectService('whatsapp')">
            <i class="fab fa-whatsapp"></i>
            <h3>WhatsApp</h3>
            <div class="servico-preco">R$ 15,46</div>
            <small>30 dias</small>
        </div>
        <div class="servico-card" onclick="selectService('telegram')">
            <i class="fab fa-telegram"></i>
            <h3>Telegram</h3>
            <div class="servico-preco">R$ 2,50</div>
            <small>1 SMS</small>
        </div>
    `;
}

function selectService(service) {
    currentService = service;
    document.querySelectorAll('.servico-card').forEach((card, i) => {
        card.classList.toggle('active', i === ['gmail','whatsapp','telegram'].indexOf(service));
    });
    loadNumeros();
}

function loadNumeros() {
    fetch('/api/numbers')
        .then(r => r.json())
        .then(nums => {
            document.getElementById('numeros').innerHTML = nums.map(n => `
                <div class="numero-card">
                    <div class="numero">${n.number}</div>
                    <button class="btn-comprar" onclick="comprar('${n.port}', '${currentService}')">
                        Comprar ${currentService.toUpperCase()} 
                        <small>R$ ${window.SERVICOS[currentService].preco.toFixed(2)}</small>
                    </button>
                </div>
            `).join('');
        });
}

function comprar(port, servico) {
    fetch(`/api/comprar/${port}/${servico}`)
        .then(r => r.json())
        .then(data => {
            if (data.ok) {
                alert(`✅ Compra OK!\n📱 ${data.numero}\n💰 R$ ${data.preco.toFixed(2)}\n\nAguarde SMS...`);
                loadNumeros();
            } else {
                alert('❌ ' + data.erro);
            }
        });
}

function verificarSMS(id) {
    fetch(`/api/sms/${id}`)
        .then(r => r.json())
        .then(data => {
            if (data.codigo && data.codigo !== 'Aguardando SMS...') {
                alert('✅ CÓDIGO: ' + data.codigo);
                location.reload();
            } else {
                alert('⏳ Ainda aguardando SMS...');
            }
        });
}

// Inicia
document.addEventListener('DOMContentLoaded', () => {
    loadServicos();
    loadNumeros();
    setInterval(loadNumeros, 5000);
});
