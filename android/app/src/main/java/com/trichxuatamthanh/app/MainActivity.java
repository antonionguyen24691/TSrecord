package com.trichxuatamthanh.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AppUpdatePlugin.class);
        registerPlugin(AudioVadPlugin.class);
        registerPlugin(BackgroundProcessingSchedulerPlugin.class);
        registerPlugin(ProcessingCheckpointStorePlugin.class);
        registerPlugin(SecureKeyStorePlugin.class);
        registerPlugin(MicrophonePermissionPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
