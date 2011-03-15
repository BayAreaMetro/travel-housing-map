var gov = {ca: {mtc: {}}};

(function(mtc) {
	var po = org.polymaps;

	mtc.travelTimeMap = function(selector) {
		var controller = {};

		var map,
				geocoder = new google.maps.Geocoder(),
				container = $(selector).first(),
				form = container.parent("form").first();

		// initialize the map
		container.htmapl();
		map = $.fn.htmapl.getMap(container[0].id);

		var permalinks = form.find("a.permalink");
		if (permalinks.length) {
			map.on("move", function() {
				updateHrefs(permalinks, null, window.location.hash);
			});
		}

		var stat = form.find("#status").attr("class", "loading").text("Loading...");

		var layer = $.fn.htmapl.getLayer("taz-shapes");

		var state = {};
		// TODO: implement switching?
		state.direction = "from";
		state.mode = form.find("select[name=mode]").change(function() {
			state.mode = $(this).val();
			layer.reshow();
		}).val();
		state.time = form.find("select[name=time]").change(function() {
			state.time = $(this).val();
			loadScenario();
		}).val();
		state.origin = form.find("input[name=origin]").val();
		state.dest = form.find("input[name=dest]").val();

		// console.log(state);

		var featuresById = {};
		function tazID(feature) {
			return feature.properties["TAZ1454"];
		}

		function travelTime(feature) {
			return (typeof feature.properties.travel == "object")
				? feature.properties.travel[state.mode]
				: -999;
		}

		var colorScale = pv.Scale.linear()
			.domain(-999, 	0,			15, 		30, 		60)
			// .range("#000", "#063", "#063", "#8c7", "#ffc");
			.range("#000", "#009DDC", "#009DDC", "#d87", "#ffe");
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

		function selected(feature) {
			return feature.id == state.origin || feature.id == state.dest;
		}

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
					if (value == -999) {
						return defaultColor(feature);
					} else {
						return colorScale(value).color;
					}
				} else {
					return defaultColor(feature);
				}
			});
		layer.on("show", style);

		function loadScenario() {
			var url = "/data/scenarios/2005/time/" + [state.time, state.direction, state.origin].join("/") + ".csv";
			stat.attr("class", "loading").text("Loading scenario data...");
			$.ajax(url, {
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
					layer.reshow();
					stat.attr("class", "loaded").text("Loaded!");
				},
				error: function(xhr, err, text) {
					// console.log("ERROR:", err);
					stat.attr("class", "error").text("Error loading scenario: " + text);
				}
			});
		}

		function selectOrigin(tazID) {
			if (state.origin != tazID) {
				state.origin = tazID;
				if (state.origin) {
					loadScenario();
				}
			}
			return false;
		}

		function selectDest(tazID) {
			if (state.dest != tazID) {
				state.dest = tazID;
				if (state.dest) {
					// TODO: something here
				}
			}
			return false;
		}

		layer.on("load", function(e) {
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
			// console.log(featuresById);

			style(e);

			stat.attr("class", "loaded").text("Loaded " + len + " TAZs");

			if (state.origin) {
				stat.attr("class", "loading").text("Loading travel times...");
				loadScenario();
			}
		});

		var lookup = form.find("#lookup-taz");
		lookup.data("default", lookup.val());

		form.find("input[type=text], select").change(function() {
			var vars = {};
			vars[this.name] = $(this).val();
			updateHrefs(permalinks, vars, window.location.hash);
		});

		function selectUserLocation(e) {
			var address = form.find("input[name=location]").val();
			if (!address) {
				return false;
			}

			updateHrefs(permalinks, {location: address}, window.location.hash);

			if (address.match(/^TAZ:(\d+)$/)) {
				return selectOrigin(address.split(":")[1]);
			}

			lookup.val("Looking up...").attr("disabled", true);

			function _select(loc, _success, _error) {
				map.center(loc);
				location2taz(loc, {
					success: function(taz) {
						lookup.val(lookup.data("default")).attr("disabled", false);
						stat.text("Found TAZ: " + taz);
						selectOrigin(taz);
						if (_success) _success.call();
					},
					error: function(error) {
						lookup.val(lookup.data("default")).attr("disabled", false);
						stat.html("Unable to find TAZ for: &ldquo;" + address + "&rdquo;");
						if (_error) _error.call();
					}
				});
			}

			var latlon = $.fn.htmapl.getLatLon(address);
			if (latlon != null) {

				_select(latlon, function() {
					// XXX: put the TAZ:ID into the input field?
					// form.find("input[name=location]").val("TAZ:" + SELECTED_TAZ);
				});

			} else {

				geocode(geocoder, {"address": address}, function(result) {
					/*
					if (result.extent) {
						map.extent(result.extent);
						map.zoom(Math.floor(map.zoom()));
					}
					*/
					_select(result.location);
				},
				function(error) {
					stat.text("Unable to find: &ldquo;" + address + "&rdquo;");
					lookup.val(lookup.data("default")).attr("disabled", false);
				});
			}

			return false;
		}

		function selectCenter() {
			var loc = map.center();
			form.find("input[name=location]").val(formatLocation(loc));
			return selectUserLocation();
		}

		container.find("a.crosshairs").click(selectCenter);
		lookup.click(selectUserLocation);

		if (!state.origin) {
			selectUserLocation();
		}

		map.add(po.hash());
		updateHrefs(permalinks, state, window.location.hash);

		return controller;
	};

})(gov.ca.mtc);

try {

	gov.ca.mtc.travelTimeMap("#travel-time");

} catch (e) {
	if (typeof console != "undefined" && console.log) console.log(e);
	alert("Whoops: " + e);
}
