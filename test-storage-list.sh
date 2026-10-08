#!/bin/bash
SUPABASE_URL="https://wliobldgrzjjchfknqju.supabase.co"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndsaW9ibGRncnpqamNoZmtucWp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NDYzODQsImV4cCI6MjA5MzAyMjM4NH0.5yT_REihgqmCQAnKSfsylcKHyvnsBxwFxy7rgGKwBEo"
PW="AuditTest2026!"
signin() { curl -s -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" -H "apikey: $ANON_KEY" -H "Content-Type: application/json" -d "{\"email\":\"$1\",\"password\":\"$PW\"}" 2>/dev/null | python3 -c "import sys,json;print(json.load(sys.stdin).get('access_token','FAIL'))" 2>/dev/null; }
TOKEN_LETEST_DIR=$(signin "christopheinfo21+test@gmail.com")
TOKEN_GARI_DIR=$(signin "vanessalemesnil@gmail.com")
LETEST_ETAB="08863af3-a1e2-4b90-a6c4-c2863f017494"
GARI_ETAB="d870f00c-6b7f-4324-accb-d38e7ba53b5c"

list_storage() {
  local name="$1" bucket="$2" prefix="$3" token="$4"
  local status=$(curl -s -o /tmp/sr.txt -w "%{http_code}" -X POST "$SUPABASE_URL/storage/v1/object/list/$bucket" \
    -H "Authorization: Bearer $token" -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
    -d "{\"prefix\":\"$prefix\",\"limit\":100,\"offset\":0}" 2>/dev/null)
  local body=$(cat /tmp/sr.txt | head -c 400)
  local count=$(echo "$body" | python3 -c "import sys,json;d=json.load(sys.stdin);print(len(d) if isinstance(d,list) else 'ERR')" 2>/dev/null || echo "ERR")
  echo "$name | HTTP $status | items=$count | $body"
}

echo "=== STORAGE LISTING TESTS ==="
echo ""
echo "--- LeTest Dir listing GARI folders (CROSS-ETAB) ---"
list_storage "logos_list_GARI" "logos" "$GARI_ETAB/" "$TOKEN_LETEST_DIR"
list_storage "documents_list_GARI" "documents" "$GARI_ETAB/" "$TOKEN_LETEST_DIR"
list_storage "docsmedia_list_GARI" "documents-media" "$GARI_ETAB/" "$TOKEN_LETEST_DIR"
list_storage "media_list_GARI" "media-evenements" "$GARI_ETAB/" "$TOKEN_LETEST_DIR"
list_storage "registre_list_GARI" "registre-securite" "$GARI_ETAB/" "$TOKEN_LETEST_DIR"
list_storage "exports_list_GARI" "exports" "$GARI_ETAB/" "$TOKEN_LETEST_DIR"

echo ""
echo "--- LeTest Dir listing own folders (LEGITIMATE) ---"
list_storage "logos_list_own" "logos" "$LETEST_ETAB/" "$TOKEN_LETEST_DIR"
list_storage "documents_list_own" "documents" "$LETEST_ETAB/" "$TOKEN_LETEST_DIR"
list_storage "registre_list_own" "registre-securite" "$LETEST_ETAB/" "$TOKEN_LETEST_DIR"
list_storage "exports_list_own" "exports" "$LETEST_ETAB/" "$TOKEN_LETEST_DIR"

echo ""
echo "--- GARI Dir listing LeTest folders (REVERSE CROSS) ---"
list_storage "registre_list_LeTest_byGARI" "registre-securite" "$LETEST_ETAB/" "$TOKEN_GARI_DIR"
list_storage "exports_list_LeTest_byGARI" "exports" "$LETEST_ETAB/" "$TOKEN_GARI_DIR"
list_storage "documents_list_LeTest_byGARI" "documents" "$LETEST_ETAB/" "$TOKEN_GARI_DIR"
list_storage "logos_list_LeTest_byGARI" "logos" "$LETEST_ETAB/" "$TOKEN_GARI_DIR"
list_storage "media_list_LeTest_byGARI" "media-evenements" "$LETEST_ETAB/" "$TOKEN_GARI_DIR"

echo ""
echo "--- ROOT listing (no prefix, see what's visible) ---"
list_storage "logos_root" "logos" "" "$TOKEN_LETEST_DIR"
list_storage "documents_root" "documents" "" "$TOKEN_LETEST_DIR"
list_storage "registre_root" "registre-securite" "" "$TOKEN_LETEST_DIR"
list_storage "exports_root" "exports" "" "$TOKEN_LETEST_DIR"
list_storage "media_root" "media-evenements" "" "$TOKEN_LETEST_DIR"
list_storage "docsmedia_root" "documents-media" "" "$TOKEN_LETEST_DIR"

echo ""
echo "=== DONE ==="
