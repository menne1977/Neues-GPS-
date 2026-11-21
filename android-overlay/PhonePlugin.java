package de.menne.gps;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.provider.CallLog;
import android.provider.ContactsContract;
import android.telecom.TelecomManager;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.text.Normalizer;
import java.util.HashSet;

/** Telefon per Sprache: Kontakt suchen, Nummer nennen, wählen, auflegen, annehmen, letzte Anrufer. */
@CapacitorPlugin(name = "Phone", permissions = {
        @Permission(alias = "phone", strings = {
                Manifest.permission.READ_CONTACTS, Manifest.permission.CALL_PHONE,
                Manifest.permission.ANSWER_PHONE_CALLS, Manifest.permission.READ_CALL_LOG, Manifest.permission.READ_PHONE_STATE })
})
public class PhonePlugin extends Plugin {

    private boolean has(String p) { return ContextCompat.checkSelfPermission(getContext(), p) == PackageManager.PERMISSION_GRANTED; }

    private static String norm(String s) {
        if (s == null) return "";
        String n = s.toLowerCase().replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("ß", "ss");
        n = Normalizer.normalize(n, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        return n.replaceAll("[^a-z0-9 ]", " ").replaceAll("\\s+", " ").trim();
    }

    @PluginMethod
    public void ensure(PluginCall call) {
        if (has(Manifest.permission.READ_CONTACTS) && has(Manifest.permission.CALL_PHONE)) { call.resolve(new JSObject().put("ok", true)); return; }
        requestPermissionForAlias("phone", call, "permCb");
    }

    @PermissionCallback
    private void permCb(PluginCall call) {
        call.resolve(new JSObject().put("ok", has(Manifest.permission.READ_CONTACTS) && has(Manifest.permission.CALL_PHONE)));
    }

    /** Kontakte nach Name suchen, beste Treffer zuerst. */
    @PluginMethod
    public void find(PluginCall call) {
        if (!has(Manifest.permission.READ_CONTACTS)) { call.reject("Kontakte nicht erlaubt"); return; }
        String q = norm(call.getString("name", ""));
        if (q.isEmpty()) { call.reject("Kein Name"); return; }
        JSArray out = new JSArray();
        HashSet<String> seen = new HashSet<>();
        String[] proj = { ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME, ContactsContract.CommonDataKinds.Phone.NUMBER, ContactsContract.CommonDataKinds.Phone.TYPE, ContactsContract.CommonDataKinds.Phone.IS_SUPER_PRIMARY };
        java.util.ArrayList<JSObject> hits = new java.util.ArrayList<>();
        try (Cursor c = getContext().getContentResolver().query(ContactsContract.CommonDataKinds.Phone.CONTENT_URI, proj, null, null, null)) {
            while (c != null && c.moveToNext()) {
                String name = c.getString(0), num = c.getString(1);
                if (name == null || num == null) continue;
                String n = norm(name);
                int score = 0;
                if (n.equals(q)) score = 100;
                else if (n.startsWith(q + " ") || n.endsWith(" " + q)) score = 80;
                else if ((" " + n + " ").contains(" " + q + " ")) score = 70;
                else if (n.startsWith(q)) score = 60;
                else if (n.contains(q)) score = 40;
                if (score == 0) continue;
                if (c.getInt(3) > 0) score += 5;
                if (c.getInt(2) == ContactsContract.CommonDataKinds.Phone.TYPE_MOBILE) score += 3;
                String key = name + "|" + num.replaceAll("[^0-9+]", "");
                if (!seen.add(key)) continue;
                JSObject o = new JSObject();
                o.put("name", name); o.put("number", num); o.put("score", score);
                o.put("type", String.valueOf(ContactsContract.CommonDataKinds.Phone.getTypeLabel(getContext().getResources(), c.getInt(2), "")));
                hits.add(o);
            }
        } catch (Exception e) { call.reject(String.valueOf(e.getMessage())); return; }
        hits.sort((a, b) -> b.getInteger("score", 0) - a.getInteger("score", 0));
        for (int i = 0; i < Math.min(8, hits.size()); i++) out.put(hits.get(i));
        call.resolve(new JSObject().put("list", out));
    }

    /** Nummer wählen. Mit Erlaubnis direkt, sonst öffnet sich die Wähltastatur. */
    @PluginMethod
    public void dial(PluginCall call) {
        String num = call.getString("number", "").replaceAll("[^0-9+*#]", "");
        if (num.isEmpty()) { call.reject("Keine Nummer"); return; }
        boolean direct = has(Manifest.permission.CALL_PHONE);
        Intent i = new Intent(direct ? Intent.ACTION_CALL : Intent.ACTION_DIAL, Uri.parse("tel:" + Uri.encode(num)));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try { getContext().startActivity(i); call.resolve(new JSObject().put("direct", direct)); }
        catch (Exception e) { call.reject(String.valueOf(e.getMessage())); }
    }

    @PluginMethod
    public void hangup(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 28 && has(Manifest.permission.ANSWER_PHONE_CALLS)) {
            try {
                boolean ok = ((TelecomManager) getContext().getSystemService(Context.TELECOM_SERVICE)).endCall();
                call.resolve(new JSObject().put("ok", ok)); return;
            } catch (Exception e) { /* weiter unten */ }
        }
        call.reject("Auflegen nicht erlaubt");
    }

    @PluginMethod
    public void answer(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 26 && has(Manifest.permission.ANSWER_PHONE_CALLS)) {
            try { ((TelecomManager) getContext().getSystemService(Context.TELECOM_SERVICE)).acceptRingingCall(); call.resolve(); return; }
            catch (Exception e) { /* nichts */ }
        }
        call.reject("Annehmen nicht erlaubt");
    }

    /** Letzte Anrufe (für „Wer hat angerufen“ und „Rückruf“). */
    @PluginMethod
    public void recent(PluginCall call) {
        if (!has(Manifest.permission.READ_CALL_LOG)) { call.reject("Anrufliste nicht erlaubt"); return; }
        JSArray out = new JSArray();
        try (Cursor c = getContext().getContentResolver().query(CallLog.Calls.CONTENT_URI,
                new String[]{CallLog.Calls.CACHED_NAME, CallLog.Calls.NUMBER, CallLog.Calls.TYPE, CallLog.Calls.DATE}, null, null, CallLog.Calls.DATE + " DESC")) {
            int n = 0;
            while (c != null && c.moveToNext() && n++ < 5) {
                JSObject o = new JSObject();
                o.put("name", c.getString(0)); o.put("number", c.getString(1)); o.put("type", c.getInt(2)); o.put("t", c.getLong(3));
                out.put(o);
            }
        } catch (Exception e) { call.reject(String.valueOf(e.getMessage())); return; }
        call.resolve(new JSObject().put("list", out));
    }
}
