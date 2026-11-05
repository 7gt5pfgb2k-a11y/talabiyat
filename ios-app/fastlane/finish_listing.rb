# بيكمّل خانات صفحة App Store اللي بتنعمل بالـ API (بدون إرسال للمراجعة):
#   1) بيختار أحدث نسخة (build) جاهزة لنسخة 1.0
#   2) التصنيف العمري: كل شي None/No  (يطلع 4+)
#   3) السعر: مجاني (Free) — إذا ما كان محدد
# كل خطوة مستقلة: إذا وحدة فشلت، الباقي بيكمّل والنتيجة بتنطبع.
require "spaceship"

Spaceship::ConnectAPI.token = Spaceship::ConnectAPI::Token.from(filepath: ENV.fetch("ASC_KEY_JSON"))
app = Spaceship::ConnectAPI::App.find("app.talabiyat") or abort("app.talabiyat not found")
results = {}
results["app_id"] = app.id
results["links"] = "privacy: https://appstoreconnect.apple.com/apps/#{app.id}/distribution/privacy | version: https://appstoreconnect.apple.com/apps/#{app.id}/distribution/ios/version/inflight"

def step(results, name)
  yield
  results[name] = "OK"
rescue => e
  results[name] = "FAILED: #{e.message.lines.first(3).join(' ').strip}"
end

step(results, "build") do
  version = app.get_edit_app_store_version(platform: Spaceship::ConnectAPI::Platform::IOS) or raise "no editable version"
  builds = Spaceship::ConnectAPI::Build.all(app_id: app.id, processing_states: "VALID", sort: "-uploadedDate", limit: 10)
  build = builds.max_by { |b| b.version.to_i } or raise "no processed build yet"
  version.select_build(build_id: build.id)
  results["build_number"] = build.version
end

step(results, "age_rating") do
  info = app.fetch_edit_app_info or raise "no editable app info"
  decl = info.fetch_age_rating_declaration or raise "no age rating declaration"
  none = %w[alcoholTobaccoOrDrugUseOrReferences contests gamblingSimulated gunsOrOtherWeapons horrorOrFearThemes
            matureOrSuggestiveThemes medicalOrTreatmentInformation profanityOrCrudeHumor sexualContentGraphicAndNudity
            sexualContentOrNudity violenceCartoonOrFantasy violenceRealisticProlongedGraphicOrSadistic violenceRealistic]
  no = %w[advertising ageAssurance gambling healthOrWellnessTopics lootBox messagingAndChat parentalControls
          socialMedia unrestrictedWebAccess userGeneratedContent]
  attrs = none.to_h { |k| [k, "NONE"] }.merge(no.to_h { |k| [k, false] })
  begin
    decl.update(attributes: attrs)
  rescue => e
    # بعض الحقول ممكن ما تكون مدعومة بهالنسخة من الـ API: منشيلها ومنعيد
    bad = e.message.scan(%r{/data/attributes/(\w+)}).flatten.uniq
    raise if bad.empty?
    results["age_rating_dropped"] = bad.join(",")
    decl.update(attributes: attrs.reject { |k, _| bad.include?(k) })
  end
end

step(results, "price_free") do
  c = Spaceship::ConnectAPI.client.tunes_request_client
  existing = c.get("v1/apps/#{app.id}/appPriceSchedule") rescue nil
  manual = (existing && existing.body.dig("data", "relationships", "manualPrices", "data")) || []
  if manual.any?
    results["price_note"] = "price already set — left as is"
  else
    pts = c.get("v1/apps/#{app.id}/appPricePoints", { "filter[territory]" => "USA", "limit" => 200 }).body["data"] || []
    free = pts.find { |p| p.dig("attributes", "customerPrice").to_f == 0.0 } or raise "free price point not found"
    body = {
      data: { type: "appPriceSchedules",
              relationships: { app: { data: { type: "apps", id: app.id } },
                               baseTerritory: { data: { type: "territories", id: "USA" } },
                               manualPrices: { data: [{ type: "appPrices", id: "${p1}" }] } } },
      included: [{ type: "appPrices", id: "${p1}", attributes: { startDate: nil },
                   relationships: { appPricePoint: { data: { type: "appPricePoints", id: free["id"] } } } }]
    }
    c.post("v1/appPriceSchedules", body)
  end
end

puts "RESULTS:"
results.each { |k, v| puts "  #{k}: #{v}" }
File.open(ENV["GITHUB_STEP_SUMMARY"] || "/dev/null", "a") { |f| f.puts("### App Store listing\n" + results.map { |k, v| "- **#{k}**: #{v}" }.join("\n")) }
