import sys, csv
import json
from optparse import OptionParser

parser = OptionParser()
opts, args = parser.parse_args()

input_csv, input_json = map(lambda f: open(f, 'r'), args)

rows = csv.DictReader(input_csv, dialect='excel')
# CSV row foreign key
input_key = "zone_id"

null_value = -1

def coerce_int(s):
    if len(s) > 0:
        return int(s)
    return null_value

output = json.load(input_json)
# GeoJSON feature foreign key
output_key = "TAZ1454"
# keys to merge from CSV to JSON features, and their transform value
output_merge = {
    "price10":      [coerce_int, "price_2010"],
    "price20pr":    [coerce_int, "price_2020"],
    "price30pr":    [coerce_int, "price_2030"],
    "price40pr":    [coerce_int, "price_2040"],
}

zones = {}
for zone in output["features"]:
    zone_id = zone["properties"].get(output_key)
    zone["id"] = zone_id
    zones[str(zone_id)] = zone

# rows = rows[::]
# print >> sys.stderr, "%d rows" % len(rows)

for row in rows:
    zone_id = row.get(input_key)
    zone = zones.get(zone_id)
    if not zone:
        print >> sys.stderr, "NO SUCH ZONE:", zone_id
        # sys.exit(1)
        continue
    for key, transform in output_merge.items():
        if row.has_key(key):
            value = row.get(key)
            if transform:
                if type(transform) in (list, tuple):
                    transform, key = transform
                value = transform(value)
            print >> sys.stderr, "%s [%s] = %s" % (zone_id, key, value)
            zone["properties"][key] = value
        else:
            print >> sys.stderr, "NO SUCH KEY:", key
            # sys.exit(1)

json.encoder.FLOAT_REPR = lambda f: ("%.4f" % f)
json.dump(output, sys.stdout, indent=None, separators=(",", ":"))
