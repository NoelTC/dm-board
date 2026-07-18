#!/bin/bash
cd "$(dirname "$0")"
echo "🎯 DM Board — iniciando..."
echo "   Abre http://localhost:8080 en tu navegador"
echo "   Pulsa Ctrl+C para cerrar"
echo ""
python3 -m http.server 8080
