Element.addMethods({
  clearDescendants: function(element){
    $(element).immediateDescendants().each(function(child){
      child.remove();
    });
    return $(element);
  },

  fakeHover: function(element) {
    element = $(element);
    element.
      observe('mouseover', function() { element.addClassName('hover');    }).
      observe('mouseout',  function() { element.removeClassName('hover'); });
    return element;
  }
});

var PlexiGrid = {
  Version: '0.4',

  create: function(element, options, labels) {
    element = $(element);
    var tr = new Element('tr');
    var table = new Element('table').
      insert( tr.wrap(new Element('thead')) ).
      insert( new Element('tbody') );

    var columnNames = options.columnModel.map(function(col) {
      var th = new Element('th', {
        'width'    : col.width,
        'align'    : (col.align || 'left')
      }).insert(col.label);
      Object.extend(th, {
        name     : col.name,
        sortable : col.sortable || false,
        titleize : col.titleize || false,
        invisible: col.invisible || false
      });
      tr.insert(th);
      return th.name;
    });

    element.replace(table);
    return new PlexiGrid.Grid(table, options, labels);
  },

  extend: function(element, options, labels) {
    element = $(element);

    var columns = element.down('thead tr:first').select('th').map(function(th){
      return Object.extend(th, {
        'name': th.innerHTML.gsub(/\W/,'_').gsub(/^_{1,}/,'').gsub(/_{1,}$/,'').gsub(/_{1,}/,'_').toLowerCase(),
        'sortable': true,
        'invisible': false,
        'titleize': false
      });
    });

    var records = element.select('tbody tr').map(function(tr) {
      var record = {};
      for(var i = 0, cells = tr.select('td'); i < cells.length; i++) {
        record[columns[i].name] = cells[i].innerHTML;
      }
      return record;
    });

    return new PlexiGrid.Grid(element, $H(options || {}).merge({records: records}).toObject(), labels);
  },

  DefaultOptions: {
    elementId: false,             // default HTML element ID of the global container
    height: 200,                  // default height
    width: 'auto',                // default width
    minHeight: 100,               // min height of table
    minWidth: 100,                // min width of table
    minColumnWidth: 30,           // min width of columns
    nowrap: true,                 // keep grid-cell content in one line
    title: null,                  // set title
    url: null,                    // URL for AJAX calls
    ajaxOptions: {method: 'get'}, // Options for AJAX calls
    records: [],                  // Records place holder
    totals: false,                // Totals row

    pagination: false,            // use pagination
    perPage: 15,                  // items per page
    currentPage: 1,               // current page number
    totalPages: 0,                // total pages
    totalEntries: 0,              // total records
    pageParam: 'page',            // parameter name for current page
    perPageParam: 'per_page',     // parameter name for per-page count
    totalEntriesParam: 'total_entries', // parameter name total entries count
    perPageChoices: [10, 30, 50], // choices for per-page select-box

    search: false,                // use search
    searchParam: 'term',          // parameter name for search term
    searchTerm: '',               // parameter name for search term

    sorting: true,                // use column ordering
    sortParam: 'order',           // parameter name for ordering
    sortName: false,              // name of the sorted  column
    sortDir: 'asc',               // current sort direction ['asc', 'desc']
    defaultSortDir: 'asc',        // default sort direction ['asc', 'desc']

    allowTableToggle: false,      // show or hide table toggle button
    allowColumnsToggle: true,     // show or hide column toggle button
    allowRowSelect: true,         // allow to select (highlight) rows
    minColumns: 1,                // minimum column count
    checkBoxesPerColumn: 8,       // how many checkboxes should be displayed in a column of the selector

    allowColumnsSwap: true,       // allow to swap columns
    allowColumnsResize: true,     // allow to resize columns

    cookieName: '__PlexiGrid__',  // Name of the cookie
    cookieOptions: {},            // Cookie options, e.g. { 'expires': 'Fri, 01 Jan 2010 08:00:00 GMT', 'domain': 'mydomain.com' }
    storeStyle: false,            // Store style in cookie
    applyStyle: false,            // Apply style from cookie
    styleName: 'default',         // Name of the style

    afterColumnSwap: false,       // Callbacks
    afterColumnResize: false,
    afterColumnToggle: false,
    afterTableResize: false
  },

  DefaultLabels: {
    error:         'Connection Error',
    pages:         'Page {current} of {total}',
    items:         'Displaying {from} to {to} of {total} items',
    processing:    'Processing, please wait ...',
    first:         'First page',
    previous:      'Previous page',
    next:          'Next page',
    last:          'Last page',
    reload:        'Refresh',
    search:        'Search',
    clear:         'Clear',
    noItems:       'No items',
    toggleTable:   'Minimize/Maximize Table',
    toggleColumns: 'Show/Hide Columns'
  },

  InternalCounter: 0
};

PlexiGrid.Grid = Class.create({
  initialize: function(table, options, labels) {
    this.id = PlexiGrid.InternalCounter++;
    this.options = $H(PlexiGrid.DefaultOptions).merge(options || {}).toObject();
    this.labels = $H(PlexiGrid.DefaultLabels).merge(labels || {}).toObject();

    this.table = table;
    this.columns = table.down('thead').select('th');
    this.cookie = {};

    this._readCookie();
    this._verifyOptions();
    this._initializeContainers();
    this._positionContainers();
    this._processTables();
    this._registerEvents();
    this._styleHeaders();
    this._loadData();

    if (this.options.allowColumnsResize) this.drags.createAll();
    if (this.options.allowColumnsToggle) this.ctSelector.populate();
    if (this.options.search || this.options.pagination) this.panel.populate();

    this._IEHacks();
  },

  currentEvent: false,

  inspect: function(){
    return "#<PlexiGrid.Grid id:"+ this.id +" >";
  },

  reloadColumns: function(){
    this.columns = this.header.down('thead').select('th');
    return this.columns;
  },

  columnModel: function(){
    return this.columns.map(function(column) {
      return ['name', 'align', 'invisible'].inject($H({}), function(result, key) {
        result.set(key, column[key]); return result;
      }).merge({
        'width': parseInt(column.box.style.width)
      }).toObject();
    });
  },

  storeStyle: function(key, value) {
    if (!this.options.storeStyle) return;

    if (!this.cookie[this.options.styleName]) this.cookie[this.options.styleName] = {};
    this.cookie[this.options.styleName][key] = value;
    try {
      var options = $H(this.options.cookieOptions).map(function(pair) {
        return pair.key + '=' + pair.value;
      }).join(';');
      document.cookie = this.options.cookieName + "=" + escape(Object.toJSON(this.cookie)) + (options.blank() ? '' : ';' + options);
    } catch(e) {}
  },

  findCells: function(name) {
    return this.table.select('td').select(function(td) { return td.name == name });
  },

  setSelectable: function(selectable){
    if (Prototype.Browser.IE || Prototype.Browser.WebKit || Prototype.Browser.MobileSafari) {
      this.global.onselectstart = function(event) { return selectable; };
    } else if (Prototype.Browser.Gecko) {
      this.global.style.MozUserSelect = (selectable ? null : 'none');
    }  else {
      this.global.writeAttribute('unselectable', (selectable ? null : 'on'));
    }
  },

  setLoading: function(status) {
    if (status) {
      this.lightBox.enable();
      this.panel.addClassName('plexigrid-loading') }
    else {
      this.lightBox.hide();
      this.panel.removeClassName('plexigrid-loading');
    }
  },

  applyStyle: function(style, container) {
    if (style.width) this.options.width = style.width;
    if (style.height) this.options.height = style.height;

    if (style.columnModel) {
      style.columnModel.each(function(colStyle) {
        var column = this.columns.find(function(c) { return c.name == colStyle.name });
        if (column) {
          $H(colStyle).keys().without('name').each(function(key){ column[key] = colStyle[key] });
          this.columns.last().insert({'after': column});
          this.columns = container.select('th');
        }
      }.bind(this));
    }
  },

  reload: function(options) {
    this.setLoading(true);
    this.panel.entryInformation.innerHTML = this.labels.processing;

    this.options = $H(this.options).merge(options).toObject();
    this.options.totalPages = Math.ceil(this.options.totalEntries / this.options.perPage);

    if (this.options.currentPage > this.options.totalPages) this.options.currentPage = this.options.totalPages;
    if (this.options.currentPage < 1) this.options.currentPage = 1;

    if (options && typeof options['searchTerm'] == 'string') {
      this.options.currentPage = 1;
      this.options.totalEntries = 0;
    }

    var requestParams = {};
    requestParams[this.options.pageParam] = this.options.currentPage;
    requestParams[this.options.perPageParam] = this.options.perPage;
    if (this.options.totalEntries > 0)
      requestParams[this.options.totalEntriesParam] = this.options.totalEntries;
    if (this.options.sortName)
      requestParams[this.options.sortParam] = this.options.sortName + ' ' + this.options.sortDir;
    if (!this.options.searchTerm.blank())
      requestParams[this.options.searchParam] = this.options.searchTerm;

    var requestOptions = $H(this.options.ajaxOptions).merge({
      onSuccess: function(rs){ this._reloadData(rs.responseText.evalJSON()); }.bind(this),
      onFailure: function(rs){ this.panel.indicateError(); }.bind(this),
      onComplete:function(rs){ this.setLoading(false); }.bind(this),
      parameters: requestParams
    }).toObject();
    new Ajax.Request(this.options.url, requestOptions);
  },

  _reloadData: function(options) {
    this.options = $H(this.options).merge(options).toObject();
    this._verifyOptions();
    this._styleHeaders();
    this._loadData();
    this.panel.reload();
  },

  _verifyOptions: function() {
    var o = this.options;
    if (!o.url) o.pagination = o.search = o.sorting = false;
    if (o.allowTableToggle && o.title == null) o.title = '&nbsp;';
    if (!o.perPageChoices.include(o.perPage)) o.perPageChoices.push(o.perPage);
  },

  _readCookie: function() {
    if (!this.options.applyStyle) return;

    var cookies = document.cookie.match(this.options.cookieName + '=(.*?)(;|$)');
    if (cookies) this.cookie = (unescape(cookies[1])).evalJSON();

    var style = this.cookie[this.options.styleName];
    if (style) this.applyStyle(style, this.table.down('thead'));
  },

  _initializeContainers: function() {
    this.global = PlexiGrid.Container.Global.create(this);
    this.header = PlexiGrid.Container.Header.create(this);
    this.body   = PlexiGrid.Container.Body.create(this);
    this.drags  = PlexiGrid.Container.Drags.create(this);
    this.title  = PlexiGrid.Container.Title.create(this);
    this.vGrip  = PlexiGrid.Container.VerticalGrip.create(this);
    this.hGrip  = PlexiGrid.Container.HorizontalGrip.create(this);
    this.panel  = PlexiGrid.Container.Panel.create(this);
    this.ctButton    = PlexiGrid.Container.CTButton.create(this);
    this.ctSelector  = PlexiGrid.Container.CTSelector.create(this);
    this.lightBox    = PlexiGrid.Container.LightBox.create(this);
    this.searchPanel = PlexiGrid.Container.SearchPanel.create(this);
  },

  _positionContainers: function() {
    this.table.wrap(this.global);
    this.table.insert({ before: this.header });
    this.table.wrap(this.body);
    this.header.down('table').insert(this.table.down('thead'));

    if (this.options.allowColumnsResize) this.global.insert({top: this.drags});
    if (this.options.title) this.global.insert({top: this.title});
    if (this.options.height != 'auto') this.global.insert(this.vGrip);
    if (this.options.width != 'auto') this.global.insert(this.hGrip.reposition());
    if (this.options.allowColumnsToggle) {
      this.header.insert(this.ctButton);
      this.global.insert(this.ctSelector);
    }
    if (this.options.search || this.options.pagination) {
      this.body.insert({after: this.panel});
    }
    if (this.options.search)
      this.body.insert({after: this.searchPanel});

    this.global.insert({top: this.lightBox});
  },

  _styleHeaders: function() {
    this.columns.each(function(th){
      th.removeClassName('plexigrid-sorted');
      th.box.removeClassName('plexigrid-s-asc').removeClassName('plexigrid-s-desc');
      if (this.options.sorting && th.name == this.options.sortName) {
        th.addClassName('plexigrid-sorted');
        th.box.addClassName('plexigrid-s-' + this.options.sortDir);
      };
    }.bind(this));
  },

  _loadData: function() {
    var tbody = this.table.down('tbody').clearDescendants();
    var i = 0;
    this.options.records.each(function(record){
      var tr = this._buildRow(record, (i % 2 == 0) ? 'plexigrid-odd' : 'plexigrid-even');
      tbody.insert(tr); i++;
    }.bind(this));
    if (this.options.totals) {
      var tr = this._buildRow(this.options.totals, ((i % 2 == 0) ? 'plexigrid-odd' : 'plexigrid-even') + ' plexigrid-totals');
      tbody.insert(tr);
    }
  },

  _buildRow: function(record, className){ // optimized for performance
    var tr = Object.extend($(document.createElement('tr')), { 'className': className });
    if (this.options.allowRowSelect)
      tr.observe('click', function() { tr.toggleClassName('plexigrid-selected') });

    this.columns.each(function(th){
      var td = Object.extend($(document.createElement('td')), { name: th.name });
      if (!th.visible()) td.hide();

      var value = record[th.name] == null ? '' : String(record[th.name]);
      var content = value.blank() ? '&nbsp;' : value;
      var style = 'text-align:' + th.align + ';' + 'width:' + th.box.style.width + ';' +
        (this.options.nowrap ? '' : 'white-space:normal;');
      var klass = '';

      if (this.options.sorting && th.name == this.options.sortName) {
        td.addClassName('plexigrid-sorted');
        klass = 'plexigrid-s-' + this.options.sortDir;
      };

      var title = record[th.titleize] ? record[th.titleize] : (th.titleize ? value : '');
      td.innerHTML = '<div style="'+style+'" class="'+klass+'" title="'+title+'">'+content+'</div>';
      tr.insert(td);
    }.bind(this));

    return tr;
  },

  _processTables: function(){
    this.table.writeAttribute({ cellSpacing: 0, cellPadding: 0, border: 0, width: null });
    if (this.options.height == 'auto') this.table.addClassName('plexigrid-auto-height');

    this.columns.each(function(th){
      var box = new Element('div').setStyle({textAlign:th.align, width:th.width + 'px'});
      box.innerHTML = th.innerHTML;

      th.update(box).writeAttribute({width: null});
      Object.extend(th, {'box': box}).
        observe('mousedown', PlexiGrid.Event.swapColumn.bindAsEventListener(this, th)).
        observe('mouseover', this._mouseOverColumn.bindAsEventListener(this, th)).
        observe('mouseout', this._mouseOutColumn.bindAsEventListener(this, th));
      if (this.options.sorting && th.sortable)
        th.observe('click', this._clickColumn.bindAsEventListener(this, th));
      if (th.invisible) th.hide();
    }.bind(this));
  },

  _registerEvents: function() {
    var mouseUp = function(event){ if (this.currentEvent) this.currentEvent.stop(event); }.bindAsEventListener(this);
    Event.observe(document, "mouseup", mouseUp);

    var mouseMove = function(event){ if (this.currentEvent) this.currentEvent.refresh(event); }.bindAsEventListener(this);
    Event.observe(document, "mousemove", mouseMove);
  },

  _IEHacks: function() {
    if (!Prototype.Browser.IE || window.XMLHttpRequest) return;

    this.global.select('tr').
      concat(this.global.select('th')).
      concat(this.drags.cache.values()).each(function(element) {
        element.fakeHover();
      });
  },

  _clickColumn: function(event, column) {
    if (!this.options.sorting || !column.sortable) return;
    var direction = this.options.defaultSortDir;
    if (column.name == this.options.sortName) direction = ( this.options.sortDir == 'desc' ? 'asc' : 'desc' );
    this.reload({ sortName: column.name, sortDir: direction });
  },

  _mouseOverColumn: function(event, column) {
    if (this.options.sorting && column.sortable && !this.currentEvent) {
      var klass = 'plexigrid-s-';
      if (column.name == this.options.sortName) {
        klass += ( this.options.sortDir == 'desc' ? 'asc' : 'desc' );
      } else {
        klass += this.options.defaultSortDir;
      };
      column.box.removeClassName('plexigrid-s-desc').removeClassName('plexigrid-s-asc').addClassName(klass);
    }
    if (this.currentEvent && this.currentEvent.name == 'swap_column') {
      this.currentEvent.mouseOver(column);
    }
  },

  _mouseOutColumn: function(event, column) {
    if (this.options.sorting && column.sortable && !this.currentEvent) {
      column.box.removeClassName('plexigrid-s-desc').removeClassName('plexigrid-s-asc');
      if (column.name == this.options.sortName) column.box.addClassName('plexigrid-s-' + this.options.sortDir);
    }
    if (this.currentEvent && this.currentEvent.name == 'swap_column') {
      this.currentEvent.mouseOut(column);
    }
  }
});

PlexiGrid.Container = {
  create: function(grid, tag, className, attributes) {
    var element = new Element(tag, attributes);
    element.addClassName(className);
    element.grid = grid;
    element.extend = function(s) { return Object.extend(this, s); }.bind(element);
    return element;
  }
};

PlexiGrid.Container.Global = {
  create: function(grid) {
    var element = PlexiGrid.Container.create(grid, 'div', 'plexigrid');
    if (grid.options.width != 'auto') element.setStyle({width: grid.options.width + 'px'});
    if (grid.options.elementId) element.id = grid.options.elementId;
    return element;
  }
};

PlexiGrid.Container.Header = {
  create: function(grid) {
    var element = PlexiGrid.Container.create(grid, 'div', 'plexigrid-header').
      insert('<div class="plexigrid-header-box"></div>');
    element.down().insert(new Element('table', {cellPadding: 0, cellSpacing: 0}));
    return element.observe('mouseover', this.mouseOver.bindAsEventListener(element));
  },

  mouseOver: function(event) {
    if (this.grid.options.allowColumnsToggle) {
      this.grid.ctButton.show().setStyle({
        left: (this.offsetLeft + this.scrollLeft + this.getWidth() - this.grid.ctButton.getWidth() - 5) + 'px'
      });
    }
  }
};

PlexiGrid.Container.Body = {
  create: function(grid) {
    var height = grid.options.height == 'auto' ? 'auto' : grid.options.height;
    var element = PlexiGrid.Container.create(grid, 'div', 'plexigrid-body').
      setStyle({ 'height': height + 'px' });
    return element.
      observe('scroll', this.doScroll.bindAsEventListener(element)).
      observe('mouseover', this.mouseOver.bindAsEventListener(element));
  },

  doScroll: function(event) {
    this.grid.header.scrollLeft = this.scrollLeft;
    this.grid.drags.reposition();
  },

  mouseOver: function(event) {
    this.grid.ctButton.hide();
    this.grid.ctSelector.hide();
  }
};

PlexiGrid.Container.Title = {
  create: function(grid) {
    var element = PlexiGrid.Container.create(grid, 'div', 'plexigrid-title');
    element.observe('mouseover', this.mouseOver.bindAsEventListener(element));

    if (grid.options.title) {
      element.update('<div class="plexigrid-title-label">' + grid.options.title + '</div>');

      if (grid.options.allowTableToggle) {
        var button = new Element('a', {className: 'plexigrid-title-toggle', title: grid.labels.toggleTable});
        element.insert(button.insert('<span></span>'));
        button.observe('click', this.toggleGrid.bindAsEventListener(button, grid));
      }
    }
    return element;
  },

  toggleGrid: function(event, grid) {
    this.toggleClassName('plexigrid-visible');
    grid.global.toggleClassName('plexigrid-hidden');
    grid.hGrip.reposition();
  },

  mouseOver: function(event) {
    this.grid.ctButton.hide();
    this.grid.ctSelector.hide();
  }
};

PlexiGrid.Container.Drags = {
  create: function(grid) {
    return PlexiGrid.Container.create(grid, 'div', 'plexigrid-drags').
      extend(this.Methods).
      extend({cache: $H()});
  }
};

PlexiGrid.Container.Drags.Methods = {
  createAll: function(){
    if (this.cache.size() > 0 || this.grid.columns.length == 0) return;

    this.grid.columns.each(function(th){
      var drag = Object.extend(new Element('div'), {name: th.name});
      drag.observe('mousedown', PlexiGrid.Event.resizeColumn.bindAsEventListener(this, drag));
      this.insert(drag);
      this.cache.set(drag.name, drag);
    }.bind(this));

    this.reposition();
  },

  reposition: function() {
    if (this.cache.size() == 0 && !this.grid.options.allowColumnsResize) return;
    this.setStyle({'top': this.grid.header.offsetTop + 1 + 'px'});

    var base = this.grid.header.scrollLeft;
    this.hide();

    var height = this.grid.header.getHeight() + this.grid.body.getHeight();
    this.grid.columns.each(function(th){
      if (th.visible()) {
        this.cache.get(th.name).setStyle({ 'left': (th.offsetLeft + th.getWidth() - this.grid.header.scrollLeft - 2) + 'px', 'height': height + 'px' }).show();
      } else {
        this.cache.get(th.name).hide();
      }
    }.bind(this));

    this.show();
    return this;
  }
};

PlexiGrid.Container.VerticalGrip = {
  create: function(grid) {
    var element = PlexiGrid.Container.create(grid, 'div', 'plexigrid-vgrip').insert('<span></span>');
    return element.observe('mousedown', PlexiGrid.Event.resizeTable.bindAsEventListener(element, 'V'));
  }
};

PlexiGrid.Container.HorizontalGrip = {
  create: function(grid) {
    var element = PlexiGrid.Container.create(grid, 'div', 'plexigrid-hgrip').
      extend(this.Methods).
      insert('<span></span>');
    return element.observe('mousedown', PlexiGrid.Event.resizeTable.bindAsEventListener(element, 'H'));
  }
};

PlexiGrid.Container.HorizontalGrip.Methods = {
  reposition: function() {
    this.style.height = this.grid.global.getHeight() + 'px';
    return this;
  }
};

PlexiGrid.Container.CTButton = {
  create: function(grid) {
    return PlexiGrid.Container.create(grid, 'a', 'plexigrid-ct-button', {title: grid.labels.toggleColumns, href:'#', onclick: 'return false;'}).
      insert('<span></span>').hide().
      observe('click', PlexiGrid.Event.toggleColumnSelector.bindAsEventListener(grid));
  }
};

PlexiGrid.Container.CTSelector = {
  create: function(grid) {
    return PlexiGrid.Container.create(grid, 'div', 'plexigrid-ct-selector').extend(this.Methods).hide();
  }
};

PlexiGrid.Container.CTSelector.Methods = {
  populate: function() {
    var tbody = new Element('tbody');
    this.insert(tbody.wrap(new Element('table', {cellPadding: 0, cellSpacing: 0})));
    this.setStyle({top: this.grid.body.offsetTop + 'px', right: 0 });

    var i = 0;
    this.grid.columns.inGroupsOf(Math.ceil(this.grid.columns.length / this.grid.options.checkBoxesPerColumn), null).each(function(group){
      var tr = new Element('tr');
      tbody.insert(tr);
      group.each(function(column){
        if (column == null) {
          tr.insert(new Element('th').insert('&nbsp;'));
        } else {
          var check = new Element('input', {
            id: 'plexigrid_ct_box_' + column.name + '_' + this.grid.id + '_' + i++,
            type: 'checkbox',
            value: column.name
          });
          check.observe('click', PlexiGrid.Event.toggleColumn.bindAsEventListener(this, check, column));
          tr.insert(new Element('td').fakeHover().
            insert(check.wrap('div')).
            insert('<label for="' + check.id + '">' + column.down('div').innerHTML + '</label>'));
          check.checked = column.visible(); // IE-Workaround: this has to be applied after check-box is inserted
        }
      }.bind(this));
    }.bind(this));
    return this;
  }
};

PlexiGrid.Container.Panel = {
  create: function(grid) {
    return PlexiGrid.Container.create(grid, 'div', 'plexigrid-panel').
      extend(this.Methods).
      update('<div class="plexigrid-panel-content"></div>');
  }
};

PlexiGrid.Container.Panel.Methods = {
  populate: function(){
    this.pageSelector = new Element('div');
    this.perPageSelector = new Element('div');
    this.entryInformation = new Element('div', {className: 'plexigrid-item-info'});

    if(this.grid.options.search) {
      this.down('div').
        insert(this._createSearchButton()).
        insert(PlexiGrid.Button.separator());
    }
    if (this.grid.options.pagination) {
      this.down('div').
        insert(this._reloadPerPageSelector()).
        insert(PlexiGrid.Button.separator()).
        insert(this._createNavigator('first')).
        insert(this._createNavigator('previous')).
        insert(PlexiGrid.Button.separator()).
        insert(this._reloadPageSelector()).
        insert(PlexiGrid.Button.separator()).
        insert(this._createNavigator('next')).
        insert(this._createNavigator('last')).
        insert(PlexiGrid.Button.separator()).
        insert(this._createNavigator('reload')).
        insert(PlexiGrid.Button.separator()).
        insert(this._reloadEntryInformation());
    }
  },

  reload: function(){
    this._reloadPageSelector();
    this._reloadPerPageSelector();
    this._reloadEntryInformation();
  },

  indicateError: function(){
    this.entryInformation.update(this.grid.labels.error);
  },

  _reloadPageSelector: function(){
    var content = '<input type="text" class="plexigrid-page" value="'+this.grid.options.currentPage+'" />';
    this.pageSelector.update( this.grid.labels.pages.sub('{current}', content).sub('{total}', this.grid.options.totalPages) );

    var input = this.pageSelector.down();
    input.observe('keypress', function(evt, el) {
      if (evt.keyCode == 13) { this.grid.reload({ currentPage: el.value }) }
    }.bindAsEventListener(this, input));

    return this.pageSelector;
  },

  _reloadPerPageSelector: function(){
    var element = new Element('select', {className: 'plexigrid-per-page'});
    element.observe('change', function(element){ this.grid.reload({ perPage: element.value }); }.bind(this, element));

    this.grid.options.perPageChoices.sort().each(function(choice){
      var option = new Element('option', {value: choice, selected: this.grid.options.perPage == choice});
      element.insert(option.insert(choice));
    }.bind(this));
    return this.perPageSelector.update(element);
  },

  _reloadEntryInformation: function(){
    var to = (this.grid.options.currentPage * this.grid.options.perPage);
    var content = this.grid.labels.items.
      sub('{from}', (this.grid.options.currentPage - 1) * this.grid.options.perPage + 1).
      sub('{to}', to > this.grid.options.totalEntries ? this.grid.options.totalEntries : to).
      sub('{total}', this.grid.options.totalEntries);
    return this.entryInformation.update(content);
  },

  _loadPage: function(name){
    var page = this.grid.options.currentPage;
    switch(name) {
      case 'first':    page = 1;  break;
      case 'previous': page -= 1; break;
      case 'next':     page += 1; break;
      case 'last':      page = this.grid.options.totalPages; break;
    };
    if (page > 0 && page <= this.grid.options.totalPages) this.grid.reload({ currentPage: page });
  },

  _toggleSearch: function(){
    this.grid.searchPanel.toggle();
    this.grid.searchPanel.down('input').focus();
  },

  _createNavigator: function(name) {
    return PlexiGrid.Button.create('plexigrid-button-' + name, this.grid.labels[name]).
      observe('click', this._loadPage.bind(this, name));
  },

  _createSearchButton: function() {
    return PlexiGrid.Button.create('plexigrid-button-search', this.grid.labels.search).
      observe('click', this._toggleSearch.bind(this));
  }

};

PlexiGrid.Container.LightBox = {
  create: function(grid) {
    return PlexiGrid.Container.create(grid, 'div', 'plexigrid-lightbox').
      extend(this.Methods).setOpacity(0.4).hide();
  }
};

PlexiGrid.Container.LightBox.Methods = {
  enable: function() {
    return this.setStyle({width:0, height:0}).show().clonePosition(this.grid.global);
  }
};

PlexiGrid.Container.SearchPanel = {
  create: function(grid) {
    if (!grid.options.search) return;

    var input = new Element('input', {type: 'text', size: 30});
    input.observe('keypress', function(evt, el) {
      if (evt.keyCode == 13) { grid.reload({ searchTerm: el.value }); }
    }.bindAsEventListener(this, input));

    var button = new Element('input', {type: 'button', value: grid.labels.clear}).
      observe('click', function() {
        input.value = '';
        grid.reload({ searchTerm: '' });
        grid.searchPanel.hide();
      });

    return PlexiGrid.Container.create(grid, 'div', 'plexigrid-search-panel').
      insert(grid.labels.search + ' ').insert(input).insert(button).hide();
  }
};

PlexiGrid.Button = {
  separator: function() {
    return new Element('div', {className:'plexigrid-separator'});
  },

  create: function(className, title) {
    return new Element('a', {
      'className': 'plexigrid-button ' + className,
      'href'     : '#',
      'onclick'  : "return false;",
      'title'    : title
    }).insert('<span></span>');
  }
};

PlexiGrid.Event = {
  resizeColumn: function(event, drag){
    if (!this.grid.options.allowColumnsResize) return;
    return new PlexiGrid.Event.ResizeColumn(this.grid, drag, event);
  },

  resizeTable: function(event, mode){
    if ((mode == 'V' && this.grid.options.height == 'auto') ||
      (mode == 'H' && this.grid.options.width == 'auto')) return;
    return new PlexiGrid.Event.ResizeTable(this.grid, mode, event);
  },

  swapColumn: function(event, column){
    if (!this.options.allowColumnsSwap) return;
    return new PlexiGrid.Event.SwapColumn(this, column, event);
  },

  toggleColumnSelector: function(event){
    if (!this.options.allowColumnsToggle) return;
    return this.ctSelector.toggle();
  },

  toggleColumn: function(event, check, column){
    if (!this.grid.options.allowColumnsToggle) return;

    var checked = this.select('input:checked');
    if (checked.length < this.grid.options.minColumns) {
      event.stop();
      return;
    } else {
      checked.each(function(check){
        check.disabled = (checked.length == this.grid.options.minColumns);
      }.bind(this));
    }

    var cells = this.grid.findCells(column.name); cells.push(column);
    cells.each(function(cell){
      check.checked ? cell.show() : cell.hide();
    }.bind(this));
    column.invisible = !check.checked;
    this.grid.drags.reposition();
    this.grid.storeStyle('columnModel', this.grid.columnModel());
    if (this.grid.options.afterColumnToggle) this.grid.options.afterColumnToggle(this.grid);
  }
};

PlexiGrid.Event.Base = Class.create({
  name: 'base',

  initialize: function(grid, event, cursor) {
    this.grid = grid;
    this.grid.currentEvent = this;
    this.grid.setSelectable(false);
    if (cursor) this.grid.global.setStyle({'cursor': cursor});
  },

  stop: function(event) {
    this.grid.global.setStyle({cursor: 'default'});
    this.grid.setSelectable(true);
    this.grid.currentEvent = false;
  }
});

PlexiGrid.Event.ResizeColumn = Class.create(PlexiGrid.Event.Base, {
  name: 'resize_column',

  initialize: function($super, grid, element, event) {
    $super(grid, event, 'col-resize');

    this.element = element;
    this.box = this.grid.columns.find(function(c){ return c.name == element.name }).box;

    this.dims = { 'L': parseInt(element.style.left), 'X': event.pageX, 'W': this.box.getWidth() };
    this.element.siblings().each(function(el){ el.hide() });
    this.element.addClassName('plexigrid-dragging');
  },

  refresh: function(event) {
    var moveX = event.pageX - this.dims.X;
    if (this.dims.W + moveX > this.grid.options.minColumnWidth) {
      this.element.style.left = this.dims.L + moveX + 'px';
    }
  },

  stop: function($super, event) {
    $super(event);

    this.box.style.width = (this.dims.W + event.pageX - this.dims.X) + 'px';
    this.grid.findCells(this.element.name).each(function(td){
      td.firstChild.style.width = this.box.style.width;
    }.bind(this));

    this.element.siblings().each(function(el){ el.show() });
    this.element.removeClassName('plexigrid-dragging');
    this.grid.header.scrollLeft = this.grid.body.scrollLeft;
    this.grid.drags.reposition();
    this.grid.storeStyle('columnModel', this.grid.columnModel());
    if (this.grid.options.afterColumnResize) this.grid.options.afterColumnResize(this.grid);
  }
});

PlexiGrid.Event.ResizeTable = Class.create(PlexiGrid.Event.Base, {
  name: 'resize_table',

  initialize: function($super, grid, mode, event) {
    $super(grid, event, (mode == 'V') ? 'row-resize' : 'col-resize');
    this.mode = mode;
    this.dims = {
      x: event.pageX,
      y: event.pageY,
      w: this.grid.global.getWidth(),
      h: this.grid.body.getHeight()
    };
  },

  refresh: function(event) {
    if (this.mode == 'V') {
      var newHeight = this.dims.h - this.dims.y + event.pageY;
      if (newHeight > this.grid.options.minHeight) {
        this.grid.options.height = newHeight;
        this.grid.body.style.height = newHeight + 'px';
        this.grid.hGrip.reposition();
      }
    } else if (this.mode == 'H') {
      var newWidth = this.dims.w - this.dims.x + event.pageX;
      if (newWidth > this.grid.options.minWidth) {
        this.grid.options.width = newWidth;
        this.grid.global.style.width = newWidth + 'px';
      }
    }
  },

  stop: function($super, event) {
    $super(event);
    this.refresh(event);
    this.grid.drags.reposition();
    if (this.mode == 'V') {
      this.grid.storeStyle('height', this.grid.options.height);
    } else if (this.mode == 'H') {
      this.grid.storeStyle('width', this.grid.options.width);
    }
    if (this.grid.options.afterTableResize) this.grid.options.afterTableResize(this.grid);
  }
});


PlexiGrid.Event.SwapColumn = Class.create(PlexiGrid.Event.Base, {
  name: 'swap_column',

  initialize: function($super, grid, column, event) {
    $super(grid, event, 'pointer');
    this.columnOver = null;
    this.column = column;
    this.shadow = new Element('div', {className: 'plexigrid-shadow'}).
      setStyle({'position':'absolute', 'float':'left'}).
      setOpacity(0.7).
      update(column.innerHTML).
      hide();
    $(document.body).insert(this.shadow);
    this.grid.drags.hide();
  },

  refresh: function(event) {
    this.shadow.setStyle({top: (event.pageY + 5) + 'px', left: (event.pageX + 5) + 'px'}).show();
  },

  stop: function($super, event) {
    $super(event);
    this.grid.drags.show();
    this.shadow.remove();
    this.shadow = null;

    if (this.columnOver) {
      var sources = this.grid.findCells(this.column.name); sources.push(this.column);
      var targets = this.grid.findCells(this.columnOver.name); targets.push(this.columnOver);
      for (var i = 0; i < sources.length; i++)
        this.isBefore() ? targets[i].insert({before: sources[i]}) : targets[i].insert({after: sources[i]});
      this.grid.reloadColumns();
      this.grid.drags.reposition();
    }
    this.grid.columns.each(function(col){ col.box.removeClassName('plexigrid-left').removeClassName('plexigrid-right'); });
    this.grid.storeStyle('columnModel', this.grid.columnModel());
    if (this.grid.options.afterColumnSwap) this.grid.options.afterColumnSwap(this.grid);
  },

  mouseOver: function(column){
    if (this.column == column) return;
    this.columnOver = column;
    column.box.addClassName(this.isBefore() ? 'plexigrid-left' : 'plexigrid-right');
  },

  mouseOut: function(column){
    this.columnOver = null;
    column.box.removeClassName('plexigrid-left').removeClassName('plexigrid-right');
  },

  isBefore: function() {
    return this.grid.columns.indexOf(this.column) > this.grid.columns.indexOf(this.columnOver);
  }
});
