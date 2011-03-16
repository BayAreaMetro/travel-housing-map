var gov = {ca: {mtc: {}}},
		po = org.polymaps;
var NIL = -999;

(function(mtc) {

 	mtc.scenarioLoader = function() {
		var loader = {},
				req = null;
		loader.dispatch = po.dispatch(loader);

		loader.load = function(url) {
			if (req) {
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
			return req ? req.url || true : false;
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
				markers = po.geoJson()
					.id("markers")
					.tile(false)
					.on("load", po.stylist()
						.attr("fill", "#000")
						.attr("r", 15))
					.on("load", onMarkersLoad);

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

		// determine if a feature is selected (either the origin or dest TAZ)
		function selected(feature) {
			return feature.id == state.origin_taz || feature.id == state.dest_taz;
		}

		// get the "default" color of a feature (this
		function defaultColor(feature) {
			return selected(feature) ? "#ff0" : "none";
		}

		function getTitle(feature) {
			return "TAZ #" + feature.id + ": " + formatTime(travelTime(feature));
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
			.attr("class","tazact")
			.attr("display", displayFilter)
			.attr("stroke", function(feature) { return selected(feature) ? "#ff0" : "#666"; })
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
		}

		function clearStyle() {
			for (var id in featuresById) {
				delete featuresById[id].properties.travel;
			}
			shapes.reshow();
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
				stdout.attr("class", "aborting").text("Aborting previous request...");
				scenarioReq.abort();
				scenarioReq = null;
			}
			
			stdout.attr("class", "loading").text("Loading scenario data...");
			
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
					stdout.attr("class", "loaded").text("Loaded " + commize(len) + " rows");
					controller.dispatch({
						type: "load-scenario", 
						url: url,
						scenario: rows,
						taz: state.origin_taz,
					});
				},
				error: function(xhr, err, text) {
					stdout.attr("class", "error").text("Error loading scenario: " + text);
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
					"text-anchor": "middle",
					"alignment-baseline": "middle"
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

		function onMarkersLoad(e) {
			var features = e.features,
					len = features.length;
			for (var i = 0; i < len; i++) {
				var feature = e.features[i].data,
						el = e.features[i].element;
				if (feature.properties.label) {
					var label = svg.label(feature.properties.label, {
						"x": el.getAttribute("cx"),
						"y": el.getAttribute("cy"),
						"font-size": el.getAttribute("r"),
						"baseline-shift": "-10%"
					});
					el.parentNode.appendChild(label);
				}
			}
		}
		
		////////// TOOLTIP //////////////
		// being initiated from onShapesLoad
		//
		function theTip(){
			this.tipRef = $("#taztip");
			this.txtRef = $("#tazinfo");
			this.tipState = false;
			this.oldTitleElm = null;
			this.oldTitleAttr = null;
			this.tipHeight = null;
			var self = this;
			
			this.setup = function(){

				$('.tazact').unbind('mouseover');
				$('.tazact').unbind('mouseout');
				$(document).unbind('mousemove');
				
				$('.tazact').mouseover(function(e){
					e.preventDefault();
					
					// set txt
					self.txtRef.text( $(this).attr('title') );
					
					// store old title stuff
					self.oldTitleAttr = $(this).attr('title');
					self.oldTitleElm = $(this).find("title");
					// remove title stuff
					$(this).removeAttr('title');
					$(this).find("title").remove();

					// adjust width
					self.tipRef.css("width","auto");
					
					var _w = self.tipRef.width();
					self.tipRef.css("width",_w+"px");
					self.tipRef.css("margin-left","-"+(_w*.5)+"px");
					
					self.tipHeight = self.tipRef.height();

					self.tipRef.show();
					self.tipState = true;
				});
				
				$('.tazact').mouseout(function(e){
					e.preventDefault();
					self.tipRef.hide();
					self.txtRef.text("");
					if(self.oldTitleAttr)$(this).attr('title',self.oldTitleAttr);
					if(self.oldTitleElm)$(this).append(self.oldTitleElm);
					self.tipState = false;
				});
				
				$(document).mousemove(function(e){
				    if (self.tipState){
				      self.tipRef.css("left", e.offsetX).css("top", e.offsetY - (15+self.tipHeight));
				    }
				});
				
			}
		}
		var tipController = new theTip();
		
		////////// END TOOLTIP //////////////
		
		// when the shapes load, stash the features in the featuresById hash, apply
		// the style, and load the scenario if there's an origin_taz
		function onShapesLoad(e) {
			var features = e.features,
					len = features.length;
			for (var i = 0; i < len; i++) {
				var feature = e.features[i].data;
				feature.id = tazID(feature);
				featuresById[feature.id] = feature;
				////
				/*
				var el = e.features[i].element;
				el.setAttribute('onmouseover', 'taz_over();return false;');
				el.setAttribute('onmouseout', 'taz_out();return false;');
				*/
				//
				if (selected(feature)) {
					var el = e.features[i].element;
					el.parentNode.appendChild(el);
				}
			}
			// apply the current style
			style(e);
			if (state.origin_taz) {
				loadScenario();
			}
			tipController.setup(); // set tooltip events for TAZ's
		}

		function onShapesShow(e) {
			style(e);
		}

		function lookupTAZ(str, success, failure, locate) {
			// if it's in the form "TAZ:id", return the id portion
			if (str.match(/^TAZ:(\d+)$/i)) {
				success.call(null, str.split(":")[1]);
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
			stdout.attr("class", "loading").html("Looking up &ldquo;" + loc + "&rdquo;...");
			updateHrefs(permalinks, {"origin": loc}, window.location.hash);
			state.origin = loc;
			state.origin_location = null;
			clearStyle();
			updateMarkers();
			return lookupTAZ(loc, function(taz, latlon) {
				stdout.attr("class", "loaded").text("Found origin TAZ: " + taz);
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
				stdout.attr("class", "error").text("ERROR: " + message);
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
			stdout.attr("class", "loading").html("Looking up &ldquo;" + loc + "&rdquo;...");
			updateHrefs(permalinks, {"dest": loc}, window.location.hash);
			state.dest = loc;
			state.dest_location = null;
			updateMarkers();
			return lookupTAZ(loc, function(taz, latlon) {
				stdout.attr("class", "loaded").text("Found dest. TAZ: " + taz);
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
				stdout.attr("class", "error").text("ERROR: " + message);
				if (failure) failure.call(null, error);
			});
		}

		function applyDest(taz) {
			state.dest_taz = taz;
			return false;
		}

		function updateMarkers() {
			var features = [],
					origin, dest;
			if (state.origin && state.origin_location) {
				origin = makePoint(state.origin_location, {
					label: "A",
					taz: state.origin_taz,
					address: state.origin
				}, "origin");
				features.push(origin);
			}
			if (state.dest && state.dest_location) {
				dest = makePoint(state.dest_location, {
					label: "B",
					taz: state.dest_taz,
					address: state.dest
				}, "dest");
				features.push(dest);
			}
			markers.features(features);
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
				container = x;
				return controller;
			}
		};

		// get/set the map
		controller.map = function(x) {
			if (arguments.length) {
				if (map) {
					map.off("move", onMapMove);
					map.remove(markers);
				}
				map = x;
				if (map) {
					map.on("move", onMapMove);
					map.add(markers);
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

		// export this for use outside
		controller.travelTime = travelTime;

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
		controller.origin = function(loc, success, failure) {
			if (arguments.length) {
				state.origin_taz = null;
				if (loc) {
					lookupOrigin(loc, success, failure);
				} else {
					state.origin = state.origin_location = null;
					updateMarkers();
					clearStyle();
					stdout.text("Cleared origin");
					success.call();
				}
				return controller;
			} else {
				return state.origin;
			}
		};

		// get/set the destination string (asynchronous)
		controller.dest = function(loc, success, failure) {
			if (arguments.length) {
				state.dest_taz = null;
				if (loc) {
					lookupDest(loc, success, failure);
				} else {
					state.dest = state.dest_location = null;
					updateMarkers();
					applyStyle();
					stdout.text("Cleared destination");
					success.call();
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
			form = container.parent("form").first(),
			map = $.fn.htmapl.getMap(container[0].id),
			shapes = $.fn.htmapl.getLayer("taz-shapes");

	var controller = gov.ca.mtc.travelTimeMap()
		.container(container)
		.permalinks($("#permalink a"))
		.map(map)
		.shapes(shapes)
		.form(form)
		.stdout("#stdout");
	
	var origin, dest;
	controller.on("locate-origin", function(e) {
		// TODO
	});
	controller.on("locate-dest", function(e) {
		// TODO
	});

	var inputs = {},
			submits = {};
	// update mode on <select name="mode"/> change
	inputs.mode = form.find("select[name=mode]").change(function() {
		controller.mode($(this).val());
	}).change();
	// update time on <select name="time"/> change
	inputs.time = form.find("select[name=time]").change(function() {
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
		}
		controller.origin(inputs.origin.val(), revert, revert);
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
	// submit the destination on <input name="submit-dest"/> click
	submits.dest = form.find("input[name=submit-dest]").click(function() {
		var submit = $(this),
				label = submit.val();
		submit.val("Locating...").attr("disabled", true);
		function revert() {
			submit.val(label).attr("disabled", false);
		}
		controller.dest(inputs.dest.val(), function(feature) {
			/*
			// TODO: implement
			if (controller.origin()) {
				var time = controller.travelTime(feature);
				$("#origin-dest").css("left", pct(time));
			}
			*/
			revert();
		}, revert);
		return false;
	});

	// when the crosshairs is clicked, populate the origin input with the
	// formatted "lat,lon" and submit
	/*
	container.find("a.crosshairs").click(function() {
		var loc = formatLocation(map.center());
		inputs.origin.val(loc);
		submits.origin.click();
		return false;
	});
	*/

	// TODO: formatting functions?
	map.add(po.hash());

	// submit the origin if there is one
	if (inputs.origin.val()) {
		submits.origin.click();
	} else {
		inputs.origin.focus();
	}
	if (inputs.dest.val()) {
		submits.dest.click();
	}

	var maxTime = parseInt($("input[name=max_time]").val());
	if (isNaN(maxTime)) maxTime = 60;
	var minutes = $("#minutes").html(formatTime(maxTime));

	controller.filters([
		function(feature) {
			var time = controller.travelTime(feature);
			return time > NIL && time <= maxTime;
		}
	]);

	// defer calling updateFilters() for 10ms each time
	var deferredUpdate = defer(10, controller.updateFilters);
	function setMaxTime(t) {
		if (maxTime != t) {
			maxTime = t;
			minutes.html(formatTime(t));
			deferredUpdate();
			updateHrefs(controller.permalinks(), {"max_time": t}, window.location.hash);
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

	var labels = container.find("#legend .labels"),
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

	// Time of Day slider (tod)
	var periods = inputs.time.find("option").map(function(i, el) {
		return {index: i, time: el.value, label: $(el).text()};
	});
	// get the index of a period time ("AM" -> 1) in the array, for setting the
	// slider value
	function periodIndex(time) {
		for (var i = 0; i < periods.length; i++) {
			if (periods[i].time == time) return i;
		}
		return 0;
	}

	var tod_slider = $( "#tod-slider" ).slider({
		min: 		0,
		max: 		periods.length - 1,
		value: 	periodIndex(controller.time()),
		step: 	1,
		slide: function(e, ui) {
			controller.time(periods[ui.value].time);
		}
	});

	var todlabels = $("#tod-legend .labels"),
			last = periods.length - 1;
	for (var i = 0; i <= last; i++) {
		var period = periods[i];
		var label = $("<a/>")
			.text(period.label)
			.attr("href", "#")
			.attr("class", "label")
			.data("time", period.time)
			.data("index", i)
			.css("left", (i / last * 100) + "%")
			.appendTo(todlabels);
	}
	todlabels.find("a").click(function() {
		var period = $(this).data();
		tod_slider.slider("option", "value", period.index);
		controller.time(period.time);
	});
	
	// create ticks for tod slider ... skipping ends
	var tickBox = $('<div/>').attr("id","tickbox");
	for (var i = 1; i <= (last-1); i++) {
		var label = $("<p/>")
			.attr("class", "ticks")
			.css("left", (i / last * 100) + "%")
			.appendTo(tickBox);
	}
	$("#tod-slider").append(tickBox);
	// end create ticks for tod slider
	

	function setMode(mode) {
		controller.mode(mode);
		modeLinks.attr("class", function() {
			return $(this).data("mode") == mode ? "selected" : "";
		});
	}

	var modeLinks = $("#travel-optionss a")
		 .each(function() {
			 var link = $(this);
			 link.data("mode", link.attr("id").split("_")[1]);
		 }).click(function() {
			 var mode = $(this).data("mode");
			 setMode(mode);
			 return false;
		 });
	setMode(controller.mode());

	/* adjust map size based on viewport */
	function setMapHeight(){
		var _mapHeight = container.height();
		var _mapWidth = container.width();
		var _mapTop = container.offset().top;
		var _viewport = $(window).height();
		if (!_mapHeight && !_viewport) return;
		
		var _newSize = _viewport - (_mapTop + 20);
		if (_newSize < 200) return;
		
		container.css('cssText', 'height: '+_newSize+'px !important');
		map.size({x: _mapWidth, y: _mapHeight});
	}
	setMapHeight();

	/* listen for window resize then adjust map size */
	$(window).resize(defer(5, setMapHeight));
	
	/////////////////////////////////////////////////////// end
	} catch (e) {
		if (typeof console != "undefined" && console.log) console.log(e);
		alert("Whoops: " + e);
	}
});
