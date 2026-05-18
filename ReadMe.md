<div align="center">

<br />

# ⚜️ ImperialSeal

### Blockchain-Verified Credential Issuance Platform

**Issue tamper-proof certificates and badges on VOI Network & Algorand.**
A complete white-label SaaS for universities, colleges, academies, and training providers.

<br />

[![License: BSL-1.0](https://img.shields.io/badge/License-BSL%201.0-gold.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20%20LTS-green.svg)](https://nodejs.org)
[![Next.js](https://img.shields.io/badge/Next.js-14-black.svg)](https://nextjs.org)
[![Blockchain](https://img.shields.io/badge/Blockchain-VOI%20%7C%20Algorand-blue.svg)](https://voi.network)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![Stars](https://img.shields.io/github/stars/YOUR_USERNAME/imperialseal?style=social)](https://github.com/YOUR_USERNAME/imperialseal)

<br />

![ImperialSeal Banner](docs/assets/banner.png)

<br />

[**Live Demo**](https://imperialseal.io) · [**Documentation**](docs/) · [**Report a Bug**](https://github.com/YOUR_USERNAME/imperialseal/issues) · [**Request a Feature**](https://github.com/YOUR_USERNAME/imperialseal/issues)

</div>

---

## 📋 Table of Contents

- [What is ImperialSeal?](#-what-is-imperialseal)
- [Key Features](#-key-features)
- [How It Works](#-how-it-works)
- [Tech Stack](#-tech-stack)
- [Architecture Overview](#-architecture-overview)
- [Getting Started](#-getting-started)
- [Development Setup](#-development-setup)
- [Deployment](#-deployment)
- [Configuration](#-configuration)
- [Platform Rename](#-platform-rename)
- [Blockchain Details](#-blockchain-details)
- [Pricing Logic](#-pricing-logic)
- [Email System](#-email-system)
- [File Storage](#-file-storage)
- [Contributing](#-contributing)
- [License](#-license)
- [Attribution](#-attribution)

---

## 🏛️ What is ImperialSeal?

ImperialSeal is a **production-grade, open-source SaaS platform** that enables educational institutions and training providers to issue blockchain-verified certificates and digital badges.

Built for institutions that need:
- **Tamper-proof credentials** — every certificate is an NFT on a public blockchain
- **Instant verification** — anyone can verify authenticity via a URL or QR code
- **Bulk issuance** — issue thousands of certificates from a CSV upload
- **Beautiful design** — portrait and landscape certificate templates with full branding control
- **White-label flexibility** — rename the entire platform from the admin UI in seconds
- **Multi-chain support** — choose VOI Network or Algorand per course

ImperialSeal operates as a multi-tenant SaaS: one super admin (you) manages multiple institution clients, each with their own isolated dashboard, courses, and credentials.

---

## ✨ Key Features

### For Platform Operators (Super Admin)
- 🏢 **Multi-tenant institution management** — onboard unlimited schools, colleges, universities
- 💰 **Flexible billing** — set annual subscription fee per client in USDC, ALGO, or wALGO
- 🔤 **Instant platform rename** — change brand name across entire UI from settings panel
- 📊 **Revenue dashboard** — track all payments, issuance volumes, and wallet balances
- ✉️ **Email provider management** — switch email providers from UI without any code changes
- 🔐 **Request-based co-host/sponsor pricing** — you set the price per slot per course

### For Institutions (Admin Dashboard)
- 📚 **Course management** — create courses with custom certificate and badge configurations
- 🎨 **Visual certificate designer** — drag-and-drop designer for portrait and landscape templates
- 🏷️ **Badge designer** — custom digital badges (circle, hexagon, square) per course
- 🔒 **Design locking** — lock designs after approval; templates cannot be altered post-issuance
- 👥 **Co-host and sponsor logos** — add partner logos to certificates (up to 4 each)
- 📤 **Bulk issuance via CSV** — issue thousands of credentials from a spreadsheet
- ⚡ **Real-time issuance progress** — animated step-by-step blockchain transaction tracker
- 👛 **Custodial wallet management** — no crypto knowledge needed; fees deducted automatically

### For Recipients (Public)
- 🔍 **Instant verification** — verify any certificate via URL or QR code, no login required
- ⛓️ **On-chain proof** — direct link to blockchain explorer for each credential
- 📄 **PDF download** — high-quality certificate PDF with institution branding
- 🔗 **LinkedIn sharing** — Open Badges 2.0 compatible for professional profiles

---

## 🔄 How It Works

```
Institution signs up → Super admin onboards & sets pricing
         ↓
Institution creates course → Chooses VOI or Algorand (permanent choice)
         ↓
Institution designs certificate & badge → Locks design
         ↓
Student completes course → Institution issues credential
         ↓
System mints NFT on blockchain → Generates PDF → Queues email
         ↓
Student receives email with PDF + verification link
         ↓
Anyone can verify at imperialseal.io/verify/[hash]
```

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | Next.js 14 (App Router) | SSR, routing, UI framework |
| **Styling** | Tailwind CSS + Framer Motion | Glassmorphism UI + animations |
| **Backend** | Node.js + Express.js | REST API server |
| **Database** | Supabase (PostgreSQL) | All metadata and relational data |
| **File Storage** | Oracle Cloud Object Storage | PDFs, badge images, logos (S3-compatible) |
| **Blockchain** | VOI Network + Algorand | NFT minting via algosdk |
| **Smart Standards** | ARC-3 + ARC-69 | Certificate and badge NFT standards |
| **Wallets** | Pera Wallet + Defly | Super admin payment wallet |
| **PDF Engine** | Puppeteer | Headless Chrome certificate rendering |
| **Email** | SendGrid (default) | Credential delivery — 100/day free |
| **Price Feed** | CoinGecko API | Real-time VOI/ALGO to USDC conversion |
| **Process Manager** | PM2 | Production Node.js process management |
| **Reverse Proxy** | Nginx | SSL termination, routing |
| **SSL** | Let's Encrypt / Certbot | Free SSL certificates |

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                        Internet                          │
└────────────────────────┬────────────────────────────────┘
                         │
                    ┌────▼────┐
                    │  Nginx  │  SSL termination, routing
                    └────┬────┘
            ┌────────────┴────────────┐
            │                         │
     ┌──────▼──────┐           ┌──────▼──────┐
     │  Next.js 14 │           │  Express API │
     │  (Port 3000)│           │  (Port 3001) │
     └──────┬──────┘           └──────┬───────┘
            │                         │
            │                 ┌───────┴────────────────────┐
            │                 │                            │
     ┌──────▼──────┐   ┌──────▼──────┐    ┌──────────────▼──────┐
     │  Supabase   │   │   Oracle    │    │  Blockchain Layer   │
     │ (PostgreSQL)│   │   Object    │    │  VOI + Algorand     │
     │  Metadata   │   │   Storage   │    │  algosdk            │
     └─────────────┘   │  PDFs,Imgs  │    └─────────────────────┘
                       └─────────────┘
```

**Key design decisions:**
- The VM is **stateless** — all data lives in Supabase (remote) and Oracle (remote)
- This enables the **one-command migration** to any new VPS in under 15 minutes
- Institutional private keys are **AES-256 encrypted** before storage — never stored in plaintext
- The email system is **provider-agnostic** — swap providers from the UI, zero downtime

---

## 🚀 Getting Started

### Prerequisites

Before you begin, ensure you have:

- [Node.js 20 LTS](https://nodejs.org) or higher
- [Git](https://git-scm.com)
- A [Supabase](https://supabase.com) account (free tier is fine to start)
- An [Oracle Cloud](https://cloud.oracle.com) account (Always Free tier — 20GB object storage)
- A [SendGrid](https://sendgrid.com) account (free — 100 emails/day forever)
- A [CoinGecko](https://coingecko.com) account (free API — no key needed for basic tier)
- A domain name pointed at your server
- (Optional for development) [Pera Wallet](https://perawallet.app) browser extension

### Quick Clone

```bash
git clone https://github.com/YOUR_USERNAME/imperialseal.git
cd imperialseal
cp .env.example .env
```

---

## 💻 Development Setup

### 1. Install Dependencies

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Configure Environment

Edit `.env` with your credentials. See [Configuration](#-configuration) for a full breakdown of every variable.

```bash
# Minimum required for local development:
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_role_key
JWT_SECRET=any_64_char_random_string_for_dev
ENCRYPTION_KEY=any_32_char_random_string_for_dev
```

### 3. Set Up Database

1. Go to your [Supabase project](https://app.supabase.com)
2. Open **SQL Editor**
3. Paste the entire contents of `database/schema.sql`
4. Click **Run**
5. Paste the contents of `database/seed.sql` (creates default platform config and first super admin)
6. Click **Run**

### 4. Run Development Servers

Open two terminal windows:

```bash
# Terminal 1 — Backend API
cd backend
npm run dev
# Runs on http://localhost:3001

# Terminal 2 — Frontend
cd frontend
npm run dev
# Runs on http://localhost:3000
```

### 5. Access the Application

| URL | Description |
|---|---|
| `http://localhost:3000` | Public landing page |
| `http://localhost:3000/login` | Login page |
| `http://localhost:3000/super-admin` | Super admin dashboard |
| `http://localhost:3000/dashboard` | Institution dashboard |
| `http://localhost:3000/verify/[hash]` | Public verification page |

**Default super admin credentials (development only):**
```
Email:    admin@imperialseal.io
Password: ChangeThisImmediately123!
```
> ⚠️ Change these immediately. See `database/seed.sql` to set your own before running.

---

## 🌐 Deployment

### Option A: Automated Setup (Recommended)

For a fresh Ubuntu 22.04 VPS (Azure, Hetzner, DigitalOcean, etc.):

```bash
# SSH into your server as root
ssh root@your-server-ip

# Download and run the setup script
curl -sSL https://raw.githubusercontent.com/YOUR_USERNAME/imperialseal/main/deploy/setup-azure.sh | bash
```

The script will:
1. Install Node.js 20, PM2, Nginx, Certbot
2. Clone the repository
3. Prompt you to fill in environment variables
4. Run database migrations
5. Build the frontend
6. Configure Nginx with SSL
7. Start all services with PM2

Total setup time: approximately 10–15 minutes.

### Option B: One-Command Migration (Moving Between Servers)

When migrating from one VPS to another (e.g., Azure credits expire → Hetzner):

```bash
# On the old server — back up your .env first
bash deploy/backup-env.sh
# This uploads an encrypted .env to Oracle Object Storage and gives you a URL

# On the new fresh Ubuntu 22.04 server
curl -sSL https://raw.githubusercontent.com/YOUR_USERNAME/imperialseal/main/deploy/migrate.sh | bash
# Prompts for: git repo URL, domain, Oracle env backup URL
# Restores everything in under 15 minutes
```

> Since all data lives in Supabase (remote) and Oracle Object Storage (remote), **the VM is purely stateless**. Migration is just reinstalling the app layer and pointing it at the same databases.

### Option C: Manual Deployment

See [DEPLOYMENT.md](docs/DEPLOYMENT.md) for the full step-by-step manual deployment guide.

### PM2 Process Management

```bash
pm2 status                    # Check all processes
pm2 logs imperialseal-api     # Backend logs
pm2 logs imperialseal-email   # Email queue processor logs
pm2 restart imperialseal-api  # Restart backend
pm2 monit                     # Real-time monitoring dashboard
```

---

## ⚙️ Configuration

All configuration is via `.env`. Copy `.env.example` to `.env` before starting.

| Variable | Required | Description |
|---|---|---|
| `NODE_ENV` | ✅ | `production` or `development` |
| `PORT` | ✅ | Backend port (default: 3001) |
| `FRONTEND_URL` | ✅ | Your domain (e.g. `https://imperialseal.io`) |
| `JWT_SECRET` | ✅ | 64-character random string for JWT signing |
| `ENCRYPTION_KEY` | ✅ | 32-character key for AES-256 wallet encryption |
| `SUPABASE_URL` | ✅ | From Supabase project settings |
| `SUPABASE_ANON_KEY` | ✅ | From Supabase project settings |
| `SUPABASE_SERVICE_KEY` | ✅ | From Supabase project settings (keep secret) |
| `ORACLE_NAMESPACE` | ✅ | Oracle Cloud object storage namespace |
| `ORACLE_BUCKET_NAME` | ✅ | Your storage bucket name |
| `ORACLE_REGION` | ✅ | Oracle region (e.g. `us-ashburn-1`) |
| `ORACLE_ACCESS_KEY_ID` | ✅ | Oracle S3-compatible access key |
| `ORACLE_SECRET_ACCESS_KEY` | ✅ | Oracle S3-compatible secret |
| `VOI_NODE_URL` | ✅ | VOI Network node URL |
| `ALGO_NODE_URL` | ✅ | Algorand node URL |
| `SENDGRID_API_KEY` | ✅ | SendGrid API key (free tier) |
| `SUPER_ADMIN_EMAIL` | ✅ | Your super admin login email |
| `BRAND_NAME` | ✅ | Initial platform name (can change from UI later) |

See `.env.example` for the complete list with descriptions.

---

## 🔤 Platform Rename

ImperialSeal is designed to be **fully white-label**. The platform name is never hardcoded in the UI — it reads from the database at runtime.

**To rename the platform:**

1. Log in as super admin
2. Go to **Settings → Platform Identity**
3. Enter the new brand name
4. Click **Rename Platform** and confirm

The change propagates across the entire UI instantly — no rebuild, no restart, no code changes.

**Why you might need this:**
- You want to sell this under your own brand
- You face a legal IP dispute and need to rebrand overnight
- You're running multiple instances for different markets

The audit log records every brand rename with before/after values and timestamp.

---

## ⛓️ Blockchain Details

### VOI Network
- **Type:** Layer-1 AVM (Algorand Virtual Machine) compatible
- **Speed:** ~3.5 second finality
- **Cost:** Fractions of a cent per transaction
- **Standard:** ARC-3 (certificates), ARC-69 (badges)
- **Explorer:** [Voi Observer](https://observer.voi.network)
- **Node:** Public free node at `https://mainnet-api.voi.nodly.io`

### Algorand
- **Type:** Layer-1, pure proof-of-stake
- **Speed:** ~4.5 second finality
- **Cost:** 0.001 ALGO per transaction (~$0.0002)
- **Standard:** ARC-3 (certificates), ARC-69 (badges)
- **Explorer:** [AlgoExplorer](https://algoexplorer.io)
- **Node:** Public free node at `https://mainnet-api.algonode.cloud`

### NFT Standards Used
| Standard | Used For | Key Property |
|---|---|---|
| ARC-3 | Certificates | Metadata URL points to JSON with full certificate data |
| ARC-69 | Badges | Metadata embedded in transaction note field |

Both standards ensure credentials are **permanently verifiable** by anyone with the asset ID, independent of ImperialSeal being online.

---

## 💲 Pricing Logic

Issuance fees are **hardcoded in the backend** and cannot be changed from the UI. This prevents accidental overcharging.

| Issuance Type | Fee (USD equivalent) |
|---|---|
| Certificate only | $0.80 |
| Badge only | $0.40 |
| Certificate + Badge | $1.00 (hard cap — never $1.20) |
| Network transaction fee | Added on top (~$0.0002) |

**Fee calculation process:**
1. Fetch live VOI or ALGO price from CoinGecko at moment of issuance
2. Calculate native token equivalent of the USD fee
3. Enforce hard cap (if combined > $1.00, cap at $1.00 before converting)
4. Add network fee after cap calculation
5. Deduct from institution's custodial wallet
6. Price cached for 60 seconds to handle bulk issuance efficiently

---

## ✉️ Email System

ImperialSeal uses a **queue-based, provider-agnostic email system**.

### How the Queue Works
1. Every credential issuance adds an email to the `email_queue` table
2. A cron job runs every 15 minutes
3. It checks how many emails have been sent today
4. It sends up to the remaining daily quota
5. For a 2,000-student bulk import at 100 emails/day: delivered over 20 days

### Switching Email Providers
From **Super Admin → Email Settings**, you can:
- Add any provider (SendGrid, Mailgun, Resend, Brevo, or custom SMTP)
- Switch the active provider instantly
- Set the daily send limit to match your plan
- View queue status (pending / sent today / failed)

No code changes. No restart. The next queue processing cycle uses the new provider.

### Supported Providers
| Provider | Free Tier | Notes |
|---|---|---|
| SendGrid | 100/day forever | Default — recommended to start |
| Mailgun | 100/day (3 months free trial) | |
| Resend | 100/day free | Modern API, great DX |
| Brevo | 300/day free | Formerly Sendinblue |
| SMTP | Your limits | Any SMTP server |

---

## 📦 File Storage

All files are stored in **Oracle Cloud Object Storage** using the S3-compatible API.

| File Type | Path Pattern | Notes |
|---|---|---|
| Certificate PDFs | `certificates/{institutionId}/{issuanceId}.pdf` | Generated by Puppeteer |
| Badge Images | `badges/{institutionId}/{badgeId}.png` | Generated from template |
| Institution Logos | `logos/institutions/{institutionId}.png` | |
| Co-host Logos | `logos/cohosts/{courseId}/{slot}.png` | |
| Sponsor Logos | `logos/sponsors/{courseId}/{slot}.png` | |
| Certificate Previews | `previews/{templateId}.png` | Thumbnail for designer UI |
| Bulk CSV Uploads | `csv/{jobId}.csv` | Raw upload, deleted after processing |

**Oracle Cloud Always Free gives you 20 GB of object storage** — approximately 57,000 certificate+badge pairs before any cost. Beyond 20 GB, cost is $0.0255/GB/month.

---

## 🤝 Contributing

Contributions are welcome and appreciated. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a pull request.

### Development Workflow

```bash
# Fork the repository on GitHub
# Clone your fork
git clone https://github.com/YOUR_FORK/imperialseal.git

# Create a feature branch
git checkout -b feat/your-feature-name

# Make your changes

# Commit using conventional commits
git commit -m "feat(backend): add IPFS storage fallback for certificate PDFs"

# Push and open a pull request
git push origin feat/your-feature-name
```

### Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org):

| Prefix | When |
|---|---|
| `feat(scope):` | New feature |
| `fix(scope):` | Bug fix |
| `chore(scope):` | Build, tooling, config |
| `refactor(scope):` | Code restructure, no behaviour change |
| `docs(scope):` | Documentation only |
| `style(scope):` | UI/CSS only |

### What We Welcome
- 🐛 Bug fixes
- 🌐 Additional blockchain integrations
- 📧 New email provider adapters
- 🎨 Certificate template improvements
- 🔒 Security improvements
- 📖 Documentation improvements
- 🌍 Translations / i18n

### What to Avoid
- Changing the hardcoded fee logic (this is intentional)
- Removing the brand rename system (core feature)
- Breaking changes to the database schema without a migration

---

## 📄 License

ImperialSeal is licensed under the **Business Source License 1.1 (BSL-1.1)** with the following terms:

- ✅ You **may** fork and modify this code for your own use
- ✅ You **may** run your own instance for your organization
- ✅ You **may** contribute modifications back to this repository
- ❌ You **may not** use this code as-is (without meaningful modification) as a competing commercial service
- ❌ You **may not** remove attribution to ImperialSeal / IMAV Learning Academy
- ❌ You **may not** claim original authorship of unmodified portions

**Attribution required in all derivative works:**
```
Based on ImperialSeal (https://github.com/YOUR_USERNAME/imperialseal)
Original work by IMAV Learning Academy Pvt. Ltd. (https://imav.world)
```

See [LICENSE](LICENSE) for the complete license text.

---

## 🙏 Attribution

**ImperialSeal** is created and maintained by:

**Irfan S. Mulla**
Founder & CEO, [IMAV Learning Academy Pvt. Ltd.](https://imav.world)
BKC, Mumbai, India
[support@imav.world](mailto:support@imav.world)

Built with ❤️ to make blockchain-verified education credentials accessible to every institution in the world.

---

<div align="center">

**⚜️ ImperialSeal** — *Where Achievement Meets the Immutable Chain*

[Website](https://imperialseal.io) · [Documentation](docs/) · [Issues](https://github.com/YOUR_USERNAME/imperialseal/issues) · [Discussions](https://github.com/YOUR_USERNAME/imperialseal/discussions)

</div>