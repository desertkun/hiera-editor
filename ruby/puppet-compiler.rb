require 'puppet'
require 'puppet/parser'
require 'json'
require 'rubygems'

port = ARGV[0]

class NoSuchFunction < StandardError
end

def callable_functions_from(mod)
    Class.new { include mod }.new
end

def compile(function_name, function_args)

    function_module = Puppet::Parser::Functions.environment_module(Puppet.lookup(:current_environment))
    cff = callable_functions_from(function_module)

    if !cff.methods.include?("function_" + function_name)
        raise NoSuchFunction
    end

    result = cff.send("function_" + function_name, function_args)
    return result
end

def process_message(text)
    begin
        request = JSON.parse(text)
    rescue Exception => e
        return {
            "error" => e.to_s,
            "code" => 400
        }
    end

    if !request.is_a?(Hash) then
        return {
            "error" => "Not a hash",
            "code" => 400
        }
    end

    if !request.has_key?("action") then
        return {
            "error" => "Bad request",
            "code" => 400
        }
    end

    if !request.has_key?("id") then
        return {
            "error" => "Bad request",
            "code" => 400
        }
    end

    action = request["action"]
    id = request["id"]

    if action == "load" then
        scripts = request["scripts"]
        scripts.each do |script|
            begin
                require script
            rescue Exception => e
                STDERR.puts e.to_s
            end
        end
        return {
            "id" => id,
            "success" => true,
            "result" => "ok"
        }
    elsif action == "call" then
        function_name = request["function"]
        function_args = request["args"]

        begin
            result = compile(function_name, function_args)
        rescue NoSuchFunction => e
            return {
                "id" => id,
                "success" => false,
                "error" => e.message,
                "code" => 404
            }
        rescue Exception => e
            return {
                "id" => id,
                "success" => false,
                "error" => e.message,
                "code" => 500
            }
        else
            return {
                "id" => id,
                "success" => true,
                "result" => result
            }
        end
    end
end

while line = gets.chomp do
    response = process_message(line)
    puts JSON.generate(response)
    STDOUT.flush
end
