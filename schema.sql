-- Meu Sistema de Estudos - schema SQLite
-- Todas as tabelas usam id numérico autoincrement como chave primária.

PRAGMA foreign_keys = ON;

-- Catálogo acadêmico oficial (universidades/cursos/ementas). Ainda não é
-- alimentado por nenhuma tela do sistema (a importação de fichas em PDF é
-- um trabalho futuro) - esta tabela só prepara o terreno para que, quando
-- existir, "disciplinas" possa opcionalmente apontar para um registro aqui
-- via "catalogo_disciplina_id" sem exigir nenhuma migração de dados.
CREATE TABLE IF NOT EXISTS disciplinas_catalogo (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    universidade    TEXT,
    curso           TEXT,
    codigo          TEXT,
    nome            TEXT NOT NULL,
    carga_horaria   INTEGER,
    ementa          TEXT,
    programa        TEXT,
    bibliografia    TEXT,
    criado_em       TEXT DEFAULT (datetime('now'))
);

-- Disciplinas do usuário (cadastradas manualmente hoje; futuramente também
-- poderão ser criadas a partir de uma seleção no catálogo acima).
CREATE TABLE IF NOT EXISTS disciplinas (
    id                     INTEGER PRIMARY KEY AUTOINCREMENT,
    nome                   TEXT NOT NULL,
    codigo                 TEXT,
    professor              TEXT,
    periodo                INTEGER DEFAULT 1,
    carga_horaria          INTEGER,
    creditos               INTEGER,
    sala                   TEXT,
    status                 TEXT DEFAULT 'planejada',   -- concluida | andamento | planejada | bloqueada
    media                  REAL,
    frequencia             REAL,
    cor                    TEXT DEFAULT '#6366f1',
    observacoes            TEXT,
    catalogo_disciplina_id INTEGER,   -- opcional: vínculo futuro com disciplinas_catalogo
    criado_em              TEXT DEFAULT (datetime('now')),
    atualizado_em          TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (catalogo_disciplina_id) REFERENCES disciplinas_catalogo(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS horarios (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    disciplina_id   INTEGER NOT NULL,
    dia_semana      INTEGER NOT NULL,  -- 0=domingo .. 6=sabado
    hora_inicio     TEXT,
    hora_fim        TEXT,
    FOREIGN KEY (disciplina_id) REFERENCES disciplinas(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS pre_requisitos (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    disciplina_id   INTEGER NOT NULL,
    requisito_id    INTEGER NOT NULL,
    FOREIGN KEY (disciplina_id) REFERENCES disciplinas(id) ON DELETE CASCADE,
    FOREIGN KEY (requisito_id) REFERENCES disciplinas(id) ON DELETE CASCADE,
    UNIQUE(disciplina_id, requisito_id)
);

CREATE TABLE IF NOT EXISTS avaliacoes (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    disciplina_id   INTEGER NOT NULL,
    tipo            TEXT NOT NULL,       -- prova | trabalho | lista | seminario | projeto
    titulo          TEXT NOT NULL,
    data            TEXT,
    peso            REAL DEFAULT 1,
    nota            REAL,
    status          TEXT DEFAULT 'pendente',  -- pendente | concluida
    prioridade      TEXT DEFAULT 'media',     -- baixa | media | alta
    observacoes     TEXT,
    FOREIGN KEY (disciplina_id) REFERENCES disciplinas(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tarefas (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    disciplina_id   INTEGER,
    nome            TEXT NOT NULL,
    descricao       TEXT,
    prazo           TEXT,
    prioridade      TEXT DEFAULT 'media',      -- baixa | media | alta
    status          TEXT DEFAULT 'pendente',   -- pendente | andamento | concluida
    tempo_estimado  REAL,
    observacoes     TEXT,
    criado_em       TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (disciplina_id) REFERENCES disciplinas(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS conteudos (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    disciplina_id   INTEGER NOT NULL,
    titulo          TEXT NOT NULL,
    status          TEXT DEFAULT 'pendente',   -- pendente | andamento | concluido
    ordem           INTEGER DEFAULT 0,
    data_conclusao  TEXT,
    FOREIGN KEY (disciplina_id) REFERENCES disciplinas(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sessoes_estudo (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    disciplina_id   INTEGER,
    data            TEXT NOT NULL,
    duracao_min     INTEGER NOT NULL,
    tipo            TEXT DEFAULT 'estudo',     -- estudo | revisao | exercicios | pomodoro
    observacoes     TEXT,
    FOREIGN KEY (disciplina_id) REFERENCES disciplinas(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS metas (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo            TEXT NOT NULL,      -- horas | exercicios | conteudos | disciplina
    titulo          TEXT NOT NULL,
    alvo            REAL NOT NULL,
    atual           REAL DEFAULT 0,
    unidade         TEXT,
    disciplina_id   INTEGER,
    data_inicio     TEXT,
    data_fim        TEXT,
    status          TEXT DEFAULT 'ativa',   -- ativa | concluida | expirada
    FOREIGN KEY (disciplina_id) REFERENCES disciplinas(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS grade_curricular (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    disciplina_id   INTEGER NOT NULL UNIQUE,
    periodo         INTEGER NOT NULL,
    ordem           INTEGER DEFAULT 0,
    FOREIGN KEY (disciplina_id) REFERENCES disciplinas(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS configuracoes (
    chave   TEXT PRIMARY KEY,
    valor   TEXT
);
