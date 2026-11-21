package de.menne.gps;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.media.AudioManager;
import android.net.Uri;
import android.os.Build;
import android.view.KeyEvent;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.List;

/** Andere Apps öffnen, Medientasten, Lautstärke, Navigation, Bluetooth-Headset-Mikrofon, Hintergrunddienst. */
@CapacitorPlugin(name = "AppCtl", permissions = {
        @Permission(alias = "bt", strings = {"android.permission.BLUETOOTH_CONNECT"})
})
public class AppCtlPlugin extends Plugin {

    private AudioManager am() {
        return (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
    }

    private static String norm(String s) {
        return s == null ? "" : s.toLowerCase().replaceAll("[^a-z0-9äöüß]", "");
    }

    private void startNew(Intent i) {
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
    }

    private ResolveInfo findApp(String name) {
        String q = norm(name);
        if (q.isEmpty()) return null;
        PackageManager pm = getContext().getPackageManager();
        List<ResolveInfo> list = pm.queryIntentActivities(new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER), 0);
        ResolveInfo best = null;
        int bestScore = 0;
        for (ResolveInfo ri : list) {
            String l = norm(String.valueOf(ri.loadLabel(pm)));
            int score = 0;
            if (l.equals(q)) score = 3;
            else if (l.startsWith(q) || q.startsWith(l) && l.length() > 2) score = 2;
            else if (l.contains(q) || q.contains(l) && l.length() > 3) score = 1;
            if (score > bestScore) { bestScore = score; best = ri; }
        }
        return best;
    }

    @PluginMethod
    public void launch(PluginCall call) {
        ResolveInfo best = findApp(call.getString("name", ""));
        if (best == null) { call.reject("App nicht gefunden"); return; }
        PackageManager pm = getContext().getPackageManager();
        try {
            Intent li = pm.getLaunchIntentForPackage(best.activityInfo.packageName);
            if (li == null) { call.reject("App nicht startbar"); return; }
            startNew(li);
            JSObject o = new JSObject();
            o.put("label", String.valueOf(best.loadLabel(pm)));
            call.resolve(o);
        } catch (Exception e) {
            call.reject("Start fehlgeschlagen: " + e.getMessage());
        }
    }

    // ---------- Bedienungshilfe: andere Apps bedienen und beenden ----------
    @PluginMethod
    public void accessEnabled(PluginCall call) {
        JSObject o = new JSObject();
        o.put("enabled", TachoAccessService.inst != null);
        call.resolve(o);
    }

    @PluginMethod
    public void openAccessSettings(PluginCall call) {
        startNew(new Intent(android.provider.Settings.ACTION_ACCESSIBILITY_SETTINGS));
        call.resolve();
    }

    @PluginMethod
    public void ui(PluginCall call) {
        final TachoAccessService s = TachoAccessService.inst;
        if (s == null) { call.reject("Bedienungshilfe ist aus"); return; }
        String a = call.getString("action", "");
        String t = call.getString("text", "");
        boolean ok;
        switch (a) {
            case "back": case "home": case "recents": case "notifications": case "split": ok = s.global(a); break;
            case "click": ok = s.clickText(t, false); break;
            case "scroll_down": ok = s.scroll(true); break;
            case "scroll_up": ok = s.scroll(false); break;
            case "type": ok = s.type(t); break;
            case "closeapp": {
                String name = call.getString("name", "");
                PackageManager pm = getContext().getPackageManager();
                String pkg;
                if (name.isEmpty()) pkg = TachoAccessService.fgPkg;
                else { ResolveInfo ri = findApp(name); pkg = ri == null ? "" : ri.activityInfo.packageName; }
                if (pkg == null || pkg.isEmpty()) { call.reject("keine passende App"); return; }
                String label = pkg;
                try { label = String.valueOf(pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0))); } catch (Exception ignored) { }
                final String lb = label;
                s.forceStop(pkg, (done, msg) -> {
                    if (done) { JSObject o = new JSObject(); o.put("label", lb); call.resolve(o); }
                    else call.reject(msg);
                });
                return;
            }
            default: call.reject("Unbekannte Aktion"); return;
        }
        if (ok) call.resolve(); else call.reject("nicht gefunden");
    }

    @PluginMethod
    public void adjacent(PluginCall call) {
        String pk = call.getString("pkg", "com.google.android.apps.maps");
        Intent li = getContext().getPackageManager().getLaunchIntentForPackage(pk);
        if (li == null) { call.reject("App nicht gefunden"); return; }
        li.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_LAUNCH_ADJACENT | Intent.FLAG_ACTIVITY_MULTIPLE_TASK);
        getContext().startActivity(li);
        call.resolve();
    }

    @PluginMethod
    public void apps(PluginCall call) {
        PackageManager pm = getContext().getPackageManager();
        List<ResolveInfo> list = pm.queryIntentActivities(new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER), 0);
        JSArray a = new JSArray();
        JSArray full = new JSArray();
        for (ResolveInfo ri : list) {
            String lb = String.valueOf(ri.loadLabel(pm));
            a.put(lb);
            JSObject it = new JSObject();
            it.put("l", lb);
            it.put("p", ri.activityInfo.packageName);
            full.put(it);
        }
        JSObject o = new JSObject();
        o.put("apps", a);
        o.put("list", full);
        call.resolve(o);
    }

    @PluginMethod
    public void home(PluginCall call) {
        startNew(new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME));
        call.resolve();
    }

    @PluginMethod
    public void front(PluginCall call) {
        Intent li = getContext().getPackageManager().getLaunchIntentForPackage(getContext().getPackageName());
        if (li != null) startNew(li);
        call.resolve();
    }

    @PluginMethod
    public void media(PluginCall call) {
        String k = call.getString("key", "");
        int code;
        switch (k) {
            case "next": code = KeyEvent.KEYCODE_MEDIA_NEXT; break;
            case "prev": code = KeyEvent.KEYCODE_MEDIA_PREVIOUS; break;
            case "play": code = KeyEvent.KEYCODE_MEDIA_PLAY; break;
            case "pause": code = KeyEvent.KEYCODE_MEDIA_PAUSE; break;
            default: code = KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE;
        }
        AudioManager a = am();
        a.dispatchMediaKeyEvent(new KeyEvent(KeyEvent.ACTION_DOWN, code));
        a.dispatchMediaKeyEvent(new KeyEvent(KeyEvent.ACTION_UP, code));
        call.resolve();
    }

    @PluginMethod
    public void volume(PluginCall call) {
        boolean up = "up".equals(call.getString("dir", "up"));
        am().adjustStreamVolume(AudioManager.STREAM_MUSIC, up ? AudioManager.ADJUST_RAISE : AudioManager.ADJUST_LOWER, AudioManager.FLAG_SHOW_UI);
        call.resolve();
    }

    /** Navigation starten: {lat, lon, name} oder {query}; app = google | sygic | geo | ask */
    @PluginMethod
    public void navigate(PluginCall call) {
        String q = call.getString("query", "");
        String app = call.getString("app", "google");
        String name = call.getString("name", "Ziel");
        boolean hasPos = call.hasOption("lat") && call.hasOption("lon");
        double lat = call.getDouble("lat", 0.0), lon = call.getDouble("lon", 0.0);
        try {
            Intent i;
            if ("sygic".equals(app) && hasPos) {
                i = new Intent(Intent.ACTION_VIEW, Uri.parse("com.sygic.aura://coordinate|" + lon + "|" + lat + "|drive"));
            } else if ("google".equals(app)) {
                String dest = hasPos ? (lat + "," + lon) : Uri.encode(q);
                i = new Intent(Intent.ACTION_VIEW, Uri.parse("google.navigation:q=" + dest + "&mode=d"));
                i.setPackage("com.google.android.apps.maps");
            } else {
                String geo = hasPos ? ("geo:" + lat + "," + lon + "?q=" + lat + "," + lon + "(" + Uri.encode(name) + ")") : ("geo:0,0?q=" + Uri.encode(q));
                i = new Intent(Intent.ACTION_VIEW, Uri.parse(geo));
                if ("ask".equals(app)) i = Intent.createChooser(i, "Navigation mit");
            }
            startNew(i);
            call.resolve();
        } catch (Exception e) {
            try {
                String geo = hasPos ? ("geo:" + lat + "," + lon + "?q=" + lat + "," + lon) : ("geo:0,0?q=" + Uri.encode(q));
                startNew(new Intent(Intent.ACTION_VIEW, Uri.parse(geo)));
                call.resolve();
            } catch (Exception e2) { call.reject("Keine Navigations-App gefunden"); }
        }
    }

    @PluginMethod
    public void openUrl(PluginCall call) {
        try {
            startNew(new Intent(Intent.ACTION_VIEW, Uri.parse(call.getString("url", ""))));
            call.resolve();
        } catch (Exception e) { call.reject("Link nicht zu öffnen"); }
    }

    // ---------- Bluetooth-Headset als Mikrofon (SCO) ----------
    private boolean needBt() { return Build.VERSION.SDK_INT >= 31; }

    @PluginMethod
    public void bt(PluginCall call) {
        if (needBt() && getPermissionState("bt") != PermissionState.GRANTED) {
            requestPermissionForAlias("bt", call, "btPerm");
            return;
        }
        doBt(call);
    }

    @PermissionCallback
    private void btPerm(PluginCall call) {
        if (getPermissionState("bt") == PermissionState.GRANTED) doBt(call);
        else call.reject("Bluetooth-Berechtigung fehlt (Android-Einstellungen > Apps > Berechtigungen)");
    }

    @SuppressWarnings("deprecation")
    private void doBt(PluginCall call) {
        boolean on = call.getBoolean("on", false);
        AudioManager a = am();
        JSObject o = new JSObject();
        try {
            if (on) {
                boolean avail = a.isBluetoothScoAvailableOffCall();
                a.startBluetoothSco();
                a.setBluetoothScoOn(true);
                o.put("available", avail);
            } else {
                a.setBluetoothScoOn(false);
                a.stopBluetoothSco();
                o.put("available", false);
            }
            call.resolve(o);
        } catch (Exception e) { call.reject("Bluetooth: " + e.getMessage()); }
    }

    // ---------- Hintergrunddienst (damit das Mikrofon nicht abgeschaltet wird) ----------
    @PluginMethod
    public void keepAlive(PluginCall call) {
        boolean on = call.getBoolean("on", false);
        Intent i = new Intent(getContext(), KeepAliveService.class);
        try {
            if (on) ContextCompat.startForegroundService(getContext(), i);
            else getContext().stopService(i);
            call.resolve();
        } catch (Exception e) { call.reject("Dienst: " + e.getMessage()); }
    }
}
