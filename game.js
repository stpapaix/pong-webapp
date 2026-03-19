const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const playerScoreEl = document.getElementById('player-score');
const aiScoreEl = document.getElementById('ai-score');
const messageEl = document.getElementById('message');

// --- Audio Engine (Web Audio API — no files needed) ---
let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playBeep(frequency, duration, type = 'square', volume = 0.3) {
  try {
    const ac = getAudioCtx();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ac.currentTime);
    gain.gain.setValueAtTime(volume, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
    osc.start(ac.currentTime);
    osc.stop(ac.currentTime + duration);
  } catch (e) { /* audio not supported */ }
}

// Old-school Pong sounds
const SFX = {
  paddleHit  : () => playBeep(480, 0.04, 'square', 0.35),
  wallBounce : () => playBeep(240, 0.04, 'square', 0.2),
  score      : () => playBeep(120, 0.25, 'sawtooth', 0.4),
  win        : () => { playBeep(523, 0.1, 'square', 0.4); setTimeout(() => playBeep(659, 0.1, 'square', 0.4), 120); setTimeout(() => playBeep(784, 0.2, 'square', 0.4), 240); },
  lose       : () => { playBeep(300, 0.1, 'square', 0.4); setTimeout(() => playBeep(200, 0.3, 'sawtooth', 0.4), 120); },
};

// Constants
const PADDLE_W = 12;
const PADDLE_H = 80;
const BALL_SIZE = 10;
const PADDLE_SPEED = 6;
const WINNING_SCORE = 7;

// Speed levels: [ballSpeed, maxBallSpeed, label]
const SPEED_LEVELS = {
  1: { init: 3,  max: 8,  label: 'Very Slow' },
  2: { init: 4,  max: 10, label: 'Slow'      },
  3: { init: 5,  max: 14, label: 'Medium'    },
  4: { init: 7,  max: 18, label: 'Fast'      },
  5: { init: 10, max: 22, label: 'Very Fast' },
};

// AI levels: speedMultiplier (applied to ball speed), deadzone, label
const AI_LEVELS = {
  a: { multiplier: 0.55, deadzone: 20, label: 'Beginner'     },
  b: { multiplier: 0.80, deadzone: 8,  label: 'Normal'       },
  c: { multiplier: 1.10, deadzone: 2,  label: 'Professional' },
};

// Game state
let ball, playerPaddle, aiPaddle, score, mouseY, gameRunning, animationId, currentSpeed, currentAILevel, autoPlayer, intentionalUnlock;
let playerPaddleVelY = 0; // tracks player paddle vertical velocity for ball effect
let aiPaddleVelY = 0;     // tracks AI paddle vertical velocity for ball effect

function init() {
  playerPaddle = {
    x: 20,
    y: canvas.height / 2 - PADDLE_H / 2,
    w: PADDLE_W,
    h: PADDLE_H,
  };

  aiPaddle = {
    x: canvas.width - 20 - PADDLE_W,
    y: canvas.height / 2 - PADDLE_H / 2,
    w: PADDLE_W,
    h: PADDLE_H,
  };

  score = { player: 0, ai: 0 };
  mouseY = canvas.height / 2;
  gameRunning = false;
  currentSpeed = 3;    // default: Medium
  currentAILevel = 'b'; // default: Normal
  autoPlayer = false;  // default: user controls left paddle
  intentionalUnlock = false;

  // Pointer Lock: track mouse movement delta while locked
  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement !== canvas && gameRunning && !intentionalUnlock) {
      // Pointer lock lost unexpectedly — exit game cleanly
      exitGame();
    }
    intentionalUnlock = false;
  });

  canvas.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === canvas) {
      // Use movement delta when pointer is locked
      mouseY += e.movementY;
      mouseY = Math.max(0, Math.min(canvas.height, mouseY));
    } else {
      // Fallback: absolute position before lock
      const rect = canvas.getBoundingClientRect();
      mouseY = e.clientY - rect.top;
    }
  });

  // Click canvas to request pointer lock (required before lock can activate)
  canvas.addEventListener('click', () => {
    if (!gameRunning && document.pointerLockElement !== canvas) {
      canvas.requestPointerLock();
    }
  });

  // Pointer lock granted — start the game
  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement === canvas && !gameRunning) {
      startGame();
    }
  });

  // Keyboard: SPACE = start/continue, ESC = exit, 0 = toggle AI vs AI, 1-5 = speed, A/B/C = AI level
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Escape') {
      exitGame();
      return;
    }
    if (e.code === 'Space') {
      e.preventDefault();
      if (!gameRunning) {
        if (document.pointerLockElement !== canvas) {
          canvas.requestPointerLock();
        } else {
          startGame();
        }
      }
      return;
    }
    if (e.key === '0') {
      autoPlayer = !autoPlayer;
      updateAutoPlayerIndicator();
      if (autoPlayer && document.pointerLockElement === canvas) {
        intentionalUnlock = true;
        document.exitPointerLock();
      }
      return;
    }
    const level = parseInt(e.key);
    if (level >= 1 && level <= 5) {
      const prevInit = SPEED_LEVELS[currentSpeed].init;
      currentSpeed = level;
      updateSpeedIndicator();
      if (ball && (ball.vx !== 0 || ball.vy !== 0)) {
        const currentMag = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
        if (currentMag > 0) {
          const newInit = SPEED_LEVELS[currentSpeed].init;
          const scale = newInit / prevInit;
          const maxSpeed = SPEED_LEVELS[currentSpeed].max;
          ball.vx = clampSpeed(ball.vx * scale, maxSpeed);
          ball.vy = clampSpeed(ball.vy * scale, maxSpeed);
        }
      }
    }
    const key = e.key.toLowerCase();
    if (key === 'a' || key === 'b' || key === 'c') {
      currentAILevel = key;
      updateAIIndicator();
    }
  });

  // Change cursor to none over canvas
  canvas.style.cursor = 'none';

  spawnBall('player');
  updateSpeedIndicator();
  updateAIIndicator();
  updateAutoPlayerIndicator();
  drawFrame();
  showMessage('Click or press SPACE to start');
}

function spawnBall(serveToward) {
  const dir = serveToward === 'ai' ? 1 : -1;
  const angle = (Math.random() * 0.6 - 0.3);
  const speed = SPEED_LEVELS[currentSpeed].init;
  ball = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    vx: dir * speed * Math.cos(angle),
    vy: speed * Math.sin(angle) + (Math.random() > 0.5 ? 1 : -1) * 2,
  };
}

function updateSpeedIndicator() {
  const el = document.getElementById('speed-indicator');
  if (el) el.textContent = `Speed: ${currentSpeed} — ${SPEED_LEVELS[currentSpeed].label}`;
}

function updateAIIndicator() {
  const el = document.getElementById('ai-indicator');
  const lvl = AI_LEVELS[currentAILevel];
  if (el) el.textContent = `AI: ${currentAILevel.toUpperCase()} — ${lvl.label}`;
}

function updateAutoPlayerIndicator() {
  const el = document.getElementById('mode-indicator');
  if (el) el.textContent = autoPlayer ? 'Mode: AI vs AI' : 'Mode: Player vs AI';
}

function startGame() {
  if (score.player >= WINNING_SCORE || score.ai >= WINNING_SCORE) {
    score = { player: 0, ai: 0 };
    updateScoreboard();
    spawnBall('player');
  }
  hideMessage();
  gameRunning = true;
  if (animationId) cancelAnimationFrame(animationId);
  loop();
}

function exitGame() {
  gameRunning = false;
  if (animationId) cancelAnimationFrame(animationId);
  // Release pointer lock so mouse returns to desktop
  if (document.pointerLockElement === canvas) document.exitPointerLock();
  score = { player: 0, ai: 0 };
  updateScoreboard();
  spawnBall('player');
  drawFrame();
  showMessage('Click or press SPACE to start');
}

function showMessage(text) {
  messageEl.textContent = text;
  messageEl.classList.remove('hidden');
}

function hideMessage() {
  messageEl.classList.add('hidden');
}

function updateScoreboard() {
  playerScoreEl.textContent = score.player;
  aiScoreEl.textContent = score.ai;
}

function updatePlayer() {
  const prevY = playerPaddle.y;
  if (autoPlayer) {
    // Left paddle controlled by AI (same logic as right paddle)
    const paddleCenter = playerPaddle.y + PADDLE_H / 2;
    const lvl = AI_LEVELS[currentAILevel];
    const aiSpeed = SPEED_LEVELS[currentSpeed].init * lvl.multiplier;
    if (paddleCenter < ball.y - lvl.deadzone && playerPaddle.y + PADDLE_H < canvas.height) {
      playerPaddle.y += aiSpeed;
    } else if (paddleCenter > ball.y + lvl.deadzone && playerPaddle.y > 0) {
      playerPaddle.y -= aiSpeed;
    }
  } else {
    // Normal: center paddle on mouse position
    const targetY = mouseY - PADDLE_H / 2;
    playerPaddle.y = Math.max(0, Math.min(canvas.height - PADDLE_H, targetY));
  }
  playerPaddleVelY = playerPaddle.y - prevY;
}

function updateAI() {
  const prevY = aiPaddle.y;
  const paddleCenter = aiPaddle.y + PADDLE_H / 2;
  const lvl = AI_LEVELS[currentAILevel];
  const aiSpeed = SPEED_LEVELS[currentSpeed].init * lvl.multiplier;
  if (paddleCenter < ball.y - lvl.deadzone && aiPaddle.y + PADDLE_H < canvas.height) {
    aiPaddle.y += aiSpeed;
  } else if (paddleCenter > ball.y + lvl.deadzone && aiPaddle.y > 0) {
    aiPaddle.y -= aiSpeed;
  }
  aiPaddleVelY = aiPaddle.y - prevY;
}

function clampSpeed(val, max) {
  return Math.sign(val) * Math.min(Math.abs(val), max);
}

// Continuous collision detection: check if ball swept through a paddle this frame
function sweepPaddle(paddle, prevX, prevY) {
  // Vertical overlap check uses interpolated Y position at the paddle's X boundary
  const halfBall = BALL_SIZE / 2;

  // Determine the X edge of the paddle the ball approaches
  const edgeX = ball.vx < 0 ? paddle.x + paddle.w : paddle.x;

  // Check if ball crossed the edge X during this frame
  const crossedEdge = ball.vx < 0
    ? prevX - halfBall >= edgeX && ball.x - halfBall <= edgeX
    : prevX + halfBall <= edgeX && ball.x + halfBall >= edgeX;

  if (!crossedEdge) return false;

  // Interpolate Y at crossing point
  const t = (edgeX - (ball.vx < 0 ? prevX - halfBall : prevX + halfBall)) / ball.vx;
  const interpY = prevY + ball.vy * t;

  return interpY + halfBall > paddle.y && interpY - halfBall < paddle.y + paddle.h;
}

function collidesWithPaddle(paddle) {
  return (
    ball.x - BALL_SIZE / 2 < paddle.x + paddle.w &&
    ball.x + BALL_SIZE / 2 > paddle.x &&
    ball.y + BALL_SIZE / 2 > paddle.y &&
    ball.y - BALL_SIZE / 2 < paddle.y + paddle.h
  );
}

function updateBall() {
  const prevX = ball.x;
  const prevY = ball.y;

  ball.x += ball.vx;
  ball.y += ball.vy;

  // Top / bottom wall bounce
  if (ball.y - BALL_SIZE / 2 <= 0) {
    ball.y = BALL_SIZE / 2;
    ball.vy = Math.abs(ball.vy);
    SFX.wallBounce();
  }
  if (ball.y + BALL_SIZE / 2 >= canvas.height) {
    ball.y = canvas.height - BALL_SIZE / 2;
    ball.vy = -Math.abs(ball.vy);
    SFX.wallBounce();
  }

  // Player paddle collision (standard + sweep for tunneling)
  if (ball.vx < 0 && (collidesWithPaddle(playerPaddle) || sweepPaddle(playerPaddle, prevX, prevY))) {
    const maxSpeed = SPEED_LEVELS[currentSpeed].max;
    ball.x = playerPaddle.x + PADDLE_W + BALL_SIZE / 2;
    const hitPos = (ball.y - (playerPaddle.y + PADDLE_H / 2)) / (PADDLE_H / 2);
    ball.vx = Math.abs(ball.vx) * 1.05;
    ball.vy = hitPos * 7;
    ball.vy += playerPaddleVelY * 0.6; // transfer paddle motion to ball
    ball.vx = clampSpeed(ball.vx, maxSpeed);
    ball.vy = clampSpeed(ball.vy, maxSpeed);
    SFX.paddleHit();
  }

  // AI paddle collision (standard + sweep for tunneling)
  if (ball.vx > 0 && (collidesWithPaddle(aiPaddle) || sweepPaddle(aiPaddle, prevX, prevY))) {
    const maxSpeed = SPEED_LEVELS[currentSpeed].max;
    ball.x = aiPaddle.x - BALL_SIZE / 2;
    const hitPos = (ball.y - (aiPaddle.y + PADDLE_H / 2)) / (PADDLE_H / 2);
    ball.vx = -Math.abs(ball.vx) * 1.05;
    ball.vy = hitPos * 7;
    ball.vy += aiPaddleVelY * 0.6; // transfer paddle motion to ball
    ball.vx = clampSpeed(ball.vx, maxSpeed);
    ball.vy = clampSpeed(ball.vy, maxSpeed);
    SFX.paddleHit();
  }

  // Scoring — ball leaves left side
  if (ball.x < 0) {
    score.ai++;
    updateScoreboard();
    SFX.score();
    checkWin('ai') || pauseAndServe('player');
  }

  // Scoring — ball leaves right side
  if (ball.x > canvas.width) {
    score.player++;
    updateScoreboard();
    SFX.score();
    checkWin('player') || pauseAndServe('ai');
  }
}

function checkWin(winner) {
  if (score[winner] >= WINNING_SCORE) {
    gameRunning = false;
    if (document.pointerLockElement === canvas) document.exitPointerLock();
    const msg = winner === 'player' ? 'YOU WIN! 🎉' : 'AI WINS!';
    winner === 'player' ? SFX.win() : SFX.lose();
    showMessage(`${msg}  —  Click or SPACE to play again`);
    return true;
  }
  return false;
}

function pauseAndServe(serveToward) {
  gameRunning = false;
  spawnBall(serveToward);
  drawFrame();
  showMessage('Press SPACE to continue  —  ESC to exit');
}

function drawFrame() {
  // Background
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Center dashed line
  ctx.setLineDash([12, 12]);
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2, 0);
  ctx.lineTo(canvas.width / 2, canvas.height);
  ctx.stroke();
  ctx.setLineDash([]);

  // Player paddle: white when user-controlled, green when AI-controlled
  ctx.fillStyle = autoPlayer ? '#4f4' : '#fff';
  ctx.fillRect(playerPaddle.x, playerPaddle.y, PADDLE_W, PADDLE_H);

  // AI paddle (right): always red
  ctx.fillStyle = '#f66';
  ctx.fillRect(aiPaddle.x, aiPaddle.y, PADDLE_W, PADDLE_H);

  // Ball
  ctx.fillStyle = '#fff';
  ctx.fillRect(
    ball.x - BALL_SIZE / 2,
    ball.y - BALL_SIZE / 2,
    BALL_SIZE,
    BALL_SIZE
  );
}

function loop() {
  if (!gameRunning) return;
  updatePlayer();
  updateAI();
  updateBall();
  drawFrame();
  animationId = requestAnimationFrame(loop);
}

init();
