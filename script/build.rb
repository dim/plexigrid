#!/usr/bin/env ruby

ROOT_PATH = File.expand_path(File.dirname(__FILE__) + '/..')
SCRIPT_PATH = ROOT_PATH + '/script'  
SRC_PATH = ROOT_PATH + '/src'  
LIB_PATH = ROOT_PATH + '/lib'  

require SCRIPT_PATH + "/core_ext"
require SCRIPT_PATH + "/blueprint/css_parser"
require SCRIPT_PATH + "/packr"
require 'fileutils'


# Copy images
FileUtils.rm_r(LIB_PATH + '/images')
FileUtils.cp_r(SRC_PATH + '/images', LIB_PATH + '/images')


# Copy/compress CSS
FileUtils.rm_r(LIB_PATH + '/stylesheets')
FileUtils.mkdir(LIB_PATH + '/stylesheets')

Dir[SRC_PATH + '/stylesheets/*.css'].each do |css|
  output = Blueprint::CSSParser.new(File.read(css)).to_s
  File.open LIB_PATH + '/stylesheets/' + File.basename(css), 'w' do |file|
    file.write output
  end
end


# Copy/compress JS
FileUtils.rm_r(LIB_PATH + '/javascript')
FileUtils.mkdir(LIB_PATH + '/javascript')

Dir[SRC_PATH + '/javascript/*.js'].each do |js|
  output = Packr.new.pack File.read(js), :shrink_vars => true, :base62 => true
  File.open LIB_PATH + '/javascript/' + File.basename(js), 'w' do |file|
    file.write output 
  end
end
