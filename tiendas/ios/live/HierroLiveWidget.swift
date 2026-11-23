import ActivityKit
import SwiftUI
import WidgetKit

/// Extensión de widget de Hierro: solo la Live Activity del entreno en curso
/// (pantalla de bloqueo y Dynamic Island). No tiene widgets para la pantalla de inicio.
@main
struct HierroLiveBundle: WidgetBundle {
    var body: some Widget {
        HierroLiveWidget()
    }
}

private let fondo = Color(red: 7 / 255, green: 11 / 255, blue: 26 / 255)   // #070B1A, el del icono
private let azul = Color(red: 91 / 255, green: 140 / 255, blue: 255 / 255)  // --g1 en oscuro
private let lila = Color(red: 168 / 255, green: 107 / 255, blue: 255 / 255) // --g2 en oscuro
private let tenue = Color.white.opacity(0.68)

/// ¿Hay un descanso en marcha? (cuando acaba, iOS marca la actividad como pasada: isStale)
private func descanso(_ st: HierroWorkoutAttributes.ContentState, _ stale: Bool) -> ClosedRange<Date>? {
    guard !stale, let fin = st.restEnd, fin > Date() else { return nil }
    let ini = min(st.restStart ?? fin, fin)
    return ini...fin
}

struct HierroLiveWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: HierroWorkoutAttributes.self) { ctx in
            PantallaBloqueo(st: ctx.state, stale: ctx.isStale)
                .activityBackgroundTint(fondo)
                .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { ctx in
            let st = ctx.state
            let rango = descanso(st, ctx.isStale)
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    HStack(spacing: 6) {
                        Image(systemName: "dumbbell.fill").foregroundColor(lila)
                        Text(st.title).lineLimit(1)
                    }
                    .font(.subheadline.weight(.semibold))
                    .padding(.leading, 4)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Reloj(st: st, stale: ctx.isStale, ancho: 72)
                        .font(.subheadline.weight(.semibold))
                        .padding(.trailing, 4)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Detalle(st: st, stale: ctx.isStale, grande: false)
                        .padding(.horizontal, 4)
                }
            } compactLeading: {
                Image(systemName: rango == nil ? "dumbbell.fill" : "timer").foregroundColor(lila)
            } compactTrailing: {
                Group {
                    if let r = rango {
                        Text(timerInterval: r, countsDown: true)
                    } else {
                        Text(st.start, style: .timer)
                    }
                }
                .monospacedDigit()
                .multilineTextAlignment(.trailing)
                .frame(maxWidth: 52, alignment: .trailing)
            } minimal: {
                Image(systemName: rango == nil ? "dumbbell.fill" : "timer").foregroundColor(lila)
            }
            .keylineTint(lila)
        }
    }
}

/// Separa el detalle que manda la web («Serie 2 de 3 · 35 kg × 10 reps») en la serie y el peso/repes.
/// En cardio el valor también lleva « · » («2 km · 10 min»): se corta solo por el primero.
private func partes(_ d: String) -> (serie: String, valor: String) {
    guard let r = d.range(of: " · ") else { return (d, "") }
    return (String(d[..<r.lowerBound]), String(d[r.upperBound...]))
}

/// Tiempo de la esquina: la cuenta atrás del descanso si lo hay; si no, lo que lleva el entreno.
struct Reloj: View {
    let st: HierroWorkoutAttributes.ContentState
    let stale: Bool
    let ancho: CGFloat

    var body: some View {
        Group {
            if let r = descanso(st, stale) {
                Text(timerInterval: r, countsDown: true).foregroundColor(.white)
            } else {
                Text(st.start, style: .timer).foregroundColor(tenue)
            }
        }
        .monospacedDigit()
        .multilineTextAlignment(.trailing)
        .frame(maxWidth: ancho, alignment: .trailing)
    }
}

/// Pantalla de bloqueo (23 nov, como la de la foto de Guillermo). iOS corta la Live Activity a unos 160 pt de alto,
/// así que va compacta: arriba Hierro y el reloj (descanso o entreno) con la barra del descanso; luego el ejercicio
/// y «Serie 2 de 3»; abajo, grande, el peso × repes con el ✓.
struct PantallaBloqueo: View {
    let st: HierroWorkoutAttributes.ContentState
    let stale: Bool

    var body: some View {
        let rango = descanso(st, stale)
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                Image(systemName: "dumbbell.fill").font(.caption2).foregroundColor(lila)
                Text(rango != nil ? "Descanso" : (st.title.isEmpty ? "Hierro" : "Hierro · \(st.title)"))
                    .font(.footnote.weight(.semibold))
                    .foregroundColor(tenue)
                    .lineLimit(1)
                Spacer(minLength: 6)
                Reloj(st: st, stale: stale, ancho: 70).font(.footnote.weight(.bold))
            }
            if let r = rango {
                ProgressView(timerInterval: r, countsDown: true) { EmptyView() } currentValueLabel: { EmptyView() }
                    .tint(azul)
            }
            Detalle(st: st, stale: stale, grande: true)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .foregroundColor(.white)
    }
}

struct Detalle: View {
    let st: HierroWorkoutAttributes.ContentState
    let stale: Bool
    let grande: Bool

    var body: some View {
        let p = partes(st.detail)
        let serie = !p.serie.isEmpty ? p.serie : (st.total > 0 ? "\(st.done) de \(st.total) series" : "")
        HStack(alignment: .center, spacing: 10) {
            VStack(alignment: .leading, spacing: 1) {
                Text(st.exercise.isEmpty ? "Entreno en curso" : st.exercise)
                    .font(grande ? .subheadline.weight(.semibold) : .footnote.weight(.semibold))
                    .lineLimit(1)
                if !serie.isEmpty {
                    Text(serie).font(.caption).foregroundColor(stale && st.restEnd != nil ? lila : tenue).lineLimit(1)
                }
                if !p.valor.isEmpty {
                    Text(p.valor)
                        .font(.system(size: grande ? 24 : 18, weight: .bold, design: .rounded))
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)
                }
            }
            Spacer(minLength: 4)
            BotonSerie(st: st)
        }
    }
}

/// ✓ para marcar la siguiente serie sin abrir la app (iOS 17+; en 16 no sale).
struct BotonSerie: View {
    let st: HierroWorkoutAttributes.ContentState

    var body: some View {
        if #available(iOS 17.0, *) {
            if let s = st.next?.first, s.ok {
                Button(intent: HierroSerieHecha(clave: s.k)) {
                    Image(systemName: "checkmark")
                        .font(.system(size: 18, weight: .bold))
                        .foregroundColor(.white)
                        .frame(width: 40, height: 40)
                        .background(Circle().fill(azul))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Marcar como hecha: \(s.name), \(s.detail)")
            }
        }
    }
}
