ZIP ?= http://analytics.mtc.ca.gov/foswiki/pub/Main/2030_03_116/SimpleTimeSkims.zip

all: skims.zip
	unzip -o skims.zip

skims.zip:
	curl -o skims.zip $(ZIP)

clean:
	rm -f skims.zip *.csv

.PRECIOUS: skims.zip

