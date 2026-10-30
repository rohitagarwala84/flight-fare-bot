# Fare Bot

Company flight-fare search: any Indian airport → Nigeria, Vietnam, Singapore, UAE (and domestic), best 10 fares in INR across a date range, with per-user spend caps and an AI/API expense tracker.

## Ki ache (Phase 1)

- **Login**: admin user banay (username/password), joto khushi user. Prottek user er monthly limit (default ₹1,000), admin badlate pare.
- **Search**: form ba sadha lekha ("Kolkata theke Lagos 5-20 Dec 2 jon"). Date range er best 10 fare, layover Direct/Short (<4h)/Medium (4-8h)/Long (>8h).
- **Raater scan**: protiraate active route list er porer 3 maas er fare cache e rakhe. Din er search beshirbhag cache theke, khoroch prae shunno.
- **Travel policy**: class, max stop/layover, raater flight, blocked/preferred airline, max fare. Policy bhanga fare laal mark.
- **Live check**: ekta fare Google Flights (SerpApi) e mile dekha.
- **Expense**: user-wise o company scan er khoroch, CSV download.
- Limit sesh hole notun live call/AI bondho, shudhu cache dekhabe.

## Data sources

| Kaaj | Source | Dam |
|---|---|---|
| Fare calendar + itinerary | Ignav API | $2 / 1,000 call (~₹0.18 per call) |
| Live check | SerpApi Google Flights | 250/month free |
| Lekha bujha | claude-haiku-5-5 | ~₹0.05 per search |
| Saving tips | claude-opus-5-5 | ~₹1-2 per search |

Nightly scan cost ≈ routes × (calendar calls + detail dates). Default 75 routes × 3 months ≈ 450 calls/night ≈ ₹2,400/month. Admin → Raater scan e route komale ba "detail dates" 2 korle kombe.

## Run locally

```bash
npm install
cp .env.example .env      # fill values
npx prisma db push
npm run seed              # admin + default policy + 5 route lists
npm run dev
```

## Deploy (Google Cloud Run, same as Hemraj Travel Desk)

1. Postgres: Cloud SQL (or Neon free tier). Put the URL in `DATABASE_URL`.
2. API keys go in **Secret Manager** and are mapped to env vars on the Cloud Run service. Never paste keys in chat or commit them.
3. `gcloud run deploy farebot --source . --region europe-west1`
4. Cloud Scheduler job, every night 01:00 IST: `POST https://<service>/api/cron/nightly` with header `Authorization: Bearer <CRON_SECRET>`.

Or run `npm run scan` from any cron.

## Tests

Tests use a local Postgres and a fake Ignav server (`.env.test`), no real API calls:

```bash
npx prisma db push && npm test
```
