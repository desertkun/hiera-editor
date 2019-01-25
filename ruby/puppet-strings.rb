require 'puppet-strings'
require 'json'

search_patterns = ["*/manifests/**/*.pp", "*/functions/**/*.pp", "*/types/**/*.pp", "*/lib/**/*.rb"]
generate_options = {}
generate_options[:json] = true
generate_options[:path] = ARGV[0]

PuppetStrings::generate(search_patterns, generate_options)
