s3cmd ?= s3cmd -c .s3cfg -P
host ?= s3://maps.onebayarea.org

all: sync

sync: sync-areas sync-scenarios

sync-www:
	$(s3cmd) put -r www/ $(host)/

sync-scenarios:
	$(s3cmd) put -r data/output/scenarios/* $(host)/data/scenarios/

sync-areas:
	$(s3cmd) put -r data/output/areas/* $(host)/data/areas/
