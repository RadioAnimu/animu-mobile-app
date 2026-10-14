require 'xcodeproj'

# Add a separate UI-test scheme to the generated project after device archiving.
# It changes neither the archived app nor the shipping application targets.
project_path = File.join(ARGV.fetch(0), 'RdioAnimu.xcodeproj')
project = Xcodeproj::Project.open(project_path)
app = project.targets.find { |target| target.product_type == 'com.apple.product-type.application' }
raise 'Application target missing' unless app

name = 'AnimuReleaseSmokeTests'
test = project.targets.find { |target| target.name == name } ||
       project.new_target(:ui_test_bundle, name, :ios, '16.4')
test.add_dependency(app) unless test.dependencies.any? { |dependency| dependency.target == app }
group = project.main_group.find_subpath(name, true)
source_path = File.expand_path('../ios-tests/ReleaseSmokeUITests.swift', __dir__)
reference = group.files.find { |file| file.path == source_path } || group.new_file(source_path)
test.source_build_phase.add_file_reference(reference) unless test.source_build_phase.files_references.include?(reference)

test.build_configurations.each do |configuration|
  configuration.build_settings.delete('INFOPLIST_FILE')
  configuration.build_settings.merge!(
    'GENERATE_INFOPLIST_FILE' => 'YES',
    'PRODUCT_BUNDLE_IDENTIFIER' => 'com.nessjs.animu.release-smoke-tests',
    'SWIFT_VERSION' => '5.0',
    'TEST_TARGET_NAME' => app.name,
    'TARGETED_DEVICE_FAMILY' => '1',
    'ENABLE_TESTING_SEARCH_PATHS' => 'YES'
  )
end
project.save

scheme = Xcodeproj::XCScheme.new
scheme.add_build_target(app)
scheme.add_test_target(test)
scheme.test_action.build_configuration = 'Release'
scheme.save_as(project_path, 'AnimuReleaseSmoke', true)
