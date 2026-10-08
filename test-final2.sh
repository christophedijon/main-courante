#!/bin/bash
SUPABASE_URL="https://wliobldgrzjjchfknqju.supabase.co"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndsaW9ibGRncnpqamNoZmtucWp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NDYzODQsImV4cCI6MjA5MzAyMjM4NH0.5yT_REihgqmCQAnKSfsylcKHyvnsBxwFxy7rgGKwBEo"
PW="AuditTest2026!"
signin() { curl -s -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" -H "apikey: $ANON_KEY" -H "Content-Type: application/json" -d "{\"email\":\"$1\",\"password\":\"$PW\"}" 2>/dev/null | python3 -c "import sys,json;print(json.load(sys.stdin).get('access_token','FAIL'))" 2>/dev/null; }
T_LT=$(signin "christopheinfo21+test@gmail.com")
T_GARI=$(signin "vanessalemesnil@gmail.com")
T_SUPER=$(signin "christophelemesnil@gmail.com")
LETEST_ETAB="08863af3-a1e2-4b90-a6c4-c2863f017494"
GARI_ETAB="d870f00c-6b7f-4324-accb-d38e7ba53b5c"

list_storage() {
  local name="$1" bucket="$2" prefix="$3" token="$4"
  local status=$(curl -s -o /tmp/sr.txt -w "%{http_code}" -X POST "$SUPABASE_URL/storage/v1/object/list/$bucket" -H "Authorization: Bearer $token" -H "apikey: $ANON_KEY" -H "Content-Type: application/json" -d "{\"prefix\":\"$prefix\",\"limit\":100}" 2>/dev/null)
  local count=$(cat /tmp/sr.txt | python3 -c "import sys,json;d=json.load(sys.stdin);print(len(d) if isinstance(d,list) else 'ERR:'+str(d)[:80])" 2>/dev/null || echo "ERR")
  echo "$name | HTTP $status | items=$count"
}

upload_storage() {
  local name="$1" bucket="$2" path="$3" token="$4"
  local status=$(curl -s -o /tmp/sr.txt -w "%{http_code}" -X POST "$SUPABASE_URL/storage/v1/object/$bucket/$path" -H "Authorization: Bearer $token" -H "apikey: $ANON_KEY" -H "Content-Type: application/octet-stream" -d "test" 2>/dev/null)
  local body=$(cat /tmp/sr.txt | head -c 80)
  echo "$name | HTTP $status | $body"
}

download_file() {
  local name="$1" bucket="$2" path="$3" token="$4"
  local status=$(curl -s -o /dev/null -w "%{http_code}" "$SUPABASE_URL/storage/v1/object/$bucket/$path" -H "Authorization: Bearer $token" -H "apikey: $ANON_KEY" 2>/dev/null)
  echo "$name | HTTP $status"
}

echo "=== STORAGE LISTING (post-fix 2) ==="
echo "--- LeTest Dir listing root of each bucket ---"
list_storage "documents_root_LT" "documents" "" "$T_LT"
list_storage "media_root_LT" "media-evenements" "" "$T_LT"
list_storage "logos_root_LT" "logos" "" "$T_LT"
list_storage "docs-media_root_LT" "documents-media" "" "$T_LT"

echo ""
echo "--- LeTest Dir listing inside GARI folders ---"
list_storage "media_list_GARI_byLT" "media-evenements" "$GARI_ETAB" "$T_LT"
list_storage "media_list_other_user_byLT" "media-evenements" "2e420ba1-af63-489f-a780-a6d584396450" "$T_LT"
list_storage "docs_list_evac_byLT" "documents" "evacuation" "$T_LT"
list_storage "docs_list_GARI_byLT" "documents" "$GARI_ETAB" "$T_LT"

echo ""
echo "--- GARI Dir listing inside LeTest folders ---"
list_storage "docs_list_LT_byGARI" "documents" "$LETEST_ETAB" "$T_GARI"
list_storage "media_list_LT_byGARI" "media-evenements" "$LETEST_ETAB" "$T_GARI"

echo ""
echo "=== STORAGE UPLOAD (cross-etab, should ALL fail) ==="
upload_storage "docs_upload_GARI_byLT" "documents" "$GARI_ETAB/cross.txt" "$T_LT"
upload_storage "media_upload_GARI_byLT" "media-evenements" "$GARI_ETAB/cross.txt" "$T_LT"
upload_storage "docsmedia_upload_GARI_byLT" "documents-media" "$GARI_ETAB/cross.txt" "$T_LT"
upload_storage "docs_upload_LT_byGARI" "documents" "$LETEST_ETAB/cross.txt" "$T_GARI"
upload_storage "media_upload_LT_byGARI" "media-evenements" "$LETEST_ETAB/cross.txt" "$T_GARI"
upload_storage "docsmedia_upload_LT_byGARI" "documents-media" "$LETEST_ETAB/cross.txt" "$T_GARI"

echo ""
echo "=== STORAGE UPLOAD (own etab, should work) ==="
upload_storage "docs_upload_own" "documents" "$LETEST_ETAB/cross.txt" "$T_LT"
upload_storage "media_upload_own" "media-evenements" "$LETEST_ETAB/cross.txt" "$T_LT"
upload_storage "docsmedia_upload_own" "documents-media" "$LETEST_ETAB/cross.txt" "$T_LT"

echo ""
echo "=== STORAGE DOWNLOAD (cross-etab, should fail) ==="
download_file "docs_download_GARI_byLT" "documents" "$GARI_ETAB/cross-test.txt" "$T_LT"
download_file "media_download_GARI_byLT" "media-evenements" "$GARI_ETAB/cross-test.txt" "$T_LT"

echo ""
echo "=== STORAGE DOWNLOAD (own etab, should work) ==="
download_file "docs_download_own" "documents" "$LETEST_ETAB/cross.txt" "$T_LT"
download_file "media_download_own" "media-evenements" "$LETEST_ETAB/cross.txt" "$T_LT"
download_file "docsmedia_download_own" "documents-media" "$LETEST_ETAB/cross.txt" "$T_LT"

echo ""
echo "=== PUBLIC URL ACCESS (documents-media public bucket) ==="
# Test if public URL still works for existing flat files
curl -s -o /dev/null -w "docsmedia_old_public | HTTP %{http_code}\n" "$SUPABASE_URL/storage/v1/object/public/documents-media/1777909196316-4bemmicfd1x.pdf" 2>/dev/null
# Test if public URL works for new etab-prefixed files
curl -s -o /dev/null -w "docsmedia_new_public | HTTP %{http_code}\n" "$SUPABASE_URL/storage/v1/object/public/documents-media/$LETEST_ETAB/cross.txt" 2>/dev/null

echo ""
echo "=== EVACUATION PLAN ACCESS ==="
# LeTest should NOT be able to download GARI's evacuation plans
download_file "evac_GARI_byLT" "documents" "evacuation/1777646491595-plan_evacuation_melkior.pdf" "$T_LT"
# GARI should be able to download their own evacuation plans
download_file "evac_GARI_byGARI" "documents" "evacuation/1777646491595-plan_evacuation_melkior.pdf" "$T_GARI"

echo ""
echo "=== CLEANUP ==="
curl -s -X DELETE "$SUPABASE_URL/storage/v1/object/documents/$LETEST_ETAB/cross.txt" -H "Authorization: Bearer $T_LT" -H "apikey: $ANON_KEY" 2>/dev/null | head -c 50
echo ""
curl -s -X DELETE "$SUPABASE_URL/storage/v1/object/media-evenements/$LETEST_ETAB/cross.txt" -H "Authorization: Bearer $T_LT" -H "apikey: $ANON_KEY" 2>/dev/null | head -c 50
echo ""
curl -s -X DELETE "$SUPABASE_URL/storage/v1/object/documents-media/$LETEST_ETAB/cross.txt" -H "Authorization: Bearer $T_LT" -H "apikey: $ANON_KEY" 2>/dev/null | head -c 50
echo ""

echo ""
echo "=== DONE ==="
