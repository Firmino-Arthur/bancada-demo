// Bancada do corretor, versão da corretora: CRM, cotação em imagem e indicação simples pelo perfil.
// Os clientes ficam num arquivo (clientes.json) numa pasta do computador dela; o Claude Code dela trabalha na mesma
// pasta, lê e edita esse arquivo, e a tela recarrega sozinha quando ele muda.
(function () {
  const CAMPOS = ["nome", "telefone", "cidade", "tipo", "status", "retorno", "origem", "temperatura", "notas", "prioridade", "uso", "planoHoje"];
  const ETAPAS = ["Prospecção", "Proposta enviada", "Negociando", "Fechou", "Perdeu"];
  const C = window.Cotacao;
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const hojeISO = () => new Date().toISOString().slice(0, 10);

  let estado = { versao: 1, atendimentos: [] };
  let pasta = null; // a pasta escolhida (File System Access)
  let ultimo = 0; // lastModified do clientes.json que está na tela
  let aberto = null;
  let cotacaoAtual = null;

  // MARK: pasta e arquivos

  const banco = () => new Promise((ok, erro) => {
    const r = indexedDB.open("bancada", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("kv");
    r.onsuccess = () => ok(r.result);
    r.onerror = () => erro(r.error);
  });
  async function guardarPasta(h) {
    const db = await banco();
    await new Promise((ok) => { const t = db.transaction("kv", "readwrite"); t.objectStore("kv").put(h, "pasta"); t.oncomplete = ok; });
  }
  async function pastaGuardada() {
    try {
      const db = await banco();
      return await new Promise((ok) => { const r = db.transaction("kv").objectStore("kv").get("pasta"); r.onsuccess = () => ok(r.result || null); r.onerror = () => ok(null); });
    } catch { return null; }
  }

  async function escrever(nome, texto) {
    const fh = await pasta.getFileHandle(nome, { create: true });
    const w = await fh.createWritable();
    await w.write(texto);
    await w.close();
  }

  async function conectar(h) {
    pasta = h;
    $("#boasvindas").hidden = true;
    $("#reabrir").hidden = true;
    await guardarPasta(h);
    // Arquivos de apoio: sempre na versão mais nova do app.
    await escrever("planos.json", JSON.stringify(window.PLANOS, null, 1));
    await escrever("CLAUDE.md", window.INSTRUCOES_CLAUDE);
    await escrever("abrir o Claude.bat", "@echo off\r\ncd /d \"%~dp0\"\r\nclaude\r\npause\r\n");
    try { await pasta.getFileHandle("clientes.json"); }
    catch { await escrever("clientes.json", JSON.stringify(estado, null, 2)); }
    await ler();
    setInterval(vigiar, 2000);
    render();
  }

  async function ler() {
    const f = await (await pasta.getFileHandle("clientes.json")).getFile();
    ultimo = f.lastModified;
    try {
      const d = JSON.parse(await f.text());
      estado = { versao: 1, atendimentos: Array.isArray(d.atendimentos) ? d.atendimentos : [] };
      avisoPasta("");
    } catch {
      avisoPasta("O arquivo clientes.json ficou com erro. Peça pro Claude: \"arruma o clientes.json\".");
    }
  }

  async function gravar() {
    await escrever("clientes.json", JSON.stringify(estado, null, 2));
    ultimo = (await (await pasta.getFileHandle("clientes.json")).getFile()).lastModified;
  }

  // O Claude mexeu no arquivo: recarrega e mostra. Gaveta aberta continua como está.
  async function vigiar() {
    try {
      const f = await (await pasta.getFileHandle("clientes.json")).getFile();
      if (f.lastModified === ultimo) return;
      await ler();
      render();
      $("#funil").classList.remove("sincronizou"); void $("#funil").offsetWidth; $("#funil").classList.add("sincronizou");
    } catch { /* pasta indisponível por um instante */ }
  }

  function avisoPasta(txt) {
    const b = $("#pasta");
    b.classList.toggle("alerta", !!txt);
    b.innerHTML = txt ? esc(txt) : pasta ? `Pasta <b>${esc(pasta.name)}</b> · ${estado.atendimentos.length} clientes` : "Sem pasta";
  }

  // MARK: tela

  function render() {
    const conectado = !!pasta;
    $("#claude").hidden = !conectado;
    $("#novo").hidden = !conectado;
    if (!conectado) return;
    avisoPasta($("#pasta").classList.contains("alerta") ? $("#pasta").textContent : "");
    const q = ($("#busca").value || "").toLowerCase();
    const todos = estado.atendimentos.filter((a) => !q || [a.nome, a.cidade, a.notas, a.telefone].join(" ").toLowerCase().includes(q));
    const hoje = todos.filter((a) => a.retorno && a.retorno <= hojeISO() && a.status !== "Fechou" && a.status !== "Perdeu");
    $("#hoje").hidden = !hoje.length;
    $("#hoje").innerHTML = hoje.length ? `<h2>Retornos de hoje</h2><div class="linha">${hoje.map(cartao).join("")}</div>` : "";
    $("#funil").innerHTML = ETAPAS.map((e) => {
      const cs = todos.filter((a) => (a.status || "Prospecção") === e);
      return `<div class="coluna"><div class="coluna-topo"><span>${e}</span><b>${cs.length}</b></div>${cs.map(cartao).join("") || '<p class="vazio">Nada aqui</p>'}</div>`;
    }).join("");
    document.querySelectorAll("[data-abrir]").forEach((el) => el.addEventListener("click", () => abrir(el.dataset.abrir)));
  }

  function cartao(a) {
    const idades = a.idades && a.idades.length ? a.idades : [];
    const vidas = idades.length === 1 ? `${idades[0]} anos` : idades.length ? `${idades.length} vidas` : "idade a saber";
    const plano = a.plano ? `<div class="plano">${esc(a.plano.nome)}<b>${a.plano.valor ? C.reais(a.plano.valor) : ""}</b></div>` : "";
    const temp = a.temperatura ? `<span class="tag t-${String(a.temperatura).toLowerCase()}">${esc(a.temperatura)}</span>` : "";
    return `<button class="card" data-abrir="${esc(a.id)}">
      <div class="card-topo"><b>${esc(a.nome)}</b>${temp}</div>
      <span class="meta">${esc(a.cidade || "cidade a saber")} · ${C.TIPOS[a.tipo] || "tipo a saber"} · ${vidas}</span>${plano}
    </button>`;
  }

  // MARK: gaveta

  function abrir(id) {
    const a = id ? estado.atendimentos.find((x) => x.id === id) : null;
    aberto = a ? structuredClone(a) : { id: "c" + Date.now(), nome: "", telefone: "", cidade: "Santos", tipo: "adesao", idades: [45], status: "Prospecção", notas: "", criadoEm: new Date().toISOString() };
    if (!aberto.idades || !aberto.idades.length) aberto.idades = [45];
    const f = $("#form");
    for (const k of CAMPOS) if (f[k]) f[k].value = aberto[k] || "";
    if (!aberto.status) f.status.value = "Prospecção";
    if (!aberto.prioridade) f.prioridade.value = "menor";
    if (!aberto.tipo) f.tipo.value = "adesao";
    if (!aberto.cidade) f.cidade.value = "Santos";
    $("#gavetaTitulo").textContent = a ? a.nome : "Novo atendimento";
    $("#apagar").hidden = !a;
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
    desenharIndicacao(os);
    const vidas = aberto.idades.length === 1 ? `${aberto.idades[0]} anos` : `${aberto.idades.length} vidas`;
    $("#opcoesTitulo").textContent = os.length ? `Todas as opções: ${os.length} ${os.length === 1 ? "plano" : "planos"} pra ${vidas} em ${aberto.cidade}` : "Planos pra ele";
    $("#opcoes").innerHTML = os.length ? os.slice(0, 10).map((o, i) => {
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

  // MARK: indicação simples (preço, rede na cidade, quarto, coparticipação pra quem usa pouco)

  const temCopart = (o, c) => {
    const t = ((o.produto.coparticipacao || "") + " " + o.produto.nome + " " + c.condicao).toLowerCase();
    return !t.includes("sem coparticipação") && (t.includes("copart") || t.includes("coparticipação"));
  };
  const ehApto = (c) => /apartamento|executivo|apto/i.test(c.condicao);
  const nomeProduto = (o) => C.semParenteses(o.produto.nome).split(",")[0];

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
    let ind = sem[0] || [...lista].sort((a, b) => a.c.total - b.c.total)[0];
    let porque = "preco";
    if (aberto.prioridade === "hospital") {
      const perto = [...sem].sort((a, b) => b.o.naCidade.length - a.o.naCidade.length || a.c.total - b.c.total)[0];
      if (perto && perto.o.naCidade.length) { ind = perto; porque = "rede"; }
    }
    const copart = lista.filter((i) => i.copart).sort((a, b) => a.c.total - b.c.total)[0];
    if (aberto.uso === "pouco" && aberto.prioridade !== "hospital" && copart && copart.c.total <= ind.c.total * 0.9) { ind = copart; porque = "uso"; }
    const vidas = aberto.idades.length === 1 ? `Pra ${aberto.idades[0]} anos em ${aberto.cidade}` : `Pra essas idades em ${aberto.cidade}`;
    const motivos = [{
      preco: `${vidas}, é o plano ${quarto ? "com quarto só dele" : "sem coparticipação"} mais em conta que você trabalha.`,
      rede: `Tem ${ind.o.naCidade.length} ${ind.o.naCidade.length === 1 ? "unidade" : "unidades"} da ${ind.o.operadora.nome} em ${aberto.cidade}, a rede mais perto dele.`,
      uso: `Como ele usa pouco, a coparticipação compensa: a mensalidade fica ${C.reais(sem[0] ? sem[0].c.total - ind.c.total : 0)} menor.`,
    }[porque]];
    const reserva = sem.find((i) => i.o !== ind.o && i.c.total > ind.c.total);
    if (reserva) motivos.push(`Fica ${C.reais(reserva.c.total - ind.c.total)} por mês mais barato que o ${nomeProduto(reserva.o)} da ${reserva.o.operadora.nome}.`);
    if (porque !== "rede" && ind.o.naCidade.length) {
      const nomes = ind.o.naCidade.slice(0, 2).map((u) => (u.nomeCotacao || u.nome).split(",")[0]);
      motivos.push(`Atende em ${aberto.cidade}: ${C.lista(nomes)}.`);
    }
    const p = ind.o.produto;
    if (p.odonto) motivos.push(`${p.odonto}.`);
    return { ind, motivos, reserva };
  }

  function desenharIndicacao(os) {
    const r = indicar(os);
    if (!r) { $("#indicacao").innerHTML = ""; return; }
    const { ind, motivos, reserva } = r;
    $("#indicacao").innerHTML = `<div class="indicacao">
      <p class="kicker">Indicado pro perfil dele</p>
      <div class="ind-topo"><div><span class="op">${esc(ind.o.operadora.nome)}</span><b>${esc(nomeProduto(ind.o))}</b>
        <span class="cond">${esc(C.titulo(ind.c.condicao, ind.o.produto.nome))}</span></div>
        <div class="ind-preco"><b>${C.reais(ind.c.total)}</b><small>${aberto.idades.length > 1 ? "total por mês" : "por mês"}</small></div></div>
      <p class="ind-fala">Pra falar na ligação:</p>
      <ul class="motivos">${motivos.map((m) => `<li>${esc(m)}</li>`).join("")}</ul>
      ${reserva ? `<p class="cadeado">Reserva: ${esc(reserva.o.operadora.nome)}, ${esc(nomeProduto(reserva.o))}, ${C.reais(reserva.c.total)}</p>` : ""}
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
    aberto.plano = { produtoId: o.produto.id, nome: `${o.operadora.nome} · ${nomeProduto(o)}`, condicao: c.condicao, valor: c.total };
  }

  async function png() {
    await document.fonts.ready;
    return htmlToImage.toBlob($("#previa .cot"), { pixelRatio: 2, cacheBust: true, width: 1080, style: { transform: "none" } });
  }
  const arquivo = () => `Cotação ${cotacaoAtual.o.operadora.nome} para ${(cotacaoAtual.a.nome.split(/\s+/)[0] || "cliente")}.png`;

  $("#baixar").addEventListener("click", async () => {
    $("#avisoCotacao").textContent = "Gerando a imagem…";
    try {
      const b = await png();
      // Com a pasta liberada, a imagem também fica numa subpasta cotacoes, pro Claude achar depois.
      try {
        const sub = await pasta.getDirectoryHandle("cotacoes", { create: true });
        const w = await (await sub.getFileHandle(arquivo(), { create: true })).createWritable();
        await w.write(b); await w.close();
      } catch { /* sem pasta: só o download */ }
      const u = URL.createObjectURL(b);
      Object.assign(document.createElement("a"), { href: u, download: arquivo() }).click();
      setTimeout(() => URL.revokeObjectURL(u), 4000);
      $("#avisoCotacao").textContent = "Imagem salva. É só mandar no WhatsApp.";
      await salvarAberto();
    } catch { $("#avisoCotacao").textContent = "Não consegui gerar a imagem neste navegador."; }
  });
  $("#compartilhar").addEventListener("click", async () => {
    try {
      const f = new File([await png()], arquivo(), { type: "image/png" });
      if (navigator.canShare({ files: [f] })) await navigator.share({ files: [f], title: arquivo() });
      await salvarAberto();
    } catch { /* cancelou */ }
  });

  // MARK: salvar e apagar

  async function salvarAberto() {
    lerForm();
    if (!aberto.nome) return;
    aberto.atualizadoEm = new Date().toISOString();
    const i = estado.atendimentos.findIndex((x) => x.id === aberto.id);
    if (i >= 0) estado.atendimentos[i] = aberto; else estado.atendimentos.push(aberto);
    await gravar(); render();
  }

  $("#form").addEventListener("submit", async (e) => { e.preventDefault(); await salvarAberto(); esconderTudo(); });
  $("#form").addEventListener("change", (e) => { if (["cidade", "tipo", "prioridade", "uso", "planoHoje"].includes(e.target.name)) desenharOpcoes(); });
  $("#maisIdade").addEventListener("click", () => { aberto.idades.push(aberto.idades.length === 1 ? aberto.idades[0] : 10); desenharIdades(); desenharOpcoes(); });
  $("#apagar").addEventListener("click", async () => {
    if (!window.confirm(`Apagar ${aberto.nome}?`)) return;
    estado.atendimentos = estado.atendimentos.filter((x) => x.id !== aberto.id);
    await gravar(); esconderTudo(); render();
  });

  // MARK: janelas

  function mostrar(sel) { $("#fundo").hidden = false; $(sel).hidden = false; }
  function esconderTudo() { ["#fundo", "#gaveta", "#modalCotacao"].forEach((s) => ($(s).hidden = true)); }
  function fecharTopo() {
    if (!$("#modalCotacao").hidden) { $("#modalCotacao").hidden = true; desenharOpcoes(); return; }
    esconderTudo();
  }
  document.querySelectorAll("[data-fechar]").forEach((b) => b.addEventListener("click", fecharTopo));
  $("#fundo").addEventListener("click", fecharTopo);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") fecharTopo(); });
  $("#novo").addEventListener("click", () => abrir(null));
  $("#busca").addEventListener("input", render);
  $("#cidade").innerHTML = window.PLANOS.cidades.map((c) => `<option>${c}</option>`).join("");

  // MARK: começo

  async function comecar() {
    if (!window.showDirectoryPicker) { $("#boasvindas").hidden = false; $("#escolherPasta").hidden = true; $("#semSuporte").hidden = false; return; }
    $("#escolherPasta").addEventListener("click", async () => {
      try { const h = await window.showDirectoryPicker({ id: "bancada", mode: "readwrite", startIn: "documents" }); $("#boasvindas").hidden = true; await conectar(h); }
      catch { /* cancelou */ }
    });
    $("#pasta").addEventListener("click", async () => {
      try { const h = await window.showDirectoryPicker({ id: "bancada", mode: "readwrite", startIn: "documents" }); await conectar(h); } catch { /* cancelou */ }
    });
    const h = await pastaGuardada();
    if (!h) { $("#boasvindas").hidden = false; avisoPasta(""); return; }
    if ((await h.queryPermission({ mode: "readwrite" })) === "granted") return conectar(h);
    $("#reabrir").hidden = false;
    $("#liberarPasta").addEventListener("click", async () => {
      if ((await h.requestPermission({ mode: "readwrite" })) === "granted") { $("#reabrir").hidden = true; await conectar(h); }
    });
  }
  // Teste automático: com #teste, expõe a conexão pra usar uma pasta de teste do navegador.
  if (location.hash === "#teste") window.__teste = { conectar, estado: () => estado, vigiar };
  render();
  comecar();
})();
