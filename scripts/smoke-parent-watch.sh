#!/usr/bin/env bash
#
# Smoke test: parent self-service "watch my child's live session".
#
# Exercises the full flow end-to-end against a RUNNING server:
#   therapist login -> create patient -> invite parent -> accept invite
#   (provisions the parent's Firebase identity + returns a custom token)
#   -> therapist starts a session -> parent binds to that child's live session.
#
# Because the raw invite token is only delivered by email (Firestore stores
# only its hash), the run is split into two stages around that manual step:
#
#   Stage A (no PARENT_INVITE_TOKEN set):
#     bash scripts/smoke-parent-watch.sh
#       -> logs in the therapist, creates a patient, invites the parent.
#          Saves state to scripts/.smoke-parent-watch.state and tells you to
#          grab the token from the invite email.
#
#   Stage B (PARENT_INVITE_TOKEN set):
#     PARENT_INVITE_TOKEN='<token from email>' bash scripts/smoke-parent-watch.sh
#       -> accepts the invite, starts a session, and binds the parent.
#          Expected final payload: { patientId, sessionId, activities, realtimePath }.
#
# Requires: bash, curl, node (all already present in this repo's toolchain).
#
# Config (env vars; FIREBASE_WEB_API_KEY is auto-read from server/.env if unset):
#   BASE_URL              default http://localhost:3003
#   FIREBASE_WEB_API_KEY  Firebase Web API key (custom-token -> ID-token exchange)
#   THERAPIST_TZ          Israeli T.Z of an existing therapist login
#   THERAPIST_PASSWORD    that therapist's password
#   PARENT_EMAIL          email for the parent being invited (Stage A)
#   PARENT_INVITE_TOKEN   raw token from the invite email (triggers Stage B)
#   PATIENT_ID            optional; reuse an existing patient instead of creating one

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE_FILE="${SMOKE_STATE:-$SCRIPT_DIR/.smoke-parent-watch.state}"
ENV_FILE="$SCRIPT_DIR/../server/.env"

BASE_URL="${BASE_URL:-http://localhost:3003}"

# Pull just the web API key out of server/.env (avoid sourcing the whole file,
# which may contain a JSON service account that would break `source`).
if [ -z "${FIREBASE_WEB_API_KEY:-}" ] && [ -f "$ENV_FILE" ]; then
  FIREBASE_WEB_API_KEY="$(grep -E '^FIREBASE_WEB_API_KEY=' "$ENV_FILE" | head -1 | cut -d= -f2- || true)"
fi

red()   { printf '\033[31m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }
step()  { printf '\n\033[1m==> %s\033[0m\n' "$*"; }

die() { red "ERROR: $*"; exit 1; }

require() { [ -n "${!1:-}" ] || die "missing required env var: $1"; }

# Extract a (possibly nested) field from a JSON stdin: echo "$json" | jval a.b.c
jval() {
  node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{let o;try{o=JSON.parse(s)}catch(e){console.error("Non-JSON response:\n"+s);process.exit(2)}let v=o;for(const k of (process.argv[1]||"").split(".").filter(Boolean)){v=(v==null?undefined:v[k])}process.stdout.write(v==null?"":typeof v==="object"?JSON.stringify(v):String(v))})' "$1"
}

# POST helper: post <url> <json-body> [bearer]
post() {
  local url="$1" body="$2" bearer="${3:-}"
  if [ -n "$bearer" ]; then
    curl -sS -X POST "$url" -H 'Content-Type: application/json' -H "Authorization: Bearer $bearer" -d "$body"
  else
    curl -sS -X POST "$url" -H 'Content-Type: application/json' -d "$body"
  fi
}

json_body() { node -e 'process.stdout.write(process.argv[1])' "$1"; }

# custom token -> Firebase ID token via Identity Toolkit REST
exchange_custom_token() {
  require FIREBASE_WEB_API_KEY
  local body
  body="$(node -e 'process.stdout.write(JSON.stringify({token:process.argv[1],returnSecureToken:true}))' "$1")"
  local resp
  resp="$(post "https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${FIREBASE_WEB_API_KEY}" "$body")"
  local id_token
  id_token="$(printf '%s' "$resp" | jval idToken)"
  [ -n "$id_token" ] || die "custom-token exchange failed: $resp"
  printf '%s' "$id_token"
}

therapist_id_token() {
  require THERAPIST_TZ
  require THERAPIST_PASSWORD
  local resp custom
  resp="$(post "$BASE_URL/auth/login" "$(node -e 'process.stdout.write(JSON.stringify({israeliId:process.argv[1],password:process.argv[2]}))' "$THERAPIST_TZ" "$THERAPIST_PASSWORD")")"
  custom="$(printf '%s' "$resp" | jval customToken)"
  [ -n "$custom" ] || die "therapist login failed: $resp"
  exchange_custom_token "$custom"
}

# --- preflight ---------------------------------------------------------------
step "Health check ($BASE_URL/health)"
HEALTH="$(curl -sS "$BASE_URL/health" || true)"
[ "$(printf '%s' "$HEALTH" | jval ok)" = "true" ] || die "server not healthy: $HEALTH"
green "server up"

# =============================================================================
if [ -z "${PARENT_INVITE_TOKEN:-}" ]; then
  # --------------------------- STAGE A -------------------------------------
  step "STAGE A — therapist login"
  TID="$(therapist_id_token)"
  green "therapist ID token acquired"

  if [ -z "${PATIENT_ID:-}" ]; then
    step "Create patient (parentSharingEnabled so the parent may watch)"
    PRESP="$(post "$BASE_URL/patients" '{"displayName":"Smoke Child","age":8,"sex":"unspecified","parentSharingEnabled":true}' "$TID")"
    PATIENT_ID="$(printf '%s' "$PRESP" | jval id)"
    [ -n "$PATIENT_ID" ] || die "patient create failed: $PRESP"
    green "patientId=$PATIENT_ID"
  else
    green "reusing PATIENT_ID=$PATIENT_ID"
  fi

  step "Invite parent"
  require PARENT_EMAIL
  PARESP="$(post "$BASE_URL/parent-accounts" "$(node -e 'process.stdout.write(JSON.stringify({patientId:process.argv[1],fullName:"Smoke Parent",relationship:"mother",email:process.argv[2],requestAppAccess:true}))' "$PATIENT_ID" "$PARENT_EMAIL")" "$TID")"
  echo "  response: $PARESP"
  [ "$(printf '%s' "$PARESP" | jval emailSent)" = "true" ] || red "  (emailSent not true — check RESEND_* config; token still generated)"

  printf 'PATIENT_ID=%s\n' "$PATIENT_ID" > "$STATE_FILE"
  green "state saved to $STATE_FILE"

  step "NEXT: grab the invite token from the email, then run STAGE B:"
  cat <<EOF

  PARENT_INVITE_TOKEN='<token-from-email>' \\
  THERAPIST_TZ='$THERAPIST_TZ' THERAPIST_PASSWORD='***' \\
  bash "$0"

  (PATIENT_ID is remembered in $STATE_FILE.)
EOF
  exit 0
fi

# --------------------------- STAGE B ---------------------------------------
if [ -z "${PATIENT_ID:-}" ] && [ -f "$STATE_FILE" ]; then
  # shellcheck disable=SC1090
  . "$STATE_FILE"
fi
require PATIENT_ID

step "STAGE B — accept parent invitation"
ARESP="$(post "$BASE_URL/parent-invitations/accept" "$(node -e 'process.stdout.write(JSON.stringify({token:process.argv[1]}))' "$PARENT_INVITE_TOKEN")")"
PCUSTOM="$(printf '%s' "$ARESP" | jval token)"
[ -n "$PCUSTOM" ] || die "invite accept failed: $ARESP"
green "parent activated; custom token received (parentId=$(printf '%s' "$ARESP" | jval parentId))"

PID_TOKEN="$(exchange_custom_token "$PCUSTOM")"
green "parent ID token acquired"

step "Therapist starts a session for the child"
TID="$(therapist_id_token)"
SRESP="$(post "$BASE_URL/therapy-sessions" "$(node -e 'process.stdout.write(JSON.stringify({patientId:process.argv[1],activities:[{type:"breathing",order:1}]}))' "$PATIENT_ID")" "$TID")"
SESSION_ID="$(printf '%s' "$SRESP" | jval id)"
[ -n "$SESSION_ID" ] || die "session create failed: $SRESP"
green "sessionId=$SESSION_ID (status=$(printf '%s' "$SRESP" | jval status))"

step "Parent binds to the child's live session"
WRESP="$(post "$BASE_URL/parent/sessions/watch" "$(node -e 'process.stdout.write(JSON.stringify({patientId:process.argv[1]}))' "$PATIENT_ID")" "$PID_TOKEN")"
echo "  response: $WRESP"
RTPATH="$(printf '%s' "$WRESP" | jval realtimePath)"
[ -n "$RTPATH" ] || die "watch failed: $WRESP"

green ""
green "SUCCESS — parent bound to $RTPATH"
green "The parent client can now subscribe to that RTDB path (once database.rules.json is deployed)."
