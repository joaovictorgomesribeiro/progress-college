"""Camada de acesso ao banco SQLite. Sem ORM, apenas sqlite3 + queries parametrizadas."""
import os
import secrets
import sqlite3

from werkzeug.security import generate_password_hash

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "database.db")
SCHEMA_PATH = os.path.join(BASE_DIR, "schema.sql")

# Tabelas de dados pessoais que precisam de um dono direto (usuario_id).
# avaliacoes/conteudos/horarios/pre_requisitos/grade_curricular não entram
# aqui porque seu isolamento é indireto, via disciplinas.usuario_id.
TABELAS_COM_USUARIO_DIRETO = ["disciplinas", "tarefas", "sessoes_estudo", "metas"]


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    """Cria as tabelas caso ainda não existam. Idempotente e seguro para chamar sempre."""
    conn = get_connection()
    with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
        conn.executescript(f.read())
    _migrar_colunas_novas(conn)
    conn.commit()
    conn.close()


def _migrar_colunas_novas(conn):
    """CREATE TABLE IF NOT EXISTS não adiciona colunas a tabelas já existentes -
    então, para bancos criados antes de uma coluna nova existir, ela é
    adicionada aqui manualmente. Idempotente e sem perda de dados."""
    colunas = {row["name"] for row in conn.execute("PRAGMA table_info(disciplinas)").fetchall()}
    if "catalogo_disciplina_id" not in colunas:
        conn.execute("ALTER TABLE disciplinas ADD COLUMN catalogo_disciplina_id INTEGER "
                     "REFERENCES disciplinas_catalogo(id)")

    _migrar_usuario_id(conn)


def _migrar_usuario_id(conn):
    """Adiciona usuario_id às tabelas de dados pessoais em bancos que ainda não
    tinham usuários (sistema single-user anterior), associando todos os
    registros existentes a um usuário inicial. Idempotente: se as colunas já
    existirem, não faz nada."""
    precisa_migrar = False
    for tabela in TABELAS_COM_USUARIO_DIRETO:
        colunas = {row["name"] for row in conn.execute(f"PRAGMA table_info({tabela})").fetchall()}
        if "usuario_id" not in colunas:
            conn.execute(f"ALTER TABLE {tabela} ADD COLUMN usuario_id INTEGER REFERENCES usuarios(id)")
            precisa_migrar = True

    if not precisa_migrar:
        return

    usuario = conn.execute("SELECT id FROM usuarios ORDER BY id LIMIT 1").fetchone()
    if usuario is None:
        senha_temporaria = secrets.token_urlsafe(9)
        cur = conn.execute(
            "INSERT INTO usuarios (nome, email, senha_hash) VALUES (?, ?, ?)",
            ("Administrador", "celjoaogomes22@gmail.com", generate_password_hash(senha_temporaria)),
        )
        usuario_id = cur.lastrowid
        print(
            f"[migração] usuário inicial criado: celjoaogomes22@gmail.com / senha temporária: {senha_temporaria}\n"
            "           troque essa senha assim que possível."
        )
    else:
        usuario_id = usuario["id"]

    for tabela in TABELAS_COM_USUARIO_DIRETO:
        conn.execute(f"UPDATE {tabela} SET usuario_id = ? WHERE usuario_id IS NULL", (usuario_id,))


def query_all(sql, params=()):
    conn = get_connection()
    try:
        rows = conn.execute(sql, params).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def query_one(sql, params=()):
    conn = get_connection()
    try:
        row = conn.execute(sql, params).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def execute(sql, params=()):
    """Executa INSERT/UPDATE/DELETE e retorna (lastrowid, rowcount)."""
    conn = get_connection()
    try:
        cur = conn.execute(sql, params)
        conn.commit()
        return cur.lastrowid, cur.rowcount
    finally:
        conn.close()


def executemany(sql, seq_of_params):
    conn = get_connection()
    try:
        conn.executemany(sql, seq_of_params)
        conn.commit()
    finally:
        conn.close()
