#!/bin/bash
# Cria uma capa simples
convert -size 1600x2400 xc:'#1a1a2e' \
  -fill white -pointsize 120 -font Arial-Bold \
  -gravity center -annotate +0-200 "TEST" \
  -pointsize 80 -annotate +0+100 "BOOK" \
  assets/images/cover.jpg
