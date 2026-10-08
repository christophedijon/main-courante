#!/bin/bash
SUPABASE_URL="https://wliobldgrzjjchfknqju.supabase.co"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndsaW9ibGRncnpqamNoZmtucWp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NDYzODQsImV4cCI6MjA5MzAyMjM4NH0.5yT_REihgqmCQAnKSfsylcKHyvnsBxwFxy7rgGKwBEo"
PW="AuditTest2026!"
signin() { curl -s -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" -H "apikey: $ANON_KEY" -H "Content-Type: application/json" -d "{\"email\":\"$1\",\"password\":\"$PW\"}" 2>/dev/null | python3 -c "import sys,json;print(json.load(sys.stdin).get('access_token','FAIL'))" 2>/dev/null; }
T_LT_DIR=$(signin "christopheinfo21+test@gmail.com")
T_GARI_DIR=$(signin "vanessalemesnil@gmail.com")
T_SUPER=$(signin "christophelemesnil@gmail.com")
LETEST_ETAB="08863af3-a1e2-4b90-a6c4-c2863f017494"
GARI_ETAB="d870f00c-6b7f-4324-accb-d38e7ba53b5c"

call_edge() {
  local name="$1" method="$2" path="$3" body="$4" token="$5"
  local status=$(curl -s -o /tmp/er.txt -w "%{http_code}" -X "$method" "$SUPABASE_URL/functions/v1/$path" -H "Authorization: Bearer $token" -H "apikey: $ANON_KEY" -H "Content-Type: application/json" -d "$body" 2>/dev/null)
  echo "$name | HTTP $status | $(cat /tmp/er.txt | head -c 150)"
}

list_storage() {
  local name="$1" bucket="$2" prefix="$3" token="$4"
  local status=$(curl -s -o /tmp/sr.txt -w "%{http_code}" -X POST "$SUPABASE_URL/storage/v1/object/list/$bucket" -H "Authorization: Bearer $token" -H "apikey: $ANON_KEY" -H "Content-Type: application/json" -d "{\"prefix\":\"$prefix\",\"limit\":100}" 2>/dev/null)
  local count=$(cat /tmp/sr.txt | python3 -c "import sys,json;d=json.load(sys.stdin);print(len(d) if isinstance(d,list) else 'ERR')" 2>/dev/null || echo "ERR")
  echo "$name | HTTP $status | items=$count"
}

upload_storage() {
  local name="$1" bucket="$2" path="$3" token="$4"
  local status=$(curl -s -o /tmp/sr.txt -w "%{http_code}" -X POST "$SUPABASE_URL/storage/v1/object/$bucket/$path" -H "Authorization: Bearer $token" -H "apikey: $ANON_KEY" -H "Content-Type: application/octet-stream" -d "test" 2>/dev/null)
  echo "$name | HTTP $status | $(cat /tmp/sr.txt | head -c 100)"
}

echo "=== IA-ASSISTANT (post-fix) ==="
call_edge "ia_cross_LeTest" "POST" "ia-assistant" "{\"message\":\"Quel est le nom de mon etablissement?\"}" "$T_LT_DIR"
call_edge "ia_own_GARI" "POST" "ia-assistant" "{\"message\":\"Quel est le nom de mon etablissement?\"}" "$T_GARI_DIR"

echo ""
echo "=== STORAGE LISTING (post-fix) ==="
echo "--- LeTest Dir listing GARI root ---"
list_storage "documents_root_GARI" "documents" "" "$T_LT_DIR"
list_storage "registre_root_GARI" "registre-securite" "" "$T_LT_DIR"
list_storage "media_root_GARI" "media-evenements" "" "$T_LT_DIR"
list_storage "logos_root_GARI" "logos" "" "$T_LT_DIR"
echo "--- LeTest Dir listing own root ---"
list_storage "documents_root_own" "documents" "" "$T_LT_DIR"
list_storage "registre_root_own" "registre-securite" "" "$T_LT_DIR"

echo ""
echo "=== STORAGE UPLOAD (cross-etab) ==="
upload_storage "documents_upload_GARI" "documents" "$GARI_ETAB/cross.txt" "$T_LT_DIR"
upload_storage "registre_upload_GARI" "registre-securite" "$GARI_ETAB/cross.txt" "$T_LT_DIR"
upload_storage "media_upload_GARI" "media-evenements" "$GARI_ETAB/cross.txt" "$T_LT_DIR"
upload_storage "logos_upload_GARI" "logos" "$GARI_ETAB/cross.txt" "$T_LT_DIR"

echo ""
echo "=== STORAGE UPLOAD (own etab - should work) ==="
upload_storage "documents_upload_own" "documents" "$LETEST_ETAB/cross.txt" "$T_LT_DIR"
upload_storage "media_upload_own" "media-evenements" "$LETEST_ETAB/cross.txt" "$T_LT_DIR"
upload_storage "logos_upload_own" "logos" "$LETEST_ETAB/cross.txt" "$T_LT_DIR"

echo ""
echo "=== CLEANUP ==="
# Delete the own-etab test files we just uploaded
curl -s -X DELETE "$SUPABASE_URL/storage/v1/object/documents/$LETEST_ETAB/cross.txt" -H "Authorization: Bearer $T_LT_DIR" -H "apikey: $ANON_KEY" 2>/dev/null | head -c 50
echo ""
curl -s -X DELETE "$SUPABASE_URL/storage/v1/object/media-evenements/$LETEST_ETAB/cross.txt" -H "Authorization: Bearer $T_LT_DIR" -H "apikey: $ANON_KEY" 2>/dev/null | head -c 50
echo ""
curl -s -X DELETE "$SUPABASE_URL/storage/v1/object/logos/$LETEST_ETAB/cross.txt" -H "Authorization: Bearer $T_LT_DIR" -H "apikey: $ANON_KEY" 2>/dev/null | head -c 50
echo ""

echo ""
echo "=== GARI Dir reverse cross ==="
list_storage "documents_root_byGARI" "documents" "" "$T_GARI_DIR"
upload_storage "documents_upload_LeTest" "documents" "$LETEST_ETAB/cross.txt" "$T_GARI_DIR"

echo ""
echo "=== DONE ==="
