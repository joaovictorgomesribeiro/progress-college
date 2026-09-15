/* Meu Sistema de Estudos - Estatísticas (gráficos simples, sem dependências externas) */

registerPage("estatisticas", {
  async render(container) {
    const stats = await Api.obterEstatisticas();
    const maiorHoras = Math.max(1, ...stats.horas_por_disciplina.map((h) => h.horas));
    const maiorMinutos = Math.max(1, ...stats.serie_dias.map((d) => d.minutos));

    container.innerHTML = `
      <h1>Estatísticas</h1>

      <div class="card" style="margin-bottom:16px;">
        <h3>📈 Progresso do curso</h3>
        <div class="progress-bar" style="margin:10px 0;"><span style="width:${stats.progresso_curso.percentual}%"></span></div>
        <div class="foco-sub">${stats.progresso_curso.concluidas} / ${stats.progresso_curso.total} matérias concluídas (${stats.progresso_curso.percentual}%)</div>
      </div>

      <div class="card" style="margin-bottom:16px;">
        <h3>⏱️ Horas por matéria</h3>
        <div class="bar-chart">
          ${stats.horas_por_disciplina.length ? stats.horas_por_disciplina.map((h) => `
            <div class="bar-row">
              <span class="bar-label">${h.nome}</span>
              <div class="bar-track"><div class="bar-fill" style="width:${(h.horas / maiorHoras) * 100}%; background:${h.cor || "var(--primary)"};"></div></div>
              <span class="bar-value">${h.horas}h</span>
            </div>`).join("") : emptyState("⏱️", "Sem sessões registradas ainda.")}
        </div>
      </div>

      <div class="card" style="margin-bottom:16px;">
        <h3>📅 Últimos 14 dias</h3>
        <div class="mini-cols scroll-x">
          ${stats.serie_dias.map((d) => `
            <div class="mini-col">
              <div class="mini-bar" style="height:${Math.max(2, (d.minutos / maiorMinutos) * 90)}px;"></div>
              <div class="mini-label">${d.data.slice(8, 10)}</div>
            </div>`).join("")}
        </div>
      </div>

      <div class="card" style="margin-bottom:16px;">
        <h3>🎓 Evolução das notas</h3>
        ${stats.evolucao_notas.length ? `<div class="scroll-x"><table class="data-table">
          <thead><tr><th>Data</th><th>Matéria</th><th>Avaliação</th><th>Nota</th></tr></thead>
          <tbody>${stats.evolucao_notas.map((n) => `<tr><td>${formatarData(n.data)}</td><td>${n.disciplina_nome}</td><td>${n.titulo}</td><td>${n.nota}</td></tr>`).join("")}</tbody>
        </table></div>` : emptyState("🎓", "Nenhuma nota lançada ainda.")}
      </div>

      <div class="stat-grid">
        ${donutCard("Conteúdos", stats.conteudos_status, { pendente: "var(--warning)", andamento: "var(--info)", concluido: "var(--success)" })}
        ${donutCard("Tarefas", stats.tarefas_status, { pendente: "var(--warning)", andamento: "var(--info)", concluida: "var(--success)" })}
      </div>
    `;
  },
});

function donutCard(titulo, statusMap, cores) {
  const total = Object.values(statusMap).reduce((s, n) => s + n, 0);
  const legendas = Object.entries(statusMap).map(([status, n]) => `
    <div class="foco-sub"><span style="color:${cores[status] || "var(--text-muted)"};">●</span> ${status} (${n})</div>
  `).join("");
  let gradient = "var(--border)";
  if (total > 0) {
    let acumulado = 0;
    const partes = Object.entries(statusMap).map(([status, n]) => {
      const inicio = (acumulado / total) * 100;
      acumulado += n;
      const fim = (acumulado / total) * 100;
      return `${cores[status] || "var(--text-muted)"} ${inicio}% ${fim}%`;
    });
    gradient = partes.join(", ");
  }
  return `<div class="stat-card" style="grid-column: span 2;">
    <h3 style="margin-bottom:10px;">${titulo}</h3>
    <div class="donut" style="background: conic-gradient(${gradient});"></div>
    <div style="margin-top:10px;">${legendas || emptyState("📊", "Sem dados.")}</div>
  </div>`;
}
