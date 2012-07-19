$(function() {
	var qs = location.search;
	if (qs.match(/^\?.+=/)) {
		var query = parseQueryString(qs.substr(1));

		$("form.autofill").find("input, select").each(function() {
			var name = this.name,
					value = query[name];

			if (typeof value != "undefined") {
				$(this).val(value);
			}
		});
	}
});
