import ActivityKit
import Foundation

/// Datos del entreno en curso que se ven en la pantalla de bloqueo y en la Dynamic Island.
/// OJO: este archivo está repetido en plugins/hierro-live (el plugin), y anadir.rb lo copia a la app y a la extensión.
/// ActivityKit los empareja por el nombre del tipo, así que todas las copias tienen que ser idénticas.
@available(iOS 16.1, *)
struct HierroWorkoutAttributes: ActivityAttributes {
    /// Una serie pendiente. k = «inicio del entreno:ejercicio:serie»; rest = segundos de descanso al marcarla;
    /// ok = se puede marcar desde la pantalla de bloqueo (tiene peso/repes o sugerencia).
    struct Serie: Codable, Hashable {
        var k: String
        var name: String
        var detail: String
        var rest: Double
        var ok: Bool
    }

    struct ContentState: Codable, Hashable {
        var title: String
        var start: Date
        var exercise: String
        var detail: String
        var done: Int
        var total: Int
        var restStart: Date?
        var restEnd: Date?
        var next: [Serie]
    }
}
