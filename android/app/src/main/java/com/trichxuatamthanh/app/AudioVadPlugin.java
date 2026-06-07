package com.trichxuatamthanh.app;

import android.content.Context;
import android.media.MediaCodec;
import android.media.MediaExtractor;
import android.media.MediaFormat;
import android.net.Uri;
import android.os.Build;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.konovalov.vad.webrtc.VadWebRTC;
import com.konovalov.vad.webrtc.config.FrameSize;
import com.konovalov.vad.webrtc.config.Mode;
import com.konovalov.vad.webrtc.config.SampleRate;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileDescriptor;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.RandomAccessFile;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@CapacitorPlugin(name = "AudioVad")
public class AudioVadPlugin extends Plugin {
    private static final int TARGET_SAMPLE_RATE = 16000;
    private static final int BYTES_PER_SAMPLE = 2;
    private static final int TARGET_FRAME_SIZE = 320;
    private static final double FRAME_DURATION_SECONDS = TARGET_FRAME_SIZE / 16000.0;
    private static final int SEARCH_RADIUS_SECONDS = 45;
    private static final int MIN_CHUNK_DURATION_SECONDS = 60;
    private static final double EDGE_SPEECH_PADDING_SECONDS = 1.5;
    private static final int STREAM_BUFFER_SIZE = 65536;

    // ── Result wrapper for file-backed decode ────────────────────────────

    private static class DecodeResult {
        final File file;
        final long sampleCount;
        final int sampleRate;

        DecodeResult(File file, long sampleCount, int sampleRate) {
            this.file = file;
            this.sampleCount = sampleCount;
            this.sampleRate = sampleRate;
        }
    }

    private static class SpeechAnalysisResult {
        final boolean[] speechFlags;
        final int frameCount;
        final long totalSamples;
        final double totalDurationSeconds;

        SpeechAnalysisResult(
            boolean[] speechFlags,
            int frameCount,
            long totalSamples,
            double totalDurationSeconds
        ) {
            this.speechFlags = speechFlags;
            this.frameCount = frameCount;
            this.totalSamples = totalSamples;
            this.totalDurationSeconds = totalDurationSeconds;
        }
    }

    private static class SampleRange {
        final long startSample;
        final long endSample;

        SampleRange(long startSample, long endSample) {
            this.startSample = startSample;
            this.endSample = endSample;
        }
    }

    // ── Plugin Methods ───────────────────────────────────────────────────

    @PluginMethod
    public void detectSpeechBoundaries(PluginCall call) {
        String fileUri = call.getString("fileUri");
        int chunkDurationSeconds = call.getInt("chunkDurationSeconds", 600);

        if (fileUri == null || fileUri.trim().isEmpty()) {
            call.reject("Thiếu fileUri.");
            return;
        }

        File monoTempFile = null;
        File mono16kFile = null;

        try {
            DecodeResult decoded = decodeToMonoTempFile(fileUri);
            monoTempFile = decoded.file;

            mono16kFile = resampleTempFileTo16k(monoTempFile, decoded.sampleRate);
            if (mono16kFile != monoTempFile) {
                deleteSilently(monoTempFile);
            }
            monoTempFile = null;

            SpeechAnalysisResult speechAnalysis = analyzeSpeechFromFile(mono16kFile);
            List<Double> boundaries = buildSpeechAwareBoundariesFromAnalysis(speechAnalysis, chunkDurationSeconds);

            JSArray boundaryArray = new JSArray();
            for (Double boundary : boundaries) {
                boundaryArray.put(boundary);
            }

            JSObject result = new JSObject();
            result.put("sampleRate", TARGET_SAMPLE_RATE);
            result.put("durationSeconds", speechAnalysis.totalDurationSeconds);
            result.put("boundariesSeconds", boundaryArray);
            call.resolve(result);
        } catch (Exception exception) {
            call.reject("Không thể phân tích VAD cho file audio.", exception);
        } finally {
            deleteSilently(monoTempFile);
            deleteSilently(mono16kFile);
        }
    }

    @PluginMethod
    public void deleteTempFiles(PluginCall call) {
        JSArray fileUris = call.getArray("fileUris");
        if (fileUris == null) {
            call.resolve();
            return;
        }

        try {
            for (int index = 0; index < fileUris.length(); index += 1) {
                String rawUri = fileUris.optString(index, "");
                if (rawUri == null || rawUri.trim().isEmpty()) {
                    continue;
                }
                Uri uri = Uri.parse(rawUri);
                if (!"file".equalsIgnoreCase(uri.getScheme())) {
                    continue;
                }
                File file = new File(uri.getPath());
                deleteSilently(file);
                File parent = file.getParentFile();
                if (parent != null) {
                    deleteIfEmpty(parent);
                }
            }
            call.resolve();
        } catch (Exception exception) {
            call.reject("Không thể dọn file audio tạm.", exception);
        }
    }

    @PluginMethod
    public void mergeWavFiles(PluginCall call) {
        JSArray fileUris = call.getArray("fileUris");
        String outputFileName = call.getString("outputFileName", "merged-batch.wav");

        if (fileUris == null || fileUris.length() == 0) {
            call.reject("Thiếu fileUris để gộp.");
            return;
        }

        File outputDirectory = new File(
            getContext().getCacheDir(),
            "audio-merged/" + UUID.randomUUID()
        );

        try {
            if (!outputDirectory.exists() && !outputDirectory.mkdirs()) {
                throw new IOException("Không thể tạo thư mục merged audio tạm.");
            }

            File outputFile = new File(outputDirectory, sanitizeWavFileName(outputFileName));
            mergeWaveFilesFromUris(fileUris, outputFile);

            JSObject result = new JSObject();
            result.put("fileUri", Uri.fromFile(outputFile).toString());
            result.put("fileName", outputFile.getName());
            call.resolve(result);
        } catch (Exception exception) {
            deleteSilently(outputDirectory);
            call.reject("Không thể gộp audio batch trên Android.", exception);
        }
    }

    @PluginMethod
    public void splitIntoSpeechChunks(PluginCall call) {
        String fileUri = call.getString("fileUri");
        int chunkDurationSeconds = call.getInt("chunkDurationSeconds", 600);
        boolean speechOnlyUpload = Boolean.TRUE.equals(call.getBoolean("speechOnlyUpload", false));

        if (fileUri == null || fileUri.trim().isEmpty()) {
            call.reject("Thiếu fileUri.");
            return;
        }

        File monoTempFile = null;
        File mono16kFile = null;

        try {
            DecodeResult decoded = decodeToMonoTempFile(fileUri);
            monoTempFile = decoded.file;

            mono16kFile = resampleTempFileTo16k(monoTempFile, decoded.sampleRate);
            if (mono16kFile != monoTempFile) {
                deleteSilently(monoTempFile);
            }
            monoTempFile = null;

            SpeechAnalysisResult speechAnalysis = analyzeSpeechFromFile(mono16kFile);
            List<Double> boundaries = buildSpeechAwareBoundariesFromAnalysis(speechAnalysis, chunkDurationSeconds);

            String baseName = getBaseName(call.getString("fileName", "audio"));
            File outputDirectory = new File(
                getContext().getCacheDir(),
                "audio-chunks/" + UUID.randomUUID()
            );

            if (!outputDirectory.exists() && !outputDirectory.mkdirs()) {
                throw new IOException("Không thể tạo thư mục chunk audio tạm.");
            }

            JSArray chunks = new JSArray();
            int total = Math.max(0, boundaries.size() - 1);

            for (int index = 0; index < total; index += 1) {
                double[] trimmedRange = tightenChunkRangeToSpeech(
                    speechAnalysis,
                    boundaries.get(index),
                    boundaries.get(index + 1)
                );
                double startSeconds = trimmedRange[0];
                double endSeconds = trimmedRange[1];
                long startSample = Math.max(0, (long) Math.floor(startSeconds * TARGET_SAMPLE_RATE));
                long endSample = Math.min(
                    speechAnalysis.totalSamples,
                    (long) Math.ceil(endSeconds * TARGET_SAMPLE_RATE)
                );
                if (endSample <= startSample) {
                    continue;
                }

                String fileName = String.format(
                    Locale.US,
                    "%s-part-%02d.wav",
                    baseName,
                    index + 1
                );
                File chunkFile = new File(outputDirectory, fileName);
                if (speechOnlyUpload) {
                    writeSpeechOnlyWavChunkFromFile(
                        mono16kFile,
                        chunkFile,
                        speechAnalysis,
                        startSeconds,
                        endSeconds,
                        startSample,
                        endSample
                    );
                } else {
                    writeWavChunkFromFile(mono16kFile, chunkFile, startSample, endSample);
                }

                JSObject chunk = new JSObject();
                chunk.put("index", index);
                chunk.put("total", total);
                chunk.put("startSeconds", startSeconds);
                chunk.put("endSeconds", endSeconds);
                chunk.put("fileUri", Uri.fromFile(chunkFile).toString());
                chunk.put("fileName", fileName);
                chunks.put(chunk);
            }

            JSObject result = new JSObject();
            result.put("sampleRate", TARGET_SAMPLE_RATE);
            result.put("durationSeconds", speechAnalysis.totalDurationSeconds);
            result.put("chunks", chunks);
            call.resolve(result);
        } catch (Exception exception) {
            call.reject("Không thể chia audio thành các phần nhỏ trên Android.", exception);
        } finally {
            deleteSilently(monoTempFile);
            deleteSilently(mono16kFile);
        }
    }

    // ── Phase 1: Decode → mono PCM temp file (at source sample rate) ─────
    //
    // Instead of accumulating ALL decoded PCM in ByteArrayOutputStream (~350MB+),
    // each output buffer from MediaCodec is immediately downmixed to mono
    // and written to a temp file on disk. Peak memory: ~16KB (one output buffer).

    private DecodeResult decodeToMonoTempFile(String fileUri) throws Exception {
        MediaExtractor extractor = new MediaExtractor();
        MediaCodec codec = null;
        File tempFile = File.createTempFile("mono-pcm-", ".raw", getContext().getCacheDir());

        try {
            setExtractorSource(extractor, fileUri);
            int trackIndex = findAudioTrack(extractor);
            if (trackIndex < 0) {
                throw new IllegalStateException("Không tìm thấy audio track trong file.");
            }

            extractor.selectTrack(trackIndex);
            MediaFormat format = extractor.getTrackFormat(trackIndex);
            String mime = format.getString(MediaFormat.KEY_MIME);
            if (mime == null) {
                throw new IllegalStateException("Không đọc được MIME type của audio.");
            }

            int sourceSampleRate = format.containsKey(MediaFormat.KEY_SAMPLE_RATE)
                ? format.getInteger(MediaFormat.KEY_SAMPLE_RATE)
                : TARGET_SAMPLE_RATE;
            int sourceChannelCount = format.containsKey(MediaFormat.KEY_CHANNEL_COUNT)
                ? format.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
                : 1;

            codec = MediaCodec.createDecoderByType(mime);
            codec.configure(format, null, null, 0);
            codec.start();

            long totalMonoSamples = 0;
            MediaCodec.BufferInfo bufferInfo = new MediaCodec.BufferInfo();
            boolean inputDone = false;
            boolean outputDone = false;
            byte[] monoSampleBytes = new byte[BYTES_PER_SAMPLE];

            try (BufferedOutputStream bos = new BufferedOutputStream(
                     new FileOutputStream(tempFile), STREAM_BUFFER_SIZE)) {

                while (!outputDone) {
                    if (!inputDone) {
                        int inputBufferIndex = codec.dequeueInputBuffer(10_000);
                        if (inputBufferIndex >= 0) {
                            ByteBuffer inputBuffer = codec.getInputBuffer(inputBufferIndex);
                            if (inputBuffer == null) {
                                throw new IllegalStateException("Không lấy được input buffer cho decoder.");
                            }
                            int sampleSize = extractor.readSampleData(inputBuffer, 0);
                            if (sampleSize < 0) {
                                codec.queueInputBuffer(
                                    inputBufferIndex, 0, 0, 0,
                                    MediaCodec.BUFFER_FLAG_END_OF_STREAM
                                );
                                inputDone = true;
                            } else {
                                codec.queueInputBuffer(
                                    inputBufferIndex, 0, sampleSize,
                                    extractor.getSampleTime(), 0
                                );
                                extractor.advance();
                            }
                        }
                    }

                    int outputBufferIndex = codec.dequeueOutputBuffer(bufferInfo, 10_000);
                    if (outputBufferIndex >= 0) {
                        ByteBuffer outputBuffer = codec.getOutputBuffer(outputBufferIndex);
                        if (outputBuffer != null && bufferInfo.size > 0) {
                            int chunkSize = bufferInfo.size;
                            byte[] chunk = new byte[chunkSize];
                            outputBuffer.position(bufferInfo.offset);
                            outputBuffer.limit(bufferInfo.offset + chunkSize);
                            outputBuffer.get(chunk);

                            int shortCount = chunkSize / BYTES_PER_SAMPLE;

                            if (sourceChannelCount <= 1) {
                                // Already mono — write raw PCM bytes directly to file
                                int usableBytes = shortCount * BYTES_PER_SAMPLE;
                                bos.write(chunk, 0, usableBytes);
                                totalMonoSamples += shortCount;
                            } else {
                                // Multi-channel — downmix to mono inline, write to file
                                int frameCount = shortCount / sourceChannelCount;
                                int usableBytes = frameCount * sourceChannelCount * BYTES_PER_SAMPLE;
                                ByteBuffer chunkBuffer = ByteBuffer.wrap(chunk, 0, usableBytes)
                                    .order(ByteOrder.LITTLE_ENDIAN);

                                for (int frame = 0; frame < frameCount; frame += 1) {
                                    int sum = 0;
                                    for (int ch = 0; ch < sourceChannelCount; ch += 1) {
                                        sum += chunkBuffer.getShort();
                                    }
                                    short monoSample = (short) (sum / sourceChannelCount);
                                    monoSampleBytes[0] = (byte) (monoSample & 0xff);
                                    monoSampleBytes[1] = (byte) ((monoSample >> 8) & 0xff);
                                    bos.write(monoSampleBytes);
                                }
                                totalMonoSamples += frameCount;
                            }
                        }

                        codec.releaseOutputBuffer(outputBufferIndex, false);
                        if ((bufferInfo.flags & MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) {
                            outputDone = true;
                        }
                    } else if (outputBufferIndex == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
                        MediaFormat outputFormat = codec.getOutputFormat();
                        if (outputFormat.containsKey(MediaFormat.KEY_SAMPLE_RATE)) {
                            sourceSampleRate = outputFormat.getInteger(MediaFormat.KEY_SAMPLE_RATE);
                        }
                        if (outputFormat.containsKey(MediaFormat.KEY_CHANNEL_COUNT)) {
                            sourceChannelCount = outputFormat.getInteger(MediaFormat.KEY_CHANNEL_COUNT);
                        }
                    }
                }
            }

            return new DecodeResult(tempFile, totalMonoSamples, sourceSampleRate);
        } catch (Exception error) {
            deleteSilently(tempFile);
            throw error;
        } finally {
            try {
                extractor.release();
            } catch (Exception ignored) {
            }

            if (codec != null) {
                try {
                    codec.stop();
                } catch (Exception ignored) {
                }
                try {
                    codec.release();
                } catch (Exception ignored) {
                }
            }
        }
    }

    // ── Phase 2: Streaming resample file → 16 kHz file ───────────────────
    //
    // Reads the mono PCM temp file in 64KB chunks, averages samples in each
    // resampling window, and writes the 16kHz output to a second temp file.
    // Peak memory: ~128KB (read buffer + write buffer).

    private File resampleTempFileTo16k(File monoSourceFile, int sourceSampleRate) throws IOException {
        if (sourceSampleRate <= 0 || sourceSampleRate == TARGET_SAMPLE_RATE) {
            return monoSourceFile;
        }

        File resampledFile = File.createTempFile("pcm16k-", ".raw", getContext().getCacheDir());
        double ratio = sourceSampleRate / (double) TARGET_SAMPLE_RATE;

        int bufferSamples = 32768;
        byte[] readBuffer = new byte[bufferSamples * BYTES_PER_SAMPLE];
        byte[] sampleOut = new byte[BYTES_PER_SAMPLE];

        try (BufferedInputStream bis = new BufferedInputStream(
                 new FileInputStream(monoSourceFile), STREAM_BUFFER_SIZE);
             BufferedOutputStream bos = new BufferedOutputStream(
                 new FileOutputStream(resampledFile), STREAM_BUFFER_SIZE)) {

            long accumulatorSum = 0;
            int accumulatorCount = 0;
            long sourceSamplePos = 0;
            long outputCount = 0;
            long nextEmitAt = Math.round(ratio);

            while (true) {
                int bytesRead = bis.read(readBuffer);
                if (bytesRead <= 0) break;

                int samplesInBuffer = bytesRead / BYTES_PER_SAMPLE;

                for (int i = 0; i < samplesInBuffer; i += 1) {
                    int offset = i * BYTES_PER_SAMPLE;
                    short sample = (short) ((readBuffer[offset] & 0xff) | (readBuffer[offset + 1] << 8));

                    accumulatorSum += sample;
                    accumulatorCount += 1;
                    sourceSamplePos += 1;

                    if (sourceSamplePos >= nextEmitAt) {
                        short outputSample = (short) (accumulatorSum / Math.max(1, accumulatorCount));
                        sampleOut[0] = (byte) (outputSample & 0xff);
                        sampleOut[1] = (byte) ((outputSample >> 8) & 0xff);
                        bos.write(sampleOut);

                        accumulatorSum = 0;
                        accumulatorCount = 0;
                        outputCount += 1;
                        nextEmitAt = Math.round((outputCount + 1) * ratio);
                    }
                }
            }

            // Flush remaining accumulated samples
            if (accumulatorCount > 0) {
                short outputSample = (short) (accumulatorSum / accumulatorCount);
                sampleOut[0] = (byte) (outputSample & 0xff);
                sampleOut[1] = (byte) ((outputSample >> 8) & 0xff);
                bos.write(sampleOut);
            }
        } catch (IOException error) {
            deleteSilently(resampledFile);
            throw error;
        }

        return resampledFile;
    }

    // ── Phase 3: File-backed VAD boundary detection ──────────────────────
    //
    // Reads the 16kHz mono PCM temp file in frame-sized chunks (~640 bytes each)
    // and runs WebRTC VAD on each frame. Peak memory: ~frame buffer + boolean flags array.
    // For 33 minutes: ~99K frames = ~99KB for the flags.

    private SpeechAnalysisResult analyzeSpeechFromFile(File mono16kFile) throws Exception {
        long fileSize = mono16kFile.length();
        long totalSamples = fileSize / BYTES_PER_SAMPLE;
        double totalDurationSeconds = totalSamples / (double) TARGET_SAMPLE_RATE;
        int samplesPerFrame = TARGET_FRAME_SIZE;
        int bytesPerFrame = samplesPerFrame * BYTES_PER_SAMPLE;
        int frameCount = (int) (totalSamples / samplesPerFrame);
        boolean[] speechFlags = new boolean[frameCount];

        VadWebRTC vad = new VadWebRTC(
            SampleRate.SAMPLE_RATE_16K,
            FrameSize.FRAME_SIZE_320,
            Mode.VERY_AGGRESSIVE,
            0,
            0
        );

        try {
            // Read file sequentially in frame-sized chunks for VAD analysis
            try (BufferedInputStream bis = new BufferedInputStream(
                     new FileInputStream(mono16kFile), STREAM_BUFFER_SIZE)) {

                byte[] frameBytes = new byte[bytesPerFrame];

                for (int frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
                    int totalRead = 0;
                    while (totalRead < bytesPerFrame) {
                        int read = bis.read(frameBytes, totalRead, bytesPerFrame - totalRead);
                        if (read <= 0) break;
                        totalRead += read;
                    }
                    if (totalRead < bytesPerFrame) break;

                    speechFlags[frameIndex] = vad.isSpeech(frameBytes);
                }
            }

            return new SpeechAnalysisResult(
                speechFlags,
                frameCount,
                totalSamples,
                totalDurationSeconds
            );
        } finally {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
                    vad.close();
                }
            } catch (Exception ignored) {
            }
        }
    }

    private List<Double> buildSpeechAwareBoundariesFromAnalysis(
        SpeechAnalysisResult analysis,
        int chunkDurationSeconds
    ) {
        int minChunkFrames = Math.max(
            1,
            (int) Math.floor(
                Math.min(
                    chunkDurationSeconds / 2.0,
                    Math.max(MIN_CHUNK_DURATION_SECONDS, chunkDurationSeconds * 0.35)
                ) / FRAME_DURATION_SECONDS
            )
        );
        int searchRadiusFrames = Math.max(
            1,
            (int) Math.floor(SEARCH_RADIUS_SECONDS / FRAME_DURATION_SECONDS)
        );

        List<Double> boundaries = new ArrayList<>();
        boundaries.add(0.0);
        int previousBoundaryFrame = 0;
        double targetSeconds = chunkDurationSeconds;

        while (targetSeconds < analysis.totalDurationSeconds - MIN_CHUNK_DURATION_SECONDS) {
            int targetFrame = (int) Math.floor(targetSeconds / FRAME_DURATION_SECONDS);
            int searchStart = Math.max(
                previousBoundaryFrame + minChunkFrames,
                targetFrame - searchRadiusFrames
            );
            int searchEnd = Math.min(
                analysis.frameCount - minChunkFrames,
                targetFrame + searchRadiusFrames
            );

            int bestFrame = -1;
            int bestDistance = Integer.MAX_VALUE;
            for (int frameIndex = searchStart; frameIndex <= searchEnd; frameIndex += 1) {
                if (!analysis.speechFlags[frameIndex]) {
                    int distance = Math.abs(frameIndex - targetFrame);
                    if (distance < bestDistance) {
                        bestDistance = distance;
                        bestFrame = frameIndex;
                    }
                }
            }

            if (bestFrame < 0) {
                bestFrame = Math.min(searchEnd, Math.max(searchStart, targetFrame));
            }

            double boundarySeconds = bestFrame * FRAME_DURATION_SECONDS;
            double previousBoundarySeconds = boundaries.get(boundaries.size() - 1);
            if (boundarySeconds <= previousBoundarySeconds + MIN_CHUNK_DURATION_SECONDS) {
                targetSeconds += chunkDurationSeconds;
                continue;
            }

            boundaries.add(boundarySeconds);
            previousBoundaryFrame = bestFrame;
            targetSeconds = boundarySeconds + chunkDurationSeconds;
        }

        boundaries.add(analysis.totalDurationSeconds);
        return boundaries;
    }

    private double[] tightenChunkRangeToSpeech(
        SpeechAnalysisResult analysis,
        double originalStartSeconds,
        double originalEndSeconds
    ) {
        int startFrame = Math.max(0, (int) Math.floor(originalStartSeconds / FRAME_DURATION_SECONDS));
        int endFrame = Math.min(
            analysis.frameCount,
            (int) Math.ceil(originalEndSeconds / FRAME_DURATION_SECONDS)
        );

        int firstSpeechFrame = -1;
        int lastSpeechFrame = -1;

        for (int frameIndex = startFrame; frameIndex < endFrame; frameIndex += 1) {
            if (!analysis.speechFlags[frameIndex]) {
                continue;
            }
            if (firstSpeechFrame < 0) {
                firstSpeechFrame = frameIndex;
            }
            lastSpeechFrame = frameIndex;
        }

        if (firstSpeechFrame < 0 || lastSpeechFrame < 0) {
            return new double[] { originalStartSeconds, originalEndSeconds };
        }

        int paddingFrames = Math.max(
            1,
            (int) Math.round(EDGE_SPEECH_PADDING_SECONDS / FRAME_DURATION_SECONDS)
        );
        int trimmedStartFrame = Math.max(startFrame, firstSpeechFrame - paddingFrames);
        int trimmedEndFrame = Math.min(endFrame, lastSpeechFrame + paddingFrames + 1);

        double trimmedStartSeconds = trimmedStartFrame * FRAME_DURATION_SECONDS;
        double trimmedEndSeconds = trimmedEndFrame * FRAME_DURATION_SECONDS;

        if (trimmedEndSeconds <= trimmedStartSeconds) {
            return new double[] { originalStartSeconds, originalEndSeconds };
        }

        return new double[] { trimmedStartSeconds, trimmedEndSeconds };
    }

    // ── Phase 4: Write WAV chunk from file segment ───────────────────────
    //
    // Reads a specific sample range from the 16kHz mono PCM temp file
    // and writes it as a complete WAV file. Peak memory: ~64KB copy buffer.

    private void writeWavChunkFromFile(
        File sourceFile,
        File outputFile,
        long startSample,
        long endSample
    ) throws IOException {
        int sampleCount = (int) Math.max(0, endSample - startSample);
        int dataSize = sampleCount * BYTES_PER_SAMPLE;
        int byteRate = TARGET_SAMPLE_RATE * BYTES_PER_SAMPLE;

        try (RandomAccessFile raf = new RandomAccessFile(sourceFile, "r");
             FileOutputStream fos = new FileOutputStream(outputFile)) {

            // WAV header
            fos.write(new byte[] { 'R', 'I', 'F', 'F' });
            writeInt32LittleEndian(fos, 36 + dataSize);
            fos.write(new byte[] { 'W', 'A', 'V', 'E' });
            fos.write(new byte[] { 'f', 'm', 't', ' ' });
            writeInt32LittleEndian(fos, 16);
            writeInt16LittleEndian(fos, 1);
            writeInt16LittleEndian(fos, 1);
            writeInt32LittleEndian(fos, TARGET_SAMPLE_RATE);
            writeInt32LittleEndian(fos, byteRate);
            writeInt16LittleEndian(fos, BYTES_PER_SAMPLE);
            writeInt16LittleEndian(fos, 16);
            fos.write(new byte[] { 'd', 'a', 't', 'a' });
            writeInt32LittleEndian(fos, dataSize);

            // Copy PCM segment from source file
            raf.seek(startSample * BYTES_PER_SAMPLE);
            byte[] buffer = new byte[STREAM_BUFFER_SIZE];
            long remaining = (long) sampleCount * BYTES_PER_SAMPLE;

            while (remaining > 0) {
                int toRead = (int) Math.min(buffer.length, remaining);
                int read = raf.read(buffer, 0, toRead);
                if (read <= 0) break;
                fos.write(buffer, 0, read);
                remaining -= read;
            }
        }
    }

    private void writeSpeechOnlyWavChunkFromFile(
        File sourceFile,
        File outputFile,
        SpeechAnalysisResult analysis,
        double startSeconds,
        double endSeconds,
        long fallbackStartSample,
        long fallbackEndSample
    ) throws IOException {
        List<SampleRange> ranges = buildSpeechOnlySampleRanges(analysis, startSeconds, endSeconds);
        if (ranges.isEmpty()) {
            writeWavChunkFromFile(sourceFile, outputFile, fallbackStartSample, fallbackEndSample);
            return;
        }

        long pcmDataBytes = 0;
        for (SampleRange range : ranges) {
            pcmDataBytes += (range.endSample - range.startSample) * BYTES_PER_SAMPLE;
        }

        try (RandomAccessFile raf = new RandomAccessFile(sourceFile, "r");
             FileOutputStream fos = new FileOutputStream(outputFile)) {
            writeWavHeader(fos, pcmDataBytes, TARGET_SAMPLE_RATE);
            byte[] buffer = new byte[STREAM_BUFFER_SIZE];

            for (SampleRange range : ranges) {
                raf.seek(range.startSample * BYTES_PER_SAMPLE);
                long remaining = (range.endSample - range.startSample) * BYTES_PER_SAMPLE;

                while (remaining > 0) {
                    int toRead = (int) Math.min(buffer.length, remaining);
                    int read = raf.read(buffer, 0, toRead);
                    if (read <= 0) break;
                    fos.write(buffer, 0, read);
                    remaining -= read;
                }
            }
        }
    }

    private List<SampleRange> buildSpeechOnlySampleRanges(
        SpeechAnalysisResult analysis,
        double startSeconds,
        double endSeconds
    ) {
        List<SampleRange> ranges = new ArrayList<>();
        int startFrame = Math.max(0, (int) Math.floor(startSeconds / FRAME_DURATION_SECONDS));
        int endFrame = Math.min(
            analysis.frameCount,
            (int) Math.ceil(endSeconds / FRAME_DURATION_SECONDS)
        );
        int paddingFrames = Math.max(
            1,
            (int) Math.round(EDGE_SPEECH_PADDING_SECONDS / FRAME_DURATION_SECONDS)
        );

        int frameIndex = startFrame;
        while (frameIndex < endFrame) {
            while (frameIndex < endFrame && !analysis.speechFlags[frameIndex]) {
                frameIndex += 1;
            }

            if (frameIndex >= endFrame) {
                break;
            }

            int speechStartFrame = frameIndex;
            while (frameIndex < endFrame && analysis.speechFlags[frameIndex]) {
                frameIndex += 1;
            }
            int speechEndFrame = frameIndex;

            int paddedStartFrame = Math.max(startFrame, speechStartFrame - paddingFrames);
            int paddedEndFrame = Math.min(endFrame, speechEndFrame + paddingFrames);
            long rangeStartSample = Math.max(
                0,
                (long) paddedStartFrame * TARGET_FRAME_SIZE
            );
            long rangeEndSample = Math.min(
                analysis.totalSamples,
                (long) paddedEndFrame * TARGET_FRAME_SIZE
            );

            if (rangeEndSample <= rangeStartSample) {
                continue;
            }

            if (!ranges.isEmpty()) {
                SampleRange previous = ranges.get(ranges.size() - 1);
                if (rangeStartSample <= previous.endSample) {
                    ranges.set(
                        ranges.size() - 1,
                        new SampleRange(previous.startSample, Math.max(previous.endSample, rangeEndSample))
                    );
                    continue;
                }
            }

            ranges.add(new SampleRange(rangeStartSample, rangeEndSample));
        }

        return ranges;
    }

    // ── Shared utility methods (unchanged) ───────────────────────────────

    private void setExtractorSource(MediaExtractor extractor, String fileUri) throws IOException {
        Uri uri = Uri.parse(fileUri);
        String scheme = uri.getScheme();

        if (scheme == null || scheme.isEmpty()) {
            extractor.setDataSource(fileUri);
            return;
        }

        if ("file".equalsIgnoreCase(scheme)) {
            extractor.setDataSource(uri.getPath());
            return;
        }

        if ("content".equalsIgnoreCase(scheme)) {
            Context context = getContext();
            try (android.os.ParcelFileDescriptor pfd =
                     context.getContentResolver().openFileDescriptor(uri, "r")) {
                if (pfd == null) {
                    throw new IOException("Không mở được file descriptor cho uri: " + fileUri);
                }
                FileDescriptor fd = pfd.getFileDescriptor();
                extractor.setDataSource(fd);
                return;
            }
        }

        extractor.setDataSource(getContext(), uri, null);
    }

    private int findAudioTrack(MediaExtractor extractor) {
        for (int index = 0; index < extractor.getTrackCount(); index += 1) {
            MediaFormat format = extractor.getTrackFormat(index);
            String mime = format.getString(MediaFormat.KEY_MIME);
            if (mime != null && mime.startsWith("audio/")) {
                return index;
            }
        }
        return -1;
    }

    private String getBaseName(String fileName) {
        String safeName = fileName == null ? "audio" : fileName.trim();
        if (safeName.isEmpty()) {
            safeName = "audio";
        }
        int extensionIndex = safeName.lastIndexOf('.');
        if (extensionIndex > 0) {
            safeName = safeName.substring(0, extensionIndex);
        }
        return safeName.replaceAll("[^a-zA-Z0-9._-]+", "-");
    }

    private void writeInt16LittleEndian(FileOutputStream outputStream, int value) throws IOException {
        outputStream.write(value & 0xff);
        outputStream.write((value >> 8) & 0xff);
    }

    private void writeInt32LittleEndian(FileOutputStream outputStream, int value) throws IOException {
        outputStream.write(value & 0xff);
        outputStream.write((value >> 8) & 0xff);
        outputStream.write((value >> 16) & 0xff);
        outputStream.write((value >> 24) & 0xff);
    }

    private void mergeWaveFilesFromUris(JSArray fileUris, File outputFile) throws Exception {
        long totalPcmBytes = 0;
        List<File> inputFiles = new ArrayList<>();

        for (int index = 0; index < fileUris.length(); index += 1) {
            String rawUri = fileUris.optString(index, "");
            if (rawUri == null || rawUri.trim().isEmpty()) {
                continue;
            }
            Uri uri = Uri.parse(rawUri);
            if (!"file".equalsIgnoreCase(uri.getScheme())) {
                throw new IOException("Chunk URI không phải file://");
            }
            File inputFile = new File(uri.getPath());
            if (!inputFile.exists()) {
                throw new IOException("Không tìm thấy chunk file: " + rawUri);
            }
            if (inputFile.length() < 44) {
                throw new IOException("Chunk WAV không hợp lệ: " + rawUri);
            }
            inputFiles.add(inputFile);
            totalPcmBytes += (inputFile.length() - 44);
        }

        try (FileOutputStream outputStream = new FileOutputStream(outputFile)) {
            writeWavHeader(outputStream, totalPcmBytes, TARGET_SAMPLE_RATE);
            byte[] buffer = new byte[STREAM_BUFFER_SIZE];

            for (File inputFile : inputFiles) {
                try (BufferedInputStream inputStream = new BufferedInputStream(new FileInputStream(inputFile), STREAM_BUFFER_SIZE)) {
                    long bytesToSkip = 44;
                    while (bytesToSkip > 0) {
                        long skipped = inputStream.skip(bytesToSkip);
                        if (skipped <= 0) {
                            throw new IOException("Không thể bỏ qua header WAV khi merge.");
                        }
                        bytesToSkip -= skipped;
                    }

                    int bytesRead;
                    while ((bytesRead = inputStream.read(buffer)) != -1) {
                        outputStream.write(buffer, 0, bytesRead);
                    }
                }
            }
        }
    }

    private void writeWavHeader(FileOutputStream outputStream, long pcmDataBytes, int sampleRate) throws IOException {
        int channels = 1;
        int bitsPerSample = BYTES_PER_SAMPLE * 8;
        int byteRate = sampleRate * channels * BYTES_PER_SAMPLE;
        int blockAlign = channels * BYTES_PER_SAMPLE;

        outputStream.write(new byte[]{'R', 'I', 'F', 'F'});
        writeInt32LittleEndian(outputStream, (int) (36 + pcmDataBytes));
        outputStream.write(new byte[]{'W', 'A', 'V', 'E'});
        outputStream.write(new byte[]{'f', 'm', 't', ' '});
        writeInt32LittleEndian(outputStream, 16);
        writeInt16LittleEndian(outputStream, 1);
        writeInt16LittleEndian(outputStream, channels);
        writeInt32LittleEndian(outputStream, sampleRate);
        writeInt32LittleEndian(outputStream, byteRate);
        writeInt16LittleEndian(outputStream, blockAlign);
        writeInt16LittleEndian(outputStream, bitsPerSample);
        outputStream.write(new byte[]{'d', 'a', 't', 'a'});
        writeInt32LittleEndian(outputStream, (int) pcmDataBytes);
    }

    private String sanitizeWavFileName(String rawName) {
        String safeName = rawName == null || rawName.trim().isEmpty() ? "merged-batch.wav" : rawName.trim();
        safeName = safeName.replaceAll("[^a-zA-Z0-9._-]+", "-");
        if (!safeName.toLowerCase(Locale.US).endsWith(".wav")) {
            safeName = safeName + ".wav";
        }
        return safeName;
    }

    private void deleteSilently(File file) {
        if (file != null) {
            try {
                if (file.isDirectory()) {
                    File[] children = file.listFiles();
                    if (children != null) {
                        for (File child : children) {
                            deleteSilently(child);
                        }
                    }
                }
                file.delete();
            } catch (Exception ignored) {
            }
        }
    }

    private void deleteIfEmpty(File directory) {
        if (directory == null || !directory.exists() || !directory.isDirectory()) {
            return;
        }
        File[] children = directory.listFiles();
        if (children != null && children.length > 0) {
            return;
        }
        try {
            directory.delete();
        } catch (Exception ignored) {
        }
    }
}
