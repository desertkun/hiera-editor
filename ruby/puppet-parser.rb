require 'puppet'
require 'puppet/pops'
require 'puppet/pops/pn'
require 'fileutils'

class Puppet::Pops::Model::PNTransformer
  def transform_NilClass(e)
    Puppet::Pops::PN::Call.new('nop')
  end
end

def dump_parse(source, filename, options, show_filename = true)
  output = ""
  evaluating_parser = Puppet::Pops::Parser::EvaluatingParser.new
  begin
    parse_result = evaluating_parser.parser.parse_string(source)
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

files = JSON.parse(STDIN.read)

files.each do |export_filename, source|
  dirname = File.dirname(export_filename)

  unless File.directory?(dirname)
    FileUtils.mkdir_p(dirname)
  end

  File.open(export_filename, 'w') { |file| file.write(dump_parse(source, 'stdin', {}, false)) }
end

