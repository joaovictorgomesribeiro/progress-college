/* Meu Sistema de Estudos - Estatísticas (gráficos simples, sem dependências externas) */

registerPage("estatisticas", {
  async render(container) {
    const stats = await Api.obterEstatisticas();
    const maiorHoras = Math.max(1, ...stats.horas_por_disciplina.map((h) => h.horas));
    const maiorMinutos = Math.max(1, ...stats.serie_dias.map((d) => d.minutos));

    container.innerHTML = `
      <div class="page-header"><h1>Estatísticas</h1></div>

      <div class="section">
        <div class="section-header"><h2>Progresso do curso</h2></div>
        <div class="progress-bar" style="margin-bottom:var(--space-2);"><span style="width:${stats.progresso_curso.percentual}%"></span></div>
        <div class="field-hint">${stats.progresso_curso.concluidas} de ${stats.progresso_curso.total} matérias concluídas (${stats.progresso_curso.percentual}%)</div>
      </div>

      <div class="section">
        <div class="section-header"><h2>Horas por matéria</h2></div>
        <div class="bar-chart">
          ${stats.horas_por_disciplina.length ? stats.horas_por_disciplina.map((h) => `
            <div class="bar-row">
              <span class="bar-label">${h.nome}</span>
              <div class="bar-track"><div class="bar-fill" style="width:${(h.horas / maiorHoras) * 100}%;"></div></div>
              <span class="bar-value">${h.horas}h</span>
            </div>`).join("") : `<p class="empty-state">Sem sessões registradas ainda.</p>`}
        </div>
      </div>

      <div class="section">
        <div class="section-header"><h2>Últimos 14 dias</h2></div>
        <div class="mini-cols scroll-x">
          ${stats.serie_dias.map((d) => `
            <div class="mini-col">
              <div class="mini-bar" style="height:${Math.max(2, (d.minutos / maiorMinutos) * 80)}px;"></div>
              <div class="mini-label">${d.data.slice(8, 10)}</div>
            </div>`).join("")}
        </div>
      </div>

      <div class="section">
        <div class="section-header"><h2>Evolução das notas</h2></div>
        ${stats.evolucao_notas.length ? `<div class="scroll-x"><table class="data-table">
          <thead><tr><th>Data</th><th>Matéria</th><th>Avaliação</th><th>Nota</th></tr></thead>
          <tbody>${stats.evolucao_notas.map((n) => `<tr><td>${formatarData(n.data)}</td><td>${n.disciplina_nome}</td><td>${n.titulo}</td><td>${n.nota}</td></tr>`).join("")}</tbody>
        </table></div>` : `<p class="empty-state">Nenhuma nota lançada ainda.</p>`}
      </div>

      <div class="section">
        <div class="section-header"><h2>Conteúdos e tarefas</h2></div>
        <div class="field-row">
          ${statusResumo("Conteúdos", stats.conteudos_status)}
          ${statusResumo("Tarefas", stats.tarefas_status)}
        </div>
      </div>
    `;
  },
});

const STATUS_DOT_MAP = { pendente: "dot-warning", andamento: "dot-info", concluido: "dot-success", concluida: "dot-success" };
const STATUS_LABEL_MAP = { pendente: "Pendente", andamento: "Em andamento", concluido: "Concluído", concluida: "Concluída" };

function statusResumo(titulo, statusMap) {
  const total = Object.values(statusMap).reduce((s, n) => s + n, 0);
  return `<div class="panel" style="flex:1;">
    <div class="list-row-sub" style="margin-bottom:var(--space-2);">${titulo}</div>
    ${total ? Object.entries(statusMap).map(([status, n]) => `
      <div style="display:flex; align-items:center; gap:var(--space-2); font-size:13px; padding:4px 0;">
        <span class="dot ${STATUS_DOT_MAP[status] || "dot"}"></span>
        <span style="flex:1;">${STATUS_LABEL_MAP[status] || status}</span>
        <span style="font-weight:600;">${n}</span>
      </div>
    `).join("") : `<p class="empty-state" style="padding:var(--space-2) 0;">Sem dados.</p>`}
  </div>`;
}
