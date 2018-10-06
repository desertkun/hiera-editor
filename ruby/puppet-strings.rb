require 'puppet-strings'
require 'json'

search_patterns = JSON.parse(ARGV[0])
generate_options = {}
generate_options[:json] = ARGV[1]

PuppetStrings::generate(search_patterns, generate_options)
