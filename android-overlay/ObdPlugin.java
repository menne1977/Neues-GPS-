package de.menne.gps;

import android.annotation.SuppressLint;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.os.Build;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** ELM327-Zugang: Bluetooth-Classic (SPP) oder WLAN. Sendet Textbefehle und liefert die Rohantwort. */
@CapacitorPlugin(name = "Obd", permissions = {
        @Permission(alias = "bt", strings = {"android.permission.BLUETOOTH_CONNECT"})
})
public class ObdPlugin extends Plugin {
    private static final UUID SPP = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");
    private final ExecutorService ex = Executors.newSingleThreadExecutor();
    private BluetoothSocket bt;
    private Socket wifi;
    private InputStream in;
    private OutputStream out;

    private boolean needBt() { return Build.VERSION.SDK_INT >= 31; }

    private boolean ensureBt(PluginCall call) {
        if (needBt() && getPermissionState("bt") != PermissionState.GRANTED) {
            requestPermissionForAlias("bt", call, "btPerm");
            return false;
        }
        return true;
    }

    @PermissionCallback
    private void btPerm(PluginCall call) {
        if (getPermissionState("bt") != PermissionState.GRANTED) {
            call.reject("Bluetooth-Berechtigung fehlt (Android-Einstellungen > Apps > Berechtigungen)");
            return;
        }
        if ("devices".equals(call.getMethodName())) devices(call);
        else if ("connect".equals(call.getMethodName())) connect(call);
    }

    @SuppressLint("MissingPermission")
    @PluginMethod
    public void devices(PluginCall call) {
        if (!ensureBt(call)) return;
        BluetoothAdapter ad = BluetoothAdapter.getDefaultAdapter();
        if (ad == null) { call.reject("Kein Bluetooth im Gerät"); return; }
        if (!ad.isEnabled()) { call.reject("Bluetooth ist aus"); return; }
        JSArray a = new JSArray();
        Set<BluetoothDevice> set = ad.getBondedDevices();
        for (BluetoothDevice d : set) {
            JSObject o = new JSObject();
            o.put("name", d.getName());
            o.put("address", d.getAddress());
            a.put(o);
        }
        JSObject r = new JSObject();
        r.put("devices", a);
        call.resolve(r);
    }

    private void closeAll() {
        try { if (bt != null) bt.close(); } catch (Exception ignored) { }
        try { if (wifi != null) wifi.close(); } catch (Exception ignored) { }
        bt = null; wifi = null; in = null; out = null;
    }

    @SuppressLint("MissingPermission")
    @PluginMethod
    public void connect(PluginCall call) {
        final String type = call.getString("type", "bt");
        if ("bt".equals(type) && !ensureBt(call)) return;
        final String addr = call.getString("address", "");
        final String host = call.getString("host", "192.168.0.10");
        final int port = call.getInt("port", 35000);
        ex.execute(() -> {
            try {
                closeAll();
                if ("wifi".equals(type)) {
                    wifi = new Socket();
                    wifi.connect(new InetSocketAddress(host, port), 6000);
                    in = wifi.getInputStream();
                    out = wifi.getOutputStream();
                } else {
                    BluetoothAdapter ad = BluetoothAdapter.getDefaultAdapter();
                    if (ad == null || !ad.isEnabled()) throw new Exception("Bluetooth ist aus");
                    BluetoothDevice d = ad.getRemoteDevice(addr);
                    try {
                        bt = d.createRfcommSocketToServiceRecord(SPP);
                        bt.connect();
                    } catch (Exception first) {
                        try { if (bt != null) bt.close(); } catch (Exception ignored) { }
                        bt = (BluetoothSocket) d.getClass().getMethod("createRfcommSocket", int.class).invoke(d, 1);
                        bt.connect();
                    }
                    in = bt.getInputStream();
                    out = bt.getOutputStream();
                }
                call.resolve();
            } catch (Exception e) {
                closeAll();
                call.reject("Verbindung fehlgeschlagen: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void send(PluginCall call) {
        final String cmd = call.getString("cmd", "").trim().toUpperCase().replace(" ", "");
        if (!allowed(cmd)) { call.reject("Befehl gesperrt: " + cmd + " (nur Echtzeitwerte, Fehler lesen und löschen erlaubt)"); return; }
        final int timeout = call.getInt("timeout", 3000);
        ex.execute(() -> {
            try {
                if (out == null || in == null) throw new Exception("Nicht verbunden");
                while (in.available() > 0) in.read();
                out.write((cmd + "\r").getBytes("US-ASCII"));
                out.flush();
                StringBuilder sb = new StringBuilder();
                long end = System.currentTimeMillis() + timeout;
                byte[] buf = new byte[256];
                while (System.currentTimeMillis() < end) {
                    int n = in.available();
                    if (n > 0) {
                        n = in.read(buf, 0, Math.min(n, buf.length));
                        sb.append(new String(buf, 0, n, "US-ASCII"));
                        if (sb.indexOf(">") >= 0) break;
                    } else Thread.sleep(15);
                }
                String s = sb.toString().replace(">", "").replace("\r", "\n").replaceAll("\n+", "\n").trim();
                JSObject r = new JSObject();
                r.put("data", s);
                call.resolve(r);
            } catch (Exception e) {
                call.reject(e.getMessage() == null ? "Sendefehler" : e.getMessage());
            }
        });
    }

    /**
     * Freigabeliste: nur Lesen und Fehlerspeicher löschen.
     * AT...  = nur Einstellungen des Adapters (ändern nichts am Auto)
     * 01xx   = Echtzeitwerte lesen
     * 03, 07 = gespeicherte und anstehende Fehler lesen
     * 04     = Fehlerspeicher löschen
     * Alles andere (Codieren, Anpassen, Stellglieder, Programmieren) ist gesperrt.
     */
    private static boolean allowed(String c) {
        if (c.matches("ATZ|ATE0|ATL0|ATS[01]|ATH0|ATSP0|ATDPN|ATRV")) return true;
        if (c.matches("01[0-9A-F]{2}")) return true;
        return c.equals("03") || c.equals("07") || c.equals("04");
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        ex.execute(() -> { closeAll(); call.resolve(); });
    }
}
