package de.menne.gps;

import android.accessibilityservice.AccessibilityService;
import android.content.Intent;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;

/**
 * Bedienungshilfe nur für Sprachbefehle des Tachos: zurück, tippen, scrollen, Text eintragen, App beenden.
 * Sie reagiert nur auf Aufrufe der App, speichert keinen Bildschirminhalt und sendet nichts weiter.
 * Von den Ereignissen wird nur der Paketname des vordersten Fensters gemerkt.
 */
public class TachoAccessService extends AccessibilityService {
    static volatile TachoAccessService inst;
    static volatile String fgPkg = "";
    private final Handler h = new Handler(Looper.getMainLooper());

    interface Done { void done(boolean ok, String msg); }

    @Override protected void onServiceConnected() { inst = this; }
    @Override public boolean onUnbind(Intent i) { inst = null; return super.onUnbind(i); }
    @Override public void onInterrupt() { }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent e) {
        if (e == null || e.getEventType() != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED || e.getPackageName() == null) return;
        String p = e.getPackageName().toString();
        if (p.equals(getPackageName()) || p.equals("com.android.systemui") || p.equals("com.android.settings")
                || p.contains("inputmethod") || p.contains("keyboard") || isLauncher(p)) return;
        fgPkg = p;
    }

    private boolean isLauncher(String p) {
        ResolveInfo ri = getPackageManager().resolveActivity(new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME), 0);
        return ri != null && ri.activityInfo != null && p.equals(ri.activityInfo.packageName);
    }

    private static String low(CharSequence c) { return c == null ? "" : c.toString().toLowerCase(); }

    private AccessibilityNodeInfo findNode(AccessibilityNodeInfo n, String q, boolean exact) {
        if (n == null || q.isEmpty()) return null;
        String t = low(n.getText()), d = low(n.getContentDescription());
        if (n.isVisibleToUser() && (exact ? (t.equals(q) || d.equals(q)) : (t.contains(q) || d.contains(q)))) return n;
        for (int i = 0; i < n.getChildCount(); i++) {
            AccessibilityNodeInfo r = findNode(n.getChild(i), q, exact);
            if (r != null) return r;
        }
        return null;
    }

    private boolean click(AccessibilityNodeInfo n) {
        while (n != null) {
            if (n.isClickable() && n.isEnabled()) return n.performAction(AccessibilityNodeInfo.ACTION_CLICK);
            n = n.getParent();
        }
        return false;
    }

    private AccessibilityNodeInfo findScrollable(AccessibilityNodeInfo n) {
        if (n == null) return null;
        if (n.isScrollable() && n.isVisibleToUser()) return n;
        for (int i = 0; i < n.getChildCount(); i++) {
            AccessibilityNodeInfo r = findScrollable(n.getChild(i));
            if (r != null) return r;
        }
        return null;
    }

    boolean clickText(String text, boolean exact) {
        return click(findNode(getRootInActiveWindow(), low(text).trim(), exact));
    }

    boolean scroll(boolean forward) {
        AccessibilityNodeInfo s = findScrollable(getRootInActiveWindow());
        return s != null && s.performAction(forward ? AccessibilityNodeInfo.ACTION_SCROLL_FORWARD : AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD);
    }

    boolean type(String text) {
        AccessibilityNodeInfo root = getRootInActiveWindow();
        AccessibilityNodeInfo f = root == null ? null : root.findFocus(AccessibilityNodeInfo.FOCUS_INPUT);
        if (f == null) return false;
        Bundle b = new Bundle();
        b.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text);
        return f.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, b);
    }

    boolean global(String a) {
        switch (a) {
            case "back": return performGlobalAction(GLOBAL_ACTION_BACK);
            case "home": return performGlobalAction(GLOBAL_ACTION_HOME);
            case "recents": return performGlobalAction(GLOBAL_ACTION_RECENTS);
            case "notifications": return performGlobalAction(GLOBAL_ACTION_NOTIFICATIONS);
            case "split": return performGlobalAction(GLOBAL_ACTION_TOGGLE_SPLIT_SCREEN);
            default: return false;
        }
    }

    // App beenden: App-Info öffnen, „Beenden erzwingen“ drücken und bestätigen
    void forceStop(String pkg, Done cb) {
        if (pkg == null || pkg.isEmpty() || pkg.equals(getPackageName())) { cb.done(false, "keine passende App"); return; }
        Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + pkg));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivity(i);
        step(0, 0, cb);
    }

    private static final String[] FS = {"beenden erzwingen", "stoppen erzwingen", "force stop", "zwangsstopp"};
    private static final String[] OK = {"ok", "beenden", "stoppen", "force stop"};

    private void step(final int phase, final int tries, final Done cb) {
        h.postDelayed(() -> {
            AccessibilityNodeInfo root = getRootInActiveWindow();
            if (phase == 0) {
                AccessibilityNodeInfo n = null;
                for (String s : FS) { n = findNode(root, s, false); if (n != null) break; }
                if (n != null) {
                    if (click(n)) { step(1, 0, cb); } else { performGlobalAction(GLOBAL_ACTION_HOME); cb.done(false, "App läuft nicht"); }
                    return;
                }
            } else {
                for (String s : OK) {
                    AccessibilityNodeInfo ok = findNode(root, s, true);
                    if (ok != null && click(ok)) {
                        h.postDelayed(() -> { performGlobalAction(GLOBAL_ACTION_HOME); cb.done(true, ""); }, 500);
                        return;
                    }
                }
            }
            if (tries > 14) { performGlobalAction(GLOBAL_ACTION_HOME); cb.done(false, phase == 0 ? "Beenden-Knopf nicht gefunden" : "Bestätigung nicht gefunden"); }
            else step(phase, tries + 1, cb);
        }, 450);
    }
}
