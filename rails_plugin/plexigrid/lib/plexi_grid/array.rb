class Array

  def to_plexigrid_options(options = {})
    serialization_options = options.delete(:serialize) || {}
    records = map do |record|
      PlexiGrid::Serializer.new(record, serialization_options).serializable_record
    end    
    options.inject({}) do |result, (key, value)|
      result.merge(key.to_s.camelize(:lower) => value)
    end.merge('records' => records)
  end
    
end
