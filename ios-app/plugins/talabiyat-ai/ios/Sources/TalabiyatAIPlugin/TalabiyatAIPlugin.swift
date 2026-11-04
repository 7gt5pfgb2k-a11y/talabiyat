// فهم الطلبية بنموذج Apple اللي على الجهاز (Foundation Models، iOS 26+).
// كل شي بصير على الجوال: ما في إنترنت، ما في سيرفر، وما في تكلفة.
// إذا الجهاز ما بيدعم (جهاز قديم، Apple Intelligence مطفي، اللغة مش مدعومة…)
// بنرجّع السبب، والتطبيق بيرجع للفهم العادي (parser.js).
import Foundation
import Capacitor
#if canImport(FoundationModels)
import FoundationModels
#endif

@objc(TalabiyatAIPlugin)
public class TalabiyatAIPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "TalabiyatAIPlugin"
    public let jsName = "TalabiyatAI"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "parseOrder", returnType: CAPPluginReturnPromise)
    ]

    // حالة النموذج على هالجهاز
    @objc func status(_ call: CAPPluginCall) {
        var out: [String: Any] = [
            "available": false,
            "reason": "ios_too_old",
            "ios": UIDevice.current.systemVersion,
            "locale": Locale.current.identifier,
            "arabic": false,
            "localeSupported": false,
            "languages": [String]()
        ]
        #if canImport(FoundationModels)
        if #available(iOS 26.0, *) {
            let model = SystemLanguageModel.default
            let langs = model.supportedLanguages
            out["languages"] = langs.map { lang -> String in
                [lang.languageCode?.identifier, lang.region?.identifier].compactMap { $0 }.joined(separator: "-")
            }.sorted()
            out["arabic"] = langs.contains { $0.languageCode?.identifier == "ar" }
            out["localeSupported"] = model.supportsLocale(Locale.current)
            switch model.availability {
            case .available:
                out["available"] = true
                out["reason"] = "ok"
            case .unavailable(let r):
                switch r {
                case .deviceNotEligible: out["reason"] = "device_not_eligible"
                case .appleIntelligenceNotEnabled: out["reason"] = "apple_intelligence_off"
                case .modelNotReady: out["reason"] = "model_not_ready"
                @unknown default: out["reason"] = "unavailable"
                }
            @unknown default:
                out["reason"] = "unavailable"
            }
        }
        #else
        out["reason"] = "sdk_without_foundation_models"
        #endif
        call.resolve(out)
    }

    // يحوّل نص الطلبية لطلبية منظّمة: الزبون + الأصناف + الكميات + اليوم
    // المدخلات: text, products [{id,name,unit}], restaurants [{id,name}]
    @objc func parseOrder(_ call: CAPPluginCall) {
        #if canImport(FoundationModels)
        if #available(iOS 26.0, *) {
            let text = call.getString("text") ?? ""
            let products = (call.getArray("products") as? [[String: Any]]) ?? []
            let restaurants = (call.getArray("restaurants") as? [[String: Any]]) ?? []
            guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
                call.reject("empty_text"); return
            }
            guard case .available = SystemLanguageModel.default.availability else {
                call.reject("model_unavailable"); return
            }
            let started = Date()
            Task {
                do {
                    let r = try await OrderAI.parse(text: text, products: products, restaurants: restaurants)
                    var res = r
                    res["ms"] = Int(Date().timeIntervalSince(started) * 1000)
                    call.resolve(res)
                } catch {
                    call.reject(OrderAI.errorCode(error), nil, error)
                }
            }
            return
        }
        #endif
        call.reject("model_unavailable")
    }
}

#if canImport(FoundationModels)
@available(iOS 26.0, *)
@Generable
struct AIOrderLine {
    @Guide(description: "The id number of the product, taken from the PRODUCTS list")
    var productId: Int
    @Guide(description: "The quantity the customer asked for, as a number (Arabic words like ميتين = 200, نص = 0.5)")
    var quantity: Double
    @Guide(description: "true only if the customer said the quantity in kilos (كيلو / كغ)")
    var inKilo: Bool
}

@available(iOS 26.0, *)
@Generable
struct AIOrderDraft {
    @Guide(description: "The id number of the customer/restaurant from the CUSTOMERS list, or 0 if no customer was mentioned")
    var restaurantId: Int
    @Guide(description: "The products and quantities ordered by this customer")
    var lines: [AIOrderLine]
    @Guide(description: "Any extra remark from the order that is not a product or quantity; empty string if none")
    var note: String
}

@available(iOS 26.0, *)
@Generable
struct AIOrderResult {
    @Guide(description: "Delivery day: 0 = today (اليوم), 1 = tomorrow (بكرة), 2 = day after tomorrow (بعد بكرة), -1 = not said")
    var dayOffset: Int
    @Guide(description: "One entry per customer mentioned in the order")
    var drafts: [AIOrderDraft]
}

@available(iOS 26.0, *)
enum OrderAI {
    static func parse(text: String, products: [[String: Any]], restaurants: [[String: Any]]) async throws -> [String: Any] {
        func id(_ d: [String: Any]) -> Int { (d["id"] as? Int) ?? Int((d["id"] as? Double) ?? 0) }
        let plist = products.map { "\(id($0)): \($0["name"] as? String ?? "") (\($0["unit"] as? String ?? ""))" }.joined(separator: "\n")
        let rlist = restaurants.map { "\(id($0)): \($0["name"] as? String ?? "")" }.joined(separator: "\n")

        let instructions = """
        You read food orders written or dictated in Arabic (often Levantine/Gulf dialect) by a small \
        kitchen that sells stuffed grape leaves (ورق عنب), stuffed cabbage (ملفوف) and similar items to restaurants.
        Extract who ordered, which products, how many, and the delivery day.
        Only use ids that appear in the lists you are given. Never invent customers or products.
        If a product is mentioned without a number, use quantity 0.
        """
        let prompt = """
        PRODUCTS (id: name (unit)):
        \(plist)

        CUSTOMERS (id: name):
        \(rlist)

        ORDER TEXT:
        \(text)
        """
        let session = LanguageModelSession(instructions: instructions)
        let response = try await session.respond(to: prompt, generating: AIOrderResult.self, options: GenerationOptions(sampling: .greedy))
        let r = response.content
        return [
            "dayOffset": r.dayOffset,
            "drafts": r.drafts.map { d in
                [
                    "restaurantId": d.restaurantId,
                    "note": d.note,
                    "lines": d.lines.map { ["productId": $0.productId, "quantity": $0.quantity, "inKilo": $0.inKilo] }
                ] as [String: Any]
            }
        ]
    }

    static func errorCode(_ error: Error) -> String {
        if let e = error as? LanguageModelSession.GenerationError {
            switch e {
            case .unsupportedLanguageOrLocale: return "unsupported_language"
            case .guardrailViolation: return "guardrail"
            case .exceededContextWindowSize: return "too_long"
            default: return "generation_failed"
            }
        }
        return "generation_failed"
    }
}
#endif
