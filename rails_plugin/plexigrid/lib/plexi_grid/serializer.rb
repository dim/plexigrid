module PlexiGrid
  class Serializer < ActiveRecord::Serialization::Serializer
    
    class Wrapper
      include ActionView::Helpers
      
      @@cache = {}
      
      class << self

        def open(controller, *helpers)
          cached(controller, *helpers) || new(controller, *helpers)
        end
        private :new
                
        def cache!(wrapper, *helpers)
          @@cache[cache_key(*helpers)] ||= wrapper
        end

        def cached(controller, *helpers)
          returning(wrapper = @@cache[cache_key(*helpers)]) do
            wrapper.controller = controller if wrapper
          end
        end
                
        def cache_key(*helpers)
          helpers.map(&:name).join(' ')
        end
        private :cache_key        
      end
            
      attr_accessor :controller
      attr_reader :attribute_names

      def initialize(controller, *helpers)
        @controller = controller
        @attribute_names = helpers.flatten.map(&:public_instance_methods).flatten
        helpers.each do |helper|
          extend helper
        end
        self.class.cache!(self, *helpers)
      end

      def params
        controller.params
      end

      def respond_to?(selector)
        ActionController::Routing::Routes.named_routes.helpers.include?(selector) || super
      end
      
      def method_missing(selector, *args)
        ActionController::Routing::Routes.named_routes.helpers.include?(selector) ? controller.send(selector, *args) : super
      end
    end

    def serializable_record
      returning(result = super) do
        controller, *helpers = options[:extend]

        if controller.is_a?(ActionController::Base) && helpers.any?
          wrapper = Wrapper.open(controller, *helpers)
          wrapper.attribute_names.each do |name|
            result[name] = wrapper.send name.to_sym, @record
          end
          wrapper.controller = nil
        end
      end
    end
        
  end
end
