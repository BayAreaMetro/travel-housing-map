ZIP ?= http://analytics.mtc.ca.gov/foswiki/pub/Main/2010_03_YYY/SimpleTimeSkims.zip

all: skims.zip
	unzip -of skims.zip

skims.zip:
	curl -O $(ZIP) > $@

clean:
	rm -f skims.zip *.csv

.PRECIOUS: skims.zip
