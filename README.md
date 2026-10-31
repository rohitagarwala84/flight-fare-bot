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

## Deploy — Hemraj group er Google Cloud project e, target ₹0/month

Use the same Google Cloud project as Hemraj Travel Desk wherever possible (same billing, same people manage it):

1. **Database:** a separate `farebot` database (and its own DB user) inside Hemraj's existing Cloud SQL instance, so no new instance cost. If MIS doesn't want that, use Neon's free Postgres. Don't create a new Cloud SQL instance (₹800+/month).
2. **Hosting:** a new Cloud Run service `farebot` in the same project, min instances 0, max 1. 5 users fit inside the monthly free tier. First page load after a quiet spell takes a few seconds.
3. **API keys:** Secret Manager in the same project, mapped to env vars on the service. Never paste keys in chat or commit them.
4. `gcloud run deploy farebot --source . --region europe-west1 --min-instances 0 --max-instances 1`
5. **Nightly scan:** Cloud Scheduler, 01:00 IST: `POST https://<service>/api/cron/nightly` with header `Authorization: Bearer <CRON_SECRET>`.
6. Budget alert on the project at ₹200 above the current Hemraj spend.

### On start

The container (see `Dockerfile`) creates/updates the tables, creates the admin login from `ADMIN_USERNAME`/`ADMIN_PASSWORD` if it doesn't exist, adds the default policy and route lists, then starts the web app. No separate seed step is needed.

## Data retention: 7 days

Every night after the scan, everything older than 7 days is deleted: searches, call-by-call cost rows, old itinerary snapshots and past travel dates. Only the small monthly totals per user (`MonthlySpend`) are kept, so monthly limits and the expense page keep working. Download the month's CSV from the expense page if you need a record.

Or run `npm run scan` from any cron.

## Tests

Tests use a local Postgres and a fake Ignav server (`.env.test`), no real API calls:

```bash
npx prisma db push && npm test
```
