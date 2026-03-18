const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const playerScoreEl = document.getElementById('player-score');
const aiScoreEl = document.getElementById('ai-score');
const messageEl = document.getElementById('message');

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
let ball, playerPaddle, aiPaddle, score, mouseY, gameRunning, animationId, currentSpeed, currentAILevel;

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

  // Track mouse position relative to canvas
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseY = e.clientY - rect.top;
  });

  // Left click to start / continue / restart
  canvas.addEventListener('click', () => {
    if (!gameRunning) startGame();
  });

  // Number keys 1-5 to change speed instantly; A/B/C to change AI level
  document.addEventListener('keydown', (e) => {
    const level = parseInt(e.key);
    if (level >= 1 && level <= 5) {
      const prevInit = SPEED_LEVELS[currentSpeed].init;
      currentSpeed = level;
      updateSpeedIndicator();
      // Rescale current ball velocity proportionally to new speed
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

  // Change cursor to pointer over canvas
  canvas.style.cursor = 'none';

  spawnBall('player');
  updateSpeedIndicator();
  updateAIIndicator();
  drawFrame();
  showMessage('Click to start');
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

function startGame() {
  if (score.player >= WINNING_SCORE || score.ai >= WINNING_SCORE) {
    // Restart full game
    score = { player: 0, ai: 0 };
    updateScoreboard();
    spawnBall('player');
  }
  hideMessage();
  gameRunning = true;
  if (animationId) cancelAnimationFrame(animationId);
  loop();
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
  // Center paddle on mouse position, clamped within canvas
  const targetY = mouseY - PADDLE_H / 2;
  playerPaddle.y = Math.max(0, Math.min(canvas.height - PADDLE_H, targetY));
}

function updateAI() {
  const paddleCenter = aiPaddle.y + PADDLE_H / 2;
  const lvl = AI_LEVELS[currentAILevel];
  const aiSpeed = SPEED_LEVELS[currentSpeed].init * lvl.multiplier;
  if (paddleCenter < ball.y - lvl.deadzone && aiPaddle.y + PADDLE_H < canvas.height) {
    aiPaddle.y += aiSpeed;
  } else if (paddleCenter > ball.y + lvl.deadzone && aiPaddle.y > 0) {
    aiPaddle.y -= aiSpeed;
  }
}

function clampSpeed(val, max) {
  return Math.sign(val) * Math.min(Math.abs(val), max);
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
  ball.x += ball.vx;
  ball.y += ball.vy;

  // Top / bottom wall bounce
  if (ball.y - BALL_SIZE / 2 <= 0) {
    ball.y = BALL_SIZE / 2;
    ball.vy = Math.abs(ball.vy);
  }
  if (ball.y + BALL_SIZE / 2 >= canvas.height) {
    ball.y = canvas.height - BALL_SIZE / 2;
    ball.vy = -Math.abs(ball.vy);
  }

  // Player paddle collision
  if (collidesWithPaddle(playerPaddle) && ball.vx < 0) {
    const maxSpeed = SPEED_LEVELS[currentSpeed].max;
    ball.x = playerPaddle.x + PADDLE_W + BALL_SIZE / 2;
    const hitPos = (ball.y - (playerPaddle.y + PADDLE_H / 2)) / (PADDLE_H / 2);
    ball.vx = Math.abs(ball.vx) * 1.05;
    ball.vy = hitPos * 7;
    ball.vx = clampSpeed(ball.vx, maxSpeed);
    ball.vy = clampSpeed(ball.vy, maxSpeed);
  }

  // AI paddle collision
  if (collidesWithPaddle(aiPaddle) && ball.vx > 0) {
    const maxSpeed = SPEED_LEVELS[currentSpeed].max;
    ball.x = aiPaddle.x - BALL_SIZE / 2;
    const hitPos = (ball.y - (aiPaddle.y + PADDLE_H / 2)) / (PADDLE_H / 2);
    ball.vx = -Math.abs(ball.vx) * 1.05;
    ball.vy = hitPos * 7;
    ball.vx = clampSpeed(ball.vx, maxSpeed);
    ball.vy = clampSpeed(ball.vy, maxSpeed);
  }

  // Scoring — ball leaves left side
  if (ball.x < 0) {
    score.ai++;
    updateScoreboard();
    checkWin('ai') || pauseAndServe('player');
  }

  // Scoring — ball leaves right side
  if (ball.x > canvas.width) {
    score.player++;
    updateScoreboard();
    checkWin('player') || pauseAndServe('ai');
  }
}

function checkWin(winner) {
  if (score[winner] >= WINNING_SCORE) {
    gameRunning = false;
    const msg = winner === 'player' ? 'YOU WIN! 🎉' : 'AI WINS!';
    showMessage(`${msg}  —  Click to play again`);
    return true;
  }
  return false;
}

function pauseAndServe(serveToward) {
  gameRunning = false;
  spawnBall(serveToward);
  drawFrame();
  showMessage('Click to continue');
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

  // Player paddle
  ctx.fillStyle = '#fff';
  ctx.fillRect(playerPaddle.x, playerPaddle.y, PADDLE_W, PADDLE_H);

  // AI paddle
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
