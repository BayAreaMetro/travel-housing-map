import sys, csv
try:
	import jsonutil.jsonutil as json
except ImportError:
	print >> sys.stderr, "Warning: using simplejson may cause floating point issues."
	import json
from optparse import OptionParser

parser = OptionParser()
opts, args = parser.parse_args()

input_csv, input_json = map(lambda f: open(f, 'r'), args)

rows = csv.DictReader(input_csv, dialect='excel')
# CSV row foreign key
input_key = "zone_id"
# input filter (in this case, only use rows with building_type_id=1
input_filter = lambda row: row.get("building_type_id") == "1"

output = json.load(input_json)
# GeoJSON feature foreign key
output_key = "TAZ1454"
# keys to merge from CSV to JSON features, and their transform value
output_merge = {
	"average_value_per_unit": int
}

zones = {}
for zone in output["features"]:
	zone_id = zone["properties"].get(output_key)
	zones[str(zone_id)] = zone

# rows = rows[::]
# print >> sys.stderr, "%d rows" % len(rows)

for row in rows:
	if input_filter(row):
		zone_id = row.get(input_key)
		zone = zones.get(zone_id)
		if not zone:
			print >> sys.stderr, "NO SUCH ZONE:", zone_id
			# sys.exit(1)
			continue
		for key in output_merge.keys():
			if row.has_key(key):
				value = row.get(key)
				transform = output_merge[key]
				if transform and callable(transform):
					value = transform(value)
				print >> sys.stderr, "%s [%s] = %s" % (zone_id, key, value)
				zone["properties"][key] = value
			else:
				print >> sys.stderr, "NO SUCH KEY:", key
				# sys.exit(1)
	else:
		# print >> sys.stderr, "BAD ROW:", row
		# sys.exit(1)
		pass

json.dump(output, sys.stdout, use_decimal=True)
