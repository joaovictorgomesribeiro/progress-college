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


def _carregar_mapa_disciplinas(conn, usuario_id):
    """Pré-carrega {codigo/nome -> id} das disciplinas do usuário numa única
    consulta, para que as demais abas (avaliações, tarefas, conteúdos...) não
    precisem de um SELECT por linha da planilha para resolver a disciplina."""
    mapa = {}
    for row in conn.execute(
        "SELECT id, nome, codigo FROM disciplinas WHERE usuario_id = ?", (usuario_id,)
    ).fetchall():
        if row["codigo"]:
            mapa[str(row["codigo"])] = row["id"]
        mapa[str(row["nome"])] = row["id"]
    return mapa


def _find_disciplina_id(mapa, nome_ou_codigo):
    if not nome_ou_codigo:
        return None
    return mapa.get(str(nome_ou_codigo))


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


def importar_xlsx(caminho_arquivo, modo, usuario_id):
    """modo: 'add' (só insere o que não existe), 'update' (upsert),
    'replace' (limpa os dados desse usuário e insere do zero).
    Toda a importação é isolada a usuario_id - nunca afeta dados de outra conta."""
    if modo not in ("add", "update", "replace"):
        raise ValueError("Modo de importação inválido.")
    if not usuario_id:
        raise ValueError("Usuário inválido.")

    wb = load_workbook(caminho_arquivo, data_only=True)
    conn = get_connection()
    resumo = {"inseridos": 0, "atualizados": 0, "ignorados": 0}

    try:
        if modo == "replace":
            # Apaga só os dados do usuário atual. avaliacoes/conteudos/horarios/
            # pre_requisitos/grade_curricular somem sozinhos via ON DELETE CASCADE
            # ao apagar as disciplinas do usuário. "configuracoes" é global e
            # não é tocada aqui.
            conn.execute("DELETE FROM tarefas WHERE usuario_id = ?", (usuario_id,))
            conn.execute("DELETE FROM sessoes_estudo WHERE usuario_id = ?", (usuario_id,))
            conn.execute("DELETE FROM metas WHERE usuario_id = ?", (usuario_id,))
            conn.execute("DELETE FROM disciplinas WHERE usuario_id = ?", (usuario_id,))

        # Mapa {codigo/nome -> id} das disciplinas do usuário, carregado uma
        # única vez e mantido atualizado conforme novas disciplinas entram -
        # evita 1 SELECT por linha de planilha nas abas que referenciam
        # disciplina por nome/código (avaliações, tarefas, conteúdos, etc).
        mapa_disciplinas = _carregar_mapa_disciplinas(conn, usuario_id)

        # 1) Disciplinas primeiro (outras tabelas dependem dela)
        if SHEET_DISCIPLINAS in wb.sheetnames:
            _importar_disciplinas(conn, wb[SHEET_DISCIPLINAS], modo, resumo, usuario_id, mapa_disciplinas)

        # 2) Grade curricular (associa período às disciplinas já existentes)
        if SHEET_GRADE in wb.sheetnames:
            _importar_grade(conn, wb[SHEET_GRADE], modo, resumo, mapa_disciplinas)

        # 3) Demais tabelas dependentes de disciplina
        if SHEET_AVALIACOES in wb.sheetnames:
            _importar_avaliacoes(conn, wb[SHEET_AVALIACOES], modo, resumo, mapa_disciplinas)
        if SHEET_TAREFAS in wb.sheetnames:
            _importar_tarefas(conn, wb[SHEET_TAREFAS], modo, resumo, usuario_id, mapa_disciplinas)
        if SHEET_CONTEUDOS in wb.sheetnames:
            _importar_conteudos(conn, wb[SHEET_CONTEUDOS], modo, resumo, mapa_disciplinas)
        if SHEET_ESTUDOS in wb.sheetnames:
            _importar_estudos(conn, wb[SHEET_ESTUDOS], modo, resumo, usuario_id, mapa_disciplinas)
        if SHEET_METAS in wb.sheetnames:
            _importar_metas(conn, wb[SHEET_METAS], modo, resumo, usuario_id, mapa_disciplinas)
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


def _importar_disciplinas(conn, ws, modo, resumo, usuario_id, mapa_disciplinas):
    linhas = _sheet_to_dicts(ws)
    pendencias_prereq = []  # (disciplina_id, "codigoA,codigoB")
    for linha in linhas:
        nome = linha.get("nome")
        if not nome:
            continue
        codigo = linha.get("codigo")
        dados = {
            "usuario_id": usuario_id,
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
        where_sql = "usuario_id = ? AND " + ("codigo = ?" if codigo else "nome = ?")
        where_params = (usuario_id, codigo) if codigo else (usuario_id, nome)
        disciplina_id = _upsert_by_match(conn, "disciplinas", where_sql, where_params, dados, modo, resumo)
        if codigo:
            mapa_disciplinas[str(codigo)] = disciplina_id
        mapa_disciplinas[str(nome)] = disciplina_id
        if linha.get("pre_requisitos"):
            pendencias_prereq.append((disciplina_id, str(linha["pre_requisitos"])))

    # Resolve pré-requisitos após todas as disciplinas existirem
    for disciplina_id, texto in pendencias_prereq:
        conn.execute("DELETE FROM pre_requisitos WHERE disciplina_id = ?", (disciplina_id,))
        for ref in [p.strip() for p in texto.split(",") if p.strip()]:
            requisito_id = _find_disciplina_id(mapa_disciplinas, ref)
            if requisito_id and requisito_id != disciplina_id:
                conn.execute(
                    "INSERT OR IGNORE INTO pre_requisitos (disciplina_id, requisito_id) VALUES (?, ?)",
                    (disciplina_id, requisito_id),
                )


def _importar_grade(conn, ws, modo, resumo, mapa_disciplinas):
    for linha in _sheet_to_dicts(ws):
        disciplina_id = _find_disciplina_id(mapa_disciplinas, linha.get("disciplina"))
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


def _importar_avaliacoes(conn, ws, modo, resumo, mapa_disciplinas):
    for linha in _sheet_to_dicts(ws):
        disciplina_id = _find_disciplina_id(mapa_disciplinas, linha.get("disciplina"))
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


def _importar_tarefas(conn, ws, modo, resumo, usuario_id, mapa_disciplinas):
    for linha in _sheet_to_dicts(ws):
        disciplina_id = _find_disciplina_id(mapa_disciplinas, linha.get("disciplina"))
        nome = linha.get("nome") or "Tarefa"
        prazo = str(linha.get("prazo") or "") or None
        dados = {
            "usuario_id": usuario_id,
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
            "usuario_id = ? AND nome = ? AND (disciplina_id = ? OR (disciplina_id IS NULL AND ? IS NULL)) AND (prazo = ? OR (prazo IS NULL AND ? IS NULL))",
            (usuario_id, nome, disciplina_id, disciplina_id, prazo, prazo),
            dados, modo, resumo,
        )


def _importar_conteudos(conn, ws, modo, resumo, mapa_disciplinas):
    for linha in _sheet_to_dicts(ws):
        disciplina_id = _find_disciplina_id(mapa_disciplinas, linha.get("disciplina"))
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


def _importar_estudos(conn, ws, modo, resumo, usuario_id, mapa_disciplinas):
    for linha in _sheet_to_dicts(ws):
        disciplina_id = _find_disciplina_id(mapa_disciplinas, linha.get("disciplina"))
        data_str = str(linha.get("data") or "")
        if not data_str or linha.get("duracao_min") in (None, ""):
            resumo["ignorados"] += 1
            continue
        dados = {
            "usuario_id": usuario_id,
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
            "usuario_id = ? AND data = ? AND duracao_min = ? AND tipo = ? AND (disciplina_id = ? OR (disciplina_id IS NULL AND ? IS NULL))",
            (usuario_id, data_str, int(linha["duracao_min"]), dados["tipo"], disciplina_id, disciplina_id),
            dados, modo, resumo,
        )


def _importar_metas(conn, ws, modo, resumo, usuario_id, mapa_disciplinas):
    for linha in _sheet_to_dicts(ws):
        titulo = linha.get("titulo") or "Meta"
        disciplina_id = _find_disciplina_id(mapa_disciplinas, linha.get("disciplina"))
        dados = {
            "usuario_id": usuario_id,
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
            conn, "metas", "usuario_id = ? AND titulo = ? AND tipo = ?", (usuario_id, titulo, dados["tipo"]),
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
        "SELECT nota FROM avaliacoes WHERE disciplina_id = ? AND nota IS NOT NULL",
        (disciplina_id,),
    ).fetchall()
    if not rows:
        return
    # Cada avaliação vale um tanto de pontos (campo "peso") de um total de 100
    # por disciplina; a nota lançada já é a quantidade de pontos conquistados
    # naquela avaliação, então a nota final é a soma direta, não uma média.
    media = sum(r["nota"] or 0 for r in rows)
    conn.execute("UPDATE disciplinas SET media = ? WHERE id = ?", (round(media, 2), disciplina_id))


def exportar_xlsx(caminho_destino, usuario_id):
    """Gera um novo arquivo XLSX com o snapshot atual do SQLite - apenas com
    os dados do usuário informado."""
    conn = get_connection()
    try:
        wb = Workbook()
        wb.remove(wb.active)

        _export_disciplinas(conn, wb, usuario_id)
        _export_simples(
            conn, wb, SHEET_AVALIACOES, AVALIACOES_COLS,
            """SELECT a.id, d.nome AS disciplina, a.tipo, a.titulo, a.data, a.peso,
                      a.nota, a.status, a.prioridade, a.observacoes
               FROM avaliacoes a JOIN disciplinas d ON d.id = a.disciplina_id
               WHERE d.usuario_id = ? ORDER BY a.data""",
            (usuario_id,),
        )
        _export_simples(
            conn, wb, SHEET_TAREFAS, TAREFAS_COLS,
            """SELECT t.id, d.nome AS disciplina, t.nome, t.descricao, t.prazo,
                      t.prioridade, t.status, t.tempo_estimado, t.observacoes
               FROM tarefas t LEFT JOIN disciplinas d ON d.id = t.disciplina_id
               WHERE t.usuario_id = ? ORDER BY t.prazo""",
            (usuario_id,),
        )
        _export_simples(
            conn, wb, SHEET_CONTEUDOS, CONTEUDOS_COLS,
            """SELECT c.id, d.nome AS disciplina, c.titulo, c.status, c.ordem, c.data_conclusao
               FROM conteudos c JOIN disciplinas d ON d.id = c.disciplina_id
               WHERE d.usuario_id = ? ORDER BY d.nome, c.ordem""",
            (usuario_id,),
        )
        _export_simples(
            conn, wb, SHEET_ESTUDOS, ESTUDOS_COLS,
            """SELECT s.id, d.nome AS disciplina, s.data, s.duracao_min, s.tipo, s.observacoes
               FROM sessoes_estudo s LEFT JOIN disciplinas d ON d.id = s.disciplina_id
               WHERE s.usuario_id = ? ORDER BY s.data""",
            (usuario_id,),
        )
        _export_simples(
            conn, wb, SHEET_GRADE, GRADE_COLS,
            """SELECT d.nome AS disciplina, g.periodo, g.ordem
               FROM grade_curricular g JOIN disciplinas d ON d.id = g.disciplina_id
               WHERE d.usuario_id = ? ORDER BY g.periodo, g.ordem""",
            (usuario_id,),
        )
        _export_simples(
            conn, wb, SHEET_METAS, METAS_COLS,
            """SELECT m.id, m.tipo, m.titulo, m.alvo, m.atual, m.unidade,
                      d.nome AS disciplina, m.data_inicio, m.data_fim, m.status
               FROM metas m LEFT JOIN disciplinas d ON d.id = m.disciplina_id
               WHERE m.usuario_id = ?""",
            (usuario_id,),
        )
        # "configuracoes" é uma tabela global (não pertence a nenhum usuário
        # específico hoje), por isso não entra na exportação pessoal.

        wb.save(caminho_destino)
        return caminho_destino
    finally:
        conn.close()


def _export_simples(conn, wb, nome_aba, colunas, sql, params=()):
    ws = wb.create_sheet(nome_aba)
    ws.append(colunas)
    for row in conn.execute(sql, params).fetchall():
        ws.append([row[c] if c in row.keys() else None for c in colunas])


def _export_disciplinas(conn, wb, usuario_id):
    ws = wb.create_sheet(SHEET_DISCIPLINAS)
    ws.append(DISCIPLINAS_COLS)
    disciplinas = conn.execute(
        "SELECT * FROM disciplinas WHERE usuario_id = ? ORDER BY periodo, nome", (usuario_id,)
    ).fetchall()
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
