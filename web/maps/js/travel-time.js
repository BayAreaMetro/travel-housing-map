$(function() {
	/*
	 * NOTE: lib/autofill.js handles pre-populating the inputs of every
	 * form with the "autofill" class. So by the time this load handler
	 * runs, form inputs should have values that correspond to the variables
	 * in the query string.
	 */

	// our map is global
	var map;

	/*
	 * Here, we initialize the map location and zoom of the corresponding
	 * hidden inputs.
	 */
	$("#location-map").each(function() {
		var c = $(this).find("input[name=location]"),
				z = $(this).find("input[name=zoom]");
		// initialize the map using the HTMapL plugin (which uses Polymaps
		// for now, but may use something else in the future)
		$(this).htmapl({}, {
			// set the center to the value of the "location" input
			center: $.fn.htmapl.getLatLon(c.val()),
			// set the zoom to the value of the "zoom" input
			zoom: $.fn.htmapl.getInt(z.val())
		})
		.each(function() {
			// then, update those inputs every time the map moves
			map = $(this).data("map");
			map.on("move", function(e) {
				var center = map.center(),
						zoom = map.zoom(),
						// rounding precision
						pn = Math.ceil(Math.log(zoom) / Math.LN2);
				c.val([center.lat.toFixed(pn), center.lon.toFixed(pn)].join(","));
				z.val(zoom);
			});
		});
	});

	// add click handlers to the zoom links
	// (these are nicer than the Polymaps SVG compass rose, and will work with other mapping engines)
	$("#location-map .zoom-in").click(function() { map.zoomBy(1); return false; });
	$("#location-map .zoom-out").click(function() { map.zoomBy(-1); return false; });

	// move each <li>'s step into the text of its first <h2>
	var i = 0;
	$("ol.steps li")
		.css("list-style", "none")
		.find("h2:first-child")
		.prepend(function(n, content) {
			return ['<span class="step">', (++i), '.</span> '].join(""); 
		});

	// initialize the geocoder
	if (typeof google != "undefined") {
		var geocoder = new google.maps.Geocoder();

		var addr = $("input[name=address]"),
				stat = $("#geocoder .status"),
				prompt = "enter your address";
		// clear on focus if prompt
		addr.focus(function() { if (addr.val() == prompt) addr.val(""); });
		// reset to prompt on blur if empty
		addr.blur(function() { if (addr.val() == "") addr.val(prompt); });

		/*
		 * XXX: the submit input's "click" handler may not fire whenever the
		 * user presses enter in the address field! We may need to handle
		 * this another way.
		 */
		$("input[name=geocode]").click(function() {
			geocoder.geocode({"address": addr.val()}, function(results, status) {
				if (status == google.maps.GeocoderStatus.OK) {
					var result = results[0],
							xx = null,
							yy = null,
							found = null;

					if (result.geometry.bounds) {
						xx = result.geometry.bounds.P;
						yy = result.geometry.bounds.W;
					} else if (result.geometry.viewport) {
						xx = result.geometry.viewport.P;
						yy = result.geometry.viewport.W;
					} else {
						// ???
					}

					if (xx && yy) {

						found = result.formatted_address;
						// set the extent to get an apporpriate zoom
						map.extent([{lon: xx.d, lat: yy.b}, {lon: xx.b, lat: yy.d}]);
						// floor the zoom (because tile seams are ugly)
						map.zoom(Math.floor(map.zoom()));

					} else {
						// FIXME: need more useful message here?
						found = "Found, but no bounding box...";
						// show the status message, because this is weird
						stat.css("display", "");
					}

					stat.text(found);

					// then, set the center back to its actual "location"
					// (Google's "location" is different from the center of the
					// bounding box, and usually positioned on the label.)
					if (result.geometry.location) {
						var loc = result.geometry.location;
						map.center({lon: loc.Da, lat: loc.Ba});
					}

				} else {
					stat.html("Unable to geocode: <tt>" + addr.val() + "</tt>");
				}

			});
			return false;
		});
	}

});
