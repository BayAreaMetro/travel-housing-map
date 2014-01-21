all: skims.zip
	unzip -o skims.zip

skims.zip:
	echo "Download SimpleTimeSkims from http://analytics.mtc.ca.gov/foswiki/Main/2040_03_116 and rename to skims.zip"

clean:
	rm -f skims.zip *.csv

.PRECIOUS: skims.zip

