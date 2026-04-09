package com.trichxuatamthanh.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.KeyStore;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

@CapacitorPlugin(name = "SecureKeyStore")
public class SecureKeyStorePlugin extends Plugin {
    private static final String KEYSTORE_PROVIDER = "AndroidKeyStore";
    private static final String KEY_ALIAS = "tsrecord_secure_key";
    private static final String PREFS_NAME = "tsrecord_secure_store";
    private static final String TRANSFORMATION = "AES/GCM/NoPadding";
    private static final String VALUE_SEPARATOR = ":";

    @PluginMethod
    public void set(PluginCall call) {
        String key = call.getString("key");
        String value = call.getString("value", "");

        if (key == null || key.trim().isEmpty()) {
            call.reject("Missing storage key.");
            return;
        }

        try {
            SharedPreferences.Editor editor = getPreferences().edit();

            if (value.trim().isEmpty()) {
                editor.remove(key);
            } else {
                editor.putString(key, encrypt(value));
            }

            editor.apply();
            call.resolve();
        } catch (Exception exception) {
            call.reject("Failed to securely store value.", exception);
        }
    }

    @PluginMethod
    public void get(PluginCall call) {
        String key = call.getString("key");

        if (key == null || key.trim().isEmpty()) {
            call.reject("Missing storage key.");
            return;
        }

        try {
            String payload = getPreferences().getString(key, null);
            JSObject result = new JSObject();

            if (payload == null || payload.isEmpty()) {
                result.put("value", JSObject.NULL);
            } else {
                result.put("value", decrypt(payload));
            }

            call.resolve(result);
        } catch (Exception exception) {
            call.reject("Failed to securely read value.", exception);
        }
    }

    @PluginMethod
    public void remove(PluginCall call) {
        String key = call.getString("key");

        if (key == null || key.trim().isEmpty()) {
            call.reject("Missing storage key.");
            return;
        }

        getPreferences().edit().remove(key).apply();
        call.resolve();
    }

    private SharedPreferences getPreferences() {
        return getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    private String encrypt(String value) throws Exception {
        Cipher cipher = Cipher.getInstance(TRANSFORMATION);
        cipher.init(Cipher.ENCRYPT_MODE, getOrCreateSecretKey());

        byte[] iv = cipher.getIV();
        byte[] encryptedBytes = cipher.doFinal(value.getBytes(StandardCharsets.UTF_8));

        return Base64.encodeToString(iv, Base64.NO_WRAP)
            + VALUE_SEPARATOR
            + Base64.encodeToString(encryptedBytes, Base64.NO_WRAP);
    }

    private String decrypt(String payload) throws Exception {
        String[] parts = payload.split(VALUE_SEPARATOR, 2);

        if (parts.length != 2) {
            throw new GeneralSecurityException("Stored payload is invalid.");
        }

        byte[] iv = Base64.decode(parts[0], Base64.NO_WRAP);
        byte[] encryptedBytes = Base64.decode(parts[1], Base64.NO_WRAP);

        Cipher cipher = Cipher.getInstance(TRANSFORMATION);
        cipher.init(
            Cipher.DECRYPT_MODE,
            getOrCreateSecretKey(),
            new GCMParameterSpec(128, iv)
        );

        byte[] decryptedBytes = cipher.doFinal(encryptedBytes);
        return new String(decryptedBytes, StandardCharsets.UTF_8);
    }

    private SecretKey getOrCreateSecretKey() throws Exception {
        KeyStore keyStore = KeyStore.getInstance(KEYSTORE_PROVIDER);
        keyStore.load(null);

        SecretKey existingKey = ((SecretKey) keyStore.getKey(KEY_ALIAS, null));
        if (existingKey != null) {
            return existingKey;
        }

        KeyGenerator keyGenerator = KeyGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_AES,
            KEYSTORE_PROVIDER
        );

        KeyGenParameterSpec keySpec = new KeyGenParameterSpec.Builder(
            KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setRandomizedEncryptionRequired(true)
            .build();

        keyGenerator.init(keySpec);
        return keyGenerator.generateKey();
    }
}
