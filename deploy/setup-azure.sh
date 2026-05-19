#!/usr/bin/env bash
# =============================================================================
# ImperialSeal — Azure VM Setup Script
# Target: Fresh Ubuntu 22.04 LTS (Azure B2s or larger)
# Run as: sudo bash setup-azure.sh
# =============================================================================

set -euo pipefail
IFS=$'\n\t'

# ─── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ─── Config ───────────────────────────────────────────────────────────────────
NODE_VERSION="20"
APP_DIR="/var/www/imperialseal"
APP_USER="imperialseal"
BACKEND_DIR="${APP_DIR}/backend"
FRONTEND_DIR="${APP_DIR}/frontend"
DEPLOY_DIR="${APP_DIR}/deploy"
LOG_FILE="/var/log/imperialseal-setup.log"

# ─── Helpers ──────────────────────────────────────────────────────────────────
log()    { echo -e "${GREEN}[$(date '+%H:%M:%S')] ✔  $*${NC}" | tee -a "${LOG_FILE}"; }
info()   { echo -e "${BLUE}[$(date '+%H:%M:%S')] ℹ  $*${NC}" | tee -a "${LOG_FILE}"; }
warn()   { echo -e "${YELLOW}[$(date '+%H:%M:%S')] ⚠  $*${NC}" | tee -a "${LOG_FILE}"; }
error()  { echo -e "${RED}[$(date '+%H:%M:%S')] ✘  $*${NC}" | tee -a "${LOG_FILE}"; exit 1; }
section(){ echo -e "\n${BOLD}${CYAN}════════════════════════════════════════${NC}"; \
           echo -e "${BOLD}${CYAN}  $*${NC}"; \
           echo -e "${BOLD}${CYAN}════════════════════════════════════════${NC}\n"; }

require_root() {
  [[ "${EUID}" -eq 0 ]] || error "This script must be run as root. Use: sudo bash setup-azure.sh"
}

prompt_required() {
  local var_name="$1"
  local prompt_text="$2"
  local value=""
  while [[ -z "${value}" ]]; do
    read -rp "$(echo -e "${YELLOW}${prompt_text}: ${NC}")" value
  done
  eval "${var_name}='${value}'"
}

prompt_optional() {
  local var_name="$1"
  local prompt_text="$2"
  local default_val="$3"
  read -rp "$(echo -e "${YELLOW}${prompt_text} [${default_val}]: ${NC}")" value
  eval "${var_name}='${value:-${default_val}}'"
}

# ─── Pre-flight ───────────────────────────────────────────────────────────────
require_root
mkdir -p "$(dirname "${LOG_FILE}")"
touch "${LOG_FILE}"

echo -e "${BOLD}"
cat <<'BANNER'
  ___                           _       _ ____            _
 |_ _|_ __ ___  _ __   ___ _ __(_) __ _| / ___|  ___  __ _| |
  | || '_ ` _ \| '_ \ / _ \ '__| |/ _` | \___ \ / _ \/ _` | |
  | || | | | | | |_) |  __/ |  | | (_| | |___) |  __/ (_| | |
 |___|_| |_| |_| .__/ \___|_|  |_|\__,_|_|____/ \___|\__,_|_|
                |_|
       Azure VM Setup — Ubuntu 22.04 LTS
BANNER
echo -e "${NC}"

section "Gathering Configuration"

prompt_required DOMAIN          "Enter your domain (e.g. app.imperialseal.io)"
prompt_required CERTBOT_EMAIL   "Enter email for SSL cert (Let's Encrypt)"
prompt_required GIT_REPO_URL    "Enter Git repository URL (e.g. git@github.com:org/imperialseal.git)"
prompt_optional GIT_BRANCH      "Git branch to deploy" "main"

info "Domain:     ${DOMAIN}"
info "Git Repo:   ${GIT_REPO_URL}"
info "Git Branch: ${GIT_BRANCH}"

# ─── Step 1: System updates & essential packages ─────────────────────────────
section "Step 1/15 — System Updates & Essential Packages"

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq 2>&1 | tee -a "${LOG_FILE}"
apt-get upgrade -y -qq 2>&1 | tee -a "${LOG_FILE}"
apt-get install -y -qq \
  curl \
  git \
  unzip \
  build-essential \
  ca-certificates \
  gnupg \
  lsb-release \
  ufw \
  fail2ban \
  htop \
  jq \
  openssl \
  software-properties-common \
  2>&1 | tee -a "${LOG_FILE}"

log "Essential packages installed."

# ─── Step 2: Node.js 20 LTS via nvm ──────────────────────────────────────────
section "Step 2/15 — Node.js ${NODE_VERSION} LTS via nvm"

# Create app user if not exists
if ! id -u "${APP_USER}" &>/dev/null; then
  useradd -r -m -s /bin/bash "${APP_USER}"
  log "Created system user: ${APP_USER}"
else
  log "User ${APP_USER} already exists."
fi

NVM_DIR="/home/${APP_USER}/.nvm"

sudo -u "${APP_USER}" bash -c "
  export HOME=/home/${APP_USER}
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
  export NVM_DIR='${NVM_DIR}'
  [ -s \"\${NVM_DIR}/nvm.sh\" ] && . \"\${NVM_DIR}/nvm.sh\"
  nvm install ${NODE_VERSION}
  nvm alias default ${NODE_VERSION}
  nvm use default
  echo 'export NVM_DIR=\"\${HOME}/.nvm\"' >> ~/.bashrc
  echo '[ -s \"\${NVM_DIR}/nvm.sh\" ] && . \"\${NVM_DIR}/nvm.sh\"' >> ~/.bashrc
" 2>&1 | tee -a "${LOG_FILE}"

# Symlink node/npm to /usr/local/bin for root/system use
NODE_BIN="$(sudo -u "${APP_USER}" bash -c "source ${NVM_DIR}/nvm.sh && which node")"
NPM_BIN="$(sudo -u "${APP_USER}" bash -c "source ${NVM_DIR}/nvm.sh && which npm")"
NPX_BIN="$(sudo -u "${APP_USER}" bash -c "source ${NVM_DIR}/nvm.sh && which npx")"

ln -sf "${NODE_BIN}" /usr/local/bin/node
ln -sf "${NPM_BIN}"  /usr/local/bin/npm
ln -sf "${NPX_BIN}"  /usr/local/bin/npx

log "Node.js $(node --version) installed."
log "npm $(npm --version) installed."

# ─── Step 3: PM2 globally ────────────────────────────────────────────────────
section "Step 3/15 — PM2 Global Install"

npm install -g pm2 2>&1 | tee -a "${LOG_FILE}"
pm2 startup systemd -u "${APP_USER}" --hp "/home/${APP_USER}" 2>&1 | tee -a "${LOG_FILE}"
log "PM2 $(pm2 --version) installed."

# ─── Step 4: Nginx ────────────────────────────────────────────────────────────
section "Step 4/15 — Nginx"

apt-get install -y -qq nginx 2>&1 | tee -a "${LOG_FILE}"
systemctl enable nginx
systemctl start nginx
log "Nginx $(nginx -v 2>&1 | grep -o '[0-9.]*') installed and started."

# ─── Step 5: Certbot ─────────────────────────────────────────────────────────
section "Step 5/15 — Certbot with Nginx Plugin"

apt-get install -y -qq certbot python3-certbot-nginx 2>&1 | tee -a "${LOG_FILE}"
log "Certbot $(certbot --version 2>&1 | grep -o '[0-9.]*' | head -1) installed."

# ─── Step 6: App Directory ────────────────────────────────────────────────────
section "Step 6/15 — Application Directory"

mkdir -p "${APP_DIR}"
mkdir -p "${APP_DIR}/logs"
mkdir -p "${APP_DIR}/tmp"
log "Created app directory: ${APP_DIR}"

# ─── Step 7: Directory Permissions ────────────────────────────────────────────
section "Step 7/15 — Directory Permissions"

chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"
chmod -R 755 "${APP_DIR}"

# Nginx needs to read static files
usermod -aG "${APP_USER}" www-data || true

log "Permissions set on ${APP_DIR}"

# ─── Step 8: Clone Repository ────────────────────────────────────────────────
section "Step 8/15 — Clone Repository"

if [[ -d "${APP_DIR}/.git" ]]; then
  warn "Git repository already exists. Pulling latest from ${GIT_BRANCH}..."
  sudo -u "${APP_USER}" bash -c "cd ${APP_DIR} && git fetch origin && git checkout ${GIT_BRANCH} && git pull origin ${GIT_BRANCH}" 2>&1 | tee -a "${LOG_FILE}"
else
  info "Cloning ${GIT_REPO_URL} (branch: ${GIT_BRANCH}) into ${APP_DIR} ..."
  sudo -u "${APP_USER}" git clone --branch "${GIT_BRANCH}" "${GIT_REPO_URL}" "${APP_DIR}" 2>&1 | tee -a "${LOG_FILE}"
fi

log "Repository cloned/updated at ${APP_DIR}"

# ─── Step 9: npm install ──────────────────────────────────────────────────────
section "Step 9/15 — npm install (backend + frontend)"

# Backend
if [[ -d "${BACKEND_DIR}" ]]; then
  info "Installing backend dependencies..."
  sudo -u "${APP_USER}" bash -c "
    source ${NVM_DIR}/nvm.sh
    cd ${BACKEND_DIR}
    npm ci --production=false
  " 2>&1 | tee -a "${LOG_FILE}"
  log "Backend dependencies installed."
else
  warn "Backend directory not found at ${BACKEND_DIR} — skipping."
fi

# Frontend
if [[ -d "${FRONTEND_DIR}" ]]; then
  info "Installing frontend dependencies..."
  sudo -u "${APP_USER}" bash -c "
    source ${NVM_DIR}/nvm.sh
    cd ${FRONTEND_DIR}
    npm ci --production=false
  " 2>&1 | tee -a "${LOG_FILE}"
  log "Frontend dependencies installed."
else
  warn "Frontend directory not found at ${FRONTEND_DIR} — skipping."
fi

# ─── Step 10: .env setup ──────────────────────────────────────────────────────
section "Step 10/15 — Environment Configuration"

setup_env() {
  local dir="$1"
  local label="$2"
  if [[ -f "${dir}/.env" ]]; then
    warn "${label} .env already exists — not overwriting."
  elif [[ -f "${dir}/.env.example" ]]; then
    sudo -u "${APP_USER}" cp "${dir}/.env.example" "${dir}/.env"
    chmod 600 "${dir}/.env"
    log "Copied .env.example to ${dir}/.env"
    warn "ACTION REQUIRED: Fill in ${dir}/.env with real values before starting services."
  else
    warn ".env.example not found in ${dir} — skipping."
  fi
}

setup_env "${BACKEND_DIR}"  "Backend"
setup_env "${FRONTEND_DIR}" "Frontend"

echo -e "\n${BOLD}${YELLOW}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${YELLOW}║  ACTION REQUIRED: Configure your environment files            ║${NC}"
echo -e "${BOLD}${YELLOW}║                                                              ║${NC}"
echo -e "${BOLD}${YELLOW}║  Backend:   nano ${BACKEND_DIR}/.env  ║${NC}"
echo -e "${BOLD}${YELLOW}║  Frontend:  nano ${FRONTEND_DIR}/.env ║${NC}"
echo -e "${BOLD}${YELLOW}║                                                              ║${NC}"
echo -e "${BOLD}${YELLOW}║  Required keys: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,     ║${NC}"
echo -e "${BOLD}${YELLOW}║  ORACLE_*, ALGORAND_*, VOI_*, JWT_SECRET, SENDGRID_API_KEY  ║${NC}"
echo -e "${BOLD}${YELLOW}╚══════════════════════════════════════════════════════════════╝${NC}\n"

read -rp "$(echo -e "${YELLOW}Press ENTER once you have filled in BOTH .env files to continue...${NC}")"

# ─── Step 11: Database migration / seed ───────────────────────────────────────
section "Step 11/15 — Database Migration"

if [[ -f "${BACKEND_DIR}/scripts/migrate.js" ]]; then
  info "Running database migration script..."
  sudo -u "${APP_USER}" bash -c "
    source ${NVM_DIR}/nvm.sh
    cd ${BACKEND_DIR}
    node scripts/migrate.js
  " 2>&1 | tee -a "${LOG_FILE}"
  log "Database migration complete."
elif [[ -f "${BACKEND_DIR}/scripts/seed.js" ]]; then
  info "Running database seed script..."
  sudo -u "${APP_USER}" bash -c "
    source ${NVM_DIR}/nvm.sh
    cd ${BACKEND_DIR}
    node scripts/seed.js
  " 2>&1 | tee -a "${LOG_FILE}"
  log "Database seed complete."
else
  warn "No migration or seed script found at ${BACKEND_DIR}/scripts/ — skipping."
fi

# ─── Step 12: Build Next.js frontend ─────────────────────────────────────────
section "Step 12/15 — Build Next.js Frontend"

if [[ -d "${FRONTEND_DIR}" ]]; then
  info "Building Next.js production bundle..."
  sudo -u "${APP_USER}" bash -c "
    source ${NVM_DIR}/nvm.sh
    cd ${FRONTEND_DIR}
    npm run build
  " 2>&1 | tee -a "${LOG_FILE}"
  log "Next.js build complete."
else
  warn "Frontend directory not found — skipping build."
fi

# ─── Step 13: Start PM2 ───────────────────────────────────────────────────────
section "Step 13/15 — Start PM2"

ECOSYSTEM_FILE="${DEPLOY_DIR}/ecosystem.config.js"

if [[ ! -f "${ECOSYSTEM_FILE}" ]]; then
  ECOSYSTEM_FILE="${APP_DIR}/ecosystem.config.js"
fi

if [[ -f "${ECOSYSTEM_FILE}" ]]; then
  sudo -u "${APP_USER}" bash -c "
    source ${NVM_DIR}/nvm.sh
    cd ${APP_DIR}
    pm2 start ${ECOSYSTEM_FILE} --env production
    pm2 save
  " 2>&1 | tee -a "${LOG_FILE}"
  log "PM2 started with ecosystem config."
else
  error "ecosystem.config.js not found. Expected at ${DEPLOY_DIR}/ecosystem.config.js"
fi

# ─── Step 14: Nginx configuration ────────────────────────────────────────────
section "Step 14/15 — Nginx Configuration"

NGINX_CONF_SRC="${DEPLOY_DIR}/nginx.conf"

if [[ ! -f "${NGINX_CONF_SRC}" ]]; then
  NGINX_CONF_SRC="${APP_DIR}/nginx.conf"
fi

if [[ -f "${NGINX_CONF_SRC}" ]]; then
  # Replace domain placeholder in nginx config
  sed "s/__DOMAIN__/${DOMAIN}/g" "${NGINX_CONF_SRC}" \
    > "/etc/nginx/sites-available/imperialseal"

  ln -sf "/etc/nginx/sites-available/imperialseal" \
         "/etc/nginx/sites-enabled/imperialseal"

  # Remove default site
  rm -f /etc/nginx/sites-enabled/default

  nginx -t 2>&1 | tee -a "${LOG_FILE}"
  systemctl reload nginx
  log "Nginx configured for domain: ${DOMAIN}"
else
  warn "nginx.conf not found at ${NGINX_CONF_SRC}."
  warn "Writing minimal temporary Nginx config for certbot..."

  cat > "/etc/nginx/sites-available/imperialseal" <<NGINX_TEMP
server {
    listen 80;
    server_name ${DOMAIN};
    root /var/www/html;
    location / { return 200 'ImperialSeal is being configured.'; }
}
NGINX_TEMP

  ln -sf "/etc/nginx/sites-available/imperialseal" \
         "/etc/nginx/sites-enabled/imperialseal"
  rm -f /etc/nginx/sites-enabled/default
  nginx -t && systemctl reload nginx
fi

# ─── Step 15: Certbot SSL ─────────────────────────────────────────────────────
section "Step 15/15 — SSL Certificate (Let's Encrypt)"

# Open firewall ports
ufw allow 22/tcp   comment "SSH"    2>/dev/null || true
ufw allow 80/tcp   comment "HTTP"   2>/dev/null || true
ufw allow 443/tcp  comment "HTTPS"  2>/dev/null || true
ufw --force enable 2>/dev/null || true
log "UFW firewall configured."

info "Requesting SSL certificate for ${DOMAIN} ..."
certbot --nginx \
  --non-interactive \
  --agree-tos \
  --email "${CERTBOT_EMAIL}" \
  --domains "${DOMAIN}" \
  --redirect \
  2>&1 | tee -a "${LOG_FILE}"

# Enable certbot auto-renew
systemctl enable certbot.timer
systemctl start certbot.timer
log "SSL certificate issued and auto-renew enabled."

# Reload nginx after certbot modifies config
systemctl reload nginx

# ─── Fail2ban basic setup ─────────────────────────────────────────────────────
info "Configuring fail2ban for SSH protection..."
cat > /etc/fail2ban/jail.local <<'F2B'
[DEFAULT]
bantime  = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port    = ssh
logpath = %(sshd_log)s
backend = %(syslog_backend)s
F2B

systemctl enable fail2ban
systemctl restart fail2ban
log "fail2ban configured."

# ─── Final verification ───────────────────────────────────────────────────────
section "Verification"

echo -e "${BOLD}Service Status:${NC}"
echo -e "  Nginx:   $(systemctl is-active nginx)"
echo -e "  PM2:     $(sudo -u "${APP_USER}" bash -c "source ${NVM_DIR}/nvm.sh && pm2 list" 2>/dev/null | grep -c online || echo "check manually") processes online"
echo -e "  fail2ban:$(systemctl is-active fail2ban)"

echo -e "\n${BOLD}${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${GREEN}║  ImperialSeal setup complete!                                ║${NC}"
echo -e "${BOLD}${GREEN}║                                                              ║${NC}"
echo -e "${BOLD}${GREEN}║  App URL:  https://${DOMAIN}${NC}"
echo -e "${BOLD}${GREEN}║  Logs:     ${LOG_FILE}${NC}"
echo -e "${BOLD}${GREEN}║  PM2:      sudo -u ${APP_USER} pm2 status                   ║${NC}"
echo -e "${BOLD}${GREEN}║  Nginx:    /etc/nginx/sites-available/imperialseal           ║${NC}"
echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}\n"