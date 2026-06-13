import Foundation
import Capacitor
import Security

@objc(SecureKeyStorePlugin)
public class SecureKeyStorePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SecureKeyStorePlugin"
    public let jsName = "SecureKeyStore"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "set", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "get", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "remove", returnType: CAPPluginReturnPromise),
    ]

    private let service = "com.trichxuatamthanh.app.securekeystore"

    public func set(_ call: CAPPluginCall) {
        guard let key = call.getString("key")?.trimmingCharacters(in: .whitespacesAndNewlines), !key.isEmpty else {
            call.reject("Missing storage key.")
            return
        }

        let value = call.getString("value") ?? ""

        do {
            if value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                try deleteItem(account: key)
            } else {
                try saveItem(account: key, value: value)
            }
            call.resolve()
        } catch {
            call.reject("Failed to securely store value.", nil, error)
        }
    }

    public func get(_ call: CAPPluginCall) {
        guard let key = call.getString("key")?.trimmingCharacters(in: .whitespacesAndNewlines), !key.isEmpty else {
            call.reject("Missing storage key.")
            return
        }

        do {
            let value = try readItem(account: key)
            var result = JSObject()
            result["value"] = value ?? NSNull()
            call.resolve(result)
        } catch {
            call.reject("Failed to securely read value.", nil, error)
        }
    }

    public func remove(_ call: CAPPluginCall) {
        guard let key = call.getString("key")?.trimmingCharacters(in: .whitespacesAndNewlines), !key.isEmpty else {
            call.reject("Missing storage key.")
            return
        }

        do {
            try deleteItem(account: key)
            call.resolve()
        } catch {
            call.reject("Failed to securely remove value.", nil, error)
        }
    }

    private func baseQuery(account: String) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
    }

    private func saveItem(account: String, value: String) throws {
        guard let data = value.data(using: .utf8) else {
            throw NSError(domain: "SecureKeyStore", code: 1, userInfo: [NSLocalizedDescriptionKey: "Invalid UTF-8 value."])
        }

        var query = baseQuery(account: account)
        SecItemDelete(query as CFDictionary)

        query[kSecValueData as String] = data
        query[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly

        let status = SecItemAdd(query as CFDictionary, nil)
        guard status == errSecSuccess else {
            throw NSError(domain: "SecureKeyStore", code: Int(status), userInfo: [NSLocalizedDescriptionKey: "Keychain write failed (\(status))."])
        }
    }

    private func readItem(account: String) throws -> String? {
        var query = baseQuery(account: account)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)

        if status == errSecItemNotFound {
            return nil
        }

        guard status == errSecSuccess, let data = item as? Data, let value = String(data: data, encoding: .utf8) else {
            throw NSError(domain: "SecureKeyStore", code: Int(status), userInfo: [NSLocalizedDescriptionKey: "Keychain read failed (\(status))."])
        }

        return value
    }

    private func deleteItem(account: String) throws {
        let status = SecItemDelete(baseQuery(account: account) as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw NSError(domain: "SecureKeyStore", code: Int(status), userInfo: [NSLocalizedDescriptionKey: "Keychain delete failed (\(status))."])
        }
    }
}
