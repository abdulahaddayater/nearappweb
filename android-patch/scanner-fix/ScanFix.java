package com.halopay.near;

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
