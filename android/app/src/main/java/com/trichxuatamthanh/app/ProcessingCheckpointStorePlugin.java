package com.trichxuatamthanh.app;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;

import androidx.annotation.Nullable;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

@CapacitorPlugin(name = "ProcessingCheckpointStore")
public class ProcessingCheckpointStorePlugin extends Plugin {
    private CheckpointDbHelper dbHelper;

    @Override
    public void load() {
        super.load();
        dbHelper = new CheckpointDbHelper(getContext());
    }

    @PluginMethod
    public void upsertJob(PluginCall call) {
        JSObject job = call.getObject("job");
        if (job == null) {
            call.reject("Missing job payload.");
            return;
        }

        try (SQLiteDatabase db = dbHelper.getWritableDatabase()) {
            ContentValues values = new ContentValues();
            values.put("id", job.optString("id", ""));
            values.put("workspace_path", job.optString("workspacePath", ""));
            values.put("source_audio_path", job.optString("sourceAudioPath", ""));
            values.put("source_audio_file_name", job.optString("sourceAudioFileName", ""));
            values.put("status", job.optString("status", "pending"));
            values.put("provider", job.optString("provider", "gemini"));
            values.put("mode", job.optString("mode", "TIMELINE"));
            values.put("source", job.optString("source", "UPLOAD"));
            values.put("context", job.optString("context", "TRANSCRIPTION"));
            values.put("current_batch", job.optInt("currentBatch", 0));
            values.put("total_batches", job.optInt("totalBatches", 0));
            values.put("created_at", job.optString("createdAt", ""));
            values.put("updated_at", job.optString("updatedAt", ""));
            values.put("transcript_text_path", job.optString("transcriptTextPath", ""));
            values.put("transcript_batches_path", job.optString("transcriptBatchesPath", ""));
            values.put("micro_chunk_minutes", job.optInt("microChunkMinutes", 0));
            values.put("macro_batch_minutes", job.optInt("macroBatchMinutes", 0));
            db.insertWithOnConflict("jobs", null, values, SQLiteDatabase.CONFLICT_REPLACE);
            call.resolve();
        } catch (Exception exception) {
            call.reject("Cannot store transcript job.", exception);
        }
    }

    @PluginMethod
    public void getJob(PluginCall call) {
        String workspacePath = call.getString("workspacePath");
        if (workspacePath == null || workspacePath.trim().isEmpty()) {
            call.reject("Missing workspacePath.");
            return;
        }

        try (SQLiteDatabase db = dbHelper.getReadableDatabase()) {
            JSObject result = new JSObject();
            result.put("job", readJob(db, workspacePath));
            call.resolve(result);
        } catch (Exception exception) {
            call.reject("Cannot load transcript job.", exception);
        }
    }

    @PluginMethod
    public void upsertBatchCheckpoint(PluginCall call) {
        String workspacePath = call.getString("workspacePath");
        JSObject checkpoint = call.getObject("checkpoint");
        if (workspacePath == null || workspacePath.trim().isEmpty() || checkpoint == null) {
            call.reject("Missing checkpoint payload.");
            return;
        }

        try (SQLiteDatabase db = dbHelper.getWritableDatabase()) {
            String jobId = findJobId(db, workspacePath);
            if (jobId == null) {
                call.reject("Transcript job not found for workspace.");
                return;
            }
            ContentValues values = checkpointToValues(jobId, checkpoint);
            db.insertWithOnConflict("transcript_batches", null, values, SQLiteDatabase.CONFLICT_REPLACE);
            call.resolve();
        } catch (Exception exception) {
            call.reject("Cannot store transcript batch checkpoint.", exception);
        }
    }

    @PluginMethod
    public void getBatchCheckpoint(PluginCall call) {
        String workspacePath = call.getString("workspacePath");
        Integer batchIndex = call.getInt("batchIndex");
        if (workspacePath == null || workspacePath.trim().isEmpty() || batchIndex == null) {
            call.reject("Missing workspacePath or batchIndex.");
            return;
        }

        try (SQLiteDatabase db = dbHelper.getReadableDatabase()) {
            JSObject result = new JSObject();
            result.put("checkpoint", readCheckpoint(db, workspacePath, batchIndex));
            call.resolve(result);
        } catch (Exception exception) {
            call.reject("Cannot load transcript batch checkpoint.", exception);
        }
    }

    @PluginMethod
    public void listBatchCheckpoints(PluginCall call) {
        String workspacePath = call.getString("workspacePath");
        if (workspacePath == null || workspacePath.trim().isEmpty()) {
            call.reject("Missing workspacePath.");
            return;
        }

        try (SQLiteDatabase db = dbHelper.getReadableDatabase()) {
            JSObject result = new JSObject();
            result.put("checkpoints", readCheckpoints(db, workspacePath));
            call.resolve(result);
        } catch (Exception exception) {
            call.reject("Cannot list transcript batch checkpoints.", exception);
        }
    }

    @PluginMethod
    public void upsertTranscriptBatch(PluginCall call) {
        String workspacePath = call.getString("workspacePath");
        JSObject batch = call.getObject("batch");
        if (workspacePath == null || workspacePath.trim().isEmpty() || batch == null) {
            call.reject("Missing transcript batch payload.");
            return;
        }

        try (SQLiteDatabase db = dbHelper.getWritableDatabase()) {
            String jobId = findJobId(db, workspacePath);
            if (jobId == null) {
                call.reject("Transcript job not found for workspace.");
                return;
            }

            int batchIndex = batch.optInt("batchIndex", 0);
            ContentValues values = new ContentValues();
            values.put("job_id", jobId);
            values.put("batch_index", batchIndex);
            values.put("start_ms", batch.optLong("startMs", 0L));
            values.put("end_ms", batch.optLong("endMs", 0L));
            values.put("text", batch.optString("text", ""));

            JSObject existingCheckpoint = readCheckpoint(db, workspacePath, batchIndex);
            if (existingCheckpoint != null) {
                values.put("upload_status", existingCheckpoint.optString("uploadStatus", "uploaded"));
                values.put("transcribe_status", existingCheckpoint.optString("transcribeStatus", "done"));
                values.put("save_status", "saved");
                values.put("retry_count", existingCheckpoint.optInt("retryCount", 0));
                values.put("audio_temp_path", existingCheckpoint.optString("audioTempPath", null));
                values.put("text_path", existingCheckpoint.optString("textPath", null));
                values.put("micro_chunk_indexes", jsonArrayToString(existingCheckpoint.optJSONArray("microChunkIndexes")));
                values.put("error_message", existingCheckpoint.optString("errorMessage", null));
                values.put("updated_at", existingCheckpoint.optString("updatedAt", null));
            } else {
                values.put("upload_status", "uploaded");
                values.put("transcribe_status", "done");
                values.put("save_status", "saved");
                values.put("retry_count", 0);
            }

            db.insertWithOnConflict("transcript_batches", null, values, SQLiteDatabase.CONFLICT_REPLACE);
            call.resolve();
        } catch (Exception exception) {
            call.reject("Cannot store transcript batch.", exception);
        }
    }

    @PluginMethod
    public void listTranscriptBatches(PluginCall call) {
        String workspacePath = call.getString("workspacePath");
        if (workspacePath == null || workspacePath.trim().isEmpty()) {
            call.reject("Missing workspacePath.");
            return;
        }

        try (SQLiteDatabase db = dbHelper.getReadableDatabase()) {
            JSObject result = new JSObject();
            result.put("batches", readTranscriptBatches(db, workspacePath));
            call.resolve(result);
        } catch (Exception exception) {
            call.reject("Cannot list transcript batches.", exception);
        }
    }

    @PluginMethod
    public void summarizeProgress(PluginCall call) {
        String workspacePath = call.getString("workspacePath");
        if (workspacePath == null || workspacePath.trim().isEmpty()) {
            call.reject("Missing workspacePath.");
            return;
        }

        try (SQLiteDatabase db = dbHelper.getReadableDatabase()) {
            JSObject summary = new JSObject();
            int savedBatchCount = 0;
            int failedBatchCount = 0;
            Integer lastFailedBatchIndex = null;
            String lastErrorMessage = null;

            try (Cursor cursor = db.rawQuery(
                "SELECT batch_index, save_status, error_message FROM transcript_batches tb " +
                    "INNER JOIN jobs j ON j.id = tb.job_id " +
                    "WHERE j.workspace_path = ? ORDER BY tb.batch_index ASC",
                new String[]{workspacePath}
            )) {
                while (cursor.moveToNext()) {
                    String saveStatus = cursor.getString(cursor.getColumnIndexOrThrow("save_status"));
                    if ("saved".equals(saveStatus)) {
                        savedBatchCount += 1;
                    }
                    if ("failed".equals(saveStatus)) {
                        failedBatchCount += 1;
                        lastFailedBatchIndex = cursor.getInt(cursor.getColumnIndexOrThrow("batch_index"));
                        lastErrorMessage = cursor.getString(cursor.getColumnIndexOrThrow("error_message"));
                    }
                }
            }

            summary.put("savedBatchCount", savedBatchCount);
            summary.put("failedBatchCount", failedBatchCount);
            summary.put("lastFailedBatchIndex", lastFailedBatchIndex == null ? JSONObject.NULL : lastFailedBatchIndex);
            summary.put("lastErrorMessage", lastErrorMessage == null ? JSONObject.NULL : lastErrorMessage);
            call.resolve(summary);
        } catch (Exception exception) {
            call.reject("Cannot summarize transcript progress.", exception);
        }
    }

    @Nullable
    private String findJobId(SQLiteDatabase db, String workspacePath) {
        try (Cursor cursor = db.query(
            "jobs",
            new String[]{"id"},
            "workspace_path = ?",
            new String[]{workspacePath},
            null,
            null,
            null,
            "1"
        )) {
            if (cursor.moveToFirst()) {
                return cursor.getString(cursor.getColumnIndexOrThrow("id"));
            }
        }
        return null;
    }

    @Nullable
    private JSObject readJob(SQLiteDatabase db, String workspacePath) throws JSONException {
        try (Cursor cursor = db.query(
            "jobs",
            null,
            "workspace_path = ?",
            new String[]{workspacePath},
            null,
            null,
            null,
            "1"
        )) {
            if (!cursor.moveToFirst()) {
                return null;
            }

            JSObject job = new JSObject();
            job.put("id", cursor.getString(cursor.getColumnIndexOrThrow("id")));
            job.put("workspacePath", cursor.getString(cursor.getColumnIndexOrThrow("workspace_path")));
            job.put("sourceAudioPath", cursor.getString(cursor.getColumnIndexOrThrow("source_audio_path")));
            job.put("sourceAudioFileName", cursor.getString(cursor.getColumnIndexOrThrow("source_audio_file_name")));
            job.put("status", cursor.getString(cursor.getColumnIndexOrThrow("status")));
            job.put("provider", cursor.getString(cursor.getColumnIndexOrThrow("provider")));
            job.put("mode", cursor.getString(cursor.getColumnIndexOrThrow("mode")));
            job.put("source", cursor.getString(cursor.getColumnIndexOrThrow("source")));
            job.put("context", cursor.getString(cursor.getColumnIndexOrThrow("context")));
            job.put("currentBatch", cursor.getInt(cursor.getColumnIndexOrThrow("current_batch")));
            job.put("totalBatches", cursor.getInt(cursor.getColumnIndexOrThrow("total_batches")));
            job.put("createdAt", cursor.getString(cursor.getColumnIndexOrThrow("created_at")));
            job.put("updatedAt", cursor.getString(cursor.getColumnIndexOrThrow("updated_at")));
            job.put("transcriptTextPath", cursor.getString(cursor.getColumnIndexOrThrow("transcript_text_path")));
            job.put("transcriptBatchesPath", cursor.getString(cursor.getColumnIndexOrThrow("transcript_batches_path")));
            job.put("microChunkMinutes", cursor.getInt(cursor.getColumnIndexOrThrow("micro_chunk_minutes")));
            job.put("macroBatchMinutes", cursor.getInt(cursor.getColumnIndexOrThrow("macro_batch_minutes")));
            return job;
        }
    }

    @Nullable
    private JSObject readCheckpoint(SQLiteDatabase db, String workspacePath, int batchIndex) throws JSONException {
        try (Cursor cursor = db.rawQuery(
            "SELECT tb.* FROM transcript_batches tb " +
                "INNER JOIN jobs j ON j.id = tb.job_id " +
                "WHERE j.workspace_path = ? AND tb.batch_index = ? LIMIT 1",
            new String[]{workspacePath, String.valueOf(batchIndex)}
        )) {
            if (!cursor.moveToFirst()) {
                return null;
            }
            return cursorToCheckpoint(cursor);
        }
    }

    private JSArray readCheckpoints(SQLiteDatabase db, String workspacePath) throws JSONException {
        JSArray checkpoints = new JSArray();
        try (Cursor cursor = db.rawQuery(
            "SELECT tb.* FROM transcript_batches tb " +
                "INNER JOIN jobs j ON j.id = tb.job_id " +
                "WHERE j.workspace_path = ? ORDER BY tb.batch_index ASC",
            new String[]{workspacePath}
        )) {
            while (cursor.moveToNext()) {
                checkpoints.put(cursorToCheckpoint(cursor));
            }
        }
        return checkpoints;
    }

    private JSArray readTranscriptBatches(SQLiteDatabase db, String workspacePath) throws JSONException {
        JSArray batches = new JSArray();
        try (Cursor cursor = db.rawQuery(
            "SELECT tb.batch_index, tb.start_ms, tb.end_ms, tb.text FROM transcript_batches tb " +
                "INNER JOIN jobs j ON j.id = tb.job_id " +
                "WHERE j.workspace_path = ? AND COALESCE(tb.text, '') <> '' AND tb.save_status = 'saved' " +
                "ORDER BY tb.batch_index ASC",
            new String[]{workspacePath}
        )) {
            while (cursor.moveToNext()) {
                JSObject batch = new JSObject();
                batch.put("batchIndex", cursor.getInt(cursor.getColumnIndexOrThrow("batch_index")));
                batch.put("startMs", cursor.getLong(cursor.getColumnIndexOrThrow("start_ms")));
                batch.put("endMs", cursor.getLong(cursor.getColumnIndexOrThrow("end_ms")));
                batch.put("text", cursor.getString(cursor.getColumnIndexOrThrow("text")));
                batches.put(batch);
            }
        }
        return batches;
    }

    private JSObject cursorToCheckpoint(Cursor cursor) throws JSONException {
        JSObject checkpoint = new JSObject();
        checkpoint.put("batchIndex", cursor.getInt(cursor.getColumnIndexOrThrow("batch_index")));
        checkpoint.put("microChunkIndexes", parseArray(cursor.getString(cursor.getColumnIndexOrThrow("micro_chunk_indexes"))));
        checkpoint.put("startMs", cursor.getLong(cursor.getColumnIndexOrThrow("start_ms")));
        checkpoint.put("endMs", cursor.getLong(cursor.getColumnIndexOrThrow("end_ms")));
        checkpoint.put("uploadStatus", cursor.getString(cursor.getColumnIndexOrThrow("upload_status")));
        checkpoint.put("transcribeStatus", cursor.getString(cursor.getColumnIndexOrThrow("transcribe_status")));
        checkpoint.put("saveStatus", cursor.getString(cursor.getColumnIndexOrThrow("save_status")));
        checkpoint.put("retryCount", cursor.getInt(cursor.getColumnIndexOrThrow("retry_count")));
        checkpoint.put("audioTempPath", nullableString(cursor, "audio_temp_path"));
        checkpoint.put("textPath", nullableString(cursor, "text_path"));
        checkpoint.put("errorMessage", nullableString(cursor, "error_message"));
        checkpoint.put("updatedAt", nullableString(cursor, "updated_at"));
        return checkpoint;
    }

    private ContentValues checkpointToValues(String jobId, JSObject checkpoint) throws JSONException {
        ContentValues values = new ContentValues();
        values.put("job_id", jobId);
        values.put("batch_index", checkpoint.optInt("batchIndex", 0));
        values.put("micro_chunk_indexes", jsonArrayToString(checkpoint.optJSONArray("microChunkIndexes")));
        values.put("start_ms", checkpoint.optLong("startMs", 0L));
        values.put("end_ms", checkpoint.optLong("endMs", 0L));
        values.put("audio_temp_path", checkpoint.optString("audioTempPath", null));
        values.put("text_path", checkpoint.optString("textPath", null));
        values.put("upload_status", checkpoint.optString("uploadStatus", "pending"));
        values.put("transcribe_status", checkpoint.optString("transcribeStatus", "pending"));
        values.put("save_status", checkpoint.optString("saveStatus", "pending"));
        values.put("retry_count", checkpoint.optInt("retryCount", 0));
        values.put("error_message", checkpoint.optString("errorMessage", null));
        values.put("updated_at", checkpoint.optString("updatedAt", null));
        return values;
    }

    private String jsonArrayToString(@Nullable JSONArray array) {
        return array == null ? "[]" : array.toString();
    }

    private JSArray parseArray(@Nullable String raw) {
        if (raw == null || raw.trim().isEmpty()) {
            return new JSArray();
        }
        try {
            return new JSArray(raw);
        } catch (JSONException ignored) {
            return new JSArray();
        }
    }

    @Nullable
    private Object nullableString(Cursor cursor, String columnName) {
        int index = cursor.getColumnIndex(columnName);
        if (index < 0 || cursor.isNull(index)) {
            return JSONObject.NULL;
        }
        return cursor.getString(index);
    }

    private static final class CheckpointDbHelper extends SQLiteOpenHelper {
        private static final String DB_NAME = "tsrecord_processing.db";
        private static final int DB_VERSION = 1;

        private CheckpointDbHelper(Context context) {
            super(context, DB_NAME, null, DB_VERSION);
        }

        @Override
        public void onCreate(SQLiteDatabase db) {
            db.execSQL(
                "CREATE TABLE jobs (" +
                    "id TEXT PRIMARY KEY," +
                    "workspace_path TEXT NOT NULL UNIQUE," +
                    "source_audio_path TEXT NOT NULL," +
                    "source_audio_file_name TEXT NOT NULL," +
                    "status TEXT NOT NULL," +
                    "provider TEXT NOT NULL," +
                    "mode TEXT NOT NULL," +
                    "source TEXT NOT NULL," +
                    "context TEXT NOT NULL," +
                    "current_batch INTEGER NOT NULL DEFAULT 0," +
                    "total_batches INTEGER NOT NULL DEFAULT 0," +
                    "created_at TEXT NOT NULL," +
                    "updated_at TEXT NOT NULL," +
                    "transcript_text_path TEXT NOT NULL," +
                    "transcript_batches_path TEXT NOT NULL," +
                    "micro_chunk_minutes INTEGER NOT NULL DEFAULT 0," +
                    "macro_batch_minutes INTEGER NOT NULL DEFAULT 0" +
                ")"
            );

            db.execSQL(
                "CREATE TABLE transcript_batches (" +
                    "id INTEGER PRIMARY KEY AUTOINCREMENT," +
                    "job_id TEXT NOT NULL," +
                    "batch_index INTEGER NOT NULL," +
                    "micro_chunk_indexes TEXT," +
                    "start_ms INTEGER NOT NULL," +
                    "end_ms INTEGER NOT NULL," +
                    "audio_temp_path TEXT," +
                    "text_path TEXT," +
                    "upload_status TEXT NOT NULL," +
                    "transcribe_status TEXT NOT NULL," +
                    "save_status TEXT NOT NULL," +
                    "retry_count INTEGER NOT NULL DEFAULT 0," +
                    "text TEXT," +
                    "error_message TEXT," +
                    "updated_at TEXT," +
                    "FOREIGN KEY(job_id) REFERENCES jobs(id)," +
                    "UNIQUE(job_id, batch_index) ON CONFLICT REPLACE" +
                ")"
            );
        }

        @Override
        public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
            db.execSQL("DROP TABLE IF EXISTS transcript_batches");
            db.execSQL("DROP TABLE IF EXISTS jobs");
            onCreate(db);
        }
    }
}
