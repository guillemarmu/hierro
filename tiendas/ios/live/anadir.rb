# Añade al proyecto de Xcode que genera Capacitor la extensión «HierroLive» (Live Activity del entreno en curso)
# y la incrusta en la app. Además mete en la app el botón ✓ (HierroSerieHecha, que iOS ejecuta en la app) y su copia de
# HierroWorkoutAttributes. Se puede repetir: lo que ya está no se duplica. Lo llama preparar.sh (gema xcodeproj).
# Uso: ruby live/anadir.rb ios/App/App.xcodeproj
require 'xcodeproj'
require 'fileutils'

proj_path = ARGV[0] or abort('Falta la ruta del .xcodeproj')
NAME = 'HierroLive'
BUNDLE = 'io.github.guillemarmu.hierro.HierroLive'
TEAM = 'P8TDPVJAT8'
src = File.expand_path(__dir__)
dst = File.join(File.dirname(proj_path), NAME) # ios/App/HierroLive

proj = Xcodeproj::Project.open(proj_path)
app = proj.targets.find { |t| t.name == 'App' } or abort('No encuentro el target App')
# Los archivos se copian siempre (así un cambio en live/ llega aunque el target ya exista)
FileUtils.mkdir_p(dst)
files = %w[HierroWorkoutAttributes.swift HierroSerieHecha.swift HierroLiveWidget.swift Info.plist]
files.each { |f| FileUtils.cp(File.join(src, f), File.join(dst, f)) }

# App: el botón ✓ y los atributos (en ios/App/App, junto a AppDelegate.swift)
app_dir = File.join(File.dirname(proj_path), 'App')
app_group = proj.main_group.children.find { |g| g.respond_to?(:path) && g.path == 'App' } or abort('No encuentro el grupo App')
%w[HierroWorkoutAttributes.swift HierroSerieHecha.swift].each do |f|
  FileUtils.cp(File.join(src, f), File.join(app_dir, f))
  next if app.source_build_phase.files_references.any? { |r| r && r.path == f }
  app.add_file_references([app_group.new_reference(f)])
end

if proj.targets.any? { |t| t.name == NAME }
  proj.save
  puts "#{NAME} ya estaba en el proyecto (archivos actualizados)"
  exit 0
end

ext = proj.new_target(:app_extension, NAME, :ios, '16.2', nil, :swift)
group = proj.main_group.new_group(NAME, NAME)
refs = files.map { |f| group.new_reference(f) }
ext.add_file_references(refs.select { |r| r.path.end_with?('.swift') })

ext.build_configurations.each do |c|
  s = c.build_settings
  s['PRODUCT_NAME'] = NAME
  s['PRODUCT_BUNDLE_IDENTIFIER'] = BUNDLE
  s['INFOPLIST_FILE'] = "#{NAME}/Info.plist"
  s['GENERATE_INFOPLIST_FILE'] = 'NO'
  s['SWIFT_VERSION'] = '5.0'
  s['TARGETED_DEVICE_FAMILY'] = '1'
  s['IPHONEOS_DEPLOYMENT_TARGET'] = '16.2'
  s['DEVELOPMENT_TEAM'] = TEAM
  s['CODE_SIGN_STYLE'] = 'Automatic'
  s['SKIP_INSTALL'] = 'YES'
  s['APPLICATION_EXTENSION_API_ONLY'] = 'YES'
  s['MARKETING_VERSION'] = '1.0'
  s['CURRENT_PROJECT_VERSION'] = '1'
  s['LD_RUNPATH_SEARCH_PATHS'] = ['$(inherited)', '@executable_path/Frameworks', '@executable_path/../../Frameworks']
end

# Incrustar en App.app/PlugIns, justo después de las fuentes (al final, tras un script, Xcode ve un ciclo)
embed = app.new_copy_files_build_phase('Embed Foundation Extensions')
embed.symbol_dst_subfolder_spec = :plug_ins
bf = embed.add_file_reference(ext.product_reference, true)
bf.settings = {'ATTRIBUTES' => ['RemoveHeadersOnCopy']}
app.build_phases.delete(embed)
idx = app.build_phases.index { |p| p.is_a?(Xcodeproj::Project::Object::PBXSourcesBuildPhase) } || (app.build_phases.size - 1)
app.build_phases.insert(idx + 1, embed)
app.add_dependency(ext)

proj.save
puts "#{NAME} añadido (#{BUNDLE})"
