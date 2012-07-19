$(function() {
	try {

	var map,
			geocoder;

	// initialize the map
	var container = $("#location-map");
	container.each(function() {
		// set the data attributes (should be overwritten by autofill.js),
		// which will be read by htmapl
		var input_center = $("form input[name=center]"),
				input_zoom = $("form input[name=zoom]");
		container.data("center", input_center.val());
		container.data("zoom", input_zoom.val());

		map = container.htmapl().data("map");
		map.on("move", function() {
			var c = map.center(),
					z = map.zoom();
			input_center.val(c.lat + "," + c.lon);
			input_zoom.val(z);
		});
	});

	geocoder = new google.maps.Geocoder();

	var geocontainer = $("#geocoder"),
	var addr = geocontainer.find("input[name=address]"),
			prompt = addr.data("default"),
			stat = geocontainer.find(".status");

	stat.click(function() { stat.css("display", "none"); });
	stat.css("cursor", "pointer");

	if (prompt) {
		// clear on focus if prompt
		addr.focus(function() {
			if (addr.val() == prompt) addr.val("");
			// addr.data("focus", true);
		});
		// reset to prompt on blur if empty
		addr.blur(function() {
			if (addr.val() == "") addr.val(prompt);
			// addr.data("focus", true);
		});
		addr.bind("keyup", function(e) {
			if (e.keyCode == 27) {
				addr.val("").blur();
				e.preventDefault();
			}
		});
		addr.blur();
	}

	geocontainer.find("input[type=submit]").click(function() {
		stat.removeClass("success");
		stat.removeClass("error");

		var data = {
			"address": addr.val(),
			"region": "us"
		};

		var bounds = map.extent();
		// S,W|N,E
		bounds = [[bounds[0].lat, bounds[0].lon].join(","),
						  [bounds[1].lat, bounds[1].lon].join(",")].join("|");
		// data.bounds = bounds;

		geocode(geocoder, data, function(result) {
			// console.log(result);
			if (result.extent) {
				map.extent(result.extent);
				map.zoom(Math.floor(map.zoom()));
			} else {
				map.center(result.location);
			}
			stat.addClass("success");
			addr.val(result.formatted_address);
			addr.select();
		},
		function(error) {
			// console.log(error);
			stat.addClass("error").text(error);
		});
		// don't submit the form!
		return false;
	});

	} catch (e) {
		if (console && typeof console.log == "function") console.log(e);
	}
});
