# Automated Royalty System

A decentralized royalty platform built on Soroban (Stellar) where creators upload content metadata, users pay to access content, and creators track royalty earnings.

## What This Project Includes

- Web app for creators and users (React)
- Backend API for uploads, search, payments, and creator earnings (Node.js + Express)
- Smart contract workspace (Rust + Soroban)
- JS client scripts for contract interactions
- GitHub Actions L4 CI/CD pipeline

## Repository Structure

- `backend/` - API server, SQLite initialization, Pinata + Soroban integration
- `royalty-frontend/` - React app (welcome page + app page flow)
- `royalty-contract/` - Soroban smart contract workspace
- `js-client/` - JS utilities/scripts for contract calls
- `.github/workflows/` - CI/CD workflows

## Core Features

- Wallet-based access flow
- Upload content metadata with title, hashtags, and royalty percent
- Marketplace view with search
- Pay-to-access flow and unlock state
- Creator dashboard with:
  - Content title
  - Creator username
  - Royalty amount
  - CID
- Creator earnings summary and withdrawal action
- Content removal from IPFS (creator only)

## Prerequisites

- Node.js 20+
- npm 9+
- Rust toolchain (for contract checks/build)
- Freighter wallet extension
- Pinata account/API keys

## Environment Variables

Create a local environment file in `backend/.env`:

- `PINATA_API_KEY`
- `PINATA_SECRET_API_KEY`
- `SOROBAN_RPC`
- `CONTRACT_ID`
- `NATIVE_TOKEN_ADDRESS`

Optional frontend env can be added in `royalty-frontend/.env` only when needed.

Important: never commit real secrets. This repository now ignores all `.env` files by default.

## Local Development

### 1. Backend

```bash
cd backend
npm install
node server.js
```

Runs on: `http://localhost:4000`

### 2. Frontend

```bash
cd royalty-frontend
npm install
npm start
```

Build for production:

```bash
npm run build
```

### 3. JS Client

```bash
cd js-client
npm install
node pay.js
```

### 4. Smart Contract Workspace

```bash
cd royalty-contract
cargo check --workspace
cargo test --workspace
```

## API Overview (Backend)

- `POST /upload-and-register`
- `GET /contents`
- `GET /search?q=...`
- `POST /pay-on-view`
- `POST /submit`
- `GET /creator-earnings/:address`
- `DELETE /content/:cid`

## CI/CD (L4)

The workflow in `.github/workflows/l4-cicd.yml` performs:

- Frontend CI build
- Backend syntax + DB bootstrap validation
- JS client syntax validation
- Smart contract Rust checks and tests
- CD packaging on `main` with deploy bundle + checksum

## Security Notes

- Do not commit `.env` files, API keys, private keys, or local databases.
- If secrets were ever committed previously, rotate them immediately.
- Use GitHub Secrets for deployment/runtime credentials.

## Recommended Next Steps

- Add `.env.example` templates per module
- Add API and UI automated tests
- Add production deployment target in CI/CD (Azure/Render/Vercel)
- Add database migration/versioning strategy
