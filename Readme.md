
# <img src="https://user-images.githubusercontent.com/1666014/50780464-a779dd80-12ab-11e9-8e2e-43e7f0e8da38.png" width="24">  Hiera Editor
A GUI tool to manage your Puppet/Hiera for you.

<img src="https://user-images.githubusercontent.com/1666014/50780430-90d38680-12ab-11e9-8f83-916055fa8e70.png" width="888">

## Features
* Windows / MacOs
* Parses modules to extract class information like field names, types and doc strings
* Retrieves default values of class fields by doing best-effort compilation of Puppet AST on your machine
* Automatic field validation (for example, if module fails when you pass a value that does not match a regular expression)
* It can display icons for your classes (if you add a comment like `@option editor icon data:<base64-encoded icon>` to your class)
* You can mark you classes `@api private` and it will suggest the end user not to use them.

## Prerequisites
* Your hiera configuration files need to be stored in standard `<project>/environments/<environment>/data` folder for the tool to catch up.
* Add the [Hiera Resources](https://github.com/desertkun/hieraresources) module to your Puppet project
* The `<project>/environments/<environment>/manifetst/init.pp` file of the project needs to have the only line: `include hieraresources`

## Download
You can download it from [Releases](https://github.com/desertkun/hiera-editor/releases) page.

## Building from source
To build the project youself you'll need install [Node](https://nodejs.org/en/download/), 
clone this repo, open it in the terminal, and just do `npm install`, followed by `npm start` to run it. 
It also has debug configurations for Visual Studio Code.

## Todo
* Module management (installation, updating, removing)
* Retreive facts from target machine for accurate compilation of default values
* Parse ruby `<module>/lib/puppet/parser/functions` Puppet functions
