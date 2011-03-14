$(function() {
	try {

	var BOUNDS = {
		north: 38.8755,
		west: -123.5858,
		south: 36.8988,
		east: -121.1853
	};
	BOUNDS.xmax = Math.max(BOUNDS.west, BOUNDS.east);
	BOUNDS.xmin = Math.min(BOUNDS.west, BOUNDS.east);
	BOUNDS.ymax = Math.max(BOUNDS.north, BOUNDS.south);
	BOUNDS.ymin = Math.min(BOUNDS.north, BOUNDS.south);

	function inBounds(loc) {
		return loc.lon > BOUNDS.xmin
			&& loc.lon < BOUNDS.xmax
			&& loc.lat > BOUNDS.ymin
			&& loc.lat < BOUNDS.ymax;
	}

	var po = org.polymaps;
	var map,
			geocoder = new google.maps.Geocoder();

	var form = $("form").first(),
			// NOTE: this gets autopopulated from the query string in autofill.js
			SELECTED_TAZ = form.find("input[name=taz]").val();

	// initialize the map
	var container = $("#travel-time"),
			form = container.parent("form");
	container.each(function() {
		// set the data attributes (should be overwritten by autofill.js),
		// which will be read by htmapl
		var input_center = form.find("input[name=center]"),
				input_zoom = form.find("input[name=zoom]");
		container.data("center", input_center.val());
		container.data("zoom", input_zoom.val());

		$(this).htmapl();
		map = $.fn.htmapl.getMap(this.id);

		map.on("move", function() {
			var c = map.center(),
					z = map.zoom();
			input_center.val(formatLocation(c));
			input_zoom.val(z);
		});
	});

	var geocontainer = $("#geocoder"),
			addr = geocontainer.find("input[name=address]"),
			prompt = addr.data("default"),
			stat = geocontainer.find(".status");

	stat.click(function() { stat.css("display", "none"); });
	stat.css("cursor", "pointer");

	if (prompt) {
		// clear on focus if prompt
		addr.focus(function() { if (addr.val() == prompt) addr.val(""); });
		// reset to prompt on blur if empty
		addr.blur(function() { if (addr.val() == "") addr.val(prompt); });
		addr.blur();
	}

	var geosubmit = geocontainer.find("input[type=submit]").first();

	addr.keydown(function(e) {
		if (e.keyCode == 13) {
			e.preventDefault();
			geosubmit.click();
			return false;
		}
	});

	geosubmit.click(function(e) {
		stat.removeClass("success");
		stat.removeClass("error");

		geocode(geocoder, {"address": addr.val()}, function(result) {
			if (result.extent) {
				map.extent(result.extent);
				map.zoom(Math.floor(map.zoom()));
			} else {
				map.center(result.location);
			}
		},
		function(error) {
			// TODO
		});
		if (e) e.preventDefault();
		// don't submit the form!
		return false;
	});

	var permalinks = $("a.permalink");
	if (permalinks.length) {
		map.on("move", function() {
			updateHrefs(permalinks, null, window.location.hash);
		});
	}

	var stat = $("#status").attr("class", "loading").text("Loading...");

	var layer = $.fn.htmapl.getLayer("taz-shapes");

	var config = {};
	config.mode = form.find("select[name=mode]").change(function() {
		config.mode = $(this).val();
		layer.reshow();
	}).val();
	config.time = form.find("select[name=time]").change(function() {
		config.time = $(this).val();
		loadScenario();
	}).val();
	// console.log(config);

	var featuresById = {};
	function tazID(feature) {
		return feature.properties["TAZ1454"];
	}

	function travelTime(feature) {
		return (typeof feature.properties.travel == "object")
			? feature.properties.travel[config.mode]
			: -999;
	}

	var filters = [];

	var colorScale = pv.Scale.linear()
		.domain(-999, 	0,			15, 		30, 		60)
		// .range("#000", "#063", "#063", "#8c7", "#ffc");
		.range("#000", "#009DDC", "#009DDC", "#d87", "#ffe");
	var legend = $("#legend .notches"),
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

	function defaultColor(feature) {
		return (feature.id == SELECTED_TAZ) ? "#ff0" : "none";
	}

	function getTitle(feature) {
		return "TAZ #" + feature.id + ": " + formatTime(travelTime(feature));
	}

	var style = po.stylist()
		.attr("id", function(feature) { return "taz" + feature.id; })
		.title(getTitle)
		.attr("title", getTitle)
		.attr("stroke", function(feature) { return feature.id == SELECTED_TAZ ? "#ff0" : "#333"; })
		.attr("stroke-width", function(feature) { return feature.id == SELECTED_TAZ ? 2 : .1; })
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
		var url = "/data/scenarios/2005/time/" + [config.time, "from", SELECTED_TAZ].join("/") + ".csv";
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

	function selectTAZ(tazID) {
		SELECTED_TAZ = tazID;
		form.find("input[name=taz]").val(SELECTED_TAZ);
		if (SELECTED_TAZ) {
			loadScenario();
		}
	}

	layer.on("load", function(e) {
		var features = e.features,
				len = features.length;
		for (var i = 0; i < len; i++) {
			var feature = e.features[i].data;
			feature.id = tazID(feature);
			featuresById[feature.id] = feature;
			if (feature.id == SELECTED_TAZ) {
				var el = e.features[i].element;
				el.parentNode.appendChild(el);
			}
		}
		// console.log(featuresById);

		style(e);

		stat.attr("class", "loaded").text("Loaded " + len + " TAZs");

		if (SELECTED_TAZ) {
			stat.attr("class", "loading").text("Loading travel times...");
			loadScenario();
		}
	});

	var lookup = $("#lookup-taz");
	lookup.data("default", lookup.val());

	/**
	 * TODO:
	 * Provide an address field instead of TAZ.
	 * Use default address, geocode w/google, lookup TAZ, go!
	 * time.html?location=242+Capp+St
	 * time.html?location=37.7639,-122.4130
	 * etc.
	 */
	

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
			return selectTAZ(address.split(":")[1]);
		}

		lookup.val("Looking up...").attr("disabled", true);

		function _select(loc, _success, _error) {
			map.center(loc);
			location2taz(loc, {
				success: function(taz) {
					lookup.val(lookup.data("default")).attr("disabled", false);
					stat.text("Found TAZ: " + taz);
					selectTAZ(taz);
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

	$("a.crosshairs").click(selectCenter);
	lookup.click(selectUserLocation);

	if (!SELECTED_TAZ) {
		selectUserLocation();
	}

	map.add(po.hash());

	} catch (e) {
		if (console && typeof console.log == "function") console.log(e);
	}
});
