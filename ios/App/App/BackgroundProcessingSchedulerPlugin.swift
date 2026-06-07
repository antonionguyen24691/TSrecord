import Foundation
import Capacitor
import BackgroundTasks

@objc(BackgroundProcessingSchedulerPlugin)
public class BackgroundProcessingSchedulerPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "BackgroundProcessingSchedulerPlugin"
    public let jsName = "BackgroundProcessingScheduler"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "scheduleProcessingResume", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancelProcessingResume", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getPendingResumeState", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearPendingResumeState", returnType: CAPPluginReturnPromise)
    ]

    private static let taskIdentifier = "com.trichxuatamthanh.app.resume-processing"
    private static let defaults = UserDefaults.standard
    private static let jobIdKey = "tsrecord_background_resume_job_id"
    private static let workspacePathKey = "tsrecord_background_resume_workspace_path"
    private static let stateKey = "tsrecord_background_resume_state"
    private static let scheduledAtKey = "tsrecord_background_resume_scheduled_at"
    private static let lastTriggeredAtKey = "tsrecord_background_resume_last_triggered_at"

    @objc public static func registerBackgroundTask() {
        BGTaskScheduler.shared.register(forTaskWithIdentifier: taskIdentifier, using: nil) { task in
            guard let processingTask = task as? BGProcessingTask else {
                task.setTaskCompleted(success: false)
                return
            }
            handleProcessingTask(processingTask)
        }
    }

    @objc public static func refreshScheduledTaskIfNeeded() {
        guard defaults.string(forKey: jobIdKey) != nil else { return }
        scheduleBackgroundTask(after: 60)
    }

    public func scheduleProcessingResume(_ call: CAPPluginCall) {
        guard
            let jobId = call.getString("jobId"), !jobId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
            let workspacePath = call.getString("workspacePath"), !workspacePath.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        else {
            call.reject("Missing jobId or workspacePath.")
            return
        }

        let delaySeconds = max(15, call.getInt("delaySeconds") ?? 60)
        Self.defaults.set(jobId, forKey: Self.jobIdKey)
        Self.defaults.set(workspacePath, forKey: Self.workspacePathKey)
        Self.defaults.set("scheduled", forKey: Self.stateKey)
        Self.defaults.set(String(Int(Date().timeIntervalSince1970 * 1000)), forKey: Self.scheduledAtKey)

        do {
            try BGTaskScheduler.shared.submit(Self.buildRequest(delaySeconds: delaySeconds))
            call.resolve()
        } catch {
            call.reject("Cannot schedule background processing resume.", nil, error)
        }
    }

    public func cancelProcessingResume(_ call: CAPPluginCall) {
        guard let jobId = call.getString("jobId"), !jobId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            call.reject("Missing jobId.")
            return
        }

        BGTaskScheduler.shared.cancel(taskRequestWithIdentifier: Self.taskIdentifier)
        clearStateIfMatches(jobId: jobId)
        call.resolve()
    }

    public func getPendingResumeState(_ call: CAPPluginCall) {
        call.resolve(Self.buildStatePayload())
    }

    public func clearPendingResumeState(_ call: CAPPluginCall) {
        if let jobId = call.getString("jobId"), !jobId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            clearStateIfMatches(jobId: jobId)
        } else {
            Self.clearState()
        }
        call.resolve()
    }

    private func clearStateIfMatches(jobId: String) {
        let current = Self.defaults.string(forKey: Self.jobIdKey)
        if current == jobId {
            Self.clearState()
        }
    }

    private static func buildRequest(delaySeconds: Int) -> BGProcessingTaskRequest {
        let request = BGProcessingTaskRequest(identifier: taskIdentifier)
        request.requiresNetworkConnectivity = true
        request.requiresExternalPower = false
        request.earliestBeginDate = Date(timeIntervalSinceNow: TimeInterval(delaySeconds))
        return request
    }

    private static func scheduleBackgroundTask(after delaySeconds: Int) {
        do {
            try BGTaskScheduler.shared.submit(buildRequest(delaySeconds: delaySeconds))
        } catch {
            NSLog("TSrecord background resume scheduling failed: \(error.localizedDescription)")
        }
    }

    private static func handleProcessingTask(_ task: BGProcessingTask) {
        defaults.set("triggered", forKey: stateKey)
        defaults.set(String(Int(Date().timeIntervalSince1970 * 1000)), forKey: lastTriggeredAtKey)
        task.expirationHandler = {
            task.setTaskCompleted(success: false)
        }
        task.setTaskCompleted(success: true)
        refreshScheduledTaskIfNeeded()
    }

    private static func buildStatePayload() -> JSObject {
        var payload = JSObject()
        payload["jobId"] = defaults.string(forKey: jobIdKey)
        payload["workspacePath"] = defaults.string(forKey: workspacePathKey)
        payload["state"] = defaults.string(forKey: stateKey)
        payload["scheduledAt"] = defaults.string(forKey: scheduledAtKey)
        payload["lastTriggeredAt"] = defaults.string(forKey: lastTriggeredAtKey)
        return payload
    }

    private static func clearState() {
        defaults.removeObject(forKey: jobIdKey)
        defaults.removeObject(forKey: workspacePathKey)
        defaults.removeObject(forKey: stateKey)
        defaults.removeObject(forKey: scheduledAtKey)
        defaults.removeObject(forKey: lastTriggeredAtKey)
    }
}
