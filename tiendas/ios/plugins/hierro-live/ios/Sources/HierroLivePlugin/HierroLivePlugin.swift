import Foundation
import Capacitor
import UserNotifications
import ActivityKit

/// Entreno en curso en la pantalla de bloqueo y en la Dynamic Island (Live Activity, iOS 16.2+),
/// y aviso local cuando acaba el descanso (funciona con el móvil bloqueado y la app en segundo plano).
/// La web (native.js) llama a sync() cada vez que cambia algo y a end() al terminar o descartar.
/// Desde 4.20: pending() devuelve las series marcadas con el ✓ de la pantalla de bloqueo (HierroSerieHecha, en la app)
/// y el aviso del descanso también sale con la app delante (manejador de avisos locales de Capacitor).
@objc(HierroLivePlugin)
public class HierroLivePlugin: CAPPlugin, CAPBridgedPlugin, NotificationHandlerProtocol {
    public let identifier = "HierroLivePlugin"
    public let jsName = "HierroLive"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "sync", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "end", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restNotify", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restCancel", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pending", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "ack", returnType: CAPPluginReturnPromise)
    ]

    private static let restId = "hierro-rest"
    /// Misma clave que HierroColaLive.clave (HierroSerieHecha.swift, en la app)
    private static let colaKey = "hierro.live.hechas"

    override public func load() {
        bridge?.notificationRouter.localNotificationHandler = self
    }

    // Con la app delante iOS no enseña los avisos salvo que se le diga: el del descanso sí (la web además pita).
    public func willPresent(notification: UNNotification) -> UNNotificationPresentationOptions {
        guard notification.request.identifier == Self.restId else { return [] }
        return [.banner, .list, .sound]
    }

    public func didReceive(response: UNNotificationResponse) {}

    /// Series marcadas en la pantalla de bloqueo. No las borra: la web confirma con ack() las que ya ha marcado o descartado,
    /// así no se pierden si la web aún no está lista (arranque en frío, recarga).
    @objc func pending(_ call: CAPPluginCall) {
        let cola = UserDefaults.standard.array(forKey: Self.colaKey) as? [[String: Any]] ?? []
        call.resolve(["items": cola])
    }

    @objc func ack(_ call: CAPPluginCall) {
        let claves = Set((call.getArray("keys") ?? []).compactMap { $0 as? String })
        let d = UserDefaults.standard
        let cola = d.array(forKey: Self.colaKey) as? [[String: Any]] ?? []
        let quedan = cola.filter { !claves.contains(($0["k"] as? String) ?? "") }
        if quedan.isEmpty { d.removeObject(forKey: Self.colaKey) } else { d.set(quedan, forKey: Self.colaKey) }
        call.resolve()
    }

    @objc func isAvailable(_ call: CAPPluginCall) {
        if #available(iOS 16.2, *) {
            call.resolve(["available": ActivityAuthorizationInfo().areActivitiesEnabled])
        } else {
            call.resolve(["available": false])
        }
    }

    @objc func sync(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else { call.resolve(["ok": false]); return }
        guard let startMs = call.getDouble("start"), startMs > 0 else {
            call.reject("start (ms) obligatorio")
            return
        }
        let fecha = { (ms: Double?) -> Date? in
            guard let ms = ms, ms > 0 else { return nil }
            return Date(timeIntervalSince1970: ms / 1000)
        }
        let corto = { (s: String?, max: Int) -> String in String((s ?? "").prefix(max)) }
        var restStart = fecha(call.getDouble("restStart"))
        let restEnd = fecha(call.getDouble("restEnd"))
        if let a = restStart, let b = restEnd, a > b { restStart = b }
        let st = HierroWorkoutAttributes.ContentState(
            title: corto(call.getString("title"), 60).isEmpty ? "Entreno" : corto(call.getString("title"), 60),
            start: Date(timeIntervalSince1970: startMs / 1000),
            exercise: corto(call.getString("exercise"), 60),
            detail: corto(call.getString("detail"), 80),
            done: max(0, call.getInt("done") ?? 0),
            total: max(0, call.getInt("total") ?? 0),
            restStart: restEnd == nil ? nil : (restStart ?? Date()),
            restEnd: restEnd,
            next: Self.series(call.getArray("next") ?? []))
        Task {
            let ok = await LiveWorkout.sync(st)
            call.resolve(["ok": ok])
        }
    }

    @available(iOS 16.1, *)
    private static func series(_ arr: JSArray) -> [HierroWorkoutAttributes.Serie] {
        arr.prefix(5).compactMap { v in
            guard let o = v as? JSObject, let k = o["k"] as? String, !k.isEmpty else { return nil }
            let rest = (o["rest"] as? NSNumber)?.doubleValue ?? 0
            return HierroWorkoutAttributes.Serie(
                k: String(k.prefix(40)),
                name: String(((o["name"] as? String) ?? "").prefix(60)),
                detail: String(((o["detail"] as? String) ?? "").prefix(80)),
                rest: max(0, min(rest, 3600)),
                ok: (o["ok"] as? NSNumber)?.boolValue ?? false)
        }
    }

    @objc func end(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else { call.resolve(); return }
        Task {
            await LiveWorkout.end()
            call.resolve()
        }
    }

    @objc func restNotify(_ call: CAPPluginCall) {
        guard let endMs = call.getDouble("end") else {
            call.reject("end (ms) obligatorio")
            return
        }
        let center = UNUserNotificationCenter.current()
        let secs = endMs / 1000 - Date().timeIntervalSince1970
        center.removePendingNotificationRequests(withIdentifiers: [Self.restId])
        guard secs > 1 else { call.resolve(["ok": false]); return }
        let title = call.getString("title") ?? "¡Descanso terminado!"
        let body = call.getString("body") ?? "A por la siguiente serie"
        center.requestAuthorization(options: [.alert, .sound]) { granted, _ in
            guard granted else { call.resolve(["ok": false]); return }
            let c = UNMutableNotificationContent()
            c.title = String(title.prefix(80))
            c.body = String(body.prefix(160))
            c.sound = .default
            c.threadIdentifier = Self.restId
            // Lo que ya ha pasado mientras se pedía el permiso no cuenta
            let quedan = endMs / 1000 - Date().timeIntervalSince1970
            guard quedan > 1 else { call.resolve(["ok": false]); return }
            let trigger = UNTimeIntervalNotificationTrigger(timeInterval: quedan, repeats: false)
            center.add(UNNotificationRequest(identifier: Self.restId, content: c, trigger: trigger)) { error in
                call.resolve(["ok": error == nil])
            }
        }
    }

    @objc func restCancel(_ call: CAPPluginCall) {
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: [Self.restId])
        call.resolve()
    }
}

@available(iOS 16.2, *)
enum LiveWorkout {
    /// Actualiza la actividad que haya (y cierra las que sobren) o crea una nueva.
    static func sync(_ st: HierroWorkoutAttributes.ContentState) async -> Bool {
        // Al acabar el descanso iOS marca la actividad como «pasada» y la vista dice «¡A por la siguiente!»
        let stale = st.restEnd.flatMap { $0 > Date() ? $0 : nil }
        let content = ActivityContent(state: st, staleDate: stale)
        let acts = Activity<HierroWorkoutAttributes>.activities
        if let a = acts.first {
            for extra in acts.dropFirst() { await extra.end(nil, dismissalPolicy: .immediate) }
            await a.update(content)
            return true
        }
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return false }
        do {
            _ = try Activity.request(attributes: HierroWorkoutAttributes(), content: content, pushType: nil)
            return true
        } catch {
            return false
        }
    }

    static func end() async {
        for a in Activity<HierroWorkoutAttributes>.activities {
            await a.end(nil, dismissalPolicy: .immediate)
        }
    }
}
