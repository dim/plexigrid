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
      content_tag(:div, '', :id => element_id) + "\n" + javascript_tag(plexigrid_js(element_id, options, labels))
    end

    def plexigrid_js(element_id, options = {}, labels = {})
      js_args = [element_id, PlexiGrid::Options.new(options), PlexiGrid::Options.new(labels)]
      "PlexiGrid.create(#{js_args.map(&:to_json).join(', ')});"
    end

  end
end