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
  const alertKanji = document.querySelector('.alert-kanji');
  const logPanel = document.getElementById('logPanel');
  const logStream = document.getElementById('logStream');

  const SAGE_ORDER = ['melchior', 'balthasar', 'casper'];

  const KANJI_BY_STATE = {
    standby: '待機',
    busy: '演算',
    approve: '承認',
    reject: '否決',
    hold: '保留',
    error: '異常',
  };

  /* Fan-made pseudo-terminal lines — not real system output */
  const STANDBY_LINES = [
    { tag: 'MEL', cls: '', msg: '論理回路 アイドル · pattern hash 0xA7F3' },
    { tag: 'BAL', cls: '', msg: '感情倫理バッファ flush · residual 0.02' },
    { tag: 'CAS', cls: '', msg: '実務判断キュー empty · awaiting QUERY' },
    { tag: 'BUS', cls: 'ok', msg: 'MAGI-BUS-A sync OK · latency 12ms' },
    { tag: 'PWR', cls: '', msg: '冷却系 NOM · 核心温度 36.6℃' },
    { tag: 'NET', cls: '', msg: '外部リンク DEEPSEEK-BRIDGE standby' },
    { tag: 'CHK', cls: 'ok', msg: '自己診断 CYCLE-441 · 異常なし' },
    { tag: 'MEM', cls: '', msg: '作業記憶 12% · 長期索引 LOCKED' },
    { tag: 'SEC', cls: '', msg: '権限レベル OPERATOR · UNCLASS channel' },
    { tag: 'CLK', cls: '', msg: '内部時計 drift ±0.003s · NTP OK' },
    { tag: 'MEL', cls: '', msg: 'evidence matrix warm · no pending vote' },
    { tag: 'BAL', cls: 'warn', msg: '共感係数 bias check · within band' },
    { tag: 'CAS', cls: '', msg: '実行可能性モデル idle · cost=0' },
    { tag: 'SYS', cls: 'ok', msg: '三机同期率 99.7% · triad locked' },
    { tag: 'I/O', cls: '', msg: 'INPUT panel ready · UTF-8 · buf 2KB' },
    { tag: 'GEO', cls: '', msg: 'NODE GEOFRONT-01 · 第３新東京市' },
    { tag: 'MEL', cls: '', msg: '推論スロット free · ready for ballot' },
    { tag: 'BAL', cls: '', msg: '倫理フィルタ online · soft-guard ON' },
    { tag: 'CAS', cls: '', msg: '実務ヒューリスティック cache HIT' },
    { tag: 'HUD', cls: '', msg: 'コンソール描画 refresh · CRT overlay' },
    { tag: 'SYS', cls: '', msg: '待機シーケンス · 议题入力を待つ' },
    { tag: 'CHK', cls: 'ok', msg: 'heartbeat MAGI-Ω · pulse green' },
  ];

  const BUSY_LINES = [
    { tag: 'SYS', cls: 'warn', msg: '決議要求受信 · 三机並列起動' },
    { tag: 'MEL', cls: 'warn', msg: '論理判定回路 BOOST · evidence scan…' },
    { tag: 'BAL', cls: 'warn', msg: '感情倫理回路 BOOST · impact model…' },
    { tag: 'CAS', cls: 'warn', msg: '実務判断回路 BOOST · feasibility…' },
    { tag: 'BUS', cls: '', msg: 'MAGI-BUS 帯域割当 · parallel lane' },
    { tag: 'NET', cls: '', msg: 'DEEPSEEK-BRIDGE 送信中…' },
  ];

  let logTimer = null;
  let logMode = 'standby';

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
    if (alertKanji) {
      alertKanji.textContent = KANJI_BY_STATE[state] || KANJI_BY_STATE.standby;
    }
  }

  function tickClock() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    alertClock.textContent =
      pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());
  }

  function ts() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());
  }

  function lineHtml(entry) {
    const cls = entry.cls ? ' tag ' + entry.cls : ' tag';
    return (
      '<div class="log-line">' +
      '<span class="ts">' + ts() + '</span>' +
      '<span class="' + cls.trim() + '">[' + entry.tag + ']</span>' +
      entry.msg +
      '</div>'
    );
  }

  function buildLogHtml(lines) {
    // Duplicate for seamless CSS scroll
    const block = lines.map(lineHtml).join('');
    return block + block;
  }

  function setLogMode(mode) {
    logMode = mode;
    if (!logPanel || !logStream) return;
    logPanel.dataset.mode = mode;
    if (logTimer) {
      clearInterval(logTimer);
      logTimer = null;
    }
    logStream.classList.remove('scrolling');

    if (mode === 'standby') {
      logStream.innerHTML = buildLogHtml(STANDBY_LINES);
      // restart animation
      void logStream.offsetWidth;
      logStream.classList.add('scrolling');
    } else if (mode === 'busy') {
      logStream.innerHTML = BUSY_LINES.map(lineHtml).join('');
      let i = 0;
      logTimer = setInterval(function () {
        const entry = BUSY_LINES[i % BUSY_LINES.length];
        logStream.insertAdjacentHTML('beforeend', lineHtml(entry));
        i += 1;
        const kids = logStream.children;
        while (kids.length > 24) logStream.removeChild(kids[0]);
        const vp = logStream.parentElement;
        if (vp) vp.scrollTop = vp.scrollHeight;
      }, 700);
    }
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
      ' · 保留 ' + (c['保留'] || 0) +
      ' · 多数決完了';

    if (data.tie || data.decision === '决议保留') {
      setAlert('hold', 'DEC.HOLD', '多数未达成 · 决议保留');
    } else if (data.decision === '赞成') {
      setAlert('approve', 'DEC.YES', '决议完成 · 赞成');
    } else if (data.decision === '反对') {
      setAlert('reject', 'DEC.NO', '决议完成 · 反对');
    } else {
      setAlert('hold', 'DEC.HOLD', '决议完成 · ' + data.decision);
    }

    setLogMode('standby');
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
    setLogMode('busy');
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
      setLogMode('standby');
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
  setLogMode('standby');
})();
