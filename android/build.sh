#!/usr/bin/env bash
# Builds downloads/tappay.apk without Gradle (aapt2 + javac + d8 + apksigner).
# Needs JDK 17 and Android SDK (platforms;android-34, build-tools;34.0.0). ANDROID_HOME defaults to ~/android/sdk.
set -euo pipefail
cd "$(dirname "$0")"
SDK=${ANDROID_HOME:-$HOME/android/sdk}; BT=$SDK/build-tools/34.0.0; JAR=$SDK/platforms/android-34/android.jar
KS=${TAPPAY_KEYSTORE:-$HOME/.tappay/tappay-debug.jks}
rm -rf build && mkdir -p build/res build/classes build/gen build/dex
"$BT/aapt2" compile --dir res -o build/res/res.zip
"$BT/aapt2" link -I "$JAR" --manifest AndroidManifest.xml -o build/base.apk --java build/gen build/res/res.zip
javac -source 17 -target 17 -classpath "$JAR" -d build/classes $(find src build/gen -name '*.java')
"$BT/d8" --lib "$JAR" --min-api 29 --output build/dex $(find build/classes -name '*.class')
cp build/base.apk build/unsigned.apk && python3 -c "import zipfile;zipfile.ZipFile('build/unsigned.apk','a').write('build/dex/classes.dex','classes.dex')"
"$BT/zipalign" -f 4 build/unsigned.apk build/aligned.apk
if [ ! -f "$KS" ]; then mkdir -p "$(dirname "$KS")"; keytool -genkeypair -keystore "$KS" -storepass android -keypass android -alias tappay -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=TapPay Debug"; fi
"$BT/apksigner" sign --ks "$KS" --ks-pass pass:android --key-pass pass:android --v4-signing-enabled false --out ../downloads/tappay.apk build/aligned.apk
echo "SHA-256 fingerprint (for .well-known/assetlinks.json):"
keytool -list -v -keystore "$KS" -storepass android -alias tappay | grep 'SHA256:'
