#!/bin/bash
set -e

SUPABASE_URL="https://wliobldgrzjjchfknqju.supabase.co"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndsaW9ibGRncnpqamNoZmtucWp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NDYzODQsImV4cCI6MjA5MzAyMjM4NH0.5yT_REihgqmCQAnKSfsylcKHyvnsBxwFxy7rgGKwBEo"
PW="AuditTest2026!"

# Sign in and extract tokens
signin() {
  local email="$1"
  local result=$(curl -s -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
    -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"$PW\"}" 2>/dev/null)
  echo "$result" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('access_token','FAIL'))" 2>/dev/null
}

echo "=== Signing in users ==="
TOKEN_LETEST_DIR=$(signin "christopheinfo21+test@gmail.com")
TOKEN_GARI_DIR=$(signin "vanessalemesnil@gmail.com")
TOKEN_LETEST_AGENT=$(signin "christopheinfo21+test2@gmail.com")
TOKEN_GARI_SERVEUR=$(signin "christopheinfo21+serveur@gmail.com")
TOKEN_SUPERADMIN=$(signin "christophelemesnil@gmail.com")

echo "LeTest Dir: ${TOKEN_LETEST_DIR:0:20}..."
echo "GARI Dir:   ${TOKEN_GARI_DIR:0:20}..."
echo "LeTest Agent: ${TOKEN_LETEST_AGENT:0:20}..."
echo "GARI Serveur: ${TOKEN_GARI_SERVEUR:0:20}..."
echo "SuperAdmin: ${TOKEN_SUPERADMIN:0:20}..."

# IDs
LETEST_ETAB="08863af3-a1e2-4b90-a6c4-c2863f017494"
GARI_ETAB="d870f00c-6b7f-4324-accb-d38e7ba53b5c"
GARI_AGENT_AUTH="78a02af5-875c-46f0-bcbd-810571d74595"  # SARL GARI agent
LETEST_AGENT_AUTH="f10ba33b-c76a-4325-9dc3-1ada76661f9c"  # Le Test agent
GARI_DIR_AUTH="82cff3ce-e322-46f9-9f49-bca9a81d330f"

call_edge() {
  local name="$1" method="$2" path="$3" body="$4" token="$5"
  local status=$(curl -s -o /tmp/edge_response.txt -w "%{http_code}" \
    -X "$method" "$SUPABASE_URL/functions/v1/$path" \
    -H "Authorization: Bearer $token" \
    -H "apikey: $ANON_KEY" \
    -H "Content-Type: application/json" \
    -d "$body" 2>/dev/null)
  local resp=$(cat /tmp/edge_response.txt | head -c 200)
  echo "$name | HTTP $status | $resp"
}

echo ""
echo "=== EDGE FUNCTION TESTS ==="
echo ""
echo "--- create-managed-user (PATCH cross-etab: LeTest Dir targets GARI agent) ---"
call_edge "PATCH_cross" "PATCH" "create-managed-user" \
  "{\"auth_user_id\":\"$GARI_AGENT_AUTH\",\"fonction\":\"Serveur\"}" "$TOKEN_LETEST_DIR"

echo "--- create-managed-user (DELETE cross-etab: LeTest Dir targets GARI agent) ---"
# Use a dummy auth_user_id that won't exist - but let's use the real GARI agent to test the guard
# Actually, DON'T delete a real user. Use a non-existent ID to test the guard path
call_edge "DELETE_cross_fakeid" "DELETE" "create-managed-user" \
  "{\"auth_user_id\":\"00000000-0000-0000-0000-000000000001\"}" "$TOKEN_LETEST_DIR"

echo "--- create-managed-user (PATCH own etab: LeTest Dir targets LeTest agent) ---"
call_edge "PATCH_own" "PATCH" "create-managed-user" \
  "{\"auth_user_id\":\"$LETEST_AGENT_AUTH\",\"fonction\":\"Agent de Sécurité\"}" "$TOKEN_LETEST_DIR"

echo "--- create-managed-user (PATCH by SuperAdmin on GARI agent) ---"
call_edge "PATCH_superadmin" "PATCH" "create-managed-user" \
  "{\"auth_user_id\":\"$GARI_AGENT_AUTH\",\"fonction\":\"Serveur\"}" "$TOKEN_SUPERADMIN"

echo "--- create-managed-user (PATCH by Agent - should be 403) ---"
call_edge "PATCH_agent_forbidden" "PATCH" "create-managed-user" \
  "{\"auth_user_id\":\"$GARI_AGENT_AUTH\",\"fonction\":\"Serveur\"}" "$TOKEN_LETEST_AGENT"

echo ""
echo "--- export-etablissement-data (cross: LeTest exports GARI) ---"
call_edge "export_cross" "POST" "export-etablissement-data" \
  "{\"etablissement_id\":\"$GARI_ETAB\"}" "$TOKEN_LETEST_DIR"

echo "--- export-etablissement-data (own: LeTest exports LeTest) ---"
call_edge "export_own" "POST" "export-etablissement-data" \
  "{\"etablissement_id\":\"$LETEST_ETAB\"}" "$TOKEN_LETEST_DIR"

echo ""
echo "--- send-signature-rappel (cross: LeTest Dir targets GARI agent) ---"
call_edge "rappel_cross" "POST" "send-signature-rappel" \
  "{\"auth_user_id\":\"$GARI_AGENT_AUTH\"}" "$TOKEN_LETEST_DIR"

echo ""
echo "--- invite-user (cross: LeTest Dir invites to GARI) ---"
call_edge "invite_cross" "POST" "invite-user" \
  "{\"email\":\"crosstest@test.com\",\"fonction\":\"Agent de Sécurité\",\"etablissement_id\":\"$GARI_ETAB\",\"first_name\":\"Cross\",\"last_name\":\"Test\"}" "$TOKEN_LETEST_DIR"

echo ""
echo "--- resend-invitation (cross: LeTest Dir resends for GARI user) ---"
call_edge "resend_cross" "POST" "resend-invitation" \
  "{\"auth_user_id\":\"$GARI_AGENT_AUTH\"}" "$TOKEN_LETEST_DIR"

echo ""
echo "--- clean-orphan-auth (by non-superadmin: LeTest Dir) ---"
call_edge "orphan_nonsuper" "POST" "clean-orphan-auth" \
  "{}" "$TOKEN_LETEST_DIR"

echo "--- clean-orphan-auth (by SuperAdmin) ---"
call_edge "orphan_super" "POST" "clean-orphan-auth" \
  "{}" "$TOKEN_SUPERADMIN"

echo ""
echo "--- flic-jauge (without secret) ---"
call_edge "flic_nosecret" "POST" "flic-jauge" \
  "{\"mac\":\"test\",\"action\":\"click\"}" "$TOKEN_LETEST_DIR"

echo "--- flic-jauge (with secret, cross-etab) ---"
call_edge "flic_withsecret" "POST" "flic-jauge" \
  "{\"mac\":\"test\",\"action\":\"click\"}" "$TOKEN_LETEST_DIR" 2>/dev/null
# flic-jauge uses x-flic-secret header, not Bearer
status=$(curl -s -o /tmp/flic_resp.txt -w "%{http_code}" \
  -X POST "$SUPABASE_URL/functions/v1/flic-jauge" \
  -H "x-flic-secret: MainCourante1967!" \
  -H "Content-Type: application/json" \
  -d "{\"mac\":\"test\",\"action\":\"click\"}" 2>/dev/null)
echo "flic_withsecret | HTTP $status | $(cat /tmp/flic_resp.txt | head -c 200)"

echo ""
echo "--- ia-assistant (cross: LeTest asks about GARI context) ---"
call_edge "ia_cross" "POST" "ia-assistant" \
  "{\"message\":\"test\",\"etablissement_id\":\"$GARI_ETAB\"}" "$TOKEN_LETEST_DIR"

echo ""
echo "=== DONE ==="
