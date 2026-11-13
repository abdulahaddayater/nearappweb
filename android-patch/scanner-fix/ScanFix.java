package com.halopay.near;

import android.os.Handler;
import android.os.Looper;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.nfc.NfcAdapter;
import android.provider.Settings;
import java.lang.ref.WeakReference;

/**
 * NearTap 1.3.1 scanner fixes (patched into the 1.3.0 build).
 *  1. Pay opens the QR scanner straight away when this phone can't tap (no NFC / NFC off).
 *  2. "Allow camera" works after the camera was denied: once Android stops showing the
 *     permission dialog, the button opens NearTap's system settings instead of doing nothing.
 *  3. Coming back from settings with the camera allowed reopens the screen so the scanner starts.
 *  4. The scanner never covers a payment that is already in progress (Send -> Review, confirm, Paid).
 *  5. NearTap branding on the wire: new QRs/stickers use neartap:, NFC taps send NEARTAP1;
 *     old halopay: links and HALO1 taps are still accepted.
 */
public final class ScanFix {
    private static final String CAMERA = "android.permission.CAMERA";
    private static WeakReference<Activity> activity = new WeakReference<>(null);
    private static boolean waitingForSettings;

    private ScanFix() {}

    public static void attach(Activity a) { activity = new WeakReference<>(a); }

    public static void onResume(Activity a) {
        attach(a);
        if (waitingForSettings) {
            waitingForSettings = false;
            if (a.checkSelfPermission(CAMERA) == PackageManager.PERMISSION_GRANTED) a.recreate();
        }
    }

    /** Initial value of the Pay screen's "show scanner" state. */
    public static boolean openScannerFirst() {
        Activity a = activity.get();
        if (a == null) return false;
        try {
            NfcAdapter nfc = NfcAdapter.getDefaultAdapter(a);
            return nfc == null || !nfc.isEnabled();
        } catch (Throwable t) {
            return false;
        }
    }

    /** Automatic request when the scanner opens. */
    public static void request(Object launcher) {
        Activity a = activity.get();
        if (a != null) prefs(a).edit().putBoolean("camera_asked", true).apply();
        launch(launcher);
    }

    /** The "Allow camera" button. */
    public static void allow(Object launcher) {
        Activity a = activity.get();
        if (a != null && prefs(a).getBoolean("camera_asked", false)
                && !a.shouldShowRequestPermissionRationale(CAMERA)
                && a.checkSelfPermission(CAMERA) != PackageManager.PERMISSION_GRANTED) {
            // Android won't show the dialog again: send the user to the app's settings.
            try {
                waitingForSettings = true;
                a.startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                        Uri.fromParts("package", a.getPackageName(), null)));
                return;
            } catch (Throwable t) {
                waitingForSettings = false;
            }
        }
        request(launcher);
    }

    /**
     * Scanner shows only while the user wants it AND no payment is in progress (pay state == idle).
     * When a payment starts (Send -> Review, or a scanned QR), the "show scanner" flag is switched off,
     * so after Done the Pay screen shows its buttons; entering Pay again reopens the scanner.
     */
    public static boolean showScanner(final Object flagState, Object payState) {
        Object v;
        try { v = flagState.getClass().getMethod("getValue").invoke(flagState); }
        catch (Throwable t) { return false; }
        boolean want = v instanceof Boolean && (Boolean) v;
        boolean idle = payState == null || "R2.I".equals(payState.getClass().getName());
        if (want && !idle) {
            new Handler(Looper.getMainLooper()).post(new Runnable() { public void run() {
                try { flagState.getClass().getMethod("setValue", Object.class).invoke(flagState, Boolean.FALSE); }
                catch (Throwable ignored) { }
            }});
        }
        return want && idle;
    }

    /** neartap:pay?... -> the internal halopay:pay?... form the parser understands. */
    public static String normalizeUri(String uri) {
        if (uri == null) return null;
        String t = uri.trim();
        if (t.regionMatches(true, 0, "neartap:", 0, 8)) return "halopay:" + t.substring(8);
        return t;
    }

    public static boolean isPayUri(String uri) {
        if (uri == null) return false;
        String t = uri.trim();
        return t.regionMatches(true, 0, "neartap", 0, 7) || t.regionMatches(true, 0, "halopay", 0, 7);
    }

    public static boolean isTapPayload(Object first) {
        return "NEARTAP1".equals(first) || "HALO1".equals(first);
    }

    private static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences("neartap_scanfix", Context.MODE_PRIVATE);
    }

    private static void launch(Object launcher) {
        try {
            launcher.getClass().getMethod("B", Object.class).invoke(launcher, CAMERA);
        } catch (Throwable t) {
            Activity a = activity.get();
            if (a != null) a.requestPermissions(new String[]{CAMERA}, 4711);
        }
    }
}
