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

/** Navigation, Bluetooth-Headset-Mikrofon, Hintergrunddienst, Medientasten, Lautstärke. */
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

    @PluginMethod
    public void navigate(PluginCall call) {
        String q = call.getString("query", "");
        try {
            Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse("google.navigation:q=" + Uri.encode(q)));
            i.setPackage("com.google.android.apps.maps");
            startNew(i);
            call.resolve();
        } catch (Exception e) {
            try {
                startNew(new Intent(Intent.ACTION_VIEW, Uri.parse("geo:0,0?q=" + Uri.encode(q))));
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
