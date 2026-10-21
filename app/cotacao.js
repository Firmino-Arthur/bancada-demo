// Cotação: as mesmas regras da Bancada (Vendas.swift e CotacaoHTML.swift), em JavaScript.
// Uma condição só por imagem: o corretor indica, o cliente não recebe tabela pra escolher.
(function () {
  const P = window.PLANOS;

  const VIZINHAS = {
    "Santos": ["São Vicente", "Guarujá", "Cubatão"],
    "São Vicente": ["Santos", "Praia Grande", "Cubatão"],
    "Guarujá": ["Santos", "Bertioga"],
    "Praia Grande": ["São Vicente", "Mongaguá", "Santos"],
    "Cubatão": ["Santos", "São Vicente"],
    "Bertioga": ["Guarujá", "Santos"],
    "Mongaguá": ["Praia Grande", "Itanhaém"],
    "Itanhaém": ["Mongaguá", "Peruíbe", "Praia Grande"],
    "Peruíbe": ["Itanhaém", "Mongaguá"],
  };
  const TIPOS = { senior: "Sênior", adesao: "Adesão", pme: "PME (CNPJ)", individual: "Individual", odonto: "Odonto" };
  const TEMAS = {
    trasmontano: { f1: "#EE3B41", f2: "#B9151C", cor: "#E11F27", esc: "#B9151C", claro: "#FDEDEE", dest: "#FFD84D", fonte: "Poppins", logo: "logo-trasmontano.png" },
    santa_saude: { f1: "#2B47C9", f2: "#192D91", cor: "#192D91", esc: "#192D91", claro: "#EAF1FC", dest: "#6FD0FF", fonte: "Montserrat", logo: "logo-santa-saude.png" },
    bluemed: { f1: "#4C7BD0", f2: "#0F1958", cor: "#2F55C0", esc: "#1F2957", claro: "#E6F0FB", dest: "#7FC5FB", fonte: "Poppins", logo: "bluemed-logo-branco.png", solto: true },
  };
  const PADRAO = { f1: "#3A4150", f2: "#171A22", cor: "#2B3140", esc: "#2B3140", claro: "#EEF0F4", dest: "#9FD0FF", fonte: "Poppins" };
  const LOGOS_LAB = { cellula: "cellula-mater.png", imuvi: "imuvi.png", menzen: "menzen.png", ruiz: "ruiz.png" };

  const reais = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }).replace(/ /g, " ");
  const lista = (xs) => (xs.length < 2 ? xs.join("") : xs.slice(0, -1).join(", ") + " e " + xs[xs.length - 1]);
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const semParenteses = (s) => s.replace(/\s*\([^)]*\)/g, "").trim();
  const rotulo = (cond) => semParenteses(cond.split(",")[0]);
  const resto = (cond) => {
    const i = cond.indexOf(",");
    return i < 0 ? "" : cond.slice(i + 1).split(/[,;]/).map((p) => p.trim()).filter(Boolean).join(", ");
  };
  const nomeCurtoOp = (o) => o.nome;

  // Tabela por porte ("2 a 29 vidas", "1 vida") só vale pra essa quantidade de vidas.
  function cabe(vidas, cond) {
    if (!cond) return true;
    const r = cond.match(/(\d+) a (\d+) (vidas|pessoas)/);
    if (r) return +r[1] <= vidas && vidas <= +r[2];
    const u = cond.match(/\b(\d+) vida\b/);
    if (u) return vidas === +u[1];
    return true;
  }

  function opcoes(cidade, idades, tipo) {
    if (!idades.length) return [];
    const out = [];
    for (const op of P.operadoras) {
      for (const p of op.produtos) {
        if (p.tipo !== tipo) continue;
        const exigidas = p.tipo === "senior" ? idades : idades.slice(0, 1);
        if (p.idadeMin != null && exigidas.some((a) => a < p.idadeMin)) continue;
        if (p.idadeMax != null && idades.some((a) => a > p.idadeMax)) continue;
        const comValor = p.precos.filter((x) => cabe(idades.length, x.condicao));
        const conds = [...new Set(comValor.map((x) => x.condicao))];
        const cotacoes = conds.map((c) => {
          const linhas = idades.map((idade) => {
            const pr = comValor.find((x) => x.condicao === c && (x.idadeMin ?? 0) <= idade && idade <= (x.idadeMax ?? 200));
            return { idade, faixa: pr ? pr.faixa : null, valor: pr ? pr.valor : null };
          });
          const completa = linhas.every((l) => l.valor != null);
          return { condicao: c, linhas, completa, total: completa ? linhas.reduce((s, l) => s + l.valor, 0) : null };
        }).filter((c) => c.completa).sort((a, b) => a.total - b.total);
        if (!cotacoes.length) continue;
        const naCidade = (op.rede.find((r) => r.cidade === cidade) || { unidades: [] }).unidades.filter((u) => !u.so || u.so.includes(p.id));
        out.push({ operadora: op, produto: p, cotacoes, naCidade, maisBarata: cotacoes[0] });
      }
    }
    return out.sort((a, b) => (a.naCidade.length ? 0 : 1) - (b.naCidade.length ? 0 : 1) || a.maisBarata.total - b.maisBarata.total);
  }

  // Onde atende: a cidade da pessoa primeiro, depois as vizinhas; fora da abrangência do produto, não entra.
  function rede(o, cidade) {
    const p = o.produto;
    const r = o.operadora.rede.map((x) => {
      if (p.abrangencia && !p.abrangencia.toLowerCase().includes(x.cidade.toLowerCase())) return null;
      const us = x.unidades.filter((u) => u.cotacao && (!u.so || u.so.includes(p.id)));
      return us.length ? { cidade: x.cidade, unidades: us } : null;
    }).filter(Boolean);
    const ordem = [cidade, ...(VIZINHAS[cidade] || [])];
    const pos = (c) => (ordem.indexOf(c) < 0 ? 99 : ordem.indexOf(c));
    return r.sort((a, b) => pos(a.cidade) - pos(b.cidade));
  }
  const ordemTipo = (u) => ({ hospital: 0, "pronto atendimento": 1, "centro médico": 2 })[u.tipo] ?? 3;
  function daCidade(us) {
    const p = us.filter((u) => u.tipo !== "clínica");
    const semDia = p.filter((u) => u.cotacao !== "Hospital dia");
    return (semDia.length ? semDia : p).sort((a, b) => ordemTipo(a) - ordemTipo(b)).slice(0, 4);
  }
  function deVizinha(us) {
    const h = us.filter((u) => u.tipo === "hospital" || u.tipo === "pronto atendimento");
    const semDia = h.filter((u) => u.cotacao !== "Hospital dia");
    return (semDia.length ? semDia : h).slice(0, 4);
  }
  const nomeCliente = (u) => (u.nomeCotacao || u.nome).replace(/ \/ /g, ", ").replace(/\//g, " e ");
  function nomeEEndereco(u) {
    const n = nomeCliente(u);
    const m = n.match(/,\s*(Av\.|Avenida|R\.|Rua|Praça)\s/);
    return m ? { nome: n.slice(0, m.index), endereco: n.slice(m.index + 1).trim() } : { nome: n, endereco: null };
  }
  function nomeCurto(u, cidade) {
    let n = nomeEEndereco(u).nome;
    if (n.startsWith("Hospital ")) n = n.slice(9);
    if (n.endsWith(" " + cidade) && !n.endsWith(" de " + cidade) && !n.endsWith(" do " + cidade)) n = n.slice(0, -(cidade.length + 1));
    return n;
  }
  function laboratorios(todos, cond) {
    return (todos || []).map((l) => {
      const m = l.match(/\s*\(só ([^)]+)\)/);
      if (!m) return l;
      return cond.toLowerCase().includes(m[1].toLowerCase()) ? l.slice(0, m.index) : null;
    }).filter(Boolean);
  }
  // Título curto da condição: tira o que é igual ao nome do produto.
  function titulo(cond, produto) {
    const r = rotulo(cond).split(" ");
    let comum = semParenteses(produto).split(" ");
    let n = 0;
    while (n < Math.min(comum.length, r.length) && comum[n].toLowerCase() === r[n].toLowerCase()) n++;
    const corte = r.length - n <= 1 ? Math.max(0, n - 1) : n;
    const curto = r.slice(corte).join(" ");
    return curto ? curto[0].toUpperCase() + curto.slice(1) : r.join(" ");
  }

  function valor(v) {
    const s = reais(v).replace("R$", "").trim();
    const [int, cent] = s.split(",");
    return `<span class="rs">R$</span><span class="int">${int}</span><span class="cent">,${cent || "00"}</span>`;
  }

  // A imagem: 1080 px de largura, a identidade da operadora, a rede pela cidade da pessoa.
  function html(o, c, a) {
    const t = TEMAS[o.operadora.id] || PADRAO;
    const p = o.produto;
    const primeiro = (a.nome || "").trim().split(/\s+/)[0] || "";
    const vidas = c.linhas.length === 1 ? "1 vida" : `${c.linhas.length} vidas`;
    const labs = laboratorios(p.laboratorios, c.condicao);
    const pin = '<svg viewBox="0 0 24 30"><path d="M12 0C5.4 0 0 5.2 0 11.7 0 20.4 12 30 12 30s12-9.6 12-18.3C24 5.2 18.6 0 12 0zm0 16.5a4.8 4.8 0 1 1 0-9.6 4.8 4.8 0 0 1 0 9.6z" fill="currentColor"/></svg>';
    const check = '<svg viewBox="0 0 24 24"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" fill="currentColor"/></svg>';
    const logo = t.logo
      ? `<div class="logo${t.solto ? " solto" : ""}"><img src="cotacao/logos/operadoras/${t.logo}" alt=""></div>`
      : `<div class="logo"><span class="nomeop">${esc(nomeCurtoOp(o.operadora))}</span></div>`;
    const corpo = c.linhas.map((l) => `<div class="l"><span class="faixa"><b>${esc(l.faixa || l.idade)}</b> anos</span><span class="col v">${valor(l.valor)}</span></div>`).join("");
    const chips = [p.cobertura, p.odonto, p.coparticipacao].filter(Boolean).map((x) => `<span class="chip">${check}${esc(x)}</span>`).join("");

    const r = rede(o, a.cidade);
    const aqui = r.find((x) => x.cidade === a.cidade);
    let ondeHTML = "";
    if (aqui) {
      const us = daCidade(aqui.unidades);
      const itens = us.length ? us.map((u) => { const e = nomeEEndereco(u); return e.endereco ? `${e.nome}, ${e.endereco}` : e.nome; })
        : aqui.unidades.filter((u) => u.tipo === "clínica").slice(0, 3).map(nomeCliente);
      ondeHTML += `<div class="aqui"><div class="cid">${pin}Atende em ${esc(aqui.cidade)}</div><p class="us">${itens.map(esc).join(" <i>·</i> ")}</p></div>`;
    }
    r.filter((x) => x.cidade !== a.cidade).map((x) => ({ cidade: x.cidade, us: deVizinha(x.unidades) })).filter((x) => x.us.length).slice(0, 3)
      .forEach((x) => { ondeHTML += `<p class="viz"><b>${esc(x.cidade)}:</b> ${esc(lista(x.us.map((u) => nomeCurto(u, x.cidade))))}</p>`; });
    if (ondeHTML) ondeHTML = `<div class="onde">${ondeHTML}</div>`;
    const abr = !ondeHTML && p.abrangencia ? `<p class="abr"><b>Abrangência:</b> ${esc(p.abrangencia)}</p>` : "";
    const labsHTML = labs.length ? `<div class="labs"><span class="rot">Principais laboratórios</span><div class="logos">${labs.map((l) => {
      const k = Object.keys(LOGOS_LAB).find((x) => l.toLowerCase().includes(x));
      return k ? `<img src="cotacao/logos/laboratorios/${LOGOS_LAB[k]}" alt="${esc(l)}">` : `<span class="lab">${esc(l)}</span>`;
    }).join("")}</div></div>` : "";
    const cond = resto(c.condicao);
    const hoje = new Date().toLocaleDateString("pt-BR");
    const rodape = (cond ? cond[0].toUpperCase() + cond.slice(1) + ". " : "") + `Valores por pessoa, por mês, sujeitos à confirmação da operadora. Cotação de ${hoje}.`;
    const longo = c.total >= 1000;

    return `<div class="cot" style="--f1:${t.f1};--f2:${t.f2};--cor:${t.cor};--esc:${t.esc};--claro:${t.claro};--dest:${t.dest};font-family:'${t.fonte}',sans-serif">
      <div class="art">
        <div class="topo">
          <div class="barra">${logo}<div class="local">${pin}${esc(a.cidade)}</div></div>
          <span class="kicker">${esc(semParenteses(p.nome).split(",")[0])}</span>
          <h1>Sua cotação${primeiro ? `,<br><em>${esc(primeiro)}</em>` : ""}</h1>
          <p class="sub">${esc(TIPOS[p.tipo] || "Plano")} · ${vidas}</p>
        </div>
        <div class="precos">
          <div class="cartao total"><span class="rot">${c.linhas.length > 1 ? "Total por mês" : "Por mês"}</span><span class="acom">${esc(titulo(c.condicao, p.nome))}</span><div class="grande${longo ? " longo" : ""}">${valor(c.total)}</div></div>
          <div class="cartao tab"><div class="l cab"><span>Idade</span><span class="col">Por mês</span></div>${corpo}</div>
        </div>
        <div class="info">${ondeHTML}${abr}${chips ? `<div class="chips">${chips}</div>` : ""}</div>
        ${labsHTML}
        <p class="cond">${esc(rodape)}</p>
        <div class="fim"></div>
      </div>
    </div>`;
  }

  window.Cotacao = { opcoes, html, titulo, rotulo, resto, reais, lista, TIPOS, semParenteses };
})();
