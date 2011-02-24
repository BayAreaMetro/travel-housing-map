all: taz-out.json

taz1454.shp:
	unzip $(basename $@).zip
	cp taz1454{-simplified,}.shp
	cp taz1454{-simplified,}.shx

buildings_min.csv: buildings.csv
	cat $< | cut -d , -f 1,3,11 > $@
	perl -pi -e 's/:i4//g' $@

taz-in.json: taz1454.shp
	ogr2ogr -f GeoJSON -t_srs EPSG:4326 $@ $<

taz-out.json: taz-in.json buildings_min.csv
	python merge_taz.py buildings_min.csv $< > $@

clean:
	rm -f buildings_min.csv
	rm -f taz-in.json taz-out.json
	rm -f taz1454.{shp,shx,prj,sbn,sbx,dbf}
