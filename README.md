# Meu Sistema de Estudos

Sistema pessoal de estudos e organização acadêmica. Flask + SQLite no backend, HTML/CSS/JavaScript vanilla no frontend (mobile first), com importação/exportação de dados via XLSX.

## Arquitetura

```
Frontend (HTML5 + CSS3 + JS vanilla)
        ↓ REST API (JSON)
Backend (Python + Flask)
        ↓
Banco de dados (SQLite)
```

O XLSX é usado apenas para importar/exportar dados — o banco principal é sempre o SQLite (`database.db`).

## Estrutura do projeto

```
sisacademico/
├── app.py                 # API Flask + rotas
├── database.py            # Acesso ao SQLite
├── xlsx_io.py              # Importação/exportação XLSX
├── schema.sql              # Definição das tabelas
├── requirements.txt
├── templates/index.html    # Shell do SPA
├── static/css/             # style.css + responsive.css
├── static/js/              # api.js, app.js e um módulo por página
└── uploads/                 # arquivos temporários de importação
```

## Rodando localmente

```bash
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements.txt
python app.py
```

Acesse `http://127.0.0.1:5000`. O banco `database.db` é criado e as tabelas inicializadas automaticamente na primeira execução (`init_db()` em `app.py`) — não é necessário nenhum passo manual.

## Deploy no PythonAnywhere

1. **Criar a conta/app Flask**
   - Acesse a aba **Web** → **Add a new web app** → escolha **Manual configuration** (não use o wizard "Flask", pois ele cria um projeto próprio) → selecione a versão do Python (3.10+).

2. **Enviar o código**
   - Envie os arquivos do projeto para `/home/SEUUSUARIO/sisacademico` (via Git, upload de arquivos, ou o Bash console do PythonAnywhere com `git clone`).

3. **Criar o ambiente virtual**
   - No **Bash console** do PythonAnywhere:
     ```bash
     cd ~/sisacademico
     python3.10 -m venv .venv
     source .venv/bin/activate
     ```

4. **Instalar as dependências**
   ```bash
      
   ```

5. **Configurar o arquivo WSGI**
   - Na aba **Web**, clique no link do arquivo WSGI (algo como `/var/www/seuusuario_pythonanywhere_com_wsgi.py`) e substitua o conteúdo por:
     ```python
     import sys
     path = '/home/SEUUSUARIO/sisacademico'
     if path not in sys.path:
         sys.path.insert(0, path)

     from app import app as application
     ```

6. **Configurar o caminho do projeto e o virtualenv**
   - Na aba **Web**, em **Code**: defina *Source code* e *Working directory* como `/home/SEUUSUARIO/sisacademico`.
   - Em **Virtualenv**: informe `/home/SEUUSUARIO/sisacademico/.venv`.

7. **Banco de dados e tabelas**
   - Não é preciso criar nada manualmente: `app.py` chama `init_db()` na importação do módulo, que executa `schema.sql` com `CREATE TABLE IF NOT EXISTS`. O arquivo `database.db` é criado automaticamente na primeira request. Se quiser inicializar antes, rode no Bash console:
     ```bash
     source .venv/bin/activate
     python -c "from database import init_db; init_db()"
     ```

8. **Diretórios necessários**
   - Garanta que a pasta `uploads/` exista e tenha permissão de escrita (usada apenas como área temporária durante a importação de XLSX; os arquivos são apagados após o processamento).
   - O arquivo `database.db` **não é servido publicamente** — ele fica fora de `static/` e não há nenhuma rota que o exponha.

9. **Recarregar**
   - Clique em **Reload** na aba **Web** do PythonAnywhere e acesse `https://seuusuario.pythonanywhere.com`.

dias
Modos de importação:
- **Adicionar**: só insere o que ainda não existe.
- **Atualizar**: insere novos registros e atualiza os existentes (identificados por nome/código/título).
- **Substituir**: apaga todos os dados atuais e importa do zero.

## Multiusuário

O sistema suporta múltiplas contas. Cada usuário só enxerga seus próprios dados (disciplinas, avaliações, tarefas, estudos, metas); `disciplinas_catalogo` é a única tabela pensada para ser compartilhada no futuro.

- Autenticação via sessão do Flask (`session["usuario_id"]`), senha com hash (`werkzeug.security`).
- Rotas: `POST /api/cadastro`, `POST /api/login`, `POST /api/logout`, `GET /api/me`.
- Toda rota `/api/...` de dados exige sessão válida (`@login_required`) e filtra pelo dono — nunca confia num `usuario_id` vindo do frontend.
- Migração automática: na primeira execução após atualizar o código, `database.py` cria a tabela `usuarios`, adiciona `usuario_id` nas tabelas pessoais e associa todos os dados já existentes a um usuário inicial (e-mail `celjoaogomes22@gmail.com`, senha temporária impressa no log do servidor na hora da migração — troque assim que possível). Não é preciso rodar nada manualmente.
- Detalhes de cada rota e da estratégia de isolamento: ver [DOCUMENTACAO.md](DOCUMENTACAO.md).

## Segurança

- Todas as queries usam parâmetros (`?`) — nunca concatenação de string com dados do usuário.
- Upload de XLSX limitado a 10MB e validado por extensão antes do processamento.
- `database.db` nunca é servido como arquivo estático.
- `secret.key` (chave de sessão) é gerado automaticamente no primeiro start e nunca deve ir para o Git (já está no `.gitignore`).
