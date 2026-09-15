"""Importação e exportação de dados via XLSX (openpyxl).
O XLSX nunca é o banco principal - é apenas usado para importar dados iniciais/
atualizações e para exportar um snapshot do SQLite.
"""
import os
from datetime import datetime, date

from openpyxl import Workbook, load_workbook

from database import get_connection

MAX_XLSX_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB - limite de upload

SHEET_DISCIPLINAS = "Disciplinas"
SHEET_AVALIACOES = "Avaliações"
SHEET_TAREFAS = "Tarefas"
SHEET_CONTEUDOS = "Conteúdos"
SHEET_ESTUDOS = "Estudos"
SHEET_GRADE = "Grade_Curricular"
SHEET_METAS = "Metas"
SHEET_CONFIG = "Config"

DISCIPLINAS_COLS = [
    "id", "nome", "codigo", "professor", "periodo", "carga_horaria", "creditos",
    "sala", "status", "media", "frequencia", "cor", "pre_requisitos", "observacoes",
]
AVALIACOES_COLS = [
    "id", "disciplina", "tipo", "titulo", "data", "peso", "nota", "status",
    "prioridade", "observacoes",
]
TAREFAS_COLS = [
    "id", "disciplina", "nome", "descricao", "prazo", "prioridade", "status",
    "tempo_estimado", "observacoes",
]
CONTEUDOS_COLS = ["id", "disciplina", "titulo", "status", "ordem", "data_conclusao"]
ESTUDOS_COLS = ["id", "disciplina", "data", "duracao_min", "tipo", "observacoes"]
GRADE_COLS = ["disciplina", "periodo", "ordem"]
METAS_COLS = [
    "id", "tipo", "titulo", "alvo", "atual", "unidade", "disciplina",
    "data_inicio", "data_fim", "status",
]
CONFIG_COLS = ["chave", "valor"]


def _cell(value):
    """Normaliza valor de célula para string/número simples serializável."""
    if value is None:
        return None
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return value


def _sheet_to_dicts(ws):
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        return []
    header = [str(h).strip() if h is not None else "" for h in rows[0]]
    result = []
    for raw in rows[1:]:
        if all(v is None for v in raw):
            continue
        item = {}
        for i, key in enumerate(header):
            if not key:
                continue
            item[key] = _cell(raw[i]) if i < len(raw) else None
        result.append(item)
    return result


def _find_disciplina_id(conn, nome_ou_codigo):
    if not nome_ou_codigo:
        return None
    row = conn.execute(
        "SELECT id FROM disciplinas WHERE codigo = ? OR nome = ? LIMIT 1",
        (str(nome_ou_codigo), str(nome_ou_codigo)),
    ).fetchone()
    return row["id"] if row else None


def validar_arquivo(file_storage):
    """Valida upload antes de processar. Retorna (ok, mensagem_erro)."""
    filename = file_storage.filename or ""
    if not filename.lower().endswith(".xlsx"):
        return False, "Apenas arquivos .xlsx são permitidos."
    file_storage.stream.seek(0, os.SEEK_END)
    size = file_storage.stream.tell()
    file_storage.stream.seek(0)
    if size > MAX_XLSX_SIZE_BYTES:
        return False, "Arquivo excede o tamanho máximo de 10MB."
    if size == 0:
        return False, "Arquivo vazio."
    return True, None


def importar_xlsx(caminho_arquivo, modo="update"):
    """modo: 'add' (só insere o que não existe), 'update' (upsert),
    'replace' (limpa todas as tabelas de dados e insere do zero)."""
    if modo not in ("add", "update", "replace"):
        raise ValueError("Modo de importação inválido.")

    wb = load_workbook(caminho_arquivo, data_only=True)
    conn = get_connection()
    resumo = {"inseridos": 0, "atualizados": 0, "ignorados": 0}

    try:
        if modo == "replace":
            for tabela in [
                "pre_requisitos", "horarios", "avaliacoes", "tarefas", "conteudos",
                "sessoes_estudo", "metas", "grade_curricular", "disciplinas",
                "configuracoes",
            ]:
                conn.execute(f"DELETE FROM {tabela}")

        # 1) Disciplinas primeiro (outras tabelas dependem dela)
        if SHEET_DISCIPLINAS in wb.sheetnames:
            _importar_disciplinas(conn, wb[SHEET_DISCIPLINAS], modo, resumo)

        # 2) Grade curricular (associa período às disciplinas já existentes)
        if SHEET_GRADE in wb.sheetnames:
            _importar_grade(conn, wb[SHEET_GRADE], modo, resumo)

        # 3) Demais tabelas dependentes de disciplina
        if SHEET_AVALIACOES in wb.sheetnames:
            _importar_avaliacoes(conn, wb[SHEET_AVALIACOES], modo, resumo)
        if SHEET_TAREFAS in wb.sheetnames:
            _importar_tarefas(conn, wb[SHEET_TAREFAS], modo, resumo)
        if SHEET_CONTEUDOS in wb.sheetnames:
            _importar_conteudos(conn, wb[SHEET_CONTEUDOS], modo, resumo)
        if SHEET_ESTUDOS in wb.sheetnames:
            _importar_estudos(conn, wb[SHEET_ESTUDOS], modo, resumo)
        if SHEET_METAS in wb.sheetnames:
            _importar_metas(conn, wb[SHEET_METAS], modo, resumo)
        if SHEET_CONFIG in wb.sheetnames:
            _importar_config(conn, wb[SHEET_CONFIG], resumo)

        conn.commit()
        return resumo
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def _upsert_by_match(conn, tabela, where_sql, where_params, dados, modo, resumo):
    """Helper genérico: busca registro existente por where_sql; decide inserir/
    atualizar/ignorar conforme o modo."""
    existente = conn.execute(f"SELECT id FROM {tabela} WHERE {where_sql}", where_params).fetchone()
    colunas = list(dados.keys())
    if existente:
        if modo == "add":
            resumo["ignorados"] += 1
            return existente["id"]
        set_sql = ", ".join(f"{c} = ?" for c in colunas)
        conn.execute(
            f"UPDATE {tabela} SET {set_sql} WHERE id = ?",
            [dados[c] for c in colunas] + [existente["id"]],
        )
        resumo["atualizados"] += 1
        return existente["id"]
    else:
        cols_sql = ", ".join(colunas)
        placeholders = ", ".join("?" for _ in colunas)
        cur = conn.execute(
            f"INSERT INTO {tabela} ({cols_sql}) VALUES ({placeholders})",
            [dados[c] for c in colunas],
        )
        resumo["inseridos"] += 1
        return cur.lastrowid


def _importar_disciplinas(conn, ws, modo, resumo):
    linhas = _sheet_to_dicts(ws)
    pendencias_prereq = []  # (disciplina_id, "codigoA,codigoB")
    for linha in linhas:
        nome = linha.get("nome")
        if not nome:
            continue
        codigo = linha.get("codigo")
        dados = {
            "nome": nome,
            "codigo": codigo,
            "professor": linha.get("professor"),
            "periodo": int(linha["periodo"]) if linha.get("periodo") not in (None, "") else 1,
            "carga_horaria": linha.get("carga_horaria"),
            "creditos": linha.get("creditos"),
            "sala": linha.get("sala"),
            "status": linha.get("status") or "planejada",
            "media": linha.get("media"),
            "frequencia": linha.get("frequencia"),
            "cor": linha.get("cor") or "#6366f1",
            "observacoes": linha.get("observacoes"),
        }
        where_sql = "codigo = ?" if codigo else "nome = ?"
        where_params = (codigo,) if codigo else (nome,)
        disciplina_id = _upsert_by_match(conn, "disciplinas", where_sql, where_params, dados, modo, resumo)
        if linha.get("pre_requisitos"):
            pendencias_prereq.append((disciplina_id, str(linha["pre_requisitos"])))

    # Resolve pré-requisitos após todas as disciplinas existirem
    for disciplina_id, texto in pendencias_prereq:
        conn.execute("DELETE FROM pre_requisitos WHERE disciplina_id = ?", (disciplina_id,))
        for ref in [p.strip() for p in texto.split(",") if p.strip()]:
            requisito_id = _find_disciplina_id(conn, ref)
            if requisito_id and requisito_id != disciplina_id:
                conn.execute(
                    "INSERT OR IGNORE INTO pre_requisitos (disciplina_id, requisito_id) VALUES (?, ?)",
                    (disciplina_id, requisito_id),
                )


def _importar_grade(conn, ws, modo, resumo):
    for linha in _sheet_to_dicts(ws):
        disciplina_id = _find_disciplina_id(conn, linha.get("disciplina"))
        if not disciplina_id:
            resumo["ignorados"] += 1
            continue
        periodo = int(linha["periodo"]) if linha.get("periodo") not in (None, "") else 1
        ordem = int(linha["ordem"]) if linha.get("ordem") not in (None, "") else 0
        existente = conn.execute(
            "SELECT id FROM grade_curricular WHERE disciplina_id = ?", (disciplina_id,)
        ).fetchone()
        if existente:
            if modo != "add":
                conn.execute(
                    "UPDATE grade_curricular SET periodo = ?, ordem = ? WHERE id = ?",
                    (periodo, ordem, existente["id"]),
                )
                resumo["atualizados"] += 1
            else:
                resumo["ignorados"] += 1
        else:
            conn.execute(
                "INSERT INTO grade_curricular (disciplina_id, periodo, ordem) VALUES (?, ?, ?)",
                (disciplina_id, periodo, ordem),
            )
            resumo["inseridos"] += 1
        conn.execute("UPDATE disciplinas SET periodo = ? WHERE id = ?", (periodo, disciplina_id))


def _importar_avaliacoes(conn, ws, modo, resumo):
    for linha in _sheet_to_dicts(ws):
        disciplina_id = _find_disciplina_id(conn, linha.get("disciplina"))
        if not disciplina_id:
            resumo["ignorados"] += 1
            continue
        titulo = linha.get("titulo") or "Avaliação"
        data_str = str(linha.get("data") or "")
        dados = {
            "disciplina_id": disciplina_id,
            "tipo": linha.get("tipo") or "prova",
            "titulo": titulo,
            "data": data_str or None,
            "peso": float(linha["peso"]) if linha.get("peso") not in (None, "") else 1.0,
            "nota": linha.get("nota"),
            "status": linha.get("status") or "pendente",
            "prioridade": linha.get("prioridade") or "media",
            "observacoes": linha.get("observacoes"),
        }
        _upsert_by_match(
            conn, "avaliacoes",
            "disciplina_id = ? AND titulo = ? AND (data = ? OR (data IS NULL AND ? IS NULL))",
            (disciplina_id, titulo, data_str or None, data_str or None),
            dados, modo, resumo,
        )
        _recalcular_media(conn, disciplina_id)


def _importar_tarefas(conn, ws, modo, resumo):
    for linha in _sheet_to_dicts(ws):
        disciplina_id = _find_disciplina_id(conn, linha.get("disciplina"))
        nome = linha.get("nome") or "Tarefa"
        prazo = str(linha.get("prazo") or "") or None
        dados = {
            "disciplina_id": disciplina_id,
            "nome": nome,
            "descricao": linha.get("descricao"),
            "prazo": prazo,
            "prioridade": linha.get("prioridade") or "media",
            "status": linha.get("status") or "pendente",
            "tempo_estimado": linha.get("tempo_estimado"),
            "observacoes": linha.get("observacoes"),
        }
        _upsert_by_match(
            conn, "tarefas",
            "nome = ? AND (disciplina_id = ? OR (disciplina_id IS NULL AND ? IS NULL)) AND (prazo = ? OR (prazo IS NULL AND ? IS NULL))",
            (nome, disciplina_id, disciplina_id, prazo, prazo),
            dados, modo, resumo,
        )


def _importar_conteudos(conn, ws, modo, resumo):
    for linha in _sheet_to_dicts(ws):
        disciplina_id = _find_disciplina_id(conn, linha.get("disciplina"))
        if not disciplina_id:
            resumo["ignorados"] += 1
            continue
        titulo = linha.get("titulo") or "Conteúdo"
        dados = {
            "disciplina_id": disciplina_id,
            "titulo": titulo,
            "status": linha.get("status") or "pendente",
            "ordem": int(linha["ordem"]) if linha.get("ordem") not in (None, "") else 0,
            "data_conclusao": str(linha.get("data_conclusao") or "") or None,
        }
        _upsert_by_match(
            conn, "conteudos", "disciplina_id = ? AND titulo = ?",
            (disciplina_id, titulo), dados, modo, resumo,
        )


def _importar_estudos(conn, ws, modo, resumo):
    for linha in _sheet_to_dicts(ws):
        disciplina_id = _find_disciplina_id(conn, linha.get("disciplina"))
        data_str = str(linha.get("data") or "")
        if not data_str or linha.get("duracao_min") in (None, ""):
            resumo["ignorados"] += 1
            continue
        dados = {
            "disciplina_id": disciplina_id,
            "data": data_str,
            "duracao_min": int(linha["duracao_min"]),
            "tipo": linha.get("tipo") or "estudo",
            "observacoes": linha.get("observacoes"),
        }
        # Sessões de estudo são registros históricos: em modo "add"/"update" sem
        # id explícito, evita duplicar comparando disciplina+data+duração+tipo.
        _upsert_by_match(
            conn, "sessoes_estudo",
            "data = ? AND duracao_min = ? AND tipo = ? AND (disciplina_id = ? OR (disciplina_id IS NULL AND ? IS NULL))",
            (data_str, int(linha["duracao_min"]), dados["tipo"], disciplina_id, disciplina_id),
            dados, modo, resumo,
        )


def _importar_metas(conn, ws, modo, resumo):
    for linha in _sheet_to_dicts(ws):
        titulo = linha.get("titulo") or "Meta"
        disciplina_id = _find_disciplina_id(conn, linha.get("disciplina"))
        dados = {
            "tipo": linha.get("tipo") or "horas",
            "titulo": titulo,
            "alvo": float(linha["alvo"]) if linha.get("alvo") not in (None, "") else 1.0,
            "atual": float(linha["atual"]) if linha.get("atual") not in (None, "") else 0.0,
            "unidade": linha.get("unidade"),
            "disciplina_id": disciplina_id,
            "data_inicio": str(linha.get("data_inicio") or "") or None,
            "data_fim": str(linha.get("data_fim") or "") or None,
            "status": linha.get("status") or "ativa",
        }
        _upsert_by_match(
            conn, "metas", "titulo = ? AND tipo = ?", (titulo, dados["tipo"]),
            dados, modo, resumo,
        )


def _importar_config(conn, ws, resumo):
    for linha in _sheet_to_dicts(ws):
        chave = linha.get("chave")
        if not chave:
            continue
        conn.execute(
            "INSERT INTO configuracoes (chave, valor) VALUES (?, ?) "
            "ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor",
            (chave, str(linha.get("valor")) if linha.get("valor") is not None else None),
        )
        resumo["atualizados"] += 1


def _recalcular_media(conn, disciplina_id):
    rows = conn.execute(
        "SELECT nota, peso FROM avaliacoes WHERE disciplina_id = ? AND nota IS NOT NULL",
        (disciplina_id,),
    ).fetchall()
    if not rows:
        return
    total_peso = sum(r["peso"] or 1 for r in rows)
    if total_peso <= 0:
        return
    media = sum((r["nota"] or 0) * (r["peso"] or 1) for r in rows) / total_peso
    conn.execute("UPDATE disciplinas SET media = ? WHERE id = ?", (round(media, 2), disciplina_id))


def exportar_xlsx(caminho_destino):
    """Gera um novo arquivo XLSX com o snapshot atual do SQLite."""
    conn = get_connection()
    try:
        wb = Workbook()
        wb.remove(wb.active)

        _export_disciplinas(conn, wb)
        _export_simples(
            conn, wb, SHEET_AVALIACOES, AVALIACOES_COLS,
            """SELECT a.id, d.nome AS disciplina, a.tipo, a.titulo, a.data, a.peso,
                      a.nota, a.status, a.prioridade, a.observacoes
               FROM avaliacoes a JOIN disciplinas d ON d.id = a.disciplina_id
               ORDER BY a.data""",
        )
        _export_simples(
            conn, wb, SHEET_TAREFAS, TAREFAS_COLS,
            """SELECT t.id, d.nome AS disciplina, t.nome, t.descricao, t.prazo,
                      t.prioridade, t.status, t.tempo_estimado, t.observacoes
               FROM tarefas t LEFT JOIN disciplinas d ON d.id = t.disciplina_id
               ORDER BY t.prazo""",
        )
        _export_simples(
            conn, wb, SHEET_CONTEUDOS, CONTEUDOS_COLS,
            """SELECT c.id, d.nome AS disciplina, c.titulo, c.status, c.ordem, c.data_conclusao
               FROM conteudos c JOIN disciplinas d ON d.id = c.disciplina_id
               ORDER BY d.nome, c.ordem""",
        )
        _export_simples(
            conn, wb, SHEET_ESTUDOS, ESTUDOS_COLS,
            """SELECT s.id, d.nome AS disciplina, s.data, s.duracao_min, s.tipo, s.observacoes
               FROM sessoes_estudo s LEFT JOIN disciplinas d ON d.id = s.disciplina_id
               ORDER BY s.data""",
        )
        _export_simples(
            conn, wb, SHEET_GRADE, GRADE_COLS,
            """SELECT d.nome AS disciplina, g.periodo, g.ordem
               FROM grade_curricular g JOIN disciplinas d ON d.id = g.disciplina_id
               ORDER BY g.periodo, g.ordem""",
        )
        _export_simples(
            conn, wb, SHEET_METAS, METAS_COLS,
            """SELECT m.id, m.tipo, m.titulo, m.alvo, m.atual, m.unidade,
                      d.nome AS disciplina, m.data_inicio, m.data_fim, m.status
               FROM metas m LEFT JOIN disciplinas d ON d.id = m.disciplina_id""",
        )
        _export_simples(
            conn, wb, SHEET_CONFIG, CONFIG_COLS,
            "SELECT chave, valor FROM configuracoes",
        )

        wb.save(caminho_destino)
        return caminho_destino
    finally:
        conn.close()


def _export_simples(conn, wb, nome_aba, colunas, sql):
    ws = wb.create_sheet(nome_aba)
    ws.append(colunas)
    for row in conn.execute(sql).fetchall():
        ws.append([row[c] if c in row.keys() else None for c in colunas])


def _export_disciplinas(conn, wb):
    ws = wb.create_sheet(SHEET_DISCIPLINAS)
    ws.append(DISCIPLINAS_COLS)
    disciplinas = conn.execute("SELECT * FROM disciplinas ORDER BY periodo, nome").fetchall()
    for d in disciplinas:
        prereqs = conn.execute(
            """SELECT req.codigo, req.nome FROM pre_requisitos pr
               JOIN disciplinas req ON req.id = pr.requisito_id
               WHERE pr.disciplina_id = ?""",
            (d["id"],),
        ).fetchall()
        prereq_txt = ", ".join((p["codigo"] or p["nome"]) for p in prereqs)
        ws.append([
            d["id"], d["nome"], d["codigo"], d["professor"], d["periodo"],
            d["carga_horaria"], d["creditos"], d["sala"], d["status"], d["media"],
            d["frequencia"], d["cor"], prereq_txt, d["observacoes"],
        ])
