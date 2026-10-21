# Bancada do corretor, versão da corretora (teste com a Dani)

App no navegador (Chrome ou Edge, instalável no Windows) com CRM, cotação em imagem e indicação simples pelo perfil. Sem ligação, ficha, rota nem Laya.

* Os clientes ficam em `clientes.json`, numa pasta que a corretora escolhe (ex.: Documentos, Bancada).
* O app grava na pasta também `planos.json`, `CLAUDE.md` (instruções pro Claude Code) e `abrir o Claude.bat`.
* O Claude Code dela, aberto na pasta, alimenta e consulta o CRM; o app relê o arquivo a cada 2 segundos.
* As instruções do Claude ficam em `instrucoes.js`. A base de planos é a mesma da demo (`dados/planos.js`).

Teste automático: abrir com `#teste` no fim do endereço expõe a conexão pra usar uma pasta de teste do navegador.
