package de.menne.gps;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(GnssPlugin.class);
        registerPlugin(VoicePlugin.class);
        registerPlugin(AppCtlPlugin.class);
        registerPlugin(ObdPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
