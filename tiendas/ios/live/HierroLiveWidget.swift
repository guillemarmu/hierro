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
                    Text(st.start, style: .timer)
                        .monospacedDigit()
                        .font(.subheadline)
                        .foregroundColor(tenue)
                        .multilineTextAlignment(.trailing)
                        .frame(maxWidth: 72, alignment: .trailing)
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

struct PantallaBloqueo: View {
    let st: HierroWorkoutAttributes.ContentState
    let stale: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Image(systemName: "dumbbell.fill").foregroundColor(lila)
                Text(st.title).font(.headline).lineLimit(1)
                Spacer(minLength: 8)
                Text(st.start, style: .timer)
                    .monospacedDigit()
                    .font(.subheadline)
                    .foregroundColor(tenue)
                    .multilineTextAlignment(.trailing)
                    .frame(maxWidth: 80, alignment: .trailing)
            }
            Detalle(st: st, stale: stale, grande: true)
        }
        .padding(16)
        .foregroundColor(.white)
    }
}

struct Detalle: View {
    let st: HierroWorkoutAttributes.ContentState
    let stale: Bool
    let grande: Bool

    var body: some View {
        if let r = descanso(st, stale) {
            VStack(alignment: .leading, spacing: 8) {
                HStack(alignment: .bottom, spacing: 12) {
                    VStack(alignment: .leading, spacing: 0) {
                        Text("Descanso").font(.caption).foregroundColor(tenue)
                        Text(timerInterval: r, countsDown: true)
                            .monospacedDigit()
                            .font(.system(size: grande ? 34 : 28, weight: .bold, design: .rounded))
                            .frame(maxWidth: 110, alignment: .leading)
                    }
                    Spacer(minLength: 4)
                    if !st.exercise.isEmpty {
                        VStack(alignment: .trailing, spacing: 1) {
                            Text("Siguiente").font(.caption).foregroundColor(tenue)
                            Text(st.exercise).font(.subheadline.weight(.semibold)).lineLimit(1)
                            if !st.detail.isEmpty {
                                Text(st.detail).font(.caption).foregroundColor(tenue).lineLimit(1)
                            }
                        }
                    }
                    BotonSerie(st: st)
                }
                ProgressView(timerInterval: r, countsDown: true) { EmptyView() } currentValueLabel: { EmptyView() }
                    .tint(azul)
            }
        } else {
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 10) {
                    VStack(alignment: .leading, spacing: 1) {
                        if stale && st.restEnd != nil {
                            Text("¡A por la siguiente!").font(.caption.weight(.semibold)).foregroundColor(lila)
                        }
                        Text(st.exercise.isEmpty ? "Entreno en curso" : st.exercise)
                            .font(grande ? .title3.weight(.bold) : .headline)
                            .lineLimit(1)
                        if !st.detail.isEmpty {
                            Text(st.detail).font(.subheadline).foregroundColor(tenue).lineLimit(1)
                        }
                    }
                    Spacer(minLength: 4)
                    BotonSerie(st: st)
                }
                if st.total > 0 {
                    HStack(spacing: 10) {
                        ProgressView(value: Double(min(st.done, st.total)), total: Double(st.total)).tint(azul)
                        Text("\(st.done) de \(st.total)").font(.caption).monospacedDigit().foregroundColor(tenue)
                    }
                }
            }
        }
    }
}

/// ✓ para marcar la siguiente serie sin abrir la app (iOS 17+; en 16 no sale).
struct BotonSerie: View {
    let st: HierroWorkoutAttributes.ContentState

    var body: some View {
        if #available(iOS 17.0, *) {
            if let s = st.next.first, s.ok {
                Button(intent: HierroSerieHecha(clave: s.k)) {
                    Image(systemName: "checkmark")
                        .font(.system(size: 18, weight: .bold))
                        .foregroundColor(.white)
                        .frame(width: 44, height: 44)
                        .background(Circle().fill(azul))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Marcar como hecha: \(s.name), \(s.detail)")
            }
        }
    }
}
