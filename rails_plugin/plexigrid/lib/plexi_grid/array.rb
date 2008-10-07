class Array

  def to_plexigrid_options(options = {})
    options = options.symbolize_keys
    serialize = options.delete(:serialize) || {}
    totals = options.delete(:totals)
    
    options['records'] = map do |record|
      PlexiGrid::Serializer.new(record, serialize).serializable_record
    end    

    if totals
      options['totals'] = PlexiGrid::Serializer.new(totals, serialize).serializable_record 
    end
    
    options.inject({}) do |result, (key, value)|
      result.merge(key.to_s.camelize(:lower) => value)
    end
  end
    
end
