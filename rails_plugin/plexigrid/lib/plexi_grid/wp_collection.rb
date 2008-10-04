module WillPaginate
  class Collection < Array    

    def to_plexigrid_options(options = {})
      pager_options = [:per_page, :current_page, :total_pages, :total_entries].inject({}) do |result, name|
        result.merge(name => send(name))
      end      
      super(pager_options.merge(options))
    end

  end
end
