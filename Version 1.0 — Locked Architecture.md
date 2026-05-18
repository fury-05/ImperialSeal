# ImperialSeal — Master Build System

## Complete Schema, Architecture & Prompt Library

### Version 1.0 — Locked Architecture

---

# PART 1 — LOCKED DECISIONS REFERENCE

## Core Platform Architecture

| Component         | Locked Decision                                               |
| ----------------- | ------------------------------------------------------------- |
| **Platform Name** | ImperialSeal *(UI-changeable via Super Admin at any time)*    |
| **Frontend**      | Next.js 14 (App Router) + Tailwind CSS + Framer Motion        |
| **Backend**       | Node.js + Express (REST API)                                  |
| **Database**      | Supabase (PostgreSQL) — metadata, queues, all relational data |
| **File Storage**  | Oracle Cloud Object Storage (S3-compatible, 20GB free)        |

---

## Certification & Blockchain Infrastructure

| Component                   | Locked Decision                                                 |
| --------------------------- | --------------------------------------------------------------- |
| **Certificate Chain A**     | AVOI Network — set per course, locked after creation            |
| **Certificate Chain B**     | Algorand Mainnet — set per course, locked after creation        |
| **Smart Contract Standard** | ARC-3 (Certificates) + ARC-69 (Badges) on both VOI and Algorand |

---

## Payment System

| Component                  | Locked Decision                                                      |
| -------------------------- | -------------------------------------------------------------------- |
| **Payment Collection**     | USDC / ALGO / wALGO on Algorand — set per client by Super Admin      |
| **Issuance Fee**           | $0.80 (Certificate only) / $0.40 (Badge only) / $1.00 (Both)         |
| **Pricing Engine**         | Real-time VOI / ALGO conversion via CoinGecko Free API               |
| **Co-host / Sponsor Flow** | Request-based → Super Admin sets price → On-chain payment → Unlock   |
| **Design Lock / Unlock**   | Paid unlock → Super Admin sets price each time → 48-hour edit window |

---

## Email & Communication Layer

| Component            | Locked Decision                     |
| -------------------- | ----------------------------------- |
| **Email Layer**      | Provider-agnostic abstraction       |
| **Default Provider** | SendGrid Free Tier (100 emails/day) |
| **Delivery Model**   | Queue-based                         |

---

## Wallet Infrastructure

| Component               | Locked Decision                                    |
| ----------------------- | -------------------------------------------------- |
| **Institution Wallet**  | Custodial server-side VOI wallet                   |
| **Private Key Storage** | Encrypted in Supabase                              |
| **Super Admin Wallet**  | Pera / Defly connected wallet                      |
| **Payment Receiver**    | All platform payments routed to Super Admin wallet |

---

## Document Generation & Delivery

| Component      | Locked Decision             |
| -------------- | --------------------------- |
| **PDF Engine** | Puppeteer (Headless Chrome) |
| **SSL**        | Certbot / Let’s Encrypt     |

---

## Hosting & Deployment Stack

| Component           | Locked Decision                         |
| ------------------- | --------------------------------------- |
| **Current VM Host** | Azure B2s (Ubuntu 22.04) — Free Credits |
| **Future VM Host**  | Any VPS — Single migration command      |
| **Process Manager** | PM2                                     |
| **Reverse Proxy**   | Nginx                                   |

---

# Operational Principles

## Immutable Rules

* Course blockchain selection is **permanent after creation**
* Payment token selection is **client-configurable only by Super Admin**
* Certificate issuance pricing is **real-time conversion based**
* Design edits after lock require **paid unlock**
* Sponsorship and co-hosting require **admin approval + blockchain payment**
* Architecture is **VPS-portable with single-command migration**

---

# Strategic Design Philosophy

## ImperialSeal is engineered for:

* Institutional certificate issuance
* Multi-chain verification
* Blockchain-backed badges
* White-label education partnerships
* Revenue through issuance, sponsorships, and design control
* Low-cost scalability using free-tier infrastructure first

---

# Deployment Summary (Fast View)

```txt
Frontend: Next.js 14
Backend: Node.js + Express
DB: Supabase PostgreSQL
Storage: Oracle Object Storage
Blockchain: AVOI + Algorand
NFT Standards: ARC-3 + ARC-69
Payments: USDC / ALGO / wALGO
Wallets: Custodial (Institutions) + Pera/Defly (Admin)
PDF: Puppeteer
Email: SendGrid
Hosting: Azure B2s → Any VPS
SSL: Certbot
Proxy: Nginx
Process: PM2
```
