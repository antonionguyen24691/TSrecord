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

import java.io.ByteArrayOutputStream;
import java.io.FileDescriptor;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.ArrayList;
import java.util.List;

@CapacitorPlugin(name = "AudioVad")
public class AudioVadPlugin extends Plugin {
    private static final int TARGET_SAMPLE_RATE = 16000;
    private static final int BYTES_PER_SAMPLE = 2;
    private static final int TARGET_FRAME_SIZE = 320;
    private static final double FRAME_DURATION_SECONDS = TARGET_FRAME_SIZE / 16000.0;
    private static final int SEARCH_RADIUS_SECONDS = 45;
    private static final int MIN_CHUNK_DURATION_SECONDS = 60;

    @PluginMethod
    public void detectSpeechBoundaries(PluginCall call) {
        String fileUri = call.getString("fileUri");
        int chunkDurationSeconds = call.getInt("chunkDurationSeconds", 600);

        if (fileUri == null || fileUri.trim().isEmpty()) {
          call.reject("Thiếu fileUri.");
          return;
        }

        try {
            short[] pcm = decodeToMonoPcm16k(fileUri);
            double durationSeconds = pcm.length / (double) TARGET_SAMPLE_RATE;
            List<Double> boundaries = buildSpeechAwareBoundaries(pcm, chunkDurationSeconds);

            JSArray boundaryArray = new JSArray();
            for (Double boundary : boundaries) {
                boundaryArray.put(boundary);
            }

            JSObject result = new JSObject();
            result.put("sampleRate", TARGET_SAMPLE_RATE);
            result.put("durationSeconds", durationSeconds);
            result.put("boundariesSeconds", boundaryArray);
            call.resolve(result);
        } catch (Exception exception) {
            call.reject("Không thể phân tích VAD cho file audio.", exception);
        }
    }

    private short[] decodeToMonoPcm16k(String fileUri) throws Exception {
        MediaExtractor extractor = new MediaExtractor();
        MediaCodec codec = null;

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

            ByteArrayOutputStream pcmBytes = new ByteArrayOutputStream();
            MediaCodec.BufferInfo bufferInfo = new MediaCodec.BufferInfo();
            boolean inputDone = false;
            boolean outputDone = false;

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
                                inputBufferIndex,
                                0,
                                0,
                                0,
                                MediaCodec.BUFFER_FLAG_END_OF_STREAM
                            );
                            inputDone = true;
                        } else {
                            codec.queueInputBuffer(
                                inputBufferIndex,
                                0,
                                sampleSize,
                                extractor.getSampleTime(),
                                0
                            );
                            extractor.advance();
                        }
                    }
                }

                int outputBufferIndex = codec.dequeueOutputBuffer(bufferInfo, 10_000);
                if (outputBufferIndex >= 0) {
                    ByteBuffer outputBuffer = codec.getOutputBuffer(outputBufferIndex);
                    if (outputBuffer != null && bufferInfo.size > 0) {
                        byte[] chunk = new byte[bufferInfo.size];
                        outputBuffer.position(bufferInfo.offset);
                        outputBuffer.limit(bufferInfo.offset + bufferInfo.size);
                        outputBuffer.get(chunk);
                        pcmBytes.write(chunk);
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

            short[] pcmInterleaved = bytesToShorts(pcmBytes.toByteArray());
            short[] mono = downmixToMono(pcmInterleaved, sourceChannelCount);
            return resampleTo16k(mono, sourceSampleRate);
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

    private short[] bytesToShorts(byte[] data) {
        short[] result = new short[data.length / BYTES_PER_SAMPLE];
        ByteBuffer.wrap(data).order(ByteOrder.LITTLE_ENDIAN).asShortBuffer().get(result);
        return result;
    }

    private short[] downmixToMono(short[] pcmInterleaved, int channelCount) {
        if (channelCount <= 1) {
            return pcmInterleaved;
        }

        int frameCount = pcmInterleaved.length / channelCount;
        short[] mono = new short[frameCount];
        for (int frame = 0; frame < frameCount; frame += 1) {
            int sum = 0;
            for (int channel = 0; channel < channelCount; channel += 1) {
                sum += pcmInterleaved[frame * channelCount + channel];
            }
            mono[frame] = (short) (sum / channelCount);
        }
        return mono;
    }

    private short[] resampleTo16k(short[] source, int sourceSampleRate) {
        if (sourceSampleRate <= 0 || sourceSampleRate == TARGET_SAMPLE_RATE) {
            return source;
        }

        double ratio = sourceSampleRate / (double) TARGET_SAMPLE_RATE;
        int targetLength = Math.max(1, (int) Math.round(source.length / ratio));
        short[] resampled = new short[targetLength];

        for (int index = 0; index < targetLength; index += 1) {
            int start = (int) Math.floor(index * ratio);
            int end = Math.min(source.length, (int) Math.floor((index + 1) * ratio));
            if (end <= start) {
                resampled[index] = source[Math.min(source.length - 1, start)];
                continue;
            }

            long sum = 0;
            for (int sampleIndex = start; sampleIndex < end; sampleIndex += 1) {
                sum += source[sampleIndex];
            }
            resampled[index] = (short) (sum / Math.max(1, end - start));
        }

        return resampled;
    }

    private List<Double> buildSpeechAwareBoundaries(short[] mono16k, int chunkDurationSeconds) throws Exception {
        VadWebRTC vad = new VadWebRTC(
            SampleRate.SAMPLE_RATE_16K,
            FrameSize.FRAME_SIZE_320,
            Mode.VERY_AGGRESSIVE,
            0,
            0
        );

        try {
            int samplesPerFrame = TARGET_FRAME_SIZE;
            int frameCount = mono16k.length / samplesPerFrame;
            boolean[] speechFlags = new boolean[frameCount];

            for (int frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
                byte[] frameBytes = new byte[samplesPerFrame * BYTES_PER_SAMPLE];
                int frameOffset = frameIndex * samplesPerFrame;
                ByteBuffer buffer = ByteBuffer.wrap(frameBytes).order(ByteOrder.LITTLE_ENDIAN);
                for (int sampleIndex = 0; sampleIndex < samplesPerFrame; sampleIndex += 1) {
                    buffer.putShort(mono16k[frameOffset + sampleIndex]);
                }
                speechFlags[frameIndex] = vad.isSpeech(frameBytes);
            }

            double totalDurationSeconds = mono16k.length / (double) TARGET_SAMPLE_RATE;
            int minChunkFrames = Math.max(
                1,
                (int) Math.floor(
                    Math.min(
                        chunkDurationSeconds / 2.0,
                        Math.max(MIN_CHUNK_DURATION_SECONDS, chunkDurationSeconds * 0.35)
                    ) / FRAME_DURATION_SECONDS
                )
            );
            int searchRadiusFrames = Math.max(1, (int) Math.floor(SEARCH_RADIUS_SECONDS / FRAME_DURATION_SECONDS));

            List<Double> boundaries = new ArrayList<>();
            boundaries.add(0.0);
            int previousBoundaryFrame = 0;
            double targetSeconds = chunkDurationSeconds;

            while (targetSeconds < totalDurationSeconds - MIN_CHUNK_DURATION_SECONDS) {
                int targetFrame = (int) Math.floor(targetSeconds / FRAME_DURATION_SECONDS);
                int searchStart = Math.max(previousBoundaryFrame + minChunkFrames, targetFrame - searchRadiusFrames);
                int searchEnd = Math.min(frameCount - minChunkFrames, targetFrame + searchRadiusFrames);

                int bestFrame = -1;
                int bestDistance = Integer.MAX_VALUE;
                for (int frameIndex = searchStart; frameIndex <= searchEnd; frameIndex += 1) {
                    if (!speechFlags[frameIndex]) {
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

            boundaries.add(totalDurationSeconds);
            return boundaries;
        } finally {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
                    vad.close();
                }
            } catch (Exception ignored) {
            }
        }
    }
}
