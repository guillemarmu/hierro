import ActivityKit
import Foundation

/// Datos del entreno en curso que se ven en la pantalla de bloqueo y en la Dynamic Island.
/// OJO: este archivo está repetido en plugins/hierro-live (la app) y en live/ (la extensión).
/// ActivityKit los empareja por el nombre del tipo, así que las dos copias tienen que ser idénticas.
@available(iOS 16.1, *)
struct HierroWorkoutAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var title: String
        var start: Date
        var exercise: String
        var detail: String
        var done: Int
        var total: Int
        var restStart: Date?
        var restEnd: Date?
    }
}
