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

# ---------------- 1.3.2 ----------------
F = "Lcom/halopay/near/ScanFix;"
H0 = "smali/W2/H0.smali"
# Pay screen: plain remember (not rememberSaveable) so the scanner reopens every time Pay is entered
# on phones without NFC.
patch(H0, """    const/16 v6, 0xc00

    move-object/from16 v5, p2

    invoke-static/range {v2 .. v7}, LJ3/d;->T([Ljava/lang/Object;LF/w;Lj3/a;LO/q;II)Ljava/lang/Object;

    move-result-object v2

    move-object v7, v2

    check-cast v7, LO/d0;

    const v2, -0x1ee994ce
""", """    const/16 v6, 0xc00

    move-object/from16 v5, p2

    const v3, 0x4e7a1001

    invoke-virtual {v12, v3}, LO/q;->Z(I)V

    invoke-virtual {v12}, LO/q;->P()Ljava/lang/Object;

    move-result-object v2

    if-ne v2, v15, :nt_remembered

    invoke-interface {v4}, Lj3/a;->invoke()Ljava/lang/Object;

    move-result-object v2

    invoke-virtual {v12, v2}, LO/q;->j0(Ljava/lang/Object;)V

    :nt_remembered
    invoke-virtual {v12, v14}, LO/q;->r(Z)V

    move-object v7, v2

    check-cast v7, LO/d0;

    const v2, -0x1ee994ce
""")
# ...and never over a payment in progress (Send -> Review, confirm, sending, paid).
patch(H0, """    invoke-virtual {v12, v2}, LO/q;->Z(I)V

    invoke-interface {v7}, LO/X0;->getValue()Ljava/lang/Object;

    move-result-object v2

    check-cast v2, Ljava/lang/Boolean;

    invoke-virtual {v2}, Ljava/lang/Boolean;->booleanValue()Z

    move-result v2

    const/4 v6, 0x1

    if-eqz v2, :cond_11
""", f"""    invoke-virtual {{v12, v2}}, LO/q;->Z(I)V

    invoke-interface {{v10}}, LO/X0;->getValue()Ljava/lang/Object;

    move-result-object v3

    invoke-static {{v7, v3}}, {F}->showScanner(Ljava/lang/Object;Ljava/lang/Object;)Z

    move-result v2

    const/4 v6, 0x1

    if-eqz v2, :cond_11
""")
# Pay screen: "Pay by NEAR ID" under "Scan QR instead" (opens Send, same as Home -> Send).
patch("smali/W2/s0.smali", """    invoke-static/range {v13 .. v22}, Ll3/a;->j(Ljava/lang/String;La0/o;ZZZLm0/e;Lj3/a;LO/q;II)V

    const/4 v0, 0x0

    invoke-virtual {v5, v0}, LO/q;->r(Z)V

    goto/16 :goto_4
""", """    invoke-static/range {v13 .. v22}, Ll3/a;->j(Ljava/lang/String;La0/o;ZZZLm0/e;Lj3/a;LO/q;II)V

    sget-object v13, La0/l;->b:La0/l;

    const/high16 v14, 0x41400000    # 12.0f

    invoke-static {v13, v14}, Landroidx/compose/foundation/layout/c;->c(La0/o;F)La0/o;

    move-result-object v13

    invoke-static {v5, v13}, Lx/c;->a(LO/q;La0/o;)V

    move-object/from16 v14, p0

    iget-object v14, v14, LW2/s0;->O:LR2/x;

    new-instance v13, LW2/L;

    const/16 v15, 0xf

    invoke-direct {v13, v14, v15}, LW2/L;-><init>(LR2/x;I)V

    move-object/from16 v19, v13

    const-string v13, "Pay by NEAR ID"

    sget-object v14, Landroidx/compose/foundation/layout/c;->a:Landroidx/compose/foundation/layout/FillElement;

    const/4 v15, 0x0

    const/16 v16, 0x1

    const/16 v17, 0x0

    invoke-static {}, Ll3/a;->O()Lm0/e;

    move-result-object v18

    move-object/from16 v20, v5

    const/16 v21, 0xc36

    const/16 v22, 0x14

    invoke-static/range {v13 .. v22}, Ll3/a;->j(Ljava/lang/String;La0/o;ZZZLm0/e;Lj3/a;LO/q;II)V

    const/4 v0, 0x0

    invoke-virtual {v5, v0}, LO/q;->r(Z)V

    goto/16 :goto_4
""")
# Paid -> Done: return to an idle Pay screen (was only "go back", so Done did nothing when Pay was the
# first screen, e.g. after a QR payment) and re-arm the NFC reader like "Try again" does.
patch("smali/W2/L.smali", """    :pswitch_3
    iget-object p0, p0, LW2/L;->N:LR2/x;

    invoke-virtual {p0}, LR2/x;->i()Z
""", """    :pswitch_3
    iget-object p0, p0, LW2/L;->N:LR2/x;

    sget-object v0, LR2/I;->a:LR2/I;

    iget-object v1, p0, LR2/x;->n:Lv3/J;

    const/4 v2, 0x0

    invoke-virtual {v1, v2, v0}, Lv3/J;->k(Ljava/lang/Object;Ljava/lang/Object;)Z

    invoke-virtual {p0}, LR2/x;->q()LR2/y;

    move-result-object v1

    check-cast v1, Lcom/halopay/near/MainActivity;

    const/4 v0, 0x1

    invoke-virtual {v1, v0}, Lcom/halopay/near/MainActivity;->H(Z)V

    invoke-virtual {p0}, LR2/x;->i()Z
""")
# Receive: NEAR only (drop the "USDC (test)" chip).
patch("smali/W2/E0.smali", """    const-string v9, "USDC (test)"

    move-object/from16 v19, v11

    const/16 v11, 0x186

    invoke-static {v9, v5, v10, v15, v11}, Ll3/a;->g(Ljava/lang/String;ZLj3/a;LO/q;I)V
""", """    move-object/from16 v19, v11
""")
# Branding: neartap: QRs/stickers, NEARTAP1 taps (old forms still accepted), NearTap site domain.
patch("smali/T2/h.smali", '    const-string v1, "halopay:pay?"\n', '    const-string v1, "neartap:pay?"\n')
patch("smali/com/halopay/near/nfc/HaloHceService.smali", '    const-string v0, "HALO1"\n', '    const-string v0, "NEARTAP1"\n')
patch("smali/J3/d.smali", """    const-string v0, "HALO1"

    invoke-static {p0, v0}, Lkotlin/jvm/internal/k;->a(Ljava/lang/Object;Ljava/lang/Object;)Z
""", f"""    invoke-static {{p0}}, {F}->isTapPayload(Ljava/lang/Object;)Z
""")
patch("smali/J3/d.smali", """.method public static D(Ljava/lang/String;)LT2/h;
    .locals 9
""", f""".method public static D(Ljava/lang/String;)LT2/h;
    .locals 9

    invoke-static {{p0}}, {F}->normalizeUri(Ljava/lang/String;)Ljava/lang/String;

    move-result-object p0
""")
patch("smali/V2/b.smali", """    const-string v5, "halopay"

    invoke-static {v4, v5, v1}, Lr3/p;->X(Ljava/lang/String;Ljava/lang/String;Z)Z
""", f"""    invoke-static {{v4}}, {F}->isPayUri(Ljava/lang/String;)Z
""")
patch(m, """    const-string p1, "halopay"

    invoke-static {v1, p1, v0}, Lr3/p;->X(Ljava/lang/String;Ljava/lang/String;Z)Z
""", f"""    invoke-static {{v1}}, {F}->isPayUri(Ljava/lang/String;)Z
""")
patch("smali/R2/x.smali", '    const-string v7, "halo:"\n', '    const-string v7, "neartap:"\n')
patch("smali/U2/g.smali", '    const-string v3, "halo"\n', '    const-string v3, "neartap"\n')
for p_, old in (("smali/S2/j.smali", '.field public static volatile b:Ljava/lang/String; = "halopay.vercel.app"\n'),
                ("smali/R2/x.smali", '    const-string v3, "halopay.vercel.app"\n'),
                ("smali/W2/U.smali", '    const-string v3, "halopay.vercel.app"\n')):
    patch(p_, old, old.replace("halopay.vercel.app", "nearappweb.vercel.app"))
mf = f"{root}/AndroidManifest.xml"; s = open(mf).read()
assert s.count('<data android:scheme="halopay"/>') == 2
s = s.replace('<data android:scheme="halopay"/>', '<data android:scheme="neartap"/>\n                <data android:scheme="halopay"/>')
open(mf, "w").write(s)
s = open(y).read()
open(y, "w").write(s.replace("versionCode: 10", "versionCode: 11").replace("versionName: 1.3.1-hackathon", "versionName: 1.3.2-hackathon"))
print("patched 1.3.2")
