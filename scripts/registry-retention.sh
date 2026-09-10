#!/usr/bin/env bash
# Preview or apply a fixed retention policy for Bill-LM registry repositories.
# DELETE is impossible unless this invocation supplies mode=apply and DELETE.
set -Eeuo pipefail

readonly REGISTRY_URL='http://127.0.0.1:5000'
readonly KEEP_COUNT=3
readonly ACCEPT_HEADER='application/vnd.oci.image.index.v1+json, application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.docker.distribution.manifest.v2+json'
readonly REPOSITORIES=(bill-lm-server bill-lm-worker)

MODE="${RETENTION_MODE:-preview}"
CONFIRMATION="${RETENTION_CONFIRM:-}"
TMP_DIR=''

usage() {
  cat <<'EOF'
Usage: scripts/registry-retention.sh [--mode preview|apply] [--confirm DELETE]

The registry URL and repositories are fixed in this script. Preview is the
default. Apply deletes only candidates selected during this same invocation.
EOF
}

die() { printf 'registry retention: %s\n' "$*" >&2; exit 1; }
cleanup() { [[ -z "$TMP_DIR" ]] || rm -rf -- "$TMP_DIR"; }
trap cleanup EXIT

while (($# > 0)); do
  case "$1" in
    --mode) (($# >= 2)) || die '--mode requires preview or apply'; MODE="$2"; shift 2 ;;
    --confirm) (($# >= 2)) || die '--confirm requires DELETE'; CONFIRMATION="$2"; shift 2 ;;
    --help|-h) usage; exit 0 ;;
    *) die "unknown argument: $1" ;;
  esac
done

[[ "$MODE" == preview || "$MODE" == apply ]] || die 'mode must be preview or apply'
[[ "$MODE" != apply || "$CONFIRMATION" == DELETE ]] || die 'apply requires the exact confirmation: DELETE'
for command in curl jq awk sort; do command -v "$command" >/dev/null 2>&1 || die "required command is unavailable: $command"; done

TMP_DIR="$(mktemp -d)"
SUMMARY_FILE="${GITHUB_STEP_SUMMARY:-$TMP_DIR/summary.md}"

api_curl() { curl --fail --silent --show-error --connect-timeout 5 --max-time 30 "$@"; }

family_for_tag() {
  if [[ "$1" == buildcache ]]; then printf 'cache\n'
  elif [[ "$1" =~ ^[0-9]+\.[0-9]+\.[0-9]+-dev$ ]]; then printf 'development\n'
  elif [[ "$1" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then printf 'production\n'
  else printf 'unknown\n'; fi
}

manifest_metadata() {
  local repository="$1" tag="$2" headers="$TMP_DIR/headers.$RANDOM" digest size
  api_curl --head --dump-header "$headers" --output /dev/null --header "Accept: $ACCEPT_HEADER" "$REGISTRY_URL/v2/$repository/manifests/$tag"
  digest="$(awk 'BEGIN { IGNORECASE = 1 } /^Docker-Content-Digest:/ { gsub("\\r", ""); print $2; exit }' "$headers")"
  size="$(awk 'BEGIN { IGNORECASE = 1 } /^Content-Length:/ { gsub("\\r", ""); print $2; exit }' "$headers")"
  printf '%s\t%s\n' "$digest" "${size:-unavailable}"
}

manifest_created_at() {
  local repository="$1" tag="$2" manifest config_digest created
  manifest="$(api_curl --header "Accept: $ACCEPT_HEADER" "$REGISTRY_URL/v2/$repository/manifests/$tag")" || return 1
  config_digest="$(jq -er '.config.digest // empty' <<<"$manifest")" || return 1
  created="$(api_curl "$REGISTRY_URL/v2/$repository/blobs/$config_digest" | jq -er '.created // empty')" || return 1
  [[ "$created" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T ]] || return 1
  printf '%s\n' "$created"
}

process_repository() {
  local repository="$1" records="$TMP_DIR/$repository.records.tsv" candidates="$TMP_DIR/$repository.candidates.tsv"
  local blocked="$TMP_DIR/$repository.blocked.tsv" decisions="$TMP_DIR/$repository.decisions.tsv" delete_digests="$TMP_DIR/$repository.delete-digests.txt"
  local tags_json tag family digest size created note metadata all_tags candidate_tags decision reason candidate_count
  : > "$records"; : > "$candidates"; : > "$blocked"; : > "$decisions"; : > "$delete_digests"

  tags_json="$(api_curl "$REGISTRY_URL/v2/$repository/tags/list?n=1000")" || die "could not list registry tags for $repository"
  mapfile -t tags < <(jq -er '.tags // [] | .[]' <<<"$tags_json")
  if ((${#tags[@]} == 0)); then
    printf 'Registry repository %s has no tags; nothing to retain.\n' "$repository"
    return
  fi
  ((${#tags[@]} < 1000)) || die "$repository reached the 1000-tag safety limit; pagination is required before retention can continue"

  for tag in "${tags[@]}"; do
    family="$(family_for_tag "$tag")"; digest=''; created=''; size='unavailable'; note='protected'
    if metadata="$(manifest_metadata "$repository" "$tag" 2>/dev/null)"; then
      IFS=$'\t' read -r digest size <<<"$metadata"
      [[ "$digest" =~ ^sha256:[0-9a-f]{64}$ ]] || digest=''
    fi
    if [[ -z "$digest" ]]; then note='retain: manifest digest unavailable'
    elif [[ "$family" == production || "$family" == development ]]; then
      if ! created="$(manifest_created_at "$repository" "$tag" 2>/dev/null)"; then created=''; note='retain: creation time unavailable'; fi
    elif [[ "$family" == cache ]]; then note='retain: build cache'
    else note='retain: unrecognized tag family'; fi
    printf '%s\t%s\t%s\t%s\t%s\t%s\n' "$tag" "$family" "$created" "$digest" "$size" "$note" >> "$records"
  done

  for family in production development; do
    awk -F '\t' -v family="$family" '$2 == family && $3 != "" && $4 != "" { print $3 "\t" $1 "\t" $4 }' "$records" |
      LC_ALL=C sort -t $'\t' -k1,1r -k2,2Vr |
      awk -F '\t' -v keep="$KEEP_COUNT" 'NR > keep { print }' >> "$candidates"
  done

  while IFS=$'\t' read -r _created tag digest; do
    [[ -n "$digest" ]] || continue
    all_tags="$(awk -F '\t' -v digest="$digest" '$4 == digest { print $1 }' "$records")"
    candidate_tags="$(awk -F '\t' -v digest="$digest" '$3 == digest { print $2 }' "$candidates")"
    if [[ "$(wc -l <<<"$all_tags")" -ne "$(wc -l <<<"$candidate_tags")" ]]; then
      while IFS= read -r tag; do [[ -z "$tag" ]] || printf '%s\tretain: digest also backs a protected tag\n' "$tag" >> "$blocked"; done <<<"$candidate_tags"
    else
      printf '%s\n' "$digest" >> "$delete_digests"
    fi
  done < <(awk -F '\t' '!seen[$3]++ && $3 != "" { print }' "$candidates")

  while IFS=$'\t' read -r _created tag _digest; do
    if ! awk -F '\t' -v tag="$tag" '$1 == tag { found = 1 } END { exit !found }' "$blocked"; then
      printf '%s\tdelete\tolder than the newest %s in its family\n' "$tag" "$KEEP_COUNT" >> "$decisions"
    fi
  done < "$candidates"
  while IFS=$'\t' read -r tag reason; do printf '%s\tretain\t%s\n' "$tag" "$reason" >> "$decisions"; done < "$blocked"

  {
    echo "### \`$repository\`"; echo
    echo '| Tag | Family | Created | Manifest bytes | Digest | Decision |'; echo '| --- | --- | --- | ---: | --- | --- |'
    while IFS=$'\t' read -r tag family created digest size note; do
      decision="$(awk -F '\t' -v tag="$tag" '$1 == tag { value = $2 "\t" $3 } END { print value }' "$decisions")"
      if [[ -n "$decision" ]]; then IFS=$'\t' read -r _decision reason <<<"$decision"; else _decision=retain; reason="$note"; fi
      [[ -n "$created" ]] || created=unavailable; [[ -n "$digest" ]] || digest=unavailable
      printf '| `%s` | %s | `%s` | %s | `%s` | %s: %s |\n' "$tag" "$family" "$created" "$size" "$digest" "$_decision" "$reason"
    done < <(LC_ALL=C sort -t $'\t' -k2,2 -k1,1V "$records")
    candidate_count="$(awk -F '\t' '$2 == "delete" { count++ } END { print count + 0 }' "$decisions")"
    echo; echo "- Deletion candidates: $candidate_count tag(s), $(sort -u "$delete_digests" | awk 'NF { count++ } END { print count + 0 }') manifest digest(es)."
  } >> "$SUMMARY_FILE"

  [[ "$MODE" == preview ]] && return
  while IFS= read -r digest; do
    [[ -z "$digest" ]] || { api_curl --request DELETE "$REGISTRY_URL/v2/$repository/manifests/$digest" >/dev/null; printf 'Deleted %s manifest digest %s\n' "$repository" "$digest"; }
  done < <(sort -u "$delete_digests")
  while IFS=$'\t' read -r tag _family _created _digest _size _note; do
    decision="$(awk -F '\t' -v tag="$tag" '$1 == tag { print $2; exit }' "$decisions")"
    [[ "$decision" == delete ]] || manifest_metadata "$repository" "$tag" >/dev/null
  done < "$records"
}

{
  echo '## Bill-LM registry retention'; echo
  echo "- Mode: \`$MODE\`"; echo '- Policy: retain the newest three production tags, three development tags, and `buildcache` for each fixed repository.'
  [[ "$MODE" != preview ]] || echo '- Preview only: no DELETE request is made.'
  echo
} >> "$SUMMARY_FILE"

for repository in "${REPOSITORIES[@]}"; do process_repository "$repository"; done
[[ "$MODE" == preview ]] && { printf 'Preview complete. No registry manifests were deleted.\n'; exit 0; }
printf 'Apply complete. Retained tags resolve; registry garbage collection remains an NAS operation.\n'
