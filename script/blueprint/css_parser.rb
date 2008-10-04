module Blueprint
  # Strips out most whitespace and can return a hash or string of parsed data
  class CSSParser
    attr_accessor :namespace
    attr_reader   :css_output, :raw_data
  
    # ==== Options
    # * <tt>css_string</tt> String of CSS data
    # * <tt>options</tt>
    #   * <tt>:namespace</tt> -- Namespace to use when generating output
    def initialize(css_string = "", options = {})
      @raw_data     = css_string
      @namespace    = options[:namespace] || ""
      compress(@raw_data)
    end
  
    # returns string of CSS which can be saved to a file or otherwise
    def to_s
      @css_output
    end
  
    # returns a hash of all CSS data passed
    #
    # ==== Options
    # * <tt>data</tt> -- CSS string; defaults to string passed into the constructor
    def parse(data = nil)
      data ||= @raw_data
    
      # wrapper array holding hashes of css tags/rules
      css_out = []
      # clear initial spaces
      data = strip_space(strip_side_space(data))
    
      # split on end of assignments
      data.split('}').each_with_index do |assignments, index|
        # split again to separate tags from rules
        tags, styles = assignments.split('{').map{|a| strip_side_space(a) }
        unless styles.blank?
          # clean up tags and apply namespaces as needed
          tags = strip_selector_space(tags)
          tags.gsub!(/\./, ".#{namespace}") unless namespace.blank?
      
          # split on semicolon to iterate through each rule
          rules = []
          styles.split(';').each do |key_val_pair|
            unless key_val_pair.nil?
              # split by property/val and append to rules array with correct declaration
              property, value = key_val_pair.split(':').map{|kv| strip_side_space(kv)}
              break unless property && value
              rules << "#{property}:#{value};"
            end
          end
          # now keeps track of index as hashes don't keep track of position (which will be fixed in Ruby 1.9)
          css_out << {:tags => tags, :rules => rules.to_s, :idx => index} unless tags.blank? || rules.to_s.blank?
        end
      end
      css_out
    end
  
    private
  
    # strip space after :, remove newlines, replace multiple spaces with only one space, remove comments
    def strip_space(string)
      string.gsub(/:\s*/, ':').gsub(/\n/, '').gsub(/\s+/, ' ').gsub(/(\/\*).*?(\*\/)/, '')
    end
    
    # remove newlines, insert space after comma, replace two spaces with one space after comma
    def strip_selector_space(string)
      string.gsub(/(\n)/, '').gsub(',', ', ').gsub(',  ', ', ')
    end
    
    # remove leading whitespace, remove end whitespace
    def strip_side_space(string)
      string.gsub(/^\s+/, '').gsub(/\s+$/, $/)
    end
  
    def compress(data)
      @css_output = ""
      parse(data).flatten.sort_by {|i| i[:idx]}.each do |line|
        @css_output += "#{line[:tags]} {#{line[:rules]}}\n"
      end
    end
  end
end
