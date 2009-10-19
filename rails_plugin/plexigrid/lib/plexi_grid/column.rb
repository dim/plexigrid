module PlexiGrid
  class Column  
    
    attr_reader :name, :width, :options
    
    def initialize(name, width, options = {})      
      @name, @width, @options = name.to_s, width.to_i, options.symbolize_keys
    end
    
    def sortable?
      options[:sortable] == true
    end
    
    def label
      options[:label] || name.titleize
    end
    
    def to_json(*args)
      to_hash.to_json(*args)
    end
    
    def to_hash
      options.except(:sql).inject({}) do |result, (key, value)|
        result.merge(key.to_s.camelize(:lower) => value)
      end.merge('name' => name, 'label' => label, 'width' => width)
    end
    
    def sql
      options[:sql] || name
    end  

  end
end
