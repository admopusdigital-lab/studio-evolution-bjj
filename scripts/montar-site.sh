#!/usr/bin/env bash
# Monta a pasta _site/ para publicar (Cloudflare Pages e GitHub Pages usam o mesmo script).
# PUBLICO=1 deixa o Google indexar; sem ele, o robots.txt fecha o endereço de teste.
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf _site
mkdir -p _site
cp -r site/. _site/
# o index.html começa sem o esqueleto da página (o publicador do Artifact acrescenta); aqui ele vem antes
{ printf '<!doctype html>\n<html lang="pt-BR">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'; cat site/index.html; } > _site/index.html
if [ "${PUBLICO:-}" = "1" ]; then
  printf 'User-agent: *\nAllow: /\n' > _site/robots.txt
else
  # endereço de teste: fora do Google, para não competir com o site atual do Studio
  printf 'User-agent: *\nDisallow: /\n' > _site/robots.txt
fi
echo "Site montado em _site/ ($(du -sh _site | cut -f1))"
