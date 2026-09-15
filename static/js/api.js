/* Meu Sistema de Estudos - camada de acesso à API REST */

const Api = (() => {
  async function request(path, options = {}) {
    const opts = { headers: {}, ...options };
    if (opts.body && !(opts.body instanceof FormData)) {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(opts.body);
    }
    const res = await fetch(`/api${path}`, opts);
    let data = null;
    try { data = await res.json(); } catch (e) { data = null; }
    if (!res.ok) {
      const msg = (data && data.error) || `Erro ${res.status}`;
      throw new Error(msg);
    }
    return data;
  }

  const get = (path) => request(path);
  const post = (path, body) => request(path, { method: "POST", body });
  const put = (path, body) => request(path, { method: "PUT", body });
  const del = (path) => request(path, { method: "DELETE" });

  return {
    // Disciplinas
    listarDisciplinas: (params = {}) => get(`/disciplinas${qs(params)}`),
    obterDisciplina: (id) => get(`/disciplinas/${id}`),
    criarDisciplina: (dados) => post("/disciplinas", dados),
    atualizarDisciplina: (id, dados) => put(`/disciplinas/${id}`, dados),
    excluirDisciplina: (id) => del(`/disciplinas/${id}`),

    // Avaliações
    listarAvaliacoes: (params = {}) => get(`/avaliacoes${qs(params)}`),
    criarAvaliacao: (dados) => post("/avaliacoes", dados),
    atualizarAvaliacao: (id, dados) => put(`/avaliacoes/${id}`, dados),
    excluirAvaliacao: (id) => del(`/avaliacoes/${id}`),

    // Tarefas
    listarTarefas: (params = {}) => get(`/tarefas${qs(params)}`),
    criarTarefa: (dados) => post("/tarefas", dados),
    atualizarTarefa: (id, dados) => put(`/tarefas/${id}`, dados),
    excluirTarefa: (id) => del(`/tarefas/${id}`),

    // Conteúdos
    listarConteudos: (params = {}) => get(`/conteudos${qs(params)}`),
    criarConteudo: (dados) => post("/conteudos", dados),
    atualizarConteudo: (id, dados) => put(`/conteudos/${id}`, dados),
    excluirConteudo: (id) => del(`/conteudos/${id}`),

    // Estudos
    listarEstudos: (params = {}) => get(`/estudos${qs(params)}`),
    criarEstudo: (dados) => post("/estudos", dados),
    excluirEstudo: (id) => del(`/estudos/${id}`),

    // Metas
    listarMetas: (params = {}) => get(`/metas${qs(params)}`),
    criarMeta: (dados) => post("/metas", dados),
    atualizarMeta: (id, dados) => put(`/metas/${id}`, dados),
    excluirMeta: (id) => del(`/metas/${id}`),

    // Grade
    obterGrade: () => get("/grade"),
    atualizarPosicaoGrade: (disciplinaId, dados) => put(`/grade/${disciplinaId}`, dados),

    // Config
    obterConfig: () => get("/config"),
    atualizarConfig: (dados) => put("/config", dados),

    // Dashboard / estatísticas
    obterDashboard: () => get("/dashboard"),
    obterEstatisticas: () => get("/estatisticas"),

    // Import/export
    async importarXlsx(arquivo, modo) {
      const fd = new FormData();
      fd.append("arquivo", arquivo);
      fd.append("modo", modo);
      return request("/importar", { method: "POST", body: fd });
    },
    exportarXlsxUrl: () => "/api/exportar",
  };

  function qs(params) {
    const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "");
    if (!entries.length) return "";
    return "?" + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
  }
})();
