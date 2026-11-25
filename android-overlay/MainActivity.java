package de.menne.gps;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(GnssPlugin.class);
        registerPlugin(VoicePlugin.class);
        registerPlugin(AppCtlPlugin.class);
        registerPlugin(PhonePlugin.class);
        registerPlugin(FilesPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
