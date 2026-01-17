document.addEventListener('DOMContentLoaded', () => {
  // Canvas principal
  const canvas = document.getElementById('tetris');
  const context = canvas.getContext('2d');
  context.scale(20, 20);

  // Próximas peças
  const nextCanvas1 = document.getElementById('next1');
  const nextCtx1 = nextCanvas1.getContext('2d'); nextCtx1.scale(20, 20);
  const nextCanvas2 = document.getElementById('next2');
  const nextCtx2 = nextCanvas2.getContext('2d'); nextCtx2.scale(20, 20);
  const nextCanvas3 = document.getElementById('next3');
  const nextCtx3 = nextCanvas3.getContext('2d'); nextCtx3.scale(20, 20);

  // UI
  const startPauseBtn = document.getElementById('startPauseBtn');
  const overlay = document.getElementById('overlayPopup');
  const overlayTitle = document.getElementById('overlayTitle');
  const overlayInfo = document.getElementById('overlayInfo');
  const overlayBtn = document.getElementById('overlayBtn');
  const lineClearSound = document.getElementById('lineClearSound');

  // Arena e estado
  const arena = createMatrix(10, 20);
  const colors = [null, '#00ffff', '#ffff00', '#800080', '#00ff00', '#ff0000', '#0000ff', '#ffa500']; // I,O,T,S,Z,J,L
  const typeMap = [null, 'I', 'O', 'T', 'S', 'Z', 'J', 'L']; // índice pelo valor do bloco

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

  // Tempo/controle
  let dropCounter = 0;
  let dropInterval = 1000;
  let lastTime = 0;
  let started = false;
  let paused = false;
  let gameOver = false;

  // 7-bag
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

  // Utils
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
  function collide(arena, p) {
    if (!p.matrix) return false;
    const m = p.matrix, o = p.pos;
    for (let y = 0; y < m.length; y++) {
      for (let x = 0; x < m[y].length; x++) {
        if (m[y][x] !== 0) {
          const ay = y + o.y, ax = x + o.x;
          if (ay < 0 || ay >= arena.length || ax < 0 || ax >= arena[0].length) return true;
          if (arena[ay][ax] !== 0) return true;
        }
      }
    }
    return false;
  }

  // Detecta o tipo da peça a partir dos valores dos blocos (1..7)
  function pieceTypeOf(matrix) {
    for (let y = 0; y < matrix.length; y++) {
      for (let x = 0; x < matrix[y].length; x++) {
        const v = matrix[y][x];
        if (v !== 0) return typeMap[v];
      }
    }
    return null;
  }

  // Gera uma peça cujo tipo seja diferente do tipo excluído
  function createPieceDifferentFrom(excludeType) {
    let t = randomPiece();
    // garante diferente
    while (t === excludeType) {
      t = randomPiece();
    }
    return createPiece(t);
  }

  // Remoção imediata ao fixar peça
  function merge(arena, p) {
    p.matrix.forEach((row, y) => {
      row.forEach((v, x) => {
        if (v !== 0) arena[y + p.pos.y][x + p.pos.x] = v;
      });
    });

    const rows = getFullRows();
    if (rows.length > 0) {
      removeRows(rows);

      try {
        lineClearSound.currentTime = 0;
        lineClearSound.play();
      } catch (e) {}

      const cleared = rows.length;
      player.lines += cleared;
      player.score += cleared * 100 * player.level;
      checkLevelUp();
      updateScoreboard();
    }
  }

  function rotate(matrix, dir) {
    for (let y = 0; y < matrix.length; y++) {
      for (let x = 0; x < y; x++) {
        [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
      }
    }
    if (dir > 0) matrix.forEach(r => r.reverse());
    else matrix.reverse();
  }

  function drawBlock(ctx, x, y, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 1, 1);
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 0.05;
    ctx.strokeRect(x, y, 1, 1);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(x, y, 0.5, 0.08);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(x + 0.5, y + 0.92, 0.5, 0.08);
  }

  // Linhas
  function getFullRows() {
    const rows = [];
    for (let y = arena.length - 1; y >= 0; --y) {
      let full = true;
      for (let x = 0; x < arena[y].length; ++x) {
        if (arena[y][x] === 0) { full = false; break; }
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

  // Ações do jogador
  function playerRotate(dir) {
    if (!started || paused || gameOver || !player.matrix) return;
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
  }

  function playerSoftDrop() {
    if (!started || paused || gameOver || !player.matrix) return;
    player.pos.y++;
    if (collide(arena, player)) {
      player.pos.y--;
      merge(arena, player);
      player.canHold = true;
      if (player.pos.y === 0) { showGameOver(); return; }
      playerReset();
    } else {
      player.score += 1 * player.level;
      updateScoreboard();
    }
    dropCounter = 0;
  }

  function autoDrop() {
    if (!started || paused || gameOver || !player.matrix) return;
    player.pos.y++;
    if (collide(arena, player)) {
      player.pos.y--;
      merge(arena, player);
      player.canHold = true;
      if (player.pos.y === 0) { showGameOver(); return; }
      playerReset();
    }
    dropCounter = 0;
  }

  function playerMove(dir) {
    if (!started || paused || gameOver || !player.matrix) return;
    player.pos.x += dir;
    if (collide(arena, player)) player.pos.x -= dir;
  }

  // Hold ajustado: 1x por peça e evita mesma peça como ativa após hold
  function playerHold() {
    if (!started || paused || gameOver || !player.matrix) return;
    if (!player.canHold) return;

    // tipo da peça atual (antes do hold)
    const prevType = pieceTypeOf(player.matrix);

    player.canHold = false;

    if (player.hold === null) {
      // primeira vez segurando
      player.hold = player.matrix;

      // pega próxima peça, mas garante ser de tipo diferente da anterior
      let candidate = player.next.shift();
      if (pieceTypeOf(candidate) === prevType) {
        candidate = createPieceDifferentFrom(prevType);
      }

      player.matrix = candidate;
      player.next.push(createPiece(randomPiece()));

      resetPlayerPosition();
      drawNext();
      if (collide(arena, player)) { showGameOver(); return; }
      return;
    }

    // troca com peça do hold, mas evita que seja o mesmo tipo da anterior
    const temp = player.hold;
    player.hold = player.matrix;

    let candidate = temp;
    if (pieceTypeOf(candidate) === prevType) {
      candidate = createPieceDifferentFrom(prevType);
    }

    player.matrix = candidate;
    resetPlayerPosition();
    if (collide(arena, player)) showGameOver();
  }

  // Resets
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
    updateScoreboard();

    [nextCtx1, nextCtx2, nextCtx3].forEach(ctx => {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, 5, 5);
    });
  }

  // Desenho
  function drawMatrix(matrix, offset, colorOverride = null, ctx = context) {
    matrix.forEach((row, y) => {
      row.forEach((v, x) => {
        if (v !== 0) {
          const color = colorOverride ? colorOverride : colors[v];
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
    drawMatrix(ghost.matrix, ghost.pos, 'rgba(255,255,255,0.2)');
  }

  function drawArena() {
    context.fillStyle = '#000';
    context.fillRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < arena.length; y++) {
      for (let x = 0; x < arena[y].length; x++) {
        const v = arena[y][x];
        if (v !== 0) drawBlock(context, x, y, colors[v]);
      }
    }
  }

  function draw() {
    drawArena();
    if (player.matrix) {
      if (!gameOver) drawGhost();
      drawMatrix(player.matrix, player.pos);
    }
  }

  function drawNext() {
    [nextCtx1, nextCtx2, nextCtx3].forEach(ctx => {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, 5, 5);
    });

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

  // Loop
  function update(time = 0) {
    const delta = time - lastTime;
    lastTime = time;

    if (started && !paused && !gameOver) {
      dropCounter += delta;
      if (dropCounter > dropInterval) autoDrop();
    }

    draw();
    requestAnimationFrame(update);
  }

  // Dificuldade
  function checkLevelUp() {
    const newLevel = Math.floor(player.lines / 10) + 1;
    if (newLevel !== player.level) {
      player.level = newLevel;
      dropInterval = Math.max(1000 * Math.pow(0.92, player.level - 1), 250);
    }
  }

  // UI
  function updateScoreboard() {
    const el = document.getElementById('scoreboard');
    if (!el) return;
    el.textContent = 'Score: ' + player.score + ' | Linhas: ' + player.lines + ' | Level: ' + player.level;
  }

  function showGameOver() {
    gameOver = true;
    paused = true;
    overlay.style.display = 'flex';
    overlayTitle.textContent = 'FIM DE JOGO';
    overlayInfo.textContent = 'Score: ' + player.score;
    overlayBtn.textContent = 'Novo Jogo';
    startPauseBtn.textContent = 'Retomar';
    startPauseBtn.classList.remove('start', 'pause');
    startPauseBtn.classList.add('resume');
  }

  function startPauseToggle() {
    if (gameOver) return;

    // se está no overlay inicial, iniciar
    if (overlay.style.display === 'flex' && overlayTitle.textContent === 'TETRIS') {
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
    } else if (paused) {
      paused = false;
      startPauseBtn.textContent = 'Pausar';
      startPauseBtn.classList.remove('resume');
      startPauseBtn.classList.add('pause');
    } else {
      paused = true;
      startPauseBtn.textContent = 'Retomar';
      startPauseBtn.classList.remove('pause');
      startPauseBtn.classList.add('resume');
    }
  }

  function startFromOverlay() {
    overlay.style.display = 'none';
    overlayTitle.textContent = 'TETRIS';
    overlayInfo.textContent = '';
    overlayBtn.textContent = 'Iniciar';
    started = true;
    paused = false;
    gameOver = false;
    playerReset();
    updateScoreboard();
    startPauseBtn.textContent = 'Pausar';
    startPauseBtn.classList.remove('start', 'resume');
    startPauseBtn.classList.add('pause');
  }

  function restartGame() {
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
  }

  // Input
  document.addEventListener('keydown', (e) => {
    const keyLower = e.key.toLowerCase();
    if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(keyLower)) e.preventDefault();

    if (keyLower === 'p') { startPauseToggle(); return; }
    if (keyLower === 'r') { restartGame(); return; }

    if (!started || paused || gameOver) return;

    if (e.key === 'ArrowLeft') playerMove(-1);
    else if (e.key === 'ArrowRight') playerMove(1);
    else if (e.key === 'ArrowDown') playerSoftDrop();
    else if (e.key === 'ArrowUp') playerRotate(1);
    else if (e.code === 'Space') {
      // Hard drop com pontuação por distância
      let dropDistance = 0;
      while (!collide(arena, player)) {
        player.pos.y++;
        dropDistance++;
      }
      player.pos.y--;
      merge(arena, player);
      player.canHold = true;

      player.score += dropDistance * 5 * player.level;
      updateScoreboard();

      if (player.pos.y === 0) { showGameOver(); return; }

      playerReset();
      dropCounter = 0;
    } else if (keyLower === 'c') {
      playerHold();
    }
  });

  // Inicia loop
  update();

  // Botões
  startPauseBtn.addEventListener('click', startPauseToggle);
  overlayBtn.addEventListener('click', () => {
    if (overlayTitle.textContent === 'FIM DE JOGO') {
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
    } else {
      startFromOverlay();
    }
  });
});