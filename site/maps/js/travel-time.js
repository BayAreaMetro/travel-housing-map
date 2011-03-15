var gov = {ca: {mtc: {}}};

(function(mtc) {
	var po = org.polymaps;

	var NIL = -999;

	mtc.travelTimeMap = function(selector) {
		var controller = {};

		// The map and jQuery objects for finding various controls
		var map, container, form, permalinks,
				// Where messages go
				stdout = $("#stdout"),
				// The Google Maps Geocoder
				geocoder,
				// The TAZ GeoJSON layer
				shapes;

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
		var colorScale = pv.Scale.linear()
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
			return feature.id == state.origin || feature.id == state.dest;
		}

		// get the "default" color of a feature (this
		function defaultColor(feature) {
			return selected(feature) ? "#ff0" : "none";
		}

		function getTitle(feature) {
			return "TAZ #" + feature.id + ": " + formatTime(travelTime(feature));
		}

		var style = po.stylist()
			.attr("id", function(feature) { return "taz" + feature.id; })
			.title(getTitle)
			.attr("title", getTitle)
			.attr("stroke", function(feature) { return selected(feature) ? "#ff0" : "#333"; })
			.attr("stroke-width", function(feature) { return selected(feature) ? 2 : .1; })
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

		var scenarioReq;
		/**
		 * Load the current scenario. This builds a URL from the state; sends an
		 * AJAX request; and on success parses the response as CSV, assigns feature
		 * properties according to the loaded travel times, and renders the
		 * choropleth. On error it outputs some text and bails.
		 */
		function loadScenario() {
			if (scenarioReq) {
				stdout.attr("class", "aborting").text("Aborting previous load...");
				scenarioReq.abort();
				scenarioReq = null;
			}
			stdout.attr("class", "loading").text("Loading scenario data...");
			var url = "/data/scenarios/2005/time/" + [state.time, "from", state.origin].join("/") + ".csv";
			scenarioReq = $.ajax(url, {
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
					stdout.attr("class", "loaded").text("Loaded!");
				},
				error: function(xhr, err, text) {
					stdout.attr("class", "error").text("Error loading scenario: " + text);
				}
			});
			return false;
		}

		// update permalinks on map move
		function onMapMove(e) {
			updateHrefs(permalinks, null, window.location.hash);
		}

		// when the shapes load, stash the features in the featuresById hash, apply the style, and
		function onShapesLoad(e) {
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
			}
			// apply the current style
			style(e);
			if (state.origin) {
				loadScenario();
			}
		}

		function onShapesShow(e) {
			style(e);
		}

		function lookupTAZ(str, success, failure) {
			// if it's in the form "TAZ:id", return the id portion
			if (str.match(/^TAZ:(\d+)$/i)) {
				success.call(null, str.split(":")[1]);
				return false;
			}
			// if it's a "lat,lon" string, lookup the location
			var latlon = $.fn.htmapl.getLatLon(str);
			if (latlon) {
				return location2taz(latlon, {
					success: success,
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

			// otherwise, treat it as an address for geocoding
			return geocode({"address": str}, function(result) {
				return location2taz(result.location, {
					success: success,
					error: failure
				});
			}, failure);
		}

		function lookupOrigin(loc, success, failure) {
			stdout.attr("class", "loading").html("Looking up &ldquo;" + loc + "&rdquo;...");
			updateHrefs(permalinks, {"origin": loc}, window.location.hash);
			state.origin = null;
			return lookupTAZ(loc, function(taz) {
				stdout.attr("class", "loaded").text("Found TAZ: " + taz);
				applyOrigin(taz);
				if (success) success.call(null, taz);
			}, function(error) {
				stdout.attr("class", "error").text(error);
				if (failure) failure.call(null, error);
			});
		}

		function applyOrigin(taz) {
			state.origin = taz;
			if (state.origin) {
				loadScenario();
			}
			return false;
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

		// get/set the input form
		controller.form = function(x) {
			if (arguments.length) {
				form = x;
				permalinks = form.find("a.permalink");
				return controller;
			} else {
				return form;
			}
		};

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
			} else {
				return state.mode;
			}
		};

		// get/set the travel mode (instantaneous)
		controller.time = function(x) {
			if (arguments.length) {
				state.time = x;
				if (state.origin) {
					loadScenario();
				}
			} else {
				return state.mode;
			}
		};

		// get/set the origin string (asynchronous)
		controller.origin = function(loc, success, failure) {
			if (arguments.length) {
				lookupOrigin(loc, success, failure);
				return controller;
			} else {
				return state.origin;
			}
		};

		// get/set the destination string (asynchronous)
		controller.dest = function(loc, success, failure) {
			if (arguments.length) {
				alert("Not yet implemented");
				return controller;
			} else {
				return state.dest;
			}
		};

		// initialize!
		controller.init = function() {

			var inputs = {};
			// update mode on <select name="mode"/> change
			inputs.mode = form.find("select[name=mode]").change(function() {
				controller.mode($(this).val());
			});
			// update time on <select name="time"/> change
			inputs.time = form.find("select[name=time]").change(function() {
				controller.time($(this).val());
			});
			// lookup origin in <input name="origin"/>
			inputs.origin = form.find("input[name=origin]");
			// autofill should have populated these
			for (var name in inputs) {
				var val = inputs[name].val();
				state[name] = val;
			}

			var submits = {};
			// submit the origin on <input name="submit-origin"/> click
			submits.origin = form.find("input[name=submit-origin]").click(function() {
				var submit = $(this),
						label = submit.val();
				submit.val("Looking up...").attr("disabled", true);
				function revert() {
					submit.val(label).attr("disabled", false);
				}
				controller.origin(inputs.origin.val(), revert, revert);
				return false;
			});

			var legend = container.find("#legend .notches"),
					steps = colorScale.domain().slice(1),
					last = steps.length - 1;
			for (var i = 1; i < steps.length; i++) {
				var current = steps[i],
						prev = steps[i - 1],
						text = (prev == 0)
							? ("<" + current)
							: (i == last) ? (current + "+") : current;
				var step = $("<a/>")
					.text(text)
					.attr("class", "item")
					.data("minutes", current)
					.css("background", colorScale(current).color);
				step.appendTo(legend);
			}

			container.find("a.crosshairs").click(function() {
				var loc = formatLocation(map.center());
				inputs.origin.val(loc);
				submits.origin.click();
				return false;
			});

			map.add(po.hash());
			updateHrefs(permalinks, state, window.location.hash);

			if (state.origin) {
				controller.origin(state.origin);
			}
		};

		return controller;
	};

})(gov.ca.mtc);

try {

	var controller = gov.ca.mtc.travelTimeMap();
	var container = $("#travel-time").htmapl();
	controller.container(container);
	controller.map($.fn.htmapl.getMap(container[0].id));
	controller.shapes($.fn.htmapl.getLayer("taz-shapes"));
	controller.form(container.parent("form").first());
	controller.stdout("#stdout");
	controller.init();

} catch (e) {
	if (typeof console != "undefined" && console.log) console.log(e);
	alert("Whoops: " + e);
}
