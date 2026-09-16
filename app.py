"""Meu Sistema de Estudos - API Flask.
Backend simples: Flask + SQLite (via database.py) + import/export XLSX (via xlsx_io.py).
Multiusuário via sessão do Flask: cada usuário só enxerga seus próprios dados.
"""
import io
import os
import secrets
from datetime import datetime, date, timedelta
from functools import wraps

from flask import Flask, request, jsonify, send_file, render_template, session
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename

from database import init_db, get_connection, query_all, query_one, execute
import xlsx_io

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
SECRET_KEY_PATH = os.path.join(BASE_DIR, "secret.key")


def _carregar_secret_key():
    """Gera a chave de sessão na primeira execução e reutiliza depois, para
    que as sessões não sejam invalidadas a cada reinício/reload do servidor."""
    if os.path.exists(SECRET_KEY_PATH):
        with open(SECRET_KEY_PATH, "r", encoding="utf-8") as f:
            return f.read().strip()
    chave = secrets.token_hex(32)
    with open(SECRET_KEY_PATH, "w", encoding="utf-8") as f:
        f.write(chave)
    return chave


app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024  # 10MB, mesmo limite do xlsx_io
app.secret_key = _carregar_secret_key()
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"

init_db()

# ---------------------------------------------------------------------------
# Constantes de validação
# ---------------------------------------------------------------------------
STATUS_DISCIPLINA = {"concluida", "andamento", "planejada", "bloqueada"}
STATUS_TAREFA = {"pendente", "andamento", "concluida"}
STATUS_AVALIACAO = {"pendente", "concluida"}
STATUS_CONTEUDO = {"pendente", "andamento", "concluido"}
STATUS_META = {"ativa", "concluida", "expirada"}
PRIORIDADES = {"baixa", "media", "alta"}
TIPOS_AVALIACAO = {"prova", "trabalho", "lista", "seminario", "projeto"}
TIPOS_META = {"horas", "exercicios", "conteudos", "disciplina"}
TIPOS_SESSAO = {"estudo", "revisao", "exercicios", "pomodoro"}
MODOS_IMPORT = {"add", "update", "replace"}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def err(msg, code=400):
    return jsonify({"error": msg}), code


def to_float(v, default=None):
    if v in (None, ""):
        return default
    try:
        return float(v)
    except (TypeError, ValueError):
        return default


def to_int(v, default=None):
    if v in (None, ""):
        return default
    try:
        return int(v)
    except (TypeError, ValueError):
        return default


def clean_str(v):
    if v is None:
        return None
    v = str(v).strip()
    return v or None


def get_json():
    data = request.get_json(silent=True)
    return data if isinstance(data, dict) else {}


DEFAULT_POR_PAGINA = 20
MAX_POR_PAGINA = 100


def paginacao_args():
    """Lê 'pagina' e 'por_pagina' da querystring com limites sãos."""
    pagina = max(1, to_int(request.args.get("pagina"), 1))
    por_pagina = to_int(request.args.get("por_pagina"), DEFAULT_POR_PAGINA)
    por_pagina = max(1, min(por_pagina, MAX_POR_PAGINA))
    return pagina, por_pagina


def paginar_resposta(itens, total, pagina, por_pagina):
    return {
        "itens": itens,
        "total": total,
        "pagina": pagina,
        "por_pagina": por_pagina,
        "paginas": max(1, -(-total // por_pagina)),  # ceil sem importar math
    }


# ---------------------------------------------------------------------------
# Autenticação / isolamento por usuário
# ---------------------------------------------------------------------------
def current_user_id():
    return session.get("usuario_id")


def login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if current_user_id() is None:
            return err("Sessão expirada. Faça login novamente.", 401)
        return fn(*args, **kwargs)
    return wrapper


def disciplina_pertence_ao_usuario(disciplina_id, usuario_id):
    """Confirma que a disciplina existe e pertence ao usuário informado -
    usada para isolar avaliações/conteúdos/horários/pré-requisitos/grade,
    que não têm usuario_id próprio (isolamento indireto via disciplina)."""
    return query_one(
        "SELECT id FROM disciplinas WHERE id = ? AND usuario_id = ?",
        (disciplina_id, usuario_id),
    ) is not None


def recalcular_media(disciplina_id):
    rows = query_all(
        "SELECT nota FROM avaliacoes WHERE disciplina_id = ? AND nota IS NOT NULL",
        (disciplina_id,),
    )
    if not rows:
        return
    # Cada avaliação vale um tanto de pontos (campo "peso") de um total de 100
    # por disciplina; a nota lançada já é a quantidade de pontos conquistados
    # naquela avaliação, então a nota final é a soma direta, não uma média.
    media = sum(r["nota"] or 0 for r in rows)
    execute("UPDATE disciplinas SET media = ?, atualizado_em = datetime('now') WHERE id = ?",
            (round(media, 2), disciplina_id))


def atualizar_metas_horas(usuario_id, disciplina_id, data_sessao, duracao_min):
    """Incrementa metas ativas do tipo 'horas' compatíveis com a sessão registrada."""
    metas = query_all("SELECT * FROM metas WHERE tipo = 'horas' AND status = 'ativa' AND usuario_id = ?", (usuario_id,))
    for m in metas:
        if m["disciplina_id"] and m["disciplina_id"] != disciplina_id:
            continue
        if m["data_inicio"] and data_sessao < m["data_inicio"]:
            continue
        if m["data_fim"] and data_sessao > m["data_fim"]:
            continue
        novo_atual = round((m["atual"] or 0) + duracao_min / 60.0, 2)
        novo_status = "concluida" if novo_atual >= m["alvo"] else m["status"]
        execute("UPDATE metas SET atual = ?, status = ? WHERE id = ?", (novo_atual, novo_status, m["id"]))


def atualizar_metas_conteudo(usuario_id, disciplina_id):
    metas = query_all("SELECT * FROM metas WHERE tipo = 'conteudos' AND status = 'ativa' AND usuario_id = ?", (usuario_id,))
    for m in metas:
        if m["disciplina_id"] and m["disciplina_id"] != disciplina_id:
            continue
        novo_atual = (m["atual"] or 0) + 1
        novo_status = "concluida" if novo_atual >= m["alvo"] else m["status"]
        execute("UPDATE metas SET atual = ?, status = ? WHERE id = ?", (novo_atual, novo_status, m["id"]))


def salvar_horarios(disciplina_id, horarios):
    if horarios is None:
        return
    execute("DELETE FROM horarios WHERE disciplina_id = ?", (disciplina_id,))
    for h in horarios:
        dia = to_int(h.get("dia_semana"))
        if dia is None or not (0 <= dia <= 6):
            continue
        execute(
            "INSERT INTO horarios (disciplina_id, dia_semana, hora_inicio, hora_fim) VALUES (?, ?, ?, ?)",
            (disciplina_id, dia, clean_str(h.get("hora_inicio")), clean_str(h.get("hora_fim"))),
        )


def salvar_prerequisitos(disciplina_id, usuario_id, ids):
    if ids is None:
        return
    execute("DELETE FROM pre_requisitos WHERE disciplina_id = ?", (disciplina_id,))
    for rid in ids:
        rid = to_int(rid)
        # só aceita como pré-requisito uma disciplina que pertence ao mesmo usuário
        if rid and rid != disciplina_id and disciplina_pertence_ao_usuario(rid, usuario_id):
            execute(
                "INSERT OR IGNORE INTO pre_requisitos (disciplina_id, requisito_id) VALUES (?, ?)",
                (disciplina_id, rid),
            )


# ---------------------------------------------------------------------------
# Autenticação
# ---------------------------------------------------------------------------
def _usuario_publico(u):
    return {"id": u["id"], "nome": u["nome"], "email": u["email"]}


@app.post("/api/cadastro")
def cadastro():
    data = get_json()
    nome = clean_str(data.get("nome"))
    email = clean_str(data.get("email"))
    senha = data.get("senha") or ""
    if not nome:
        return err("Campo 'nome' é obrigatório.")
    if not email or "@" not in email:
        return err("Informe um e-mail válido.")
    if len(senha) < 6:
        return err("A senha deve ter pelo menos 6 caracteres.")
    email = email.lower()
    if query_one("SELECT id FROM usuarios WHERE email = ?", (email,)):
        return err("Já existe uma conta com esse e-mail.")
    id_, _ = execute(
        "INSERT INTO usuarios (nome, email, senha_hash) VALUES (?, ?, ?)",
        (nome, email, generate_password_hash(senha)),
    )
    session.clear()
    session["usuario_id"] = id_
    return jsonify(_usuario_publico(query_one("SELECT * FROM usuarios WHERE id = ?", (id_,)))), 201


@app.post("/api/login")
def login():
    data = get_json()
    email = clean_str(data.get("email"))
    senha = data.get("senha") or ""
    if not email or not senha:
        return err("Informe e-mail e senha.")
    usuario = query_one("SELECT * FROM usuarios WHERE email = ?", (email.lower(),))
    if not usuario or not usuario["ativo"] or not check_password_hash(usuario["senha_hash"], senha):
        return err("E-mail ou senha inválidos.", 401)
    session.clear()
    session["usuario_id"] = usuario["id"]
    return jsonify(_usuario_publico(usuario))


@app.post("/api/logout")
def logout():
    session.clear()
    return jsonify({"ok": True})


@app.get("/api/me")
def me():
    usuario_id = current_user_id()
    if usuario_id is None:
        return err("Não autenticado.", 401)
    usuario = query_one("SELECT * FROM usuarios WHERE id = ?", (usuario_id,))
    if not usuario:
        session.clear()
        return err("Não autenticado.", 401)
    return jsonify(_usuario_publico(usuario))


@app.post("/api/trocar-senha")
@login_required
def trocar_senha():
    usuario_id = current_user_id()
    data = get_json()
    senha_atual = data.get("senha_atual") or ""
    senha_nova = data.get("senha_nova") or ""
    usuario = query_one("SELECT * FROM usuarios WHERE id = ?", (usuario_id,))
    if not check_password_hash(usuario["senha_hash"], senha_atual):
        return err("Senha atual incorreta.", 401)
    if len(senha_nova) < 6:
        return err("A nova senha deve ter pelo menos 6 caracteres.")
    execute(
        "UPDATE usuarios SET senha_hash = ?, atualizado_em = datetime('now') WHERE id = ?",
        (generate_password_hash(senha_nova), usuario_id),
    )
    return jsonify({"ok": True})


# ---------------------------------------------------------------------------
# Páginas
# ---------------------------------------------------------------------------
@app.get("/")
def index():
    return render_template("index.html")


# ---------------------------------------------------------------------------
# Disciplinas
# ---------------------------------------------------------------------------
@app.get("/api/disciplinas")
@login_required
def listar_disciplinas():
    conds, params = ["usuario_id = ?"], [current_user_id()]
    if request.args.get("periodo"):
        conds.append("periodo = ?")
        params.append(to_int(request.args.get("periodo")))
    if request.args.get("status"):
        conds.append("status = ?")
        params.append(request.args.get("status"))
    sql = """SELECT d.*,
               (SELECT COUNT(*) FROM conteudos c WHERE c.disciplina_id = d.id) AS conteudos_total,
               (SELECT COUNT(*) FROM conteudos c WHERE c.disciplina_id = d.id AND c.status = 'concluido') AS conteudos_concluidos
             FROM disciplinas d"""
    sql += " WHERE " + " AND ".join(f"d.{c}" for c in conds)
    sql += " ORDER BY d.periodo, d.nome"
    disciplinas = query_all(sql, params)
    for d in disciplinas:
        total = d.pop("conteudos_total") or 0
        concluidos = d.pop("conteudos_concluidos") or 0
        d["progresso"] = round(100 * concluidos / total, 1) if total else 0
    return jsonify(disciplinas)


@app.get("/api/disciplinas/<int:id>")
@login_required
def obter_disciplina(id):
    d = query_one("SELECT * FROM disciplinas WHERE id = ? AND usuario_id = ?", (id, current_user_id()))
    if not d:
        return err("Disciplina não encontrada.", 404)
    d["horarios"] = query_all(
        "SELECT id, dia_semana, hora_inicio, hora_fim FROM horarios WHERE disciplina_id = ? ORDER BY dia_semana",
        (id,),
    )
    d["pre_requisitos"] = query_all(
        """SELECT req.id, req.nome, req.codigo, req.status FROM pre_requisitos pr
           JOIN disciplinas req ON req.id = pr.requisito_id WHERE pr.disciplina_id = ?""",
        (id,),
    )
    return jsonify(d)


def _validar_disciplina(data):
    nome = clean_str(data.get("nome"))
    if not nome:
        return None, "Campo 'nome' é obrigatório."
    status = data.get("status") or "planejada"
    if status not in STATUS_DISCIPLINA:
        return None, "Status de disciplina inválido."
    return {
        "nome": nome,
        "codigo": clean_str(data.get("codigo")),
        "professor": clean_str(data.get("professor")),
        "periodo": to_int(data.get("periodo"), 1),
        "carga_horaria": to_int(data.get("carga_horaria")),
        "creditos": to_int(data.get("creditos")),
        "sala": clean_str(data.get("sala")),
        "status": status,
        "media": to_float(data.get("media")),
        "frequencia": to_float(data.get("frequencia")),
        "cor": clean_str(data.get("cor")) or "#6366f1",
        "observacoes": clean_str(data.get("observacoes")),
    }, None


@app.post("/api/disciplinas")
@login_required
def criar_disciplina():
    data = get_json()
    campos, erro = _validar_disciplina(data)
    if erro:
        return err(erro)
    usuario_id = current_user_id()
    id_, _ = execute(
        """INSERT INTO disciplinas (usuario_id, nome, codigo, professor, periodo, carga_horaria, creditos,
               sala, status, media, frequencia, cor, observacoes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (usuario_id,) + tuple(campos.values()),
    )
    salvar_horarios(id_, data.get("horarios"))
    salvar_prerequisitos(id_, usuario_id, data.get("pre_requisitos"))
    return jsonify(query_one("SELECT * FROM disciplinas WHERE id = ?", (id_,))), 201


@app.put("/api/disciplinas/<int:id>")
@login_required
def atualizar_disciplina(id):
    usuario_id = current_user_id()
    if not disciplina_pertence_ao_usuario(id, usuario_id):
        return err("Disciplina não encontrada.", 404)
    data = get_json()
    campos, erro = _validar_disciplina(data)
    if erro:
        return err(erro)
    execute(
        """UPDATE disciplinas SET nome=?, codigo=?, professor=?, periodo=?, carga_horaria=?,
               creditos=?, sala=?, status=?, media=?, frequencia=?, cor=?, observacoes=?,
               atualizado_em=datetime('now') WHERE id=? AND usuario_id=?""",
        tuple(campos.values()) + (id, usuario_id),
    )
    if "horarios" in data:
        salvar_horarios(id, data.get("horarios"))
    if "pre_requisitos" in data:
        salvar_prerequisitos(id, usuario_id, data.get("pre_requisitos"))
    return jsonify(query_one("SELECT * FROM disciplinas WHERE id = ?", (id,)))


@app.delete("/api/disciplinas/<int:id>")
@login_required
def excluir_disciplina(id):
    usuario_id = current_user_id()
    if not disciplina_pertence_ao_usuario(id, usuario_id):
        return err("Disciplina não encontrada.", 404)
    execute("DELETE FROM disciplinas WHERE id = ? AND usuario_id = ?", (id, usuario_id))
    return jsonify({"ok": True})


# ---------------------------------------------------------------------------
# Avaliações
# ---------------------------------------------------------------------------
@app.get("/api/avaliacoes")
@login_required
def listar_avaliacoes():
    conds, params = ["d.usuario_id = ?"], [current_user_id()]
    if request.args.get("disciplina_id"):
        conds.append("a.disciplina_id = ?")
        params.append(to_int(request.args.get("disciplina_id")))
    if request.args.get("status"):
        conds.append("a.status = ?")
        params.append(request.args.get("status"))
    sql = """SELECT a.*, d.nome AS disciplina_nome, d.cor AS disciplina_cor
             FROM avaliacoes a JOIN disciplinas d ON d.id = a.disciplina_id"""
    sql += " WHERE " + " AND ".join(conds)
    sql += " ORDER BY a.data IS NULL, a.data"
    return jsonify(query_all(sql, params))


@app.get("/api/avaliacoes/<int:id>")
@login_required
def obter_avaliacao(id):
    a = query_one(
        """SELECT a.*, d.nome AS disciplina_nome FROM avaliacoes a
           JOIN disciplinas d ON d.id = a.disciplina_id WHERE a.id = ? AND d.usuario_id = ?""",
        (id, current_user_id()),
    )
    if not a:
        return err("Avaliação não encontrada.", 404)
    return jsonify(a)


def _validar_avaliacao(data, usuario_id):
    disciplina_id = to_int(data.get("disciplina_id"))
    if not disciplina_id or not disciplina_pertence_ao_usuario(disciplina_id, usuario_id):
        return None, "Campo 'disciplina_id' inválido."
    titulo = clean_str(data.get("titulo"))
    if not titulo:
        return None, "Campo 'titulo' é obrigatório."
    tipo = data.get("tipo") or "prova"
    if tipo not in TIPOS_AVALIACAO:
        return None, "Tipo de avaliação inválido."
    status = data.get("status") or "pendente"
    if status not in STATUS_AVALIACAO:
        return None, "Status de avaliação inválido."
    prioridade = data.get("prioridade") or "media"
    if prioridade not in PRIORIDADES:
        return None, "Prioridade inválida."
    nota = to_float(data.get("nota"))
    if nota is not None and not (0 <= nota <= 100):
        return None, "Nota deve estar entre 0 e 100."
    return {
        "disciplina_id": disciplina_id,
        "tipo": tipo,
        "titulo": titulo,
        "data": clean_str(data.get("data")),
        "peso": to_float(data.get("peso"), 1.0),
        "nota": nota,
        "status": status,
        "prioridade": prioridade,
        "observacoes": clean_str(data.get("observacoes")),
    }, None


@app.post("/api/avaliacoes")
@login_required
def criar_avaliacao():
    campos, erro = _validar_avaliacao(get_json(), current_user_id())
    if erro:
        return err(erro)
    id_, _ = execute(
        """INSERT INTO avaliacoes (disciplina_id, tipo, titulo, data, peso, nota, status, prioridade, observacoes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        tuple(campos.values()),
    )
    recalcular_media(campos["disciplina_id"])
    return jsonify(query_one("SELECT * FROM avaliacoes WHERE id = ?", (id_,))), 201


@app.put("/api/avaliacoes/<int:id>")
@login_required
def atualizar_avaliacao(id):
    usuario_id = current_user_id()
    atual = query_one(
        """SELECT a.id FROM avaliacoes a JOIN disciplinas d ON d.id = a.disciplina_id
           WHERE a.id = ? AND d.usuario_id = ?""",
        (id, usuario_id),
    )
    if not atual:
        return err("Avaliação não encontrada.", 404)
    campos, erro = _validar_avaliacao(get_json(), usuario_id)
    if erro:
        return err(erro)
    execute(
        """UPDATE avaliacoes SET disciplina_id=?, tipo=?, titulo=?, data=?, peso=?, nota=?,
               status=?, prioridade=?, observacoes=? WHERE id=?""",
        tuple(campos.values()) + (id,),
    )
    recalcular_media(campos["disciplina_id"])
    return jsonify(query_one("SELECT * FROM avaliacoes WHERE id = ?", (id,)))


@app.delete("/api/avaliacoes/<int:id>")
@login_required
def excluir_avaliacao(id):
    a = query_one(
        """SELECT a.disciplina_id FROM avaliacoes a JOIN disciplinas d ON d.id = a.disciplina_id
           WHERE a.id = ? AND d.usuario_id = ?""",
        (id, current_user_id()),
    )
    if not a:
        return err("Avaliação não encontrada.", 404)
    execute("DELETE FROM avaliacoes WHERE id = ?", (id,))
    recalcular_media(a["disciplina_id"])
    return jsonify({"ok": True})


# ---------------------------------------------------------------------------
# Tarefas
# ---------------------------------------------------------------------------
@app.get("/api/tarefas")
@login_required
def listar_tarefas():
    conds, params = ["t.usuario_id = ?"], [current_user_id()]
    if request.args.get("disciplina_id"):
        conds.append("t.disciplina_id = ?")
        params.append(to_int(request.args.get("disciplina_id")))
    if request.args.get("status"):
        conds.append("t.status = ?")
        params.append(request.args.get("status"))
    sql = """SELECT t.*, d.nome AS disciplina_nome, d.cor AS disciplina_cor
             FROM tarefas t LEFT JOIN disciplinas d ON d.id = t.disciplina_id"""
    sql += " WHERE " + " AND ".join(conds)
    sql += " ORDER BY t.prazo IS NULL, t.prazo"
    return jsonify(query_all(sql, params))


@app.get("/api/tarefas/<int:id>")
@login_required
def obter_tarefa(id):
    t = query_one(
        """SELECT t.*, d.nome AS disciplina_nome FROM tarefas t
           LEFT JOIN disciplinas d ON d.id = t.disciplina_id WHERE t.id = ? AND t.usuario_id = ?""",
        (id, current_user_id()),
    )
    if not t:
        return err("Tarefa não encontrada.", 404)
    return jsonify(t)


def _validar_tarefa(data, usuario_id):
    nome = clean_str(data.get("nome"))
    if not nome:
        return None, "Campo 'nome' é obrigatório."
    disciplina_id = to_int(data.get("disciplina_id"))
    if disciplina_id and not disciplina_pertence_ao_usuario(disciplina_id, usuario_id):
        return None, "Disciplina inválida."
    prioridade = data.get("prioridade") or "media"
    if prioridade not in PRIORIDADES:
        return None, "Prioridade inválida."
    status = data.get("status") or "pendente"
    if status not in STATUS_TAREFA:
        return None, "Status de tarefa inválido."
    return {
        "disciplina_id": disciplina_id,
        "nome": nome,
        "descricao": clean_str(data.get("descricao")),
        "prazo": clean_str(data.get("prazo")),
        "prioridade": prioridade,
        "status": status,
        "tempo_estimado": to_float(data.get("tempo_estimado")),
        "observacoes": clean_str(data.get("observacoes")),
    }, None


@app.post("/api/tarefas")
@login_required
def criar_tarefa():
    usuario_id = current_user_id()
    campos, erro = _validar_tarefa(get_json(), usuario_id)
    if erro:
        return err(erro)
    id_, _ = execute(
        """INSERT INTO tarefas (usuario_id, disciplina_id, nome, descricao, prazo, prioridade, status,
               tempo_estimado, observacoes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (usuario_id,) + tuple(campos.values()),
    )
    return jsonify(query_one("SELECT * FROM tarefas WHERE id = ?", (id_,))), 201


@app.put("/api/tarefas/<int:id>")
@login_required
def atualizar_tarefa(id):
    usuario_id = current_user_id()
    if not query_one("SELECT id FROM tarefas WHERE id = ? AND usuario_id = ?", (id, usuario_id)):
        return err("Tarefa não encontrada.", 404)
    campos, erro = _validar_tarefa(get_json(), usuario_id)
    if erro:
        return err(erro)
    execute(
        """UPDATE tarefas SET disciplina_id=?, nome=?, descricao=?, prazo=?, prioridade=?,
               status=?, tempo_estimado=?, observacoes=? WHERE id=? AND usuario_id=?""",
        tuple(campos.values()) + (id, usuario_id),
    )
    return jsonify(query_one("SELECT * FROM tarefas WHERE id = ?", (id,)))


@app.delete("/api/tarefas/<int:id>")
@login_required
def excluir_tarefa(id):
    usuario_id = current_user_id()
    if not query_one("SELECT id FROM tarefas WHERE id = ? AND usuario_id = ?", (id, usuario_id)):
        return err("Tarefa não encontrada.", 404)
    execute("DELETE FROM tarefas WHERE id = ? AND usuario_id = ?", (id, usuario_id))
    return jsonify({"ok": True})


# ---------------------------------------------------------------------------
# Conteúdos
# ---------------------------------------------------------------------------
@app.get("/api/conteudos")
@login_required
def listar_conteudos():
    conds, params = ["d.usuario_id = ?"], [current_user_id()]
    if request.args.get("disciplina_id"):
        conds.append("c.disciplina_id = ?")
        params.append(to_int(request.args.get("disciplina_id")))
    sql = """SELECT c.*, d.nome AS disciplina_nome FROM conteudos c
             JOIN disciplinas d ON d.id = c.disciplina_id"""
    sql += " WHERE " + " AND ".join(conds)
    sql += " ORDER BY c.disciplina_id, c.ordem"
    return jsonify(query_all(sql, params))


def _validar_conteudo(data, usuario_id):
    disciplina_id = to_int(data.get("disciplina_id"))
    if not disciplina_id or not disciplina_pertence_ao_usuario(disciplina_id, usuario_id):
        return None, "Campo 'disciplina_id' inválido."
    titulo = clean_str(data.get("titulo"))
    if not titulo:
        return None, "Campo 'titulo' é obrigatório."
    status = data.get("status") or "pendente"
    if status not in STATUS_CONTEUDO:
        return None, "Status de conteúdo inválido."
    return {
        "disciplina_id": disciplina_id,
        "titulo": titulo,
        "status": status,
        "ordem": to_int(data.get("ordem"), 0),
        "data_conclusao": clean_str(data.get("data_conclusao")),
    }, None


@app.post("/api/conteudos")
@login_required
def criar_conteudo():
    campos, erro = _validar_conteudo(get_json(), current_user_id())
    if erro:
        return err(erro)
    id_, _ = execute(
        "INSERT INTO conteudos (disciplina_id, titulo, status, ordem, data_conclusao) VALUES (?, ?, ?, ?, ?)",
        tuple(campos.values()),
    )
    return jsonify(query_one("SELECT * FROM conteudos WHERE id = ?", (id_,))), 201


def _conteudo_do_usuario(id, usuario_id):
    return query_one(
        """SELECT c.* FROM conteudos c JOIN disciplinas d ON d.id = c.disciplina_id
           WHERE c.id = ? AND d.usuario_id = ?""",
        (id, usuario_id),
    )


@app.put("/api/conteudos/<int:id>")
@login_required
def atualizar_conteudo(id):
    usuario_id = current_user_id()
    anterior = _conteudo_do_usuario(id, usuario_id)
    if not anterior:
        return err("Conteúdo não encontrado.", 404)
    campos, erro = _validar_conteudo(get_json(), usuario_id)
    if erro:
        return err(erro)
    if campos["status"] == "concluido" and not campos["data_conclusao"]:
        campos["data_conclusao"] = date.today().isoformat()
    execute(
        "UPDATE conteudos SET disciplina_id=?, titulo=?, status=?, ordem=?, data_conclusao=? WHERE id=?",
        tuple(campos.values()) + (id,),
    )
    if anterior["status"] != "concluido" and campos["status"] == "concluido":
        atualizar_metas_conteudo(usuario_id, campos["disciplina_id"])
    return jsonify(query_one("SELECT * FROM conteudos WHERE id = ?", (id,)))


@app.delete("/api/conteudos/<int:id>")
@login_required
def excluir_conteudo(id):
    if not _conteudo_do_usuario(id, current_user_id()):
        return err("Conteúdo não encontrado.", 404)
    execute("DELETE FROM conteudos WHERE id = ?", (id,))
    return jsonify({"ok": True})


# ---------------------------------------------------------------------------
# Estudos (sessões) / Pomodoro
# ---------------------------------------------------------------------------
@app.get("/api/estudos")
@login_required
def listar_estudos():
    conds, params = ["s.usuario_id = ?"], [current_user_id()]
    if request.args.get("disciplina_id"):
        conds.append("s.disciplina_id = ?")
        params.append(to_int(request.args.get("disciplina_id")))
    if request.args.get("desde"):
        conds.append("s.data >= ?")
        params.append(request.args.get("desde"))
    where_sql = " WHERE " + " AND ".join(conds)

    total = query_one(f"SELECT COUNT(*) AS n FROM sessoes_estudo s{where_sql}", params)["n"]
    pagina, por_pagina = paginacao_args()

    sql = f"""SELECT s.*, d.nome AS disciplina_nome, d.cor AS disciplina_cor
              FROM sessoes_estudo s LEFT JOIN disciplinas d ON d.id = s.disciplina_id{where_sql}
              ORDER BY s.data DESC, s.id DESC
              LIMIT ? OFFSET ?"""
    itens = query_all(sql, params + [por_pagina, (pagina - 1) * por_pagina])
    return jsonify(paginar_resposta(itens, total, pagina, por_pagina))


@app.post("/api/estudos")
@login_required
def criar_estudo():
    usuario_id = current_user_id()
    data = get_json()
    disciplina_id = to_int(data.get("disciplina_id"))
    if disciplina_id and not disciplina_pertence_ao_usuario(disciplina_id, usuario_id):
        return err("Disciplina inválida.")
    data_sessao = clean_str(data.get("data")) or date.today().isoformat()
    duracao_min = to_int(data.get("duracao_min"))
    if not duracao_min or duracao_min <= 0:
        return err("Campo 'duracao_min' é obrigatório e deve ser positivo.")
    tipo = data.get("tipo") or "estudo"
    if tipo not in TIPOS_SESSAO:
        return err("Tipo de sessão inválido.")
    id_, _ = execute(
        "INSERT INTO sessoes_estudo (usuario_id, disciplina_id, data, duracao_min, tipo, observacoes) VALUES (?, ?, ?, ?, ?, ?)",
        (usuario_id, disciplina_id, data_sessao, duracao_min, tipo, clean_str(data.get("observacoes"))),
    )
    atualizar_metas_horas(usuario_id, disciplina_id, data_sessao, duracao_min)
    return jsonify(query_one("SELECT * FROM sessoes_estudo WHERE id = ?", (id_,))), 201


@app.delete("/api/estudos/<int:id>")
@login_required
def excluir_estudo(id):
    if not query_one("SELECT id FROM sessoes_estudo WHERE id = ? AND usuario_id = ?", (id, current_user_id())):
        return err("Sessão não encontrada.", 404)
    execute("DELETE FROM sessoes_estudo WHERE id = ? AND usuario_id = ?", (id, current_user_id()))
    return jsonify({"ok": True})


# ---------------------------------------------------------------------------
# Metas
# ---------------------------------------------------------------------------
@app.get("/api/metas")
@login_required
def listar_metas():
    conds, params = ["m.usuario_id = ?"], [current_user_id()]
    if request.args.get("status"):
        conds.append("m.status = ?")
        params.append(request.args.get("status"))
    sql = """SELECT m.*, d.nome AS disciplina_nome FROM metas m
             LEFT JOIN disciplinas d ON d.id = m.disciplina_id"""
    sql += " WHERE " + " AND ".join(conds)
    sql += " ORDER BY m.status, m.data_fim IS NULL, m.data_fim"
    return jsonify(query_all(sql, params))


def _validar_meta(data, usuario_id):
    titulo = clean_str(data.get("titulo"))
    if not titulo:
        return None, "Campo 'titulo' é obrigatório."
    tipo = data.get("tipo") or "horas"
    if tipo not in TIPOS_META:
        return None, "Tipo de meta inválido."
    alvo = to_float(data.get("alvo"))
    if not alvo or alvo <= 0:
        return None, "Campo 'alvo' deve ser maior que zero."
    status = data.get("status") or "ativa"
    if status not in STATUS_META:
        return None, "Status de meta inválido."
    disciplina_id = to_int(data.get("disciplina_id"))
    if disciplina_id and not disciplina_pertence_ao_usuario(disciplina_id, usuario_id):
        return None, "Disciplina inválida."
    return {
        "tipo": tipo,
        "titulo": titulo,
        "alvo": alvo,
        "atual": to_float(data.get("atual"), 0.0),
        "unidade": clean_str(data.get("unidade")),
        "disciplina_id": disciplina_id,
        "data_inicio": clean_str(data.get("data_inicio")),
        "data_fim": clean_str(data.get("data_fim")),
        "status": status,
    }, None


@app.post("/api/metas")
@login_required
def criar_meta():
    usuario_id = current_user_id()
    campos, erro = _validar_meta(get_json(), usuario_id)
    if erro:
        return err(erro)
    id_, _ = execute(
        """INSERT INTO metas (usuario_id, tipo, titulo, alvo, atual, unidade, disciplina_id, data_inicio, data_fim, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (usuario_id,) + tuple(campos.values()),
    )
    return jsonify(query_one("SELECT * FROM metas WHERE id = ?", (id_,))), 201


@app.put("/api/metas/<int:id>")
@login_required
def atualizar_meta(id):
    usuario_id = current_user_id()
    if not query_one("SELECT id FROM metas WHERE id = ? AND usuario_id = ?", (id, usuario_id)):
        return err("Meta não encontrada.", 404)
    campos, erro = _validar_meta(get_json(), usuario_id)
    if erro:
        return err(erro)
    if campos["atual"] >= campos["alvo"] and campos["status"] == "ativa":
        campos["status"] = "concluida"
    execute(
        """UPDATE metas SET tipo=?, titulo=?, alvo=?, atual=?, unidade=?, disciplina_id=?,
               data_inicio=?, data_fim=?, status=? WHERE id=? AND usuario_id=?""",
        tuple(campos.values()) + (id, usuario_id),
    )
    return jsonify(query_one("SELECT * FROM metas WHERE id = ?", (id,)))


@app.delete("/api/metas/<int:id>")
@login_required
def excluir_meta(id):
    usuario_id = current_user_id()
    if not query_one("SELECT id FROM metas WHERE id = ? AND usuario_id = ?", (id, usuario_id)):
        return err("Meta não encontrada.", 404)
    execute("DELETE FROM metas WHERE id = ? AND usuario_id = ?", (id, usuario_id))
    return jsonify({"ok": True})


# ---------------------------------------------------------------------------
# Grade curricular
# ---------------------------------------------------------------------------
@app.get("/api/grade")
@login_required
def obter_grade():
    usuario_id = current_user_id()
    disciplinas = query_all("SELECT * FROM disciplinas WHERE usuario_id = ? ORDER BY periodo, nome", (usuario_id,))
    prereqs_map = {}
    for row in query_all(
        """SELECT pr.disciplina_id, req.id AS req_id, req.nome AS req_nome, req.status AS req_status
           FROM pre_requisitos pr JOIN disciplinas req ON req.id = pr.requisito_id
           WHERE req.usuario_id = ?""",
        (usuario_id,),
    ):
        prereqs_map.setdefault(row["disciplina_id"], []).append(
            {"id": row["req_id"], "nome": row["req_nome"], "status": row["req_status"]}
        )

    periodos = {}
    for d in disciplinas:
        prereqs = prereqs_map.get(d["id"], [])
        if d["status"] in ("concluida", "andamento"):
            status_efetivo = d["status"]
        elif prereqs and any(p["status"] != "concluida" for p in prereqs):
            status_efetivo = "bloqueada"
        else:
            status_efetivo = "planejada"
        d["status_efetivo"] = status_efetivo
        d["pre_requisitos"] = prereqs
        periodos.setdefault(d["periodo"] or 1, []).append(d)

    resultado = [{"periodo": p, "disciplinas": periodos[p]} for p in sorted(periodos.keys())]
    return jsonify(resultado)


@app.put("/api/grade/<int:disciplina_id>")
@login_required
def atualizar_posicao_grade(disciplina_id):
    if not disciplina_pertence_ao_usuario(disciplina_id, current_user_id()):
        return err("Disciplina não encontrada.", 404)
    data = get_json()
    periodo = to_int(data.get("periodo"), 1)
    ordem = to_int(data.get("ordem"), 0)
    existente = query_one("SELECT id FROM grade_curricular WHERE disciplina_id = ?", (disciplina_id,))
    if existente:
        execute("UPDATE grade_curricular SET periodo=?, ordem=? WHERE disciplina_id=?",
                (periodo, ordem, disciplina_id))
    else:
        execute("INSERT INTO grade_curricular (disciplina_id, periodo, ordem) VALUES (?, ?, ?)",
                (disciplina_id, periodo, ordem))
    execute("UPDATE disciplinas SET periodo=? WHERE id=?", (periodo, disciplina_id))
    return jsonify({"ok": True})


# ---------------------------------------------------------------------------
# Configurações
# ---------------------------------------------------------------------------
@app.get("/api/config")
@login_required
def obter_config():
    linhas = query_all("SELECT chave, valor FROM configuracoes")
    return jsonify({l["chave"]: l["valor"] for l in linhas})


@app.put("/api/config")
@login_required
def atualizar_config():
    data = get_json()
    for chave, valor in data.items():
        chave = clean_str(chave)
        if not chave:
            continue
        execute(
            "INSERT INTO configuracoes (chave, valor) VALUES (?, ?) "
            "ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor",
            (chave, str(valor) if valor is not None else None),
        )
    return jsonify({"ok": True})


# ---------------------------------------------------------------------------
# Dashboard / Foco do dia
# ---------------------------------------------------------------------------
@app.get("/api/dashboard")
@login_required
def dashboard():
    usuario_id = current_user_id()
    hoje = date.today()
    total_disciplinas = query_one("SELECT COUNT(*) AS n FROM disciplinas WHERE usuario_id = ?", (usuario_id,))["n"]
    disciplinas_andamento = query_one(
        "SELECT COUNT(*) AS n FROM disciplinas WHERE usuario_id = ? AND status = 'andamento'", (usuario_id,)
    )["n"]
    tarefas_concluidas = query_one(
        "SELECT COUNT(*) AS n FROM tarefas WHERE usuario_id = ? AND status = 'concluida'", (usuario_id,)
    )["n"]
    tarefas_total = query_one("SELECT COUNT(*) AS n FROM tarefas WHERE usuario_id = ?", (usuario_id,))["n"]
    avaliacoes_proximas = query_one(
        """SELECT COUNT(*) AS n FROM avaliacoes a JOIN disciplinas d ON d.id = a.disciplina_id
           WHERE d.usuario_id = ? AND a.status = 'pendente' AND a.data BETWEEN ? AND ?""",
        (usuario_id, hoje.isoformat(), (hoje + timedelta(days=15)).isoformat()),
    )["n"]
    inicio_semana = (hoje - timedelta(days=hoje.weekday())).isoformat()
    minutos_semana = query_one(
        "SELECT COALESCE(SUM(duracao_min), 0) AS total FROM sessoes_estudo WHERE usuario_id = ? AND data >= ?",
        (usuario_id, inicio_semana),
    )["total"]

    dia_semana_hoje = (hoje.weekday() + 1) % 7  # weekday() é 0=segunda; horarios usa 0=domingo
    aulas_hoje = query_all(
        """SELECT h.hora_inicio, h.hora_fim, d.id AS disciplina_id, d.nome AS disciplina_nome,
                  d.sala, d.professor, d.cor
           FROM horarios h JOIN disciplinas d ON d.id = h.disciplina_id
           WHERE h.dia_semana = ? AND d.usuario_id = ?
           ORDER BY h.hora_inicio""",
        (dia_semana_hoje, usuario_id),
    )

    foco = []

    for a in query_all(
        """SELECT a.*, d.nome AS disciplina_nome FROM avaliacoes a JOIN disciplinas d ON d.id = a.disciplina_id
           WHERE d.usuario_id = ? AND a.status = 'pendente' AND a.data IS NOT NULL AND a.data >= ?
           ORDER BY a.data LIMIT 10""",
        (usuario_id, hoje.isoformat()),
    ):
        dias = (date.fromisoformat(a["data"]) - hoje).days
        if dias > 14:
            continue
        nivel = "alta" if dias <= 3 else ("media" if dias <= 7 else "baixa")
        foco.append({
            "tipo": "avaliacao", "titulo": f"{a['tipo'].capitalize()} de {a['disciplina_nome']}",
            "subtitulo": a["titulo"], "nivel": nivel,
            "detalhe": f"Faltam {dias} dia(s)" if dias > 0 else "É hoje!",
            "ordem": dias, "ref_id": a["id"],
        })

    for t in query_all(
        """SELECT t.*, d.nome AS disciplina_nome FROM tarefas t LEFT JOIN disciplinas d ON d.id = t.disciplina_id
           WHERE t.usuario_id = ? AND t.status != 'concluida' AND t.prazo IS NOT NULL ORDER BY t.prazo LIMIT 20""",
        (usuario_id,),
    ):
        dias = (date.fromisoformat(t["prazo"]) - hoje).days
        if dias < 0:
            nivel, detalhe = "alta", f"Atrasada há {-dias} dia(s)"
        elif dias == 0:
            nivel, detalhe = "alta", "Prazo é hoje"
        elif dias <= 2:
            nivel, detalhe = "media", f"Prazo em {dias} dia(s)"
        elif dias <= 7:
            nivel, detalhe = "baixa", f"Prazo em {dias} dia(s)"
        else:
            continue
        foco.append({
            "tipo": "tarefa", "titulo": t["nome"],
            "subtitulo": t["disciplina_nome"] or "Geral", "nivel": nivel,
            "detalhe": detalhe, "ordem": dias - 10, "ref_id": t["id"],
        })

    for m in query_all("SELECT * FROM metas WHERE usuario_id = ? AND status = 'ativa' ORDER BY data_fim", (usuario_id,)):
        if m["alvo"] and m["atual"] / m["alvo"] < 0.5:
            foco.append({
                "tipo": "meta", "titulo": m["titulo"], "subtitulo": "Meta em andamento",
                "nivel": "baixa", "detalhe": f"{m['atual']:.1f} / {m['alvo']:.1f} {m['unidade'] or ''}".strip(),
                "ordem": 20, "ref_id": m["id"],
            })

    peso = {"alta": 0, "media": 1, "baixa": 2}
    foco.sort(key=lambda f: (peso.get(f["nivel"], 3), f["ordem"]))

    return jsonify({
        "total_disciplinas": total_disciplinas,
        "disciplinas_andamento": disciplinas_andamento,
        "tarefas_concluidas": tarefas_concluidas,
        "tarefas_total": tarefas_total,
        "avaliacoes_proximas": avaliacoes_proximas,
        "horas_semana": round(minutos_semana / 60.0, 1),
        "aulas_hoje": aulas_hoje,
        "foco_do_dia": foco[:8],
        "tem_dados": total_disciplinas > 0,
    })


# ---------------------------------------------------------------------------
# Estatísticas
# ---------------------------------------------------------------------------
@app.get("/api/estatisticas")
@login_required
def estatisticas():
    usuario_id = current_user_id()
    por_disciplina = query_all(
        """SELECT d.id, d.nome, d.cor, COALESCE(SUM(s.duracao_min), 0) AS minutos
           FROM disciplinas d LEFT JOIN sessoes_estudo s ON s.disciplina_id = d.id
           WHERE d.usuario_id = ?
           GROUP BY d.id ORDER BY minutos DESC""",
        (usuario_id,),
    )
    hoje = date.today()
    dias = [(hoje - timedelta(days=i)).isoformat() for i in range(13, -1, -1)]
    minutos_por_dia = {
        r["data"]: r["minutos"] for r in query_all(
            """SELECT data, SUM(duracao_min) AS minutos FROM sessoes_estudo
               WHERE usuario_id = ? AND data >= ? GROUP BY data""",
            (usuario_id, dias[0]),
        )
    }
    serie_dias = [{"data": d, "minutos": minutos_por_dia.get(d, 0)} for d in dias]

    total_notas = query_one(
        """SELECT COUNT(*) AS n FROM avaliacoes a JOIN disciplinas d ON d.id = a.disciplina_id
           WHERE d.usuario_id = ? AND a.nota IS NOT NULL""",
        (usuario_id,),
    )["n"]
    pagina_notas, por_pagina_notas = paginacao_args()
    evolucao_notas = query_all(
        """SELECT a.data, a.titulo, a.nota, d.nome AS disciplina_nome FROM avaliacoes a
           JOIN disciplinas d ON d.id = a.disciplina_id
           WHERE d.usuario_id = ? AND a.nota IS NOT NULL
           ORDER BY a.data DESC LIMIT ? OFFSET ?""",
        (usuario_id, por_pagina_notas, (pagina_notas - 1) * por_pagina_notas),
    )

    conteudos_status = query_all(
        """SELECT c.status, COUNT(*) AS n FROM conteudos c JOIN disciplinas d ON d.id = c.disciplina_id
           WHERE d.usuario_id = ? GROUP BY c.status""",
        (usuario_id,),
    )
    tarefas_status = query_all(
        "SELECT status, COUNT(*) AS n FROM tarefas WHERE usuario_id = ? GROUP BY status", (usuario_id,)
    )
    total_disc = query_one("SELECT COUNT(*) AS n FROM disciplinas WHERE usuario_id = ?", (usuario_id,))["n"]
    concluidas_disc = query_one(
        "SELECT COUNT(*) AS n FROM disciplinas WHERE usuario_id = ? AND status='concluida'", (usuario_id,)
    )["n"]

    return jsonify({
        "horas_por_disciplina": [
            {"nome": r["nome"], "cor": r["cor"], "horas": round(r["minutos"] / 60.0, 1)} for r in por_disciplina
        ],
        "serie_dias": serie_dias,
        "evolucao_notas": paginar_resposta(evolucao_notas, total_notas, pagina_notas, por_pagina_notas),
        "conteudos_status": {r["status"]: r["n"] for r in conteudos_status},
        "tarefas_status": {r["status"]: r["n"] for r in tarefas_status},
        "progresso_curso": {
            "total": total_disc, "concluidas": concluidas_disc,
            "percentual": round(100 * concluidas_disc / total_disc, 1) if total_disc else 0,
        },
    })


# ---------------------------------------------------------------------------
# Importação / Exportação XLSX
# ---------------------------------------------------------------------------
@app.post("/api/importar")
@login_required
def importar():
    arquivo = request.files.get("arquivo")
    if not arquivo:
        return err("Nenhum arquivo enviado.")
    ok, msg = xlsx_io.validar_arquivo(arquivo)
    if not ok:
        return err(msg)
    modo = request.form.get("modo", "update")
    if modo not in MODOS_IMPORT:
        return err("Modo de importação inválido.")

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    nome_seguro = secure_filename(arquivo.filename) or "importacao.xlsx"
    caminho = os.path.join(UPLOAD_DIR, f"{datetime.now():%Y%m%d%H%M%S}_{nome_seguro}")
    arquivo.save(caminho)
    try:
        resumo = xlsx_io.importar_xlsx(caminho, modo, current_user_id())
    except Exception as exc:
        return err(f"Falha ao importar planilha: {exc}", 400)
    finally:
        if os.path.exists(caminho):
            os.remove(caminho)
    return jsonify(resumo)


@app.get("/api/exportar")
@login_required
def exportar():
    nome = f"sistema_estudos_export_{datetime.now():%Y%m%d_%H%M%S}.xlsx"
    buffer = io.BytesIO()
    xlsx_io.exportar_xlsx(buffer, current_user_id())
    buffer.seek(0)
    return send_file(
        buffer, as_attachment=True, download_name=nome,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


# ---------------------------------------------------------------------------
# Erros JSON padronizados
# ---------------------------------------------------------------------------
@app.errorhandler(404)
def not_found(e):
    if request.path.startswith("/api/"):
        return err("Recurso não encontrado.", 404)
    return e


@app.errorhandler(413)
def too_large(e):
    return err("Arquivo excede o tamanho máximo permitido (10MB).", 413)


if __name__ == "__main__":
    app.run(debug=True)
