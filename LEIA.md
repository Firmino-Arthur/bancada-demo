# Bancada do corretor, demonstração web

Versão de demonstração do CRM e da cotação da Bancada, pra mostrar a corretor em qualquer computador (Windows, Mac, celular). Abre no navegador, sem instalar.

* Cada pessoa cadastra até 2 clientes reais. Ficam salvos só no navegador dela.
* A cotação sai em imagem com a identidade da operadora, o nome do cliente e a rede da cidade dele, pronta pro WhatsApp.
* Três clientes de exemplo, apagados, mostram o funil cheio. Não contam no limite.
* Fora da demo: ligação, ficha, rota e Laya (segredo comercial).

## Arquivos

* `index.html`, `estilo.css`, `app.js` e `cotacao.js`: a página.
* `dados/planos.js`: a base de planos, gerada da base da Bancada sem notas internas, fontes e produtos sem preço confirmado. Pra atualizar, rodar de novo a geração (ver a conversa de 19 out 2026) depois de mexer em `interno/bancada/dados/planos-saude.json`.
* `cotacao/`: fontes e logos da imagem. `marca/`: logo AF e Overused Grotesk.

## Testar no Mac

Na pasta: `python3 -m http.server 8790` e abrir http://127.0.0.1:8790 (abrindo o arquivo direto, a imagem não baixa).

## Falta

* Link do WhatsApp no botão "Quero a versão completa" (`CONTATO` no começo do `app.js`).
* Publicar num endereço (Vercel ou Netlify, conta do Arthur).
