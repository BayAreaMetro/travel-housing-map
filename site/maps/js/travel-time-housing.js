var gov = {ca: {mtc: {}}},
		po = org.polymaps;
var NIL = -999,
		BLUE = "#009DDC";

(function(mtc) {

 	mtc.scenarioLoader = function() {
		var loader = {},
				req = null;
		loader.dispatch = po.dispatch(loader);

		loader.load = function(url) {
			if (req) {
				loader.dispatch({type: "abort", request: req});
				req.abort();
				req = null;
			}
			req = $.ajax(url, {
				dataType: "text",
				success: function(text) {
					req = null;
					var rows = parseCSV(text);
					loader.dispatch({type: "load", data: rows});
				},
				error: function(xhr, error, message) {
					req = null;
					loader.dispatch({type: "error", req: xhr, text: message});
				}
			});
			req.url = url;
			loader.dispatch({type: "loading", request: req, url: url});
			return req;
		};

		loader.loading = function() {
			return req;
		};

		return loader;
	};

	mtc.travelTimeMap = function(selector) {
		var controller = {};
		controller.dispatch = po.dispatch(controller);

		// The map and jQuery objects for finding various controls
		var map, container, form, permalinks,
				// Where messages go
				stdout = $("#stdout"),
				// The Google Maps Geocoder
				geocoder,
				// The TAZ GeoJSON layer
				shapes, filters,
				originMarker,
				destMarker;
		
		var priceRange = {};

		var state = {};
		// these variables go into the scenario request URI
		// state.scenario = "2005"; // scenario directory name
		state.time = "AM"; // morning commute
		// state.direction = "from"; // from origin to dest
		state.origin = null; // origin TAZ
		// the destination is a row with the destination TAZ's id
		state.dest = null; // destination TAZ
		// the mode is a column
		state.mode = "da"; // drive alone

		// The color scale
		var colorScale = controller.colorScale = pv.Scale.linear()
			.domain(NIL, 	0,			15, 		30, 		60)
			// .range("#000", "#063", "#063", "#8c7", "#ffc");
			.range("#000", "#009DDC", "#009DDC", "#d87", "#ffe");

		colorScale.domain(NIL, 		0,			60, 		90);
		colorScale.range("#000",	"#d09", "#fd6", "#ffe");

		/*
		colorScale.domain(NIL, 	0, 5,			30, 60, 90);
		colorScale.range("#000", "#a73", "#a73", "#d83", "#fc6", "#ffe");
		*/

		// keep features around by ID, for cross-referencing from CSV data
		var featuresById = {};
		// get the ID of a TAZ feature from its properties
		function tazID(feature) {
			return feature.properties["TAZ1454"];
		}

		/*
		 * Get the current travel time (to or from the selected origin/dest
		 * TAZ) for a given feature.
		 */
		function travelTime(feature) {
			return (typeof feature.properties.travel == "object")
				? feature.properties.travel[state.mode]
				: NIL;
		}
		
		/* 
		 *
		 */
		function housingPrice(feature){
			return (feature.properties.average_value_per_unit)
				? feature.properties.average_value_per_unit
				: NIL;
		}
		
		// determine if a feature is selected (either the origin or dest TAZ)
		function selected(feature) {
			return feature.id == state.origin_taz || feature.id == state.dest_taz;
		}

		// get the "default" color of a feature (this
		function defaultColor(feature) {
			return selected(feature) ? BLUE : "none";
		}

		function getTitle(feature) {
			return formatTime(travelTime(feature)) || "unknown";
		}

		function displayFilter(feature) {
			if (selected(feature)) {
				return "";
			} else {
				if (filters && filters.length) {
					return filters.every(function(filter) {
						return filter.call(null, feature);
					}) ? "" : "none";
				} else {
					return "";
				}
			}
		}

		var style = po.stylist()
			.title(getTitle)
			.attr("title", getTitle)
			.attr("id", function(feature) { return "taz" + feature.id; })
			.attr("class", "tazact") // sets class for tooltip to grab
			.attr("display", displayFilter)
			.attr("stroke", defaultColor)
			.attr("stroke-width", function(feature) { return selected(feature) ? 1 : .15; })
			.attr("fill", function(feature) {
				if (typeof feature.properties.travel == "object") {
					var value = travelTime(feature);
					if (value == NIL) {
						return defaultColor(feature);
					} else {
						return colorScale(value).color;
					}
				} else {
					return defaultColor(feature);
				}
			});

		// re-show the layer
		function applyStyle() {
			shapes.reshow();
			dispatchInfo();
		}

		// clear the shapes
		function clearStyle() {
			for (var id in featuresById) {
				delete featuresById[id].properties.travel;
			}
			shapes.reshow();
			dispatchInfo();
		}

		function dispatchInfo() {
			var origin = featuresById[state.origin_taz],
					dest = featuresById[state.dest_taz];

			if (origin) origin.location = state.origin_location;
			if (dest) dest.location = state.dest_location;

			var e = {type: "travel-time", origin: origin, dest: dest};
			if (state && dest) {
				e.time = travelTime(dest);
				if (state.origin_location && state.dest_location) {
					try {
						var coords = [state.origin_location, state.dest_location],
								xmin = min(coords, prop("lon").get),
								xmax = max(coords, prop("lon").get),
								ymin = min(coords, prop("lat").get),
								ymax = max(coords, prop("lat").get);
						e.extent = [{lon: xmin, lat: ymin}, {lon: xmax, lat: ymax}];
					} catch (err) {
						// console.log("ERROR calculating extent:", err);
					}
				}
			}
			controller.dispatch(e);
		}
		
		function dispatchStdout(_class,_msg){
			// bin classes
			if(_class == "loaded" || _class == "")_class = "good";
			if(_class && _class.length) stdout.attr("class", _class)
			if(_msg && _msg.length) stdout.attr("title",_msg);
		}

		var scenarioReq;
		/**
		 * Load the current scenario. This builds a URL from the state; sends an
		 * AJAX request; and on success parses the response as CSV, assigns feature
		 * properties according to the loaded travel times, and renders the
		 * choropleth. On error it outputs some text and bails.
		 */
		function loadScenario() {
			if (scenarioReq) {
				dispatchStdout( "aborting", "Aborting previous request...");
				scenarioReq.abort();
				scenarioReq = null;
			}
			
			dispatchStdout( "loading", "Loading scenario data...");
			
			var url = "/data/scenarios/2005/time/" + [state.time, "from", state.origin_taz].join("/") + ".csv";
			return scenarioReq = $.ajax(url, {
				dataType: "text",
				success: function(text) {
					var rows = parseCSV(text),
							len = rows.length;
					for (var i = 0; i < len; i++) {
						var row = rows[i];
						if (!isNaN(row.dest) && row.dest in featuresById) {
							featuresById[row.dest].properties.travel = row;
						}
					}
					applyStyle();
					
					dispatchStdout( "loaded", "Loaded " + commize(len) + " rows");
				},
				error: function(xhr, err, text) {
					dispatchStdout("error", "Loaded " + "Error loading scenario: " + text);
				}
			});
		}

		// update permalinks on map move
		function onMapMove(e) {
			updateHrefs(permalinks, null, window.location.hash);
		}

		var svg = {
			element: function(name, attrs) {
				var el = po.svg(name);
				if (attrs) {
					for (var a in attrs) {
						el.setAttribute(a, attrs[a]);
					}
				}
				return el;
		 	},
			label: function(text, attrs) {
				var label = svg.element("text", $.extend({
					"fill": "#fff",
					"font-weight": "bold",
					"text-anchor": "middle"
				}, attrs || {}));
				label.appendChild(document.createTextNode(text));
				return label;
		  },
			title: function(el, title) {
				var t = el.appendChild(po.svg("title"));
				t.appendChild(document.createTextNode(title));
				el.setAttribute("title", title);
				return t;
		 	}
		};

		////////// TOOLTIP //////////////
		// being initiated from onShapesLoad
		//
		function theTip() {
			this.closetimer = null;
			this.tipRef = $("#taztip");
			this.txtRef = $("#tazinfo");
			this.tipState = false;
			this.oldTitleElm = null;
			this.oldTitleAttr = null;
			this.tipHeight = null;
			this.mapCoord = null;
			var self = this;

			var selectors = ".tazact, #crosshairs";
			
			this.setTip = function(){

				$(selectors).unbind('mouseover').unbind('mouseout');

				//$('#travel-time')
				self.mapCoord = $('#travel-time').offset();
				
				$(selectors).mouseover(function(e){
					e.preventDefault();
					clearTimeout(self.closetimer);
					//console.log(featuresById[1453]);
					
					// set txt
					self.txtRef.html( $(this).attr('title') );
					
					// store old title stuff
					self.oldTitleAttr = $(this).attr('title');
					self.oldTitleElm = $(this).find("title");
					// remove title stuff
					$(this).removeAttr('title');
					$(this).find("title").remove();
					
					// adjust width to size of txt
					// TODO: still a bug when the tip get's next to edge of map
					self.tipRef.css("width", "auto");
				
					// set width and offset margin to center tip based on new width above
					var _w = self.tipRef.width();
					self.tipRef.css("width",_w+"px");
					self.tipRef.css("margin-left", "-"+(_w*.5)+"px");
					
					// set the height var
					self.tipHeight = self.tipRef.height();
					
					// show tip and set state flag
					self.tipRef.show();
					self.tipState = true;
					
					container.unbind('mousemove').mousemove(function(e){
						if (self.tipState){
							var _x = e.pageX - self.mapCoord.left;
							var _y = (e.pageY - self.mapCoord.top) - (15+self.tipHeight);
							self.tipRef.css("left", _x).css("top", _y);
						}
					});
					
				});
				
				$(selectors).mouseout(function(e){
					e.preventDefault();
					// replace title stuff
					if (self.oldTitleAttr) $(this).attr('title', self.oldTitleAttr);
					if (self.oldTitleElm) $(this).append(self.oldTitleElm);
					self.tipState = false;
					// start close timer
					self.closetimer = setTimeout(function(){
						self.closeTip();
					}, 100);
				});
			}

			this.closeTip = function(){
				$('#travel-time').unbind('mousemove');
				self.tipRef.hide();
				self.txtRef.text("");
			}
		}

		var tipController = new theTip();
		
		////////// END TOOLTIP //////////////
		
		// when the shapes load, stash the features in the featuresById hash, apply
		// the style, and load the scenario if there's an origin_taz
		
		
		function onShapesLoad(e) {
			// reset price ranges
			priceRange.minPrice = Infinity;
			priceRange.maxPrice = 0;
			
			var features = e.features,
					len = features.length;
			for (var i = 0; i < len; i++) {
				var feature = e.features[i].data;
				feature.id = tazID(feature);
				featuresById[feature.id] = feature;
				if (selected(feature)) {
					var el = e.features[i].element;
					el.parentNode.appendChild(el);
				}
				
				if(feature.properties.average_value_per_unit){
					var _price = feature.properties.average_value_per_unit;
					if(_price < priceRange.minPrice)priceRange.minPrice = _price;
					if(_price > priceRange.maxPrice)priceRange.maxPrice = _price;
				}
			}

			// apply the current style
			style(e);
			if (state.origin_taz) {
				loadScenario();
			}
			tipController.setTip(); // set tooltip events for TAZ's

			var down = null, waiting = false,
					click = null, timeout = null,
					shps = shapes.container();
			shps.setAttribute("cursor", "pointer");
			var select = defer(250, function() {
				if (!click) return;
				var delta = click.timeStamp - down;
				if (delta > 500) {
					// console.log("not a click");
					return false;
				}
				var match = click.target.id.match(/^taz(\d+)$/),
						pos = {x: click.offsetX, y: click.offsetY};
				if (match) {
					var id = match[1],
							feature = featuresById[id];
					if (feature) {
						controller.dispatch({
							type: "select-taz",
							id: id,
							feature: feature,
							location: map.pointLocation(pos)
						});
					}
				}
				return true;
			});

			$(shps).mousedown(function(e) {
				down = e.timeStamp;
			});
			$(shps).click(function(e) {
				click = e;
				timeout = select();
			});
			$(shps).dblclick(function(e) {
				click = null;
				clearTimeout(timeout);
			});
			
			// call function that was waiting for shapes to be loaded
			if(processOnShapeLoad != null){
				processOnShapeLoad();
				//processOnShapeLoad = null;
			}
		}

		function onShapesShow(e) {
			style(e);
		}

		function lookupTAZ(str, success, failure, locate) {
			// if it's in the form "TAZ:id", return the id portion
			var taz = getTAZ(str);
			if (taz) {
				if (success) success.call(null, taz);
				return false;
			}
			// if it's a "lat,lon" string, lookup the location
			var latlon = $.fn.htmapl.getLatLon(str);
			if (latlon) {
				return location2taz(latlon, {
					success: function(taz) {
						success.call(null, taz, latlon);
					},
					error: failure
				});
			}

			// if there isn't a geocoder yet, try creating one
			if (!geocoder) {
				try {
					geocoder = new google.maps.Geocoder();
				} catch (e) {
					return failure.call(null, "No geocoder available! (is the Google Maps API loaded yet?)");
				}
			}

			var data = {"address": str, "region": "us"},
					extent = map.extent();
			var LatLng = google.maps.LatLng;
			data.bounds = new google.maps.LatLngBounds(
					new LatLng(extent[0].lat, extent[0].lon),
					new LatLng(extent[1].lat, extent[1].lon));
			// otherwise, treat it as an address for geocoding
			return geocode(geocoder, data, function(result) {
				return location2taz(result.location, {
					success: function(taz) {
						success.call(null, taz, result.location);
					},
					error: failure
				});
			}, failure);
		}

		function lookupOrigin(loc, success, failure) {
			dispatchStdout("loading", "Looking up &ldquo;" + loc + "&rdquo;...");
			updateHrefs(permalinks, {"origin": loc}, window.location.hash);
			state.origin = loc;
			state.origin_location = null;
			clearStyle();
			updateMarkers();
			return lookupTAZ(loc, function(taz, latlon) {
				dispatchStdout("loaded", "Found origin TAZ: " + taz);
				state.origin_location = latlon;
				updateMarkers();
				applyOrigin(taz);
				controller.dispatch({
					type: "locate-origin", 
					location: latlon,
					taz: taz,
					feature: featuresById[taz]
				});
				if (success) success.call(null, latlon, taz, featuresById[taz]);
			}, function(req, error, message) {
				dispatchStdout("error", "ERROR: " + message);
				
				if (failure) failure.call(null, error);
			});
		}

		function applyOrigin(taz) {
			state.origin_taz = taz;
			if (state.origin_taz) {
				loadScenario();
			}
			return false;
		}

		function lookupDest(loc, success, failure) {
			dispatchStdout("loading", "Looking up &ldquo;" + loc + "&rdquo;...");
			updateHrefs(permalinks, {"dest": loc}, window.location.hash);
			state.dest = loc;
			state.dest_location = null;
			updateMarkers();
			return lookupTAZ(loc, function(taz, latlon) {
				dispatchStdout("loaded", "Found dest. TAZ: " + taz);
				state.dest_location = latlon;
				updateMarkers();
				applyDest(taz);
				controller.dispatch({
					type: "locate-dest", 
					location: latlon,
					taz: taz,
					feature: featuresById[taz]
				});
				if (success) success.call(null, latlon, taz, featuresById[taz]);
			}, function(req, error, message) {
				dispatchStdout("error", "ERROR: " + message);
				if (failure) failure.call(null, error);
			});
		}

		function applyDest(taz) {
			state.dest_taz = taz;
			applyStyle();
			return false;
		}

		function updateMarkers() {
			var features = [],
					origin, dest;

			if (state.origin && state.origin_location) {
				originMarker.attr("title", "Origin: " + state.origin);
				originMarker.data("location", formatLocation(state.origin_location));
				originMarker.show();
			} else {
				originMarker.attr("title", null).data("location", null).hide();
			}

			if (state.dest && state.dest_location) {
				destMarker.attr("title", "Origin: " + state.origin);
				destMarker.data("location", formatLocation(state.dest_location));
				destMarker.show();
			} else {
				destMarker.attr("title", null).data("location", null).hide();
				destMarker.hide();
			}

			if (typeof map.updateMarkers == "function") {
				map.updateMarkers();
			}
		}

		function makePoint(loc, props, id) {
			return {
				type: "Feature",
				id: id,
				properties: props || {},
				geometry: {
					type: "Point",
					coordinates: [loc.lon, loc.lat]
				}
			};
		}

		// get/set the container element
		controller.container = function(x) {
			if (arguments.length) {
				originMarker = destMarker = null;
				container = x;
				originMarker = container.find("#origin-marker");
				destMarker = container.find("#dest-marker");
				return controller;
			}
		};

		// get/set the map
		controller.map = function(x) {
			if (arguments.length) {
				if (map) {
					map.off("move", onMapMove);
				}
				map = x;
				if (map) {
					map.on("move", onMapMove);
				}
				return controller;
			} else {
				return map;
			}
		};

		// get/set the shapes layer
		controller.shapes = function(x) {
			if (arguments.length) {
				if (shapes) {
					shapes.off("load", onShapesLoad);
					shapes.off("show", onShapesShow);
				}
				shapes = x;
				if (shapes) {
					shapes.on("load", onShapesLoad);
					shapes.on("show", onShapesShow);
				}
				return controller;
			} else {
				return shapes;
			}
		};

		controller.filters = function(x) {
			if (arguments.length) {
				filters = x;
				// applyStyle();
				return controller;
			} else {
				return filters;
			}
		};

		controller.updateFilters = function() {
			shapes.off("show", onShapesShow);
			var display = po.stylist().attr("display", displayFilter);
			shapes.on("show", display);
			shapes.reshow();
			shapes.off("show", display);
			shapes.on("show", onShapesShow);
		};
		
		
		var processOnShapeLoad = null;
		// accepts a function to be called after shapes processed
		controller.processOnShapeLoad = function(x) {
			if (arguments.length) {
				processOnShapeLoad = x;
				// applyStyle();
				return controller;
			} else {
				return processOnShapeLoad;
			}
		};

		// export this for use outside
		controller.housingPrice = housingPrice;
		controller.travelTime = travelTime;
		controller.priceRange = priceRange;

		// get/set the input form
		controller.form = function(x) {
			if (arguments.length) {
				form = x;
				if (!permalinks) permalinks = form.find("a.permalink");
				return controller;
			} else {
				return form;
			}
		};

		controller.permalinks = function(x) {
			if (arguments.length) {
				permalinks = x;
				return controller;
			} else {
				return permalinks;
			}
		}

		// get/set the stdout element
		controller.stdout = function(x) {
			if (arguments.length) {
				stdout = $(x);
				return controller;
			} else {
				return stdout;
			}
		};

		// get/set the travel mode (instantaneous)
		controller.mode = function(x) {
			if (arguments.length) {
				state.mode = x;
				applyStyle();
				updateHrefs(permalinks, {"mode": state.mode}, window.location.hash);
			} else {
				return state.mode;
			}
		};

		// get/set the time of day (async)
		controller.time = function(x) {
			if (arguments.length) {
				state.time = x;
				updateHrefs(permalinks, {"time": state.time}, window.location.hash);
				if (state.origin_taz) {
					loadScenario();
				}
			} else {
				return state.time;
			}
		};

		// get/set the origin string (asynchronous)
		controller.origin = function(loc, latlon, success, failure) {
			if (arguments.length) {
				if (latlon) {
					updateHrefs(permalinks, {"origin": loc}, window.location.hash);
					state.origin = loc;
					state.origin_taz = getTAZ(loc);
					state.origin_location = latlon;
					updateMarkers();
					applyStyle();
					return controller;
				}

				state.origin_taz = null;
				if (loc) {
					lookupOrigin(loc, success, failure);
				} else {
					state.origin = state.origin_location = null;
					updateMarkers();
					clearStyle();
					dispatchStdout("", "Cleared origin");
					if (success) success.call();
				}
				return controller;
			} else {
				return state.origin;
			}
		};

		function getTAZ(str) {
			if (str.match(/^TAZ:(\d+)$/i)) {
				return str.split(":")[1];
			}
			return null;
		}

		function getOptions(loc) {
			if (typeof loc == "string") {
				return {loc: loc};
			}
			return loc;
		}

		// get/set the destination string (asynchronous)
		controller.dest = function(loc, latlon, success, failure) {
			if (arguments.length) {
				if (latlon) {
					var taz = getTAZ(loc);
					updateHrefs(permalinks, {"dest": formatLocation(latlon)}, window.location.hash);
					state.dest = state.dest_taz = taz;
					state.dest_location = latlon;
					updateMarkers();
					applyStyle();
					return controller;
				}

				state.dest_taz = null;
				if (loc) {
					lookupDest(loc, success, failure);
				} else {
					state.dest = state.dest_location = null;
					updateMarkers();
					applyStyle();
					dispatchStdout("", "Cleared destination");
					if (success) success.call();
				}
				return controller;
			} else {
				return state.origin;
			}
		};

		return controller;
	};


})(gov.ca.mtc);

$(function() {
	try {

	var container = $("#travel-time").htmapl(),
			page = $("#page"),
			form = $("#main-form")//container.parent("form").first(),
			map = $.fn.htmapl.getMap(container[0].id),
			shapes = $.fn.htmapl.getLayer("taz-shapes");

	var controller = gov.ca.mtc.travelTimeMap()
		.container(container)
		.permalinks($("#permalink a"))
		.map(map)
		.shapes(shapes)
		.form(form)
		.stdout("#stdout");

	var loadHash = window.location.hash.substr(1);
	
	
	/// assign toggle handler to info button
	$("#helper_btn").toggle(function(e) {
		console.log("CLICK")
	  	// show info panel
		var _panel = $("#helper_panel");
		var _top = $(this).offset().top + $(this).height();
		var _height = $("#right_column").height() - _top;
		var _width = _panel.width();
		
		_panel.css("top",_top+"px").css("left","-"+_width+"px").css("height",_height).css("display","block");
		slidePanel(_panel,0,false);
	}, function(e) {
		// hide info panel
		var _panel = $("#helper_panel");
		var _width = _panel.width();
		slidePanel(_panel,"-"+_width+"px",true);
	});
	
	function updateLeftColumnHeight(_h){
		$("#left_column").height(_h);
		
		var _panel = $("#helper_panel");
		var _top = $("#helper_btn").offset().top + $("#helper_btn").height();
		var _height = $("#right_column").height() - _top;
		_panel.css("height",_height);
	}
	
	function slidePanel(_panel,_w,_hide){
		  _panel.animate({
		    left: _w
		  }, 300, function() {
			if(_hide){
				$(this).css("display","none");
			}
		  });

	}

	
	// flags to determine whether a slider is active and should be used in the filtering process
	// true by default
	var housing_slider_active = $("#housing_slider_enabled").is(':checked'),
		time_slider_active = $("#time_slider_enabled").is(':checked');
		
	$("#housing_slider_enabled").change(function(){
		housing_slider_active = $(this).is(':checked');
		handleSliderCheckboxes();
	});
	$("#time_slider_enabled").change(function(){
		time_slider_active = $(this).is(':checked');
		handleSliderCheckboxes();
	});
	
	function handleSliderCheckboxes(){
		//housing slider
		var labelContent = $("label[for='housing_slider_enabled']");
		labelContent.contents().last().remove();
		
		if(housing_slider_active){ 
			$("#housing-slider").slider( "enable" );
			labelContent.append("disable");
			$("#housing-slider-container").removeClass('sliderDisabled').addClass("sliderEnabled");
		}else{
			$("#housing-slider").slider( "disable" );
			labelContent.append("enable");
			$("#housing-slider-container").removeClass("sliderEnabled").addClass("sliderDisabled");
		}
		
		// time slider
		labelContent = $("label[for='time_slider_enabled']");
		labelContent.contents().last().remove();
		
		if(time_slider_active){ 
			$("#time-slider").slider( "enable" );
			labelContent.append("disable");
			$("#time-slider-container").removeClass('sliderDisabled').addClass("sliderEnabled");
		}else{
			$("#time-slider").slider( "disable" );
			labelContent.append("enable");
			$("#time-slider-container").removeClass("sliderEnabled").addClass("sliderDisabled");
		}
		
		deferredUpdate();
	}
	
	function originalHashLoaded() {
		var hash = formatZYX(map.zoom(), map.center());
		console.log(hash, loadHash, hash == loadHash);
		return hash == loadHash;
	}
	
	controller.on("select-taz", function(e) {
		if (e.location) {
			// controller.dest("TAZ:" + e.id, e.location);
			try {
				var t = controller.travelTime(e.feature);
				slider.slider("option", "value", t);
				setMaxTime(t);
				return false;
			} catch (e) {
				console.log("ERROR:", e);
			}
			var loc = formatLocation(e.location);
			inputs.dest.val(loc);
		} else {
			// controller.dest("TAZ:" + e.id);
		}
		return true;
	});
	controller.on("locate-origin", function(e) {
		if (!originalHashLoaded()) {
			map.center(e.location);
		}
	});
	controller.on("locate-dest", function(e) {
	});

	var maxTime = parseInt($("input[name=max_time]").val());
	var maxPrice,minPrice;
	if (isNaN(maxTime)) maxTime = 60;
	var minutes = $("#minutes").html(formatTime(maxTime)),
			showMax = true;
	function updateTimeText(t) {
		minutes.html("&le;" + ((typeof t == "string") ? t : formatTime(t)));
	}

	var locating = false;
	function selectCenter(e) {
		var loc = formatLocation(map.center());
		inputs.origin.val(loc);
		submits.origin.click();
		e.preventDefault();
		return false;
	}

	controller.on("travel-time", function(e) {
		var origin = e.origin,
				dest = e.dest,
				time = e.time;

		var title = $("#bottom-bar .title"),
				prefix = title.find(".prefix");

		if (origin && dest) {

			prefix.html('Travel time from <a name="origin" class="marker">' +
				$("#origin-marker").html() + '</a> to <a name="dest" class="marker">' +
				$("#dest-marker").html() + '</a>:');
			if (time != NIL) {
				updateTimeText(time);
			} else {
				updateTimeText("(unknown)");
			}
			if (e.extent) {
				// TODO
				// map.extent(e.extent);
				// map.zoom(map.zoom() >>> 0);
			}
			showMax = false;
			$("#bottom-bar").attr("class", "active");
			$("#time-slider-container").attr("class", "active");
			$("#housing-slider-container").attr("class", "active");
			page.removeClass("no_origin").addClass("has_origin").addClass("has_dest");

		} else if (origin) {
			prefix.html('Places accessible from <a name="origin" class="marker">' + $("#origin-marker").html() + '</a> in');
			updateTimeText(maxTime);
			showMax = true;
			$("#bottom-bar").attr("class", "active");
			$("#time-slider-container").attr("class", "active");
			$("#housing-slider-container").attr("class", "active");
			page.removeClass("no_origin").addClass("has_origin").removeClass("has_dest");

		} else if (locating) {
			
			// do nothing?
			prefix.html('Locating...');
			minutes.text("");

		} else {
			prefix.html('Enter a start address to see travel times,<br/>or <a class="select-center" href="#origin=center">select the center of the map</a>');
			prefix.find(".select-center").click(selectCenter);
			minutes.text("");
			showMax = false;
			$("#bottom-bar").attr("class", "inactive");
			$("#time-slider-container").attr("class", "inactive");
			$("#housing-slider-container").attr("class", "inactive");
			page.addClass("no_origin").removeClass("has_origin").removeClass("has_dest");

		}
		if (!locating) {
			$(window).trigger("resize");
		}

		if (origin) prefix.find("a[name=origin]").attr("href", "#" + formatZYX(map.zoom(), origin.location));
		if (dest) prefix.find("a[name=dest]").attr("href", "#" + formatZYX(map.zoom(), dest.location));
	});

	var inputs = {},
			submits = {};
	// update mode on <select name="mode"/> change
	inputs.mode = form.find("input[name=mode]").change(function() {
		var mode = $(this).val();
		controller.mode(mode);
	}).change();
	// update time on <select name="time"/> change
	inputs.time = form.find("input[name=time]").change(function() {
		controller.time($(this).val());
	}).change();

	// lookup origin in <input name="origin"/>
	// this keydown handler clicks the related submit input when the user hits
	// enter, and clears the input on escape
	inputs.origin = form.find("input[name=origin]").keydown(function(e) {
		if (e.keyCode == 13 || e.keyCode == 27) {
			if (e.keyCode == 27) inputs.origin.val("").blur();
			submits.origin.click();
			e.preventDefault();
			return false;
		}
	});

	// submit the origin on <input name="submit-origin"/> click
	submits.origin = form.find("input[name=submit-origin]").click(function() {
		var submit = $(this),
				label = submit.val();
		submit.val("Locating...").attr("disabled", true);
		function revert() {
			submit.val(label).attr("disabled", false);
			locating = false;
		}
		var value = inputs.origin.val();
		locating = value ? true : false;
		controller.origin(value, null, revert, revert);
		return false;
	});

	form.find("input[name=clear-origin], input[name=clear-dest]").click(function(e) {
		var name = this.name.split("-")[1];
		if (inputs[name]) inputs[name].val("");
		if (submits[name]) submits[name].click();
		e.preventDefault();
		return false;
	});

	// lookup destination in <input name="dest"/>
	// this keydown handler clicks the related submit input when the user hits
	// enter, and clears the input on escape
	inputs.dest = form.find("input[name=dest]").keydown(function(e) {
		if (e.keyCode == 13 || e.keyCode == 27) {
			if (e.keyCode == 27) inputs.dest.val("").blur();
			submits.dest.click();
			e.preventDefault();
			return false;
		}
	});
	if (inputs.dest.length) {
		// submit the destination on <input name="submit-dest"/> click
		submits.dest = form.find("input[name=submit-dest]").click(function() {
			var submit = $(this),
					label = submit.val();
			submit.val("Locating...").attr("disabled", true);
			function revert() {
				submit.val(label).attr("disabled", false);
			}
			controller.dest(inputs.dest.val(), null, revert, revert);
			return false;
		});
	}

	// TODO: formatting functions?
	map.add(po.hash());
	// submit the origin if there is one
	if (inputs.origin.val()) {
		submits.origin.click();
	} else {
		inputs.origin.focus();
	}
	if (inputs.dest.length && inputs.dest.val()) {
		submits.dest.click();
	}

	controller.filters([
		function(feature) {
			var price = controller.housingPrice(feature);
			var time = controller.travelTime(feature);
			if(housing_slider_active && time_slider_active){
				return (time > NIL && time <= maxTime) && (price >= minPrice && price <= maxPrice);
				
			}else if(housing_slider_active && !time_slider_active){
				return (price >= minPrice && price <= maxPrice);
				
			}else if(!housing_slider_active && time_slider_active){
				return (time > NIL && time <= maxTime);
				
			}else{ // if all else fails, fall back to both in play
				return (time > NIL && time <= maxTime) && (price >= minPrice && price <= maxPrice);
			}
		}
	]);

	// defer calling updateFilters() for 10ms each time
	var deferredUpdate = defer(10, controller.updateFilters);
	function setMaxTime(t) {
		if (maxTime != t) {
			maxTime = t;
			if (showMax) updateTimeText(t);
			deferredUpdate();
			updateHrefs(controller.permalinks(), {"max_time": t}, window.location.hash);
		}
	}
	
	function updatePriceText(x){
		$("#housing_price_range").text("$"+commize(x[0])+" - $"+commize(x[1]));
	}
	
	function setHousingPrice(x){
		if(maxPrice != x[1] || minPrice != x[0]){
			maxPrice = x[1];
			minPrice = x[0];
			updatePriceText(x);
			deferredUpdate();
		}
	}

	// our time scale maps the slider min/max to 0-1
	var timeScale = pv.Scale.linear()
		.domain(5, 90)
		.range(0, 1),
			bounds = timeScale.domain(),
			boundMin = bounds[0],
			boundMax = bounds[bounds.length - 1];
	var colorScale = controller.colorScale;
	
	// create the time slider
	var slider = $("#time-slider").slider({
		slide: function(e, ui) {
			setMaxTime(ui.value);
		},
		min: boundMin,
		max: boundMax,
		step: 1,
		value: maxTime
	});

	// convert a time to a percent (used for the widths of individual chips)
	function pct(t) {
		return timeScale(t) * 100;
	}

	var labels = $("#legend .labels"),
			steps = pv.range(0, boundMax + 1, 15),
			last = steps.length - 1;
	for (var i = 1; i <= last; i++) {
		var current = steps[i];
		var label = $("<a/>")
			.text(current)
			.attr("href", "#")
			.attr("class", "label")
			.data("minutes", current)
			.css("left", pct(current) + "%")
			.css("background", colorScale(current).color)
			.appendTo(labels);
	}

	labels.find("a").click(function() {
		var t = $(this).data("minutes");
		slider.slider("option", "value", t);
		setMaxTime(t);
	});

	var range = pv.range(boundMin, boundMax, 1),
			left = pct(boundMin),
			right = pct(boundMax),
			width = right - left,
			per = width / range.length;
	var chips = $("#legend .chips");
	for (var i = 0; i < range.length; i++) {
		var chip = $("<span/>")
			.attr("class", "chip")
			.css("left", pct(range[i]) + "%")
			.css("width", per + "%")
			.css("background", colorScale(range[i]).color)
			.appendTo(chips);
	}
	
	// show title now that bottom bar is rendered
	$('#bottom-bar .title').show();
	
	
	// create the housing slider
	// need to defer to after shapes have been loaded
	var housing_slider = null;
	function createHousingSlider(){
		maxPrice = controller.priceRange.maxPrice;
		minPrice = controller.priceRange.minPrice;
		updatePriceText([controller.priceRange.minPrice,controller.priceRange.maxPrice]);
		if(!housing_slider){
			var housing_slider = $("#housing-slider").slider({
				slide: function(e, ui) {
					setHousingPrice(ui.values);
				},
				range: true,
				min: controller.priceRange.minPrice,
				max: controller.priceRange.maxPrice,
				step: 1,
				values: [ controller.priceRange.minPrice, controller.priceRange.maxPrice ]
			});
		}else{
			$(housing_slider).slider("values", 0, minPrice); 
			$(housing_slider).slider("values", 1, maxPrice);
		}
	}
	// set callback function for onShapesLoad to generate the housing slider
	// since that is where we are setting the min/max price
	controller.processOnShapeLoad( createHousingSlider );
	// if the min/max are already set, then create housing slider
	if(controller.priceRange.minPrice)
		createHousingSlider();
	

	$(".select-center").click(selectCenter);

	function setMode(mode) {
		controller.mode(mode);
		if (mode == "bike" || mode == "walk") {
			$("#time-of-day").css("visibility", "hidden");
		} else {
			$("#time-of-day").css("visibility", "visible");
		}
		modeLinks.attr("class", function() {
			return $(this).data("mode") == mode ? "selected" : "";
		});
	}

	var modeLinks = $("#travel-optionss .mode a")
		 .click(function() {
			 var mode = $(this).data("mode");
			 setMode(mode);
			 return false;
		 });
	setMode(controller.mode());

	function setTime(time) {
		controller.time(time);
		timeLinks.attr("class", function() {
			return $(this).data("time") == time ? "selected" : "";
		});
	}

	var timeLinks = $("#travel-optionss .time a")
		.click(function() {
			var time = $(this).data("time");
			setTime(time);
			return false;
		});
	setTime(controller.time());

	/* adjust map size based on viewport */
	function setMapHeight(){

		try {
			var _mapHeight = container.height();
			var _mapWidth = container.width();
			if (!_mapHeight && !_mapWidth) return;

			map.size({x: _mapWidth, y: _mapHeight});
			map.dispatch({type: "move"});
			updateLeftColumnHeight(_mapHeight);
		} catch (e) {
			// console.log("setMapHeight() error:", e);
		}
	}

	/* listen for window resize then adjust map size */
	$(window).resize(defer(5, setMapHeight));
	$(window).trigger("resize");
	
	/////////////////////////////////////////////////////// end
	} catch (e) {
		if (typeof console != "undefined" && console.log) console.log(e);
		alert("Whoops: " + e);
	}
});
