#!/usr/bin/env bash
# Rebuilds NearTap 1.3.1 from the 1.3.0 APK with the scanner fix.
# Needs JDK 17, Android SDK build-tools 34 + platform 34, apktool 2.10 jar.
# Usage: android-patch/scanner-fix/build.sh <neartap-1.3.0.apk> <out.apk>
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd); IN=$(realpath "$1"); OUT=$(realpath -m "$2")
SDK=${ANDROID_HOME:-$HOME/android/sdk}; BT=$SDK/build-tools/34.0.0; JAR=$SDK/platforms/android-34/android.jar
APKTOOL=${APKTOOL_JAR:-$HOME/tools/apktool.jar}; KS=${NEARTAP_KEYSTORE:-$HOME/.neartap/neartap-debug.jks}
W=$(mktemp -d); trap 'rm -rf "$W"' EXIT
java -jar "$APKTOOL" d -f -o "$W/src" "$IN" >/dev/null
python3 "$HERE/apply.py" "$W/src"
mkdir -p "$W/cls" "$W/dex"
javac -source 17 -target 17 -classpath "$JAR" -d "$W/cls" "$HERE/ScanFix.java"
"$BT/d8" --lib "$JAR" --min-api 29 --output "$W/dex" "$W"/cls/com/halopay/near/*.class
java -jar "$APKTOOL" b "$W/src" -o "$W/unsigned.apk" >/dev/null
python3 -c "import zipfile,sys;z=zipfile.ZipFile(sys.argv[1],'a');z.write(sys.argv[2],'classes2.dex',compress_type=zipfile.ZIP_STORED);z.close()" "$W/unsigned.apk" "$W/dex/classes.dex"
"$BT/zipalign" -f -p 4 "$W/unsigned.apk" "$W/aligned.apk"
if [ ! -f "$KS" ]; then mkdir -p "$(dirname "$KS")"; keytool -genkeypair -keystore "$KS" -storepass android -keypass android -alias neartap -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=NearTap Debug"; fi
"$BT/apksigner" sign --ks "$KS" --ks-pass pass:android --key-pass pass:android --out "$OUT" "$W/aligned.apk"
"$BT/apksigner" verify --print-certs "$OUT" | grep SHA-256
