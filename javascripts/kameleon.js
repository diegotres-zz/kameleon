window.Kameleon = {};
Kameleon.ImagesControl = {};

// Screen
// ============================================================================
Kameleon.Screen = Backbone.Model.extend({
  
  avaliable_screens: [
    'mobile',
    'mobile_wide',
    'tablet',
    'tablet_wide',
    'desktop'
  ],
  
  defaults: {
    name        : 'mobile',
    min_width   : 0,
    max_width   : 999999,
    width       : 320
  },
  
  is_equal_or_larger_than: function(screen_name) {
    return this.get('width') > this.get(screen_name).min_width;
  },
  
  is_in_range: function(screen_from, screen_to) {
    return this.get(screen_from).min_width <= this.get('width') && this.get('width') <= this.get(screen_to).max_width;
  }
  
});
Kameleon.screen = new Kameleon.Screen;


// Screen Observer
// ============================================================================
Kameleon.ScreenObserver = Backbone.View.extend({
  el          : window,
  model       : Kameleon.screen,
  wait        : 500,
  events      : {'resize':'update'},
  
  initialize: function() {
    this.storage = $('head');
    this.update = _.debounce(this.publish, this.wait);
    this.publish(true);
    _.bindAll(this, 'update');
  },
  
  publish: function(first_time) {
    var attributes = {};
    if( first_time ) {
      $.extend(attributes, {
        mobile: { 
          min_width: parseInt(this.storage.css('padding-left'), 10),
          max_width: parseInt(this.storage.css('padding-right'), 10) 
        },
        
        mobile_wide: { 
          min_width: parseInt(this.storage.css('line-height'), 10),
          max_width: parseInt(this.storage.css('font-size'), 10) 
        },
        
        tablet: { 
          min_width: parseInt(this.storage.css('margin-left'), 10),
          max_width: parseInt(this.storage.css('margin-right'), 10)
        },
        
        tablet_wide: { 
          min_width: parseInt(this.storage.css('margin-bottom'), 10),
          max_width: parseInt(this.storage.css('margin-top'), 10)
        },
        
        desktop: { 
          min_width: parseInt(this.storage.css('padding-bottom'), 10),
          max_width: parseInt(this.storage.css('padding-top'), 10)
        }
      });
    }
    
    $.extend(attributes, {
      name      : this.storage.css('font-family'),
      min_width : parseInt(this.storage.css('min-width'), 10),
      max_width : parseInt(this.storage.css('max-width'), 10),
      width     : this.$el.width()
    });
    
    this.model.set(attributes);
  }
});
Kameleon.screen_observer = new Kameleon.ScreenObserver;


// Content Controller
// ============================================================================
Kameleon.ContentController = Backbone.View.extend({
  elements: [],
  initialize: function(options) {
    this.set_elements();
  },
  set_elements: function() {
    _.each($('[data-extra]'), $.proxy(function(element) {
      this.elements.push(new Kameleon.ContentExtra({ el: element }));
    }, this));
  }
});

// Content Extra
// ============================================================================
Kameleon.ContentExtra = Backbone.View.extend({
  initialize: function() {
    this.screens_targeted = [];
    this.set_attributes();
    this.get_screens_targeted();
    _.bindAll(this, 'load_content', 'check_screen_target');
    Kameleon.screen.on('change', this.load_content);
    Kameleon.screen.on('change', this.check_screen_target);
    this.on('content_loaded', this.render);
    this.load_content();
  },
  set_attributes: function() {
    this.loaded = false;
    this.src    = this.$el.data('extra')  || null;
    this.from   = this.$el.data('from')   || _.first(Kameleon.screen.avaliable_screens);
    this.to     = this.$el.data('to')     || _.last(Kameleon.screen.avaliable_screens);
    this.method = this.$el.data('method') || 'append';
  },
  load_content: function() {
    if(Kameleon.screen.is_in_range(this.from, this.to) && !this.loaded) {
      $.ajax({
        url: this.src,
        dataType: 'html',
        type: 'get',
        context: this,
        success: function(html){
          this.loaded = true;
          this.extra_content = $(html);
          this.trigger('content_loaded');
        }
      });
    }
  },
  render: function() {
    this.$el[this.method](this.extra_content);
    if( Kameleon.resources ) {
      var self = this;
      setTimeout(function(){
        Kameleon.resources.update(self.extra_content);
      }, 1000);
    }
  },
  get_screens_targeted: function() {
    var screens  = Kameleon.screen.avaliable_screens;
    var pos_from = screens.indexOf(this.from) || 0;
    var pos_to   = screens.indexOf(this.to) || screens.length-1;
    for (var i=pos_from; i <= pos_to; i++) {
      if(!~this.screens_targeted.indexOf(screens[i])) {
        this.screens_targeted.push(screens[i]);
      }
    };
  },
  check_screen_target: function(screen) {
    if(!!~this.screens_targeted.indexOf(screen.get('name'))) {
      $(this.extra_content).show();
    } else {
      $(this.extra_content).hide();
    }
  }
});

new Kameleon.ContentController;



// Resources Control
// ============================================================================
Kameleon.ImagesControl.Main = Backbone.View.extend({
  pictures             : [],
  dependencies_loaded  : [],
  dependencies_to_load : { mobile: [], mobile_wide: [], tablet: [], tablet_wide: [], desktop: [] },

  initialize: function() {
    this.all_pictures = $('picture');
    this.set_pictures();
    
    // com dependencia
    this.on('dependency_loaded', this.on_dependency_loaded);
    this.prepares_if_has_dependency();
    this.count_sources_with_dependency();
    this.check_dependencies();
    _.bindAll(this,'load_dependencies', 'load_images_without_dependencies');
    Kameleon.screen.on('change', this.load_dependencies);
    
    // sem dependencia
    Kameleon.screen.on('change', this.load_images_without_dependencies);
    this.load_images_without_dependencies();
  },
  update: function(async_html){
    this.set_pictures($(async_html));
    // com dependencia
    this.prepares_if_has_dependency();
    this.count_sources_with_dependency();
    this.check_dependencies();
    // sem dependencia
    this.load_images_without_dependencies();
  },
  set_pictures: function(async_html) {
    var pictures = async_html ? async_html.find('picture') : this.all_pictures;
    _.each(pictures, $.proxy(function(picture, i) {
      this.pictures.push(new Kameleon.ImagesControl.Picture({ el: picture, parent: this }));
    }, this));
  },
  count_sources_with_dependency: function() {
    var self = this;
    this.sources_with_dependency = 0;
    _.each(this.pictures, function(picture, i) {
      _.each(picture.sources, function(source, j) {
        if( source.data.dependency ) {
          self.sources_with_dependency += 1;
        }
      });
    });
  },
  check_dependencies: function() {
    _.each(this.pictures, function(picture) {
      picture.check_dependencies();
    },this);
  },
  check_if_dependencies_is_prepared: function() {
    if( this.sources_with_dependency > 0) {
      this.sources_with_dependency--;
      if(this.sources_with_dependency == 0) {
        this.load_dependencies();
      }
    }
  },
  prepares_if_has_dependency: function() {
    this.on('has_dependency', $.proxy(function(dependency, from, to) {
      this.add_dependency(dependency, from, to);
      this.check_if_dependencies_is_prepared();
    }, this));
  },
  add_dependency: function(dependency, from ,to) {
    var screens  = Kameleon.screen.avaliable_screens;
    var pos_from = ~screens.indexOf(from) ? screens.indexOf(from) : 0;
    var pos_to   = ~screens.indexOf(to) ? screens.indexOf(to) : screens.length - 1;
    
    for (var i=pos_from; i <= pos_to; i++) {
      if(!~_.indexOf(this.dependencies_to_load[screens[i]], dependency)) {
        this.dependencies_to_load[screens[i]].push(dependency);
      }
    };
  },
  load_dependencies: function() {
    var dependencies = this.dependencies_to_load[Kameleon.screen.get('name')];
    _.each(dependencies, $.proxy(function(dependency) {
      (function(dependency, self) {

        if(!!~_.indexOf(self.dependencies_loaded, dependency)) {
          self.trigger('dependency_loaded', dependency);
        } 
        else {
          yepnope.injectCss(dependency, function() {
            self.dependencies_loaded.push(dependency);
            self.trigger('dependency_loaded', dependency);
          });
        }
        
      })(dependency, this);
    },this));
  },
  on_dependency_loaded: function(dependency) {
    _.each(this.pictures, $.proxy(function(picture) {
      picture.trigger('dependency_loaded', dependency);
    }, this));
  },
  load_images_without_dependencies: function() {
    _.each(this.pictures, $.proxy(function(picture) {
      picture.trigger('load_image_without_dependency');
    }, this));
  }
  
});


// Picture
// ============================================================================
Kameleon.ImagesControl.Picture = Backbone.View.extend({
  initialize: function(options) {
    $.extend(this, options);
    _.bindAll(this,'check_screen_target');
    Kameleon.screen.on('change', this.check_screen_target);
    // com dependencia
    this.on('dependency_loaded', this.on_dependency_loaded);
    this.on('load_image_without_dependency', this.load_image_without_dependency);
    this.prepares_if_has_dependency();
    // sem dependencia
    this.image = new Image();
    this.screens_targeted = [];
    this.sources = [];
    this.set_sources();
    this.get_screens_targeted();
  },
  set_sources: function() {
    _.each(this.$el.find('source'), $.proxy(function(source, i) {
      this.sources.push(new Kameleon.ImagesControl.Source({ el: source, parent: this }));
    }, this));
  },
  get_screens_targeted: function() {
    var screens = Kameleon.screen.avaliable_screens;
    _.each(this.sources, $.proxy(function(source) {
      var pos_from = screens.indexOf(source.data.from) || 0;
      var pos_to = screens.indexOf(source.data.to) || screens.length-1;
      for (var i=pos_from; i <= pos_to; i++) {
        if(!~this.screens_targeted.indexOf(screens[i])) {
          this.screens_targeted.push(screens[i]);
        }
      };
    }, this));
  },
  prepares_if_has_dependency: function() {
    this.on('has_dependency', $.proxy(function(dependency, from, to) {
      this.parent.trigger('has_dependency', dependency, from, to);
    }, this));
  },
  check_dependencies: function() {
    _.each(this.sources, function(source) {
      source.check_dependencies();
    });
  },
  on_dependency_loaded: function(dependency) {
    var delay = 500;
    _.each(this.sources, function(source, i) {
      if(source.data.dependency == dependency) {
        setTimeout(function() {
          source.trigger('dependency_loaded', dependency);
        }, delay+i);
      }
    });
  },
  load_image_without_dependency: function() {
    var delay = 100;
    _.each(this.sources, function(source, i) {
      if(!source.data.dependency) {
        setTimeout(function() {
          source.trigger('load_image_without_dependency');
        }, delay+i);
      }
    });
  },
  render: function(data) {
    this.data = data;
    this.image.onload = $.proxy(function() {
      var img = $(this.image);
      img.attr('data-from', this.data.from);
      img.attr('data-to', this.data.to);
      img.data('from', this.data.from);
      img.data('to', this.data.to);
      img.attr('class', this.data['class']);
      img.attr('title', this.data['title']);
      this.$el.append(img);
    }, this);
    if( this.data.src && this.data.src != 'none' ) { this.image.src = this.data.src; }
    if( this.data.width ) { this.image.width  = this.data.width; }
    if( this.data.height ) { this.image.height = this.data.height; }
  },
  check_screen_target: function(screen) {
    if(!!~this.screens_targeted.indexOf(screen.get('name'))) {
      $(this.image).show();
    } else {
      this.image.src='';
      $(this.image).hide();
    }
  }
});


// Source
// ============================================================================
Kameleon.ImagesControl.Source = Backbone.View.extend({
  initialize: function(options) {
    $.extend(this,options);
    this.set_initial_data();
    this.on('dependency_loaded', this.on_dependency_loaded);
    this.on('load_image_without_dependency', this.load_image_without_dependency);
  },
  set_initial_data: function() {
    this.data = {
      from       : this.$el.data('from')       || _.first(Kameleon.screen.avaliable_screens),
      to         : this.$el.data('to')         || _.last(Kameleon.screen.avaliable_screens),
      dependency : this.$el.data('dependency') || null
    };
  },
  check_dependencies: function() {
    if(this.data.dependency) {
      this.parent.trigger('has_dependency', this.data.dependency, this.data.from, this.data.to);
    }
  },
  on_dependency_loaded: function() {
    $.extend(this.data, {
      src    : this.$el.css('background-image').replace(/(url\((.*)\))/g, "$2").replace(/"/g, ""),
      width  : parseInt(this.$el.css('width'), 10)  || '',
      height : parseInt(this.$el.css('height'), 10) || '',
      'class': this.$el.attr('class') || '',
      title  : this.$el.attr('title') || ''
    });
    this.parent.render(this.data);
  },
  load_image_without_dependency: function() {
    if(Kameleon.screen.is_in_range(this.data.from, this.data.to) ) {
      $.extend(this.data, {
        src    : this.$el.attr('src') || this.$el.css('background-image').replace(/(url\((.*)\))/g, "$2").replace(/"/g, "") || null,
        width  : parseInt(this.$el.attr('width'),10)  || null,
        height : parseInt(this.$el.attr('height'),10) || null,
        'class': this.$el.attr('class') || '',
        title  : this.$el.attr('title') || ''
      });
      if(this.data.src) {
        this.parent.render(this.data);
      }
    }
  }
});



Kameleon.resources = new Kameleon.ImagesControl.Main();













// Dependencies
// ============================================================================
Kameleon.DependenciesControl = Backbone.Model.extend({
  defaults: {
    loaded: [],
    javascripts: { mobile:[], mobile_wide:[], tablet:[], tablet_wide:[], dektop:[] },
    stylesheets: { mobile:[], mobile_wide:[], tablet:[], tablet_wide:[], dektop:[] }
  },
  initialize: function() {
    this.on('change', this.load_dependencies, this);
    Kameleon.screen.on('change', this.load_dependencies, this);
  },
  load_dependencies: function() {
    var self = this
      , screen_name = Kameleon.screen.get('name');
    
    // stylesheets
    _.each(this.attributes.stylesheets[screen_name], $.proxy(function(url) {
      if(!~this.attributes.loaded.indexOf(url)) {
        yepnope.injectCss(url, $.proxy(function() {
          this.attributes.loaded.push(url);
          this.trigger('dependency_loaded', url);
        }, this));
      }
    }, this));
        
    // javascripts
    Modernizr.load([
      {
        test: this.attributes.javascripts[screen_name],
        yep: this.attributes.javascripts[screen_name],
        callback: $.proxy(function(url, result, key) {}, this),
        complete: $.proxy(function() {
          this.trigger('dependency_loaded');
        }, this)
      }
    ]);
  },
  load: function() {
    
  }
});


Kameleon.dependencies = new Kameleon.DependenciesControl;












