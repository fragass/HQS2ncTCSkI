document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('tetris');
  const context = canvas.getContext('2d');
  context.scale(20, 20);

  const nextCanvas1 = document.getElementById('next1');
  const nextCtx1 = nextCanvas1.getContext('2d'); nextCtx1.scale(20, 20);
  const nextCanvas2 = document.getElementById('next2');
  const nextCtx2 = nextCanvas2.getContext('2d'); nextCtx2.scale(20, 20);
  const nextCanvas3 = document.getElementById('next3');
  const nextCtx3 = nextCanvas3.getContext('2d'); nextCtx3.scale(20, 20);

  const startPauseBtn = document.getElementById('startPauseBtn');
  const overlay = document.getElementById('overlayPopup');
  const overlayTitle = document.getElementById('overlayTitle');
  const overlayInfo = document.getElementById('overlayInfo');
  const overlayBtn = document.getElementById('overlayBtn');

  const BEST_SCORE_KEY = 'workday_best_score';
  const PREVIEW_BG = '#0a0f14';
  let bestScore = Number(sessionStorage.getItem(BEST_SCORE_KEY) || localStorage.getItem(BEST_SCORE_KEY) || 0) || 0;

  const arena = createMatrix(10, 20);
  const colors = [null, '#00ffff', '#ffff00', '#800080', '#00ff00', '#ff0000', '#0000ff', '#ffa500'];
  const typeMap = [null, 'I', 'O', 'T', 'S', 'Z', 'J', 'L'];

  const player = {
    pos: { x: 0, y: 0 },
    matrix: null,
    score: 0,
    next: [],
    hold: null,
    canHold: true,
    lines: 0,
    level: 1,
  };

  let dropCounter = 0;
  let dropInterval = 1000;
  let lastTime = 0;
  let started = false;
  let paused = false;
  let gameOver = false;
  let lineClearAnimation = null;

  const audioState = {
    ctx: null,
    enabled: false,
  };

  function ensureAudio() {
    if (audioState.ctx) return audioState.ctx;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    audioState.ctx = new AudioCtx();
    audioState.enabled = true;
    return audioState.ctx;
  }

  function resumeAudio() {
    const ctx = ensureAudio();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function tone(frequency, startDelay, duration, type = 'square', volume = 0.03) {
    const ctx = ensureAudio();
    if (!ctx) return;
    const startTime = ctx.currentTime + startDelay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, startTime);
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(Math.max(volume, 0.0002), startTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  }

  function playMoveSound() { tone(220, 0, 0.05, 'square', 0.018); }
  function playRotateSound() { tone(330, 0, 0.05, 'square', 0.02); tone(415, 0.04, 0.05, 'square', 0.016); }
  function playSoftDropSound() { tone(165, 0, 0.04, 'square', 0.016); }
  function playHardDropSound() { tone(120, 0, 0.06, 'square', 0.03); tone(90, 0.03, 0.08, 'square', 0.024); }
  function playStartSound() { [262,330,392,523].forEach((f, i) => tone(f, i * 0.055, 0.08, 'square', 0.025)); }
  function playGameOverSound() { [330,247,196,147].forEach((f, i) => tone(f, i * 0.09, 0.12, 'triangle', 0.03)); }
  function playLineClearSound(lines) {
    const patterns = {
      1: [523,659],
      2: [523,659,784],
      3: [659,784,988],
      4: [784,988,1175,1568],
    };
    (patterns[lines] || patterns[1]).forEach((f, i) => tone(f, i * 0.05, 0.08, 'square', 0.028));
  }

  let pieceBag = [];
  function refillBag() {
    pieceBag = 'IJLOTSZ'.split('');
    for (let i = pieceBag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pieceBag[i], pieceBag[j]] = [pieceBag[j], pieceBag[i]];
    }
  }

  function randomPiece() {
    if (pieceBag.length === 0) refillBag();
    return pieceBag.pop();
  }

  function createMatrix(w, h) {
    const m = [];
    while (h--) m.push(new Array(w).fill(0));
    return m;
  }

  function createPiece(t) {
    switch (t) {
      case 'I': return [[0,1,0,0],[0,1,0,0],[0,1,0,0],[0,1,0,0]];
      case 'O': return [[2,2],[2,2]];
      case 'T': return [[0,3,0],[3,3,3],[0,0,0]];
      case 'S': return [[0,4,4],[4,4,0],[0,0,0]];
      case 'Z': return [[5,5,0],[0,5,5],[0,0,0]];
      case 'J': return [[6,0,0],[6,6,6],[0,0,0]];
      case 'L': return [[0,0,7],[7,7,7],[0,0,0]];
      default: return [[0]];
    }
  }

  function collide(arenaData, p) {
    if (!p.matrix) return false;
    const m = p.matrix;
    const o = p.pos;

    for (let y = 0; y < m.length; y++) {
      for (let x = 0; x < m[y].length; x++) {
        if (m[y][x] !== 0) {
          const ay = y + o.y;
          const ax = x + o.x;
          if (ay < 0 || ay >= arenaData.length || ax < 0 || ax >= arenaData[0].length) return true;
          if (arenaData[ay][ax] !== 0) return true;
        }
      }
    }

    return false;
  }

  function pieceTypeOf(matrix) {
    for (let y = 0; y < matrix.length; y++) {
      for (let x = 0; x < matrix[y].length; x++) {
        const value = matrix[y][x];
        if (value !== 0) return typeMap[value];
      }
    }
    return null;
  }

  function createPieceDifferentFrom(excludeType) {
    let t = randomPiece();
    while (t === excludeType) t = randomPiece();
    return createPiece(t);
  }

  function updateBestScore() {
    if (player.score > bestScore) {
      bestScore = player.score;
      sessionStorage.setItem(BEST_SCORE_KEY, String(bestScore));
      localStorage.setItem(BEST_SCORE_KEY, String(bestScore));
    }
  }

  function merge(arenaData, p) {
    p.matrix.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value !== 0) arenaData[y + p.pos.y][x + p.pos.x] = value;
      });
    });

    const rows = getFullRows();
    if (rows.length > 0) {
      startLineClearAnimation(rows);
      return true;
    }

    return false;
  }

  function rotate(matrix, dir) {
    for (let y = 0; y < matrix.length; y++) {
      for (let x = 0; x < y; x++) {
        [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
      }
    }
    if (dir > 0) matrix.forEach(row => row.reverse());
    else matrix.reverse();
  }

  function drawBlock(ctx, x, y, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 1, 1);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(x + 0.08, y + 0.08, 0.84, 0.14);
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(x + 0.08, y + 0.24, 0.18, 0.46);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(x + 0.78, y + 0.1, 0.12, 0.8);
    ctx.fillRect(x + 0.1, y + 0.78, 0.8, 0.12);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 0.06;
    ctx.strokeRect(x + 0.03, y + 0.03, 0.94, 0.94);
  }

  function getFullRows() {
    const rows = [];
    for (let y = arena.length - 1; y >= 0; --y) {
      let full = true;
      for (let x = 0; x < arena[y].length; ++x) {
        if (arena[y][x] === 0) {
          full = false;
          break;
        }
      }
      if (full) rows.push(y);
    }
    return rows;
  }

  function removeRows(rows) {
    rows.sort((a, b) => a - b);
    for (let i = rows.length - 1; i >= 0; i--) {
      const y = rows[i];
      const removed = arena.splice(y, 1)[0];
      removed.fill(0);
      arena.unshift(removed);
    }
  }

  function createLineParticles(rows) {
    const particles = [];
    rows.forEach(y => {
      for (let x = 0; x < arena[0].length; x++) {
        const value = arena[y][x];
        if (!value) continue;
        for (let i = 0; i < 5; i++) {
          particles.push({
            x: x + 0.5,
            y: y + 0.5,
            vx: (Math.random() - 0.5) * 0.28,
            vy: (Math.random() - 0.75) * 0.34,
            size: 0.12 + Math.random() * 0.14,
            color: colors[value],
          });
        }
      }
    });
    return particles;
  }

  function startLineClearAnimation(rows) {
    lineClearAnimation = {
      rows: [...rows],
      elapsed: 0,
      duration: 230,
      particles: createLineParticles(rows),
      finished: false,
    };
    playLineClearSound(rows.length);
  }

  function updateLineClearAnimation(delta) {
    if (!lineClearAnimation || lineClearAnimation.finished) return;
    lineClearAnimation.elapsed += delta;
    const progress = Math.min(lineClearAnimation.elapsed / lineClearAnimation.duration, 1);

    lineClearAnimation.particles.forEach(p => {
      p.x += p.vx * (delta / 16.666);
      p.y += p.vy * (delta / 16.666);
      p.vy += 0.012 * (delta / 16.666);
      p.size *= 0.988;
    });

    if (progress >= 1) {
      const cleared = lineClearAnimation.rows.length;
      removeRows(lineClearAnimation.rows);
      player.lines += cleared;
      player.score += cleared * 100 * player.level;
      checkLevelUp();
      updateBestScore();
      updateScoreboard();
      lineClearAnimation.finished = true;
      lineClearAnimation = null;
      playerReset();
    }
  }

  function playerRotate(dir) {
    if (!started || paused || gameOver || lineClearAnimation || !player.matrix) return;
    const pos = player.pos.x;
    let offset = 1;

    rotate(player.matrix, dir);
    while (collide(arena, player)) {
      player.pos.x += offset;
      offset = -(offset + (offset > 0 ? 1 : -1));
      if (offset > player.matrix[0].length) {
        rotate(player.matrix, -dir);
        player.pos.x = pos;
        return;
      }
    }

    playRotateSound();
  }

  function lockCurrentPieceAndContinue() {
    const createdClearAnimation = merge(arena, player);
    player.canHold = true;

    if (player.pos.y === 0 && !createdClearAnimation) {
      showGameOver();
      return;
    }

    if (!createdClearAnimation) playerReset();
  }

  function playerSoftDrop() {
    if (!started || paused || gameOver || lineClearAnimation || !player.matrix) return;
    player.pos.y++;

    if (collide(arena, player)) {
      player.pos.y--;
      lockCurrentPieceAndContinue();
    } else {
      player.score += 1 * player.level;
      updateBestScore();
      updateScoreboard();
      playSoftDropSound();
    }

    dropCounter = 0;
  }

  function autoDrop() {
    if (!started || paused || gameOver || lineClearAnimation || !player.matrix) return;
    player.pos.y++;

    if (collide(arena, player)) {
      player.pos.y--;
      lockCurrentPieceAndContinue();
    }

    dropCounter = 0;
  }

  function playerMove(dir) {
    if (!started || paused || gameOver || lineClearAnimation || !player.matrix) return;
    player.pos.x += dir;
    if (collide(arena, player)) {
      player.pos.x -= dir;
      return;
    }
    playMoveSound();
  }

  function playerHold() {
    if (!started || paused || gameOver || lineClearAnimation || !player.matrix || !player.canHold) return;

    const prevType = pieceTypeOf(player.matrix);
    player.canHold = false;

    if (player.hold === null) {
      player.hold = player.matrix;

      let candidate = player.next.shift();
      if (pieceTypeOf(candidate) === prevType) candidate = createPieceDifferentFrom(prevType);

      player.matrix = candidate;
      player.next.push(createPiece(randomPiece()));
      resetPlayerPosition();
      drawNext();
      playRotateSound();
      if (collide(arena, player)) showGameOver();
      return;
    }

    const temp = player.hold;
    player.hold = player.matrix;

    let candidate = temp;
    if (pieceTypeOf(candidate) === prevType) candidate = createPieceDifferentFrom(prevType);

    player.matrix = candidate;
    resetPlayerPosition();
    playRotateSound();
    if (collide(arena, player)) showGameOver();
  }

  function resetPlayerPosition() {
    if (!player.matrix) return;
    player.pos.y = 0;
    player.pos.x = (arena[0].length / 2 | 0) - (player.matrix[0].length / 2 | 0);
  }

  function playerReset() {
    if (!started) return;

    if (player.next.length === 0) {
      for (let i = 0; i < 3; i++) player.next.push(createPiece(randomPiece()));
    }

    player.matrix = player.next.shift();
    resetPlayerPosition();
    player.next.push(createPiece(randomPiece()));
    drawNext();

    if (collide(arena, player)) showGameOver();
  }

  function clearPreview(ctx) {
    ctx.setTransform(20, 0, 0, 20, 0, 0);
    ctx.fillStyle = PREVIEW_BG;
    ctx.fillRect(0, 0, 5, 5);
  }

  function hardReset() {
    arena.forEach(row => row.fill(0));
    player.score = 0;
    player.lines = 0;
    player.level = 1;
    player.matrix = null;
    player.next = [];
    player.hold = null;
    player.canHold = true;
    player.pos.x = 0;
    player.pos.y = 0;
    dropCounter = 0;
    lastTime = 0;
    dropInterval = 1000;
    lineClearAnimation = null;
    updateScoreboard();

    [nextCtx1, nextCtx2, nextCtx3].forEach(clearPreview);
  }

  function drawMatrix(matrix, offset, colorOverride = null, ctx = context) {
    matrix.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value !== 0) {
          const color = colorOverride ? colorOverride : colors[value];
          drawBlock(ctx, x + offset.x, y + offset.y, color);
        }
      });
    });
  }

  function drawGhost() {
    if (!player.matrix || gameOver) return;
    const ghost = { pos: { x: player.pos.x, y: player.pos.y }, matrix: player.matrix };
    while (!collide(arena, ghost)) ghost.pos.y++;
    ghost.pos.y--;
    drawMatrix(ghost.matrix, ghost.pos, 'rgba(255,255,255,0.18)');
  }

  function drawArena() {
    context.fillStyle = '#070d1c';
    context.fillRect(0, 0, canvas.width / 20, canvas.height / 20);

    context.strokeStyle = 'rgba(255,255,255,0.04)';
    context.lineWidth = 0.04;
    for (let x = 0; x <= arena[0].length; x++) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, arena.length);
      context.stroke();
    }
    for (let y = 0; y <= arena.length; y++) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(arena[0].length, y);
      context.stroke();
    }

    for (let y = 0; y < arena.length; y++) {
      for (let x = 0; x < arena[y].length; x++) {
        const value = arena[y][x];
        if (value !== 0) drawBlock(context, x, y, colors[value]);
      }
    }

    if (lineClearAnimation) {
      const progress = Math.min(lineClearAnimation.elapsed / lineClearAnimation.duration, 1);
      const flashAlpha = 0.28 + Math.abs(Math.sin(progress * Math.PI * 6)) * 0.58;
      lineClearAnimation.rows.forEach(y => {
        context.fillStyle = `rgba(255,255,255,${flashAlpha})`;
        context.fillRect(0, y, arena[0].length, 1);
        const shrink = progress * 0.45;
        context.fillStyle = 'rgba(255,217,77,0.35)';
        context.fillRect(shrink, y + 0.18, arena[0].length - (shrink * 2), 0.64);
      });

      lineClearAnimation.particles.forEach(particle => {
        if (particle.size <= 0.02) return;
        context.fillStyle = particle.color;
        context.fillRect(particle.x - particle.size / 2, particle.y - particle.size / 2, particle.size, particle.size);
      });
    }
  }

  function draw() {
    drawArena();
    if (player.matrix && !lineClearAnimation) {
      if (!gameOver) drawGhost();
      drawMatrix(player.matrix, player.pos);
    }
  }

  function drawNext() {
    [nextCtx1, nextCtx2, nextCtx3].forEach(clearPreview);

    const nextList = player.next.slice(0, 3);
    const ctxs = [nextCtx1, nextCtx2, nextCtx3];

    nextList.forEach((piece, i) => {
      const ctx = ctxs[i];
      if (!piece) return;
      const w = piece[0].length;
      const h = piece.length;
      const offsetX = Math.floor((5 - w) / 2);
      const offsetY = Math.floor((5 - h) / 2);
      drawMatrix(piece, { x: offsetX, y: offsetY }, null, ctx);
    });
  }

  function update(time = 0) {
    const delta = time - lastTime;
    lastTime = time;

    if (started && !paused && !gameOver) {
      if (lineClearAnimation) {
        updateLineClearAnimation(delta);
      } else {
        dropCounter += delta;
        if (dropCounter > dropInterval) autoDrop();
      }
    }

    draw();
    requestAnimationFrame(update);
  }

  function checkLevelUp() {
    const newLevel = Math.floor(player.lines / 10) + 1;
    if (newLevel !== player.level) {
      player.level = newLevel;
      dropInterval = Math.max(1000 * Math.pow(0.92, player.level - 1), 250);
    }
  }

  function updateScoreboard() {
    const el = document.getElementById('scoreboard');
    if (!el) return;
    el.textContent = 'Score: ' + player.score + ' | Linhas: ' + player.lines + ' | Level: ' + player.level + ' | Recorde: ' + bestScore;
  }

  function showGameOver() {
    updateBestScore();
    updateScoreboard();
    gameOver = true;
    paused = true;
    lineClearAnimation = null;
    overlay.style.display = 'flex';
    overlayTitle.textContent = 'Fim de jogo';
    overlayInfo.textContent = 'Score: ' + player.score + ' · Recorde: ' + bestScore;
    overlayBtn.textContent = 'Novo jogo';
    startPauseBtn.textContent = 'Retomar';
    startPauseBtn.classList.remove('start', 'pause');
    startPauseBtn.classList.add('resume');
    playGameOverSound();
  }

  function startPauseToggle() {
    resumeAudio();
    if (gameOver) return;

    if (overlay.style.display === 'flex' && overlayTitle.textContent.toUpperCase() === 'TETRIS') {
      startFromOverlay();
      return;
    }

    if (!started) {
      started = true;
      paused = false;
      playerReset();
      updateScoreboard();
      startPauseBtn.textContent = 'Pausar';
      startPauseBtn.classList.remove('start', 'resume');
      startPauseBtn.classList.add('pause');
      playStartSound();
    } else if (paused) {
      paused = false;
      startPauseBtn.textContent = 'Pausar';
      startPauseBtn.classList.remove('resume');
      startPauseBtn.classList.add('pause');
      playStartSound();
    } else {
      paused = true;
      startPauseBtn.textContent = 'Retomar';
      startPauseBtn.classList.remove('pause');
      startPauseBtn.classList.add('resume');
    }
  }

  function startFromOverlay() {
    resumeAudio();
    overlay.style.display = 'none';
    overlayTitle.textContent = 'TETRIS';
    overlayInfo.textContent = 'Pressione P para pausar ou R para reiniciar.';
    overlayBtn.textContent = 'Iniciar';
    started = true;
    paused = false;
    gameOver = false;
    playerReset();
    updateScoreboard();
    startPauseBtn.textContent = 'Pausar';
    startPauseBtn.classList.remove('start', 'resume');
    startPauseBtn.classList.add('pause');
    playStartSound();
  }

  function restartGame() {
    resumeAudio();
    overlay.style.display = 'none';
    gameOver = false;
    hardReset();
    started = true;
    paused = false;
    playerReset();
    updateScoreboard();
    startPauseBtn.textContent = 'Pausar';
    startPauseBtn.classList.remove('start', 'resume');
    startPauseBtn.classList.add('pause');
    playStartSound();
  }

  document.addEventListener('keydown', (e) => {
    const keyLower = e.key.toLowerCase();
    if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(keyLower)) e.preventDefault();

    if (['p', 'r', 'c', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' '].includes(keyLower) || e.code === 'Space') {
      resumeAudio();
    }

    if (keyLower === 'p') {
      startPauseToggle();
      return;
    }

    if (keyLower === 'r') {
      restartGame();
      return;
    }

    if (!started || paused || gameOver || lineClearAnimation) return;

    if (e.key === 'ArrowLeft') {
      playerMove(-1);
    } else if (e.key === 'ArrowRight') {
      playerMove(1);
    } else if (e.key === 'ArrowDown') {
      playerSoftDrop();
    } else if (e.key === 'ArrowUp') {
      playerRotate(1);
    } else if (e.code === 'Space') {
      let dropDistance = 0;
      while (true) {
        player.pos.y++;
        if (collide(arena, player)) {
          player.pos.y--;
          break;
        }
        dropDistance++;
      }

      player.score += dropDistance * 5 * player.level;
      updateBestScore();
      updateScoreboard();
      playHardDropSound();
      lockCurrentPieceAndContinue();
      dropCounter = 0;
    } else if (keyLower === 'c') {
      playerHold();
    }
  });

  updateScoreboard();
  drawNext();
  update();

  startPauseBtn.addEventListener('click', startPauseToggle);
  overlayBtn.addEventListener('click', () => {
    if (overlayTitle.textContent.toLowerCase() === 'fim de jogo') restartGame();
    else startFromOverlay();
  });

  document.addEventListener('pointerdown', resumeAudio, { passive: true });
});
