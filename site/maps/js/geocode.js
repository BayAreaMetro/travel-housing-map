
function geocode(geocoder, data, success, error) {
	geocoder.geocode(data, function(results, status) {
		if (status == google.maps.GeocoderStatus.OK && results.length > 0) {
			var result = results[0],
					extent = null;

			if (result.geometry.bounds) {
				result.extent = bbox(result.geometry.bounds);
			} else {
				// ???
			}

			if (!result.extent) {
				// FIXME: need more useful message here?
				result.message = "Found, but no bounding box...";
			}

			// then, set the center back to its actual "location"
			// (Google's "location" is different from the center of the
			// bounding box, and usually positioned on the label.)
			if (result.geometry.location) {
				var loc = result.geometry.location;
				result.location = {lon: loc.lng(), lat: loc.lat()};
			}

			success(result);
		} else {
			error("Address not found: " + data.address);
		}
	});

	function bbox(o) {
		var ne = o.getNorthEast(),
				sw = o.getSouthWest();
		if (ne && sw) {
			return [{lon: ne.lng(), lat: sw.lat()}, {lon: sw.lng(), lat: ne.lat()}];
		}
		return null;
	}

	function coalesce(o) {
		var len = arguments.length;
		for (var i = 1; i < len; i++) {
			var a = arguments[i],
					v = o[a];
			if (typeof v != "undefined") return v;
		}
		return null;
	}

	return false;
}
