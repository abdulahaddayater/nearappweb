"""Smali edits that wire ScanFix into the decoded NearTap 1.3.0 APK (apktool 2.10 output)."""
import re, sys
root = sys.argv[1]

def patch(path, old, new):
    p = f"{root}/{path}"; s = open(p).read()
    assert s.count(old) == 1, (path, s.count(old)); open(p, "w").write(s.replace(old, new))

# Pay screen: open the scanner first when this phone can't tap (no NFC / NFC off).
patch("smali/W2/Z.smali", "    :pswitch_1\n    sget-object p0, Ljava/lang/Boolean;->FALSE:Ljava/lang/Boolean;\n",
      "    :pswitch_1\n    invoke-static {}, Lcom/halopay/near/ScanFix;->openScannerFirst()Z\n\n    move-result p0\n\n"
      "    invoke-static {p0}, Ljava/lang/Boolean;->valueOf(Z)Ljava/lang/Boolean;\n\n    move-result-object p0\n")
# "Allow camera" button: open app settings once Android stops showing the dialog.
patch("smali/R2/b.smali", "    invoke-virtual {p0, v0}, Lc/h;->B(Ljava/lang/Object;)V\n",
      "    invoke-static {p0}, Lcom/halopay/near/ScanFix;->allow(Ljava/lang/Object;)V\n")
# Automatic request when the scanner opens: remember that we asked.
patch("smali/W2/I.smali", "    invoke-virtual {p0, p1}, Lc/h;->B(Ljava/lang/Object;)V\n",
      "    invoke-static {p0}, Lcom/halopay/near/ScanFix;->request(Ljava/lang/Object;)V\n")
m = "smali/com/halopay/near/MainActivity.smali"
patch(m, "    invoke-super {p0, p1}, Ly1/q;->onCreate(Landroid/os/Bundle;)V\n",
      "    invoke-super {p0, p1}, Ly1/q;->onCreate(Landroid/os/Bundle;)V\n\n    invoke-static {p0}, Lcom/halopay/near/ScanFix;->attach(Landroid/app/Activity;)V\n")
patch(m, "    invoke-super {p0}, Ly1/q;->onResume()V\n",
      "    invoke-super {p0}, Ly1/q;->onResume()V\n\n    invoke-static {p0}, Lcom/halopay/near/ScanFix;->onResume(Landroid/app/Activity;)V\n")
y = f"{root}/apktool.yml"; s = open(y).read()
open(y, "w").write(s.replace("versionCode: 9", "versionCode: 10").replace("versionName: 1.3.0-hackathon", "versionName: 1.3.1-hackathon"))
print("patched")
