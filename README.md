# 🏓 Pong Web App

A classic Pong game (Player vs AI) built with HTML5 Canvas and deployed on **Azure Static Web Apps** with full CI/CD automation via GitHub Actions.

## 🎮 Play the Game

> **[▶ Play Online](https://pong-webapp.azurestaticapps.net)**

## Controls

| Key | Action |
|-----|--------|
| `↑` Arrow Up | Move paddle up |
| `↓` Arrow Down | Move paddle down |
| Any key | Start / serve / restart |

- You are the **white paddle** (left side)
- The AI is the **red paddle** (right side)
- First to **7 points** wins
- Ball speeds up on every paddle hit

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
- **Ball physics**: bounces off walls, accelerates on each paddle hit (capped at max speed)
- **Angle control**: hit position on paddle affects the ball's rebound angle
- **AI**: tracks the ball with a small deadzone to remain beatable
- **Scoring**: first to 7 points wins

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

## License

MIT
