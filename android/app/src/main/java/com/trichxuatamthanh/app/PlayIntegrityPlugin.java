package com.trichxuatamthanh.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.play.core.integrity.IntegrityManager;
import com.google.android.play.core.integrity.IntegrityManagerFactory;
import com.google.android.play.core.integrity.IntegrityTokenRequest;
import com.google.android.play.core.integrity.IntegrityTokenResponse;

@CapacitorPlugin(name = "PlayIntegrity")
public class PlayIntegrityPlugin extends Plugin {
    @PluginMethod
    public void requestToken(PluginCall call) {
        String nonce = call.getString("nonce");
        String cloudProjectNumber = call.getString("cloudProjectNumber");

        if (nonce == null || nonce.trim().isEmpty()) {
            call.reject("Missing nonce.");
            return;
        }

        try {
            IntegrityManager integrityManager = IntegrityManagerFactory.create(getContext());
            IntegrityTokenRequest.Builder builder = IntegrityTokenRequest.builder()
                .setNonce(nonce.trim());

            if (cloudProjectNumber != null && !cloudProjectNumber.trim().isEmpty()) {
                builder.setCloudProjectNumber(Long.parseLong(cloudProjectNumber.trim()));
            }

            integrityManager.requestIntegrityToken(builder.build())
                .addOnSuccessListener((IntegrityTokenResponse response) -> {
                    JSObject result = new JSObject();
                    result.put("token", response.token());
                    call.resolve(result);
                })
                .addOnFailureListener(exception -> call.reject("Play Integrity request failed.", exception));
        } catch (Exception exception) {
            call.reject("Play Integrity setup failed.", exception);
        }
    }
}
