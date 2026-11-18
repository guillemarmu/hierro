import Foundation
import Capacitor
import HealthKit

/// Guarda en Apple Salud los entrenos de fuerza que termina el usuario. Solo escribe: no lee nada.
@objc(HierroHealthPlugin)
public class HierroHealthPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "HierroHealthPlugin"
    public let jsName = "HierroHealth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestAuthorization", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "saveWorkout", returnType: CAPPluginReturnPromise)
    ]

    private let store = HKHealthStore()
    private let workoutType = HKObjectType.workoutType()

    private var typesToShare: Set<HKSampleType> { [workoutType] }

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": HKHealthStore.isHealthDataAvailable()])
    }

    @objc func requestAuthorization(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.resolve(["granted": false])
            return
        }
        store.requestAuthorization(toShare: typesToShare, read: []) { [weak self] _, error in
            guard let self = self else { return }
            if let error = error {
                call.reject(error.localizedDescription)
                return
            }
            // El estado de escritura sí se puede consultar (el de lectura no)
            let ok = self.store.authorizationStatus(for: self.workoutType) == .sharingAuthorized
            call.resolve(["granted": ok])
        }
    }

    @objc func saveWorkout(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.reject("Salud no disponible")
            return
        }
        guard let startMs = call.getDouble("start"), let endMs = call.getDouble("end"), endMs > startMs else {
            call.reject("start y end (ms) obligatorios, con end > start")
            return
        }
        guard store.authorizationStatus(for: workoutType) == .sharingAuthorized else {
            call.reject("Sin permiso para guardar en Salud")
            return
        }
        let start = Date(timeIntervalSince1970: startMs / 1000)
        let end = Date(timeIntervalSince1970: endMs / 1000)
        let name = call.getString("name") ?? "Hierro"

        let config = HKWorkoutConfiguration()
        config.activityType = .traditionalStrengthTraining
        config.locationType = .indoor
        let builder = HKWorkoutBuilder(healthStore: store, configuration: config, device: .local())

        builder.beginCollection(withStart: start) { [weak self] ok, error in
            guard let self = self else { return }
            if !ok {
                call.reject(error?.localizedDescription ?? "No se pudo iniciar el entreno")
                return
            }
            let meta: [String: Any] = [
                HKMetadataKeyWorkoutBrandName: "Hierro",
                "HierroNombre": name
            ]
            builder.addMetadata(meta) { _, _ in
                builder.endCollection(withEnd: end) { ok2, error2 in
                    if !ok2 {
                        call.reject(error2?.localizedDescription ?? "No se pudo cerrar el entreno")
                        return
                    }
                    builder.finishWorkout { workout, error3 in
                        if let error3 = error3 {
                            call.reject(error3.localizedDescription)
                        } else {
                            call.resolve(["saved": workout != nil])
                        }
                    }
                }
            }
        }
    }
}
