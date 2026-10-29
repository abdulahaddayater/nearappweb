package com.tappay.near;

import android.nfc.NdefMessage;
import android.nfc.NdefRecord;
import android.nfc.cardemulation.HostApduService;
import android.os.Bundle;
import java.util.Arrays;

/**
 * Emulates an NFC Forum Type 4 tag holding one NDEF URI record: the current TapPay payment request
 * (https://nearappweb.vercel.app/app/#pay?...). Only the request travels over NFC; money moves on NEAR.
 */
public class PaymentRequestHceService extends HostApduService {
  private static volatile String currentUri;
  public static void setRequest(String uri) { currentUri = uri; }
  public static String getRequest() { return currentUri; }

  private static final byte[] OK = {(byte) 0x90, 0x00};
  private static final byte[] NOT_FOUND = {0x6A, (byte) 0x82};
  private static final byte[] SELECT_APP = hex("00A4040007D276000085010100");
  private static final byte[] SELECT_CC = hex("00A4000C02E103");
  private static final byte[] SELECT_NDEF = hex("00A4000C02E104");
  private static final byte[] CC = hex("000F20003B00340406E104FFFF00FF");
  private enum Sel { NONE, CC, NDEF }
  private Sel sel = Sel.NONE;
  private boolean appSelected = false;

  @Override public byte[] processCommandApdu(byte[] apdu, Bundle extras) {
    if (Arrays.equals(apdu, SELECT_APP)) { appSelected = currentUri != null; sel = Sel.NONE; return appSelected ? OK : NOT_FOUND; }
    if (!appSelected) return NOT_FOUND;
    if (Arrays.equals(apdu, SELECT_CC)) { sel = Sel.CC; return OK; }
    if (Arrays.equals(apdu, SELECT_NDEF)) { sel = Sel.NDEF; return OK; }
    if (apdu.length >= 5 && apdu[0] == 0x00 && apdu[1] == (byte) 0xB0) {
      int off = ((apdu[2] & 0xFF) << 8) | (apdu[3] & 0xFF), len = apdu[4] & 0xFF;
      byte[] file = sel == Sel.CC ? CC : sel == Sel.NDEF ? ndefFile() : null;
      if (file == null || off > file.length) return NOT_FOUND;
      byte[] chunk = Arrays.copyOfRange(file, off, Math.min(file.length, off + len));
      byte[] out = Arrays.copyOf(chunk, chunk.length + 2);
      out[chunk.length] = (byte) 0x90; out[chunk.length + 1] = 0x00;
      return out;
    }
    return NOT_FOUND;
  }

  private byte[] ndefFile() {
    String uri = currentUri; if (uri == null) return null;
    byte[] msg = new NdefMessage(NdefRecord.createUri(uri)).toByteArray();
    byte[] f = new byte[msg.length + 2];
    f[0] = (byte) (msg.length >> 8); f[1] = (byte) msg.length;
    System.arraycopy(msg, 0, f, 2, msg.length);
    return f;
  }

  @Override public void onDeactivated(int reason) { appSelected = false; sel = Sel.NONE; }

  private static byte[] hex(String s) {
    byte[] b = new byte[s.length() / 2];
    for (int i = 0; i < b.length; i++) b[i] = (byte) Integer.parseInt(s.substring(2 * i, 2 * i + 2), 16);
    return b;
  }
}
