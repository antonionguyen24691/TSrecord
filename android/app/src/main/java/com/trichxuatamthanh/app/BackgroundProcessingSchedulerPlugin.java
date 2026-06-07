package com.trichxuatamthanh.app;

import android.content.Context;
import android.content.SharedPreferences;

import androidx.annotation.NonNull;
import androidx.work.Constraints;
import androidx.work.Data;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.concurrent.TimeUnit;

@CapacitorPlugin(name = "BackgroundProcessingScheduler")
public class BackgroundProcessingSchedulerPlugin extends Plugin {
    private static final String PREFS_NAME = "tsrecord_background_resume";
    private static final String KEY_JOB_ID = "job_id";
    private static final String KEY_WORKSPACE_PATH = "workspace_path";
    private static final String KEY_STATE = "state";
    private static final String KEY_SCHEDULED_AT = "scheduled_at";
    private static final String KEY_LAST_TRIGGERED_AT = "last_triggered_at";
    private static final String KEY_DELAY_SECONDS = "delay_seconds";

    @PluginMethod
    public void scheduleProcessingResume(PluginCall call) {
        String jobId = call.getString("jobId");
        String workspacePath = call.getString("workspacePath");
        Integer delaySeconds = call.getInt("delaySeconds", 60);

        if (jobId == null || jobId.trim().isEmpty() || workspacePath == null || workspacePath.trim().isEmpty()) {
            call.reject("Missing jobId or workspacePath.");
            return;
        }

        long delay = Math.max(15, delaySeconds == null ? 60 : delaySeconds);
        SharedPreferences prefs = getPreferences();
        prefs.edit()
            .putString(KEY_JOB_ID, jobId)
            .putString(KEY_WORKSPACE_PATH, workspacePath)
            .putString(KEY_STATE, "scheduled")
            .putString(KEY_SCHEDULED_AT, String.valueOf(System.currentTimeMillis()))
            .putLong(KEY_DELAY_SECONDS, delay)
            .apply();

        Constraints constraints = new Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build();

        Data inputData = new Data.Builder()
            .putString(KEY_JOB_ID, jobId)
            .putString(KEY_WORKSPACE_PATH, workspacePath)
            .build();

        OneTimeWorkRequest request = new OneTimeWorkRequest.Builder(ResumeSignalWorker.class)
            .setInitialDelay(delay, TimeUnit.SECONDS)
            .setConstraints(constraints)
            .setInputData(inputData)
            .addTag(getUniqueWorkName(jobId))
            .build();

        WorkManager.getInstance(getContext()).enqueueUniqueWork(
            getUniqueWorkName(jobId),
            ExistingWorkPolicy.REPLACE,
            request
        );
        call.resolve();
    }

    @PluginMethod
    public void cancelProcessingResume(PluginCall call) {
        String jobId = call.getString("jobId");
        if (jobId == null || jobId.trim().isEmpty()) {
            call.reject("Missing jobId.");
            return;
        }

        WorkManager.getInstance(getContext()).cancelUniqueWork(getUniqueWorkName(jobId));
        clearStateIfMatches(jobId);
        call.resolve();
    }

    @PluginMethod
    public void getPendingResumeState(PluginCall call) {
        call.resolve(buildStatePayload());
    }

    @PluginMethod
    public void clearPendingResumeState(PluginCall call) {
        String jobId = call.getString("jobId");
        if (jobId == null || jobId.trim().isEmpty()) {
            getPreferences().edit().clear().apply();
        } else {
            clearStateIfMatches(jobId);
        }
        call.resolve();
    }

    private void clearStateIfMatches(String jobId) {
        SharedPreferences prefs = getPreferences();
        String storedJobId = prefs.getString(KEY_JOB_ID, null);
        if (storedJobId == null || !storedJobId.equals(jobId)) {
            return;
        }
        prefs.edit().clear().apply();
    }

    private JSObject buildStatePayload() {
        SharedPreferences prefs = getPreferences();
        JSObject result = new JSObject();
        result.put("jobId", prefs.getString(KEY_JOB_ID, null));
        result.put("workspacePath", prefs.getString(KEY_WORKSPACE_PATH, null));
        result.put("state", prefs.getString(KEY_STATE, null));
        result.put("scheduledAt", prefs.getString(KEY_SCHEDULED_AT, null));
        result.put("lastTriggeredAt", prefs.getString(KEY_LAST_TRIGGERED_AT, null));
        return result;
    }

    private SharedPreferences getPreferences() {
        return getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    private static String getUniqueWorkName(String jobId) {
        return "tsrecord-resume-" + jobId;
    }

    public static final class ResumeSignalWorker extends Worker {
        public ResumeSignalWorker(
            @NonNull Context context,
            @NonNull WorkerParameters params
        ) {
            super(context, params);
        }

        @NonNull
        @Override
        public Result doWork() {
            SharedPreferences prefs = getApplicationContext()
                .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String jobId = getInputData().getString(KEY_JOB_ID);
            String workspacePath = getInputData().getString(KEY_WORKSPACE_PATH);
            prefs.edit()
                .putString(KEY_JOB_ID, jobId)
                .putString(KEY_WORKSPACE_PATH, workspacePath)
                .putString(KEY_STATE, "triggered")
                .putString(KEY_LAST_TRIGGERED_AT, String.valueOf(System.currentTimeMillis()))
                .apply();
            return Result.success();
        }
    }
}
