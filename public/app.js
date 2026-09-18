(function () {
  const questionEl = document.getElementById('question');
  const voteBtn = document.getElementById('voteBtn');
  const statusEl = document.getElementById('status');
  const resultPanel = document.getElementById('resultPanel');
  const decisionValue = document.getElementById('decisionValue');
  const decisionBanner = document.getElementById('decisionBanner');
  const countsEl = document.getElementById('counts');
  const alertBar = document.getElementById('alertBar');
  const alertCode = document.getElementById('alertCode');
  const alertMsg = document.getElementById('alertMsg');
  const alertClock = document.getElementById('alertClock');

  const SAGE_ORDER = ['melchior', 'balthasar', 'casper'];

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

  function bannerState(decision, tie) {
    if (tie || decision === '决议保留') return 'hold';
    if (decision === '赞成') return 'approve';
    if (decision === '反对') return 'reject';
    return 'hold';
  }

  function setStatus(text, kind) {
    statusEl.textContent = text || '';
    statusEl.className = 'status' + (kind ? ' ' + kind : '');
  }

  function setAlert(state, code, msg) {
    alertBar.dataset.state = state || 'standby';
    alertCode.textContent = code;
    alertMsg.textContent = msg;
  }

  function tickClock() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    alertClock.textContent =
      pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());
  }

  function cardEl(id) {
    return document.getElementById('card-' + id);
  }

  function setCardsBusy() {
    for (const id of SAGE_ORDER) {
      const card = cardEl(id);
      card.className = 'magi-card busy';
      card.querySelector('[data-field="vote"]').textContent = '演算中';
      card.querySelector('[data-field="reason"]').textContent = '并行推理…';
    }
  }

  function resetCardsIdle() {
    for (const id of SAGE_ORDER) {
      const card = cardEl(id);
      card.className = 'magi-card idle';
      card.querySelector('[data-field="vote"]').textContent = '—';
      card.querySelector('[data-field="reason"]').textContent = '待机中';
    }
  }

  function render(data) {
    resultPanel.hidden = false;
    const dClass = decisionClass(data.decision, data.tie);
    const bState = bannerState(data.decision, data.tie);
    decisionValue.textContent = data.decision;
    decisionValue.className = 'decision-value ' + dClass;
    decisionBanner.dataset.state = bState;

    const byId = {};
    for (const r of data.results || []) {
      byId[r.id] = r;
    }

    for (const id of SAGE_ORDER) {
      const r = byId[id];
      const card = cardEl(id);
      if (!r) {
        card.className = 'magi-card idle';
        card.querySelector('[data-field="vote"]').textContent = '—';
        card.querySelector('[data-field="reason"]').textContent = '无响应';
        continue;
      }
      const vc = voteClass(r.vote);
      card.className = 'magi-card ' + vc;
      const nameEl = card.querySelector('.magi-name');
      const roleEl = card.querySelector('.magi-role');
      if (nameEl && r.name) nameEl.textContent = r.name;
      if (roleEl && r.label) roleEl.textContent = r.label;
      card.querySelector('[data-field="vote"]').textContent = r.vote;
      card.querySelector('[data-field="reason"]').textContent = r.reason || '';
    }

    const c = data.counts || {};
    countsEl.textContent =
      '票数统计 · 赞成 ' + (c['赞成'] || 0) +
      ' · 反对 ' + (c['反对'] || 0) +
      ' · 保留 ' + (c['保留'] || 0);

    if (data.tie || data.decision === '决议保留') {
      setAlert('hold', 'DEC.HOLD', '多数未达成 · 决议保留');
    } else if (data.decision === '赞成') {
      setAlert('approve', 'DEC.YES', '决议完成 · 赞成');
    } else if (data.decision === '反对') {
      setAlert('reject', 'DEC.NO', '决议完成 · 反对');
    } else {
      setAlert('hold', 'DEC.HOLD', '决议完成 · ' + data.decision);
    }
  }

  async function runVote() {
    const question = questionEl.value.trim();
    if (!question) {
      setStatus('请输入议题', 'err');
      setAlert('error', 'ERR.INPUT', '议题为空 · 请输入后重试');
      return;
    }

    voteBtn.disabled = true;
    setStatus('MAGI 三机并行演算中…', 'busy');
    setAlert('busy', 'SYS.COMPUTE', 'MAGI 三机并行演算中…');
    setCardsBusy();
    resultPanel.hidden = true;

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
      resetCardsIdle();
      setStatus(err.message || '请求失败', 'err');
      setAlert('error', 'ERR.LINK', err.message || '请求失败');
    } finally {
      voteBtn.disabled = false;
    }
  }

  voteBtn.addEventListener('click', runVote);
  questionEl.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') runVote();
  });

  tickClock();
  setInterval(tickClock, 1000);
})();
