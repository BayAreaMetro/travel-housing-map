$(function() {
	try {

	var map,
			geocoder;

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
		addr.focus(function() { if (addr.val() == prompt) addr.val(""); });
		// reset to prompt on blur if empty
		addr.blur(function() { if (addr.val() == "") addr.val(prompt); });
		addr.blur();
	}

	geocontainer.find("input[type=submit]").click(function() {
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
		// don't submit the form!
		return false;
	});


	} catch (e) {
		if (console && typeof console.log == "function") console.log(e);
	}
});
