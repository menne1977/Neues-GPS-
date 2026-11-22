package de.menne.gps;

import android.annotation.SuppressLint;
import android.content.Context;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.hardware.GeomagneticField;
import android.location.GnssStatus;
import android.location.Location;
import android.location.LocationListener;
import android.location.OnNmeaMessageListener;
import android.view.Surface;
import android.view.WindowManager;
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
    private LocationListener fixListener;
    private OnNmeaMessageListener nmeaListener;
    private double nmeaMsl = Double.NaN, nmeaSep = Double.NaN;
    private long nmeaT = 0;
    private SensorManager sm;
    private SensorEventListener compassListener;
    private long compassT = 0;
    private float declination = 0f;
    private final float[] rot = new float[9], rot2 = new float[9], ori = new float[3];

    /** Schnelle Ortung: GPS-Sensor direkt, jede Sekunde oder schneller, mit Höhe über NN (aus NMEA) und über dem Ellipsoid. */
    @PluginMethod
    @SuppressLint("MissingPermission")
    public void startFix(PluginCall call) {
        try {
            if (fixListener != null) { call.resolve(); return; }
            lm = (LocationManager) getContext().getSystemService(Context.LOCATION_SERVICE);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                nmeaListener = (message, timestamp) -> {
                    try {
                        if (message.length() < 20 || !message.startsWith("$") || !message.substring(3, 6).equals("GGA")) return;
                        String[] f = message.split("[,*]");
                        if (f.length > 11 && !f[9].isEmpty() && !f[11].isEmpty()) {
                            nmeaMsl = Double.parseDouble(f[9]);
                            nmeaSep = Double.parseDouble(f[11]);
                            nmeaT = System.currentTimeMillis();
                        }
                    } catch (Exception ignore) { /* Satz unvollständig */ }
                };
                lm.addNmeaListener(nmeaListener, new Handler(Looper.getMainLooper()));
            }
            fixListener = new LocationListener() {
                @Override
                public void onLocationChanged(Location l) {
                    JSObject o = new JSObject();
                    o.put("lat", l.getLatitude());
                    o.put("lon", l.getLongitude());
                    o.put("acc", l.getAccuracy());
                    o.put("t", l.getTime());
                    o.put("prov", String.valueOf(l.getProvider()));
                    o.put("speed", l.hasSpeed() ? l.getSpeed() : -1);
                    o.put("bearing", l.hasBearing() ? l.getBearing() : -1);
                    o.put("alt", l.hasAltitude() ? l.getAltitude() : JSObject.NULL);
                    if (l.hasAltitude() && System.currentTimeMillis() - nmeaT < 3000 && !Double.isNaN(nmeaMsl)) {
                        o.put("msl", nmeaMsl);
                        o.put("ell", nmeaMsl + nmeaSep);
                    } else if (Build.VERSION.SDK_INT >= 34 && l.hasMslAltitude()) {
                        o.put("msl", l.getMslAltitudeMeters());
                        o.put("ell", l.getAltitude());
                    }
                    if (Build.VERSION.SDK_INT >= 26 && l.hasSpeedAccuracy()) o.put("sacc", l.getSpeedAccuracyMetersPerSecond());
                    try {
                        declination = new GeomagneticField((float) l.getLatitude(), (float) l.getLongitude(), (float) (l.hasAltitude() ? l.getAltitude() : 0), System.currentTimeMillis()).getDeclination();
                    } catch (Exception ignore) { /* egal */ }
                    notifyListeners("fix", o);
                }
                @Override public void onProviderEnabled(String p) { }
                @Override public void onProviderDisabled(String p) { }
                @Override public void onStatusChanged(String p, int s, android.os.Bundle b) { }
            };
            boolean fast = false;
            if (Build.VERSION.SDK_INT >= 31) {
                try {
                    // schnellste Abfrage: bis zu 4 Fixe pro Sekunde, wenn das Handy es kann
                    android.location.LocationRequest req = new android.location.LocationRequest.Builder(250)
                        .setQuality(android.location.LocationRequest.QUALITY_HIGH_ACCURACY).setMinUpdateIntervalMillis(100).build();
                    final Handler hh = new Handler(Looper.getMainLooper());
                    lm.requestLocationUpdates(LocationManager.GPS_PROVIDER, req, hh::post, fixListener);
                    fast = true;
                } catch (Exception ignore) { fast = false; }
            }
            if (!fast) lm.requestLocationUpdates(LocationManager.GPS_PROVIDER, 0, 0, fixListener, Looper.getMainLooper());
            // Ersatz drinnen oder ohne Satelliten: Ortung übers Netz, und sofort der letzte bekannte Ort
            try { if (lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) lm.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 2000, 0, fixListener, Looper.getMainLooper()); } catch (Exception ignore) { }
            Location best = null;
            for (String pr : new String[]{LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER, "fused", LocationManager.PASSIVE_PROVIDER}) {
                try { Location l = lm.getLastKnownLocation(pr); if (l != null && !(LocationManager.GPS_PROVIDER.equals(pr) && System.currentTimeMillis() - l.getTime() > 15000) && (best == null || l.getTime() > best.getTime())) best = l; } catch (Exception ignore) { }
            }
            if (best != null) { final Location b = best; new Handler(Looper.getMainLooper()).post(() -> fixListener.onLocationChanged(b)); }
            call.resolve();
        } catch (SecurityException e) {
            fixListener = null;
            call.reject("Standort nicht erlaubt");
        } catch (Exception e) {
            fixListener = null;
            call.reject(String.valueOf(e.getMessage()));
        }
    }

    @PluginMethod
    public void stopFix(PluginCall call) {
        if (lm != null && fixListener != null) lm.removeUpdates(fixListener);
        if (lm != null && nmeaListener != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) lm.removeNmeaListener(nmeaListener);
        fixListener = null; nmeaListener = null;
        call.resolve();
    }

    /** Schneller Kompass aus dem Drehvektor-Sensor, wahre Nordrichtung, bis ca. 30 Mal pro Sekunde. */
    @PluginMethod
    public void startCompass(PluginCall call) {
        if (compassListener != null) { call.resolve(); return; }
        sm = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
        Sensor rv = sm.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR);
        if (rv == null) { call.reject("Kein Kompass-Sensor"); return; }
        compassListener = new SensorEventListener() {
            @Override
            public void onSensorChanged(SensorEvent e) {
                long now = System.currentTimeMillis();
                if (now - compassT < 33) return;
                compassT = now;
                SensorManager.getRotationMatrixFromVector(rot, e.values);
                int r = Surface.ROTATION_0;
                try { r = ((WindowManager) getContext().getSystemService(Context.WINDOW_SERVICE)).getDefaultDisplay().getRotation(); } catch (Exception ignore) { /* 0 */ }
                int ax = SensorManager.AXIS_X, ay = SensorManager.AXIS_Z;
                if (r == Surface.ROTATION_90) { ax = SensorManager.AXIS_Z; ay = SensorManager.AXIS_MINUS_X; }
                else if (r == Surface.ROTATION_180) { ax = SensorManager.AXIS_MINUS_X; ay = SensorManager.AXIS_MINUS_Z; }
                else if (r == Surface.ROTATION_270) { ax = SensorManager.AXIS_MINUS_Z; ay = SensorManager.AXIS_X; }
                SensorManager.remapCoordinateSystem(rot, ax, ay, rot2);
                SensorManager.getOrientation(rot2, ori);
                double az = Math.toDegrees(ori[0]) + declination;
                az = (az % 360 + 360) % 360;
                JSObject o = new JSObject();
                o.put("h", az);
                notifyListeners("compass", o);
            }
            @Override public void onAccuracyChanged(Sensor s, int a) { }
        };
        sm.registerListener(compassListener, rv, SensorManager.SENSOR_DELAY_GAME);
        call.resolve();
    }

    @PluginMethod
    public void stopCompass(PluginCall call) {
        if (sm != null && compassListener != null) sm.unregisterListener(compassListener);
        compassListener = null;
        call.resolve();
    }

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
