#!/bin/bash
SUPABASE_URL="https://wliobldgrzjjchfknqju.supabase.co"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndsaW9ibGRncnpqamNoZmtucWp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NDYzODQsImV4cCI6MjA5MzAyMjM4NH0.5yT_REihgqmCQAnKSfsylcKHyvnsBxwFxy7rgGKwBEo"
PW="AuditTest2026!"
signin() { curl -s -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" -H "apikey: $ANON_KEY" -H "Content-Type: application/json" -d "{\"email\":\"$1\",\"password\":\"$PW\"}" 2>/dev/null | python3 -c "import sys,json;print(json.load(sys.stdin).get('access_token','FAIL'))" 2>/dev/null; }

TOKEN_LETEST_DIR=$(signin "christopheinfo21+test@gmail.com")
TOKEN_GARI_DIR=$(signin "vanessalemesnil@gmail.com")
TOKEN_LETEST_AGENT=$(signin "christopheinfo21+test2@gmail.com")
TOKEN_GARI_SERVEUR=$(signin "christopheinfo21+serveur@gmail.com")
TOKEN_SUPERADMIN=$(signin "christophelemesnil@gmail.com")

LETEST_ETAB="08863af3-a1e2-4b90-a6c4-c2863f017494"
GARI_ETAB="d870f00c-6b7f-4324-accb-d38e7ba53b5c"

call_edge() {
  local name="$1" method="$2" path="$3" body="$4" token="$5"
  local status=$(curl -s -o /tmp/er.txt -w "%{http_code}" -X "$method" "$SUPABASE_URL/functions/v1/$path" -H "Authorization: Bearer $token" -H "apikey: $ANON_KEY" -H "Content-Type: application/json" -d "$body" 2>/dev/null)
  echo "$name | HTTP $status | $(cat /tmp/er.txt | head -c 200)"
}

echo "=== RETEST WITH CORRECT PARAMS ==="
echo ""
echo "--- send-signature-rappel (cross: LeTest Dir targets GARI agent email) ---"
call_edge "rappel_cross" "POST" "send-signature-rappel" "{\"target_email\":\"christopheinfo21+serveur@gmail.com\"}" "$TOKEN_LETEST_DIR"
echo "--- send-signature-rappel (own: LeTest Dir targets LeTest agent email) ---"
call_edge "rappel_own" "POST" "send-signature-rappel" "{\"target_email\":\"christopheinfo21+test2@gmail.com\"}" "$TOKEN_LETEST_DIR"
echo "--- send-signature-rappel (by Agent - should be 403) ---"
call_edge "rappel_agent" "POST" "send-signature-rappel" "{\"target_email\":\"christopheinfo21+serveur@gmail.com\"}" "$TOKEN_LETEST_AGENT"

echo ""
echo "--- invite-user (cross: LeTest Dir invites to GARI - should auto-use LeTest etab) ---"
call_edge "invite_cross" "POST" "invite-user" "{\"email\":\"crosstest1@test.com\",\"password\":\"Test1234!\",\"fonction\":\"Agent de Sécurité\",\"etablissement_id\":\"$GARI_ETAB\"}" "$TOKEN_LETEST_DIR"
echo "--- invite-user (own: LeTest Dir invites to LeTest) ---"
call_edge "invite_own" "POST" "invite-user" "{\"email\":\"crosstest2@test.com\",\"password\":\"Test1234!\",\"fonction\":\"Agent de Sécurité\",\"etablissement_id\":\"$LETEST_ETAB\"}" "$TOKEN_LETEST_DIR"

echo ""
echo "--- resend-invitation (cross: LeTest Dir resends for GARI user) ---"
call_edge "resend_cross" "POST" "resend-invitation" "{\"etablissement_id\":\"$GARI_ETAB\",\"email\":\"christopheinfo21+serveur@gmail.com\"}" "$TOKEN_LETEST_DIR"
echo "--- resend-invitation (own: LeTest Dir resends for LeTest user) ---"
call_edge "resend_own" "POST" "resend-invitation" "{\"etablissement_id\":\"$LETEST_ETAB\",\"email\":\"christopheinfo21+test2@gmail.com\"}" "$TOKEN_LETEST_DIR"

echo ""
echo "--- ia-assistant (cross: LeTest asks about GARI) ---"
call_edge "ia_cross" "POST" "ia-assistant" "{\"message\":\"Quel est le nom de mon etablissement?\"}" "$TOKEN_LETEST_DIR"
echo "--- ia-assistant (own: GARI Dir asks about own) ---"
call_edge "ia_gari_own" "POST" "ia-assistant" "{\"message\":\"Quel est le nom de mon etablissement?\"}" "$TOKEN_GARI_DIR"

echo ""
echo "=== CLEANUP: delete test users created by invite-user ==="
# These will be cleaned via SQL later
