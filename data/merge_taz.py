import sys, csv
import json
from optparse import OptionParser

parser = OptionParser()
opts, args = parser.parse_args()

home_price_csv, home_count_csv, input_json = map(lambda f: open(f, 'r'), args)

price_rows = csv.DictReader(home_price_csv, dialect='excel')
count_rows = csv.DictReader(home_count_csv, dialect='excel')

null_value = -999

def coerce_int(s):
    if len(s) > 0:
        return int(s)
    return null_value

output = json.load(input_json)

# CSV row foreign key
price_zone_key = "zone_id"
count_zone_key = "TAZ"
# GeoJSON feature foreign key
output_key = "TAZ1454"

# the output key, the input key from housing price CSV,
# the input key from housing count CSV
price_mapping = {
  "price_2010": "price10",
  "price_2020": "price20pr",
  "price_2030": "price30pr",
  "price_2040": "price40pr"
}

count_mapping = {
  "units_2010": "units10",
  "units_2020": "units20",
  "units_2030": "units30",
  "units_2040": "units40"
}

# create a dictionary of all TAZ zones
zones = {}
for zone in output["features"]:
    zone_id = zone["properties"].get(output_key)
    zone["id"] = zone_id
    zones[str(zone_id)] = zone

for price_row, count_row in zip(price_rows, count_rows):
    zone_id = price_row.get(price_zone_key)
    assert count_row.get(count_zone_key) == zone_id

    zone = zones.get(zone_id)
    if not zone:
        print >> sys.stderr, "NO SUCH ZONE:", zone_id
        sys.exit(1)

    for o_key, i_key in price_mapping.items():
      zone["properties"][o_key] = coerce_int(price_row.get(i_key))
    for o_key, i_key in count_mapping.items():
      zone["properties"][o_key] = coerce_int(count_row.get(i_key))

json.encoder.FLOAT_REPR = lambda f: ("%.4f" % f)
json.dump(output, sys.stdout, indent=None, separators=(",", ":"))
