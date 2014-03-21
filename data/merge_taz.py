import sys, csv
import json
from optparse import OptionParser

parser = OptionParser()
opts, args = parser.parse_args()

input_csv, input_json = map(lambda f: open(f, 'r'), args)

input_rows = csv.DictReader(input_csv, dialect='excel')

null_value = -999

def coerce_int(s):
    if len(s) > 0:
        return int(s)
    return null_value

output = json.load(input_json)

# CSV row foreign key
count_zone_key = "TAZ"
# GeoJSON feature foreign key
output_key = "TAZ1454"

mapping = {
  "units_2010": "units10",
  "units_2020": "units20",
  "units_2030": "units30",
  "units_2040": "units40",
  "price_2010": "allprice10",
  "price_2020": "allprice20np",
  "price_2030": "allprice30np",
  "price_2040": "allprice40np"
}

# create a dictionary of all TAZ zones
zones = {}
for zone in output["features"]:
    zone_id = zone["properties"].get(output_key)
    zone["id"] = zone_id
    zones[str(zone_id)] = zone

for input_row in input_rows:
    zone_id = input_row.get(count_zone_key)

    zone = zones.get(zone_id)
    if not zone:
        print >> sys.stderr, "NO SUCH ZONE:", zone_id
        sys.exit(1)

    for o_key, i_key in mapping.items():
      zone["properties"][o_key] = coerce_int(input_row.get(i_key))

json.encoder.FLOAT_REPR = lambda f: ("%.4f" % f)
json.dump(output, sys.stdout, indent=None, separators=(",", ":"))
