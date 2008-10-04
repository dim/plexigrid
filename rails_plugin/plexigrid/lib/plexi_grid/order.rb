module PlexiGrid
  class Order < ::Hash
    
    def initialize(model, value, options = {})
      super()
      @model = model
      @column, @direction = use(value) || use(options[:default]) || use(@model.find(&:sortable?))      
      replace(:sort_name => @column.name, :sort_dir => @direction.downcase) if @column
    end

    def to_sql
      @column ? "#{@column.sql} #{@direction}" : nil
    end

    protected

      def use(value)
        name, direction = extract_column_name_and_direction(value)
        column = @model.lookup_index[name]
        column ? [column, direction] : nil
      end

      def extract_column_name_and_direction(value)
        value = value.to_s        
        [ value.gsub(/\b(DE|A)SC\s*$/i, '').strip, value.strip.downcase.ends_with?(' desc') ? 'DESC' : 'ASC' ]       
      end
    
  end
end