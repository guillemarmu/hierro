import ActivityKit
import AppIntents
import Foundation
import UserNotifications

/// Botón ✓ de la Live Activity (iOS 17+): marca la siguiente serie sin abrir Hierro.
/// iOS lo ejecuta en el proceso de la app (también en segundo plano), así que este archivo va en la app y en la extensión.
/// Actualiza la actividad al momento (serie hecha, descanso y aviso) y apunta la serie en UserDefaults
/// («hierro.live.hechas»); la web la marca de verdad al volver (HierroLive.pending() → liveApply).
@available(iOS 17.0, *)
struct HierroSerieHecha: LiveActivityIntent {
    static var title: LocalizedStringResource = "Serie hecha"
    static var description = IntentDescription("Marca como hecha la siguiente serie del entreno en curso.")
    static var isDiscoverable = false

    @Parameter(title: "Serie")
    var clave: String

    init() {}

    init(clave: String) {
        self.clave = clave
    }

    func perform() async throws -> some IntentResult {
        guard let act = Activity<HierroWorkoutAttributes>.activities.first else { return .result() }
        var st = act.content.state
        // Solo la primera pendiente y solo si coincide (dos toques seguidos no marcan otra serie por error)
        guard let serie = st.next.first, serie.k == clave, serie.ok else { return .result() }
        let ahora = Date()
        st.next.removeFirst()
        st.done = min(st.total, st.done + 1)
        HierroColaLive.apuntar(clave: serie.k, hora: ahora, descanso: serie.rest)
        if let s = st.next.first {
            st.exercise = s.name
            st.detail = s.detail
        } else {
            st.exercise = "Todo hecho"
            st.detail = "Abre Hierro para terminar"
        }
        if serie.rest > 0 {
            let fin = ahora.addingTimeInterval(serie.rest)
            st.restStart = ahora
            st.restEnd = fin
            let cuerpo = st.next.first.map { "Ahora: \($0.name) · \($0.detail)" } ?? "A por la siguiente serie"
            await HierroColaLive.avisar(fin: fin, cuerpo: cuerpo)
        } else {
            st.restStart = nil
            st.restEnd = nil
        }
        await act.update(ActivityContent(state: st, staleDate: st.restEnd))
        return .result()
    }
}

/// Cola de series marcadas fuera de la app y aviso de fin del descanso (lo comparten el botón y el plugin).
enum HierroColaLive {
    static let clave = "hierro.live.hechas"
    static let aviso = "hierro-rest"

    static func apuntar(clave k: String, hora: Date, descanso: Double) {
        let d = UserDefaults.standard
        var cola = d.array(forKey: clave) as? [[String: Any]] ?? []
        cola.append(["k": k, "t": (hora.timeIntervalSince1970 * 1000).rounded(), "r": descanso])
        d.set(Array(cola.suffix(50)), forKey: clave)
    }

    static func avisar(fin: Date, cuerpo: String) async {
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: [aviso])
        let quedan = fin.timeIntervalSinceNow
        guard quedan > 1 else { return }
        let c = UNMutableNotificationContent()
        c.title = "¡Descanso terminado!"
        c.body = String(cuerpo.prefix(160))
        c.sound = .default
        c.threadIdentifier = aviso
        let req = UNNotificationRequest(identifier: aviso, content: c,
                                        trigger: UNTimeIntervalNotificationTrigger(timeInterval: quedan, repeats: false))
        try? await center.add(req)
    }
}
