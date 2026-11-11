# CONTRIBUTING.md — Developing PaySight

## 1. Development Setup

```bash
git clone https://github.com/yugomania/Paysight.git
cd Paysight
npm ci
cp .env.example .env.local
npm run dev
```

PaySight runs immediately in **Demo Mode** with `.env.local` left blank, or in **PayPal Sandbox Mode** once PayPal Sandbox keys are configured.

---

## 2. Branching & Pull Request Workflow

1. Create feature branches off `main` (e.g. `feat/...`, `fix/...`, `hackathon/...`).
2. Keep commits focused and well-scoped.
3. Never commit `.env.local`, secrets, or `.data/` runtime database files.
4. Run all verification gates before opening a PR:

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
```

---

## 3. Coding Conventions

- **Next.js 16 Rules**: Review `node_modules/next/dist/docs/` before modifying Next.js configuration or App Router APIs (`AGENTS.md`).
- **Financial Precision & Honesty**:
  - Never aggregate amounts across different currencies without an explicit FX conversion rate.
  - Keep `demo_sample` records strictly separate from `paypal_sandbox` records.
  - Never fabricate competitor listings, disputes, or payment links.
- **Test Isolation**: All automated tests in `tests/*.test.ts` must set `process.env.PAYSIGHT_DB_PATH` to a temporary directory cleaned up in `t.after()` so local `.data/paysight-db.json` is never polluted.
- **AI SDK Compatibility**: Keep `ai` (`4.x`), `@ai-sdk/google` (`1.x`), and `ai/react` aligned.

