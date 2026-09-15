"""Camada de acesso ao banco SQLite. Sem ORM, apenas sqlite3 + queries parametrizadas."""
import os
import sqlite3

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "database.db")
SCHEMA_PATH = os.path.join(BASE_DIR, "schema.sql")


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
    então, para bancos criados antes da coluna catalogo_disciplina_id existir,
    ela é adicionada aqui manualmente. Idempotente e sem perda de dados."""
    colunas = {row["name"] for row in conn.execute("PRAGMA table_info(disciplinas)").fetchall()}
    if "catalogo_disciplina_id" not in colunas:
        conn.execute("ALTER TABLE disciplinas ADD COLUMN catalogo_disciplina_id INTEGER "
                     "REFERENCES disciplinas_catalogo(id)")


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
