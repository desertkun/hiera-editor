require 'puppet'
require 'puppet/pops'
require 'fileutils'

def dump_parse(source, filename, options, show_filename = true)
  output = ""
  evaluating_parser = Puppet::Pops::Parser::EvaluatingParser.new
  begin
    if options[:validate]
      parse_result = evaluating_parser.parse_string(source, filename)
    else
      # side step the assert_and_report step
      parse_result = evaluating_parser.parser.parse_string(source)
    end
	require 'puppet/pops/pn'
	pn = Puppet::Pops::Model::PNTransformer.transform(parse_result)
	output << JSON.dump(pn.to_data)
  rescue Puppet::ParseError => detail
    if show_filename
      puts("--- #{filename}")
    end
    puts(detail.message)
    ""
  end
  return output
end

export_filename = ARGV[0]
dirname = File.dirname(export_filename)
unless File.directory?(dirname)
  FileUtils.mkdir_p(dirname)
end

File.open(export_filename, 'w') { |file| file.write(dump_parse(STDIN.read, 'stdin', {}, false)) }
