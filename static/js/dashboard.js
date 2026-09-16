/* Meu Sistema de Estudos - Dashboard */

registerPage("dashboard", {
  async render(container) {
    const dash = await Api.obterDashboard();

    if (!dash.tem_dados) {
      container.innerHTML = `
        <div class="welcome-wrap">
          <span class="brand-mark" style="width:40px;height:40px;font-size:15px;border-radius:10px;margin-bottom:8px;">ME</span>
          <h1>Meu Sistema de Estudos</h1>
          <p class="welcome-lede">Bem-vindo! Seu sistema ainda não possui dados cadastrados. Você pode começar de duas formas.</p>
          <div class="welcome-actions">
            <button class="btn btn-primary btn-block" id="btn-comecar-cadastrar">Começar a cadastrar</button>
            <p class="field-hint">Cadastre suas disciplinas, tarefas, avaliações e outros dados manualmente.</p>
            <button class="btn btn-block" id="btn-ir-importar">Importar planilha (.xlsx)</button>
            <p class="field-hint">Importe uma planilha caso já possua seus dados.</p>
          </div>
        </div>`;
      container.querySelector("#btn-comecar-cadastrar").addEventListener("click", () => { location.hash = "#/disciplinas"; });
      container.querySelector("#btn-ir-importar").addEventListener("click", () => { location.hash = "#/config"; });
      return;
    }

    const disciplinas = await Api.listarDisciplinas({ status: "andamento" });
    const tarefasPendentes = dash.tarefas_total - dash.tarefas_concluidas;
    const focoAvaliacoes = dash.foco_do_dia.filter((f) => f.tipo === "avaliacao").slice(0, 4);
    const focoTarefas = dash.foco_do_dia.filter((f) => f.tipo === "tarefa").slice(0, 5);

    container.innerHTML = `
      <div class="page-header"><h1>${saudacao()}</h1></div>
      <p class="page-subtitle">Veja como estão seus estudos hoje.</p>

      <div class="stat-line">
        <div class="stat-item"><span class="stat-value">${tarefasPendentes}</span><span class="stat-label">tarefas pendentes</span></div>
        <div class="stat-item"><span class="stat-value">${dash.avaliacoes_proximas}</span><span class="stat-label">avaliações próximas</span></div>
        <div class="stat-item"><span class="stat-value">${dash.horas_semana}h</span><span class="stat-label">estudadas essa semana</span></div>
      </div>

      <div class="section">
        <div class="section-header"><h2>Próximas avaliações</h2><a class="section-action" href="#/avaliacoes">Ver todas</a></div>
        <div class="list">
          ${focoAvaliacoes.length ? focoAvaliacoes.map(avaliacaoRow).join("") : `<p class="empty-state" style="padding:var(--space-4) 0;">Nenhuma avaliação nos próximos dias.</p>`}
        </div>
      </div>

      <div class="section">
        <div class="section-header"><h2>Tarefas pendentes</h2><a class="section-action" href="#/tarefas">Ver todas</a></div>
        <div class="list">
          ${focoTarefas.length ? focoTarefas.map(tarefaRow).join("") : `<p class="empty-state" style="padding:var(--space-4) 0;">Nenhuma tarefa urgente. Bom trabalho.</p>`}
        </div>
      </div>

      <div class="section">
        <div class="section-header"><h2>Progresso das disciplinas</h2><a class="section-action" href="#/disciplinas">Ver todas</a></div>
        <div class="list">
          ${disciplinas.length ? disciplinas.slice(0, 5).map(disciplinaProgressoRow).join("") : `<p class="empty-state" style="padding:var(--space-4) 0;">Nenhuma disciplina em andamento no momento.</p>`}
        </div>
      </div>
    `;

    container.querySelectorAll(".list-row[data-goto]").forEach((row) => {
      row.addEventListener("click", () => { location.hash = row.dataset.goto; });
    });
  },
});

function saudacao() {
  const hora = new Date().getHours();
  if (hora < 5) return "Boa noite";
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

const NIVEL_DOT = { alta: "dot-danger", media: "dot-warning", baixa: "dot-info" };

function avaliacaoRow(f) {
  return `<div class="list-row" data-goto="#/avaliacoes">
    <span class="dot ${NIVEL_DOT[f.nivel] || "dot-info"}"></span>
    <div class="list-row-main">
      <div class="list-row-title">${f.titulo}</div>
      <div class="list-row-sub">${f.subtitulo}</div>
    </div>
    <div class="list-row-meta">${f.detalhe}</div>
  </div>`;
}

function tarefaRow(f) {
  return `<div class="list-row" data-goto="#/tarefas">
    <span class="dot ${NIVEL_DOT[f.nivel] || "dot-info"}"></span>
    <div class="list-row-main">
      <div class="list-row-title">${f.titulo}</div>
      <div class="list-row-sub">${f.subtitulo}</div>
    </div>
    <div class="list-row-meta">${f.detalhe}</div>
  </div>`;
}

function disciplinaProgressoRow(d) {
  return `<div class="list-row" data-goto="#/disciplinas/${d.id}">
    <div class="list-row-main">
      <div class="list-row-title">${d.nome}</div>
      <div class="progress-bar" style="margin-top:6px; max-width:220px;"><span style="width:${d.progresso || 0}%"></span></div>
    </div>
    <div class="list-row-meta">${d.progresso || 0}%</div>
  </div>`;
}
