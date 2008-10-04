module PlexiGrid 
  class Options < ::Hash    

    def initialize(other)
      super().replace(other)
    end
    
    def to_json(*args)
      inject({}) do |result, (key, value)|
        result.merge(key.to_s.camelize(:lower) => value)
      end.to_json(*args)
    end      
  end

  module Helper

    def plexigrid(options = {}, labels = {})
      element_id = 'plexigrid_' + Digest::SHA1.hexdigest(Time.now.to_s)
      content_tag(:div, '', :id => element_id) + "\n" + 
        javascript_tag("PlexiGrid.create(#{element_id.to_json}, #{PlexiGrid::Options.new(options).to_json}, #{PlexiGrid::Options.new(labels).to_json});")
    end    

  end
end