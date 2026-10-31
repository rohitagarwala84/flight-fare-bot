#!/usr/bin/env bash
# One-shot deploy of Fare Bot to Google Cloud Run, run from Cloud Shell inside
# the unpacked code folder:   bash scripts/gcp-deploy.sh
# Safe to run again: existing secrets, database and jobs are kept or updated.
set -euo pipefail

PROJECT="${PROJECT:-fare-bot-513306}"
DB_PROJECT="${DB_PROJECT:-debtors-data}"   # project that already has a Cloud SQL Postgres
SERVICE=farebot

say() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
ask_secret() { # name prompt
  local v=""
  while [ -z "$v" ]; do read -r -s -p "$2: " v; echo >&2; done
  printf '%s' "$v"
}
have_secret() { gcloud secrets describe "$1" --project "$PROJECT" >/dev/null 2>&1; }
put_secret() { # name value
  if have_secret "$1"; then
    printf '%s' "$2" | gcloud secrets versions add "$1" --project "$PROJECT" --data-file=- >/dev/null
  else
    printf '%s' "$2" | gcloud secrets create "$1" --project "$PROJECT" --replication-policy=automatic --data-file=- >/dev/null
  fi
}

gcloud config set project "$PROJECT" >/dev/null
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')
RUN_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

say "1/6 Google services chalu korchi (2-3 minute)"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com \
  secretmanager.googleapis.com sqladmin.googleapis.com cloudscheduler.googleapis.com --project "$PROJECT"

say "2/6 Database ($DB_PROJECT project e)"
INSTANCE=$(gcloud sql instances list --project "$DB_PROJECT" --filter='databaseVersion~^POSTGRES' --format='value(name)' 2>/dev/null | head -1 || true)
SQL_CONN=""
if [ -n "$INSTANCE" ]; then
  SQL_CONN=$(gcloud sql instances describe "$INSTANCE" --project "$DB_PROJECT" --format='value(connectionName)')
  REGION=$(gcloud sql instances describe "$INSTANCE" --project "$DB_PROJECT" --format='value(region)')
  echo "Postgres paoa geche: $SQL_CONN"
  gcloud sql databases describe farebot --instance "$INSTANCE" --project "$DB_PROJECT" >/dev/null 2>&1 \
    || gcloud sql databases create farebot --instance "$INSTANCE" --project "$DB_PROJECT"
  if ! have_secret DATABASE_URL; then
    DB_PASS=$(openssl rand -hex 24)
    if gcloud sql users list --instance "$INSTANCE" --project "$DB_PROJECT" --format='value(name)' | grep -qx farebot; then
      gcloud sql users set-password farebot --instance "$INSTANCE" --project "$DB_PROJECT" --password "$DB_PASS"
    else
      gcloud sql users create farebot --instance "$INSTANCE" --project "$DB_PROJECT" --password "$DB_PASS"
    fi
    put_secret DATABASE_URL "postgresql://farebot:${DB_PASS}@localhost/farebot?host=/cloudsql/${SQL_CONN}"
  fi
  # The app may connect to Cloud SQL in the other project (approved by Rohit).
  gcloud projects add-iam-policy-binding "$DB_PROJECT" --member "serviceAccount:$RUN_SA" \
    --role roles/cloudsql.client --condition=None >/dev/null
else
  REGION=asia-south1
  echo "$DB_PROJECT e kono Postgres database nei."
  if ! have_secret DATABASE_URL; then
    echo "Neon (neon.tech) e free database banan, 'Connection string' ta copy kore niche paste korun."
    put_secret DATABASE_URL "$(ask_secret DATABASE_URL 'Neon connection string (type korle dekha jabe na)')"
  fi
fi

say "3/6 Key gulo Secret Manager e rakhchi"
have_secret ANTHROPIC_API_KEY || put_secret ANTHROPIC_API_KEY "$(ask_secret ANTHROPIC_API_KEY 'Anthropic key paste kore Enter din (dekha jabe na)')"
have_secret IGNAV_API_KEY || put_secret IGNAV_API_KEY "$(ask_secret IGNAV_API_KEY 'Ignav key paste kore Enter din (dekha jabe na)')"
have_secret ADMIN_PASSWORD || put_secret ADMIN_PASSWORD "$(ask_secret ADMIN_PASSWORD 'Fare Bot e login er notun password likhun, 8+ okkhor (dekha jabe na)')"
have_secret SESSION_SECRET || put_secret SESSION_SECRET "$(openssl rand -hex 32)"
have_secret CRON_SECRET || put_secret CRON_SECRET "$(openssl rand -hex 24)"
SECRETS="DATABASE_URL=DATABASE_URL:latest,ANTHROPIC_API_KEY=ANTHROPIC_API_KEY:latest,IGNAV_API_KEY=IGNAV_API_KEY:latest,ADMIN_PASSWORD=ADMIN_PASSWORD:latest,SESSION_SECRET=SESSION_SECRET:latest,CRON_SECRET=CRON_SECRET:latest"
if have_secret SERPAPI_API_KEY; then SECRETS="$SECRETS,SERPAPI_API_KEY=SERPAPI_API_KEY:latest"; fi

# The app's own service account: read its secrets and build its image (approved by Rohit).
for role in roles/secretmanager.secretAccessor roles/cloudbuild.builds.builder; do
  gcloud projects add-iam-policy-binding "$PROJECT" --member "serviceAccount:$RUN_SA" --role "$role" --condition=None >/dev/null
done

say "4/6 App banacchi ar chalu korchi (5-10 minute, kichhu korben na)"
DEPLOY_ARGS=(--source . --region "$REGION" --project "$PROJECT" --allow-unauthenticated
  --min-instances 0 --max-instances 1 --memory 1Gi --timeout 1800
  --set-secrets "$SECRETS"
  --set-env-vars "ADMIN_USERNAME=admin,ADMIN_NAME=Rohit,NODE_ENV=production")
if [ -n "$SQL_CONN" ]; then DEPLOY_ARGS+=(--add-cloudsql-instances "$SQL_CONN"); fi
gcloud run deploy "$SERVICE" "${DEPLOY_ARGS[@]}" --quiet
URL=$(gcloud run services describe "$SERVICE" --region "$REGION" --project "$PROJECT" --format='value(status.url)')

say "5/6 Protiraate 1:00 (IST) scan er job"
CRON=$(gcloud secrets versions access latest --secret CRON_SECRET --project "$PROJECT")
JOB_ARGS=(--location "$REGION" --project "$PROJECT" --schedule "0 1 * * *" --time-zone "Asia/Kolkata"
  --uri "$URL/api/cron/nightly" --http-method POST --headers "Authorization=Bearer $CRON" --attempt-deadline 30m)
if gcloud scheduler jobs describe farebot-nightly --location "$REGION" --project "$PROJECT" >/dev/null 2>&1; then
  gcloud scheduler jobs update http farebot-nightly "${JOB_ARGS[@]}" >/dev/null
else
  gcloud scheduler jobs create http farebot-nightly "${JOB_ARGS[@]}" >/dev/null
fi

say "6/6 Hoye geche!"
echo "Fare Bot link:  $URL"
echo "Login:          admin  /  apnar deya password"
