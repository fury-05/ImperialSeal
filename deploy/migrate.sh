#!/usr/bin/env bash
# =============================================================================
# ImperialSeal — One-Command VPS Migration Script
# Target: Any fresh Ubuntu 22.04 LTS VPS
# Run as: sudo bash migrate.sh
# Migrates a running ImperialSeal instance to a new server in <15 minutes.
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
LOG_FILE="/var/log/imperialseal-migrate.log"
ENV_BACKUP_ARCHIVE="/tmp/imperialseal-env-backup.tar.gz.enc"
ENV_DECRYPT_DIR="/tmp/imperialseal-env-restore"

# ─── Timing ───────────────────────────────────────────────────────────────────
MIGRATION_START=$(date +%s)

# ─── Helpers ──────────────────────────────────────────────────────────────────
log()    { echo -e "${GREEN}[$(date '+%H:%M:%S')] ✔  $*${NC}" | tee -a "${LOG_FILE}"; }
info()   { echo -e "${BLUE}[$(date '+%H:%M:%S')] ℹ  $*${NC}" | tee -a "${LOG_FILE}"; }
warn()   { echo -e "${YELLOW}[$(date '+%H:%M:%S')] ⚠  $*${NC}" | tee -a "${LOG_FILE}"; }
error()  { echo -e "${RED}[$(date '+%H:%M:%S')] ✘  $*${NC}" | tee -a "${LOG_FILE}"; exit 1; }
section(){ echo -e "\n${BOLD}${CYAN}════════════════════════════════════════${NC}"; \
           echo -e "${BOLD}${CYAN}  $*${NC}"; \
           echo -e "${BOLD}${CYAN}════════════════════════════════════════${NC}\n"; }

elapsed() {
  local now; now=$(date +%s)
  local delta=$(( now - MIGRATION_START ))
  echo "${delta}s"
}

require_root() {
  [[ "${EUID}" -eq 0 ]] || error "Run as root: sudo bash migrate.sh"
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

prompt_secret() {
  local var_name="$1"
  local prompt_text="$2"
  local value=""
  while [[ -z "${value}" ]]; do
    read -rsp "$(echo -e "${YELLOW}${prompt_text}: ${NC}")" value
    echo ""
  done
  eval "${var_name}='${value}'"
}

# ─── Pre-flight ───────────────────────────────────────────────────────────────
require_root
mkdir -p "$(dirname "${LOG_FILE}")"
touch "${LOG_FILE}"

echo -e "${BOLD}"
cat <<'BANNER'
  ___ __  __ ___ ___ ___ _   _   _   _    ____  _____   _
 |_ _|  \/  |  _ \ __| _ \ |_| / \ | |  / ___|| ____| / \
  | || |\/| | |_) | _||   / | |/ _ \| |  \___ \|  _|  / _ \
  | || |  | |  __/| |_| | \ | / ___ \ |__ ___) | |___/ ___ \
 |___|_|  |_|_|   |___|_|\_\|_/_/   \_|___|____/|_____/_/   \_\

        VPS Migration Script — Ubuntu 22.04 LTS
BANNER
echo -e "${NC}"

section "Gathering Migration Parameters"

# Allow env vars to pre-fill for fully automated runs
GIT_REPO_URL="${GIT_REPO_URL:-}"
GIT_BRANCH="${GIT_BRANCH:-main}"
DOMAIN="${DOMAIN:-}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-}"
ORACLE_ENV_BACKUP_URL="${ORACLE_ENV_BACKUP_URL:-}"
ENV_DECRYPT_PASSPHRASE="${ENV_DECRYPT_PASSPHRASE:-}"

[[ -z "${GIT_REPO_URL}" ]]          && prompt_required GIT_REPO_URL         "Git repository URL"
[[ -z "${DOMAIN}" ]]                && prompt_required DOMAIN                "Domain name (e.g. app.imperialseal.io)"
[[ -z "${CERTBOT_EMAIL}" ]]         && prompt_required CERTBOT_EMAIL         "Email for SSL cert (Let's Encrypt)"
[[ -z "${ORACLE_ENV_BACKUP_URL}" ]] && prompt_required ORACLE_ENV_BACKUP_URL "Oracle Object Storage pre-auth URL for .env backup"
[[ -z "${ENV_DECRYPT_PASSPHRASE}" ]] && prompt_secret  ENV_DECRYPT_PASSPHRASE "Passphrase to decrypt .env backup"

prompt_optional GIT_BRANCH "Git branch" "${GIT_BRANCH}"

info "Domain:     ${DOMAIN}"
info "Repo:       ${GIT_REPO_URL}"
info "Branch:     ${GIT_BRANCH}"
info "Elapsed:    $(elapsed)"

# ─── Step 1: System dependencies ─────────────────────────────────────────────
section "Step 1/11 — System Packages"

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq 2>&1 | tee -a "${LOG_FILE}"
apt-get upgrade -y -qq 2>&1 | tee -a "${LOG_FILE}"
apt-get install -y -qq \
  curl git unzip build-essential ca-certificates gnupg \
  lsb-release ufw fail2ban htop jq openssl \
  software-properties-common nginx \
  certbot python3-certbot-nginx \
  2>&1 | tee -a "${LOG_FILE}"

log "System packages installed. Elapsed: $(elapsed)"

# ─── Step 2: Create app user ──────────────────────────────────────────────────
section "Step 2/11 — App User & Node.js ${NODE_VERSION}"

if ! id -u "${APP_USER}" &>/dev/null; then
  useradd -r -m -s /bin/bash "${APP_USER}"
  log "Created user: ${APP_USER}"
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

NODE_BIN="$(sudo -u "${APP_USER}" bash -c "source ${NVM_DIR}/nvm.sh && which node")"
NPM_BIN="$(sudo -u "${APP_USER}" bash -c "source ${NVM_DIR}/nvm.sh && which npm")"
NPX_BIN="$(sudo -u "${APP_USER}" bash -c "source ${NVM_DIR}/nvm.sh && which npx")"

ln -sf "${NODE_BIN}" /usr/local/bin/node
ln -sf "${NPM_BIN}"  /usr/local/bin/npm
ln -sf "${NPX_BIN}"  /usr/local/bin/npx

npm install -g pm2 2>&1 | tee -a "${LOG_FILE}"
pm2 startup systemd -u "${APP_USER}" --hp "/home/${APP_USER}" 2>&1 | tee -a "${LOG_FILE}"

log "Node.js $(node --version) + PM2 $(pm2 --version) ready. Elapsed: $(elapsed)"

# ─── Step 3: Clone repository ─────────────────────────────────────────────────
section "Step 3/11 — Clone Repository"

mkdir -p "${APP_DIR}"
chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"
chmod -R 755 "${APP_DIR}"
usermod -aG "${APP_USER}" www-data || true

if [[ -d "${APP_DIR}/.git" ]]; then
  info "Repo exists — pulling latest..."
  sudo -u "${APP_USER}" bash -c "
    cd ${APP_DIR}
    git fetch origin
    git checkout ${GIT_BRANCH}
    git pull origin ${GIT_BRANCH}
  " 2>&1 | tee -a "${LOG_FILE}"
else
  sudo -u "${APP_USER}" git clone \
    --branch "${GIT_BRANCH}" \
    "${GIT_REPO_URL}" \
    "${APP_DIR}" 2>&1 | tee -a "${LOG_FILE}"
fi

log "Repository ready at ${APP_DIR}. Elapsed: $(elapsed)"

# ─── Step 4: Restore .env from Oracle Object Storage ─────────────────────────
section "Step 4/11 — Restore .env from Oracle Object Storage"

mkdir -p "${ENV_DECRYPT_DIR}"
chmod 700 "${ENV_DECRYPT_DIR}"

info "Downloading encrypted .env backup from Oracle Object Storage..."
curl -fSL \
  --retry 5 \
  --retry-delay 3 \
  --connect-timeout 30 \
  -o "${ENV_BACKUP_ARCHIVE}" \
  "${ORACLE_ENV_BACKUP_URL}" \
  2>&1 | tee -a "${LOG_FILE}"

if [[ ! -s "${ENV_BACKUP_ARCHIVE}" ]]; then
  error "Failed to download .env backup or file is empty."
fi

log "Downloaded encrypted backup: ${ENV_BACKUP_ARCHIVE}"

info "Decrypting .env backup..."
openssl enc -aes-256-cbc \
  -d \
  -pbkdf2 \
  -iter 100000 \
  -pass "pass:${ENV_DECRYPT_PASSPHRASE}" \
  -in "${ENV_BACKUP_ARCHIVE}" \
  | tar -xzf - -C "${ENV_DECRYPT_DIR}" \
  2>&1 | tee -a "${LOG_FILE}"

log "Decrypted .env backup."

# Place env files
restore_env() {
  local src_file="${ENV_DECRYPT_DIR}/$1"
  local dest_file="$2"
  if [[ -f "${src_file}" ]]; then
    cp "${src_file}" "${dest_file}"
    chown "${APP_USER}:${APP_USER}" "${dest_file}"
    chmod 600 "${dest_file}"
    log "Restored: ${dest_file}"
  else
    warn "Expected ${src_file} in backup — not found."
  fi
}

restore_env "backend.env"  "${BACKEND_DIR}/.env"
restore_env "frontend.env" "${FRONTEND_DIR}/.env"

# Securely wipe decrypted temp files
rm -rf "${ENV_DECRYPT_DIR}" "${ENV_BACKUP_ARCHIVE}"
log "Temp decrypt files purged. Elapsed: $(elapsed)"

# ─── Step 5: npm install ──────────────────────────────────────────────────────
section "Step 5/11 — npm install"

if [[ -d "${BACKEND_DIR}" ]]; then
  sudo -u "${APP_USER}" bash -c "
    source ${NVM_DIR}/nvm.sh
    cd ${BACKEND_DIR}
    npm ci --production=false
  " 2>&1 | tee -a "${LOG_FILE}"
  log "Backend deps installed."
fi

if [[ -d "${FRONTEND_DIR}" ]]; then
  sudo -u "${APP_USER}" bash -c "
    source ${NVM_DIR}/nvm.sh
    cd ${FRONTEND_DIR}
    npm ci --production=false
  " 2>&1 | tee -a "${LOG_FILE}"
  log "Frontend deps installed."
fi

log "npm installs complete. Elapsed: $(elapsed)"

# ─── Step 6: Build Next.js ────────────────────────────────────────────────────
section "Step 6/11 — Build Next.js"

sudo -u "${APP_USER}" bash -c "
  source ${NVM_DIR}/nvm.sh
  cd ${FRONTEND_DIR}
  npm run build
" 2>&1 | tee -a "${LOG_FILE}"

log "Next.js build complete. Elapsed: $(elapsed)"

# ─── Step 7: Start PM2 ────────────────────────────────────────────────────────
section "Step 7/11 — Start PM2"

ECOSYSTEM_FILE="${DEPLOY_DIR}/ecosystem.config.js"
[[ ! -f "${ECOSYSTEM_FILE}" ]] && ECOSYSTEM_FILE="${APP_DIR}/ecosystem.config.js"

if [[ -f "${ECOSYSTEM_FILE}" ]]; then
  # Stop any existing PM2 processes gracefully
  sudo -u "${APP_USER}" bash -c "
    source ${NVM_DIR}/nvm.sh
    pm2 delete all 2>/dev/null || true
    pm2 start ${ECOSYSTEM_FILE} --env production
    pm2 save
  " 2>&1 | tee -a "${LOG_FILE}"
  log "PM2 started. Elapsed: $(elapsed)"
else
  error "ecosystem.config.js not found at ${ECOSYSTEM_FILE}"
fi

# ─── Step 8: Nginx configuration ─────────────────────────────────────────────
section "Step 8/11 — Nginx Configuration"

systemctl enable nginx
systemctl start nginx

NGINX_CONF_SRC="${DEPLOY_DIR}/nginx.conf"
[[ ! -f "${NGINX_CONF_SRC}" ]] && NGINX_CONF_SRC="${APP_DIR}/nginx.conf"

if [[ -f "${NGINX_CONF_SRC}" ]]; then
  sed "s/__DOMAIN__/${DOMAIN}/g" "${NGINX_CONF_SRC}" \
    > "/etc/nginx/sites-available/imperialseal"
else
  warn "nginx.conf not found — writing temp config for certbot..."
  cat > "/etc/nginx/sites-available/imperialseal" <<NGINX_TEMP
server {
    listen 80;
    server_name ${DOMAIN};
    location / { return 200 'ImperialSeal migrating...'; }
}
NGINX_TEMP
fi

ln -sf "/etc/nginx/sites-available/imperialseal" \
       "/etc/nginx/sites-enabled/imperialseal"
rm -f /etc/nginx/sites-enabled/default

nginx -t 2>&1 | tee -a "${LOG_FILE}"
systemctl reload nginx

log "Nginx configured. Elapsed: $(elapsed)"

# ─── Step 9: SSL certificate ──────────────────────────────────────────────────
section "Step 9/11 — SSL Certificate"

ufw allow 22/tcp  comment "SSH"   2>/dev/null || true
ufw allow 80/tcp  comment "HTTP"  2>/dev/null || true
ufw allow 443/tcp comment "HTTPS" 2>/dev/null || true
ufw --force enable 2>/dev/null || true

certbot --nginx \
  --non-interactive \
  --agree-tos \
  --email "${CERTBOT_EMAIL}" \
  --domains "${DOMAIN}" \
  --redirect \
  2>&1 | tee -a "${LOG_FILE}"

systemctl enable certbot.timer
systemctl start certbot.timer
systemctl reload nginx

log "SSL certificate issued. Elapsed: $(elapsed)"

# ─── Step 10: fail2ban ────────────────────────────────────────────────────────
section "Step 10/11 — fail2ban"

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
log "fail2ban configured. Elapsed: $(elapsed)"

# ─── Step 11: Verification ────────────────────────────────────────────────────
section "Step 11/11 — Service Verification"

FAILED=0

check_service() {
  local name="$1"
  local status; status=$(systemctl is-active "$1" 2>/dev/null || echo "dead")
  if [[ "${status}" == "active" ]]; then
    echo -e "  ${GREEN}✔${NC} ${name}: ${status}"
  else
    echo -e "  ${RED}✘${NC} ${name}: ${status}"
    FAILED=$(( FAILED + 1 ))
  fi
}

check_service nginx
check_service fail2ban
check_service certbot.timer

# Check PM2
PM2_ONLINE=$(sudo -u "${APP_USER}" bash -c "source ${NVM_DIR}/nvm.sh && pm2 jlist 2>/dev/null" \
  | jq '[.[] | select(.pm2_env.status == "online")] | length' 2>/dev/null || echo "0")

if [[ "${PM2_ONLINE}" -ge 1 ]]; then
  echo -e "  ${GREEN}✔${NC} PM2: ${PM2_ONLINE} process(es) online"
else
  echo -e "  ${RED}✘${NC} PM2: no online processes"
  FAILED=$(( FAILED + 1 ))
fi

# HTTP smoke test
info "HTTP smoke test: https://${DOMAIN}/"
HTTP_CODE=$(curl -fsSo /dev/null -w "%{http_code}" --max-time 10 "https://${DOMAIN}/" 2>/dev/null || echo "000")
if [[ "${HTTP_CODE}" =~ ^(200|301|302|307|308)$ ]]; then
  echo -e "  ${GREEN}✔${NC} HTTPS response: ${HTTP_CODE}"
else
  echo -e "  ${YELLOW}⚠${NC} HTTPS response: ${HTTP_CODE} (may need a moment to start)"
fi

# API smoke test
API_CODE=$(curl -fsSo /dev/null -w "%{http_code}" --max-time 10 "https://${DOMAIN}/api/health" 2>/dev/null || echo "000")
if [[ "${API_CODE}" =~ ^(200|401|403)$ ]]; then
  echo -e "  ${GREEN}✔${NC} API /health response: ${API_CODE}"
else
  echo -e "  ${YELLOW}⚠${NC} API /health response: ${API_CODE} (check backend logs)"
fi

MIGRATION_END=$(date +%s)
MIGRATION_SECS=$(( MIGRATION_END - MIGRATION_START ))
MIGRATION_MINS=$(( MIGRATION_SECS / 60 ))

echo ""
if [[ "${FAILED}" -eq 0 ]]; then
  echo -e "${BOLD}${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BOLD}${GREEN}║  Migration COMPLETE in ${MIGRATION_MINS}m ${MIGRATION_SECS}s                              ║${NC}"
  echo -e "${BOLD}${GREEN}║                                                              ║${NC}"
  echo -e "${BOLD}${GREEN}║  App URL:  https://${DOMAIN}${NC}"
  echo -e "${BOLD}${GREEN}║  Logs:     ${LOG_FILE}${NC}"
  echo -e "${BOLD}${GREEN}║  PM2:      sudo -u ${APP_USER} pm2 status                   ║${NC}"
  echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
else
  echo -e "${BOLD}${YELLOW}╔══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BOLD}${YELLOW}║  Migration complete with ${FAILED} warning(s).                    ║${NC}"
  echo -e "${BOLD}${YELLOW}║  Check: ${LOG_FILE}${NC}"
  echo -e "${BOLD}${YELLOW}╚══════════════════════════════════════════════════════════════╝${NC}"
fi

exit "${FAILED}"