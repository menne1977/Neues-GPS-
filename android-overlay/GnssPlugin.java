package de.menne.gps;

import android.annotation.SuppressLint;
import android.content.Context;
import android.location.GnssStatus;
import android.location.LocationManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Liefert Satellitenstatus (Anzahl sichtbar/im Fix, C/N0 je Satellit) an die Web-Oberfläche.
 * Benötigt Android 7 (API 24) und die Standortfreigabe.
 */
@CapacitorPlugin(name = "Gnss")
public class GnssPlugin extends Plugin {

    private LocationManager lm;
    private GnssStatus.Callback callback;

    @PluginMethod
    @SuppressLint("MissingPermission")
    public void start(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) {
            call.reject("Satellitenstatus braucht Android 7 oder neuer");
            return;
        }
        if (callback != null) {
            call.resolve();
            return;
        }
        lm = (LocationManager) getContext().getSystemService(Context.LOCATION_SERVICE);
        callback = new GnssStatus.Callback() {
            @Override
            public void onSatelliteStatusChanged(GnssStatus status) {
                JSArray sats = new JSArray();
                int used = 0;
                for (int i = 0; i < status.getSatelliteCount(); i++) {
                    JSObject s = new JSObject();
                    s.put("svid", status.getSvid(i));
                    s.put("constellation", status.getConstellationType(i));
                    s.put("cn0", status.getCn0DbHz(i));
                    s.put("elevation", status.getElevationDegrees(i));
                    s.put("azimuth", status.getAzimuthDegrees(i));
                    s.put("used", status.usedInFix(i));
                    if (status.usedInFix(i)) {
                        used++;
                    }
                    sats.put(s);
                }
                JSObject out = new JSObject();
                out.put("visible", status.getSatelliteCount());
                out.put("used", used);
                out.put("sats", sats);
                notifyListeners("gnss", out);
            }
        };
        lm.registerGnssStatusCallback(callback, new Handler(Looper.getMainLooper()));
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        if (lm != null && callback != null) {
            lm.unregisterGnssStatusCallback(callback);
        }
        callback = null;
        call.resolve();
    }
}
