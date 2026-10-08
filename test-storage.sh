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
  local name="$1" bucket="$2" path="$3" token="$4"
  local status=$(curl -s -o /tmp/sr.txt -w "%{http_code}" "$SUPABASE_URL/storage/v1/object/list/$bucket" -H "Authorization: Bearer $token" -H "apikey: $ANON_KEY" -d "{\"prefix\":\"$path\",\"limit\":10}" 2>/dev/null)
  local body=$(cat /tmp/sr.txt | head -c 300)
  echo "$name | HTTP $status | $body"
}

upload_storage() {
  local name="$1" bucket="$2" path="$3" token="$4"
  local status=$(curl -s -o /tmp/sr.txt -w "%{http_code}" -X POST "$SUPABASE_URL/storage/v1/object/$bucket/$path" -H "Authorization: Bearer $token" -H "apikey: $ANON_KEY" -H "Content-Type: text/plain" -d "test" 2>/dev/null)
  echo "$name | HTTP $status | $(cat /tmp/sr.txt | head -c 200)"
}

delete_storage() {
  local name="$1" bucket="$2" path="$3" token="$4"
  local status=$(curl -s -o /tmp/sr.txt -w "%{http_code}" -X DELETE "$SUPABASE_URL/storage/v1/object/$bucket/$path" -H "Authorization: Bearer $token" -H "apikey: $ANON_KEY" 2>/dev/null)
  echo "$name | HTTP $status | $(cat /tmp/sr.txt | head -c 200)"
}

echo "=== STORAGE TESTS (LeTest Dir targeting GARI folders) ==="
echo ""
echo "--- LOGOS bucket ---"
list_storage "logos_list_GARI" "logos" "$GARI_ETAB/" "$TOKEN_LETEST_DIR"
list_storage "logos_list_LeTest" "logos" "$LETEST_ETAB/" "$TOKEN_LETEST_DIR"
upload_storage "logos_upload_GARI" "logos" "$GARI_ETAB/cross-test.txt" "$TOKEN_LETEST_DIR"
delete_storage "logos_delete_GARI" "logos" "$GARI_ETAB/cross-test.txt" "$TOKEN_LETEST_DIR"

echo ""
echo "--- DOCUMENTS bucket ---"
list_storage "docs_list_GARI" "documents" "$GARI_ETAB/" "$TOKEN_LETEST_DIR"
list_storage "docs_list_LeTest" "documents" "$LETEST_ETAB/" "$TOKEN_LETEST_DIR"
upload_storage "docs_upload_GARI" "documents" "$GARI_ETAB/cross-test.txt" "$TOKEN_LETEST_DIR"

echo ""
echo "--- DOCUMENTS-MEDIA bucket ---"
list_storage "docsmedia_list_GARI" "documents-media" "$GARI_ETAB/" "$TOKEN_LETEST_DIR"
list_storage "docsmedia_list_LeTest" "documents-media" "$LETEST_ETAB/" "$TOKEN_LETEST_DIR"
upload_storage "docsmedia_upload_GARI" "documents-media" "$GARI_ETAB/cross-test.txt" "$TOKEN_LETEST_DIR"

echo ""
echo "--- MEDIA-EVENEMENTS bucket ---"
list_storage "media_list_GARI" "media-evenements" "$GARI_ETAB/" "$TOKEN_LETEST_DIR"
list_storage "media_list_LeTest" "media-evenements" "$LETEST_ETAB/" "$TOKEN_LETEST_DIR"
upload_storage "media_upload_GARI" "media-evenements" "$GARI_ETAB/cross-test.txt" "$TOKEN_LETEST_DIR"

echo ""
echo "--- CARTE-SEJOUR bucket ---"
list_storage "carte_list_GARI_agent" "carte-sejour" "$GARI_ETAB/" "$TOKEN_LETEST_DIR"
list_storage "carte_list_own" "carte-sejour" "$(echo $TOKEN_LETEST_DIR | cut -d. -f2 | base64 -d 2>/dev/null | python3 -c 'import sys,json;print(json.load(sys.stdin).get(\"sub\",\"\"))' 2>/dev/null)/" "$TOKEN_LETEST_DIR"

echo ""
echo "--- REGISTRE-SECURITE bucket ---"
list_storage "registre_list_GARI" "registre-securite" "$GARI_ETAB/" "$TOKEN_LETEST_DIR"
list_storage "registre_list_LeTest" "registre-securite" "$LETEST_ETAB/" "$TOKEN_LETEST_DIR"
upload_storage "registre_upload_GARI" "registre-securite" "$GARI_ETAB/cross-test.txt" "$TOKEN_LETEST_DIR"
delete_storage "registre_delete_GARI" "registre-securite" "$GARI_ETAB/cross-test.txt" "$TOKEN_LETEST_DIR"

echo ""
echo "--- EXPORTS bucket ---"
list_storage "exports_list_GARI" "exports" "$GARI_ETAB/" "$TOKEN_LETEST_DIR"
list_storage "exports_list_LeTest" "exports" "$LETEST_ETAB/" "$TOKEN_LETEST_DIR"
upload_storage "exports_upload_GARI" "exports" "$GARI_ETAB/cross-test.txt" "$TOKEN_LETEST_DIR"

echo ""
echo "=== STORAGE TESTS (GARI Dir targeting LeTest folders) ==="
echo "--- REGISTRE-SECURITE reverse ---"
list_storage "registre_list_LeTest_by_GARI" "registre-securite" "$LETEST_ETAB/" "$TOKEN_GARI_DIR"
echo "--- EXPORTS reverse ---"
list_storage "exports_list_LeTest_by_GARI" "exports" "$LETEST_ETAB/" "$TOKEN_GARI_DIR"
echo "--- DOCUMENTS reverse ---"
list_storage "docs_list_LeTest_by_GARI" "documents" "$LETEST_ETAB/" "$TOKEN_GARI_DIR"

echo ""
echo "=== DONE ==="
