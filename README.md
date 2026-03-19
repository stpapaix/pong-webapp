# 🏓 Steph Pong

A classic Pong game (Player vs AI) built with HTML5 Canvas and deployed on **Azure Static Web Apps** with full CI/CD automation via GitHub Actions.
This project was developed using Vibe Coding with GitHub Copilot (Claude Sonnet 4.6) assisting the code generation process.

## 🎮 Play the Game

> **[▶ Play Online](https://brave-rock-06d80bc0f.6.azurestaticapps.net/)**

## Controls

| Input | Action |
|-------|--------|
| Mouse move | Control your paddle (captured by game during play) |
| Click / `SPACE` | Start / continue / restart |
| `ESC` | Exit game and release mouse |
| `0` | Toggle **Manual → AI** (AI vs AI mode) / back to **Player vs AI** |
| `1` – `5` | Change ball speed (applied instantly, even mid-game) |
| `A` | AI level: Beginner |
| `B` | AI level: Normal (default) |
| `C` | AI level: Professional |

- You are the **white paddle** (left) — turns **green** when AI vs AI mode is active
- The AI is the **red paddle** (right side)
- First to **7 points** wins
- Ball speeds up on every paddle hit (capped per speed level)
- Current mode, speed and AI level are displayed below the canvas

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Game | HTML5 Canvas + Vanilla JavaScript |
| Styling | CSS3 |
| Hosting | Azure Static Web Apps (Free tier) |
| Infrastructure | Bicep (IaC) |
| CI/CD | GitHub Actions |

## Project Structure

```
pong-webapp/
├── index.html                        # Game page
├── style.css                         # Arcade-style UI
├── game.js                           # Game logic (player vs AI)
├── staticwebapp.config.json          # Azure SWA routing config
├── infra/
│   └── main.bicep                    # Azure infrastructure (IaC)
└── .github/
    └── workflows/
        └── deploy.yml                # CI/CD pipeline
```

## How It Works

### Game Logic (`game.js`)
- **Game loop** powered by `requestAnimationFrame`
- **Mouse control with Pointer Lock**: mouse is captured by the game on start — no risk of losing control when cursor leaves the window. Released automatically on game end or `ESC`
- **SPACE / click** to start or continue; **ESC** to exit and return mouse to desktop
- **AI vs AI mode** (key `0`): toggles left paddle between user control and AI control — watch the AI play itself. Mouse is released when this mode is active
- **Ball physics**: bounces off walls, accelerates on each paddle hit (capped at max speed per level)
- **Paddle velocity transfer**: moving paddle while hitting imparts its speed to the ball (see section below)
- **Angle control**: hit position on paddle affects the ball's rebound angle
- **CCD (Continuous Collision Detection)**: prevents ball from tunneling through paddles at high speed
- **5 ball speed levels** (keys `1`–`5`): Very Slow to Very Fast, applied instantly including mid-game
- **3 AI difficulty levels** (keys `A`/`B`/`C`): Beginner, Normal, Professional — AI speed and reaction deadzone scale with ball speed
- **Retro sound effects** (Web Audio API — no audio files): paddle hit, wall bounce, score, win/lose jingles
- **Scoring**: first to 7 points wins

---

## 🎳 Ball Effect: Paddle Velocity Transfer

### What it is

When a paddle is **moving vertically at the moment it contacts the ball**, a fraction of that paddle speed is added directly to the ball's vertical velocity. This recreates the "spin" or "curve" effect of the original 1972 Pong arcade cabinet — moving the paddle while hitting gives you control over the ball's trajectory beyond just the contact point.

### How it is implemented

Each game frame, `updatePlayer()` and `updateAI()` record the paddle's vertical displacement:

```js
const prevY = paddle.y;
// ... move paddle ...
paddleVelY = paddle.y - prevY;  // pixels moved this frame
```

On collision, this velocity is mixed into the ball's Y speed with a **damping factor of 0.6** to keep it controllable, then clamped to the current max speed:

```js
ball.vy = hitPos * 7;        // base angle from contact point
ball.vy += paddleVelY * 0.6; // add paddle motion (damped)
ball.vy = clamp(ball.vy, maxSpeed);
```

### Visual schema

```
┌─────────────────────────────────────────────────────────────────┐
│  CASE 1: Paddle moving DOWN while hitting                        │
│                                                                  │
│   │                                                              │
│   │  paddle                  ball before:  ──►                  │
│   │  moving      ════════╗                                       │
│   ▼  down        ════════╬───► ball bounces + pushed DOWN ──►   │
│                  ════════╝          ↘  extra downward push       │
│                                                                  │
│  paddleVelY > 0  →  ball.vy += positive value  →  ball goes ↘  │
├─────────────────────────────────────────────────────────────────┤
│  CASE 2: Paddle STATIONARY while hitting                         │
│                                                                  │
│              ════════╗                                           │
│              ════════╬───► ball bounces at normal angle ──►      │
│              ════════╝                                           │
│                                                                  │
│  paddleVelY = 0  →  no transfer  →  standard bounce             │
├─────────────────────────────────────────────────────────────────┤
│  CASE 3: Paddle moving UP while hitting                          │
│                                                                  │
│   ▲  paddle               ball bounces + pushed UP ──►          │
│   │  moving      ════════╗      ↗  extra upward push            │
│   │  up          ════════╬───►                                   │
│   │              ════════╝                                       │
│                                                                  │
│  paddleVelY < 0  →  ball.vy += negative value  →  ball goes ↗  │
└─────────────────────────────────────────────────────────────────┘
```

### Effect on gameplay

| Paddle action during hit | Ball result |
|--------------------------|-------------|
| Moving **down** | Ball gains extra **downward** momentum |
| **Stationary** | Standard bounce (contact point angle only) |
| Moving **up** | Ball gains extra **upward** momentum |

Applies to **both** player and AI paddles — making every rally dynamic.

---

### Infrastructure (`infra/main.bicep`)
- Provisions an **Azure Static Web App** (Free tier) via Bicep
- No GitHub linking at provisioning — deployment is handled entirely by the GitHub Actions workflow

### CI/CD (`.github/workflows/deploy.yml`)
On every push to `main`:
1. **Provision** job: logs into Azure, creates the resource group, deploys the Bicep template
2. **Deploy** job: fetches the SWA deployment token and uploads the app files

## Deploy Your Own

### Prerequisites
- Azure account ([portal.azure.com](https://portal.azure.com))
- GitHub account
- Azure CLI installed

### Steps

**1. Fork or clone this repo and push to your GitHub account**

**2. Create an Azure Service Principal**
```powershell
az account show --query id --output tsv  # copy your subscription ID

az ad sp create-for-rbac --name "pong-webapp-sp" --role contributor --scopes /subscriptions/<your-sub-id>
```

**3. Add GitHub Secrets**

Go to your repo → **Settings** → **Secrets and variables** → **Actions**

| Secret | Value |
|--------|-------|
| `AZURE_CREDENTIALS` | JSON with `clientId`, `clientSecret`, `tenantId`, `subscriptionId` |
| `REPO_TOKEN` | GitHub Personal Access Token with `repo` scope |

`AZURE_CREDENTIALS` format:
```json
{
  "clientId": "<appId>",
  "clientSecret": "<password>",
  "tenantId": "<tenant>",
  "subscriptionId": "<your-sub-id>"
}
```

**4. Push to `main` — the workflow deploys automatically**

### Get Your App URL
```powershell
az staticwebapp show \
  --name pong-webapp \
  --resource-group rg-pong-webapp \
  --query "defaultHostname" \
  --output tsv
```

## Local Development

No build step required — open directly in your browser:

```powershell
start index.html
```

Or use the **Live Server** extension in VS Code.
