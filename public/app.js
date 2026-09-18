(function () {
  const questionEl = document.getElementById('question');
  const voteBtn = document.getElementById('voteBtn');
  const statusEl = document.getElementById('status');
  const resultPanel = document.getElementById('resultPanel');
  const decisionValue = document.getElementById('decisionValue');
  const decisionBanner = document.getElementById('decisionBanner');
  const magiGrid = document.getElementById('magiGrid');
  const countsEl = document.getElementById('counts');

  function voteClass(vote) {
    if (vote === '赞成') return 'approve';
    if (vote === '反对') return 'reject';
    return 'hold';
  }

  function decisionClass(decision, tie) {
    if (tie || decision === '决议保留') return 'tie';
    if (decision === '赞成') return 'approve';
    if (decision === '反对') return 'reject';
    return 'hold';
  }

  function setStatus(text, kind) {
    statusEl.textContent = text || '';
    statusEl.className = 'status' + (kind ? ' ' + kind : '');
  }

  function render(data) {
    resultPanel.hidden = false;
    decisionValue.textContent = data.decision;
    decisionValue.className = 'decision-value ' + decisionClass(data.decision, data.tie);

    magiGrid.innerHTML = '';
    for (const r of data.results) {
      const card = document.createElement('article');
      card.className = 'magi-card ' + voteClass(r.vote);
      card.innerHTML =
        '<div class="magi-name">' + escapeHtml(r.name) + '</div>' +
        '<div class="magi-role">' + escapeHtml(r.label) + '</div>' +
        '<div class="magi-vote">' + escapeHtml(r.vote) + '</div>' +
        '<div class="magi-reason">' + escapeHtml(r.reason) + '</div>';
      magiGrid.appendChild(card);
    }

    const c = data.counts || {};
    countsEl.textContent =
      '票数统计 · 赞成 ' + (c['赞成'] || 0) +
      ' · 反对 ' + (c['反对'] || 0) +
      ' · 保留 ' + (c['保留'] || 0);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async function runVote() {
    const question = questionEl.value.trim();
    if (!question) {
      setStatus('请输入议题', 'err');
      return;
    }

    voteBtn.disabled = true;
    setStatus('MAGI 三机并行演算中…', 'busy');

    try {
      const res = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || ('HTTP ' + res.status));
      }
      render(data);
      setStatus(data.tie ? '多数未达成 · 决议保留' : '决议完成', data.tie ? 'err' : '');
    } catch (err) {
      setStatus(err.message || '请求失败', 'err');
    } finally {
      voteBtn.disabled = false;
    }
  }

  voteBtn.addEventListener('click', runVote);
  questionEl.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') runVote();
  });
})();
