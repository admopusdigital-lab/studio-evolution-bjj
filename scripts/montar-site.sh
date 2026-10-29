#!/usr/bin/env bash
# Monta a pasta _site/ para publicar (Cloudflare Pages e GitHub Pages usam o mesmo script).
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf _site
mkdir -p _site
cp -r site/. _site/
# o index.html começa sem o esqueleto da página (o publicador do Artifact acrescenta); aqui ele vem antes
{ printf '<!doctype html>\n<html lang="pt-BR">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'; cat site/index.html; } > _site/index.html
# domínio oficial: o Google vê as páginas públicas; as áreas de login ficam de fora
DOMINIO="https://evolutionbjj.com.br"
printf 'User-agent: *\nAllow: /\nDisallow: /app\nDisallow: /entrar\nDisallow: /acessos\nDisallow: /nova-senha\nDisallow: /area-do-professor\nDisallow: /area-do-aluno\n\nSitemap: %s/sitemap.xml\n' "$DOMINIO" > _site/robots.txt
{
  echo '<?xml version="1.0" encoding="UTF-8"?>'
  echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
  for pg in "" aulas agendamento contato perguntas; do echo "  <url><loc>$DOMINIO/$pg</loc></url>"; done
  echo '</urlset>'
} > _site/sitemap.xml
echo "Site montado em _site/ ($(du -sh _site | cut -f1))"
