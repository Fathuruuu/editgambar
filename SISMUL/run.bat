@echo off
title Editor Citra Berbasis Web - Professional Image Studio
echo ====================================================================
echo   EDITOR CITRA BERBASIS WEB - DIGITAL IMAGE PROCESSING STUDIO
echo ====================================================================
echo.
echo   Domain aktif: http://www.editorcitra.com/
echo   Alternatif  : http://localhost:80/
echo.
echo   Membuka peramban (browser) otomatis...
start http://www.editorcitra.com/
python -m http.server 80
pause
