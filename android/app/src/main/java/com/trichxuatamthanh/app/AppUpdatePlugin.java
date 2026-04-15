package com.trichxuatamthanh.app;

import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;

@CapacitorPlugin(name = "AppUpdate")
public class AppUpdatePlugin extends Plugin {
    private DownloadManager downloadManager;
    private BroadcastReceiver downloadReceiver;
    private long activeDownloadId = -1L;
    private String activeDownloadPath = null;

    @Override
    public void load() {
        super.load();
        downloadManager = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
        registerDownloadReceiver();
    }

    @Override
    protected void handleOnDestroy() {
        if (downloadReceiver != null) {
            try {
                getContext().unregisterReceiver(downloadReceiver);
            } catch (Exception ignored) {
            }
        }
        super.handleOnDestroy();
    }

    @PluginMethod
    public void getCurrentVersion(PluginCall call) {
        try {
            PackageManager packageManager = getContext().getPackageManager();
            PackageInfo packageInfo = packageManager.getPackageInfo(getContext().getPackageName(), 0);

            JSObject result = new JSObject();
            result.put("packageName", packageInfo.packageName);
            result.put("versionName", packageInfo.versionName);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                result.put("versionCode", packageInfo.getLongVersionCode());
            } else {
                result.put("versionCode", packageInfo.versionCode);
            }
            result.put("canRequestPackageInstalls", canRequestPackageInstalls());
            call.resolve(result);
        } catch (Exception exception) {
            call.reject("Không thể đọc phiên bản hiện tại của app.", exception);
        }
    }

    @PluginMethod
    public void startUpdate(PluginCall call) {
        String downloadUrl = call.getString("downloadUrl");
        String fileName = call.getString("fileName", "TSrecord-update.apk");
        String title = call.getString("title", "TSrecord");

        if (downloadUrl == null || downloadUrl.trim().isEmpty()) {
            call.reject("Thiếu downloadUrl.");
            return;
        }

        try {
            if (!canRequestPackageInstalls()) {
                openUnknownSourcesSettings();
            }

            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(downloadUrl));
            request.setTitle(title);
            request.setDescription("Đang tải bản cập nhật mới...");
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            request.setMimeType("application/vnd.android.package-archive");
            request.setAllowedOverMetered(true);
            request.setAllowedOverRoaming(true);
            request.setDestinationInExternalPublicDir(
                Environment.DIRECTORY_DOWNLOADS,
                "TSrecord/" + fileName
            );

            activeDownloadId = downloadManager.enqueue(request);
            activeDownloadPath = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
                .getAbsolutePath() + File.separator + "TSrecord" + File.separator + fileName;

            JSObject result = new JSObject();
            result.put("downloadId", activeDownloadId);
            result.put("fileName", fileName);
            result.put("started", true);
            result.put("canRequestPackageInstalls", canRequestPackageInstalls());
            call.resolve(result);
        } catch (Exception exception) {
            call.reject("Không thể bắt đầu tải bản cập nhật.", exception);
        }
    }

    @PluginMethod
    public void getDownloadStatus(PluginCall call) {
        long downloadId = call.getLong("downloadId", -1L);
        if (downloadId <= 0) {
            call.reject("Thiếu downloadId hợp lệ.");
            return;
        }

        DownloadManager.Query query = new DownloadManager.Query().setFilterById(downloadId);
        try (Cursor cursor = downloadManager.query(query)) {
            if (cursor == null || !cursor.moveToFirst()) {
                call.resolve(buildStatusResult("missing", 0, 0, "", "", false));
                return;
            }

            int status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
            long downloadedBytes =
                cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR));
            long totalBytes =
                cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES));
            String localUri = getStringSafely(cursor, DownloadManager.COLUMN_LOCAL_URI);
            String reason = String.valueOf(cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON)));

            switch (status) {
                case DownloadManager.STATUS_PENDING:
                    call.resolve(buildStatusResult("pending", downloadedBytes, totalBytes, localUri, reason, false));
                    return;
                case DownloadManager.STATUS_RUNNING:
                    call.resolve(buildStatusResult("running", downloadedBytes, totalBytes, localUri, reason, false));
                    return;
                case DownloadManager.STATUS_PAUSED:
                    call.resolve(buildStatusResult("paused", downloadedBytes, totalBytes, localUri, reason, false));
                    return;
                case DownloadManager.STATUS_SUCCESSFUL:
                    call.resolve(buildStatusResult("successful", downloadedBytes, totalBytes, localUri, "", true));
                    return;
                case DownloadManager.STATUS_FAILED:
                default:
                    call.resolve(buildStatusResult("failed", downloadedBytes, totalBytes, localUri, reason, false));
            }
        } catch (Exception exception) {
            call.reject("Không thể kiểm tra trạng thái tải APK.", exception);
        }
    }

    @PluginMethod
    public void openInstaller(PluginCall call) {
        if (activeDownloadPath == null || activeDownloadPath.trim().isEmpty()) {
            call.reject("Chưa có file APK đã tải.");
            return;
        }

        try {
            openInstallerForPath(activeDownloadPath);
            call.resolve();
        } catch (Exception exception) {
            call.reject("Không thể mở màn hình cài đặt APK.", exception);
        }
    }

    private void registerDownloadReceiver() {
        downloadReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (!DownloadManager.ACTION_DOWNLOAD_COMPLETE.equals(intent.getAction())) {
                    return;
                }

                long downloadId = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1L);
                if (downloadId != activeDownloadId || activeDownloadPath == null) {
                    return;
                }

                try {
                    openInstallerForPath(activeDownloadPath);
                } catch (Exception ignored) {
                }
            }
        };

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getContext().registerReceiver(
                downloadReceiver,
                new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE),
                Context.RECEIVER_NOT_EXPORTED
            );
        } else {
            getContext().registerReceiver(
                downloadReceiver,
                new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE)
            );
        }
    }

    private boolean canRequestPackageInstalls() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return true;
        }
        return getContext().getPackageManager().canRequestPackageInstalls();
    }

    private void openUnknownSourcesSettings() {
        Intent intent = new Intent(
            Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
            Uri.parse("package:" + getContext().getPackageName())
        );
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
    }

    private void openInstallerForPath(String apkPath) {
        File apkFile = new File(apkPath);
        if (!apkFile.exists()) {
            throw new IllegalStateException("File APK không tồn tại: " + apkPath);
        }

        if (!canRequestPackageInstalls()) {
            openUnknownSourcesSettings();
            return;
        }

        Uri apkUri = FileProvider.getUriForFile(
            getContext(),
            getContext().getPackageName() + ".fileprovider",
            apkFile
        );

        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);

        try {
            getContext().startActivity(intent);
        } catch (ActivityNotFoundException exception) {
            Intent fallbackIntent = new Intent(Intent.ACTION_INSTALL_PACKAGE);
            fallbackIntent.setData(apkUri);
            fallbackIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            fallbackIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getContext().startActivity(fallbackIntent);
        }
    }

    private JSObject buildStatusResult(
        String status,
        long downloadedBytes,
        long totalBytes,
        String localUri,
        String reason,
        boolean canInstall
    ) {
        JSObject result = new JSObject();
        result.put("status", status);
        result.put("downloadedBytes", downloadedBytes);
        result.put("totalBytes", totalBytes);
        result.put("localUri", localUri);
        result.put("reason", reason);
        result.put("canInstall", canInstall);
        result.put("canRequestPackageInstalls", canRequestPackageInstalls());
        return result;
    }

    private String getStringSafely(Cursor cursor, String columnName) {
        int index = cursor.getColumnIndex(columnName);
        if (index < 0 || cursor.isNull(index)) {
            return "";
        }
        return cursor.getString(index);
    }
}
