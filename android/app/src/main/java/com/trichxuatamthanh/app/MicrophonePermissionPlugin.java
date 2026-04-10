package com.trichxuatamthanh.app;

import android.Manifest;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "MicrophonePermission",
    permissions = {
        @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO })
    }
)
public class MicrophonePermissionPlugin extends Plugin {

    @PluginMethod
    public void check(PluginCall call) {
        PermissionState state = getPermissionState("microphone");
        JSObject result = new JSObject();
        result.put("granted", state == PermissionState.GRANTED);
        result.put("status", state.toString());
        call.resolve(result);
    }

    @PluginMethod
    public void request(PluginCall call) {
        if (getPermissionState("microphone") == PermissionState.GRANTED) {
            JSObject result = new JSObject();
            result.put("granted", true);
            result.put("status", PermissionState.GRANTED.toString());
            call.resolve(result);
            return;
        }

        requestPermissionForAlias("microphone", call, "permissionCallback");
    }

    @PermissionCallback
    private void permissionCallback(PluginCall call) {
        PermissionState state = getPermissionState("microphone");
        JSObject result = new JSObject();
        result.put("granted", state == PermissionState.GRANTED);
        result.put("status", state.toString());
        call.resolve(result);
    }
}

