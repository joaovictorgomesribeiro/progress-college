/* Meu Sistema de Estudos - Dashboard / Foco do dia */

const NIVEL_EMOJI = { alta: "🔴", media: "🟠", baixa: "🟡" };

registerPage("dashboard", {
  async render(container) {
    const dash = await Api.obterDashboard();

    if (!dash.tem_dados) {
      container.innerHTML = `
        <div class="welcome-wrap">
          <span class="welcome-emoji">📚</span>
          <h1>Meu Sistema de Estudos</h1>
          <p class="foco-sub">Bem-vindo! Seu sistema ainda não possui dados cadastrados.<br>Você pode começar de duas formas:</p>
          <div class="welcome-actions">
            <button class="btn btn-primary btn-block" id="btn-comecar-cadastrar">+ Começar a cadastrar</button>
            <p class="foco-sub">Cadastre suas disciplinas, tarefas, avaliações e outros dados manualmente.</p>
            <p class="foco-sub" style="margin:4px 0;">ou</p>
            <button class="btn btn-block" id="btn-ir-importar">📥 Importar XLSX</button>
            <p class="foco-sub">Importe uma planilha caso já possua seus dados.</p>
          </div>
        </div>`;
      container.querySelector("#btn-comecar-cadastrar").addEventListener("click", () => { location.hash = "#/disciplinas"; });
      container.querySelector("#btn-ir-importar").addEventListener("click", () => { location.hash = "#/config"; });
      return;
    }

    container.innerHTML = `
      <h1>Início</h1>

      <div class="stat-grid">
        ${statCard("📚", dash.total_disciplinas, "matérias")}
        ${statCard("✅", `${dash.tarefas_concluidas}/${dash.tarefas_total}`, "tarefas concluídas")}
        ${statCard("📝", dash.avaliacoes_proximas, "avaliações próximas")}
        ${statCard("⏱️", `${dash.horas_semana}h`, "estudadas essa semana")}
      </div>

      <div class="section-title"><h2>🎯 Foco de hoje</h2></div>
      <div class="foco-list">
        ${dash.foco_do_dia.length ? dash.foco_do_dia.map(focoItem).join("") : emptyFoco()}
      </div>
    `;
  },
});

function statCard(icon, value, label) {
  return `<div class="stat-card">
    <div class="stat-icon">${icon}</div>
    <div class="stat-value">${value}</div>
    <div class="stat-label">${label}</div>
  </div>`;
}

function focoItem(f) {
  return `<div class="foco-item" data-nivel="${f.nivel}">
    <span class="foco-dot">${NIVEL_EMOJI[f.nivel] || "🟡"}</span>
    <div>
      <div class="foco-titulo">${f.titulo}</div>
      <div class="foco-sub">${f.subtitulo}</div>
      <div class="foco-detalhe">${f.detalhe}</div>
    </div>
  </div>`;
}

function emptyFoco() {
  return `<div class="empty-state"><span class="empty-emoji">✨</span>Nada urgente por agora. Bom trabalho!</div>`;
}
