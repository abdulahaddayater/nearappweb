package com.tappay.near;

import android.app.Activity;
import android.app.PendingIntent;
import android.content.Intent;
import android.net.Uri;
import android.nfc.NdefMessage;
import android.nfc.NdefRecord;
import android.nfc.NfcAdapter;
import android.os.Bundle;
import android.os.Parcelable;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/** TapPay for Android: hosts the TapPay web app, emulates the receiver's request over NFC (HCE), and opens the sender flow when a request is read. */
public class MainActivity extends Activity {
  static final String ORIGIN = "https://nearappweb.vercel.app";
  static final String APP_URL = ORIGIN + "/app/";
  private WebView web;
  private NfcAdapter nfc;

  @Override protected void onCreate(Bundle b) {
    super.onCreate(b);
    web = new WebView(this);
    WebSettings s = web.getSettings();
    s.setJavaScriptEnabled(true); s.setDomStorageEnabled(true);
    s.setUserAgentString(s.getUserAgentString() + " TapPayAndroid/0.2");
    web.addJavascriptInterface(new Bridge(), "TapPayAndroid");
    web.setWebViewClient(new WebViewClient() {
      @Override public boolean shouldOverrideUrlLoading(WebView v, String url) {
        if (url.startsWith(ORIGIN)) return false;
        startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); // NEAR Auth / explorer open outside
        return true;
      }
    });
    web.setWebChromeClient(new WebChromeClient() {
      @Override public void onPermissionRequest(PermissionRequest r) { r.grant(r.getResources()); }
    });
    setContentView(web);
    nfc = NfcAdapter.getDefaultAdapter(this);
    String link = linkFrom(getIntent());
    web.loadUrl(link != null ? link : APP_URL);
  }

  @Override protected void onNewIntent(Intent i) {
    super.onNewIntent(i);
    String link = linkFrom(i);
    if (link != null) web.loadUrl(link);
  }

  @Override protected void onResume() {
    super.onResume();
    if (nfc == null) return;
    PendingIntent pi = PendingIntent.getActivity(this, 0, new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP), PendingIntent.FLAG_MUTABLE);
    nfc.enableForegroundDispatch(this, pi, null, null);
  }

  @Override protected void onPause() { super.onPause(); if (nfc != null) nfc.disableForegroundDispatch(this); }

  /** Payment-request link from an NFC tap (NDEF) or a VIEW intent (QR / App Link). */
  static String linkFrom(Intent i) {
    if (i == null) return null;
    Parcelable[] raw = i.getParcelableArrayExtra(NfcAdapter.EXTRA_NDEF_MESSAGES);
    if (raw != null) for (Parcelable p : raw) for (NdefRecord r : ((NdefMessage) p).getRecords()) {
      Uri u = r.toUri();
      if (u != null && u.toString().startsWith(APP_URL)) return u.toString();
    }
    Uri d = i.getData();
    return d != null && d.toString().startsWith(APP_URL) ? d.toString() : null;
  }

  @Override public void onBackPressed() { if (web.canGoBack()) web.goBack(); else super.onBackPressed(); }

  /** Called from app.js: the receiver's current request becomes the NFC payload. */
  class Bridge {
    @JavascriptInterface public void setRequest(String uri) { PaymentRequestHceService.setRequest(uri != null && uri.startsWith(APP_URL) ? uri : null); }
    @JavascriptInterface public void clearRequest() { PaymentRequestHceService.setRequest(null); }
    @JavascriptInterface public boolean hasNfc() { return nfc != null && nfc.isEnabled(); }
  }
}
