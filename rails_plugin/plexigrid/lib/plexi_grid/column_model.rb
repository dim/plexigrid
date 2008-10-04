module PlexiGrid
  class ColumnModel < Array

    attr_reader :order
    
    def initialize(&block)
      super([])
      yield self
    end
    
    def column(*args)
      push Column.new(*args)
    end
    alias_method :col, :column
    
    def order(value, options = {})
      PlexiGrid::Order.new(self, value, options)
    end

    def lookup_index
      @lookup_index ||= index_by(&:name)
    end
        
  end
     
end
