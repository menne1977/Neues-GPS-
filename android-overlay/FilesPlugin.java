package de.menne.gps;

import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.ContentValues;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/** Eigener Ordner "Documents/Tacho-Designs": Designs speichern, auflisten, lesen. */
@CapacitorPlugin(name = "DesignFiles")
public class FilesPlugin extends Plugin {
    private static final String DIR = "Tacho-Designs";
    private static final String REL = Environment.DIRECTORY_DOCUMENTS + "/" + DIR + "/";

    private static String safe(String n) {
        String s = n == null ? "design" : n.replaceAll("[\\\\/:*?\"<>|]", "_").trim();
        return s.isEmpty() ? "design" : s;
    }

    private Uri find(String file) {
        ContentResolver cr = getContext().getContentResolver();
        Uri base = MediaStore.Files.getContentUri("external");
        try (Cursor c = cr.query(base, new String[]{MediaStore.MediaColumns._ID},
                MediaStore.MediaColumns.DISPLAY_NAME + "=? AND " + MediaStore.MediaColumns.RELATIVE_PATH + " LIKE ?",
                new String[]{file, REL + "%"}, null)) {
            if (c != null && c.moveToFirst()) return ContentUris.withAppendedId(base, c.getLong(0));
        } catch (Exception ignored) { }
        return null;
    }

    private File legacyDir() {
        File d = new File(getContext().getExternalFilesDir(null), DIR);
        d.mkdirs();
        return d;
    }

    @PluginMethod
    public void save(PluginCall call) {
        String name = call.getString("name"), text = call.getString("text");
        if (name == null || text == null) { call.reject("Name oder Text fehlt"); return; }
        String file = safe(name) + ".tacho.json";
        try {
            byte[] data = text.getBytes(StandardCharsets.UTF_8);
            String where;
            if (Build.VERSION.SDK_INT >= 29) {
                ContentResolver cr = getContext().getContentResolver();
                Uri u = find(file);
                if (u == null) {
                    ContentValues v = new ContentValues();
                    v.put(MediaStore.MediaColumns.DISPLAY_NAME, file);
                    v.put(MediaStore.MediaColumns.MIME_TYPE, "application/json");
                    v.put(MediaStore.MediaColumns.RELATIVE_PATH, REL);
                    u = cr.insert(MediaStore.Files.getContentUri("external"), v);
                }
                if (u == null) throw new Exception("Ordner nicht beschreibbar");
                try (OutputStream o = cr.openOutputStream(u, "wt")) { o.write(data); }
                where = REL + file;
            } else {
                File f = new File(legacyDir(), file);
                try (FileOutputStream o = new FileOutputStream(f)) { o.write(data); }
                where = f.getAbsolutePath();
            }
            JSObject r = new JSObject(); r.put("path", where); call.resolve(r);
        } catch (Exception e) { call.reject("Speichern fehlgeschlagen: " + e.getMessage()); }
    }

    @PluginMethod
    public void list(PluginCall call) {
        JSArray out = new JSArray();
        try {
            if (Build.VERSION.SDK_INT >= 29) {
                try (Cursor c = getContext().getContentResolver().query(MediaStore.Files.getContentUri("external"),
                        new String[]{MediaStore.MediaColumns.DISPLAY_NAME},
                        MediaStore.MediaColumns.RELATIVE_PATH + " LIKE ?", new String[]{REL + "%"},
                        MediaStore.MediaColumns.DISPLAY_NAME)) {
                    while (c != null && c.moveToNext()) { String n = c.getString(0); if (n.endsWith(".tacho.json")) out.put(n); }
                }
            } else {
                File[] fs = legacyDir().listFiles();
                if (fs != null) for (File f : fs) if (f.getName().endsWith(".tacho.json")) out.put(f.getName());
            }
        } catch (Exception e) { call.reject(e.getMessage()); return; }
        JSObject r = new JSObject(); r.put("files", out); r.put("dir", "Documents/" + DIR); call.resolve(r);
    }

    @PluginMethod
    public void read(PluginCall call) {
        String file = call.getString("file");
        if (file == null) { call.reject("Datei fehlt"); return; }
        try {
            InputStream in;
            if (Build.VERSION.SDK_INT >= 29) {
                Uri u = find(file);
                if (u == null) throw new Exception("nicht gefunden");
                in = getContext().getContentResolver().openInputStream(u);
            } else in = new java.io.FileInputStream(new File(legacyDir(), safe(file)));
            ByteArrayOutputStream b = new ByteArrayOutputStream(); byte[] buf = new byte[8192]; int n;
            while ((n = in.read(buf)) > 0) b.write(buf, 0, n);
            in.close();
            JSObject r = new JSObject(); r.put("text", b.toString("UTF-8")); call.resolve(r);
        } catch (Exception e) { call.reject("Lesen fehlgeschlagen: " + e.getMessage()); }
    }
}
