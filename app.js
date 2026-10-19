// Bancada do corretor, versão de demonstração: CRM e cotação, até 2 clientes reais por navegador.
// A pessoa cadastra cliente dela de verdade e sai com a cotação pronta: é isso que faz o produto parecer dela.
(function () {
  const LIMITE = 2;
  const CHAVE = "bancada-demo-v1";
  const CONTATO = ""; // link do WhatsApp de quem vende a versão completa, ex.: https://wa.me/5513999999999
  const CAMPOS = ["nome", "telefone", "cidade", "tipo", "status", "retorno", "origem", "temperatura", "notas", "prioridade", "uso", "planoHoje"];
  const ETAPAS = ["Prospecção", "Proposta enviada", "Negociando", "Fechou", "Perdeu"];
  const C = window.Cotacao;
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const hojeISO = () => new Date().toISOString().slice(0, 10);
  const EXEMPLOS = [
    { id: "ex1", exemplo: true, nome: "Dona Lúcia", cidade: "Santos", tipo: "senior", idades: [64], status: "Proposta enviada", temperatura: "Quente", retorno: hojeISO(), notas: "Plano subiu muito no reajuste. Quer hospital perto de casa." },
    { id: "ex2", exemplo: true, nome: "Rafael", cidade: "São Vicente", tipo: "pme", idades: [35, 33], status: "Negociando", temperatura: "Morno", notas: "Tem MEI. Pensando em ter filho." },
    { id: "ex3", exemplo: true, nome: "Família Souza", cidade: "Praia Grande", tipo: "adesao", idades: [42, 41, 17], status: "Prospecção", temperatura: "Frio", notas: "Perdeu o plano da empresa." },
  ];

  let estado = carregar();
  let aberto = null; // atendimento na gaveta
  let cotacaoAtual = null; // { o, c, a }

  function carregar() {
    try { return JSON.parse(localStorage.getItem(CHAVE)) || { contatos: [] }; } catch { return { contatos: [] }; }
  }
  function gravar() {
    try { localStorage.setItem(CHAVE, JSON.stringify(estado)); } catch { /* navegador sem armazenamento: segue só na tela */ }
  }
  const reais = () => estado.contatos;
  const mostrarExemplos = () => $("#verExemplos").checked;

  // MARK: tela

  function render() {
    const n = reais().length;
    $("#vagas").innerHTML = `<b>${n} de ${LIMITE}</b> clientes da demonstração`;
    $("#boasvindas").hidden = n > 0;
    const todos = [...reais(), ...(mostrarExemplos() ? EXEMPLOS : [])];

    const hoje = todos.filter((a) => a.retorno && a.retorno <= hojeISO() && a.status !== "Fechou" && a.status !== "Perdeu");
    $("#hoje").hidden = !hoje.length;
    $("#hoje").innerHTML = hoje.length ? `<h2>Retornos de hoje</h2><div class="linha">${hoje.map(cartao).join("")}</div>` : "";

    $("#funil").innerHTML = ETAPAS.map((e) => {
      const cs = todos.filter((a) => a.status === e);
      return `<div class="coluna"><div class="coluna-topo"><span>${e}</span><b>${cs.length}</b></div>${cs.map(cartao).join("") || '<p class="vazio">Nada aqui</p>'}</div>`;
    }).join("");
    document.querySelectorAll("[data-abrir]").forEach((el) => el.addEventListener("click", () => abrir(el.dataset.abrir)));
  }

  function cartao(a) {
    const vidas = a.idades.length === 1 ? `${a.idades[0]} anos` : `${a.idades.length} vidas`;
    const plano = a.plano ? `<div class="plano">${esc(a.plano.nome)}<b>${C.reais(a.plano.valor)}</b></div>` : "";
    return `<button class="card${a.exemplo ? " exemplo" : ""}" data-abrir="${a.id}">
      <div class="card-topo"><b>${esc(a.nome)}</b>${a.exemplo ? '<span class="tag">exemplo</span>' : a.temperatura ? `<span class="tag t-${a.temperatura.toLowerCase()}">${a.temperatura}</span>` : ""}</div>
      <span class="meta">${esc(a.cidade)} · ${C.TIPOS[a.tipo]} · ${vidas}</span>${plano}
    </button>`;
  }

  // MARK: gaveta

  function abrir(id) {
    const a = id ? [...reais(), ...EXEMPLOS].find((x) => x.id === id) : null;
    if (!a && reais().length >= LIMITE) return limite();
    aberto = a ? structuredClone(a) : { id: "c" + Date.now(), nome: "", telefone: "", cidade: "Santos", tipo: "adesao", idades: [45], status: "Prospecção", notas: "" };
    const f = $("#form");
    for (const k of CAMPOS) if (f[k]) f[k].value = aberto[k] || "";
    if (!aberto.status) f.status.value = "Prospecção";
    if (!aberto.prioridade) f.prioridade.value = "menor";
    $("#gavetaTitulo").textContent = a ? (a.exemplo ? `${a.nome} (exemplo)` : a.nome) : "Novo atendimento";
    $("#apagar").hidden = !a || a.exemplo;
    f.querySelector('[type="submit"]').hidden = !!(a && a.exemplo);
    desenharIdades();
    desenharOpcoes();
    mostrar("#gaveta");
    if (!a) f.nome.focus();
  }

  function desenharIdades() {
    $("#idades").innerHTML = aberto.idades.map((v, i) => `<span class="idade"><input type="number" min="0" max="110" value="${v}" data-i="${i}" aria-label="${i ? "Dependente" : "Titular"}"><small>${i ? "dependente" : "titular"}</small>${i ? `<button type="button" data-tirar="${i}" aria-label="Tirar">×</button>` : ""}</span>`).join("");
    document.querySelectorAll("#idades input").forEach((el) => el.addEventListener("input", () => {
      aberto.idades[+el.dataset.i] = Math.max(0, Math.min(110, parseInt(el.value || "0", 10)));
      desenharOpcoes();
    }));
    document.querySelectorAll("[data-tirar]").forEach((el) => el.addEventListener("click", () => {
      aberto.idades.splice(+el.dataset.tirar, 1); desenharIdades(); desenharOpcoes();
    }));
  }

  function lerForm() {
    const f = $("#form");
    for (const k of CAMPOS) aberto[k] = f[k].value.trim();
  }

  function desenharOpcoes() {
    lerForm();
    const os = C.opcoes(aberto.cidade, aberto.idades, aberto.tipo);
    const vidas = aberto.idades.length === 1 ? `${aberto.idades[0]} anos` : `${aberto.idades.length} vidas`;
    desenharIndicacao(os);
    $("#opcoesTitulo").textContent = os.length ? `Todas as opções: ${os.length} ${os.length === 1 ? "plano" : "planos"} pra ${vidas} em ${aberto.cidade}` : "Planos pra ele";
    $("#opcoes").innerHTML = os.length ? os.slice(0, 8).map((o, i) => {
      const escolhido = aberto.plano && aberto.plano.produtoId === o.produto.id;
      const extras = [o.produto.odonto, o.produto.coparticipacao].filter(Boolean).map((x) => `<span class="mini">${esc(x)}</span>`).join("");
      const ondeTxt = o.naCidade.length ? `${o.naCidade.length} ${o.naCidade.length === 1 ? "unidade" : "unidades"} em ${aberto.cidade}` : `Sem unidade em ${aberto.cidade}`;
      return `<div class="opcao${escolhido ? " escolhida" : ""}">
        <div class="opcao-txt"><span class="op">${esc(o.operadora.nome)}</span><b>${esc(C.semParenteses(o.produto.nome).split(",")[0])}</b>
          <span class="onde">${ondeTxt}</span><div class="minis">${extras}</div></div>
        <div class="opcao-preco"><small>a partir de</small><b>${C.reais(o.maisBarata.total)}</b>
          <button type="button" class="botao ${escolhido ? "leve" : "principal"} pequeno" data-cotar="${i}">${escolhido ? "Ver cotação" : "Montar cotação"}</button></div>
      </div>`;
    }).join("") : `<p class="vazio">Nenhum plano ${C.TIPOS[aberto.tipo]} da base aceita essas idades em ${esc(aberto.cidade)}. Troque o tipo de plano.</p>`;
    document.querySelectorAll("[data-cotar]").forEach((el) => el.addEventListener("click", () => cotar(os[+el.dataset.cotar])));
  }

  // MARK: indicação

  // Indicação pelo perfil, versão de demonstração: regra simples e pública (preço, rede na cidade, quarto,
  // coparticipação pra quem usa pouco). A ficha completa da Bancada não vem pra cá: este código vai inteiro pro
  // navegador de quem abre. Só o primeiro motivo aparece; os outros vão como barras, sem o texto.
  const temCopart = (o, c) => {
    const t = ((o.produto.coparticipacao || "") + " " + o.produto.nome + " " + c.condicao).toLowerCase();
    return !t.includes("sem coparticipação") && (t.includes("copart") || t.includes("coparticipação"));
  };
  const ehApto = (c) => /apartamento|executivo|apto/i.test(c.condicao);

  function indicar(os) {
    const itens = [];
    for (const o of os) for (const apto of [false, true]) {
      const c = o.cotacoes.filter((x) => ehApto(x) === apto)[0];
      if (c) itens.push({ o, c, copart: temCopart(o, c) });
    }
    if (!itens.length) return null;
    const quarto = aberto.prioridade === "quarto";
    let lista = itens.filter((i) => ehApto(i.c) === quarto);
    if (!lista.length) lista = itens;
    const sem = lista.filter((i) => !i.copart).sort((a, b) => a.c.total - b.c.total);
    let ind = sem[0] || lista.sort((a, b) => a.c.total - b.c.total)[0];
    let porque = "preco";
    if (aberto.prioridade === "hospital") {
      const perto = [...sem].sort((a, b) => b.o.naCidade.length - a.o.naCidade.length || a.c.total - b.c.total)[0];
      if (perto && perto.o.naCidade.length) { ind = perto; porque = "rede"; }
    }
    const copart = lista.filter((i) => i.copart).sort((a, b) => a.c.total - b.c.total)[0];
    if (aberto.uso === "pouco" && aberto.prioridade !== "hospital" && copart && copart.c.total <= ind.c.total * 0.9) { ind = copart; porque = "uso"; }
    const vidas = aberto.idades.length === 1 ? `Pra ${aberto.idades[0]} anos em ${aberto.cidade}` : `Pra essas idades em ${aberto.cidade}`;
    const primeiro = {
      preco: `${vidas}, é o plano ${quarto ? "com quarto só dele" : "sem coparticipação"} mais em conta que você trabalha.`,
      rede: `Tem ${ind.o.naCidade.length} ${ind.o.naCidade.length === 1 ? "unidade" : "unidades"} da ${ind.o.operadora.nome} em ${aberto.cidade}, a rede mais perto dele.`,
      uso: `Como ele usa pouco, a coparticipação compensa: a mensalidade fica ${C.reais(sem[0] ? sem[0].c.total - ind.c.total : 0)} menor.`,
    }[porque];
    // Quantos motivos a versão completa daria pra esse caso (só a contagem vai pra tela).
    let trancados = 2;
    if (aberto.planoHoje === "mais6") trancados++;
    if (aberto.prioridade === "logo") trancados++;
    if (aberto.idades.length > 1) trancados++;
    return { ind, primeiro, trancados, reserva: sem.find((i) => i.o !== ind.o) };
  }

  function desenharIndicacao(os) {
    const r = indicar(os);
    if (!r) { $("#indicacao").innerHTML = ""; return; }
    const { ind, primeiro, trancados } = r;
    const barras = Array.from({ length: trancados }, (_, i) => `<li class="trancado"><span style="width:${[88, 72, 94, 64, 80][i % 5]}%"></span></li>`).join("");
    $("#indicacao").innerHTML = `<div class="indicacao">
      <p class="kicker">Indicado pro perfil dele</p>
      <div class="ind-topo"><div><span class="op">${esc(ind.o.operadora.nome)}</span><b>${esc(C.semParenteses(ind.o.produto.nome).split(",")[0])}</b>
        <span class="cond">${esc(C.titulo(ind.c.condicao, ind.o.produto.nome))}</span></div>
        <div class="ind-preco"><b>${C.reais(ind.c.total)}</b><small>${aberto.idades.length > 1 ? "total por mês" : "por mês"}</small></div></div>
      <p class="ind-fala">Pra falar na ligação:</p>
      <ul class="motivos"><li>${esc(primeiro)}</li>${barras}</ul>
      <p class="cadeado">🔒 Mais ${trancados} motivos prontos pra falar, as perguntas da ligação e o plano reserva ficam na versão completa.</p>
      <button type="button" class="botao principal" id="cotarIndicado">Montar cotação deste</button>
    </div>`;
    $("#cotarIndicado").addEventListener("click", () => cotar(ind.o, ind.c));
  }

  // MARK: cotação

  function cotar(o, condicao) {
    lerForm();
    if (!aberto.nome) { $("#form").nome.focus(); $("#form").nome.reportValidity(); return; }
    const c = condicao || (aberto.plano && aberto.plano.produtoId === o.produto.id && o.cotacoes.find((x) => x.condicao === aberto.plano.condicao)) || o.maisBarata;
    cotacaoAtual = { o, c, a: aberto };
    $("#condicoes").innerHTML = o.cotacoes.length > 1 ? `<span class="rotulo">Indicação</span>` + o.cotacoes.map((x, i) =>
      `<button class="chip${x === c ? " on" : ""}" data-cond="${i}">${esc(C.titulo(x.condicao, o.produto.nome))}</button>`).join("") : "";
    document.querySelectorAll("[data-cond]").forEach((el) => el.addEventListener("click", () => {
      cotacaoAtual.c = o.cotacoes[+el.dataset.cond];
      document.querySelectorAll("[data-cond]").forEach((b) => b.classList.toggle("on", b === el));
      previa();
    }));
    $("#compartilhar").hidden = !(navigator.canShare && navigator.share);
    $("#avisoCotacao").textContent = "";
    mostrar("#modalCotacao");
    previa();
  }

  function previa() {
    const { o, c, a } = cotacaoAtual;
    const caixa = $("#previa");
    caixa.innerHTML = `<div class="escala">${C.html(o, c, a)}</div>`;
    const ajustar = () => {
      const art = caixa.querySelector(".cot");
      const s = Math.min(1, caixa.clientWidth / 1080);
      const e = caixa.querySelector(".escala");
      e.style.transform = `scale(${s})`;
      e.style.height = art.offsetHeight * s + "px";
      e.style.width = 1080 * s + "px";
    };
    requestAnimationFrame(ajustar);
    document.fonts.ready.then(ajustar);
    // Escolher a cotação já marca o plano no atendimento: é ele que aparece no cartão do funil.
    aberto.plano = { produtoId: o.produto.id, nome: `${o.operadora.nome} · ${C.semParenteses(o.produto.nome).split(",")[0]}`, condicao: c.condicao, valor: c.total };
  }

  async function png() {
    const art = $("#previa .cot");
    await document.fonts.ready;
    return htmlToImage.toBlob(art, { pixelRatio: 2, cacheBust: true, width: 1080, style: { transform: "none" } });
  }
  const arquivo = () => `Cotação ${cotacaoAtual.o.operadora.nome} para ${(cotacaoAtual.a.nome.split(/\s+/)[0] || "cliente")}.png`;

  $("#baixar").addEventListener("click", async () => {
    $("#avisoCotacao").textContent = "Gerando a imagem…";
    try {
      const b = await png();
      const u = URL.createObjectURL(b);
      const l = Object.assign(document.createElement("a"), { href: u, download: arquivo() });
      l.click();
      setTimeout(() => URL.revokeObjectURL(u), 4000);
      $("#avisoCotacao").textContent = "Imagem salva. É só mandar no WhatsApp.";
      salvarAberto();
    } catch (e) { $("#avisoCotacao").textContent = "Não consegui gerar a imagem neste navegador."; }
  });
  $("#compartilhar").addEventListener("click", async () => {
    try {
      const f = new File([await png()], arquivo(), { type: "image/png" });
      if (navigator.canShare({ files: [f] })) await navigator.share({ files: [f], title: arquivo() });
      salvarAberto();
    } catch { /* cancelou o compartilhamento */ }
  });

  // MARK: salvar, apagar, limite

  function salvarAberto() {
    if (aberto.exemplo) return;
    lerForm();
    if (!aberto.nome) return;
    const i = reais().findIndex((x) => x.id === aberto.id);
    if (i >= 0) reais()[i] = aberto;
    else if (reais().length < LIMITE) reais().push(aberto);
    else return limite();
    gravar(); render();
  }

  $("#form").addEventListener("submit", (e) => { e.preventDefault(); salvarAberto(); esconderTudo(); });
  $("#form").addEventListener("change", (e) => { if (["cidade", "tipo", "prioridade", "uso", "planoHoje"].includes(e.target.name)) desenharOpcoes(); });
  $("#maisIdade").addEventListener("click", () => { aberto.idades.push(aberto.idades.length === 1 ? aberto.idades[0] : 10); desenharIdades(); desenharOpcoes(); });
  $("#apagar").addEventListener("click", () => {
    estado.contatos = reais().filter((x) => x.id !== aberto.id);
    gravar(); esconderTudo(); render();
  });

  function limite() {
    const nomes = reais().map((x) => x.nome);
    $("#limiteTexto").textContent = `${C.lista(nomes)} ${nomes.length > 1 ? "ficam salvos" : "fica salvo"} neste navegador, com a cotação pronta.`;
    const contato = $("#contato");
    if (CONTATO) { contato.href = CONTATO; contato.hidden = false; } else contato.hidden = true;
    mostrar("#modalLimite");
  }

  // MARK: janelas

  function mostrar(sel) { $("#fundo").hidden = false; $(sel).hidden = false; }
  function esconderTudo() { ["#fundo", "#gaveta", "#modalCotacao", "#modalLimite"].forEach((s) => ($(s).hidden = true)); }
  function fecharTopo() {
    if (!$("#modalCotacao").hidden) { $("#modalCotacao").hidden = true; desenharOpcoes(); return; }
    if (!$("#modalLimite").hidden) { $("#modalLimite").hidden = true; if ($("#gaveta").hidden) $("#fundo").hidden = true; return; }
    esconderTudo();
  }
  document.querySelectorAll("[data-fechar]").forEach((b) => b.addEventListener("click", fecharTopo));
  $("#fundo").addEventListener("click", fecharTopo);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") fecharTopo(); });

  $("#novo").addEventListener("click", () => abrir(null));
  $("#comecar").addEventListener("click", () => abrir(null));
  $("#verExemplos").addEventListener("change", render);
  $("#cidade").innerHTML = window.PLANOS.cidades.map((c) => `<option>${c}</option>`).join("");

  render();
})();
